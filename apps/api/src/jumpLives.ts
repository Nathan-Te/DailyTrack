import { formatDay, mixSeed } from "@cdj/core";
import {
  JUMP_GENERATOR_VERSION,
  JUMP_SIM_VERSION,
  JumpReplayError,
  checkLife,
  decodeReplay,
  runsTicks,
  tileOf,
  type JumpReplay,
  type Level,
} from "@cdj/jump-sim";
import { HttpError } from "./errors";
import type { Platform, RequestInfo, Statement } from "./games";

// Lot P3 de la plateforme : **les morts de tout le monde**. Les vies du jour (lot 3 : une rediffusion par vie, partie du départ ou d'un point
// de passage) sont envoyées par lots ; le serveur **rejoue chaque vie** et n'en garde que les morts rejouées (position et cause calculées
// par lui). Il en tire la carte des morts du jour (comptes agrégés par tuile) et un échantillon d'environ 150 vies pour le carnage de tout le
// monde. Les vies brutes d'un jour sont **oubliées** à la première requête qui le voit terminé (comme les sessions du Salon, retouche 27b) ;
// la carte et l'échantillon, figés, restent pour les archives.
//
//   POST /api/jump/lives                       un lot de vies du jour (`X-Player-Id` ; `{ levelId, simVersion, generatorVersion, lives[] }`)
//   GET  /api/jump/day/<AAAA-MM-JJ>/deaths     la carte des morts du jour : tuiles les plus meurtrières, cause dominante, joueurs et morts
//   GET  /api/jump/day/<AAAA-MM-JJ>/carnage    l'échantillon du carnage : ≈ 150 vies d'autres joueurs, au format de rediffusion
//
// **Décision de Nathan : au plus 30 morts par joueur et par jour** (`JUMP_LIVES_PER_DAY`). Seules les vies qui finissent par une mort comptent
// (le jeu n'envoie qu'elles ; une vie dont le rejeu ne finit pas par une mort est écartée) ; au-delà de 30, les vies en trop sont refusées et
// la réponse le dit. Chaque mort compte une fois : un joueur pèse donc au plus 30 morts dans la carte (voulu).
//
// **Validation d'un lot, dans cet ordre** : (1) débit compté **en base** (par adresse puis par joueur), avant de lire le corps et avant tout
// rejeu ; (2) taille du corps (`readJson`, 413) ; (3) le niveau du jour seulement (grâce de 10 min après minuit de Paris) ; (4) versions (409
// `version`) ; puis le joueur : **seul un joueur qui existe déjà** (un résultat valide dans un jeu de la plateforme) envoie des vies (404
// `unknown_player` sinon : le jeu garde ses vies et les envoie après sa première arrivée), code révoqué (410) ; (5) plafonds : vies par lot,
// longueur d'une vie et pas total du lot, puis le plafond du jour (les vies au-delà ne sont pas rejouées) ; (6) **rejeu de chaque vie**
// (`checkLife` de `@cdj/jump-sim` : en-tête atteignable dans ce niveau, une seule vie, fin rejouée). Une vie invalide est écartée seule ; le
// reste du lot est accepté. **Déduplication** : une vie déjà reçue (même joueur, même rediffusion : empreinte SHA-256) n'est pas comptée deux
// fois, même si un lot est renvoyé après une coupure.
//
// **Stockage : jamais une ligne par mort ; au plus deux lignes écrites par lot** (hors compteurs de débit, communs à toutes les routes
// d'envoi) : `jump_lives`, **une ligne par joueur et par jour** qui garde ses vies retenues sous forme compacte (empreinte, tuile, cause,
// section, rediffusion : ≈ 4 ko pour 30 vies), et `jump_deaths`, **une ligne par jour** dont le compteur `version` avance à chaque lot accepté
// et qui garde la carte et l'échantillon calculés. Un lot sans vie retenue n'écrit rien. L'écriture de la ligne du joueur est conditionnelle
// (`rev`) : deux lots simultanés du même joueur ne s'écrasent pas (le second relit et refait la fusion).
//
// **Carte et échantillon** : recalculés au plus toutes les `JUMP_MAP_REFRESH_MS` (3 min) et seulement si des vies sont arrivées depuis le
// dernier calcul (`version`), à partir de toutes les lignes du jour (une ligne lue par joueur), puis gardés **en base** (la ligne du jour : toutes
// les instances la lisent) et **en mémoire** par instance. Un jour fermé est figé : gardé en mémoire sans limite de temps.

