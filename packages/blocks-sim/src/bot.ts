import type { Contenu } from "./generateur";
import { jouer, type Resultat, type Touche } from "./partie";
import { VARIANTE, type Variante } from "./variante";

// Le bot de l'auteur : il touche chaque cible `DELAI_BOT` ticks (0,4 s) après son apparition. Sa partie est le Diamant du jour. Pur, sans état, déterministe. Ses touches sont celles de la variante (`variante.ts`).

export const touchesDuBot = (contenu: Contenu, variante: Variante = VARIANTE): Touche[] => variante.touchesDuBot(contenu);

export const partieDuBot = (contenu: Contenu, variante: Variante = VARIANTE): Resultat => jouer(contenu, touchesDuBot(contenu, variante), variante);
