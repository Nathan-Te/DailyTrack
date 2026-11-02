import { readFileSync } from "node:fs";
import { parseDay } from "@cdj/core";
import {
  ATTEMPT_RUNNING,
  CHECKPOINT_ZONE_VERSION,
  PREMIER_JOUR_JUMP,
  TILE_SOLID,
  UNITS_PER_TILE,
  cageEntranceCells,
  checkpointAttempt,
  dailyLevel,
  fromRuns,
  initialAttempt,
  leftJointCells,
  passageAccess,
  passageZoneAt,
  reassemble,
  stepAttempt,
  tileOf,
  DEFAULT_JUMP_PARAMS,
  PRESS_MIN,
  RELEASE_MIN,
  centerCol,
  type AttemptState,
  type DailyLevel,
} from "../src/index";
import { beamSolve } from "./beam";
import { useLegacyCatalog } from "../src/legacy";
import { thawLevel } from "../src/frozen";

// `npm run raccourcis:jump -w @cdj/jump-sim` (lot 32) — **les points de passage qu'on atteint sans faire la portion qui les précède** : pour chaque point de passage d'un niveau du jour, une recherche (a) par
// propagation à travers les cases libres (optimiste : `passageAccess`, la règle du générateur) puis (b) par le solveur (faisceau, appuis humains `PRESS_MIN` / `RELEASE_MIN`) qui part du palier d'avant (ou du
// départ), a **fermé le côté gauche du palier** (la fin de la portion) et **l'entrée de la cage de la voie lente** de la portion, et cherche à se poser dans la zone du palier. Ce qu'il trouve est un
// raccourci. `-- --jours=N` (120 par défaut, à partir de `PREMIER_JOUR_JUMP`), `-- --version=13|14` (13 : le générateur g25, « avant » ; 14 : g26), `-- --sans-solveur` (propagation seule),
// `-- --partie=i/n` (une part des dates, pour lancer n processus), `-- --date=AAAA-MM-JJ` (une date).

const opt = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const DAYS = Number(opt("jours") ?? 120);
const VERSION = Number(opt("version") ?? CHECKPOINT_ZONE_VERSION);
const SOLVER = !process.argv.includes("--sans-solveur");
const [part, parts] = (opt("partie") ?? "0/1").split("/").map(Number) as [number, number];
const ONE = opt("date");
const FIGE = opt("fige");
const BEAM = Number(opt("faisceau") ?? 400);
const TICKS = Number(opt("pas") ?? 1200);
if (VERSION < 13 || FIGE) useLegacyCatalog();
const T = UNITS_PER_TILE;

/** Le niveau d'un jour : l'état de la preuve au pas où elle entre sur chaque palier. */
function proofEntries(L: DailyLevel): AttemptState[] {
  const inputs = fromRuns(L.replay.runs);
  const out: AttemptState[] = L.paliers.map(() => undefined as unknown as AttemptState);
  let s = initialAttempt(L.level);
  out[0] = s;
  for (const bits of inputs) {
    s = stepAttempt(s, bits, L.level, DEFAULT_JUMP_PARAMS);
    L.paliers.forEach((p, k) => {
      if (!out[k] && centerCol(s.player) >= p.col0) out[k] = s;
    });
  }
  return out;
}

export interface Found {
  date: string;
  checkpoint: number;
  piece: string;
  /** Plus haut point atteint (rangée) et pieds à l'arrivée dans la zone, pour dire par où on est passé. */
  top: number;
  ticks: number;
}

function analyse(L: DailyLevel): { open: number; found: Found[]; total: number } {
  const asm = reassemble(L);
  const access = passageAccess({ level: L.level, paliers: L.paliers, slow: asm.slow });
  const entries = SOLVER ? proofEntries(L) : [];
  const found: Found[] = [];
  let open = 0;
  for (const a of access) {
    if (!a.open) continue;
    open++;
    if (!SOLVER) continue;
    const k = a.index;
    const route = asm.slow.find((r) => r.piece === k - 1);
    const closed = [...leftJointCells(L.paliers[k]!), ...(route ? cageEntranceCells(route) : [])];
    // Les accès légitimes sont **murés** dans une copie du niveau (la recherche est guidée par le plus court chemin qui reste, pas par la portion) ; l'arrivée de la copie est la zone du palier.
    const zone = L.paliers[k]!;
    const tiles = [...L.level.tiles];
    for (const c of closed) tiles[c.row * L.level.width + c.col] = TILE_SOLID;
    const level = { ...L.level, tiles, finish: { col: zone.col0, row: zone.row - 1 } };
    const start = k === 1 ? initialAttempt(L.level) : entries[k - 1]!;
    let top = 1e9;
    const lost = (s: AttemptState) => {
      const r0 = tileOf(s.player.y);
      if (r0 < top) top = r0;
      return false;
    };
    const goal = (s: AttemptState) => s.status === ATTEMPT_RUNNING && passageZoneAt(L.level, s.player) === k - 1;
    const q0 = performance.now();
    const inputs = beamSolve(level, { start, goal, lost, beam: BEAM, chunk: 4, maxTicks: TICKS, pressMin: PRESS_MIN, releaseMin: RELEASE_MIN });
    if (process.argv.includes("--verbeux")) console.log(`    ${L.date} point ${k} : ${inputs ? "ATTEIGNABLE" : "non"} (${((performance.now() - q0) / 1000).toFixed(1)} s)`);
    if (inputs) found.push({ date: L.date, checkpoint: k, piece: `${L.pieces[k - 1]!.id}:${L.pieces[k - 1]!.variant}`, top, ticks: inputs.length });
  }
  return { open, found, total: access.length };
}

const t0 = performance.now();
let total = 0;
let open = 0;
const found: Found[] = [];
let levels = 0;
const frozen = (date: string): DailyLevel => {
  const d = thawLevel(JSON.parse(readFileSync(`../../apps/jump/public/levels/${date}.json`, "utf8")), parseDay(date)!);
  if (typeof d === "string") throw new Error(`${date} : ${d}`);
  return d;
};
const days = FIGE ? [0] : ONE ? [parseDay(ONE)!] : Array.from({ length: DAYS }, (_, k) => PREMIER_JOUR_JUMP + k).filter((_, k) => k % parts === part);
for (const day of days) {
  const L = FIGE ? frozen(FIGE) : dailyLevel(day, null, VERSION);
  const r = analyse(L);
  total += r.total;
  open += r.open;
  found.push(...r.found);
  levels++;
  for (const f of r.found) console.log(`  ${f.date} point ${f.checkpoint} (${f.piece}) : atteignable en ${f.ticks} pas, point le plus haut : rangée ${f.top}`);
}
console.log(`g${VERSION >= CHECKPOINT_ZONE_VERSION ? 26 : 25} (sim v${VERSION}) — partie ${part + 1}/${parts} : ${levels} niveaux, ${total} points de passage, ${open} reliés par des cases libres${SOLVER ? `, ${found.length} atteignables (solveur)` : ""} — ${((performance.now() - t0) / 1000).toFixed(0)} s`);