/** Décision de Nathan : au plus 30 morts gardées par joueur et par jour (le jeu choisit les siennes, le serveur le vérifie). */
export const JUMP_LIVES_PER_DAY = 30;
/** Vies au plus dans un lot (le jeu en envoie bien moins : il ne lui en reste jamais plus que le plafond du jour). */
export const JUMP_LIVES_PER_LOT = 30;
/** Une vie de plus de 2 minutes n'est pas gardée (le niveau se finit en 25 à 40 s) : borne le coût du rejeu. */
export const JUMP_LIFE_MAX_TICKS = 120 * 120;
/** Pas rejoués au plus par lot (5 minutes de jeu) : ≈ 0,1 s de rejeu au pire. */
export const JUMP_LOT_MAX_TICKS = 120 * 300;
/** Une vie au format de rediffusion fait ≈ 100 caractères ; au-delà de 8 000, elle n'est pas lue. */
export const JUMP_LIFE_MAX_CHARS = 8_000;
/** Lots de vies par joueur et par fenêtre de débit (10 min) : le jeu en envoie un toutes les 3 minutes au plus, plus un à chaque arrivée. */
export const JUMP_LIVES_LOTS_PER_PLAYER = 20;
/** La carte rend au plus les N tuiles les plus meurtrières. */
export const JUMP_MAP_TILES = 300;
/** L'échantillon du carnage : environ 150 vies, au plus 3 par joueur. */
export const JUMP_SAMPLE_SIZE = 150;
export const JUMP_SAMPLE_PER_PLAYER = 3;
/** Recalcul de la carte et de l'échantillon au plus toutes les 3 minutes (par instance, et pour toutes grâce à la ligne du jour en base). */
export const JUMP_MAP_REFRESH_MS = 3 * 60_000;
/** Cartes de jours fermés (figées) gardées en mémoire. */
const CLOSED_CACHE_MAX = 64;

/** Les tables du lot P3 (ajoutées au schéma de DailyJump). */
export const JUMP_LIVES_SCHEMA: string[] = [
  // Une ligne par joueur et par jour : ses vies retenues (au plus 30), sous forme compacte : JSON `[[empreinte, col, row, cause, section,
  // rediffusion], …]` (tuile et cause de la mort **rejouée**). `rev` : écriture conditionnelle (deux lots simultanés ne s'écrasent pas).
  // Effacées à la première requête qui voit le jour terminé.
  `CREATE TABLE IF NOT EXISTS jump_lives (
     day INTEGER NOT NULL,
     player_id TEXT NOT NULL,
     level_id TEXT NOT NULL,
     count INTEGER NOT NULL,
     lives TEXT NOT NULL,
     rev INTEGER NOT NULL,
     updated_at INTEGER NOT NULL,
     PRIMARY KEY (day, player_id)
   )`,
  // Une ligne par jour : `version` avance à chaque lot accepté ; `built` = la version de la carte et de l'échantillon gardés (`map`, `sample`,
  // JSON), calculés à `built_at` ; `frozen` = 1 une fois le jour terminé (vies brutes oubliées : il ne reste que ceci).
  `CREATE TABLE IF NOT EXISTS jump_deaths (
     day INTEGER PRIMARY KEY,
     level_id TEXT NOT NULL,
     version INTEGER NOT NULL,
     built INTEGER NOT NULL DEFAULT -1,
     built_at INTEGER NOT NULL DEFAULT 0,
     frozen INTEGER NOT NULL DEFAULT 0,
     players INTEGER NOT NULL DEFAULT 0,
     deaths INTEGER NOT NULL DEFAULT 0,
     map TEXT,
     sample TEXT
   )`,
];

/** Une vie retenue, telle que la ligne du joueur la garde : empreinte, tuile et cause de la mort rejouée, section, rediffusion. */
export type StoredLife = [hash: string, col: number, row: number, cause: number, section: number, replay: string];

