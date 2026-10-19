import { formatDay, parseDay } from "@cdj/core";
import {
  JUMP_GENERATOR_VERSION,
  JUMP_SIM_VERSION,
  PREMIER_JOUR_JUMP,
  dailyLevel,
  decodeReplay,
  encodeReplay,
  jumpThemeForDay,
  levelNumber,
  parseLevel,
  replayAttempt,
  textHash,
  type JumpMedals,
} from "@cdj/jump-sim";
import { HttpError } from "./errors";
import type { GameDefinition, GameInstance, Platform, RequestInfo } from "./games";

// DailyJump (`jump`) au registre des jeux (lot P0 de la plateforme) : l'espace `/api/jump/`, **en lecture seule** pour l'instant.
//
//   GET /api/jump/info              versions de la simulation et du générateur, date du jour (Paris), jours figés de l'image, environnement
//   GET /api/jump/day/<AAAA-MM-JJ>  le niveau de cette date tel que le serveur le calcule (identifiant, empreinte, temps de l'auteur,
//                                   médailles, thème ; jamais la grille)
//
// **Le serveur calcule le niveau par la même règle que le jeu** (`apps/jump/src/dailyLoader.ts`) : d'abord le **fichier figé** de la date
// (`apps/jump/public/levels/AAAA-MM-JJ.json`, inclus dans l'image), accepté seulement si tout se vérifie et si **sa preuve se rejoue** (les
// mêmes vérifications que `thawLevel`, `apps/jump/src/frozen.ts`) ; sinon `dailyLevel(jour)` du même code (`@cdj/jump-sim`). Un test compare
// les deux, date par date (`apps/api/test/jump.test.ts`). Résultat gardé dans la table `jump_levels` : **un seul calcul** même si deux requêtes
// arrivent ensemble (une promesse en cours par jour, comme les circuits de DailyTrack) ; la ligne porte la règle qui l'a produite (versions,
// fichier figé) et n'est relue que si elle est la même. Les dates futures sont refusées (comme sur le site publié), et celles d'avant le
// premier niveau. Lectures limitées **en mémoire** (une lecture n'écrit rien).
//
// Les autres tables de DailyJump (essais, vies, morts) arriveront avec les lots qui s'en servent (P1, P3).

/** Lectures de `/api/jump/*` par adresse et par fenêtre de débit (10 minutes) : un jeu en fait une ou deux par partie. */
export const JUMP_READS_PER_CLIENT = 120;

/** La table de DailyJump : le cache des niveaux du jour (aucune donnée de joueur). */
export const JUMP_SCHEMA: string[] = [
  // Niveau du jour de chaque date, tel que le serveur le calcule (figé d'abord, sinon généré). `rule` : la règle qui l'a produit (versions de la
  // simulation et du générateur, empreinte du fichier figé de l'image) ; une autre règle = recalcul. `ascii` : le texte du niveau (le lot P1 le
  // rejouera sans le régénérer) ; jamais rendu par l'API.
  `CREATE TABLE IF NOT EXISTS jump_levels (
     day INTEGER PRIMARY KEY,
     rule TEXT NOT NULL,
     level_id TEXT NOT NULL,
     hash TEXT NOT NULL,
     author_ticks INTEGER NOT NULL,
     medals TEXT NOT NULL,
     theme TEXT NOT NULL,
     source TEXT NOT NULL,
     ascii TEXT NOT NULL,
     created_at INTEGER NOT NULL
   )`,
];

export interface JumpOptions {
  /** Les fichiers figés de l'image (date → contenu JSON), lus à la construction (`scripts/build-node.mjs`) ; vide sans eux. */
  frozen?: Readonly<Record<string, unknown>>;
}

/** Le niveau d'une date tel que `/api/jump/day` le rend. */
export interface JumpDayInfo {
  date: string;
  number: number;
  id: string;
  hash: string;
  authorTicks: number;
  medals: JumpMedals;
  theme: string;
  /** `fige` : le fichier figé de l'image, preuve rejouée ; `genere` : `dailyLevel(jour)`. */
  source: "fige" | "genere";
  simVersion: number;
  generatorVersion: number;
}

interface Computed {
  info: JumpDayInfo;
  ascii: string;
}

// ——— La règle des niveaux figés (miroir de `thawLevel`, apps/jump/src/frozen.ts) ———

const FROZEN_FORMAT = 1;
const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === "string");

function isMedals(v: unknown): v is JumpMedals {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  return isInt(m.author) && isInt(m.gold) && isInt(m.silver) && isInt(m.bronze) && m.author > 0 && m.author <= m.gold && m.gold <= m.silver && m.silver <= m.bronze;
}

/** Une rangée codée en plages (`#40.12^3`) → la rangée ; lève sur un texte mal formé. */
function unrleRow(code: string): string {
  let out = "";
  for (let i = 0; i < code.length; ) {
    const c = code[i]!;
    if (/\d/.test(c)) throw new Error(`plage mal formée : ${code}`);
    let j = i + 1;
    while (j < code.length && /\d/.test(code[j]!)) j++;
    const n = j > i + 1 ? Number(code.slice(i + 1, j)) : 1;
    if (!Number.isInteger(n) || n < 1 || n > 4096) throw new Error(`plage mal formée : ${code}`);
    out += c.repeat(n);
    i = j;
  }
  return out;
}

