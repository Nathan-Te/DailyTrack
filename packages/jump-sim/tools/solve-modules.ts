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
  PRESS_MIN,
  RELEASE_MIN,
  attemptReplay,
  buildModuleDef,
  decodeReplay,
  encodeReplay,
  exigenceOf,
  fromRuns,
  moduleSpan,
  parseModule,
  shortestPress,
  type ModuleEntry,
  type ModuleSolution,
  type ModuleSolutionsFile,
  type ModuleVariantSolutions,
} from "../src/index";
import { beamSolve } from "./beam";
import { canonicalExit, elanEntry, entryState, fromCore, harden, hardenScore, lostExit, measureMargins } from "./exigence";
import { readModules, readSolutions, writeCatalog } from "./files";

// `npm run solve:modules -w @cdj/jump-sim` — le solveur hors ligne des morceaux (lots 4 et 6). Pour chaque morceau × variante × entrée
// (arrêt, élan), il cherche la solution la plus rapide jusqu'à la **sortie canonique** (le centre passe le bord droit du palier de sortie, au
// sol, en course propre : `beam.ts`) — en élan, depuis le bord droit du palier d'entrée, après la course droite tenue —, la durcit (aussi
// rapide, plus tolérante à la gigue et à toutes les positions d'entrée), la finit tout droit jusqu'à l'arrivée du morceau seul, mesure sa
// marge (`exigence.ts`), puis écrit
// `modules/solutions.json` et `src/catalog.ts`. **Incrémental** : une solution stockée est gardée tant que l'empreinte de sa grille et
// `JUMP_SIM_VERSION` n'ont pas changé (la mesure seule est refaite si `EXIGENCE_VERSION` a changé).
//   --force          tout re-résoudre          --only=a,b     seulement ces morceaux (les autres sont gardés tels quels)
//   --beam=N         largeur du faisceau (600 ; 800 avant le lot 7)  --workers=N    fils de calcul (tous les cœurs)
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
/** Lot 8c, repli robuste : jusqu'à combien de % au-dessus de la plus rapide trouvée on cherche une solution jouable par un humain. */
const ROBUST_SLOWER = 25;
/** Pas d'attente qu'une solution à l'arrêt peut perdre au début (marge de la borne des recherches suivantes). */
const IDLE_SLACK = 48;
/**
 * Paquets des recherches (lot 7 : 4 et 6 pas ; 4, 6 et 8 aux lots 4 et 6). Chaque recherche coûte autant (largeur × actions × pas) : la
 * troisième ne donnait presque jamais la solution gardée, et le catalogue a doublé (budget : moins de 20 min sur 4 fils).
 */
const CHUNKS = [4, 6];

const args = new Map(process.argv.slice(2).map((a) => (a.includes("=") ? (a.split("=") as [string, string]) : [a, "1"])));