/** Le sort de chaque vie d'un lot, dans l'ordre de l'envoi. */
export type LifeVerdict = "ok" | "duplicate" | "invalid" | "not_death" | "over_cap" | "too_long";

/** `POST /api/jump/lives`. */
export interface JumpLivesResult {
  accepted: number;
  received: number;
  duplicates: number;
  invalid: number;
  /** Vies dont le rejeu ne finit pas par une mort (arrivée, abandon) : écartées. */
  notDeath: number;
  /** Vies au-delà du plafond du jour (refusées sans être rejouées). */
  overCap: number;
  /** Vies retenues pour ce joueur aujourd'hui, et le plafond. */
  dayCount: number;
  cap: number;
  results: LifeVerdict[];
}

/** La carte des morts d'un jour (`GET /api/jump/day/<date>/deaths`). `tiles` : `[col, row, morts, cause dominante]`, les plus meurtrières d'abord. */
export interface DeathMap {
  date: string;
  levelId: string | null;
  open: boolean;
  players: number;
  deaths: number;
  tiles: [number, number, number, number][];
}

/** Une vie de l'échantillon : sa rediffusion, la section où elle meurt, et un numéro de joueur **propre à l'échantillon** (jamais l'identifiant). */
export interface SampleLife {
  replay: string;
  section: number;
  p: number;
}

/** L'échantillon du carnage d'un jour (`GET /api/jump/day/<date>/carnage`). */
export interface CarnageSample {
  date: string;
  levelId: string | null;
  open: boolean;
  simVersion: number;
  generatorVersion: number;
  /** Joueurs et vies **de l'échantillon** (« 142 vies de 37 joueurs ») ; `dayPlayers` : joueurs qui ont envoyé des vies ce jour-là. */
  players: number;
  dayPlayers: number;
  lives: SampleLife[];
}

interface DayData {
  levelId: string | null;
  players: number;
  deaths: number;
  tiles: DeathMap["tiles"];
  sample: SampleLife[];
  samplePlayers: number;
}

/** Empreinte d'une vie (même joueur, même contenu) : SHA-256 de la rediffusion, 12 caractères hexadécimaux (48 bits). */
export async function lifeHash(replay: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(replay));
  return [...new Uint8Array(digest)]
    .slice(0, 6)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Lit la ligne d'un joueur (tolère une ligne abîmée : elle compte pour vide). */
export function parseStoredLives(text: string | null | undefined): StoredLife[] {
  if (!text) return [];
  try {
    const v: unknown = JSON.parse(text);
    if (!Array.isArray(v)) return [];
    return v.filter((l): l is StoredLife => Array.isArray(l) && l.length === 6 && typeof l[0] === "string" && typeof l[5] === "string" && [1, 2, 3, 4].every((k) => Number.isInteger(l[k])));
  } catch {
    return [];
  }
}

