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
    out.push({ block: host.index, q: SIGN_Q, side, offset: Math.min(CELL / 2 - 0.6, edge + 1.4), kind: hazard.kind, severity: hazard.severity, hazard: b.index, cuve: b.cuve });
  }
  return out;
}
