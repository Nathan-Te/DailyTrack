import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  ATTEMPT_RUNNING,
  COUNTER_CAP,
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  INPUT_LEFT,
  INPUT_RIGHT,
  MODULES,
  NO_SPRINT_PARAMS,
  PLAYER_WIDTH,
  PREMIER_JOUR_JUMP,
  TICK_RATE,
  UNITS_PER_TILE,
  buildModule,
  centerCol,
  dailyLevel,
  initialAttempt,
  initialPlayer,
  moduleStart,
  parseLevel,
  sprintTop,
  stepAttempt,
  stepPlayer,
  type AttemptState,
  type BuiltModule,
  type JumpParams,
  type Level,
  type PlayerState,
} from "../src/index";
import { beamSolve } from "./beam";
import { packageDir } from "./files";

// `npm run measure:elan -w @cdj/jump-sim` — lot 8c : ce que l'élan change, pour la calibration des médailles (rien n'est modifié).
//   1. Du plat et la portée d'un saut, avec et sans élan (`NO_SPRINT_PARAMS`).
//   2. **Le temps de l'auteur avec et sans élan, sur les mêmes niveaux** (120 dates) : pour chaque morceau et variante, une solution
//      **sans élan** (la plus rapide du faisceau, entrées arrêt et course, sortie dans la « course propre » du lot 6 : au sol, à `runSpeed`,
//      rien en cours) ; puis, pour chaque date, ces solutions mises bout à bout **sur le niveau assemblé du jour** et rejouées sans élan
//      (raccord exact du lot 6). Le temps rejoué est le « temps de l'auteur sans élan » du même niveau. Les solutions sans élan ne sont pas
//      durcies (la plus rapide) : l'écart est donc un peu sous-estimé (le durcissement coûte au plus 2 %).
//   Les solutions sans élan sont gardées dans `dist/sans-elan.json` (empreinte de la grille), pas dans le dépôt.

const T = UNITS_PER_TILE;
const OFF = NO_SPRINT_PARAMS;
const P = DEFAULT_JUMP_PARAMS;
const R = INPUT_RIGHT;
const J = INPUT_JUMP;
const sec = (t: number) => (t / TICK_RATE).toFixed(2).replace(".", ",");
const num = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
const stats = (xs: number[]) => ({ min: Math.min(...xs), mean: xs.reduce((a, b) => a + b, 0) / xs.length, max: Math.max(...xs) });

/** La course propre du lot 6, sans élan : au sol, à `runSpeed`, rien en cours. */
function oldClean(p: Readonly<PlayerState>): boolean {
  return p.ground === 1 && p.vx === P.runSpeed && p.vy === 0 && p.air === 0 && p.wallSide === 0 && p.wallAir === COUNTER_CAP && p.slide === 0 && p.buffer === 0 && p.held === 0 && p.jumping === 0 && p.lock === 0;
}

type Entry = "arret" | "course";
interface Plain {
  /** Commandes depuis le départ du morceau seul (lancé : droite tenue jusqu'au bord), jusqu'à la sortie. */
  inputs: number[];
  entryTick: number;
}

/** Une solution sans élan d'un morceau (la plus rapide du faisceau), ou null. */
function solvePlain(m: BuiltModule, entry: Entry): Plain | null {
  let start = moduleStart(m, entry);
  const prefix: number[] = [];
  if (entry === "course") {
    for (let t = 0; t < 64 && centerCol(start.player) < m.lead; t++) {
      start = stepAttempt(start, R, m.level, OFF);
      prefix.push(R);
    }
  }
  const goal = (s: AttemptState) => s.status === ATTEMPT_RUNNING && centerCol(s.player) >= m.exitCol && oldClean(s.player);
  const lost = (s: AttemptState) => (centerCol(s.player) >= m.exitCol && !oldClean(s.player)) || centerCol(s.player) < m.palierIn.col0;
  const f = beamSolve(m.level, { start, goal, lost, beam: 600, chunk: 4, changePenalty: 128, maxTicks: 1320, params: OFF });
  if (!f) return null;
  let idle = 0;
  if (entry === "arret") while (idle < f.length && (f[idle]! & (INPUT_LEFT | INPUT_RIGHT | INPUT_JUMP)) === 0) idle++;
  return { inputs: [...prefix, ...f.slice(idle)], entryTick: prefix.length };
}