/** FNV-1a 32 bits d'un texte (ordre de l'échantillon : rien de secret, seulement un mélange stable). */
function fnv(text: string, seed: number): number {
  let h = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/**
 * La carte des morts : chaque mort retenue compte une fois, agrégée par tuile ; la cause dominante de chaque tuile (à égalité, la plus petite
 * cause) ; les `limit` tuiles les plus meurtrières (à égalité : rangée, puis colonne). Pure, déterministe.
 */
export function buildDeathMap(rows: readonly { lives: readonly StoredLife[] }[], limit = JUMP_MAP_TILES): { players: number; deaths: number; tiles: DeathMap["tiles"] } {
  const byTile = new Map<number, { col: number; row: number; count: number; causes: number[] }>();
  let deaths = 0;
  let players = 0;
  for (const r of rows) {
    if (r.lives.length) players++;
    for (const [, col, row, cause] of r.lives) {
      deaths++;
      const key = row * 65536 + col;
      let t = byTile.get(key);
      if (!t) byTile.set(key, (t = { col, row, count: 0, causes: [0, 0, 0, 0] }));
      t.count++;
      if (cause >= 0 && cause < t.causes.length) t.causes[cause]!++;
    }
  }
  const tiles = [...byTile.values()]
    .sort((a, b) => b.count - a.count || a.row - b.row || a.col - b.col)
    .slice(0, limit)
    .map((t): [number, number, number, number] => {
      let cause = 1;
      for (let c = 1; c < t.causes.length; c++) if (t.causes[c]! > t.causes[cause]!) cause = c;
      return [t.col, t.row, t.count, cause];
    });
  return { players, deaths, tiles };
}

/**
 * L'échantillon du carnage, **déterministe à partir du jour** : réparti **entre les joueurs** (au plus `perPlayer` vies chacun) et **le long du
 * niveau** (tour à tour une vie de chaque section, tant qu'il en reste). Les joueurs sont mélangés par une empreinte du jour et de leur
 * identifiant (l'ordre change chaque jour, rien n'en sort) ; dans une section, les premières vies de chaque joueur passent avant les
 * suivantes. Chaque vie porte un numéro de joueur propre à l'échantillon (0, 1, 2… dans l'ordre d'apparition), jamais l'identifiant.
 */
export function sampleCarnage(
  day: number,
  rows: readonly { player: string; lives: readonly StoredLife[] }[],
  options: { size?: number; perPlayer?: number; sections?: number } = {},
): { lives: SampleLife[]; players: number } {
  const size = options.size ?? JUMP_SAMPLE_SIZE;
  const perPlayer = options.perPlayer ?? JUMP_SAMPLE_PER_PLAYER;
  const seed = mixSeed(day, 0x3ca7);
  const players = rows
    .filter((r) => r.lives.length > 0)
    .map((r) => ({ key: fnv(r.player, seed), lives: r.lives }))
    .sort((a, b) => a.key - b.key);
  let sections = options.sections ?? 0;
  for (const p of players) for (const l of p.lives) sections = Math.max(sections, l[4] + 1);
  sections = Math.max(1, sections);
  // Par section : (rang de la vie chez son joueur, rang du joueur) — les premières vies de chacun d'abord.
  const bySection: { player: number; nth: number; life: StoredLife }[][] = Array.from({ length: sections }, () => []);
  players.forEach((p, pi) => {
    const nth = new Array<number>(sections).fill(0);
    for (const life of p.lives) {
      const s = Math.min(sections - 1, Math.max(0, life[4]));
      bySection[s]!.push({ player: pi, nth: nth[s]!++, life });
    }
  });
  for (const list of bySection) list.sort((a, b) => a.nth - b.nth || a.player - b.player);
  const taken = new Array<number>(players.length).fill(0);
  const cursor = new Array<number>(sections).fill(0);
  const anon = new Map<number, number>();
  const out: SampleLife[] = [];
  for (let progress = true; progress && out.length < size; ) {
    progress = false;
    for (let s = 0; s < sections && out.length < size; s++) {
      const list = bySection[s]!;
      while (cursor[s]! < list.length && taken[list[cursor[s]!]!.player]! >= perPlayer) cursor[s]!++;
      const pick = list[cursor[s]!];
      if (!pick) continue;
      cursor[s]!++;
      taken[pick.player]!++;
      if (!anon.has(pick.player)) anon.set(pick.player, anon.size);
      out.push({ replay: pick.life[5], section: s, p: anon.get(pick.player)! });
      progress = true;
    }
  }
  return { lives: out, players: anon.size };
}

export interface JumpLivesDeps {
  platform: Platform;
  /** Le niveau jouable d'un jour (le même que pour le classement) et son identifiant. */
  playable(day: number): Promise<{ info: { id: string }; level: Level }>;
  /** Le niveau du jour seulement (identifiant `jour-…`) : rend son numéro de jour, ou lève (étape 3 de `submit`). */
  dailyDayOf(levelId: unknown): number;
  /** Une date d'adresse (`AAAA-MM-JJ`) → numéro de jour (404 pour le futur ou avant le premier niveau). */
  dayOf(date: string): number;
  isOpen(day: number): boolean;
  /** Le dernier jour terminé, grâce comprise (hier après la grâce, avant-hier pendant). */
  lastClosed(): number;
  headerPlayer(req: Request, required: boolean): string | null;
  versionError(detail: string): HttpError;
}

export function createJumpLives(deps: JumpLivesDeps) {
  const { platform, playable, dailyDayOf, dayOf, isOpen, lastClosed, headerPlayer, versionError } = deps;
  const { db, now, log, hashKey, hit, readJson, players, limits } = platform;
  /** Carte et échantillon par jour, gardés en mémoire : un jour ouvert `JUMP_MAP_REFRESH_MS`, un jour fermé (figé) sans limite. */
  const memo = new Map<number, { at: number; data: DayData }>();
  /** Calculs en cours (deux lectures simultanées n'en font qu'un). */
  const building = new Map<number, Promise<DayData>>();
  /** Le dernier jour fermé que cette instance a déjà oublié (−1 : pas encore regardé depuis le démarrage). */
  let forgottenThrough = -1;
  let forgetting: Promise<void> | null = null;

  /**
   * **L'oubli des vies brutes** (principe du Salon, retouche 27b : pas de tâche de fond). À la première requête qui voit un jour terminé : pour
   * chaque jour fermé qui a encore des vies, la carte finale et l'échantillon final sont calculés et **figés**, puis les vies brutes **effacées**
   * (une transaction). Une instance qui démarre le refait une fois (rattrape un arrêt prolongé). Ensuite : une comparaison d'entiers.
   */
  function forget(): Promise<void> {
    const closed = lastClosed();
    if (closed <= forgottenThrough) return Promise.resolve();
    forgetting ??= (async () => {
      const days = await db.all<{ day: number }>("SELECT DISTINCT day FROM jump_lives WHERE day <= ?", [closed]);
      for (const { day } of days) {
        const started = performance.now();
        const data = await compute(day);
        const statements: Statement[] = [
          {
            sql: `INSERT INTO jump_deaths (day, level_id, version, built, built_at, frozen, players, deaths, map, sample) VALUES (?, ?, 0, 0, ?, 1, ?, ?, ?, ?)
                  ON CONFLICT (day) DO UPDATE SET built = jump_deaths.version, built_at = excluded.built_at, frozen = 1, players = excluded.players,
                    deaths = excluded.deaths, map = excluded.map, sample = excluded.sample
                  WHERE jump_deaths.frozen = 0`,
            params: [day, data.levelId ?? "", now(), data.players, data.deaths, JSON.stringify(data.tiles), JSON.stringify({ lives: data.sample, players: data.samplePlayers })],
          },
          { sql: "DELETE FROM jump_lives WHERE day = ?", params: [day] },
        ];
        if (db.batch) await db.batch(statements);
        else for (const s of statements) await db.run(s.sql, s.params);
        memo.delete(day);
        log("INFO", "DailyJump : vies du jour oubliées, carte et échantillon figés", { day: formatDay(day), players: data.players, deaths: data.deaths, ms: Math.round(performance.now() - started) });
      }
      forgottenThrough = closed;
    })().finally(() => {
      forgetting = null;
    });
    return forgetting;
  }

  /** La carte et l'échantillon calculés à partir des vies brutes du jour (une ligne lue par joueur). */
  async function compute(day: number): Promise<DayData> {
    const rows = await db.all<{ player_id: string; level_id: string; lives: string }>("SELECT player_id, level_id, lives FROM jump_lives WHERE day = ?", [day]);
    const parsed = rows.map((r) => ({ player: r.player_id, lives: parseStoredLives(r.lives) }));
    let sections = 0;
    try {
      sections = (await playable(day)).level.sections.length;
    } catch {
      sections = 0; // niveau indisponible : l'échantillon se répartit sur les sections vues dans les vies
    }
    const map = buildDeathMap(parsed);
    const sample = sampleCarnage(day, parsed, { sections });
    return { levelId: rows[0]?.level_id ?? null, players: map.players, deaths: map.deaths, tiles: map.tiles, sample: sample.lives, samplePlayers: sample.players };
  }

  function fromRow(row: { level_id: string; players: number; deaths: number; map: string | null; sample: string | null }): DayData {
    let tiles: DeathMap["tiles"] = [];
    let sample: { lives: SampleLife[]; players: number } = { lives: [], players: 0 };
    try {
      tiles = row.map ? (JSON.parse(row.map) as DeathMap["tiles"]) : [];
      sample = row.sample ? (JSON.parse(row.sample) as typeof sample) : sample;
    } catch {
      /* ligne abîmée : une carte vide plutôt qu'une erreur */
    }
    return { levelId: row.level_id || null, players: row.players, deaths: row.deaths, tiles, sample: sample.lives, samplePlayers: sample.players };
  }

  const EMPTY: DayData = { levelId: null, players: 0, deaths: 0, tiles: [], sample: [], samplePlayers: 0 };

  /** La carte et l'échantillon d'un jour : mémoire de l'instance, sinon la ligne du jour, recalculée si des vies sont arrivées depuis (au plus toutes les 3 min). */
  async function dayData(day: number): Promise<DayData> {
    await forget();
    const open = isOpen(day);
    const m = memo.get(day);
    if (m && (!open || now() - m.at < JUMP_MAP_REFRESH_MS)) return m.data;
    let pending = building.get(day);
    if (!pending) {
      pending = loadDay(day, open).finally(() => building.delete(day));
      building.set(day, pending);
    }
    return pending;
  }

  async function loadDay(day: number, open: boolean): Promise<DayData> {
    const row = await db.first<{ level_id: string; version: number; built: number; built_at: number; frozen: number; players: number; deaths: number; map: string | null; sample: string | null }>(
      "SELECT level_id, version, built, built_at, frozen, players, deaths, map, sample FROM jump_deaths WHERE day = ?",
      [day],
    );
    let data: DayData;
    if (!row) data = EMPTY;
    else if (row.frozen === 1 || row.built === row.version || (row.map !== null && now() - row.built_at < JUMP_MAP_REFRESH_MS)) data = fromRow(row);
    else {
      const started = performance.now();
      data = await compute(day);
      await db.run("UPDATE jump_deaths SET built = ?, built_at = ?, players = ?, deaths = ?, map = ?, sample = ? WHERE day = ? AND frozen = 0", [
        row.version,
        now(),
        data.players,
        data.deaths,
        JSON.stringify(data.tiles),
        JSON.stringify({ lives: data.sample, players: data.samplePlayers }),
        day,
      ]);
      log("INFO", "DailyJump : carte des morts calculée", { day: formatDay(day), players: data.players, deaths: data.deaths, ms: Math.round(performance.now() - started) });
    }
    if (!open && memo.size >= CLOSED_CACHE_MAX) memo.delete(memo.keys().next().value!);
    memo.set(day, { at: now(), data });
    return data;
  }

  async function deathMap(date: string): Promise<DeathMap> {
    const day = dayOf(date);
    const d = await dayData(day);
    return { date: formatDay(day), levelId: d.levelId, open: isOpen(day), players: d.players, deaths: d.deaths, tiles: d.tiles };
  }

  async function carnage(date: string): Promise<CarnageSample> {
    const day = dayOf(date);
    const d = await dayData(day);
    return {
      date: formatDay(day),
      levelId: d.levelId,
      open: isOpen(day),
      simVersion: JUMP_SIM_VERSION,
      generatorVersion: JUMP_GENERATOR_VERSION,
      players: d.samplePlayers,
      dayPlayers: d.players,
      lives: d.sample,
    };
  }

  /** `POST /api/jump/lives` : un lot de vies du jour (voir l'en-tête du fichier pour l'ordre de validation). */
  async function receive(req: Request, info: RequestInfo): Promise<JumpLivesResult> {
    // 1. Débit, en base, avant de lire le corps et avant tout rejeu (compteurs propres aux vies de DailyJump).
    await platform.hitAddress(info, "jlip", limits.perClient);
    const playerId = headerPlayer(req, true)!;
    await hit(await hashKey("jlp", playerId), JUMP_LIVES_LOTS_PER_PLAYER);
    await forget();
    // 2. Taille du corps.
    const body = await readJson(req);
    // 3. Le niveau du jour seulement.
    const day = dailyDayOf(body.levelId);
    // 4. Versions : celles du code du jeu, puis le niveau que le serveur joue ce jour-là.
    if (body.simVersion !== JUMP_SIM_VERSION) throw versionError(`simulation v${String(body.simVersion)}, serveur v${JUMP_SIM_VERSION}`);
    if (body.generatorVersion !== JUMP_GENERATOR_VERSION) throw versionError(`générateur v${String(body.generatorVersion)}, serveur v${JUMP_GENERATOR_VERSION}`);
    const { info: level, level: playableLevel } = await playable(day);
    if (body.levelId !== level.id) throw versionError(`niveau ${String(body.levelId)}, le serveur joue ${level.id}`);
    // Le joueur : seul un joueur qui existe déjà envoie des vies ; un code remplacé est refusé.
    await players.assertActive(playerId);
    if (!(await players.find(playerId))) {
      throw new HttpError(404, "unknown_player", "Ce joueur n'existe pas encore sur le serveur : ses vies partiront après sa première arrivée classée");
    }
    // 5. Plafonds du lot.
    const raw = body.lives;
    if (!Array.isArray(raw) || raw.length === 0) throw new HttpError(400, "invalid_lives", "Liste de vies attendue (`lives`)");
    if (raw.length > JUMP_LIVES_PER_LOT) throw new HttpError(413, "too_many_lives", `Au plus ${JUMP_LIVES_PER_LOT} vies par lot`);

    const results: LifeVerdict[] = raw.map(() => "invalid");
    const checked: ({ hash: string; life: StoredLife } | null)[] = raw.map(() => null);
    let lotTicks = 0;
    // Décodage, empreinte, longueurs (bon marché) ; le rejeu vient après le plafond du jour.
    const decoded: (JumpReplay | null)[] = [];
    const hashes: string[] = [];
    for (let i = 0; i < raw.length; i++) {
      const code = raw[i];
      decoded.push(null);
      hashes.push("");
      if (typeof code !== "string" || code.length === 0 || code.length > JUMP_LIFE_MAX_CHARS) {
        results[i] = typeof code === "string" && code.length > JUMP_LIFE_MAX_CHARS ? "too_long" : "invalid";
        continue;
      }
      let replay: JumpReplay;
      try {
        replay = decodeReplay(code);
      } catch (e) {
        results[i] = e instanceof JumpReplayError && e.code === "length" ? "too_long" : "invalid";
        continue;
      }
      const ticks = runsTicks(replay.runs);
      if (ticks > JUMP_LIFE_MAX_TICKS || lotTicks + ticks > JUMP_LOT_MAX_TICKS) {
        results[i] = "too_long";
        continue;
      }
      lotTicks += ticks;
      decoded[i] = replay;
      hashes[i] = await lifeHash(code);
    }

    let accepted = 0;
    let dayCount = 0;
    // Lot R5 : plafond global de rejeux de l'instance (503 au-delà) — un lot compte une unité par 10 vies à rejouer (une vie ≈ 0,5 ms).
    platform.spendReplays(Math.max(1, Math.ceil(decoded.filter((d) => d !== null).length / 10)));
    for (let round = 0; ; round++) {
      // La ligne du joueur (une lecture) : ses vies déjà retenues (déduplication) et le plafond du jour.
      const row = await db.first<{ count: number; lives: string; rev: number }>("SELECT count, lives, rev FROM jump_lives WHERE day = ? AND player_id = ?", [day, playerId]);
      const stored = parseStoredLives(row?.lives);
      const seen = new Set(stored.map((l) => l[0]));
      const kept: StoredLife[] = [...stored];
      for (let i = 0; i < raw.length; i++) {
        const replay = decoded[i];
        if (!replay) continue;
        const hash = hashes[i]!;
        if (seen.has(hash)) {
          results[i] = "duplicate";
          continue;
        }
        // 5 (suite). Le plafond du jour : au-delà, la vie n'est pas rejouée.
        if (kept.length >= JUMP_LIVES_PER_DAY) {
          results[i] = "over_cap";
          continue;
        }
        // 6. Le rejeu : en-tête atteignable, une seule vie, fin rejouée (une seule fois, même si l'écriture doit être refaite).
        let c = checked[i];
        if (c === null && results[i] !== "not_death") {
          const r = checkLife(playableLevel, replay, level.id);
          if (!r.ok) {
            results[i] = "invalid";
            decoded[i] = null;
            continue;
          }
          if (r.life.end !== "mort" || !r.life.death) {
            results[i] = "not_death";
            continue;
          }
          const d = r.life.death;
          c = checked[i] = { hash, life: [hash, tileOf(d.x), tileOf(d.y), d.cause, r.life.section, raw[i] as string] };
        }
        if (!c) continue;
        seen.add(hash);
        kept.push(c.life);
        results[i] = "ok";
      }
      accepted = kept.length - stored.length;
      dayCount = kept.length;
      if (accepted === 0) break;
      // Au plus deux lignes écrites : la ligne du joueur (conditionnelle : `rev` inchangé depuis la lecture), puis le compteur du jour.
      const rev = row?.rev ?? 0;
      const written = await db.first<{ rev: number }>(
        `INSERT INTO jump_lives (day, player_id, level_id, count, lives, rev, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?)
         ON CONFLICT (day, player_id) DO UPDATE SET level_id = excluded.level_id, count = excluded.count, lives = excluded.lives, rev = jump_lives.rev + 1,
           updated_at = excluded.updated_at
         WHERE jump_lives.rev = ?
         RETURNING rev`,
        [day, playerId, level.id, kept.length, JSON.stringify(kept), now(), rev],
      );
      if (written) {
        await db.run(
          "INSERT INTO jump_deaths (day, level_id, version) VALUES (?, ?, 1) ON CONFLICT (day) DO UPDATE SET version = jump_deaths.version + 1, level_id = excluded.level_id WHERE jump_deaths.frozen = 0",
          [day, level.id],
        );
        break;
      }
      // Un autre lot du même joueur a écrit entre-temps : on relit et on refait la fusion (les vies déjà rejouées ne le sont pas de nouveau).
      if (round >= 3) throw new HttpError(503, "busy", "Envoi simultané, réessaie dans un moment");
      for (let i = 0; i < raw.length; i++) if (results[i] === "ok" || results[i] === "duplicate" || results[i] === "over_cap") results[i] = "invalid";
    }
    const count = (v: LifeVerdict) => results.filter((r) => r === v).length;
    const overCap = count("over_cap");
    const out: JumpLivesResult = {
      accepted,
      received: raw.length,
      duplicates: count("duplicate"),
      invalid: count("invalid") + count("too_long"),
      notDeath: count("not_death"),
      overCap,
      dayCount,
      cap: JUMP_LIVES_PER_DAY,
      results, // lot I6 : plus de `message` (texte que le jeu ne lisait pas) ; `overCap` et `cap` disent si le plafond est atteint
    };
    log("INFO", "DailyJump : vies du jour", { day: formatDay(day), received: out.received, accepted, duplicates: out.duplicates, invalid: out.invalid, notDeath: out.notDeath, overCap });
    return out;
  }

  return {
    receive,
    deathMap,
    carnage,
    forget,
    /** « Changer mon code » : les vies du jour suivent le joueur. */
    rotateStatements: (oldId: string, newId: string): Statement[] => [{ sql: "UPDATE jump_lives SET player_id = ? WHERE player_id = ?", params: [newId, oldId] }],
    /**
     * Lot R5 — effacement : les vies brutes du joueur (jours pas encore oubliés) ; la version de ces jours avance, la carte et l'échantillon sont
     * recalculés sans elles à la prochaine lecture (la mémoire de cette instance est vidée : `onErased`).
     */
    erase: async (playerId: string): Promise<{ counts: Record<string, number>; statements: Statement[] }> => {
      const row = await db.first<{ n: number; lives: number | null }>("SELECT COUNT(*) AS n, SUM(count) AS lives FROM jump_lives WHERE player_id = ?", [playerId]);
      return {
        counts: { viesDailyJump: row?.lives ?? 0 },
        statements: [
          { sql: "UPDATE jump_deaths SET version = version + 1 WHERE frozen = 0 AND day IN (SELECT day FROM jump_lives WHERE player_id = ?)", params: [playerId] },
          { sql: "DELETE FROM jump_lives WHERE player_id = ?", params: [playerId] },
        ],
      };
    },
    onErased: () => memo.clear(),
  };
}
