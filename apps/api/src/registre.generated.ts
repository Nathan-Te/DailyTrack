// GÉNÉRÉ par `npm run fiches` (lot K1 : config/jeux/<id>.json → serveur) — NE PAS MODIFIER À LA MAIN : changer la fiche du jeu, puis relancer la commande.
// Un test vérifie que ce fichier est à jour.
import type { GameDefinition } from "./games";
import { CDJ_GAME } from "./cdj";
import { JUMP_GAME } from "./jump";
import { TOWER_GAME } from "./tower";
import { CIBLES_GAME } from "./cibles";

// Lot K4e : le registre vient des fiches. `temoin` : un jeu témoin n'est jamais dans le registre d'un serveur de production (`jeuxPourEnvironnement`, `registry.ts`).
export const JEUX_DU_REGISTRE: readonly { code: string; temoin: boolean; jeu: GameDefinition<never> }[] = [
  { code: "cdj", temoin: false, jeu: CDJ_GAME as unknown as GameDefinition<never> },
  { code: "jump", temoin: false, jeu: JUMP_GAME as unknown as GameDefinition<never> },
  { code: "tower", temoin: false, jeu: TOWER_GAME as unknown as GameDefinition<never> },
  { code: "cibles", temoin: true, jeu: CIBLES_GAME as unknown as GameDefinition<never> },
];
