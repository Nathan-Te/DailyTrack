// Retouche 38b — le fil de travail de la vue en mouvement : le pilote automatique fait le tour d'un circuit (plusieurs essais d'adhérence, ≈ 0,3
// à 1 s : il ne doit pas geler la page), puis la course est rejouée et enregistrée pas à pas (`parcours.ts`). Chargé à la demande par la vitrine.
import { bestPilotRun, parseTrack } from "@cdj/sim";
import { enregistrer } from "./parcours";

export interface DemandePilote {
  id: string;
  spec: string;
}
export interface ReponsePilote {
  id: string;
  poses: Float32Array | null;
  erreur?: string;
}

const ctx = self as unknown as { onmessage: ((e: MessageEvent<DemandePilote>) => void) | null; postMessage(m: ReponsePilote, transfer?: Transferable[]): void };
ctx.onmessage = (e) => {
  const { id, spec } = e.data;
  try {
    const track = parseTrack(id, spec);
    const run = bestPilotRun(track);
    if (!run) {
      ctx.postMessage({ id, poses: null, erreur: "le pilote ne finit pas ce circuit" });
      return;
    }
    const poses = enregistrer(track, run.replay);
    ctx.postMessage({ id, poses }, [poses.buffer]);
  } catch (err) {
    ctx.postMessage({ id, poses: null, erreur: String(err) });
  }
};
