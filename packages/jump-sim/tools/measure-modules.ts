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
  mutationLabel,
  variantExigence,
  type ModuleSolution,
} from "../src/index";
import { packageDir, readModules, readSolutions } from "./files";
import { emptyRun, secs, tiles } from "./vide";
import { flatLimit, longestFlat } from "./plats";
import { banalReasons, pressesOf } from "./banal";

// `npm run measure:modules -w @cdj/jump-sim` — mesures du catalogue des morceaux (lot 4), à partir des solutions stockées : pour chaque
// morceau et variante, durées entre l'entrée et la sortie canoniques (arrêt, course, élan plein — lot 8c), états de sortie, exigence, taux
// de gigue (±1, ±2, ±3) et de raccord, appuis de saut et **banalité** (lot 8c, `banal.ts`), étiquettes, **course à vide** (lot 6, solution à la course : temps au sol sans appui de saut sur les paliers — palier de sortie avant la
// sortie, retour sur le palier d'entrée après l'entrée — et plus longue course au sol sans saut entre l'entrée et la sortie) ; puis la
// répartition sur tout le catalogue et le coût d'un rejeu. `-- --solveur` relance en plus tout le solveur sans rien écrire (`solve:modules --force --dry`) et
// rapporte son temps.

const sec = (t: number) => (t / TICK_RATE).toFixed(2).replace(".", ",");
const pct = (p: number) => `${(p / 10).toFixed(0)}`;
const modules = readModules();
const file = readSolutions();
if (!file) throw new Error("modules/solutions.json absent : npm run solve:modules -w @cdj/jump-sim");

