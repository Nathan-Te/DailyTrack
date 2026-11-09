import type { Appel, Approche, Elan, Reception, Sortie, Vol } from "./sautsClasse";

// Lot 57 / 57b : les cinq parties de chaque saut de la grammaire, à part des figures (`grammaire.ts`) : elles ne servent qu'à la page `?scenario=sauts` et aux tests, pas au fil de travail
// des circuits (budget de Track).

/**
 * Les cinq parties d'un saut **telles que `classerSauts` les lit** (première variante, route normale ; lot 57b : l'approche et la sortie ne sont plus celles d'intention du lot 57 —
 * une approche « virage » est un virage dans les trois blocs d'avant la rampe, une sortie « virage » un virage dans les deux blocs qui suivent la réception —, `test/grammaire23.test.ts`
 * les compare).
 */
export interface PartiesSaut {
  approche: Approche;
  appel: Appel;
  vol: Vol;
  reception: Reception[];
  sortie: Sortie;
  vitesse: Elan;
}

export const PARTIES_LOT57: Readonly<Record<string, PartiesSaut>> = {
  "saut-biais": { approche: "descente", appel: "devers", vol: "tournant", reception: ["decalee", "basse"], sortie: "droite", vitesse: "elan" },
  "saut-angle": { approche: "droite", appel: "virage", vol: "tournant", reception: ["basse", "angle"], sortie: "droite", vitesse: "elan" },
  "saut-courbe": { approche: "droite", appel: "virage", vol: "tournant", reception: ["decalee", "basse"], sortie: "droite", vitesse: "elan" },
  "saut-reception-relevee": { approche: "virage", appel: "plat", vol: "axe", reception: ["basse", "virage"], sortie: "droite", vitesse: "elan" },
  "saut-drop": { approche: "virage", appel: "plat", vol: "axe", reception: ["basse"], sortie: "droite", vitesse: "elan" },
  "saut-step-up": { approche: "descente", appel: "bosse", vol: "axe", reception: ["haute"], sortie: "droite", vitesse: "elan" },
  "saut-elan": { approche: "droite", appel: "plat", vol: "axe", reception: ["axe"], sortie: "droite", vitesse: "elan" },
  "saut-double": { approche: "droite", appel: "plat", vol: "axe", reception: ["axe"], sortie: "droite", vitesse: "elan" },
  "saut-bosse": { approche: "droite", appel: "bosse", vol: "axe", reception: ["basse"], sortie: "droite", vitesse: "elan" },
  "saut-herbe": { approche: "droite", appel: "plat", vol: "axe", reception: ["basse", "surface"], sortie: "droite", vitesse: "elan" },
  "saut-chicane": { approche: "virage", appel: "plat", vol: "axe", reception: ["basse"], sortie: "droite", vitesse: "elan" },
  "saut-glisse": { approche: "droite", appel: "virage", vol: "tournant", reception: ["decalee", "basse", "surface"], sortie: "virage", vitesse: "elan" },
};
