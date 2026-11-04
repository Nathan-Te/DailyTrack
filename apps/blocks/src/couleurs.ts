import type { Famille } from "@cdj/blocks-sim";
import { PALETTE_PORT, type Forme } from "@cdj/visuels/blocs";

// Les couleurs des pièces : la direction artistique de Tower (module commun `@cdj/visuels/blocs`), une des sept couleurs de la palette du port par famille de pièces. Les palettes par thème du jour viennent au
// lot B3 ; en attendant, le port sert aux deux thèmes (clair, sombre).
const FORME_DE_FAMILLE: Readonly<Record<Famille, Forme>> = { petite: "O", barre: "I", carre: "J", coin: "S", l: "L", grandL: "Z", tsz: "T", rectangle: "J" };

export const couleurDeFamille = (f: Famille): string => PALETTE_PORT.pieces[FORME_DE_FAMILLE[f]];
/** Les cases d'un scénario déjà posées au départ : le brun de la plateforme du port. */
export const COULEUR_DEPART = PALETTE_PORT.plateforme;
