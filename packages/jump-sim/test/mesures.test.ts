import { Rng } from "@cdj/core";
import { describe, expect, it } from "vitest";
import { INPUT_MASK, PLAYER_HEIGHT, PLAYER_WIDTH, SANDBOX_LEVEL, SANDBOX_MARKS, initialPlayer, stepPlayer, type Level, type PlayerState } from "../src/index";
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
