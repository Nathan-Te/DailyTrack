// Les paramètres d'adresse de Tower (lot T1) — règle R9 : **fermés en production** (`restreint`), où la page ne sert d'ailleurs à rien (Tower est `off`, scripts/site.mjs ne la
// publie pas). Un nouveau paramètre d'adresse rejoint cette fonction.
//   ?scenario=essai           la suite fixe d'essai (le défaut) : 40 pièces, une plateforme étroite — ce n'est pas le contenu du jour (lot T2)
//   ?scenario=banc            la démonstration de la physique du lot T0 (`&engine=a|b`, `&libre`) ; son panneau est `&debug&tune`
//   ?debug                    une ligne d'état (tick, phase, empreinte) et la porte `window.__tower` pour les tests
//   ?debug&tune               + le panneau des réglages de sensation (curseurs)
//   ?tactile=1 | 0            force l'interface tactile (boutons aux bords) ou la coupe ; sans lui, l'appareil décide (pointeur grossier)

export type Scenario = "essai" | "banc";
export interface OptionsUrl {
  scenario: Scenario;
  debug: boolean;
  tune: boolean;
  tactile: "1" | "0" | null;
}

export const PRODUCTION = import.meta.env.VITE_PRODUCTION === "1";

export function lireOptions(search: string, restreint: boolean): OptionsUrl {
  const q = new URLSearchParams(search);
  const tactile = q.get("tactile");
  return {
    scenario: !restreint && q.get("scenario") === "banc" ? "banc" : "essai",
    debug: !restreint && q.has("debug"),
    tune: !restreint && q.has("debug") && q.has("tune"),
    tactile: tactile === "1" || tactile === "0" ? tactile : null,
  };
}
