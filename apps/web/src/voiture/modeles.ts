// Lot 40 — les modèles, chargés à la demande (un morceau chacun : leur poids est mesuré à part, `poids-parties.mjs`), et leurs matériaux des
// paliers 2 et 3 (chargés à la demande par le jeu aussi : `voiture/enJeu.ts`). La vitrine s'en sert ; le jeu passe par `voiture/catalogue.ts`.
import type { FabriqueMateriaux, ModeleId, PlanVoiture } from "./modele";
import { PLAN_CIVILE } from "./modeleCivile";

export const MODELES: readonly ModeleId[] = ["civile", "A", "B", "C"];

export function chargerPlan(id: ModeleId): Promise<PlanVoiture> {
  if (id === "civile") return Promise.resolve(PLAN_CIVILE); // la civile est déjà là (premier chargement du jeu)
  if (id === "A") return import("./modeleA").then((m) => m.PLAN_A);
  if (id === "B") return import("./modeleB").then((m) => m.PLAN_B);
  return import("./modeleC").then((m) => m.PLAN_C);
}

export function chargerMateriaux2(): Promise<FabriqueMateriaux> {
  return import("./materiaux2").then((m) => m.MATERIAUX_2);
}
