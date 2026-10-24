// Lot 42 — le chargeur des six voitures du lot (modèles D à I) : un seul `import()` au premier chargement (catalogue.ts) pour les six, au lieu d'un
// chacune (chaque `import()` y coûte son appel et la liste de ses morceaux : ≈ 0,3 ko pour six, mesuré). Ce petit morceau, chargé à la demande,
// charge ensuite le plan voulu, qui reste un morceau à part (≤ 4 ko compressés chacun, `vite.config.ts`).
import type { PlanVoiture } from "./modele";

const PLANS: Record<string, () => Promise<PlanVoiture>> = {
  fourgon: () => import("./modeleI").then((m) => m.PLAN_I),
  rallye: () => import("./modeleD").then((m) => m.PLAN_D),
  roadster: () => import("./modeleG").then((m) => m.PLAN_G),
  pickup: () => import("./modeleF").then((m) => m.PLAN_F),
  muscle: () => import("./modeleE").then((m) => m.PLAN_E),
  monoplace: () => import("./modeleH").then((m) => m.PLAN_H),
};

/** Le plan d'une voiture du lot 42, par son identifiant du catalogue. */
export const planLot42 = (id: string): Promise<PlanVoiture> => PLANS[id]!();
