import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import {
  EXIGENCE_VERSION,
  INPUT_JUMP,
  INPUT_LEFT,
  INPUT_RIGHT,
  JUMP_SIM_VERSION,
  MODULE_ENTRIES,
  attemptReplay,
  buildModuleDef,
  decodeReplay,
  encodeReplay,
  exigenceOf,
  fromRuns,
  parseModule,
  type ModuleEntry,
  type ModuleSolution,
  type ModuleSolutionsFile,
  type ModuleVariantSolutions,
} from "../src/index";
import { beamSolve } from "./beam";
import { elanExit, entryState, harden, hardenScore, measureMargins, validSolution } from "./exigence";
import { readModules, readSolutions, writeCatalog } from "./files";

// `npm run solve:modules -w @cdj/jump-sim` — le solveur hors ligne des morceaux (lot 4). Pour chaque morceau × variante × entrée (arrêt,
// élan), il cherche la solution la plus rapide qui sort en élan (`beam.ts`), la durcit (aussi rapide, plus tolérante), mesure sa marge (`exigence.ts`), puis écrit
// `modules/solutions.json` et `src/catalog.ts`. **Incrémental** : une solution stockée est gardée tant que l'empreinte de sa grille et
// `JUMP_SIM_VERSION` n'ont pas changé (la mesure seule est refaite si `EXIGENCE_VERSION` a changé).
//   --force          tout re-résoudre          --only=a,b     seulement ces morceaux (les autres sont gardés tels quels)
//   --beam=N         largeur du faisceau (800)  --workers=N    fils de calcul (tous les cœurs)
//   --dry            ne rien écrire (mesure du temps du solveur : `measure:modules -- --solveur`)
// Ne tourne jamais en production ni dans `npm test`.

interface Job {
  id: string;
  text: string;
  variant: number;
  entry: ModuleEntry;
  /** `solve` : chercher ; `measure` : seulement remesurer la solution stockée. */
  kind: "solve" | "measure";
  code?: string;
  fastest?: number;
  beam: number;
}

interface JobResult {
  job: Job;
  solution: ModuleSolution | null;
  ms: number;
  error?: string;
}

/** Une solution gardée peut être plus lente que la plus rapide trouvée d'au plus ce pourcentage (pour être plus tolérante). */
const SLOWER = 2;

const args = new Map(process.argv.slice(2).map((a) => (a.includes("=") ? (a.split("=") as [string, string]) : [a, "1"])));

