// GÉNÉRÉ par `npm run fiches` (lot K1 : config/jeux/<id>.json → jeu) — NE PAS MODIFIER À LA MAIN : changer la fiche du jeu, puis relancer la commande.
// Un test vérifie que ce fichier est à jour.
// Les scènes des jeux qui ont une fiche (celles de Track restent dans `scenes.ts`).
export const SCENES_FICHES = {"jump":["menu","theme:foret","theme:usine","theme:glace","theme:nuit","theme:neon"],"tower":["menu","theme:port","theme:chantier","theme:canyon","theme:banquise","theme:jungle","theme:nuit"]} as const;
// Les applications qui peuvent jouer de la musique : Track, Jump, les jeux à fiche, puis le portail (qui doit être nommé : `tous` ne le désigne pas).
export const JEUX_MUSIQUE_GENERES = ["track", "jump", "tower", "portail"] as const;
// Ce que `tous` désigne : les jeux, pas le portail.
export const JEUX_DE_TOUS_GENERES = ["track", "jump", "tower"] as const;
