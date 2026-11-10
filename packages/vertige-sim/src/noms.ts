// Les noms des niveaux, à part des niveaux eux-mêmes : l'adresse (`?scenario=`) et la rediffusion les lisent dans le premier chargement du jeu, sans les boîtes des niveaux (qui sont à la demande).
export type NomNiveau = "parcours" | "bac-a-sable" | "mur" | "gravite" | "portails" | "cube";
export const NOMS_NIVEAUX: readonly NomNiveau[] = ["parcours", "bac-a-sable", "mur", "gravite", "portails", "cube"];
export const estNomNiveau = (s: string): s is NomNiveau => (NOMS_NIVEAUX as readonly string[]).includes(s);