const rows: string[] = [
  "| morceau | famille | v | paramètres | mutateurs | étiquettes | arrêt (s) | course (s) | élan plein (s) | sorties a/c/p | exigence | gigue ±1/±2/±3 arrêt (%) | gigue course (%) | gigue plein (%) | raccord course / plein (%) | appuis course / plein | paliers course (s) | plus longue course (course) | plus long plat sans défi | banale |",
  "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|",
];
const perMutator = new Map<string, number>();
const perFamily = new Map<string, string[]>();
let longCount = 0;
const palierTicks: number[] = [];
const longest: { t: number; u: number }[] = [];
const perExigence = new Map<number, number>();
const perTag = new Map<string, number>();
const durations: number[] = [];
const banals: string[] = [];
const exitCount = { course: 0, plein: 0 };
let replayMs = 0;
let replayTicks = 0;
let total = 0;
for (const { def } of modules) {
  for (const t of def.tags) perTag.set(t, (perTag.get(t) ?? 0) + 1);
  perFamily.set(def.family, [...(perFamily.get(def.family) ?? []), def.id]);
  if (def.long) longCount++;
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
      exitCount[s.exit]++;
      const t0 = performance.now();
      for (let k = 0; k < 5; k++) replayAttempt(m.level, decodeReplay(s.code), m.levelId);
      replayMs += (performance.now() - t0) / 5;
      replayTicks += s.ticks;
    }
    const g = (s: ModuleSolution | null | undefined) => (s ? s.gigue.map(pct).join(" / ") : "—");
    const span = (s: ModuleSolution | null | undefined) => (s ? sec(s.exitTick - s.entryTick) : "—");
    // Course à vide de la solution à la course, de son départ à sa sortie (l'approche jusqu'au bord du palier d'entrée est retirée).
    let vide = "—";
    let run = "—";
    const el = sols?.course;
    if (el) {
      const inputs = fromRuns(decodeReplay(el.code).runs).slice(0, el.exitTick);
      const r = emptyRun(m.level, moduleStart(m, "course"), inputs, [m.palierIn, m.palierOut].map((p) => ({ c0: p.col0, c1: p.col1 })));
      const ticks = r.zones[0]! - el.entryTick + r.zones[1]!;
      palierTicks.push(ticks);
      longest.push({ t: r.longestTicks, u: r.longestUnits });
      vide = secs(ticks);
      run = `${secs(r.longestTicks)} s · ${tiles(r.longestUnits)} t.`;
    }
    for (const mu of def.mutations[v]!) perMutator.set(mu.name, (perMutator.get(mu.name) ?? 0) + 1);
    const flat = longestFlat(m);
    const exits = MODULE_ENTRIES.map((e) => (sols?.[e]?.exit === "plein" ? "p" : sols?.[e] ? "c" : "—")).join("/");
    const rac = (s: ModuleSolution | null | undefined) => (s?.raccord != null ? pct(s.raccord) : "—");
    const presses = (s: ModuleSolution | null | undefined) => (s ? `${pressesOf(s).presses}` : "—");
    const banal = banalReasons(def, v);
    if (banal.length) banals.push(`${def.id} v${v} : ${banal.join(" ; ")}`);
    rows.push(
      `| ${def.id}${def.long ? " (long)" : ""} | ${def.family} | ${v} | ${Object.entries(values).map(([k, x]) => `${k}=${x}`).join(" ") || "—"} | ${mutationLabel(def.mutations[v]!) || "—"} | ${def.tags.join(" ")} | ${span(sols?.arret)} | ${span(sols?.course)} | ${span(sols?.plein)} | ${exits} | ${ex || "**refusée**"} | ${g(sols?.arret)} | ${g(sols?.course)} | ${g(sols?.plein)} | ${rac(sols?.course)} / ${rac(sols?.plein)} | ${presses(sols?.course)} / ${presses(sols?.plein)} | ${vide} | ${run} | ${flat.length}${def.elan ? " (élan)" : ""}${flat.length > flatLimit(def.elan) ? " **trop long**" : ""} | ${banal.length ? "**oui**" : "non"} |`,
    );
  });
}
console.log(`# Catalogue des morceaux : ${modules.length} morceaux, ${total} variantes (JUMP_SIM_VERSION ${file.jumpSimVersion})\n`);
console.log(rows.join("\n"));
console.log("\n## Répartition");
console.log(`Exigence (variantes) : ${[1, 2, 3, 4, 5].map((e) => `${e} → ${perExigence.get(e) ?? 0}`).join(" · ")}${perExigence.get(0) ? ` · refusées (au pas près ou raccord < 90 %) → ${perExigence.get(0)}` : ""}`);
console.log(`Étiquettes (morceaux) : ${MODULE_TAGS.map((t) => `${t} ${perTag.get(t) ?? 0}`).join(" · ")}`);
console.log(`Familles (${perFamily.size}) : ${[...perFamily].sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1)).map(([f, ids]) => `${f} ${ids.length}`).join(" · ")}`);
console.log(`Enchaînements longs : ${longCount} morceaux`);
console.log(`Mutateurs (variantes) : ${[...perMutator].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(" · ")} ; variantes mutées ${modules.reduce((n, { def }) => n + def.mutations.filter((x) => x.length > 0).length, 0)} sur ${total}`);
durations.sort((a, b) => a - b);
const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
const meanOf = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
console.log(`Sorties des solutions : course ${exitCount.course} · élan plein ${exitCount.plein}`);
console.log(`Variantes banales (critère mesuré, \`tools/banal.ts\`) : ${banals.length ? `\n${banals.map((b) => `- ${b}`).join("\n")}` : "aucune"}`);
console.log(`Course à vide (solutions à la course) : paliers ${secs(meanOf(palierTicks))} s en moyenne (max ${secs(Math.max(...palierTicks))} s) ; plus longue course au sol sans saut ${secs(meanOf(longest.map((l) => l.t)))} s · ${tiles(meanOf(longest.map((l) => l.u)))} tuiles en moyenne (max ${secs(Math.max(...longest.map((l) => l.t)))} s · ${tiles(Math.max(...longest.map((l) => l.u)))} tuiles)`);
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
