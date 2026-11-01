import { buildModule, soloLevel } from "./modules";
import { stalactiteRunProblems } from "./stalactites";

// Lot 24 : la règle de la course franche (`stalactiteRunProblems`) simule le jeu (quelques centaines de pas par stalactite) mais ne dépend que de la grille d'un morceau (la zone reste dans
// sa section, loin des paliers : une règle de `stalactiteProblems`) : on la calcule **une fois par variante**, sur le morceau joué seul, et le niveau du jour la lit ici. Fichier à part :
// il importe le catalogue (`modules.ts`), que `stalactites.ts` ne doit pas ramener.

const memo = new Map<string, readonly string[]>();

/** Ce que la règle de la course franche dit de la variante `variant` du morceau `id` (vide : conforme). Gardé en mémoire (fonction pure). */
/** Lot 30 : `legacy` joue le morceau seul sans maintien minimal (niveaux d'avant la version 13). */
export function stalactitePieceProblems(id: string, variant: number, legacy = false): readonly string[] {
  const key = `${id}:${variant}:${legacy ? 1 : 0}`;
  let found = memo.get(key);
  if (found === undefined) {
    found = stalactiteRunProblems(soloLevel(buildModule(id, variant), legacy)).map((p) => `${id} v${variant} : ${p}`);
    memo.set(key, found);
  }
  return found;
}
