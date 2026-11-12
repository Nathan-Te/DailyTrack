type Langue = "fr" | "en";

// Les textes des outils d'essai de Vertige (lot V2 : la galerie de modules `?scenario=modules`, le temps du robot de `?scenario=enchainement`) : jamais en production (règle R9), donc leurs deux langues sont ici, à la demande,
// comme le panneau d'essai `?debug&tune` (`tune.ts`) — le catalogue du premier chargement ne les porte pas (budget `vertige.jsCss`).
const TEXTES = {
  fr: {
    "robot.temps": "Robot : {t}",
    "robot.arrivee": "Vous : {toi} · Robot : {robot} ({ecart})",
    "galerie.titre": "Modules de niveau",
    "galerie.voir": "Voir la solution",
    "galerie.jouer": "Jouer",
    "galerie.robot": "Robot",
    "galerie.difficulte": "Difficulté {n}",
    "galerie.arrive": "Arrivé en {t} (robot : {robot})",
    "galerie.mecanique.course": "course",
    "galerie.mecanique.saut": "saut",
    "galerie.mecanique.mur": "mur",
    "galerie.mecanique.saut-de-mur": "saut de mur",
    "galerie.mecanique.dash": "dash",
    "galerie.mecanique.gravite": "gravité",
    "galerie.mecanique.portail": "portail",
  }, // i18n-ok: les outils d'essai ont leurs deux langues ici, ils n'existent pas en production
  en: {
    "robot.temps": "Robot: {t}",
    "robot.arrivee": "You: {toi} · Robot: {robot} ({ecart})",
    "galerie.titre": "Level modules",
    "galerie.voir": "Watch the solution",
    "galerie.jouer": "Play",
    "galerie.robot": "Robot",
    "galerie.difficulte": "Difficulty {n}",
    "galerie.arrive": "Finished in {t} (robot: {robot})",
    "galerie.mecanique.course": "run",
    "galerie.mecanique.saut": "jump",
    "galerie.mecanique.mur": "wall",
    "galerie.mecanique.saut-de-mur": "wall jump",
    "galerie.mecanique.dash": "dash",
    "galerie.mecanique.gravite": "gravity",
    "galerie.mecanique.portail": "portal",
  }, // i18n-ok: les outils d'essai ont leurs deux langues ici, ils n'existent pas en production
} as const;

export type CleEssai = keyof (typeof TEXTES)["fr"];
/** Un texte d'essai dans la langue du joueur ; `{nom}` est remplacé par le paramètre du même nom. */
export function texteEssai(langue: Langue, cle: CleEssai, params: Record<string, string | number> = {}): string {
  return TEXTES[langue === "en" ? "en" : "fr"][cle].replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ""));
}
