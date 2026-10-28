import { CodecError, fromBase64Url, pushVarint, readVarint, toBase64Url } from "@cdj/core";
import { TICK_RATE, UNITS_PER_TILE } from "./constants";
import type { Level } from "./level";
import { ReplayRunner, type JumpReplay } from "./replay";

// Lot G1 de la plateforme — **le fantôme Diamant de Jump est une trajectoire, jamais des entrées**. La preuve de l'auteur d'un niveau ne quitte
// pas le serveur (lot R9) : renvoyée au classement, elle donnerait le temps du Diamant. Ce que le serveur rend est donc **où était le
// personnage** (une position échantillonnée), pas **les commandes jouées** : on ne peut rien rejouer avec, seulement l'afficher.
//
//   - **Échantillonnage** : un point tous les `TRAJECTOIRE_PAS` pas de simulation (4 : 30 par seconde, la simulation en fait 120), le premier au pas
//     0 et le dernier à l'arrivée ; position = coin haut-gauche de la boîte du personnage, **arrondie au 1/64 de tuile**.
//   - **Codage** : [format, pas, nombre de points (varint), puis par point les écarts `dx`, `dy` au point d'avant (signés, repliés : zigzag, varint)]
//     en base64url. Aucune entrée, aucune commande, aucun état de la simulation.
//   - **Lecture** (`trajectoirePose`) : interpolation linéaire entre deux points, calée sur le chrono de l'essai en cours ; rien n'est simulé :
//     un fantôme à trajectoire ne touche jamais la simulation du joueur.
//
// Pur : ni DOM, ni Node, ni horloge (comme tout `jump-sim`).

export const TRAJECTOIRE_FORMAT = 1;
/** Pas de simulation entre deux points : 30 points par seconde. */
export const TRAJECTOIRE_PAS = TICK_RATE / 30;
/** Résolution des positions : 1/64 de tuile. */
export const TRAJECTOIRE_RESOLUTION = 64;
/** Plafond de points (≈ 6 min) : la lecture refuse plus (le texte vient du réseau). */
export const TRAJECTOIRE_POINTS_MAX = 11_000;

const UNITES_PAR_CRAN = UNITS_PER_TILE / TRAJECTOIRE_RESOLUTION;

export class TrajectoireError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrajectoireError";
  }
}

/** Une trajectoire lue : `x[i]` et `y[i]` en tuiles (coin haut-gauche), un point tous les `pas` pas. */
export interface Trajectoire {
  pas: number;
  x: number[];
  y: number[];
}

const arrondi = (unites: number): number => Math.round(unites / UNITES_PAR_CRAN);
const zigzag = (n: number): number => (n < 0 ? -2 * n - 1 : 2 * n);
const dezigzag = (z: number): number => (z % 2 === 1 ? -(z + 1) / 2 : z / 2);

/**
 * Rejoue la rediffusion `replay` sur `level` et rend ses positions échantillonnées, en 1/64 de tuile (`[x0, y0, x1, y1, …]`). Une rediffusion
 * qui s'arrête avant la fin garde sa dernière position ; au plus `TRAJECTOIRE_POINTS_MAX` points.
 *
 * `ticksCible` (lot G1) : **étire** la trajectoire dans le temps pour qu'elle finisse à ce chrono (≥ celui de la rediffusion) — le fantôme Diamant arrive au seuil de la
 * médaille Diamant, pas au temps optimal de l'auteur. Affichage seulement : les positions sont celles de la rediffusion, vues plus lentement (interpolation linéaire entre
 * deux échantillons d'origine). Sans `ticksCible` (ou égal au chrono de la rediffusion), la trajectoire est celle de la rediffusion, à l'identique.
 */
export function echantillonnerTrajectoire(level: Level, replay: JumpReplay, ticksCible?: number): number[] {
  const runner = new ReplayRunner(level, replay);
  const pts: number[] = [arrondi(runner.state.player.x), arrondi(runner.state.player.y)];
  let dernier = 0;
  while (runner.step()) {
    if (runner.tick % TRAJECTOIRE_PAS === 0) {
      pts.push(arrondi(runner.state.player.x), arrondi(runner.state.player.y));
      dernier = runner.tick;
      if (pts.length / 2 >= TRAJECTOIRE_POINTS_MAX) return pts;
    }
  }
  if (runner.tick !== dernier) pts.push(arrondi(runner.state.player.x), arrondi(runner.state.player.y));
  if (ticksCible === undefined || ticksCible <= runner.tick) return pts;
  return etirer(pts, runner.tick, ticksCible);
}

