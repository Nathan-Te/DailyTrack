import { formatDay, parseDay } from "@cdj/core";
import { ALT_KEPT_VERSION, BRIDGE_VERSION, JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, LASER_VERSION, MUSHROOM_VERSION, PLATFORM_VERSION, PRESS_VERSION, RESTART_VERSION, SECTION_CLOCK_VERSION, SINGLE_CLOCK_VERSION, STALACTITE_VERSION } from "./constants";
import type { DailyExigence, DailyLevel, DailyPiece } from "./daily";
import { ALT_KEPT_GENERATOR, BRIDGE_GENERATOR, LASER_GENERATOR, RESTART_GENERATOR, MUSHROOM_GENERATOR, PLATFORM_GENERATOR, PRESS_GENERATOR, SECTION_CLOCK_GENERATOR, STALACTITE_GENERATOR, levelNumber, type JumpMedals } from "./jours";
import { parseLevel } from "./level";
import type { Palier } from "./modules";
import { textHash } from "./texthash";
import { decodeReplay, encodeReplay, replayAttempt } from "./replay";
import { jumpThemeForDay } from "./themes";
import type { SlowRoute } from "./voies";

// Niveaux figés (lot 10 ; **une seule règle** depuis le lot P1 de la plateforme) : un fichier compact par date,
// `apps/jump/public/levels/AAAA-MM-JJ.json`, écrit par `npm run freeze:days -w @cdj/jump` (apps/jump/tools/freeze-days.ts). Il garde **le niveau
// tel qu'il a été joué** : la grille (codée par rangée : un caractère et le nombre de répétitions), le bloc annexe (sections et scies), la preuve
// de l'auteur, les médailles, les versions (`JUMP_SIM_VERSION`, `JUMP_GENERATOR_VERSION`) et l'identifiant. Une fois le jeu lancé, on fige
// **avant** tout changement de version : les jours joués ne changent plus jamais, même si le générateur change.
//
// À la lecture (`thawLevel`), rien n'est cru sur parole : versions, identifiant, empreinte du texte, médailles, puis **la preuve est rejouée**
// (`replayAttempt` : arrivée sans mort au temps de l'auteur). Un fichier refusé laisse le jeu générer le niveau comme d'habitude.
// **Le jeu (`apps/jump/src/dailyLoader.ts`) et le serveur (`apps/api/src/jump.ts`) importent cette fonction** : avant le lot P1, chacun avait
// sa copie (`thawLevel` et `thawFrozen`), gardées égales par un test. Fonction pure (aucune lecture de fichier : on lui passe le contenu JSON).
// **Lot R9 : la preuve ne quitte plus le serveur.** Le fichier du dépôt (et celui de l'image du serveur) garde la `preuve` de l'auteur ; **le fichier
// publié aux joueurs ne l'a plus** (`apps/jump/vite.config.ts` la retire à la construction de production, `scripts/site.mjs` le vérifie) : renvoyer la
// preuve au serveur donnerait le temps de l'auteur. `thawPublicLevel` lit les deux formes (avec preuve : la vérification entière ; sans : tout sauf le
// rejeu) ; `thawLevel`, lui, exige la preuve (le serveur). **Limite** : un niveau figé sous une physique que le code ne joue plus ne se rejoue plus : il est refusé (décision pour Nathan : voir
// docs/jump/lots/lot-10-arrivee.md). Lot 15 : le code joue la version 3 **et** la version 4 (`Level.simVersion`) : les jours figés en v3
// (jusqu'au 22/10/2026, générateurs g4 à g9) se rejouent tels quels ; un jour figé en v4 vient d'un générateur g10 ou plus.

export const FROZEN_FORMAT = 1;

