import { DEFAULT_CAR_PARAMS } from "./car";
import { CELL, curveSize, isCurve, parseToken, type BlockKind } from "./track";
import { SURFACES } from "./world";

// Freinage possible après un boost (lot 34) : un modèle **statique** de la vitesse le long d'une suite de blocs, sans faire rouler la voiture,
// pour que le générateur sache, en posant une figure, si le virage qui suit une plaque, un super turbo ou une portion rapide se freine à temps.
// Calé sur la mesure dynamique (`turnReports`, traps.ts) : il ne remplace pas le pilote, il dit au générateur où ajouter une droite de
// freinage ou un bas-côté. Toutes les vitesses en m/s, les distances en m.
//
// Le long d'une approche (depuis la sortie du virage précédent) : la voiture accélère plein gaz jusqu'à la pointe du plat (48 m/s), une plaque
// la pousse à 66 m/s, un super turbo à 88 m/s ; **tant que la poussée agit le frein ne gagne presque rien** (frein 40 contre plaque 30 et
// turbo 42) : la distance où l'on peut freiner ne commence qu'à la fin de la poussée. Au-delà de la pointe, la traînée en cube ralentit
// (lot 15) ; une pente pousse ou retient (`slopeGravity` × pente) ; en l'air (rampe, vide, réception, bosse) on ne freine pas.

const P = DEFAULT_CAR_PARAMS;
/**
 * Distance (m) sous la poussée d'une plaque (0,9 s à ≈ 64 m/s) et d'un super turbo (1,5 s à ≈ 80 m/s), comptée depuis l'entrée du bloc de
 * l'effet (la poussée part de sa plaque, au milieu du bloc).
 */
const PAD_PUSH = 74;
const TURBO_PUSH = 136;
/** Vitesse en sortie d'une cuve (retouche 18b : la paroi est une voie rapide). */
const CUVE_EXIT = 56;
/** Frein compté (m/s²) : celui du pilote d'auteur (0,8 × 40) × motricité, comme la mesure (`turnReports`) ; la traînée n'est pas comptée (marge). */
const BRAKE = 0.8 * P.brake;
/** Temps de réaction (s) gardé en plus de la distance de freinage : la marge des virages-pièges (`TRAP_SLACK`, traps.ts). */
export const BRAKE_REACTION = 0.3;
/**
 * Vitesse de passage (m/s, route) d'un virage serré, large, ample : les plus basses du pilote d'auteur mesurées par `turnReports` (un virage relevé
 * ne se prend pas plus vite derrière un super turbo : le pilote y entre sur la corde, mesuré).
 */
const TURN_SPEED: Record<1 | 2 | 3, number> = { 1: 21, 2: 38, 3: 46 };
/** Vitesse (m/s) au-delà de laquelle l'approche d'un virage est « rapide » (portion rapide, descente) : 10 % au-dessus de la pointe du plat. */
export const FAST_APPROACH = P.maxSpeed * 1.1;
/** Droites de freinage que le générateur ajoute au plus devant un virage (au-delà, la variante de la figure est refusée). */
export const MAX_BRAKING_ADD = 4;
/** Écart de vitesse (m/s) en deçà duquel il n'y a pas de vrai freinage (deux virages enchaînés, un virage abordé à sa vitesse). */
export const MIN_BRAKE = 8;

/** Traînée (m/s²) au-delà de la pointe du plat, comme `overspeedDrag` (car.ts). */
function drag(v: number): number {
  if (v <= P.maxSpeed) return 0;
  const r = v / P.maxSpeed;
  return P.overspeedDrag * (r * r * r - 1);
}

/** État de l'approche d'un virage : vitesse plein gaz, poussée restante, distance libre pour freiner, plus grande vitesse depuis la fin de la poussée. */
export interface Approach {
  v: number;
  /** Mètres de poussée (plaque, super turbo) encore devant. */
  push: number;
  /** Mètres où l'on peut freiner depuis la fin de la dernière poussée (ou la sortie du virage précédent). */
  free: number;
  /** Plus grande vitesse sur cette distance libre. */
  peak: number;
  /** Une plaque ou un super turbo depuis le virage précédent. */
  boosted: boolean;
  /** Vitesse où la poussée en cours mène la voiture (0 sans poussée). */
  top: number;
}

