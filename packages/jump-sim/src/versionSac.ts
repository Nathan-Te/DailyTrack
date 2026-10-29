// Lot V1 : la version du générateur de Jump qui a introduit le sac de thèmes (`themes.ts`). Dans un fichier à part, sans aucun import : la configuration de Vite de `apps/jump` la lit
// pour écrire la liste des niveaux figés d'avant (`__JUMP_FROZEN_OLD_DAYS__`) et ne peut pas charger la simulation (Node ne résout pas ses imports sans extension).
export const JUMP_GENERATOR_SAC = 23;
