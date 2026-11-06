// GÉNÉRÉ par `npm run fiches` (lot K1 : config/jeux/<id>.json → jeu) — NE PAS MODIFIER À LA MAIN : changer la fiche du jeu, puis relancer la commande.
// Un test vérifie que ce fichier est à jour.
// Les scènes de chaque jeu (`musique.scenes` de sa fiche).
export const SCENES_FICHES = {"track":["menu","theme:stade","theme:rallye","theme:banquise","theme:nuit","theme:campagne","theme:canyon","theme:col","theme:ville"],"jump":["menu","theme:foret","theme:usine","theme:glace","theme:nuit","theme:neon"],"tower":["menu","theme:port","theme:chantier","theme:canyon","theme:banquise","theme:jungle","theme:nuit"],"cibles":["menu","theme:sable","theme:ardoise"],"blocks":["menu","theme:port","theme:chantier","theme:canyon","theme:banquise","theme:jungle","theme:nuit"],"rush":["menu","theme:prairie","theme:carriere","theme:sous-bois"]} as const;
// Les applications qui peuvent jouer de la musique : les jeux, puis le portail (qui doit être nommé : `tous` ne le désigne pas).
export const JEUX_MUSIQUE_GENERES = ["track", "jump", "tower", "cibles", "blocks", "rush", "portail"] as const;
// Ce que `tous` désigne : les jeux, pas le portail.
export const JEUX_DE_TOUS_GENERES = ["track", "jump", "tower", "cibles", "blocks", "rush"] as const;
