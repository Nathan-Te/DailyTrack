import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import {
  MODULE_ENTRIES,
  PRESS_MIN,
  RELEASE_MIN,
  SINGLE_CLOCK_VERSION,
  TICK_RATE,
  attemptReplay,
  buildModuleDef,
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
import { PHASES_PER_PERIOD, PHASES_RULE_VERSION, modulePeriod, phaseOk, phaseWait, phasesOf, readPhases, variantOk, singleClockModule, writePhases, type PhaseResult, type PhasesFile, type VariantPhases } from "./phasesFile";

// `npm run phases:modules -w @cdj/jump-sim` (lot 15) — la **validation toutes phases** (règle et fichiers : `phasesFile.ts`). Pour chaque
// variante utilisable du catalogue dont l'horloge tourne (scies mobiles, clignotants, rafales), et pour chaque phase essayée de sa période :
// le morceau seul passé à l'horloge unique à cette phase, la recherche (`beamSolve`, attendre est permis : le chrono part au premier pas) de
// la sortie canonique depuis l'arrêt sur le palier d'entrée, puis le durcissement et la mesure de la gigue (`exigence.ts`), avec le repli
// robuste du solveur (lot 8c : jusqu'à 25 % plus lent, en attendant avant un geste). **Premier candidat** : attendre sur le palier le temps qu'il
// faut pour retrouver la phase où la solution « arrêt » stockée (v3) rencontrait l'horloge, puis la jouer telle quelle ; s'il tient la règle, il
// est gardé, sinon la recherche prend le relais. Une phase passe si sa note est d'au moins 1 (gigue ±3 ≥
// 50 %, appuis ≥ `PRESS_MIN`) **et** n'attend pas plus de `PHASE_WAIT_MAX` (12 s, lot 17). Écrit `modules/phases.json` (le détail, avec les solutions) et `src/phases.ts` (les variantes refusées, que le
// générateur écarte). Incrémental : une variante gardée tant que l'empreinte de sa grille et la règle n'ont pas changé.
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

function runJob(job: Job): JobResult {
  const t0 = performance.now();
  const none: PhaseResult = { phase: job.phase, code: null, exitTick: 0, gigue: null, exigence: 0 };
  try {
    const def = parseModule(job.text);
    const base = buildModuleDef(def, job.variant);
    const period = modulePeriod(base);
    const m = singleClockModule(base, job.phase);
    // Attendre jusqu'à une période de plus que le solveur ordinaire (un enchaînement long dure jusqu'à 8 s).
    const maxTicks = (def.long ? 1320 : 960) + period;
    const start = entryState(m, "arret");
    const goal = canonicalExit(m);
    const lost = lostExit(m);
    // Le candidat « attendre puis rejouer la solution stockée » : seul, le morceau (v3) mettait son horloge en marche au pas `e` où la solution
    // entre dans sa section ; attendre `w` pas (`φ + w + e ≡ 0`) remet la même rencontre.
    const stored = moduleSolutions(job.id, job.variant)?.arret;
    if (stored) {
      const v3 = decodeReplay(stored.code);
      const e = replayAttempt(base.level, v3).final.sections[0]!;
      const wait = cycleMod(-job.phase - e, period);
      const inputs = [...new Array<number>(wait).fill(0), ...fromRuns(v3.runs)];
      const span = moduleSpan(m, "arret", inputs);
      if (typeof span !== "string") {
        const margins = measureMargins(m, "arret", inputs);
        if (exigenceOf(margins.gigue, null) >= 1) {
          const code = encodeReplay(attemptReplay(m.levelId, inputs, 0, 0, SINGLE_CLOCK_VERSION));
          return { job, result: { phase: job.phase, code, exitTick: span.exitTick, gigue: margins.gigue, exigence: exigenceOf(margins.gigue, null) }, ms: performance.now() - t0 };
        }
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
    const code = encodeReplay(attemptReplay(m.levelId, inputs, 0, 0, SINGLE_CLOCK_VERSION));
    return { job, result: { phase: job.phase, code, exitTick: span.exitTick, gigue: margins.gigue, exigence: exigenceOf(margins.gigue, null) }, ms: performance.now() - t0 };
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
  const old = readPhases();
  const sameRule = old?.rule === PHASES_RULE_VERSION && old.perPeriod === PHASES_PER_PERIOD;
  const out: PhasesFile = { rule: PHASES_RULE_VERSION, perPeriod: PHASES_PER_PERIOD, modules: {} };
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
      const period = modulePeriod(m);
      if (period === 0) {
        variants.push(null);
        continue;
      }
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
      for (const phase of phasesOf(period)) jobs.push({ id: def.id, text, variant: v, phase, beam });
    }
    out.modules[def.id] = { variants };
  }
  console.log(`${cyclic} variantes avec une horloge : ${jobs.length} reprises à chercher (${PHASES_PER_PERIOD} phases par période au plus).`);

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
      // Lot 17 : le verdict se relit sur les solutions gardées (note ≥ 1 **et** attente ≤ 12 s), y compris pour les variantes gardées telles quelles.
      v.ok = variantOk(v);
      if (!v.ok) {
        const ko = v.phases.filter((p) => !phaseOk(p));
        const long = ko.filter((p) => p.exigence >= 1);
        refused.push(`${id} v${k} (phases ${ko.map((p) => p.phase).join(", ")} sur ${v.period}${long.length ? ` ; attente de ${(Math.max(...long.map(phaseWait)) / TICK_RATE).toFixed(1)} s au plus` : ""})`);
      }
    });
  }
  writePhases(out);
  const cpu = results.reduce((n, r) => n + r.ms, 0);
  console.log(`\nTemps : ${((performance.now() - t0) / 1000).toFixed(1)} s (${workers} fils, ${(cpu / 1000).toFixed(1)} s de calcul).`);
  console.log(refused.length ? `Refusées (${refused.length}) : ${refused.join(" ; ")}` : "Aucune variante refusée.");
  console.log("Écrit : modules/phases.json, src/phases.ts");
}
