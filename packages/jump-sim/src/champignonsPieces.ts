import { mushroomSweepProblems } from "./champignons";
import { buildModule, soloLevel } from "./modules";

// Lot 23 : la règle des 0,3 premières secondes (`mushroomSweepProblems`) est coûteuse (quelques centaines de trajectoires par champignon) mais ne dépend que de la grille
// d'un morceau (la trajectoire reste dans sa section, et les paliers, les points de passage et les morceaux voisins n'y entrent jamais) : on la calcule **une fois par
// variante**, sur le morceau joué seul, et le niveau du jour la lit ici. Fichier à part : il importe le catalogue (`modules.ts`), que `champignons.ts` ne doit pas ramener.

const memo = new Map<string, readonly string[]>();

/** Ce que la règle des 0,3 s dit de la variante `variant` du morceau `id` (vide : conforme). Gardé en mémoire (fonction pure). */
/** Lot 30 : `legacy` joue le morceau seul sans maintien minimal (niveaux d'avant la version 13), comme le jouaient les solutions d'avant. */
export function mushroomPieceProblems(id: string, variant: number, legacy = false): readonly string[] {
  const key = `${id}:${variant}:${legacy ? 1 : 0}`;
  let found = memo.get(key);
  if (found === undefined) {
    found = mushroomSweepProblems(soloLevel(buildModule(id, variant), legacy)).map((p) => `${id} v${variant} : ${p}`);
    memo.set(key, found);
  }
  return found;
}
