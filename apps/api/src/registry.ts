import { CDJ_GAME } from "./cdj";
import type { GameDefinition } from "./games";
import { JUMP_GAME } from "./jump";
import { TOWER_GAME } from "./tower";

// Le registre des jeux de la plateforme (lot P0). Ajouter un jeu = écrire sa définition (`GameDefinition`, `games.ts`) dans son propre fichier
// et l'inscrire ici, sans toucher aux autres jeux : recette dans `apps/api/CLAUDE.md`, rubrique « Plateforme (lot P0) ». L'ordre de la liste
// est celui du schéma ; les routes sont essayées du préfixe le plus long au plus court (DailyTrack, au préfixe `/api`, passe en dernier).
export const GAMES: readonly GameDefinition<never>[] = [CDJ_GAME, JUMP_GAME, TOWER_GAME] as readonly GameDefinition<never>[];
