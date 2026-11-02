// GÉNÉRÉ par `npm run fiches` (lot K1 : config/jeux/<id>.json → jeu) — NE PAS MODIFIER À LA MAIN : changer la fiche du jeu, puis relancer la commande.
// Un test vérifie que ce fichier est à jour.
// Les jeux de la plateforme : Track et Jump (sans fiche jusqu'aux lots K1b et K1c), puis ceux qui en ont une.
export type JeuGenere = "track" | "jump" | "tower";
// L'étiquette des jeux qui ont une fiche : les valeurs des jetons du socle (`jetons.ts` garde leurs noms).
export const ETIQUETTE_TOWER_FOND = "#9ED9BE";
export const ETIQUETTE_TOWER_COQUE = "#2F7D62";
export const ETIQUETTE_TOWER_POLICE = "\"Rubik Mono One\", \"Archivo\", sans-serif";
export const ETIQUETTES_FICHES = { "tower": { fond: ETIQUETTE_TOWER_FOND, coque: ETIQUETTE_TOWER_COQUE, police: ETIQUETTE_TOWER_POLICE, dessin: "propre" } } as const;