interface Job {
  id: string;
  variant: number;
}
interface JobOut {
  key: string;
  hash: string;
  arret: Plain | null;
  course: Plain | null;
}

if (!isMainThread) {
  parentPort!.on("message", (job: Job | null) => {
    if (job === null) process.exit(0);
    const m = buildModule(job.id, job.variant);
    const out: JobOut = { key: `${job.id}:${job.variant}`, hash: m.hash, arret: solvePlain(m, "arret"), course: solvePlain(m, "course") };
    parentPort!.postMessage(out);
  });
} else {
  await main();
}

/** Pas pour que le bord droit de la boîte atteigne `col` (tuiles), droite tenue depuis `s`. */
function ticksTo(lv: Level, s: PlayerState, col: number, p: Readonly<JumpParams>): number {
  for (let t = 1; t < 5000; t++) {
    s = stepPlayer(s, R, lv, p);
    if (s.x + PLAYER_WIDTH >= col * T) return t;
  }
  return -1;
}

async function main(): Promise<void> {
  const out: string[] = [];
  const line = (s = "") => out.push(s);

  // ——— 1. Plat et portée ———
  const hall = parseLevel([...new Array<string>(11).fill("#" + ".".repeat(200) + "#"), "#S" + ".".repeat(198) + "F#", "#".repeat(202)].join("\n"));
  const start = initialPlayer(hall);
  line("## Plat, depuis l'arrêt, droite tenue");
  line();
  line("| distance | sans élan | avec l'élan | gagné |");
  line("|---|---|---|---|");
  for (const d of [10, 20, 40, 80]) {
    const a = ticksTo(hall, start, 2 + d, OFF);
    const b = ticksTo(hall, start, 2 + d, P);
    line(`| ${d} tuiles | ${sec(a)} s | ${sec(b)} s | ${sec(a - b)} s (${num((100 * (a - b)) / a)} %) |`);
  }
  // Distance pour prendre l'élan plein : depuis l'arrêt, et depuis la course (compteur à 1, l'état canonique « course »).
  const toFull = (s: PlayerState) => {
    const x0 = s.x;
    for (let t = 0; t < 600; t++) {
      s = stepPlayer(s, R, hall, P);
      if (s.vx === sprintTop(P) && s.sprint === P.sprintDelay) return { ticks: t + 1, tiles: (s.x - x0) / T };
    }
    return { ticks: -1, tiles: -1 };
  };
  const fromStop = toFull({ ...start });
  const fromRun = toFull({ ...start, vx: P.runSpeed, sprint: 1 });
  line();
  line(`Élan plein (${num((sprintTop(P) * TICK_RATE) / T)} tuiles/s) : depuis l'arrêt en ${sec(fromStop.ticks)} s sur ${num(fromStop.tiles)} tuiles ; depuis la course en ${sec(fromRun.ticks)} s sur ${num(fromRun.tiles)} tuiles.`);
  const reach = (s0: PlayerState, hold: number, p: Readonly<JumpParams>) => {
    let s: PlayerState = { ...s0, x: 10 * T };
    const x0 = s.x;
    s = stepPlayer(s, R | J, hall, p);
    for (let t = 1; t < 600 && s.ground === 0; t++) s = stepPlayer(s, t < hold ? R | J : R, hall, p);
    return (s.x - x0) / T;
  };
  line();
  line("| saut sur du plat (du décollage au retour au sol) | à la course | en élan plein |");
  line("|---|---|---|");
  for (const [name, hold] of [["complet (tenu)", 999], ["court (relâché au 6e pas)", 6]] as const) {
    line(`| ${name} | ${num(reach({ ...start, vx: P.runSpeed }, hold, OFF))} tuiles | ${num(reach({ ...start, vx: sprintTop(P), sprint: P.sprintDelay }, hold, P))} tuiles |`);
  }
  line();

  // ——— 2. Solutions sans élan (cache) ———
  const cacheFile = join(packageDir(), "dist", "sans-elan.json");
  const cache: Record<string, JobOut> = existsSync(cacheFile) ? (JSON.parse(readFileSync(cacheFile, "utf8")) as Record<string, JobOut>) : {};
  const jobs: Job[] = [];
  for (const def of MODULES) {
    def.variants.forEach((_, v) => {
      const hit = cache[`${def.id}:${v}`];
      if (!hit || hit.hash !== buildModule(def.id, v).hash) jobs.push({ id: def.id, variant: v });
    });
  }
  const t0 = performance.now();
  if (jobs.length > 0) {
    const queue = [...jobs];
    const n = Math.max(1, Math.min(availableParallelism(), jobs.length));
    await Promise.all(
      Array.from({ length: n }, () => {
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
          w.on("message", (r: JobOut) => {
            cache[r.key] = r;
            next();
          });
          w.on("error", fail);
          next();
        });
      }),
    );
    mkdirSync(join(packageDir(), "dist"), { recursive: true });
    writeFileSync(cacheFile, JSON.stringify(cache));
  }
  const solveS = (performance.now() - t0) / 1000;

  // ——— 3. Le niveau du jour, avec et sans élan ———
  // Chaque niveau a au moins un morceau « elan » (quota), infaisable sans élan par construction : le niveau entier ne se rejoue donc pas
  // sans élan. On compare **morceau par morceau** : pour chaque morceau qui se fait sans élan, la durée de sa solution sans élan (entrée
  // arrêt pour le premier, course sinon, raccord exact du lot 6) contre la durée qu'il prend dans la preuve de l'auteur (avec l'élan,
  // `end − start`). Temps « sans élan » estimé d'un niveau = somme des durées sans élan + durée avec élan des morceaux « elan ».
  const DAYS = 120;
  const rows: { date: string; elan: number; plain: number; partElan: number; partPlain: number; missing: number }[] = [];
  for (let k = 0; k < DAYS; k++) {
    const L = dailyLevel(PREMIER_JOUR_JUMP + k);
    let plain = 0;
    let partElan = 0;
    let partPlain = 0;
    let missing = 0;
    L.pieces.forEach((p, i) => {
      const sol = cache[`${p.id}:${p.variant}`]?.[i === 0 ? "arret" : "course"];
      const withElan = p.end - p.start;
      if (!sol) {
        missing++;
        plain += withElan;
        return;
      }
      const d = sol.inputs.length - sol.entryTick;
      plain += d;
      partPlain += d;
      partElan += withElan;
    });
    rows.push({ date: L.date, elan: L.authorTicks, plain, partElan, partPlain, missing });
  }
  const gaps = rows.map((r) => r.plain - r.elan);
  const ratio = rows.map((r) => (r.partPlain - r.partElan) / r.partPlain);
  const noPlain = MODULES.filter((d) => d.variants.some((_, v) => !cache[`${d.id}:${v}`]?.arret || !cache[`${d.id}:${v}`]?.course)).map((d) => d.id);
  line(`## Temps de l'auteur avec et sans élan, sur les mêmes niveaux (${DAYS} dates)`);
  line();
  line(`Morceaux sans solution sans élan (au moins une variante) : ${noPlain.join(", ") || "aucun"} — par construction, les morceaux « elan » ; ils comptent pour leur durée avec l'élan dans l'estimation sans élan. Morceaux ainsi comptés par niveau : ${num(stats(rows.map((r) => r.missing)).mean, 2)} en moyenne.`);
  line();
  line("| mesure | min | moyenne | max |");
  line("|---|---|---|---|");
  line(`| temps de l'auteur avec l'élan (preuve rejouée) | ${sec(stats(rows.map((r) => r.elan)).min)} s | ${sec(stats(rows.map((r) => r.elan)).mean)} s | ${sec(stats(rows.map((r) => r.elan)).max)} s |`);
  line(`| sans élan, estimé (mêmes morceaux) | ${sec(stats(rows.map((r) => r.plain)).min)} s | ${sec(stats(rows.map((r) => r.plain)).mean)} s | ${sec(stats(rows.map((r) => r.plain)).max)} s |`);
  line(`| écart (sans − avec) | ${sec(stats(gaps).min)} s | ${sec(stats(gaps).mean)} s | ${sec(stats(gaps).max)} s |`);
  line(`| écart sur les morceaux faisables sans élan, en % de leur temps sans élan | ${num(100 * stats(ratio).min)} % | ${num(100 * stats(ratio).mean)} % | ${num(100 * stats(ratio).max)} % |`);
  line();
  line(`Solutions sans élan : ${jobs.length} variantes cherchées (${num(solveS)} s), ${Object.keys(cache).length - jobs.length} reprises du cache. La solution sans élan est la plus rapide du faisceau, sans durcissement (celle avec l'élan est durcie à 2 % près) : l'écart est un peu sous-estimé.`);
  console.log(out.join("\n"));
}
