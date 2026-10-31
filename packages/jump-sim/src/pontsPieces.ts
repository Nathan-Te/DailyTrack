import { buildModule, moduleSolutions, soloLevel } from "./modules";
import { MODULE_ENTRIES } from "./constants";
import { bridgeChaseProblems, bridgeNeededProblems } from "./ponts";
import { decodeReplay } from "./replay";

// Lot 26 : la poursuite franche (`bridgeChaseProblems`) et la nécessité du pont (`bridgeNeededProblems`) rejouent les solutions stockées d'une variante : on la calcule **une fois par variante**, sur le morceau joué seul (ses deux entrées,
// à l'arrêt et en élan), et le niveau du jour la lit ici. Dans le niveau du jour, un morceau est joué avec ces mêmes commandes : la solution suit le pont de la même façon. Fichier à part :
// il importe le catalogue (`modules.ts`), que `ponts.ts` ne doit pas ramener.

const memo = new Map<string, readonly string[]>();

/** Ce que la règle de la poursuite franche dit de la variante `variant` du morceau `id` (vide : conforme, ou sans pont). Gardé en mémoire (fonction pure). */
/** Lot 30 : `legacy` rejoue les solutions d'avant le maintien minimal sur le morceau seul sans maintien (niveaux d'avant la version 13). */
export function bridgePieceProblems(id: string, variant: number, legacy = false): readonly string[] {
  const key = `${id}:${variant}:${legacy ? 1 : 0}`;
  let found = memo.get(key);
  if (found === undefined) {
    const m = buildModule(id, variant);
    const level = soloLevel(m, legacy);
    const out: string[] = [];
    const sol = moduleSolutions(id, variant, legacy);
    if (level.bridges.length > 0 && sol) {
      for (const entry of MODULE_ENTRIES) {
        const s = sol[entry];
        if (!s) continue;
        const replay = decodeReplay(s.code);
        for (const p of [...bridgeChaseProblems(level, replay, m.levelId, s.ticks), ...bridgeNeededProblems(level, replay, m.levelId)]) out.push(`${id} v${variant} (${entry}) : ${p}`);
      }
    }
    found = out;
    memo.set(key, found);
  }
  return found;
}
