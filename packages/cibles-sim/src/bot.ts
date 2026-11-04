import { DELAI_BOT } from "./constantes";
import type { Contenu } from "./generateur";
import { jouer, type Resultat, type Touche } from "./partie";

// Le bot de l'auteur : il touche chaque cible `DELAI_BOT` ticks (0,4 s) après son apparition. Sa partie est le Diamant du jour. Pur, sans état, déterministe.

export function touchesDuBot(contenu: Contenu): Touche[] {
  return contenu.cibles.map((x) => ({ tick: x.d + DELAI_BOT, c: x.c }));
}

export const partieDuBot = (contenu: Contenu): Resultat => jouer(contenu, touchesDuBot(contenu));