function runJob(job: Job): JobResult {
  const t0 = performance.now();
  try {
    const def = parseModule(job.text);
    const m = buildModuleDef(def, job.variant);
    // Un enchaînement long (lot 7) dure jusqu'à 8 s : la recherche va plus loin.
    const maxTicks = def.long ? 1320 : 960;
    let inputs: number[];
    let fastest: number;
    // Visibles du repli robuste (plus bas) : le préfixe de la course d'élan et toutes les solutions trouvées.
    const prefix: number[] = [];
    const found: number[][] = [];
    if (job.kind === "measure") {
      inputs = fromRuns(decodeReplay(job.code!).runs);
      fastest = job.fastest ?? inputs.length;
    } else {
      // En élan, la recherche part du bord droit du palier d'entrée (après la course, droite tenue, qui fait partie de la rediffusion).
      let start = entryState(m, job.entry);
      if (job.entry === "elan") {
        const e = elanEntry(m);
        for (let t = 0; t < e.ticks; t++) prefix.push(INPUT_RIGHT);
        start = e.state;
      }
      const goal = canonicalExit(m);
      const lost = lostExit(m);
      // Plusieurs recherches (paquets de `CHUNKS` pas, à progression égale la suite la plus simple d'abord) : la plus rapide donne le temps
      // de référence ; parmi celles qui en sont à moins de `SLOWER` près, la plus tolérante est durcie et gardée.
      // Borne (lot 7, sans effet sur le résultat) : une fois une solution trouvée, une recherche suivante n'a pas besoin d'aller au-delà de
      // la durée où sa solution serait écartée (plus de `SLOWER` % au-dessus de la plus rapide connue, plus `IDLE_SLACK` pas d'attente
      // retirés au début) : une recherche vaine s'arrête là au lieu d'aller jusqu'à `maxTicks`.
      const bound = () => {
        if (found.length === 0) return maxTicks;
        const cur = Math.min(...found.map((f) => f.length)) - prefix.length;
        return Math.min(maxTicks, cur + Math.floor((cur * SLOWER) / 100) + IDLE_SLACK);
      };
      for (const chunk of CHUNKS) {
        let f = beamSolve(m.level, { start, goal, lost, beam: job.beam, chunk, changePenalty: 128, maxTicks: bound(), pressMin: PRESS_MIN, releaseMin: RELEASE_MIN });
        if (!f && chunk === 4) f = beamSolve(m.level, { start, goal, lost, beam: job.beam * 3, chunk: 3, maxTicks, pressMin: PRESS_MIN, releaseMin: RELEASE_MIN });
        if (!f) continue;
        // Le monde attend la première commande : on retire les pas d'attente du début (une rediffusion commence au premier pas commandé).
        let idle = 0;
        if (job.entry === "arret") while (idle < f.length && (f[idle]! & (INPUT_LEFT | INPUT_RIGHT | INPUT_JUMP)) === 0) idle++;
        found.push([...prefix, ...f.slice(idle)]);
      }
      if (found.length === 0) return { job, solution: null, ms: performance.now() - t0 };
      fastest = Math.min(...found.map((f) => f.length)) - prefix.length;
      // Lot 7 : parmi les solutions à moins de `SLOWER` % de la plus rapide, seule la plus tolérante **avant** durcissement est durcie (à
      // égalité, la plus courte) : le durcissement de chacune coûtait la moitié du temps du solveur (catalogue doublé, budget de 20 min).
      let pick: { core: number[]; score: number } | null = null;
      for (const f of found) {
        if (f.length - prefix.length > fastest + Math.floor((fastest * SLOWER) / 100)) continue;
        const full = fromCore(m, job.entry, f);
        const score = full ? hardenScore(m, job.entry, full.full) : -1;
        if (!pick || score > pick.score || (score === pick.score && f.length < pick.core.length)) pick = { core: f, score };
      }
      inputs = harden(m, job.entry, pick!.core).full;
    }
    let span = moduleSpan(m, job.entry, inputs);
    if (typeof span === "string") throw new Error(`solution non valable : ${span}`);
    let margins = measureMargins(m, job.entry, inputs);
    let rapide: number | undefined;
    // Lot 8c — **repli robuste** : la plus rapide (et toutes celles à moins de `SLOWER` %) peut tenir d'une astuce au pas près, qu'aucun
    // humain ne refait. Si la solution durcie n'est pas jouable (`exigenceOf` = 0), on reprend les solutions trouvées de la plus rapide à
    // `ROBUST_SLOWER` % au-dessus, et on durcit chacune en lui permettant de prendre plus de temps (attendre avant un geste) ; la première
    // jouable est gardée. Elle devient la référence (`fastest`) ; la plus rapide trouvée reste notée (`rapide`).
    if (job.kind === "solve" && found.length > 0 && exigenceOf(margins.gigue, margins.raccord) === 0) {
      const any = fastest;
      const sorted = [...found].sort((a, b) => a.length - b.length);
      for (const f of sorted) {
        if (f.length - prefix.length > any + Math.floor((any * ROBUST_SLOWER) / 100)) break;
        const cap = prefix.length + any + Math.floor((any * ROBUST_SLOWER) / 100);
        const h = harden(m, job.entry, f, 12, cap).full;
        const sp = moduleSpan(m, job.entry, h);
        if (typeof sp === "string") continue;
        const mg = measureMargins(m, job.entry, h);
        if (exigenceOf(mg.gigue, mg.raccord) === 0) continue;
        inputs = h;
        span = sp;
        margins = mg;
        fastest = sp.exitTick - sp.entryTick;
        // Aussi rapide que la plus rapide (mieux durcie seulement) : rien de plus lent, pas de `rapide` à noter.
        if (fastest > any) rapide = any;
        else fastest = any;
        break;
      }
    }
    const code = encodeReplay(attemptReplay(m.levelId, inputs, 0, job.entry === "elan" ? 1 : 0));
    const solution: ModuleSolution = {
      code,
      ticks: inputs.length,
      entryTick: span.entryTick,
      exitTick: span.exitTick,
      fastest,
      ...(rapide !== undefined ? { rapide } : {}),
      gigue: margins.gigue,
      raccord: margins.raccord,
      exigence: exigenceOf(margins.gigue, margins.raccord),
      press: shortestPress(inputs),
    };
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
  const beam = Number(args.get("--beam") ?? 600);
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
        else if (only && !only.includes(def.id)) vs[entry] = prev?.grid === m.hash ? (prev[entry] ?? null) : null;
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
  // Les plus longues d'abord (enchaînements longs, puis les plus grandes grilles) : la file se vide plus régulièrement (lot 7 : elle n'était
  // pas triée, les enchaînements longs finissaient seuls sur un fil).
  const cost = (j: Job) => {
    const m = buildModuleDef(parseModule(j.text), j.variant);
    return (parseModule(j.text).long ? 1e6 : 0) + m.width * m.height;
  };
  const costs = new Map(jobs.map((j) => [j, cost(j)]));
  const queue = [...jobs].sort((a, b) => costs.get(b)! - costs.get(a)!);
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
          console.log(`${tag} ${s ? `${((s.exitTick - s.entryTick) / 120).toFixed(3)} s (trouvée ${(s.fastest / 120).toFixed(3)} s) · gigue ${s.gigue.map((g) => g / 10).join(" / ")} % · raccord ${s.raccord === null ? "—" : `${s.raccord / 10} %`} · exigence ${s.exigence}` : `AUCUNE SOLUTION${r.error ? ` (${r.error})` : ""}`} · ${(r.ms / 1000).toFixed(1)} s`);
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
