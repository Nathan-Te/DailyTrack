import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import {
  type BuiltModule,
  MODULE_ENTRIES,
  PRESS_MIN,
  RELEASE_MIN,
  SINGLE_CLOCK_VERSION,
  TICK_RATE,
  ALT_HOP_PRESS,
  attemptReplay,
  buildModuleDef,
  hopInPlace,
  cycleMod,
  decodeReplay,
  encodeReplay,
  fromRuns,
  exigenceOf,
  moduleSolutions,
  moduleSpan,
  parseModule,
  replayAttempt,
  variantExigence,
} from "../src/index";
import { beamSolve } from "./beam";
import { canonicalExit, entryState, fromCore, harden, hardenScore, lostExit, measureMargins } from "./exigence";
import { readModules } from "./files";
import { PHASES_PER_PERIOD, modulePeriod, phasesOf, singleClockModule, type PhaseResult, type PhasesFile, type VariantPhases } from "./phasesFile";
import { ETATS_RULE_VERSION, phaseOkB, phaseWaitB, readEtats, swappedModule, variantOkB, writeEtats } from "./etatsFile";

// `npm run etats:modules -w @cdj/jump-sim` (lot 28) — la **validation de la reprise depuis l'état B** (règle et fichiers : `etatsFile.ts`). Pour chaque variante utilisable du catalogue qui a des
// blocs alternés, et pour chaque phase essayée de sa période (une seule si rien ne tourne) : le morceau seul **avec les deux jeux inversés** (`swappedModule` : son état A est l'état B du morceau
// d'origine, donc toute la machinerie du solveur, qui part de A, s'applique telle quelle), la recherche de la sortie canonique depuis l'arrêt sur le palier d'entrée, puis le durcissement et la
// mesure de la gigue (`exigence.ts`), avec le repli robuste du solveur (lot 8c). **Premier candidat** : sauter sur place (les jeux repassent en A), attendre la phase où la solution « arrêt »
// stockée rencontrait l'horloge, puis la jouer telle quelle ; s'il tient la règle, il est gardé, sinon la recherche prend le relais. Une phase passe si sa note est d'au moins 1 (gigue ±3 ≥ 50 %,
// appuis ≥ `PRESS_MIN`) **et** que le joueur ne reste pas plus de `PHASE_WAIT_MAX` (12 s) sur le palier avant de s'élancer. Écrit `modules/etats.json` (le détail, avec les solutions) et
// `src/etats.ts` (les variantes refusées, que le générateur g22 écarte). Incrémental : une variante gardée tant que l'empreinte de sa grille et la règle n'ont pas changé.
//   --force   tout refaire        --only=a,b   seulement ces morceaux        --workers=N   fils de calcul        --beam=N   faisceau (600)
// Ne tourne jamais en production ni dans `npm test`.

interface Job {
  id: string;
  text: string;
  variant: number;
  phase: number;
  beam: number;
}

interface JobResult {
  job: Job;
  result: PhaseResult;
  ms: number;
}

/** Comme le solveur : une solution gardée peut être 2 % plus lente que la plus rapide (plus tolérante), le repli robuste jusqu'à 25 %. */
const SLOWER = 2;
const ROBUST_SLOWER = 25;
const CHUNKS = [4, 6];

const args = new Map(process.argv.slice(2).map((a) => (a.includes("=") ? (a.split("=") as [string, string]) : [a, "1"])));

/** Le morceau seul (version 3 ; version 4 à la phase voulue s'il a une horloge) avec les jeux échangés : son état de départ est l'état B du morceau d'origine. */
function mirrored(base: BuiltModule, phase: number): BuiltModule {
  const clocked = base.level.sections.length === 0 ? base : singleClockModule(base, phase);
  return swappedModule(clocked);
}

