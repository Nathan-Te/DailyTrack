import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  MODULE_ENTRIES,
  MODULE_TAGS,
  TICK_RATE,
  buildModuleDef,
  decodeReplay,
  fromRuns,
  moduleStart,
  replayAttempt,
  variantExigence,
  type ModuleSolution,
} from "../src/index";
import { packageDir, readModules, readSolutions } from "./files";
import { emptyRun, secs, tiles } from "./vide";

// `npm run measure:modules -w @cdj/jump-sim` — mesures du catalogue des morceaux (lot 4), à partir des solutions stockées : pour chaque
// morceau et variante, durées entre l'entrée et la sortie canoniques (arrêt, élan), exigence, taux de gigue (±1, ±2, ±3) et de raccord,
// étiquettes, **course à vide** (lot 6, solution en élan : temps au sol sans appui de saut sur les paliers — palier de sortie avant la
// sortie, retour sur le palier d'entrée après l'entrée — et plus longue course au sol sans saut entre l'entrée et la sortie) ; puis la
// répartition sur tout le catalogue et le coût d'un rejeu. `-- --solveur` relance en plus tout le solveur sans rien écrire (`solve:modules --force --dry`) et
// rapporte son temps.

const sec = (t: number) => (t / TICK_RATE).toFixed(2).replace(".", ",");
const pct = (p: number) => `${(p / 10).toFixed(0)}`;
const modules = readModules();
const file = readSolutions();
if (!file) throw new Error("modules/solutions.json absent : npm run solve:modules -w @cdj/jump-sim");

const rows: string[] = [
  "| morceau | v | paramètres | étiquettes | arrêt (s) | élan (s) | exigence | gigue ±1/±2/±3 arrêt (%) | gigue ±1/±2/±3 élan (%) | raccord (%) | paliers élan (s) | plus longue course élan |",
  "|---|---|---|---|---|---|---|---|---|---|---|---|",
];
const palierTicks: number[] = [];
const longest: { t: number; u: number }[] = [];
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
      durations.push(s.exitTick - s.entryTick);
      const t0 = performance.now();
      for (let k = 0; k < 5; k++) replayAttempt(m.level, decodeReplay(s.code), m.levelId);
      replayMs += (performance.now() - t0) / 5;
      replayTicks += s.ticks;
    }
    const g = (s: ModuleSolution | null | undefined) => (s ? s.gigue.map(pct).join(" / ") : "—");
    const span = (s: ModuleSolution | null | undefined) => (s ? sec(s.exitTick - s.entryTick) : "—");
    // Course à vide de la solution en élan, de son départ à sa sortie (la course jusqu'au bord du palier d'entrée est retirée).
    let vide = "—";
    let run = "—";
    const el = sols?.elan;
    if (el) {
      const inputs = fromRuns(decodeReplay(el.code).runs).slice(0, el.exitTick);
      const r = emptyRun(m.level, moduleStart(m, "elan"), inputs, [m.palierIn, m.palierOut].map((p) => ({ c0: p.col0, c1: p.col1 })));
      const ticks = r.zones[0]! - el.entryTick + r.zones[1]!;
      palierTicks.push(ticks);
      longest.push({ t: r.longestTicks, u: r.longestUnits });
      vide = secs(ticks);
      run = `${secs(r.longestTicks)} s · ${tiles(r.longestUnits)} t.`;
    }
    rows.push(
      `| ${def.id} | ${v} | ${Object.entries(values).map(([k, x]) => `${k}=${x}`).join(" ") || "—"} | ${def.tags.join(" ")} | ${span(sols?.arret)} | ${span(sols?.elan)} | ${ex || "**refusée**"} | ${g(sols?.arret)} | ${g(sols?.elan)} | ${sols?.elan?.raccord != null ? pct(sols.elan.raccord) : "—"} | ${vide} | ${run} |`,
    );
  });
}
console.log(`# Catalogue des morceaux : ${modules.length} morceaux, ${total} variantes (JUMP_SIM_VERSION ${file.jumpSimVersion})\n`);
console.log(rows.join("\n"));
console.log("\n## Répartition");
console.log(`Exigence (variantes) : ${[1, 2, 3, 4, 5].map((e) => `${e} → ${perExigence.get(e) ?? 0}`).join(" · ")}${perExigence.get(0) ? ` · refusées (au pas près ou raccord < 90 %) → ${perExigence.get(0)}` : ""}`);
console.log(`Étiquettes (morceaux) : ${MODULE_TAGS.map((t) => `${t} ${perTag.get(t) ?? 0}`).join(" · ")}`);
durations.sort((a, b) => a - b);
const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
const meanOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
console.log(`Course à vide (solutions en élan) : paliers ${secs(meanOf(palierTicks))} s en moyenne (max ${secs(Math.max(...palierTicks))} s) ; plus longue course au sol sans saut ${secs(meanOf(longest.map((l) => l.t)))} s · ${tiles(meanOf(longest.map((l) => l.u)))} tuiles en moyenne (max ${secs(Math.max(...longest.map((l) => l.t)))} s · ${tiles(Math.max(...longest.map((l) => l.u)))} tuiles)`);
console.log(`Durées des solutions (de l'entrée à la sortie) : ${sec(durations[0]!)} à ${sec(durations[durations.length - 1]!)} s, moyenne ${sec(mean)} s, médiane ${sec(durations[durations.length >> 1]!)} s`);
console.log(`Rejeu (replayAttempt) : ${((replayMs * 1e6) / replayTicks).toFixed(0)} ns par pas (${durations.length} solutions)`);

if (process.argv.includes("--solveur")) {
  console.log("\n## Temps du solveur (tout re-résoudre, rien n'est écrit)");
  const t0 = performance.now();
  const r = spawnSync(process.execPath, [join(packageDir(), "dist", "solve-modules.mjs"), "--force", "--dry"], { encoding: "utf8" });
  const tail = r.stdout.trim().split("\n").filter((l) => l.startsWith("Temps") || l.startsWith("Au pas") || l.startsWith("Sans"));
  console.log(tail.join("\n"));
  console.log(`Mur : ${((performance.now() - t0) / 1000).toFixed(1)} s`);
}
