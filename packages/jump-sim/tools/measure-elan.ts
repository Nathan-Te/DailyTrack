import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  INPUT_RIGHT,
  MODULES,
  PLAYER_WIDTH,
  SANDBOX_LEVEL,
  SANDBOX_MARKS,
  SPRINT_TRIAL_PARAMS,
  TICK_RATE,
  UNITS_PER_TILE,
  buildModule,
  centerCol,
  dailyLevel,
  decodeReplay,
  fromRuns,
  initialPlayer,
  moduleStart,
  parseLevel,
  replayStartState,
  stepAttempt,
  stepPlayer,
  type AttemptState,
  type JumpParams,
  type Level,
  type PlayerState,
} from "../src/index";
import { MODULE_SOLUTIONS } from "../src/modules";
import { parseDay } from "@cdj/core";

// `npm run measure:elan -w @cdj/jump-sim` — lot 8b : ce que changerait l'essai d'élan progressif (valeurs de départ `SPRINT_TRIAL_PARAMS`),
// sans rien modifier : temps gagné sur la plus longue ligne droite du bac à sable et sur du plat, portée d'un saut, solutions stockées des
// morceaux rejouées avec l'élan (identiques, plus rapides, cassées), preuves de quelques niveaux du jour rejouées avec l'élan.

const ELAN: Readonly<JumpParams> = { ...DEFAULT_JUMP_PARAMS, ...SPRINT_TRIAL_PARAMS };
const T = UNITS_PER_TILE;
const sec = (t: number) => (t / TICK_RATE).toFixed(3).replace(".", ",");
const num = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
const R = INPUT_RIGHT;
const J = INPUT_JUMP;

/** Pas pour que le bord droit de la boîte atteigne `col` (tuiles), droite tenue depuis `s`. */
function ticksTo(lv: Level, s: PlayerState, col: number, p: Readonly<JumpParams>): number {
  for (let t = 1; t < 5000; t++) {
    s = stepPlayer(s, R, lv, p);
    if (s.x + PLAYER_WIDTH >= col * T) return t;
  }
  return -1;
}

const out: string[] = [];
const line = (s = "") => out.push(s);

// ——— 1. La plus longue ligne droite du bac à sable : la piste d'élan, du départ (colonne 3) à la première marche (colonne 33) ———
{
  const start = initialPlayer(SANDBOX_LEVEL);
  const to = SANDBOX_MARKS.steps[0][0];
  const a = ticksTo(SANDBOX_LEVEL, start, to, DEFAULT_JUMP_PARAMS);
  const b = ticksTo(SANDBOX_LEVEL, start, to, ELAN);
  line("## Bac à sable : piste d'élan (départ → première marche, 30 tuiles), droite tenue depuis l'arrêt");
  line();
  line("| | sans élan | avec l'élan | gagné |");
  line("|---|---|---|---|");
  line(`| temps | ${sec(a)} s | ${sec(b)} s | ${sec(a - b)} s (${num((100 * (a - b)) / a)} %) |`);
  line();
}

// ——— 2. Du plat, depuis l'arrêt : 10, 20, 40, 80 tuiles ———
{
  // Une longue salle haute (12 rangées libres : aucun saut ne touche le plafond).
  const hall = parseLevel([...new Array<string>(11).fill("#" + ".".repeat(200) + "#"), "#S" + ".".repeat(198) + "F#", "#".repeat(202)].join("\n"));
  const start = initialPlayer(hall);
  line("## Plat, depuis l'arrêt, droite tenue");
  line();
  line("| distance | sans élan | avec l'élan | gagné |");
  line("|---|---|---|---|");
  for (const d of [10, 20, 40, 80, 160]) {
    const a = ticksTo(hall, start, 2 + d, DEFAULT_JUMP_PARAMS);
    const b = ticksTo(hall, start, 2 + d, ELAN);
    line(`| ${d} tuiles | ${sec(a)} s | ${sec(b)} s | ${sec(a - b)} s (${num((100 * (a - b)) / a)} %) |`);
  }
  line();
  // Portée d'un saut complet et d'un saut court, sur du plat, lancé à la course et en élan.
  const reach = (vx: number, hold: number) => {
    let s: PlayerState = { ...start, x: 10 * T, vx, ...(vx > DEFAULT_JUMP_PARAMS.runSpeed ? { sprint: 255 } : {}) };
    const x0 = s.x;
    s = stepPlayer(s, R | J, hall, ELAN);
    for (let t = 1; t < 600 && s.ground === 0; t++) s = stepPlayer(s, t < hold ? R | J : R, hall, ELAN);
    return (s.x - x0) / T;
  };
  line("## Portée d'un saut sur du plat (du décollage au retour au sol)");
  line();
  line("| saut | à la course (11 tuiles/s) | en élan (15 tuiles/s) |");
  line("|---|---|---|");
  line(`| complet (tenu) | ${num(reach(DEFAULT_JUMP_PARAMS.runSpeed, 999))} tuiles | ${num(reach(512, 999))} tuiles |`);
  line(`| court (relâché au 6e pas) | ${num(reach(DEFAULT_JUMP_PARAMS.runSpeed, 6))} tuiles | ${num(reach(512, 6))} tuiles |`);
  line();
}

