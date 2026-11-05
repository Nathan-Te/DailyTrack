// Les NOMS des scénarios d'essai (seed § 9), seuls : le jeu les lit dans l'adresse dès son premier chargement, sans embarquer le tirage ni la grille (`scenarios.ts`, chargé avec le corps du jeu).
export const SCENARIOS = ["presque-plein", "blocage", "plateau-vide", "combo", "suivantes"] as const;
export type NomScenario = (typeof SCENARIOS)[number];
export const estScenario = (nom: string): nom is NomScenario => (SCENARIOS as readonly string[]).includes(nom);
