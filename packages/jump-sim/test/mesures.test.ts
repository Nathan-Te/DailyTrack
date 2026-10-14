import { Rng } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  ATTEMPT_DEAD,
  ATTEMPT_READY,
  ESSAI_LEVEL,
  INPUT_MASK,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  RESPAWN_TICKS,
  SANDBOX_LEVEL,
  SANDBOX_MARKS,
  initialAttempt,
  initialPlayer,
  parseLevel,
  stepAttempt,
  stepPlayer,
  type Level,
  type PlayerState,
} from "../src/index";
import { J, P, R, T, climbChimney, floatAt, hold, room, standAt } from "./helpers";

// Mesures du personnage, tirées de la simulation (README du lot 1). Les grandeurs physiques sont vérifiées ici à chaque `npm test` ;
// `MESURES=1 npx vitest run packages/jump-sim/test/mesures.test.ts` les affiche, avec le coût moyen d'un `stepPlayer`.

const S = (ticks: number) => ticks / 120;
const lines: string[] = [];
const note = (label: string, value: string) => lines.push(`| ${label} | ${value} |`);

function arc(lv: Level, s: PlayerState, input: (t: number) => number) {
  const y0 = s.y;
  const x0 = s.x;
  let top = s.y;
  let apex = 0;
  let t = 0;
  for (; t < 600; t++) {
    s = stepPlayer(s, input(t), lv, P);
    if (s.y < top) {
      top = s.y;
      apex = t + 1;
    }
    if (t > 0 && s.ground) break;
  }
  return { height: (y0 - top) / T, apex, air: t + 1, dist: (s.x - x0) / T };
}