// ——— 3. Les solutions stockées des morceaux, rejouées avec l'élan (entrée « élan », compteur d'élan à 0 au départ) ———
interface Row {
  id: string;
  v: number;
  /** Plus longue course au sol à pleine vitesse, droite tenue, dans la solution stockée (pas). */
  run: number;
  base: number;
  elan: number | null;
  verdict: "identique" | "plus rapide" | "plus lente" | "cassée";
  why: string;
}
const rows: Row[] = [];
for (const def of MODULES) {
  for (let v = 0; v < def.variants.length; v++) {
    const sol = MODULE_SOLUTIONS.modules[def.id]?.variants[v]?.elan;
    if (!sol) continue;
    const m = buildModule(def.id, v);
    const inputs = fromRuns(decodeReplay(sol.code).runs);
    // La plus longue course à pleine vitesse au sol (droite tenue) de la solution, sans élan.
    let s: AttemptState = moduleStart(m, "elan");
    let run = 0;
    let best = 0;
    for (const bits of inputs) {
      const before = s;
      s = stepAttempt(s, bits, m.level, DEFAULT_JUMP_PARAMS);
      const full = before.player.ground === 1 && s.player.ground === 1 && bits === R && s.player.vx === DEFAULT_JUMP_PARAMS.runSpeed;
      run = full ? run + 1 : 0;
      best = Math.max(best, run);
    }
    // Rejouée avec l'élan : la sortie (le centre passe le bord droit du palier de sortie), vivant.
    let e: AttemptState = moduleStart(m, "elan");
    let exit = -1;
    let why = "";
    for (let t = 0; t < inputs.length; t++) {
      e = stepAttempt(e, inputs[t]!, m.level, ELAN);
      if (e.status === ATTEMPT_DEAD) {
        why = `mort au pas ${t + 1}`;
        break;
      }
      if (exit < 0 && centerCol(e.player) >= m.exitCol) exit = t + 1;
      if (e.status === ATTEMPT_FINISHED) break;
    }
    if (exit < 0 && !why) why = "n'arrive pas à la sortie";
    const verdict = why ? "cassée" : exit === sol.exitTick ? "identique" : exit < sol.exitTick ? "plus rapide" : "plus lente";
    rows.push({ id: def.id, v, run: best, base: sol.exitTick - sol.entryTick, elan: why ? null : exit - sol.entryTick, verdict, why });
  }
}
{
  const count = (k: Row["verdict"]) => rows.filter((r) => r.verdict === k).length;
  line(`## Solutions stockées des morceaux (entrée élan), rejouées avec l'élan : ${rows.length} variantes`);
  line();
  line(`identiques ${count("identique")} · plus rapides ${count("plus rapide")} · plus lentes ${count("plus lente")} · cassées ${count("cassée")}`);
  line();
  line(
    `L'élan démarre après ${SPRINT_TRIAL_PARAMS.sprintDelay} pas au sol à pleine vitesse, **cumulés d'un saut à l'autre** tant que la direction reste tenue (sauter ne coupe pas l'élan) : la plupart des solutions le voient, même sans longue course continue.`,
  );
  line();
  line("| morceau | v | plus longue course continue à pleine vitesse | entrée → sortie sans élan | avec l'élan | verdict |");
  line("|---|---|---|---|---|---|");
  for (const r of rows.filter((x) => x.verdict !== "identique").sort((a, b) => b.run - a.run)) {
    line(`| ${r.id} | ${r.v} | ${sec(r.run)} s | ${sec(r.base)} s | ${r.elan === null ? "—" : `${sec(r.elan)} s`} | ${r.verdict}${r.why ? ` (${r.why})` : ""} |`);
  }
  line();
  // Les trois morceaux qui courent le plus longtemps droite tenue.
  line("### Les trois morceaux aux plus longues courses droite tenue (variante 0, entrée élan)");
  line();
  line("| morceau | plus longue course continue | sans élan | avec l'élan | gagné |");
  line("|---|---|---|---|---|");
  for (const r of rows.filter((x) => x.v === 0).sort((a, b) => b.run - a.run).slice(0, 3)) {
    line(`| ${r.id} | ${sec(r.run)} s | ${sec(r.base)} s | ${r.elan === null ? `— (${r.why})` : `${sec(r.elan)} s`} | ${r.elan === null ? "—" : `${sec(r.base - r.elan)} s`} |`);
  }
  line();
  // Familles et étiquettes des morceaux qui changent.
  const changed = new Set(rows.filter((r) => r.verdict !== "identique").map((r) => r.id));
  line(`Morceaux touchés (au moins une variante qui change) : ${[...changed].sort().join(", ") || "aucun"}.`);
  line(`Morceaux « elan: oui » (l'élan est le défi) : ${MODULES.filter((d) => d.elan).map((d) => d.id).join(", ") || "aucun"}.`);
  line();
}

// ——— 4. Les preuves de quelques niveaux du jour, rejouées avec l'élan ———
{
  line("## Preuves de l'auteur de six niveaux du jour, rejouées avec l'élan");
  line();
  line("| date | auteur | avec l'élan |");
  line("|---|---|---|");
  for (const date of ["2026-10-16", "2026-10-20", "2026-11-01", "2026-11-15", "2026-12-01", "2027-01-01"]) {
    const day = dailyLevel(parseDay(date)!);
    const replay = day.replay;
    let s = replayStartState(day.level, replay.start);
    let res = "n'arrive pas";
    let deaths = 0;
    for (const bits of fromRuns(replay.runs)) {
      const before = s.status;
      s = stepAttempt(s, bits, day.level, ELAN);
      if (s.status === ATTEMPT_DEAD && before !== ATTEMPT_DEAD) deaths++;
      if (s.status === ATTEMPT_FINISHED) {
        res = `arrivée en ${sec(s.time)} s`;
        break;
      }
    }
    line(`| ${date} | ${sec(day.authorTicks)} s | ${res}${deaths ? ` · ${deaths} mort(s)` : ""} |`);
  }
  line();
}

console.log(out.join("\n"));
