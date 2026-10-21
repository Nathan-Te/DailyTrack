import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { availableParallelism } from "node:os";
import { fileURLToPath } from "node:url";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import {
  ATTEMPT_DEAD,
  DEFAULT_JUMP_PARAMS,
  INPUT_RIGHT,
  PHASE_REFUSED,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  PRESS_MIN,
  RELEASE_MIN,
  SLOW_MIN_EXIGENCE,
  UNITS_PER_TILE,
  buildModuleDef,
  decodeReplay,
  encodeReplay,
  attemptReplay,
  exigenceOf,
  fromRuns,
  moduleSolutions,
  moduleSpan,
  parseModule,
  slowCostMin,
  stepAttempt,
  textHash,
  tileOf,
  toRuns,
  variantExigence,
  type AttemptState,
  type BuiltModule,
} from "../src/index";
import { beamSolve } from "./beam";
import { EXTRA_TICKS, canonicalExit, elanEntry, entryState, fromCore, harden, humanized, lostExit, measureMargins } from "./exigence";
import { packageDir, readModules } from "./files";

// `npm run voies:modules -w @cdj/jump-sim` (lot 16) — les **voies parasites** : un détour qui contourne le passage dur d'un morceau noté 4 ou
// 5 pour moins que le coût minimal d'une voie lente (`slowCostMin` : +50 % du temps de la portion, au moins +3 s).
//   1. Le **passage dur** : sur la solution de référence en élan (l'entrée de toute portion dure dans le niveau du jour), chaque changement de
//      commande est décalé **seul** de −3 à +3 pas (appuis humains) ; s'il en est un qui fait mourir ou manquer la sortie, ce geste est
//      **précis** et la position du personnage à cet instant marque le passage : une boîte de 3 colonnes × 5 rangées autour de son centre.
//   2. La **recherche** (`beamSolve`, le solveur des morceaux, appuis humains) d'une sortie canonique qui ne touche **aucune** de ces boîtes,
//      en au plus `rapide + coût minimal` pas : ce qu'elle trouve passe ailleurs (par en haut, par en bas, par un autre côté) et ne coûte pas
//      assez — une voie parasite. Sa note (gigue ±3) est mesurée.
//   3. Verdict : un détour qu'un humain peut prendre (note ≥ 1, après durcissement) est une voie parasite et **ferme** la variante (`src/parasites.ts`, `PARASITE_CLOSED` : le générateur g11 ne la pose plus). L'allonger
//      (en faire une vraie voie lente) demande de redessiner le morceau à la main : c'est proposé dans le README du lot 16, pas fait ici.
// Écrit `modules/voies.json` (le détail, avec les détours trouvés) et `src/parasites.ts`. Ne tourne jamais en production ni dans `npm test`.
//   --workers=N   fils de calcul        --beam=N   faisceau (600)        --only=a,b   seulement ces morceaux

/** Version de la règle (à monter si la détection change : tout est refait). */
export const VOIES_RULE_VERSION = 1;
/** Décalage d'un seul geste pour le dire précis (pas), comme la gigue ±3 de la note. */
const PRECISE_SHIFT = 3;
/** Demi-largeur et demi-hauteur (tuiles) de la boîte d'un geste précis, autour de la tuile du centre du personnage. */
const BOX_COLS = 1;
const BOX_ROWS = 2;

interface Job {
  id: string;
  text: string;
  variant: number;
  beam: number;
}

export interface VariantVoies {
  grid: string;
  /** Temps de la portion (sortie − entrée de la référence en élan) et coût minimal d'une voie lente. */
  fast: number;
  costMin: number;
  /** Gestes précis (pas de la référence) et leurs boîtes (colonnes, rangées du morceau seul). */
  precise: number[];
  boxes: { c0: number; c1: number; r0: number; r1: number }[];
  /** Le détour trouvé (sans toucher les boîtes) : ses pas de l'entrée à la sortie, sa note, sa rediffusion ; null : aucun. */
  detour: { ticks: number; note: number; code: string } | null;
  verdict: "sans-detour" | "injouable" | "fermee";
}

interface JobResult {
  job: Job;
  result: VariantVoies | null;
  ms: number;
  error?: string;
}

const args = new Map(process.argv.slice(2).map((a) => (a.includes("=") ? (a.split("=") as [string, string]) : [a, "1"])));

/** Fins de séries (pas où la commande change). */
function boundaries(inputs: readonly number[]): number[] {
  const out: number[] = [];
  let at = 0;
  const runs = toRuns(inputs);
  for (let i = 0; i < runs.length - 1; i++) {
    at += runs[i]!.count;
    out.push(at);
  }
  return out;
}