/** Vitesse de passage estimée d'un virage (bloc de la notation). */
function turnSpeed(token: string): number {
  const p = parseToken(token);
  const size = curveSize(p.kind);
  const m = SURFACES[p.surface];
  const grip = m.slick > 0 ? P.iceCoastGrip : m.grip;
  return TURN_SPEED[size] * Math.sqrt(grip);
}

const isAir = (k: BlockKind) => k === "kick" || k === "gap" || k === "bump" || k === "jump";

/** Avance l'approche d'un bloc qui n'est pas un virage (`prev` : le bloc d'avant, pour la réception d'un saut). */
export function advance(a: Approach, token: string, prev?: string): void {
  const p = parseToken(token);
  if (isCurve(p.kind)) {
    // Sortie d'un virage : l'approche suivante repart de sa vitesse de passage.
    const v = p.cuve ? CUVE_EXIT : turnSpeed(token);
    a.v = v;
    a.top = 0;
    a.push = 0;
    a.free = 0;
    a.peak = v;
    a.boosted = false;
    return;
  }
  if (p.cuve) {
    a.v = Math.max(a.v, CUVE_EXIT);
    a.push = 0;
    a.free = 0;
    a.peak = a.v;
    return;
  }
  if (p.kind === "boost" || p.kind === "turbo") {
    // La poussée repart de zéro : on ne freine qu'après elle, à la vitesse où elle laisse la voiture.
    a.push = Math.max(a.push, p.kind === "boost" ? PAD_PUSH : TURBO_PUSH);
    a.top = Math.max(a.top, p.kind === "boost" ? P.boostMaxSpeed : P.turboMaxSpeed);
    a.free = 0;
    a.peak = 0;
    a.boosted = true;
  }
  const pushed = Math.min(a.push, CELL);
  a.push -= pushed;
  if (pushed > 0) a.v = Math.max(a.v, a.top);
  const start = a.v;
  if (a.push <= 0) a.top = 0;
  const rest = CELL - pushed;
  // Hors poussée : pente (`slopeGravity` × dénivelé), traînée au-delà de la pointe, ou plein gaz vers la pointe du plat (≈ 12 m/s²).
  const rise = (p.kind === "up" || p.kind === "down" ? (p.rise ?? (p.kind === "up" ? 4 : -4)) : 0) * (rest / CELL);
  const v2 = a.v > P.maxSpeed ? a.v * a.v - 2 * drag(a.v) * rest - 2 * P.slopeGravity * rise : Math.min(P.maxSpeed * P.maxSpeed, a.v * a.v + 2 * 12 * rest) - 2 * P.slopeGravity * rise;
  a.v = Math.sqrt(Math.max(v2, 100));
  // En l'air (rampe, vide, bosse) et sur la réception d'un saut, le frein ne sert à rien.
  const landing = prev !== undefined && parseToken(prev).kind === "gap";
  if (isAir(p.kind) || landing) {
    a.free = 0;
    a.peak = a.v;
    return;
  }
  if (rest > 0) {
    // La plus grande vitesse de la distance libre : à la fin de la poussée (avant la traînée de ce bloc), ou plus loin dans une descente.
    a.peak = Math.max(a.peak, start, a.v);
    a.free += rest;
  }
}

/**
 * Mètres de freinage qui manquent avant le virage `token` (≤ 0 : il se freine, avec `BRAKE_REACTION` de marge). Freinage compté depuis la
 * plus grande vitesse de la distance libre jusqu'à la vitesse de passage, sur la motricité de `approachSurface` (la route par défaut).
 */
export function brakingDeficit(a: Approach, token: string, traction = 1): number {
  const vt = turnSpeed(token);
  const v = Math.max(a.peak, a.v);
  if (v < vt + MIN_BRAKE) return -Infinity;
  const decel = BRAKE * traction;
  return (v * v - vt * vt) / (2 * decel) + BRAKE_REACTION * v - a.free;
}