export interface FrozenLevel {
  format: number;
  jeu: "dailyjump";
  /** AAAA-MM-JJ. */
  date: string;
  /** `jour-AAAA-MM-JJ-g<N>` : l'identifiant d'origine (rediffusions, mémoire, historique). */
  id: string;
  simVersion: number;
  generatorVersion: number;
  /** La grille, une chaîne par rangée : `#40.12^3` = 40 `#`, 12 `.`, 3 `^` (`rleRow`). */
  grille: string[];
  /** Le reste du texte, tel quel : la ligne vide puis le bloc annexe (sections, scies). */
  annexe: string[];
  /** Empreinte du texte complet (`textHash`). */
  hash: string;
  /** La preuve : la rediffusion de l'auteur (base64url) et son temps (pas). */
  preuve: string;
  auteur: number;
  medailles: JumpMedals;
  /** Ce que le jeu affiche du niveau (morceaux, paliers, mesures). */
  morceaux: DailyPiece[];
  paliers: Palier[];
  palierTicks: number[];
  longestRun: number;
  exigence: DailyExigence;
  tirage: number;
  secours: boolean;
  /** Lot 16 (g11) : les voies lentes et le temps « toutes voies lentes » (absents avant). */
  voies?: SlowRoute[];
  lent?: number;
}

/** Le niveau d'un fichier figé publié aux joueurs (lot R9) : `replay` et `code` (la preuve de l'auteur) n'y sont que si le fichier la portait encore. */
export type PublicDailyLevel = Omit<DailyLevel, "replay" | "code"> & Partial<Pick<DailyLevel, "replay" | "code">>;

/** Une rangée de la grille en plages : `#####...^` → `#5.3^`. Les chiffres n'existent pas dans la légende de la grille : refusés. */
export function rleRow(row: string): string {
  if (/\d/.test(row)) throw new Error(`rangée avec un chiffre : ${row}`);
  let out = "";
  for (let i = 0; i < row.length; ) {
    let j = i + 1;
    while (j < row.length && row[j] === row[i]) j++;
    out += j - i > 1 ? `${row[i]}${j - i}` : row[i];
    i = j;
  }
  return out;
}

/** L'inverse de `rleRow` (lève sur un texte mal formé). */
export function unrleRow(code: string): string {
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

/** Sépare le texte d'un niveau en grille (jusqu'à la première ligne vide) et reste (la ligne vide et le bloc annexe), puis code la grille. */
export function encodeAscii(ascii: string): { grille: string[]; annexe: string[] } {
  const lines = ascii.split("\n");
  const end = lines.indexOf("");
  const cut = end < 0 ? lines.length : end;
  return { grille: lines.slice(0, cut).map(rleRow), annexe: lines.slice(cut) };
}

export function decodeAscii(grille: readonly string[], annexe: readonly string[]): string {
  return [...grille.map(unrleRow), ...annexe].join("\n");
}

/** Version du générateur portée par un identifiant `jour-AAAA-MM-JJ-g<N>`. */
function generatorOf(id: string): number | null {
  const m = /-g(\d+)$/.exec(id);
  return m ? Number(m[1]) : null;
}

/** Le fichier figé d'un niveau du jour. */
export function freezeLevel(d: DailyLevel): FrozenLevel {
  const { grille, annexe } = encodeAscii(d.ascii);
  return {
    format: FROZEN_FORMAT,
    jeu: "dailyjump",
    date: d.date,
    id: d.id,
    simVersion: d.level.simVersion,
    generatorVersion: generatorOf(d.id) ?? JUMP_GENERATOR_VERSION,
    grille,
    annexe,
    hash: d.hash,
    preuve: d.code,
    auteur: d.authorTicks,
    medailles: { ...d.medals },
    morceaux: d.pieces.map((p) => ({ ...p, tags: [...p.tags] })),
    paliers: d.paliers.map((p) => ({ ...p })),
    palierTicks: [...d.palierTicks],
    longestRun: d.longestRun,
    exigence: { sum: d.exigence.sum, rate: d.exigence.rate, thirds: [...d.exigence.thirds] as [number, number, number] },
    tirage: d.chosen,
    secours: d.fallback,
    ...(d.slowRoutes.length > 0 ? { voies: d.slowRoutes.map((r) => ({ ...r, ledges: r.ledges.map((l) => ({ ...l })) })), lent: d.slowTicks } : {}),
  };
}

/** Le texte du fichier (une ligne par champ long : compact, lisible dans une revue). */
export function frozenJson(f: FrozenLevel): string {
  return `${JSON.stringify(f)}\n`;
}

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const isStrings = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === "string");

