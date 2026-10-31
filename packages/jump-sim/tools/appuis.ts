import { readFileSync } from "node:fs";
import { join } from "node:path";
import { INPUT_JUMP, RELEASE_MIN, buildModuleDef, decodeReplay, fromRuns, moduleStart, type ModuleEntry } from "../src/index";
import { play } from "./beam";
import { EXTRA_TICKS, appuis } from "./exigence";
import { modulesDir, readModules, readSolutions } from "./files";

// `npm run appuis:modules -w @cdj/jump-sim` — la répartition des **durées d'appui de saut** des solutions gardées du catalogue (lot 30), et les
// variantes qui exigent un appui court ou une durée au pas près. Outil de lecture : ne modifie rien, ne tourne jamais en production.
//   --seuil=N   appui court = moins de N pas (10 par défaut)       --tol=N   variation de durée testée (±4 par défaut)
//   --liste     liste les variantes (sinon : les chiffres et les morceaux)
// Le test de tolérance rejoue la solution du morceau seul, en changeant la durée d'**un seul** appui de −tol à +tol pas (les autres
// instants restent ceux de la solution) : un appui ne descend pas sous `plancher` (le plus petit appui admis par la règle en vigueur : la
// durée « au-dessus du minimum »).

const args = new Map(process.argv.slice(2).map((a) => (a.includes("=") ? (a.split("=") as [string, string]) : [a, "1"])));
const SEUIL = Number(args.get("--seuil") ?? 10);
const TOL = Number(args.get("--tol") ?? 4);
const PLANCHER = Number(args.get("--plancher") ?? 5);

/** La suite où l'appui `i` dure `len` pas (sa fin avancée ou reculée, le reste inchangé ; jamais jusqu'au prochain appui moins `RELEASE_MIN`). */
function avecDuree(inputs: readonly number[], list: { from: number; to: number }[], i: number, len: number): number[] {
  const out = [...inputs];
  const { from, to } = list[i]!;
  const limit = i + 1 < list.length ? list[i + 1]!.from - RELEASE_MIN : inputs.length;
  const end = Math.max(from + 1, Math.min(from + len, limit));
  for (let t = from; t < Math.max(to, end); t++) out[t] = t < end ? out[t]! | INPUT_JUMP : out[t]! & ~INPUT_JUMP;
  return out;
}

const histo = new Map<number, number>();
const bump = (n: number) => histo.set(n, (histo.get(n) ?? 0) + 1);

const solutions = readSolutions();
if (!solutions) throw new Error("modules/solutions.json absent");
const defs = readModules();

interface Row {
  id: string;
  variant: number;
  entry: ModuleEntry;
  shortest: number;
  intolerant: string[];
}
const rows: Row[] = [];
let nSolutions = 0;
let nJumps = 0;

for (const { def } of defs) {
  const sol = solutions.modules[def.id]?.variants ?? [];
  sol.forEach((v, variant) => {
    for (const entry of ["arret", "elan"] as const) {
      const s = v[entry];
      if (!s || s.exigence < 1) continue;
      nSolutions++;
      const inputs = fromRuns(decodeReplay(s.code).runs);
      const list = appuis(inputs);
      for (const a of list) {
        bump(a.to - a.from);
        nJumps++;
      }
      const m = buildModuleDef(def, variant);
      const start = moduleStart(m, entry);
      const intolerant: string[] = [];
      list.forEach((a, i) => {
        const base = a.to - a.from;
        const echecs: number[] = [];
        for (let d = -TOL; d <= TOL; d++) {
          const len = Math.max(PLANCHER, base + d);
          if (len === base) continue;
          if (!play(m.level, start, avecDuree(inputs, list, i, len), EXTRA_TICKS).finished) echecs.push(d);
        }
        if (echecs.length > 0) intolerant.push(`appui ${i + 1} (${base} pas) échoue à ${echecs.map((d) => (d > 0 ? `+${d}` : d)).join(" ")}`);
      });
      rows.push({ id: def.id, variant, entry, shortest: list.length === 0 ? 0 : Math.min(...list.map((a) => a.to - a.from)), intolerant });
    }
  });
}