/** La solution avec le changement de commande au pas `b` décalé de `d` (les autres en place), rendue humaine. */
function shiftOne(inputs: readonly number[], b: number, d: number): number[] {
  const out = [...inputs];
  if (d > 0) for (let t = b; t < Math.min(out.length, b + d); t++) out[t] = inputs[b - 1]!;
  else for (let t = Math.max(0, b + d); t < b; t++) out[t] = inputs[b]!;
  return humanized(out);
}

/** La sortie canonique est-elle atteinte (sans mort) ? */
function exits(m: BuiltModule, start: AttemptState, inputs: readonly number[]): boolean {
  const goal = canonicalExit(m);
  let s = start;
  for (let t = 0; t < inputs.length + EXTRA_TICKS; t++) {
    s = stepAttempt(s, t < inputs.length ? inputs[t]! : INPUT_RIGHT, m.level, DEFAULT_JUMP_PARAMS);
    if (s.status === ATTEMPT_DEAD) return false;
    if (goal(s)) return true;
  }
  return false;
}

function runJob(job: Job): JobResult {
  const t0 = performance.now();
  try {
    const m = buildModuleDef(parseModule(job.text), job.variant);
    const sol = moduleSolutions(job.id, job.variant)!.elan!;
    const inputs = fromRuns(decodeReplay(sol.code).runs);
    const start = entryState(m, "elan");
    const fast = sol.exitTick - sol.entryTick;
    const costMin = slowCostMin(fast);
    // 1. Les gestes précis et leurs boîtes.
    const states: AttemptState[] = [];
    let s = start;
    for (const bits of inputs) {
      s = stepAttempt(s, bits, m.level, DEFAULT_JUMP_PARAMS);
      states.push(s);
    }
    const precise: number[] = [];
    const boxes: VariantVoies["boxes"] = [];
    for (const b of boundaries(inputs)) {
      if (b < sol.entryTick || b > sol.exitTick) continue;
      let tight = false;
      for (let d = -PRECISE_SHIFT; d <= PRECISE_SHIFT && !tight; d++) if (d !== 0 && !exits(m, start, shiftOne(inputs, b, d))) tight = true;
      if (!tight) continue;
      precise.push(b);
      const p = states[b - 1]!.player;
      const c = tileOf(p.x + PLAYER_WIDTH / 2);
      const r = tileOf(p.y + PLAYER_HEIGHT / 2);
      boxes.push({ c0: c - BOX_COLS, c1: c + BOX_COLS, r0: r - BOX_ROWS, r1: r + BOX_ROWS });
    }
    // 2. Un détour qui ne touche aucune boîte, en moins de `rapide + coût minimal`.
    let detour: VariantVoies["detour"] = null;
    if (boxes.length > 0) {
      const T = UNITS_PER_TILE;
      const inBox = (st: AttemptState) => {
        const x0 = st.player.x;
        const x1 = st.player.x + PLAYER_WIDTH;
        const y0 = st.player.y;
        const y1 = st.player.y + PLAYER_HEIGHT;
        return boxes.some((q) => x1 > q.c0 * T && x0 < (q.c1 + 1) * T && y1 > q.r0 * T && y0 < (q.r1 + 1) * T);
      };
      const e = elanEntry(m);
      const lostBase = lostExit(m);
      const found = beamSolve(m.level, {
        start: e.state,
        goal: canonicalExit(m),
        lost: (st) => lostBase(st) || inBox(st),
        beam: job.beam,
        chunk: 4,
        changePenalty: 128,
        maxTicks: fast + costMin,
        pressMin: PRESS_MIN,
        releaseMin: RELEASE_MIN,
      });
      if (found) {
        const core = [...new Array<number>(e.ticks).fill(INPUT_RIGHT), ...found];
        // Le détour trouvé est le plus rapide, souvent au pas près : on le durcit (comme le solveur, en lui permettant d'attendre jusqu'au coût
        // minimal) tant qu'il évite toujours les boîtes, pour savoir si un humain peut le prendre.
        const avoids = (full: readonly number[]) => {
          let st = start;
          for (const bits of full) {
            st = stepAttempt(st, bits, m.level, DEFAULT_JUMP_PARAMS);
            if (inBox(st)) return false;
            if (canonicalExit(m)(st)) return true;
          }
          return true;
        };
        let full = fromCore(m, "elan", core);
        try {
          const h = harden(m, "elan", core, 8, e.ticks + fast + costMin - 1);
          if (avoids(h.full)) full = h;
        } catch {
          // le durcissement n'a rien donné : on garde le détour tel quel
        }
        if (full) {
          const span = moduleSpan(m, "elan", full.full);
          const margins = measureMargins(m, "elan", full.full);
          if (typeof span !== "string" && span.exitTick - span.entryTick < fast + costMin) {
            detour = { ticks: span.exitTick - span.entryTick, note: exigenceOf(margins.gigue, null), code: encodeReplay(attemptReplay(m.levelId, full.full, 0, 1)) };
          }
        }
      }
    }
    // Une voie parasite est un détour qu'un humain peut prendre (note ≥ 1) ; un détour au pas près (note 0) est signalé, pas fermé.
    const verdict = detour === null ? "sans-detour" : detour.note >= 1 ? "fermee" : "injouable";
    return { job, result: { grid: m.hash, fast, costMin, precise, boxes, detour, verdict }, ms: performance.now() - t0 };
  } catch (e) {
    return { job, result: null, ms: performance.now() - t0, error: e instanceof Error ? e.message : String(e) };
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
  const beam = Number(args.get("--beam") ?? 600);
  const only = args.get("--only")?.split(",") ?? null;
  const jobs: Job[] = [];
  for (const { text, def } of readModules()) {
    if (only && !only.includes(def.id)) continue;
    def.variants.forEach((_, v) => {
      const s = moduleSolutions(def.id, v);
      if (variantExigence(s) < SLOW_MIN_EXIGENCE || PHASE_REFUSED[def.id]?.includes(v)) return;
      jobs.push({ id: def.id, text, variant: v, beam });
    });
  }
  console.log(`${jobs.length} variantes notées ${SLOW_MIN_EXIGENCE} ou 5 à examiner.`);
  const results: JobResult[] = [];
  const workers = Math.max(1, Math.min(Number(args.get("--workers") ?? availableParallelism()), jobs.length));
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
          const v = r.result;
          const tag = `${r.job.id} v${r.job.variant}`.padEnd(26);
          console.log(`${tag} ${v ? `rapide ${(v.fast / 120).toFixed(2)} s · ${v.precise.length} geste(s) précis · ${v.detour ? `DÉTOUR ${(v.detour.ticks / 120).toFixed(2)} s (note ${v.detour.note}) : ${v.verdict === "fermee" ? "fermée" : "injouable, gardée"}` : "aucun détour sous le coût minimal"}` : `ERREUR ${r.error}`} · ${(r.ms / 1000).toFixed(1)} s`);
          next();
        });
        w.on("error", fail);
        next();
      });
    }),
  );
  results.sort((a, b) => (a.job.id < b.job.id ? -1 : a.job.id > b.job.id ? 1 : a.job.variant - b.job.variant));
  const modules: Record<string, Record<string, VariantVoies>> = {};
  for (const r of results) if (r.result) (modules[r.job.id] ??= {})[String(r.job.variant)] = r.result;
  const closed: Record<string, number[]> = {};
  for (const [id, vs] of Object.entries(modules)) {
    const ko = Object.entries(vs).filter(([, v]) => v.verdict === "fermee").map(([k]) => Number(k));
    if (ko.length > 0) closed[id] = ko;
  }
  const dir = packageDir();
  writeFileSync(join(dir, "modules", "voies.json"), JSON.stringify({ rule: VOIES_RULE_VERSION, catalog: textHash(JSON.stringify(Object.keys(modules))), modules }, null, 1) + "\n");
  writeFileSync(
    join(dir, "src", "parasites.ts"),
    [
      "// Généré par `npm run voies:modules -w @cdj/jump-sim` (lot 16) à partir de `modules/voies.json` : ne pas modifier à la main.",
      "// Variantes fermées : une voie parasite (un détour qui contourne le passage dur pour moins que le coût minimal d'une voie lente) ; le",
      "// générateur v4 (g11) ne les pose plus. Détail : `modules/voies.json`, `docs/jump/lots/lot-16-seconde-voie.md`.",
      "",
      `export const PARASITE_CLOSED: Readonly<Record<string, readonly number[]>> = ${JSON.stringify(closed)};`,
      "",
    ].join("\n"),
  );
  const errors = results.filter((r) => !r.result);
  console.log(`\nTemps : ${((performance.now() - t0) / 1000).toFixed(1)} s (${workers} fils). Fermées : ${JSON.stringify(closed)}${errors.length ? ` ; erreurs : ${errors.map((r) => `${r.job.id} v${r.job.variant}`).join(", ")}` : ""}`);
  console.log("Écrit : modules/voies.json, src/parasites.ts");
}