describe("mesures", () => {
  const flat = room(120, 14);

  it("course, sauts et distances", () => {
    let s = standAt(flat, 2, 13);
    let t = 0;
    while (s.vx < P.runSpeed) {
      s = stepPlayer(s, R, flat, P);
      t++;
    }
    note("vitesse de course", `${((P.runSpeed * 120) / T).toFixed(1)} tuiles/s, atteinte en ${t} pas (${S(t).toFixed(3)} s)`);
    let stop = 0;
    while (s.vx !== 0) {
      s = stepPlayer(s, 0, flat, P);
      stop++;
    }
    note("arrêt depuis la pleine vitesse", `${stop} pas (${S(stop).toFixed(3)} s)`);

    const full = arc(flat, standAt(flat, 2, 13), () => J);
    const short = arc(flat, standAt(flat, 2, 13), (k) => (k === 0 ? J : 0));
    note("saut complet", `${full.height.toFixed(2)} tuiles, montée ${full.apex} pas (${S(full.apex).toFixed(3)} s), en l'air ${S(full.air).toFixed(3)} s`);
    note("saut court (appui d'un pas)", `${short.height.toFixed(2)} tuiles, montée ${short.apex} pas (${S(short.apex).toFixed(3)} s), en l'air ${S(short.air).toFixed(3)} s`);
    expect(full.height).toBeGreaterThan(3.9);
    expect(full.height).toBeLessThan(4.5);
    expect(short.height).toBeLessThan(1.3);

    const still = arc(flat, standAt(flat, 2, 13), () => R | J);
    const running = hold(standAt(flat, 2, 13), R, 60, flat);
    const run = arc(flat, running, () => R | J);
    note("distance du saut complet à l'arrêt (droite tenue)", `${still.dist.toFixed(2)} tuiles`);
    note("distance du saut complet à pleine vitesse", `${run.dist.toFixed(2)} tuiles`);
    expect(run.dist).toBeGreaterThan(still.dist);
  });

  it("saut mural et cheminées", () => {
    const tall = room(12, 30);
    let s = hold(floatAt(tall, 13 * T - PLAYER_WIDTH, 6 * T), R, 30, tall);
    const wall = arc(tall, s, () => J);
    note("saut mural (depuis la glisse, bouton tenu)", `${wall.height.toFixed(2)} tuiles de haut`);
    expect(wall.height).toBeGreaterThan(2.7);
    expect(wall.height).toBeLessThan(3.5);
    s = hold(floatAt(tall, 13 * T - PLAYER_WIDTH, 6 * T), R, 200, tall);
    note("glisse murale", `${((s.vy * 120) / T).toFixed(1)} tuiles/s ; chute libre max ${((P.fallSpeed * 120) / T).toFixed(1)} tuiles/s`);

    for (const [col, w] of SANDBOX_MARKS.chimneys) {
      const from = standAt(SANDBOX_LEVEL, col + (w === 3 ? 1 : 0), SANDBOX_MARKS.floorRow);
      const climb = climbChimney(SANDBOX_LEVEL, from, 1, SANDBOX_MARKS.chimneyTopRow * T, 900);
      const height = SANDBOX_MARKS.floorRow + 1 - SANDBOX_MARKS.chimneyTopRow;
      note(`cheminée de ${w} (${height} tuiles, du sol au sommet)`, `${climb.reachedAt} pas (${S(climb.reachedAt).toFixed(2)} s)`);
      expect(climb.reachedAt).toBeGreaterThan(0);
    }
    expect(PLAYER_HEIGHT).toBeLessThan(T);
  });

  it("ressort, réapparition (lot 2)", () => {
    const shaft = parseLevel(["#.....F#", ...Array(14).fill("#......#"), "#S.....#", "###*####"].join("\n"));
    let s = initialAttempt(shaft);
    let launchY = -1;
    let top = Infinity;
    for (let t = 0; t < 400; t++) {
      s = stepAttempt(s, t < 20 ? R : 0, shaft, P);
      if (launchY < 0 && s.player.vy === -P.springSpeed) launchY = s.player.y;
      if (launchY >= 0) top = Math.min(top, s.player.y);
      if (launchY >= 0 && s.player.vy > 0) break;
    }
    const height = (launchY - top) / T;
    note("hauteur du ressort (sans rien tenir)", `${height.toFixed(2)} tuiles (lancement ${((P.springSpeed * 120) / T).toFixed(1)} tuiles/s)`);
    expect(height).toBeGreaterThan(6.8);
    expect(height).toBeLessThan(7.3);

    // De la mort au nouvel essai : `RESPAWN_TICKS` pas.
    const pit = parseLevel(["#......F#", "#S......#", "##.######"].join("\n"));
    let d = initialAttempt(pit);
    let k = 0;
    while (d.status !== ATTEMPT_DEAD && k < 300) (d = stepAttempt(d, R, pit, P)), k++;
    let wait = 0;
    while (d.status !== ATTEMPT_READY && wait < 100) (d = stepAttempt(d, R, pit, P)), wait++;
    note("de la mort au nouvel essai", `${wait} pas (${S(wait).toFixed(3)} s), commandes ignorées pendant ce temps`);
    expect(wait).toBe(RESPAWN_TICKS);
    expect(S(wait)).toBeLessThanOrEqual(0.2);
  });

  it("coût d'un pas d'essai sur le niveau d'essai (affiché avec MESURES=1)", () => {
    // Commandes tenues un temps au hasard (comme un joueur) : le personnage avance, meurt, recommence.
    const rng = new Rng(4);
    const inputs: number[] = [];
    while (inputs.length < 4096) {
      const input = rng.chance(2) ? R | (rng.chance(2) ? J : 0) : rng.int(INPUT_MASK + 1);
      for (let n = 1 + rng.int(40); n > 0 && inputs.length < 4096; n--) inputs.push(input);
    }
    const steps = process.env.MESURES ? 2_000_000 : 20_000;
    let s = initialAttempt(ESSAI_LEVEL);
    let deaths = 0;
    const t0 = performance.now();
    for (let i = 0; i < steps; i++) {
      const before = s.status;
      s = stepAttempt(s, inputs[i & 4095]!, ESSAI_LEVEL, P);
      if (s.status === ATTEMPT_DEAD && before !== ATTEMPT_DEAD) deaths++;
    }
    const ns = ((performance.now() - t0) * 1e6) / steps;
    note("coût moyen d'un `stepAttempt` (commandes au hasard, niveau d'essai)", `${ns.toFixed(0)} ns (${deaths} morts sur ${steps.toLocaleString("fr-FR")} pas)`);
    expect(deaths).toBeGreaterThan(0);
  });

  it("coût d'un pas (affiché avec MESURES=1)", () => {
    const rng = new Rng(3);
    const inputs = Array.from({ length: 4096 }, () => rng.int(INPUT_MASK + 1));
    const steps = process.env.MESURES ? 2_000_000 : 20_000;
    let s = initialPlayer(SANDBOX_LEVEL);
    const t0 = performance.now();
    for (let i = 0; i < steps; i++) {
      s = stepPlayer(s, inputs[i & 4095]!, SANDBOX_LEVEL, P);
      if ((i & 4095) === 4095) s = initialPlayer(SANDBOX_LEVEL);
    }
    const ns = ((performance.now() - t0) * 1e6) / steps;
    note("coût moyen d'un `stepPlayer` (commandes au hasard, bac à sable)", `${ns.toFixed(0)} ns (Node ${process.version}, ${steps.toLocaleString("fr-FR")} pas)`);
    expect(s.x).toBeGreaterThan(0);
    if (process.env.MESURES) console.log(["| Mesure | Valeur |", "|---|---|", ...lines].join("\n"));
  });
});
