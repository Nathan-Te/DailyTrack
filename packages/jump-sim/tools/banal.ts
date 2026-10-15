import { INPUT_JUMP, INPUT_RIGHT, MODULES, decodeReplay, fromRuns, moduleSolutions, variantExigence, type ModuleDef, type ModuleEntry, type ModuleSolution } from "../src/index";

// Le **critère de banalité** (lot 8c), hors de la simulation, **mesuré sur les solutions stockées** (pas jugé à l'œil). Avec l'élan, des
// morceaux faits pour la course deviennent triviaux : la solution tient la droite et ne saute presque plus, ou un morceau « precision » ne
// demande plus rien. Une variante est **banale** si :
//   A. une de ses solutions lancées (course ou élan plein : les entrées du niveau du jour) tient la droite sans presque sauter — au plus
//      `BANAL_PRESSES` appui de saut entre l'entrée et la sortie, droite seule pendant au moins `BANAL_RIGHT` ‰ des pas — et n'est pas
//      exigeante (exigence ≤ `BANAL_EXIGENCE`) ;
//   B. ou le morceau est étiqueté `precision` et l'exigence de la variante (la plus haute de ses trois entrées) tombe à 1.
// Une variante banale est reprise (trous plus larges, piliers plus espacés, plafonds plus bas) ou retirée ; le test `banal.test.ts` le vérifie
// sur tout le catalogue, `npm run measure:modules` en donne le détail.

export const BANAL_PRESSES = 1;
export const BANAL_RIGHT = 900;
export const BANAL_EXIGENCE = 2;

/** Appuis de saut (fronts montants) et part des pas « droite seule » (‰) entre l'entrée et la sortie d'une solution. */
export function pressesOf(sol: ModuleSolution): { presses: number; right: number } {
  const inputs = fromRuns(decodeReplay(sol.code).runs);
  let presses = 0;
  let right = 0;
  for (let t = sol.entryTick; t < sol.exitTick; t++) {
    const b = inputs[t]!;
    const prev = t > 0 ? inputs[t - 1]! : 0;
    if (b & INPUT_JUMP && !(prev & INPUT_JUMP)) presses++;
    if (b === INPUT_RIGHT) right++;
  }
  const n = Math.max(1, sol.exitTick - sol.entryTick);
  return { presses, right: Math.round((right * 1000) / n) };
}

/** Pourquoi une variante est banale (vide : elle ne l'est pas). */
export function banalReasons(def: ModuleDef, variant: number): string[] {
  const s = moduleSolutions(def.id, variant);
  if (!s) return [];
  const out: string[] = [];
  for (const e of ["course", "plein"] as const satisfies readonly ModuleEntry[]) {
    const sol = s[e];
    if (!sol) continue;
    const { presses, right } = pressesOf(sol);
    if (presses <= BANAL_PRESSES && right >= BANAL_RIGHT && sol.exigence <= BANAL_EXIGENCE) {
      out.push(`entrée ${e} : ${presses} appui, droite seule ${right / 10} % du temps, exigence ${sol.exigence}`);
    }
  }
  if (def.tags.includes("precision") && variantExigence(s) === 1) out.push("étiqueté precision, exigence 1");
  return out;
}

/** Toutes les variantes banales du catalogue. */
export function banalCatalog(): { id: string; variant: number; reasons: string[] }[] {
  return MODULES.flatMap((def) => def.variants.map((_, v) => ({ id: def.id, variant: v, reasons: banalReasons(def, v) }))).filter((b) => b.reasons.length > 0);
}