function runJob(job: Job): JobResult {
  const t0 = performance.now();
  const none: PhaseResult = { phase: job.phase, code: null, exitTick: 0, gigue: null, exigence: 0 };
  try {
    const def = parseModule(job.text);
    const base = buildModuleDef(def, job.variant);
    const period = modulePeriod(base);
    const m = mirrored(base, job.phase);
    const version = m.level.simVersion;
    const encode = (inputs: number[]) => encodeReplay(attemptReplay(m.levelId, inputs, 0, 0, version));
    const result = (inputs: number[], exitTick: number, gigue: [number, number, number]): JobResult => ({ job, result: { phase: job.phase, code: encode(inputs), exitTick, gigue, exigence: exigenceOf(gigue, null) }, ms: performance.now() - t0 });
    // Attendre jusqu'à une période de plus que le solveur ordinaire (un enchaînement long dure jusqu'à 8 s).
    const maxTicks = (def.long ? 1320 : 960) + period + 120;
    const start = entryState(m, "arret");
    const goal = canonicalExit(m);
    const lost = lostExit(m);
    // Le candidat « sauter sur place, attendre, puis rejouer la solution stockée » : seul, le morceau (v3) mettait son horloge en marche au pas `e` où la solution entre dans sa section ;
    // sauter (H pas) puis attendre `w` pas (`φ + H + w + e ≡ 0`) remet la même rencontre.
    const stored = moduleSolutions(job.id, job.variant)?.arret;
    const hop = hopInPlace(m.level, start);
    if (stored && hop) {
      const v3 = decodeReplay(stored.code);
      const e = base.level.sections.length === 0 ? 0 : replayAttempt(base.level, v3).final.sections[0]!;
      const wait = period > 0 ? cycleMod(-job.phase - e - hop.inputs.length, period) : 0;
      const inputs = [...hop.inputs, ...new Array<number>(wait).fill(0), ...fromRuns(v3.runs)];
      const span = moduleSpan(m, "arret", inputs);
      if (typeof span !== "string") {
        const margins = measureMargins(m, "arret", inputs);
        if (exigenceOf(margins.gigue, null) >= 1) return result(inputs, span.exitTick, margins.gigue);
      }
    }
    const found: number[][] = [];
    for (const chunk of CHUNKS) {
      let f = beamSolve(m.level, { start, goal, lost, beam: job.beam, chunk, changePenalty: 128, maxTicks, pressMin: PRESS_MIN, releaseMin: RELEASE_MIN });
      if (!f && chunk === 4) f = beamSolve(m.level, { start, goal, lost, beam: job.beam * 3, chunk: 3, maxTicks, pressMin: PRESS_MIN, releaseMin: RELEASE_MIN });
      if (f) found.push(f);
    }
    if (found.length === 0) return { job, result: none, ms: performance.now() - t0 };
    const fastest = Math.min(...found.map((f) => f.length));
    let pick: { core: number[]; score: number } | null = null;
    for (const f of found) {
      if (f.length > fastest + Math.floor((fastest * SLOWER) / 100)) continue;
      const full = fromCore(m, "arret", f);
      const score = full ? hardenScore(m, "arret", full.full) : -1;
      if (!pick || score > pick.score || (score === pick.score && f.length < pick.core.length)) pick = { core: f, score };
    }
    let inputs = harden(m, "arret", pick!.core).full;
    let margins = measureMargins(m, "arret", inputs);
    if (exigenceOf(margins.gigue, null) === 0) {
      for (const f of [...found].sort((a, b) => a.length - b.length)) {
        const cap = fastest + Math.floor((fastest * ROBUST_SLOWER) / 100);
        if (f.length > cap) break;
        const h = harden(m, "arret", f, 12, cap).full;
        if (typeof moduleSpan(m, "arret", h) === "string") continue;
        const mg = measureMargins(m, "arret", h);
        if (exigenceOf(mg.gigue, null) === 0) continue;
        inputs = h;
        margins = mg;
        break;
      }
    }
    const span = moduleSpan(m, "arret", inputs);
    if (typeof span === "string") return { job, result: none, ms: performance.now() - t0 };
    return result(inputs, span.exitTick, margins.gigue);
  } catch (e) {
    console.error(`${job.id} v${job.variant} phase ${job.phase} : ${e instanceof Error ? e.message : String(e)}`);
    return { job, result: none, ms: performance.now() - t0 };
  }
}

if (!isMainThread) {
  parentPort!.on("message", (job: Job | null) => {
    if (job === null) process.exit(0);
    parentPort!.postMessage(runJob(job));
  });
} else {
  await main();
}