/** Étire des points d'origine (un tous les `TRAJECTOIRE_PAS` pas, le dernier à `ticks`) pour qu'ils finissent à `cible` : mêmes positions, vues plus lentement. */
function etirer(pts: readonly number[], ticks: number, cible: number): number[] {
  const n = pts.length / 2;
  if (n < 2) return [...pts];
  const k = cible / ticks;
  const sorties = Math.ceil(cible / TRAJECTOIRE_PAS) + 1;
  if (sorties > TRAJECTOIRE_POINTS_MAX) throw new TrajectoireError("Trajectoire trop longue");
  const out: number[] = [];
  for (let j = 0; j < sorties; j++) {
    const t = Math.min(j * TRAJECTOIRE_PAS, cible) / k; // chrono d'origine, fractionnaire
    const f = t / TRAJECTOIRE_PAS;
    const i = Math.min(Math.floor(f), n - 2);
    // le dernier point d'origine est à `ticks`, pas forcément un multiple du pas
    const t0 = i * TRAJECTOIRE_PAS;
    const t1 = i + 1 === n - 1 ? ticks : (i + 1) * TRAJECTOIRE_PAS;
    const u = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0;
    out.push(Math.round(pts[2 * i]! + (pts[2 * i + 2]! - pts[2 * i]!) * u), Math.round(pts[2 * i + 1]! + (pts[2 * i + 3]! - pts[2 * i + 1]!) * u));
  }
  // la dernière position est celle de l'arrivée, exactement
  out[2 * (sorties - 1)] = pts[2 * (n - 1)]!;
  out[2 * (sorties - 1) + 1] = pts[2 * (n - 1) + 1]!;
  return out;
}

/** Points (`[x0, y0, x1, y1, …]` en 1/64 de tuile) → texte base64url. */
export function encoderTrajectoire(pts: readonly number[]): string {
  const n = pts.length / 2;
  if (!Number.isInteger(n) || n < 1 || n > TRAJECTOIRE_POINTS_MAX) throw new TrajectoireError("Nombre de points invalide");
  const bytes: number[] = [TRAJECTOIRE_FORMAT, TRAJECTOIRE_PAS];
  pushVarint(bytes, n);
  let px = 0;
  let py = 0;
  for (let i = 0; i < n; i++) {
    pushVarint(bytes, zigzag(pts[2 * i]! - px));
    pushVarint(bytes, zigzag(pts[2 * i + 1]! - py));
    px = pts[2 * i]!;
    py = pts[2 * i + 1]!;
  }
  return toBase64Url(bytes);
}

/** Texte → trajectoire en tuiles. Refuse tout ce qui est mal formé ou hors limites (`TrajectoireError`). */
export function decoderTrajectoire(code: string): Trajectoire {
  let octets: number[];
  try {
    octets = fromBase64Url(code);
  } catch (e) {
    throw new TrajectoireError(e instanceof CodecError ? e.message : "trajectoire illisible");
  }
  let pos = 0;
  const octet = (): number => {
    const b = octets[pos++];
    if (b === undefined) throw new CodecError("trajectoire tronquée");
    return b;
  };
  try {
    if (octet() !== TRAJECTOIRE_FORMAT) throw new TrajectoireError("Format de trajectoire inconnu");
    const pas = octet();
    if (pas < 1 || pas > TICK_RATE) throw new TrajectoireError("Pas de trajectoire invalide");
    const n = readVarint(octet);
    if (n < 1 || n > TRAJECTOIRE_POINTS_MAX) throw new TrajectoireError("Nombre de points invalide");
    const x: number[] = [];
    const y: number[] = [];
    let px = 0;
    let py = 0;
    for (let i = 0; i < n; i++) {
      px += dezigzag(readVarint(octet));
      py += dezigzag(readVarint(octet));
      x.push(px / TRAJECTOIRE_RESOLUTION);
      y.push(py / TRAJECTOIRE_RESOLUTION);
    }
    if (pos !== octets.length) throw new TrajectoireError("Octets en trop");
    return { pas, x, y };
  } catch (e) {
    if (e instanceof TrajectoireError) throw e;
    throw new TrajectoireError(e instanceof CodecError ? e.message : "trajectoire illisible");
  }
}

/** Durée de la trajectoire, en pas (le dernier point est celui de l'arrivée, éventuellement entre deux échantillons). */
export function trajectoireDuree(t: Trajectoire): number {
  return (t.x.length - 1) * t.pas;
}

/**
 * Position (coin haut-gauche, en tuiles) au chrono `pas + alpha` (`alpha` ∈ [0, 1[ : la part du pas en cours), par interpolation linéaire entre
 * deux points. Avant le départ : le premier point ; après la fin : le dernier (`fini` vrai).
 */
export function trajectoirePose(t: Trajectoire, pas: number, alpha = 0): { x: number; y: number; fini: boolean } {
  const f = Math.max(0, pas + alpha) / t.pas;
  const dernier = t.x.length - 1;
  if (f >= dernier) return { x: t.x[dernier]!, y: t.y[dernier]!, fini: true };
  const i = Math.floor(f);
  const k = f - i;
  return { x: t.x[i]! + (t.x[i + 1]! - t.x[i]!) * k, y: t.y[i]! + (t.y[i + 1]! - t.y[i]!) * k, fini: false };
}