/** Approche à la fin d'une suite de blocs (depuis le départ, à l'arrêt). */
export function approachAfter(tokens: readonly string[]): Approach {
  const a: Approach = { v: 0, push: 0, free: 0, peak: 0, boosted: false, top: 0 };
  for (let i = 0; i < tokens.length; i++) advance(a, tokens[i]!, tokens[i - 1]);
  return a;
}

/** Ce que `secureBraking` a fait d'une figure : ses blocs (droites ajoutées), et des indices **relatifs au début de la figure**. */
export interface BrakingFix {
  tokens: string[];
  /** Virages qui reçoivent un bas-côté (échappatoire), et le bloc qui les suit. */
  escapes: number[];
  /** Blocs d'approche d'un virage rapide ou corrigé (de la sortie du virage précédent au virage) : ni zone de revêtement, ni route bosselée, ni section sans rebords. Peut être négatif (blocs des figures d'avant). */
  protect: number[];
  /** Droites de freinage ajoutées, virages-pièges gardés. */
  added: number;
  kept: number;
}

const isStop = (token: string): boolean => {
  const p = parseToken(token);
  return isCurve(p.kind) || !!p.cuve;
};

/**
 * Règle « freinage possible après un boost » (lot 34, générateur v16) sur les blocs d'une figure posée derrière `before`. Pour chaque virage
 * (hors cuve) **abordé vite** (après une plaque, un super turbo ou à plus de `FAST_APPROACH` : une portion rapide) : si le thème a un
 * bas-côté, il en reçoit un (moins de murs à l'extérieur ; pas sur un virage relevé) ; si le freinage manque (`brakingDeficit` > 0, temps de
 * réaction compris), on ajoute des droites de freinage devant lui (au plus `MAX_BRAKING_ADD`, sinon `null` : la variante est refusée),
 * **sauf** le seul virage-piège permis (`allowTrap` : le passage signature, ou Ville), gardé tel quel. Les enchaînements techniques ordinaires
 * (un large puis un serré, sous la pointe du plat) ne sont pas touchés : ils sont l'intention de leur figure.
 */
export function secureBraking(before: readonly string[], tokens: readonly string[], o: { escape: boolean; allowTrap: boolean }): BrakingFix | null {
  const a = approachAfter(before);
  const out: string[] = [];
  const fix: BrakingFix = { tokens: out, escapes: [], protect: [], added: 0, kept: 0 };
  let prev = before[before.length - 1];
  let from = before.length;
  while (from > 0 && !isStop(before[from - 1]!)) from--;
  let approach = from - before.length;
  for (const token of tokens) {
    const p = parseToken(token);
    if (isCurve(p.kind) && !p.cuve) {
      const deficit = brakingDeficit(a, token);
      const fast = deficit > -Infinity && (a.boosted || Math.max(a.peak, a.v) > FAST_APPROACH);
      const escape = o.escape && !p.banked && !p.open && (prev === undefined || parseToken(prev).kind !== "gap");
      if (fast) {
        // Le freinage se corrige toujours par des droites : à 66–88 m/s la bande d'un bas-côté (rebord à 15 m de l'axe) ne suffit pas (mesuré).
        // Une à une : une droite donne de la place pour freiner, mais la voiture y accélère aussi (sous la pointe du plat).
        if (deficit > 0) {
          if (o.allowTrap && fix.kept === 0) fix.kept++;
          else {
            let n = 0;
            for (; brakingDeficit(a, token) > 0; n++) {
              if (n === MAX_BRAKING_ADD) return null;
              out.push("S");
              advance(a, "S", prev);
              prev = "S";
            }
            fix.added += n;
          }
        }
        // Moins de murs : le bas-côté du thème à l'extérieur d'un virage abordé vite (lui et le bloc qui le suit).
        if (escape) fix.escapes.push(out.length, out.length + 1);
        for (let k = approach; k <= out.length; k++) fix.protect.push(k);
      }
    }
    out.push(token);
    advance(a, token, prev);
    prev = token;
    if (isStop(token)) approach = out.length;
  }
  return fix;
}