function isMedals(v: unknown): v is JumpMedals {
  if (typeof v !== "object" || v === null) return false;
  const m = v as Record<string, unknown>;
  return isInt(m.author) && isInt(m.gold) && isInt(m.silver) && isInt(m.bronze) && m.author > 0 && m.author <= m.gold && m.gold <= m.silver && m.silver <= m.bronze;
}

/**
 * Le niveau d'un fichier figé (son contenu JSON) pour la date `day`, ou la raison du refus. Vérifie la forme, la date, les versions (même
 * physique ; un générateur jamais plus récent que le code), l'identifiant, l'empreinte, les médailles, puis **rejoue la preuve**.
 */
export function thawLevel(raw: unknown, day: number): DailyLevel | string {
  return thaw(raw, day, true) as DailyLevel | string;
}

/**
 * Lot R9 : le niveau d'un fichier figé **publié** (celui que le jeu lit). Avec une `preuve`, la vérification est entière (celle de `thawLevel`, les
 * constructions hors production gardent le fichier du dépôt) ; sans elle, tout le reste est vérifié (forme, date, versions, identifiant, empreinte du
 * texte, médailles) et le niveau est rendu sans `replay` ni `code` : le serveur, lui, rejoue toujours l'essai du joueur.
 */
export function thawPublicLevel(raw: unknown, day: number): PublicDailyLevel | string {
  return thaw(raw, day, false);
}

