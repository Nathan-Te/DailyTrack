// GÉNÉRÉ par `npm run fiches` (lot K1 : config/jeux/<id>.json → jeu) — NE PAS MODIFIER À LA MAIN : changer la fiche du jeu, puis relancer la commande.
// Un test vérifie que ce fichier est à jour.
// Les jeux de la plateforme : un par fiche, dans l'ordre.
export type JeuGenere = "track" | "jump" | "tower";
// L'étiquette de chaque jeu : les valeurs des jetons du socle (`jetons.ts` garde leurs noms).
export const ETIQUETTE_TRACK_FOND = "#1E1B19";
export const ETIQUETTE_TRACK_COQUE = "#4A4440";
export const ETIQUETTE_TRACK_POLICE = "\"Barlow Condensed\", \"Archivo\", sans-serif";
export const ETIQUETTE_JUMP_FOND = "#FFD23F";
export const ETIQUETTE_JUMP_COQUE = "#2A1E16";
export const ETIQUETTE_JUMP_POLICE = "\"Lilita One\", \"Archivo\", sans-serif";
export const ETIQUETTE_TOWER_FOND = "#9ED9BE";
export const ETIQUETTE_TOWER_COQUE = "#2F7D62";
export const ETIQUETTE_TOWER_POLICE = "\"Rubik Mono One\", \"Archivo\", sans-serif";
export const ETIQUETTES_FICHES = { "track": { fond: ETIQUETTE_TRACK_FOND, coque: ETIQUETTE_TRACK_COQUE, police: ETIQUETTE_TRACK_POLICE, dessin: "propre" }, "jump": { fond: ETIQUETTE_JUMP_FOND, coque: ETIQUETTE_JUMP_COQUE, police: ETIQUETTE_JUMP_POLICE, dessin: "propre" }, "tower": { fond: ETIQUETTE_TOWER_FOND, coque: ETIQUETTE_TOWER_COQUE, police: ETIQUETTE_TOWER_POLICE, dessin: "propre" } } as const;
