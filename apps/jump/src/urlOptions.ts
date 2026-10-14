// Source unique des paramètres d'adresse de DailyJump : nom, description, valeurs. Le jeu ne lit l'adresse que par `readUrlOptions`
// (un test vérifie qu'aucun autre fichier ne lit un paramètre absent de cette liste). La future page d'admin de DailyJump lira `URL_OPTIONS`
// pour construire ses liens, comme `adminLogic.ts` de DailyTrack.

export interface UrlOption {
  name: string;
  description: string;
  /** Valeurs permises ; vide = drapeau (sa seule présence compte). */
  values: readonly string[];
  /** Valeur prise sans le paramètre (ou avec une valeur inconnue). */
  default?: string;
}

/** Les niveaux qu'on peut ouvrir par `?scenario=`. */
export const SCENARIOS = ["bac-a-sable"] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const URL_OPTIONS: readonly UrlOption[] = [
  {
    name: "scenario",
    description: "Niveau à ouvrir. « bac-a-sable » : le bac à sable du personnage (lot 1), aussi la page par défaut.",
    values: SCENARIOS,
    default: "bac-a-sable",
  },
  {
    name: "debug",
    description: "Outils de test : surimpression (vitesse, état, compteurs, position) et `window.__jump` (phase, manual, advance, input…).",
    values: [],
  },
  {
    name: "tune",
    description: "Avec `debug` : panneau de réglages du personnage (mémorisé dans `jump:tune`). Une partie aux réglages modifiés n'est jamais enregistrée.",
    values: [],
  },
];

export interface UrlChoices {
  scenario: Scenario;
  debug: boolean;
  /** Panneau de réglages : seulement avec `debug`. */
  tune: boolean;
}

export function readUrlOptions(search: string): UrlChoices {
  const params = new URLSearchParams(search);
  const scenario = params.get("scenario");
  const debug = params.has("debug");
  return {
    scenario: (SCENARIOS as readonly string[]).includes(scenario ?? "") ? (scenario as Scenario) : "bac-a-sable",
    debug,
    tune: debug && params.has("tune"),
  };
}