/**
 * Le niveau d'un fichier figé pour `day`, ou la raison du refus : forme, date, versions (même physique ; un générateur jamais plus récent),
 * identifiant, médailles, empreinte du texte, puis **la preuve rejouée** (arrivée sans mort au temps de l'auteur, rediffusion canonique).
 */
export function thawFrozen(raw: unknown, day: number): Computed | string {
  if (typeof raw !== "object" || raw === null) return "fichier illisible";
  const f = raw as Record<string, unknown>;
  if (f.format !== FROZEN_FORMAT || f.jeu !== "dailyjump") return "format inconnu";
  const date = formatDay(day);
  if (f.date !== date || typeof f.date !== "string" || parseDay(f.date) !== day) return "autre date";
  if (!isInt(f.simVersion) || !isInt(f.generatorVersion)) return "versions illisibles";
  if (f.simVersion !== JUMP_SIM_VERSION) return `autre physique (sim v${f.simVersion}, le serveur est en v${JUMP_SIM_VERSION})`;
  if (f.generatorVersion < 1 || f.generatorVersion > JUMP_GENERATOR_VERSION) return "générateur inconnu";
  const id = `jour-${date}-g${f.generatorVersion}`;
  if (f.id !== id) return "autre identifiant";
  if (!isStrings(f.grille) || !isStrings(f.annexe) || typeof f.hash !== "string" || typeof f.preuve !== "string" || !isInt(f.auteur)) return "fichier incomplet";
  if (!isMedals(f.medailles) || f.medailles.author !== f.auteur) return "médailles illisibles";
  if (!Array.isArray(f.morceaux) || !Array.isArray(f.paliers) || !Array.isArray(f.palierTicks) || !isInt(f.longestRun)) return "fichier incomplet";
  const ex = f.exigence as { sum?: unknown; rate?: unknown; thirds?: unknown } | undefined;
  if (!ex || !isInt(ex.sum) || !isInt(ex.rate) || !Array.isArray(ex.thirds) || ex.thirds.length !== 3) return "fichier incomplet";
  let ascii: string;
  let level;
  let replay;
  try {
    ascii = [...f.grille.map(unrleRow), ...f.annexe].join("\n");
    if (textHash(ascii) !== f.hash) return "empreinte du niveau";
    level = parseLevel(ascii);
    replay = decodeReplay(f.preuve);
  } catch (e) {
    return `illisible : ${(e as Error).message}`;
  }
  try {
    const r = replayAttempt(level, replay, id);
    if (!r.finished || r.deaths.length > 0 || r.time !== f.auteur) return "la preuve ne se rejoue pas";
  } catch (e) {
    return `la preuve ne se rejoue pas : ${(e as Error).message}`;
  }
  if (encodeReplay(replay) !== f.preuve) return "preuve non canonique";
  const info: JumpDayInfo = {
    date,
    number: levelNumber(day),
    id,
    hash: f.hash,
    authorTicks: f.auteur,
    medals: { author: f.medailles.author, gold: f.medailles.gold, silver: f.medailles.silver, bronze: f.medailles.bronze },
    // Un niveau figé est celui du thème naturel de sa date (lot 11).
    theme: jumpThemeForDay(day),
    source: "fige",
    simVersion: f.simVersion,
    generatorVersion: f.generatorVersion,
  };
  return { info, ascii };
}

/** Le niveau d'une date par la règle du jeu : le fichier figé s'il se vérifie, sinon `dailyLevel(jour)`. `frozenMiss` : pourquoi le figé a été refusé. */
export function computeJumpDay(day: number, frozen: unknown): Computed & { frozenMiss: string } {
  let frozenMiss = "";
  if (frozen !== undefined) {
    const thawed = thawFrozen(frozen, day);
    if (typeof thawed !== "string") return { ...thawed, frozenMiss };
    frozenMiss = thawed;
  }
  const d = dailyLevel(day);
  const info: JumpDayInfo = {
    date: d.date,
    number: d.number,
    id: d.id,
    hash: d.hash,
    authorTicks: d.authorTicks,
    medals: { author: d.medals.author, gold: d.medals.gold, silver: d.medals.silver, bronze: d.medals.bronze },
    theme: d.theme,
    source: "genere",
    simVersion: JUMP_SIM_VERSION,
    generatorVersion: JUMP_GENERATOR_VERSION,
  };
  return { info, ascii: d.ascii, frozenMiss };
}

