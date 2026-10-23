// Panneaux de direction (lot 23) : où les poser et ce qu'ils annoncent. Logique pure (aucune dépendance au rendu) :
// tout est calculé à partir du circuit, donc identique pour tout le monde. `trackMesh.ts` dessine.
import { CELL, SHOULDER_EDGE, blockHalfWidth, curveSize, isCurve, turnsLeft, type Block, type Track } from "@cdj/sim";

/** Ce qu'annonce un panneau : un virage à gauche / à droite, un saut, une cuve (paroi qui se relève). */
export type SignKind = "left" | "right" | "jump" | "cuve";

export interface SignSpec {
  /** Bloc qui porte le panneau (un peu avant le danger) et abscisse q dans ce bloc. */
  block: number;
  q: number;
  /** Côté du poteau : +1 = côté gauche de la route (p grand), −1 = côté droit. */
  side: 1 | -1;
  /** Distance (m) de l'axe de la route au poteau. */
  offset: number;
  kind: SignKind;
  /** Sévérité du virage : 1 ample, 2 large, 3 serré (nombre de chevrons) ; 1 pour les autres panneaux. */
  severity: 1 | 2 | 3;
  /** Bloc annoncé. */
  hazard: number;
  /** Côté de la paroi pour une cuve (bits `CUVE_LEFT` | `CUVE_RIGHT` du bloc annoncé). */
  cuve: number;
}

/** Blocs où l'on peut planter un panneau : une route droite, fermée par des rebords ou des bas-côtés, sans relief brusque. */
function canHost(b: Block | undefined): b is Block {
  if (!b || b.open || b.cuve !== 0 || b.mark) return false; // ni départ (l'arche), ni porte, ni arrivée
  return b.kind === "straight" || b.kind === "up" || b.kind === "down" || b.kind === "boost" || b.kind === "turbo" || b.kind === "cut";
}

/** Le danger qu'annonce un bloc, ou `null`. Un virage dans une cuve est annoncé comme cuve (c'est elle qui surprend). */
export function hazardOf(b: Block): { kind: SignKind; severity: 1 | 2 | 3 } | null {
  if (b.cuve !== 0) return { kind: "cuve", severity: 1 };
  if (isCurve(b.kind)) {
    const size = curveSize(b.kind);
    return { kind: turnsLeft(b.kind) ? "left" : "right", severity: size === 1 ? 3 : size === 2 ? 2 : 1 };
  }
  if (b.kind === "jump" || b.kind === "kick") return { kind: "jump", severity: 1 };
  return null;
}

/** Nombre de blocs en arrière où l'on cherche un hôte (au plus), et abscisse du panneau dans l'hôte. */
const LOOKBACK = 3;
const SIGN_Q = CELL * 0.72;
/** Recul (m) du poteau au-delà du bord de la route ou de la bande (lot 37) : la plaque, large de 2,7 m, ne surplombe ni la route ni un bas-côté ; le poteau descend jusqu'au sol. */
export const SIGN_SETBACK = 1.6;

/**
 * Les panneaux d'un circuit : un avant chaque virage, saut ou cuve, planté du côté extérieur du virage sur le dernier bloc droit
 * qui précède (jusqu'à `LOOKBACK` blocs avant : devant un vide ou une suite de virages, on remonte). Les dangers qui se suivent à
 * moins d'un bloc partagent le même panneau (celui du premier). Pas de panneau au départ.
 */
export function signsFor(track: Track): SignSpec[] {
  const out: SignSpec[] = [];
  const used = new Set<number>();
  const blocks = track.blocks;
  for (const b of blocks) {
    const hazard = hazardOf(b);
    if (!hazard) continue;
    // Une cuve ou un saut qui suit un virage ou une cuve déjà annoncés n'a pas son propre panneau si son hôte est déjà pris.
    const prev = blocks[b.index - 1];
    if (prev && hazardOf(prev) && hazardOf(prev)!.kind === hazard.kind && hazard.kind !== "left" && hazard.kind !== "right") continue;
    let host: Block | undefined;
    for (let back = 1; back <= LOOKBACK; back++) {
      const c = blocks[b.index - back];
      if (!c) break;
      if (hazardOf(c)) break; // on ne remonte pas au-delà d'un autre danger
      if (canHost(c) && !used.has(c.index)) {
        host = c;
        break;
      }
    }
    if (!host) continue;
    used.add(host.index);
    // Extérieur d'un virage : à droite d'un virage à gauche. Saut et cuve : à gauche (côté hors trajectoire habituelle).
    const side: 1 | -1 = hazard.kind === "left" ? -1 : hazard.kind === "right" ? 1 : 1;
    const edge = host.shoulder ? SHOULDER_EDGE : blockHalfWidth(host, SIGN_Q);
    out.push({ block: host.index, q: SIGN_Q, side, offset: edge + SIGN_SETBACK, kind: hazard.kind, severity: hazard.severity, hazard: b.index, cuve: b.cuve });
  }
  return out;
}

/** Lot 43 : un panneau de distance avant un virage serré (planté du même côté que le panneau du virage). */
export interface DistanceSpec {
  block: number;
  q: number;
  side: 1 | -1;
  /** Distance (m) de l'axe de la route au panneau (son bord intérieur reste au-delà du bord de la route ou de la bande, comme les panneaux de virage). */
  offset: number;
  /** Barres peintes : 3, 2 puis 1 en approchant du virage. */
  barres: 1 | 2 | 3;
  /** Bloc annoncé. */
  hazard: number;
}

/** Écart (m) entre deux panneaux de distance, et entre le dernier et le panneau du virage. */
export const PAS_DISTANCE = 28;
/** Écart minimal (m) avec un autre panneau sur le même bloc : on ne les plante pas l'un sur l'autre. */
const ECART_PANNEAUX = 8;

/**
 * Lot 43 — les panneaux de distance (« 3 », « 2 », « 1 » barres) avant chaque **virage serré** : tous les `PAS_DISTANCE` m en remontant la piste depuis
 * le panneau du virage, du même côté. Calculés depuis la géométrie du circuit (`signsFor`, les blocs), **jamais avec le générateur** : rien de lourd
 * dans le premier chargement (lot 36). Comme les panneaux de virage, seulement sur une route droite fermée (`canHost`) : la série s'arrête au premier
 * bloc qui ne peut pas en porter (un autre virage, un vide, une cuve, le départ), et un panneau trop près d'un autre n'est pas planté.
 */
export function distanceSigns(track: Track, signs: readonly SignSpec[] = signsFor(track)): DistanceSpec[] {
  const out: DistanceSpec[] = [];
  const occupe = (block: number, q: number) => signs.some((s) => s.block === block && Math.abs(s.q - q) < ECART_PANNEAUX) || out.some((d) => d.block === block && Math.abs(d.q - q) < ECART_PANNEAUX);
  for (const s of signs) {
    if ((s.kind !== "left" && s.kind !== "right") || s.severity !== 3) continue;
    let block = s.block;
    let q = s.q;
    for (const barres of [1, 2, 3] as const) {
      q -= PAS_DISTANCE;
      while (q < 0 && block > 0) {
        block--;
        q += CELL;
        if (!canHost(track.blocks[block])) break;
      }
      const host = track.blocks[block];
      if (q < 0 || !canHost(host)) break;
      if (occupe(block, q)) continue;
      const edge = host.shoulder ? SHOULDER_EDGE : blockHalfWidth(host, q);
      out.push({ block, q, side: s.side, offset: edge + SIGN_SETBACK, barres, hazard: s.hazard });
    }
  }
  return out;
}
