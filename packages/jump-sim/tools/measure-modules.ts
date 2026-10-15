import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  MODULE_ENTRIES,
  MODULE_TAGS,
  TICK_RATE,
  buildModuleDef,
  decodeReplay,
  replayAttempt,
  variantExigence,
  type ModuleSolution,
} from "../src/index";
import { packageDir, readModules, readSolutions } from "./files";

// `npm run measure:modules -w @cdj/jump-sim` — mesures du catalogue des morceaux (lot 4), à partir des solutions stockées : pour chaque
// morceau et variante, durées (arrêt, élan), exigence, taux de gigue (±1, ±2, ±3) et de raccord, étiquettes ; puis la répartition sur tout
// le catalogue et le coût d'un rejeu. `-- --solveur` relance en plus tout le solveur sans rien écrire (`solve:modules --force --dry`) et
// rapporte son temps.

const sec = (t: number) => (t / TICK_RATE).toFixed(2).replace(".", ",");
const pct = (p: number) => `${(p / 10).toFixed(0)}`;
const modules = readModules();
const file = readSolutions();
if (!file) throw new Error("modules/solutions.json absent : npm run solve:modules -w @cdj/jump-sim");

const rows: string[] = ["| morceau | v | paramètres | étiquettes | arrêt (s) | élan (s) | exigence | gigue ±1/±2/±3 arrêt (%) | gigue ±1/±2/±3 élan (%) | raccord (%) |", "|---|---|---|---|---|---|---|---|---|---|"];
const perExigence = new Map<number, number>();
const perTag = new Map<string, number>();
const durations: number[] = [];
let replayMs = 0;
let replayTicks = 0;
let total = 0;
for (const { def } of modules) {
  for (const t of def.tags) perTag.set(t, (perTag.get(t) ?? 0) + 1);
  def.variants.forEach((values, v) => {
    const sols = file.modules[def.id]?.variants[v];
    const ex = variantExigence(sols ?? null);
    perExigence.set(ex, (perExigence.get(ex) ?? 0) + 1);
    total++;
    const m = buildModuleDef(def, v);
    for (const e of MODULE_ENTRIES) {
      const s = sols?.[e];
      if (!s) continue;
      durations.push(s.ticks);
      const t0 = performance.now();
      for (let k = 0; k < 5; k++) replayAttempt(m.level, decodeReplay(s.code), m.levelId);
      replayMs += (performance.now() - t0) / 5;
      replayTicks += s.ticks;
    }
    const g = (s: ModuleSolution | null | undefined) => (s ? s.gigue.map(pct).join(" / ") : "—");
    rows.push(
      `| ${def.id} | ${v} | ${Object.entries(values).map(([k, x]) => `${k}=${x}`).join(" ") || "—"} | ${def.tags.join(" ")} | ${sols?.arret ? sec(sols.arret.ticks) : "—"} | ${sols?.elan ? sec(sols.elan.ticks) : "—"} | ${ex || "**au pas près**"} | ${g(sols?.arret)} | ${g(sols?.elan)} | ${sols?.elan?.raccord != null ? pct(sols.elan.raccord) : "—"} |`,
    );
  });
}
console.log(`# Catalogue des morceaux : ${modules.length} morceaux, ${total} variantes (JUMP_SIM_VERSION ${file.jumpSimVersion})\n`);
console.log(rows.join("\n"));
console.log("\n## Répartition");
console.log(`Exigence (variantes) : ${[1, 2, 3, 4, 5].map((e) => `${e} → ${perExigence.get(e) ?? 0}`).join(" · ")}${perExigence.get(0) ? ` · au pas près → ${perExigence.get(0)}` : ""}`);
console.log(`Étiquettes (morceaux) : ${MODULE_TAGS.map((t) => `${t} ${perTag.get(t) ?? 0}`).join(" · ")}`);
durations.sort((a, b) => a - b);
const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
console.log(`Durées des solutions : ${sec(durations[0]!)} à ${sec(durations[durations.length - 1]!)} s, moyenne ${sec(mean)} s, médiane ${sec(durations[durations.length >> 1]!)} s`);
console.log(`Rejeu (replayAttempt) : ${((replayMs * 1e6) / replayTicks).toFixed(0)} ns par pas (${durations.length} solutions)`);

if (process.argv.includes("--solveur")) {
  console.log("\n## Temps du solveur (tout re-résoudre, rien n'est écrit)");
  const t0 = performance.now();
  const r = spawnSync(process.execPath, [join(packageDir(), "dist", "solve-modules.mjs"), "--force", "--dry"], { encoding: "utf8" });
  const tail = r.stdout.trim().split("\n").filter((l) => l.startsWith("Temps") || l.startsWith("Au pas") || l.startsWith("Sans"));
  console.log(tail.join("\n"));
  console.log(`Mur : ${((performance.now() - t0) / 1000).toFixed(1)} s`);
}