async function main(): Promise<void> {
  const t0 = performance.now();
  const force = args.has("--force");
  const only = args.get("--only")?.split(",") ?? null;
  const beam = Number(args.get("--beam") ?? 600);
  const old = readEtats();
  const sameRule = old?.rule === ETATS_RULE_VERSION && old.perPeriod === PHASES_PER_PERIOD;
  const out: PhasesFile = { rule: ETATS_RULE_VERSION, perPeriod: PHASES_PER_PERIOD, modules: {} };
  const jobs: Job[] = [];
  let cyclic = 0;
  for (const { text, def } of readModules()) {
    const variants: (VariantPhases | null)[] = [];
    for (let v = 0; v < def.variants.length; v++) {
      const s = moduleSolutions(def.id, v);
      // Seules les variantes que le générateur peut poser (solutions aux deux entrées, jouables).
      if (!MODULE_ENTRIES.every((e) => s?.[e]) || variantExigence(s) < 1) {
        variants.push(null);
        continue;
      }
      const m = buildModuleDef(def, v);
      // Seules les variantes à blocs alternés (l'état B n'existe que là).
      if (m.level.alts.length === 0) {
        variants.push(null);
        continue;
      }
      const period = modulePeriod(m);
      cyclic++;
      const prev = sameRule ? old?.modules[def.id]?.variants[v] : null;
      const keep = prev && prev.grid === m.hash && prev.period === period && !force && (!only || !only.includes(def.id));
      if (keep) {
        variants.push(prev);
        continue;
      }
      // `--only` : les autres morceaux gardent ce qu'ils avaient (rien s'ils n'avaient rien).
      if (only && !only.includes(def.id)) {
        variants.push(prev ?? null);
        continue;
      }
      variants.push({ grid: m.hash, period, phases: [], ok: false });
      for (const phase of period === 0 ? [0] : phasesOf(period)) jobs.push({ id: def.id, text, variant: v, phase, beam });
    }
    out.modules[def.id] = { variants };
  }
  console.log(`${cyclic} variantes à blocs alternés : ${jobs.length} reprises en B à chercher (${PHASES_PER_PERIOD} phases par période au plus).`);

  const results: JobResult[] = [];
  const workers = Math.max(1, Math.min(Number(args.get("--workers") ?? availableParallelism()), jobs.length));
  const queue = [...jobs];
  if (jobs.length > 0) {
    await Promise.all(
      Array.from({ length: workers }, () => {
        const w = new Worker(fileURLToPath(import.meta.url));
        return new Promise<void>((done, fail) => {
          const next = () => {
            const job = queue.shift();
            if (!job) {
              w.postMessage(null);
              done();
              return;
            }
            w.postMessage(job);
          };
          w.on("message", (r: JobResult) => {
            results.push(r);
            const x = r.result;
            const tag = `${r.job.id} v${r.job.variant} phase ${r.job.phase}`.padEnd(36);
            console.log(`${tag} ${x.code ? `sortie ${(x.exitTick / 120).toFixed(3)} s · gigue ${x.gigue!.map((g) => g / 10).join(" / ")} % · exigence ${x.exigence}` : "AUCUNE SOLUTION"} · ${(r.ms / 1000).toFixed(1)} s`);
            next();
          });
          w.on("error", fail);
          next();
        });
      }),
    );
  }
  for (const r of results.sort((a, b) => a.job.phase - b.job.phase)) out.modules[r.job.id]!.variants[r.job.variant]!.phases.push(r.result);
  const refused: string[] = [];
  for (const [id, m] of Object.entries(out.modules)) {
    m.variants.forEach((v, k) => {
      if (!v) return;
      // Le verdict se relit sur les solutions gardées (note ≥ 1 **et** palier quitté en 12 s au plus), y compris pour les variantes gardées telles quelles.
      v.ok = variantOkB(v);
      if (!v.ok) {
        const ko = v.phases.filter((p) => !phaseOkB(p));
        const long = ko.filter((p) => p.exigence >= 1);
        refused.push(`${id} v${k} (phases ${ko.map((p) => p.phase).join(", ")} sur ${v.period}${long.length ? ` ; attente de ${(Math.max(...long.map(phaseWaitB)) / TICK_RATE).toFixed(1)} s au plus` : ""})`);
      }
    });
  }
  writeEtats(out);
  const cpu = results.reduce((n, r) => n + r.ms, 0);
  console.log(`\nTemps : ${((performance.now() - t0) / 1000).toFixed(1)} s (${workers} fils, ${(cpu / 1000).toFixed(1)} s de calcul).`);
  console.log(refused.length ? `Refusées (${refused.length}) : ${refused.join(" ; ")}` : "Aucune variante refusée.");
  console.log("Écrit : modules/etats.json, src/etats.ts");
}
