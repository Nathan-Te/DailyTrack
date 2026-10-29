import { formatDay } from "@cdj/core";
import {
  JUMP_GENERATOR_VERSION,
  JUMP_SIM_VERSION,
  JUMP_THEME_NAMES,
  dailyLevelId,
  decodeReplay,
  encodeReplay,
  medalsWithSlow,
  jumpThemeForDay,
  levelNumber,
  parseLevel,
  replayAttempt,
  textHash,
  type DailyAttempt,
  type DailyExigence,
  type DailyLevel,
  type DailyPiece,
  type JumpThemeName,
  type Palier,
  type SlowRoute,
} from "@cdj/jump-sim";

// Le niveau du jour sous une forme qui se transporte (lot 7b) : du JSON, sans le `Level` (tableaux typés, rangs) ni ce qu'un calcul rend
// de toute façon (médailles, rediffusion décodée, date, numéro). Le **même** chemin sert au worker (qui renvoie une `DailyPayload`) et au
// cache de stockage : `fromPayload` reconstruit le `DailyLevel` — et, quand on ne fait pas confiance à la source, **rejoue la preuve**.
// Logique pure, sans DOM ni stockage : testée sous Node.

/**
 * Version du format de la charge (à monter si ses champs changent : l'ancien cache est alors ignoré). Lot 11 : 2 (la charge porte le thème du
 * niveau — celui de la date ou un thème **forcé** : un essai, dont l'identifiant est suffixé `-t<thème>`). Lot 16 : 3 (les voies lentes et le
 * temps « toutes voies lentes » ; les médailles en dépendent).
 */
export const PAYLOAD_FORMAT = 3;

export interface DailyPayload {
  format: number;
  simVersion: number;
  generatorVersion: number;
  day: number;
  id: string;
  /** Lot 11 : le thème du niveau et s'il est forcé (différent de celui de la date : un essai). */
  theme: JumpThemeName;
  forcedTheme: boolean;
  /** Texte complet du niveau (grille et bloc annexe) et son empreinte. */
  ascii: string;
  hash: string;
  pieces: DailyPiece[];
  paliers: Palier[];
  palierTicks: number[];
  longestRun: number;
  /** La preuve : la rediffusion de l'auteur (base64url) et son temps, en pas. */
  code: string;
  authorTicks: number;
  exigence: DailyExigence;
  attempts: DailyAttempt[];
  chosen: number;
  fallback: boolean;
  /** Lot 16 : les voies lentes et le temps « toutes voies lentes ». */
  slowRoutes: SlowRoute[];
  slowTicks: number;
}

/** Ce qu'il y a de transportable dans un `DailyLevel`. */
export function toPayload(d: DailyLevel): DailyPayload {
  return {
    format: PAYLOAD_FORMAT,
    simVersion: JUMP_SIM_VERSION,
    generatorVersion: JUMP_GENERATOR_VERSION,
    day: d.day,
    id: d.id,
    theme: d.theme,
    forcedTheme: d.forcedTheme,
    ascii: d.ascii,
    hash: d.hash,
    pieces: d.pieces.map((p) => ({ ...p, tags: [...p.tags] })),
    paliers: d.paliers.map((p) => ({ ...p })),
    palierTicks: [...d.palierTicks],
    longestRun: d.longestRun,
    code: d.code,
    authorTicks: d.authorTicks,
    exigence: { sum: d.exigence.sum, rate: d.exigence.rate, thirds: [...d.exigence.thirds] as [number, number, number] },
    attempts: d.attempts.map((a) => ({ ...a, pieces: [...a.pieces] })),
    chosen: d.chosen,
    fallback: d.fallback,
    slowRoutes: d.slowRoutes.map((r) => ({ ...r, ledges: r.ledges.map((l) => ({ ...l })) })),
    slowTicks: d.slowTicks,
  };
}

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

/** La charge a-t-elle la forme attendue ? (un stockage peut contenir n'importe quoi). */
export function isPayload(v: unknown): v is DailyPayload {
  if (typeof v !== "object" || v === null) return false;
  const p = v as Record<string, unknown>;
  const t = (p.exigence as { thirds?: unknown } | undefined)?.thirds;
  return (
    p.format === PAYLOAD_FORMAT &&
    isInt(p.simVersion) &&
    isInt(p.generatorVersion) &&
    isInt(p.day) &&
    typeof p.id === "string" &&
    typeof p.theme === "string" &&
    (JUMP_THEME_NAMES as readonly string[]).includes(p.theme) &&
    typeof p.forcedTheme === "boolean" &&
    typeof p.ascii === "string" &&
    typeof p.hash === "string" &&
    typeof p.code === "string" &&
    Array.isArray(p.pieces) &&
    Array.isArray(p.paliers) &&
    Array.isArray(p.palierTicks) &&
    Array.isArray(p.attempts) &&
    isInt(p.longestRun) &&
    isInt(p.authorTicks) &&
    isInt(p.chosen) &&
    typeof p.fallback === "boolean" &&
    Array.isArray(p.slowRoutes) &&
    isInt(p.slowTicks) &&
    Array.isArray(t) &&
    t.length === 3
  );
}

/**
 * Reconstruit le niveau d'une charge pour la date `day`, ou rend la raison du refus. Toujours vérifié : versions, identifiant, empreinte du
 * texte ; avec `proof` (le cache), **la preuve est rejouée** (`replayAttempt` : arrivée sans mort au temps de l'auteur) — une charge corrompue
 * ou périmée ne passe jamais.
 */
export function fromPayload(p: unknown, day: number, options: { proof: boolean; theme?: JumpThemeName | null }): DailyLevel | string {
  if (!isPayload(p)) return "charge illisible";
  if (p.simVersion !== JUMP_SIM_VERSION || p.generatorVersion !== JUMP_GENERATOR_VERSION) return "autre version";
  // Lot 11 : le thème attendu est celui qu'on a demandé (`theme`, forcé) ou celui de la date ; un autre thème est un autre niveau.
  const natural = jumpThemeForDay(day);
  const theme = options.theme ?? natural;
  const id = dailyLevelId(day, theme);
  if (p.day !== day || p.id !== id || p.theme !== theme || p.forcedTheme !== (theme !== natural)) return "autre niveau";
  if (textHash(p.ascii) !== p.hash) return "empreinte du niveau";
  let level;
  let replay;
  try {
    level = parseLevel(p.ascii);
    replay = decodeReplay(p.code);
  } catch (e) {
    return `illisible : ${(e as Error).message}`;
  }
  if (options.proof) {
    try {
      const r = replayAttempt(level, replay, id);
      if (!r.finished || r.deaths.length > 0 || r.time !== p.authorTicks) return "la preuve ne se rejoue pas";
    } catch (e) {
      return `la preuve ne se rejoue pas : ${(e as Error).message}`;
    }
    if (encodeReplay(replay) !== p.code) return "preuve non canonique";
  }
  return {
    day,
    date: formatDay(day),
    number: levelNumber(day),
    id,
    theme,
    forcedTheme: theme !== natural,
    level,
    ascii: p.ascii,
    hash: p.hash,
    pieces: p.pieces,
    paliers: p.paliers,
    palierTicks: p.palierTicks,
    longestRun: p.longestRun,
    replay,
    code: p.code,
    authorTicks: p.authorTicks,
    medals: medalsWithSlow(p.authorTicks, p.slowRoutes, p.simVersion),
    exigence: p.exigence,
    attempts: p.attempts,
    chosen: p.chosen,
    fallback: p.fallback,
    slowRoutes: p.slowRoutes,
    slowTicks: p.slowTicks,
  };
}
