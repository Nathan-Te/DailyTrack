import { DEFAULT_CAR_PARAMS, type CarParams } from "./car";
import { CELL, KICK_START, LEVEL, isCurve, type Block, type Track } from "./track";

// Les sauts (lot 17) : une rampe `K`, un ou plusieurs vides `G`, puis la réception (une descente, un plat, parfois un niveau
// plus bas ou plus haut). La voiture quitte la rampe avec sa vitesse et une pente de 0,25 (`LEVEL` sur `CELL − KICK_START`), puis
// suit une parabole : trop lent, elle retombe avant le bord d'en face (la « fenêtre de vitesse » a un plancher) ; très vite,
// elle vole loin, donc la réception doit être assez longue (un plafond, lié à la ligne droite derrière le saut).
//
// Calcul à l'aide de la balistique pure (aucune trigonométrie) ; l'écart avec la simulation, mesuré dans `test/sauts.test.ts`,
// est de quelques % : `LIP_MARGIN` le couvre.

/** Pente de la rampe de saut (montée par mètre). */
export const KICK_SLOPE = LEVEL / (CELL - KICK_START);
/** La caisse touche encore si le bord d'en face est au plus à cette hauteur au-dessus des roues (m) : au-delà, c'est un mur. */
const EDGE_TOLERANCE = 0.6;
/** Écart mesuré entre la balistique parfaite et la voiture (empattement, ressorts) : on exige ce supplément de vitesse. */
const LIP_MARGIN = 1.05;
/** Une réception en descente (le bloc `D` derrière le vide) fait retomber la voiture un peu plus loin que sur un plat (mesuré : ≈ +10 %). */
const LANDING_STRETCH = 1.12;

export interface JumpInfo {
  /** Indice du bloc `K` (la rampe). */
  kick: number;
  /** Nombre de cellules de vide. */
  gapCells: number;
  /** Longueur du vide (m). */
  gap: number;
  /** Hauteur du bord d'en face au-dessus du bord de la rampe (m) : négatif = on atterrit plus bas. */
  rise: number;
  /** Indice du premier bloc de la réception. */
  landing: number;
  /** Longueur de ligne droite (et descente / montée) derrière le vide, avant un virage, un autre vide ou l'arrivée (m). */
  runout: number;
  /** Vitesse minimale (m/s) au bord de la rampe pour atteindre le bord d'en face, marge de mesure comprise. */
  minSpeed: number;
  /** Vitesse maximale (m/s) au bord de la rampe : au-delà, on retomberait après la ligne droite de réception. */
  maxSpeed: number;
}

/**
 * Vitesse minimale au bord de la rampe pour franchir un vide de `gap` mètres dont l'autre bord est `rise` mètres plus haut :
 * à l'abscisse `gap`, la parabole `pente × x − g/2 × (x / v)²` doit rester au-dessus de `rise − EDGE_TOLERANCE`.
 */
export function jumpMinSpeed(gap: number, rise: number, params: Readonly<CarParams> = DEFAULT_CAR_PARAMS): number {
  const lift = KICK_SLOPE * gap - (rise - EDGE_TOLERANCE); // marge verticale disponible pour la chute
  if (lift <= 0) return Infinity;
  return Math.sqrt((params.gravity * gap * gap) / (2 * lift)) * LIP_MARGIN;
}

/**
 * Distance (m, depuis le bord de la rampe) où retombe la voiture sur une réception plane située `rise` m plus haut, à la
 * vitesse `v` : racine descendante de `pente × x − g/2 × (x / v)² = rise` après le vide.
 */
export function jumpLandingDistance(v: number, rise: number, params: Readonly<CarParams> = DEFAULT_CAR_PARAMS): number {
  const a = params.gravity / (2 * v * v);
  const disc = KICK_SLOPE * KICK_SLOPE - 4 * a * rise;
  if (disc <= 0) return Infinity;
  return (KICK_SLOPE + Math.sqrt(disc)) / (2 * a);
}

/** Vitesse au bord de la rampe qui fait retomber la voiture `reach` mètres plus loin que le bord d'en face (au plafond de la fenêtre). */
function jumpMaxSpeed(gap: number, rise: number, runout: number, params: Readonly<CarParams>): number {
  const limit = gap + runout;
  let lo = 10;
  let hi = 160;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (jumpLandingDistance(mid, rise, params) * LANDING_STRETCH > limit) hi = mid;
    else lo = mid;
  }
  return lo;
}

const isLanding = (b: Block) => !isCurve(b.kind) && b.kind !== "gap" && b.kind !== "kick" && b.kind !== "jump";

/** Les sauts d'un circuit (une rampe `K` suivie d'au moins un vide `G`), avec leur fenêtre de vitesse au bord de la rampe. */
export function trackJumps(track: Track, params: Readonly<CarParams> = DEFAULT_CAR_PARAMS): JumpInfo[] {
  const out: JumpInfo[] = [];
  const blocks = track.blocks;
  for (const k of blocks) {
    if (k.kind !== "kick") continue;
    let i = k.index + 1;
    let gapCells = 0;
    let rise = 0;
    while (blocks[i]?.kind === "gap") {
      rise += blocks[i]!.rise;
      gapCells++;
      i++;
    }
    if (gapCells === 0) continue;
    // Réception : les blocs droits, montées et descentes qui suivent, jusqu'au premier virage, vide, rampe ou la fin.
    let runout = 0;
    for (let j = i; j < blocks.length && isLanding(blocks[j]!); j++) runout += CELL;
    const gap = gapCells * CELL;
    out.push({
      kick: k.index,
      gapCells,
      gap,
      rise,
      landing: i,
      runout,
      minSpeed: jumpMinSpeed(gap, rise, params),
      maxSpeed: jumpMaxSpeed(gap, rise, Math.max(0, runout - 8), params),
    });
  }
  return out;
}
