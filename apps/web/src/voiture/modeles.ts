// Lot 40 — les modèles, chargés à la demande (un morceau chacun : leur poids est mesuré à part, `poids-parties.mjs`), et leurs matériaux des
// paliers 2 et 3 (chargés à la demande par le jeu aussi : `voiture/enJeu.ts`). La vitrine s'en sert ; le jeu passe par `voiture/catalogue.ts`.
// Lot 42 : six voitures de plus (D à I), un morceau chacune, et leur atelier commun (`atelier.ts`, un morceau partagé à la demande).
import type { FabriqueMateriaux, ModeleId, PlanVoiture } from "./modele";
import { PLAN_CIVILE } from "./modeleCivile";

export const MODELES: readonly ModeleId[] = ["civile", "A", "B", "C", "D", "E", "F", "G", "H", "I"];

export function chargerPlan(id: ModeleId): Promise<PlanVoiture> {
  if (id === "civile") return Promise.resolve(PLAN_CIVILE); // la civile est déjà là (premier chargement du jeu)
  if (id === "A") return import("./modeleA").then((m) => m.PLAN_A);
  if (id === "B") return import("./modeleB").then((m) => m.PLAN_B);
  if (id === "C") return import("./modeleC").then((m) => m.PLAN_C);
  if (id === "D") return import("./modeleD").then((m) => m.PLAN_D);
  if (id === "E") return import("./modeleE").then((m) => m.PLAN_E);
  if (id === "F") return import("./modeleF").then((m) => m.PLAN_F);
  if (id === "G") return import("./modeleG").then((m) => m.PLAN_G);
  if (id === "H") return import("./modeleH").then((m) => m.PLAN_H);
  return import("./modeleI").then((m) => m.PLAN_I);
}

export function chargerMateriaux2(): Promise<FabriqueMateriaux> {
  return import("./materiaux2").then((m) => m.MATERIAUX_2);
}