function runJob(job: Job): JobResult {
  const t0 = performance.now();
  try {
    const m = buildModuleDef(parseModule(job.text), job.variant);
    const start = entryState(m, job.entry);
    let inputs: number[];
    let fastest: number;
    if (job.kind === "measure") {
      inputs = fromRuns(decodeReplay(job.code!).runs);
      fastest = job.fastest ?? inputs.length;
    } else {
      // Plusieurs recherches (paquets de 4, 6 et 8 pas, à progression égale la suite la plus simple d'abord) : la plus rapide donne le temps
      // de référence ; parmi celles qui en sont à moins de `SLOWER` près, après durcissement, la plus tolérante à la gigue est gardée.
      const found: number[][] = [];
      for (const chunk of [4, 6, 8]) {
        let f = beamSolve(m.level, { start, goal: elanExit, beam: job.beam, chunk, changePenalty: 128 });
        if (!f && chunk === 4) f = beamSolve(m.level, { start, goal: elanExit, beam: job.beam * 3, chunk: 3 });
        if (!f) continue;
        // Le monde attend la première commande : on retire les pas d'attente du début (une rediffusion commence au premier pas commandé).
        let lead = 0;
        if (job.entry === "arret") while (lead < f.length && (f[lead]! & (INPUT_LEFT | INPUT_RIGHT | INPUT_JUMP)) === 0) lead++;
        found.push(f.slice(lead));
      }
      if (found.length === 0) return { job, solution: null, ms: performance.now() - t0 };
      fastest = Math.min(...found.map((f) => f.length));
      let best: { inputs: number[]; score: number } | null = null;
      for (const f of found) {
        if (f.length > fastest + Math.floor((fastest * SLOWER) / 100)) continue;
        const hard = harden(m, job.entry, f);
        const score = hardenScore(m, job.entry, hard);
        if (!best || score > best.score || (score === best.score && hard.length < best.inputs.length)) best = { inputs: hard, score };
      }
      inputs = best!.inputs;
    }
    if (!validSolution(m, start, inputs)) throw new Error("solution non valable après durcissement");
    const margins = measureMargins(m, job.entry, inputs);
    const code = encodeReplay(attemptReplay(m.levelId, inputs, 0, job.entry === "elan" ? 1 : 0));
    const solution: ModuleSolution = { code, ticks: inputs.length, fastest, gigue: margins.gigue, raccord: margins.raccord, exigence: exigenceOf(margins.gigue, margins.raccord) };
    return { job, solution, ms: performance.now() - t0 };
  } catch (e) {
    return { job, solution: null, ms: performance.now() - t0, error: e instanceof Error ? e.message : String(e) };
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
  const beam = Number(args.get("--beam") ?? 800);
  const modules = readModules();
  const old = readSolutions();
  const sameSim = old?.jumpSimVersion === JUMP_SIM_VERSION;
  const jobs: Job[] = [];
  const out: Record<string, { variants: ModuleVariantSolutions[] }> = {};
  for (const { text, def } of modules) {
    const variants: ModuleVariantSolutions[] = [];
    for (let v = 0; v < def.variants.length; v++) {
      const m = buildModuleDef(def, v);
      const prev = sameSim ? old?.modules[def.id]?.variants[v] : undefined;
      const keep = prev && prev.grid === m.hash && !force && (!only || !only.includes(def.id));
      const vs: ModuleVariantSolutions = { grid: m.hash, arret: null, elan: null };
      for (const entry of MODULE_ENTRIES) {
        const stored = keep ? prev[entry] : null;
        if (stored && old?.exigenceVersion === EXIGENCE_VERSION) vs[entry] = stored;
        else if (stored) jobs.push({ id: def.id, text, variant: v, entry, kind: "measure", code: stored.code, fastest: stored.fastest, beam });
        else if (only && !only.includes(def.id) && prev?.grid === m.hash && prev[entry]) vs[entry] = prev[entry];
        else jobs.push({ id: def.id, text, variant: v, entry, kind: "solve", beam });
      }
      variants.push(vs);
    }
    out[def.id] = { variants };
  }
  const solveCount = jobs.filter((j) => j.kind === "solve").length;
  console.log(`${modules.length} morceaux, ${Object.values(out).reduce((n, m) => n + m.variants.length, 0)} variantes : ${solveCount} solutions à chercher, ${jobs.length - solveCount} à remesurer.`);

  // ——— Fils de calcul ———
  const results: JobResult[] = [];
  const workers = Math.max(1, Math.min(Number(args.get("--workers") ?? availableParallelism()), jobs.length));
  // Les plus longues d'abord (les variantes les plus hautes) : la file se vide plus régulièrement.
  const queue = [...jobs];
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
          const s = r.solution;
          const tag = `${r.job.id} v${r.job.variant} ${r.job.entry}`.padEnd(32);
          console.log(`${tag} ${s ? `${(s.ticks / 120).toFixed(3)} s (trouvée ${(s.fastest / 120).toFixed(3)} s) · gigue ${s.gigue.map((g) => g / 10).join(" / ")} % · raccord ${s.raccord === null ? "—" : `${s.raccord / 10} %`} · exigence ${s.exigence}` : `AUCUNE SOLUTION${r.error ? ` (${r.error})` : ""}`} · ${(r.ms / 1000).toFixed(1)} s`);
          next();
        });
        w.on("error", fail);
        next();
      });
    }),
  );
  for (const r of results) out[r.job.id]!.variants[r.job.variant]![r.job.entry] = r.solution;

  const file: ModuleSolutionsFile = { jumpSimVersion: JUMP_SIM_VERSION, exigenceVersion: EXIGENCE_VERSION, modules: out };
  if (!args.has("--dry")) {
    writeCatalog(
      modules.map((m) => m.text),
      file,
    );
  }
  const missing = Object.entries(out).flatMap(([id, m]) => m.variants.flatMap((v, k) => MODULE_ENTRIES.filter((e) => !v[e]).map((e) => `${id} v${k} ${e}`)));
  const tight = Object.entries(out).flatMap(([id, m]) => m.variants.flatMap((v, k) => MODULE_ENTRIES.filter((e) => v[e]?.exigence === 0).map((e) => `${id} v${k} ${e}`)));
  const cpu = results.reduce((n, r) => n + r.ms, 0);
  console.log(`\nTemps : ${((performance.now() - t0) / 1000).toFixed(1)} s (${workers} fils, ${(cpu / 1000).toFixed(1)} s de calcul).`);
  if (missing.length) console.log(`Sans solution : ${missing.join(", ")}`);
  if (tight.length) console.log(`Au pas près (à adoucir ou retirer) : ${tight.join(", ")}`);
  console.log(args.has("--dry") ? "Rien n'est écrit (--dry)." : "Écrit : modules/solutions.json, src/catalog.ts");
}
