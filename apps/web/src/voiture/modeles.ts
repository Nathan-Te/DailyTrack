// Lot 40 — les trois modèles proposés, chargés à la demande (un morceau chacun : leur poids est mesuré à part, `poids-parties.mjs`), et leurs
// matériaux des paliers 2 et 3. Outil de la vitrine ; la retouche 40b mettra en jeu le modèle choisi par Nathan.
import type { FabriqueMateriaux, ModeleId, PlanVoiture } from "./modele";

export const MODELES: readonly ModeleId[] = ["A", "B", "C"];

export function chargerPlan(id: ModeleId): Promise<PlanVoiture> {
  if (id === "A") return import("./modeleA").then((m) => m.PLAN_A);
  if (id === "B") return import("./modeleB").then((m) => m.PLAN_B);
  return import("./modeleC").then((m) => m.PLAN_C);
}

export function chargerMateriaux2(): Promise<FabriqueMateriaux> {
  return import("./materiaux2").then((m) => m.MATERIAUX_2);
}
