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
export const SCENARIOS = ["essai", "dangers", "bac-a-sable"] as const;
export type Scenario = (typeof SCENARIOS)[number];

export const URL_OPTIONS: readonly UrlOption[] = [
  {
    name: "scenario",
    description:
      "Niveau à ouvrir. « essai » : le niveau d'essai du lot 2 (≈ 30 s, tous les dangers), la page par défaut ; « dangers » : la galerie, chaque danger seul ; « bac-a-sable » : le bac à sable du personnage (lot 1).",
    values: SCENARIOS,
    default: "essai",
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
  {
    name: "hitbox",
    description: "Avec `debug` : dessine les boîtes de collision « justes » (personnage, pics réduits, disques mortels des scies) et les sections.",
    values: [],
  },
  {
    name: "fx",
    description: "`off` coupe les effets de la mort (éclatement en particules, tremblement d'écran). Affichage seulement.",
    values: ["off"],
  },
  {
    name: "touch",
    description: "Commandes tactiles : `1` les force (la souris simule le doigt, boutons visibles), `0` les coupe ; sans le paramètre, l'appareil décide (pointeur grossier).",
    values: ["1", "0"],
  },
  {
    name: "ghost",
    description: "`off` cache le fantôme de ton meilleur essai du jour (sans changer le réglage mémorisé, bouton 👻 ou touche G).",
    values: ["off"],
  },
  {
    name: "carnage",
    description:
      "`demo` lance tout de suite un carnage de démonstration sur l'essai : le héros est la solution de l'auteur, les autres vies sont des essais fictifs déterministes (perturbations à graine fixe de la solution, rejouées comme des vraies). Rien n'est enregistré.",
    values: ["demo"],
  },
  {
    name: "watch",
    description: "`best` rejoue ton meilleur essai du jour, seul, sans pouvoir jouer (R le relance). Sans meilleur essai, la partie est normale.",
    values: ["best"],
  },
  {
    name: "zones",
    description: "Dessine les zones tactiles (←, →, saut, bande haute) et un point par doigt posé : de quoi vérifier les frontières sur un vrai téléphone.",
    values: [],
  },
];

export interface UrlChoices {
  scenario: Scenario;
  debug: boolean;
  /** Panneau de réglages : seulement avec `debug`. */
  tune: boolean;
  /** `1` / `0` : tactile imposé ou coupé ; `null` : l'appareil décide. */
  touch: "1" | "0" | null;
  /** Zones et doigts dessinés. */
  zones: boolean;
  /** Boîtes de collision dessinées : seulement avec `debug`. */
  hitbox: boolean;
  /** Effets de la mort (particules, tremblement) ; `?fx=off` les coupe (pas les taches). */
  fx: boolean;
  /** Fantôme forcé à « caché » (`?ghost=off`). */
  ghostOff: boolean;
  /** Carnage de démonstration au chargement (`?carnage=demo`). */
  carnageDemo: boolean;
  /** Lecture du meilleur essai, sans jouer (`?watch=best`). */
  watchBest: boolean;
}

export function readUrlOptions(search: string): UrlChoices {
  const params = new URLSearchParams(search);
  const scenario = params.get("scenario");
  const debug = params.has("debug");
  return {
    scenario: (SCENARIOS as readonly string[]).includes(scenario ?? "") ? (scenario as Scenario) : "essai",
    debug,
    tune: debug && params.has("tune"),
    touch: params.get("touch") === "1" ? "1" : params.get("touch") === "0" ? "0" : null,
    zones: params.has("zones"),
    hitbox: debug && params.has("hitbox"),
    fx: params.get("fx") !== "off",
    ghostOff: params.get("ghost") === "off",
    carnageDemo: params.get("carnage") === "demo",
    watchBest: params.get("watch") === "best",
  };
}