export function createJump(platform: Platform, options: JumpOptions): GameInstance {
  const { db, now, log, today, hashKey, readHit } = platform;
  const frozen = options.frozen ?? {};
  const frozenDays = Object.keys(frozen).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const levels = new Map<number, { rule: string; info: JumpDayInfo }>();
  /** Niveaux en cours de calcul : deux requêtes simultanées n'en font qu'un (≈ 0,2 s de génération). */
  const computing = new Map<number, Promise<JumpDayInfo>>();

  /** La règle d'une date : versions et empreinte du fichier figé de l'image (sans le rejouer : le rejeu ne se fait qu'au calcul). */
  function ruleOf(day: number): string {
    const f = frozen[formatDay(day)] as { hash?: unknown } | undefined;
    const tag = f === undefined ? "-" : `f${typeof f.hash === "string" ? f.hash : "?"}`;
    return `s${JUMP_SIM_VERSION}-g${JUMP_GENERATOR_VERSION}-${tag}`;
  }

  async function getLevel(day: number): Promise<JumpDayInfo> {
    const rule = ruleOf(day);
    const memo = levels.get(day);
    if (memo && memo.rule === rule) return memo.info;
    let pending = computing.get(day);
    if (!pending) {
      pending = loadLevel(day, rule).finally(() => computing.delete(day));
      computing.set(day, pending);
    }
    return pending;
  }

  /** Lu en base si la règle est la même, sinon calculé et gardé. Deux instances peuvent le calculer ensemble : même résultat, même écriture. */
  async function loadLevel(day: number, rule: string): Promise<JumpDayInfo> {
    const row = await db.first<{ rule: string; level_id: string; hash: string; author_ticks: number; medals: string; theme: string; source: string }>(
      "SELECT rule, level_id, hash, author_ticks, medals, theme, source FROM jump_levels WHERE day = ?",
      [day],
    );
    let info: JumpDayInfo;
    if (row && row.rule === rule) {
      const generatorVersion = Number(/-g(\d+)$/.exec(row.level_id)?.[1] ?? JUMP_GENERATOR_VERSION);
      info = {
        date: formatDay(day),
        number: levelNumber(day),
        id: row.level_id,
        hash: row.hash,
        authorTicks: row.author_ticks,
        medals: JSON.parse(row.medals) as JumpMedals,
        theme: row.theme,
        source: row.source === "fige" ? "fige" : "genere",
        simVersion: JUMP_SIM_VERSION,
        generatorVersion,
      };
    } else {
      const started = performance.now();
      const c = computeJumpDay(day, frozen[formatDay(day)]);
      info = c.info;
      await db.run(
        "INSERT OR REPLACE INTO jump_levels (day, rule, level_id, hash, author_ticks, medals, theme, source, ascii, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [day, rule, info.id, info.hash, info.authorTicks, JSON.stringify(info.medals), info.theme, info.source, c.ascii, now()],
      );
      if (c.frozenMiss) log("WARNING", "DailyJump : niveau figé refusé, niveau généré", { day: info.date, reason: c.frozenMiss.slice(0, 120) });
      log("INFO", "DailyJump : niveau du jour calculé", { day: info.date, id: info.id, source: info.source, ms: Math.round(performance.now() - started) });
    }
    levels.set(day, { rule, info });
    return info;
  }

  function dayOf(date: string): number {
    const day = parseDay(date);
    if (day === null) throw new HttpError(400, "invalid_date", "Date attendue au format AAAA-MM-JJ");
    if (day > today()) throw new HttpError(404, "unknown_day", "Ce niveau n'est pas encore sorti");
    if (day < PREMIER_JOUR_JUMP) throw new HttpError(404, "unknown_day", "Ce jour n'a pas de niveau DailyJump");
    return day;
  }

  async function limitReads(info: RequestInfo): Promise<void> {
    if (info.clientKey) readHit(await hashKey("jrd", info.clientKey), JUMP_READS_PER_CLIENT);
  }

  async function route(path: string, req: Request, _url: URL, info: RequestInfo): Promise<unknown> {
    if (path === "/api/jump/info") {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      await limitReads(info);
      return { game: "jump", simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, today: formatDay(today()), frozenDays, environment: platform.environment };
    }
    const m = /^\/api\/jump\/day\/([^/]+)$/.exec(path);
    if (m) {
      if (req.method !== "GET") throw new HttpError(405, "method_not_allowed", "GET attendu");
      await limitReads(info);
      let date: string;
      try {
        date = decodeURIComponent(m[1]!);
      } catch {
        throw new HttpError(400, "invalid_date", "Date attendue au format AAAA-MM-JJ");
      }
      return await getLevel(dayOf(date));
    }
    if (path === "/api/jump" || path.startsWith("/api/jump/")) throw new HttpError(404, "not_found", "Route inconnue");
    return undefined;
  }

  return { route, dailyLevel: getLevel };
}

/** DailyJump au registre : routes sous `/api/jump`. La validation des essais (rejeu serveur) arrive au lot P1. */
export const JUMP_GAME: GameDefinition<JumpOptions> = {
  code: "jump",
  name: "DailyJump",
  prefix: "/api/jump",
  tables: ["jump_levels"],
  schema: JUMP_SCHEMA,
  versions: () => ({ simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION }),
  create: createJump,
};
