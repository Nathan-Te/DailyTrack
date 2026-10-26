import { buildModule } from "./modules";
import { stalactiteRunProblems } from "./stalactites";

// Lot 24 : la règle de la course franche (`stalactiteRunProblems`) simule le jeu (quelques centaines de pas par stalactite) mais ne dépend que de la grille d'un morceau (la zone reste dans
// sa section, loin des paliers : une règle de `stalactiteProblems`) : on la calcule **une fois par variante**, sur le morceau joué seul, et le niveau du jour la lit ici. Fichier à part :
// il importe le catalogue (`modules.ts`), que `stalactites.ts` ne doit pas ramener.

const memo = new Map<string, readonly string[]>();

/** Ce que la règle de la course franche dit de la variante `variant` du morceau `id` (vide : conforme). Gardé en mémoire (fonction pure). */
export function stalactitePieceProblems(id: string, variant: number): readonly string[] {
  const key = `${id}:${variant}`;
  let found = memo.get(key);
  if (found === undefined) {
    found = stalactiteRunProblems(buildModule(id, variant).level).map((p) => `${id} v${variant} : ${p}`);
    memo.set(key, found);
  }
  return found;
}