function thaw(raw: unknown, day: number, proofRequired: boolean): PublicDailyLevel | string {
  if (typeof raw !== "object" || raw === null) return "fichier illisible";
  const f = raw as Partial<Record<keyof FrozenLevel, unknown>>;
  if (f.format !== FROZEN_FORMAT || f.jeu !== "dailyjump") return "format inconnu";
  const date = formatDay(day);
  if (f.date !== date || typeof f.date !== "string" || parseDay(f.date) !== day) return "autre date";
  if (!isInt(f.simVersion) || !isInt(f.generatorVersion)) return "versions illisibles";
  if (f.simVersion < SECTION_CLOCK_VERSION || f.simVersion > JUMP_SIM_VERSION) return `autre physique (sim v${f.simVersion}, le jeu joue les v${SECTION_CLOCK_VERSION} à v${JUMP_SIM_VERSION})`;
  if (f.generatorVersion < 1 || f.generatorVersion > JUMP_GENERATOR_VERSION) return "générateur inconnu";
  // Lot 15 : les générateurs jusqu'à g9 produisaient des niveaux en v3, ceux d'après en v4.
  if ((f.simVersion >= SINGLE_CLOCK_VERSION) !== (f.generatorVersion > SECTION_CLOCK_GENERATOR)) return "versions incohérentes";
  // Lot 20 : la version 5 (plateformes mobiles) est celle du générateur g15 et des suivants, jamais d'un générateur d'avant.
  if ((f.simVersion >= PLATFORM_VERSION) !== (f.generatorVersion >= PLATFORM_GENERATOR)) return "versions incohérentes";
  // Lot 22 : la version 6 (presses) est celle du générateur g16 et des suivants ; la version 5 celle de g15 seulement.
  if ((f.simVersion >= PRESS_VERSION) !== (f.generatorVersion >= PRESS_GENERATOR)) return "versions incohérentes";
  // Lot 23 : la version 7 (champignons) est celle du générateur g17 et des suivants ; la version 6 celle de g16 seulement.
  if ((f.simVersion >= MUSHROOM_VERSION) !== (f.generatorVersion >= MUSHROOM_GENERATOR)) return "versions incohérentes";
  // Lot 24 : la version 8 (stalactites) est celle du générateur g18 et des suivants ; la version 7 celle de g17 seulement.
  if ((f.simVersion >= STALACTITE_VERSION) !== (f.generatorVersion >= STALACTITE_GENERATOR)) return "versions incohérentes";
  // Lot 25 : la version 9 (lasers) est celle du générateur g19 et des suivants ; la version 8 celle de g18 seulement.
  if ((f.simVersion >= LASER_VERSION) !== (f.generatorVersion >= LASER_GENERATOR)) return "versions incohérentes";
  // Lot 26 : la version 10 (ponts à interrupteur) est celle du générateur g20 et des suivants ; la version 9 celle de g19 seulement.
  if ((f.simVersion >= BRIDGE_VERSION) !== (f.generatorVersion >= BRIDGE_GENERATOR)) return "versions incohérentes";
  // Lot 27 : la version 11 (nouvel essai à zéro, reprise volontaire) est celle du générateur g21 et des suivants ; la version 10 celle de g20 seulement.
  if ((f.simVersion >= RESTART_VERSION) !== (f.generatorVersion >= RESTART_GENERATOR)) return "versions incohérentes";
  // Lot 28 : la version 12 (alternés qui gardent leur état à la reprise) est celle du générateur g22 et des suivants ; la version 11 celle de g21 seulement.
  if ((f.simVersion >= ALT_KEPT_VERSION) !== (f.generatorVersion >= ALT_KEPT_GENERATOR)) return "versions incohérentes";
  const id = `jour-${date}-g${f.generatorVersion}`;
  if (f.id !== id) return "autre identifiant";
  if (!isStrings(f.grille) || !isStrings(f.annexe) || typeof f.hash !== "string" || !isInt(f.auteur)) return "fichier incomplet";
  const proofGiven = f.preuve !== undefined;
  if (proofGiven ? typeof f.preuve !== "string" : proofRequired) return "fichier incomplet";
  if (!isMedals(f.medailles) || f.medailles.author !== f.auteur) return "médailles illisibles";
  if (!Array.isArray(f.morceaux) || !Array.isArray(f.paliers) || !Array.isArray(f.palierTicks) || !isInt(f.longestRun)) return "fichier incomplet";
  const ex = f.exigence as { sum?: unknown; rate?: unknown; thirds?: unknown } | undefined;
  if (!ex || !isInt(ex.sum) || !isInt(ex.rate) || !Array.isArray(ex.thirds) || ex.thirds.length !== 3) return "fichier incomplet";
  let ascii: string;
  let level;
  let replay;
  try {
    ascii = decodeAscii(f.grille, f.annexe);
    if (textHash(ascii) !== f.hash) return "empreinte du niveau";
    level = parseLevel(ascii);
    if (proofGiven) replay = decodeReplay(f.preuve as string);
    if (level.simVersion !== f.simVersion) return "versions incohérentes";
  } catch (e) {
    return `illisible : ${(e as Error).message}`;
  }
  if (replay) {
    try {
      const r = replayAttempt(level, replay, id);
      if (!r.finished || r.deaths.length > 0 || r.time !== f.auteur) return "la preuve ne se rejoue pas";
    } catch (e) {
      return `la preuve ne se rejoue pas : ${(e as Error).message}`;
    }
    if (encodeReplay(replay) !== f.preuve) return "preuve non canonique";
  }
  return {
    day,
    date,
    number: levelNumber(day),
    id,
    // Lot 11 : un niveau figé est celui du thème naturel de sa date (jamais un essai).
    theme: jumpThemeForDay(day),
    forcedTheme: false,
    level,
    ascii,
    hash: f.hash,
    pieces: f.morceaux as DailyPiece[],
    paliers: f.paliers as Palier[],
    palierTicks: f.palierTicks as number[],
    longestRun: f.longestRun,
    ...(replay ? { replay, code: f.preuve as string } : {}),
    authorTicks: f.auteur,
    medals: { ...f.medailles },
    exigence: ex as DailyExigence,
    attempts: [],
    chosen: isInt(f.tirage) ? f.tirage : 0,
    fallback: f.secours === true,
    // Lot 16 : les voies lentes du niveau (absentes avant g11). Données d'affichage et de mesure : la preuve seule fait foi.
    slowRoutes: Array.isArray(f.voies) ? (f.voies as SlowRoute[]) : [],
    slowTicks: isInt(f.lent) ? f.lent : f.auteur,
  };
}
