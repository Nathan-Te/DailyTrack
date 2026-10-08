import type { PilotRun } from "./autopilot";
import { isCurve, type Track } from "./track";

// Moments de choix (lot 21) : ce que le circuit demande de décider, mesuré sur la course du pilote d'auteur et sur le tracé. Remplace la
// « part du temps à plein gaz » (lot 20) comme critère de richesse d'un circuit ; elle reste affichée par le script de mesure.

export interface ChoiceMoments {
  /** Coups de frein au sol (pilote). */
  brakes: number;
  /** Passages en roue libre (pilote : glace, virage pris en lâchant le gaz). */
  coasts: number;
  /** Cuves (séries de blocs de cuve) : paroi ou fond. */
  cuves: number;
  /** Virages bordés d'un bas-côté (herbe, terre et gravier, neige) : on peut couper l'intérieur. */
  cuttable: number;
  /** Sauts où le pilote a figé la caisse au frein. */
  freezes: number;
  /** Somme des cinq. */
  total: number;
}

/** Moments de choix d'un circuit d'après la course `run` de son pilote (voir `ChoiceMoments`). */
export function choiceMoments(track: Track, run: Pick<PilotRun, "brakeEvents" | "coastEvents" | "freezeEvents">): ChoiceMoments {
  let cuves = 0;
  let cuttable = 0;
  for (const b of track.blocks) {
    const prev = track.blocks[b.index - 1];
    if (b.cuve && !prev?.cuve) cuves++;
    if (isCurve(b.kind) && b.shoulder) cuttable++;
  }
  const brakes = run.brakeEvents;
  const coasts = run.coastEvents;
  const freezes = run.freezeEvents;
  return { brakes, coasts, cuves, cuttable, freezes, total: brakes + coasts + cuves + cuttable + freezes };
}