const keys = [...histo.keys()].sort((a, b) => a - b);
const court = keys.filter((k) => k < SEUIL).reduce((n, k) => n + histo.get(k)!, 0);
console.log(`solutions gardées (arrêt + élan, exigence ≥ 1) : ${nSolutions} ; appuis de saut : ${nJumps} ; moins de ${SEUIL} pas : ${court} (${Math.round((court * 100) / nJumps)} %)`);
console.log("durée d'appui (pas) : nombre — " + keys.map((k) => `${k}:${histo.get(k)}`).join("  "));

const courtes = rows.filter((r) => r.shortest > 0 && r.shortest < SEUIL);
const variantsCourtes = new Set(courtes.map((r) => `${r.id}:${r.variant}`));
const intol = rows.filter((r) => r.intolerant.length > 0);
const variantsIntol = new Set(intol.map((r) => `${r.id}:${r.variant}`));
const variantsAvecSaut = new Set(rows.filter((r) => r.shortest > 0).map((r) => `${r.id}:${r.variant}`));
console.log(`variantes avec un saut : ${variantsAvecSaut.size} ; avec un appui < ${SEUIL} pas : ${variantsCourtes.size} ; dont la durée ne tolère pas ±${TOL} pas : ${variantsIntol.size}`);
console.log(`plus court appui par solution : ` + [...new Set(rows.map((r) => r.shortest))].sort((a, b) => a - b).map((k) => `${k}:${rows.filter((r) => r.shortest === k).length}`).join("  "));

const parMorceau = new Map<string, { courtes: Set<number>; intol: Set<number>; min: number }>();
for (const r of rows) {
  const e = parMorceau.get(r.id) ?? { courtes: new Set<number>(), intol: new Set<number>(), min: 999 };
  if (r.shortest > 0 && r.shortest < SEUIL) e.courtes.add(r.variant);
  if (r.intolerant.length > 0) e.intol.add(r.variant);
  if (r.shortest > 0) e.min = Math.min(e.min, r.shortest);
  parMorceau.set(r.id, e);
}
console.log("morceau : variantes à appui court / à durée intolérante / plus court appui");
for (const [id, e] of [...parMorceau.entries()].sort((a, b) => a[1].min - b[1].min || a[0].localeCompare(b[0]))) {
  if (e.courtes.size === 0 && e.intol.size === 0) continue;
  console.log(`  ${id} : courtes ${[...e.courtes].sort((a, b) => a - b).join(",") || "-"} · intolérantes ${[...e.intol].sort((a, b) => a - b).join(",") || "-"} · min ${e.min}`);
}
if (args.has("--liste")) for (const r of intol) console.log(`${r.id} v${r.variant} ${r.entry} : ${r.intolerant.join(" ; ")}`);

// phases.json : les solutions des reprises à chaque phase (mêmes règles d'appui).
try {
  const phases = JSON.parse(readFileSync(join(modulesDir(), "phases.json"), "utf8")) as { modules: Record<string, { variants: ({ phases: { code: string }[] } | null)[] }> };
  const h2 = new Map<number, number>();
  let n = 0;
  let short = 0;
  for (const mod of Object.values(phases.modules))
    for (const v of mod.variants)
      for (const p of v?.phases ?? []) {
        n++;
        const list = appuis(fromRuns(decodeReplay(p.code).runs));
        const min = list.length === 0 ? 0 : Math.min(...list.map((a) => a.to - a.from));
        if (min > 0 && min < SEUIL) short++;
        h2.set(min, (h2.get(min) ?? 0) + 1);
      }
  console.log(`phases.json : ${n} reprises, dont ${short} avec un appui < ${SEUIL} pas ; plus court appui : ` + [...h2.keys()].sort((a, b) => a - b).map((k) => `${k}:${h2.get(k)}`).join("  "));
} catch {
  console.log("phases.json illisible");
}
