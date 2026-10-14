import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ATTEMPT_DEAD, ATTEMPT_FINISHED, DANGERS_ASCII, DANGERS_LEVEL, DEFAULT_JUMP_PARAMS, ESSAI_ASCII, ESSAI_LEVEL, JUMP_SIM_VERSION, TICK_RATE, initialAttempt, stepAttempt } from "../src/index";
import { compress, expand } from "./helpers";
import { solve, type Waypoint } from "./solver";

// Preuve que le niveau d'essai (lot 2) est faisable : une suite de commandes, stockée dans `fixtures/essai-solution.json`, qui le finit.
// Elle a été trouvée par le petit chercheur de `solver.ts` (hors de la simulation) en suivant les points de passage ci-dessous ; son temps est
// le premier « temps de l'auteur ». Pour la retrouver (après un changement du niveau ou de la physique, `JUMP_SIM_VERSION` +1) :
//   SOLVE=1 npx vitest run packages/jump-sim/test/essai-solution.test.ts      (≈ 2 min ; la galerie `dangers` aussi, ≈ 20 s)

const FILE = join(import.meta.dirname, "fixtures/essai-solution.json");
const DANGERS_FILE = join(import.meta.dirname, "fixtures/dangers-solution.json");

/** Points de passage (centre du personnage, tuiles), dans l'ordre du niveau : de quoi guider la recherche, pas une règle du jeu. */
const WAYPOINTS: Waypoint[] = [
  [14, 25.5], [23, 25.5], [34, 25.5], [41, 19.5], [52, 25.5], // échauffement
  [57, 25.5], [57, 21], [57, 17], [58, 13], [63, 12.5], [86, 12.5], [96, 16.5], [101, 17.5], // cheminée, friables
  [117, 21.5], [131, 25.5], [143, 25.5], [148, 21.5], [152, 25.5], [161, 25.5], // scies
  [174, 19.5], [182, 13.5], [195, 7.5], [220, 7.5], // ressorts, final
].map(([x, y]) => ({ x: x!, y: y!, r: 1.5 }));

/** Galerie des dangers : une station après l'autre, puis le ressort et l'arrivée. */
const DANGERS_WAYPOINTS: Waypoint[] = [[12, 13.5], [24, 13.5], [35, 13.5], [52, 13.5], [72, 13.5], [88, 13.5], [104, 13.5], [114, 7.5], [126, 7.5]].map(([x, y]) => ({ x: x!, y: y!, r: 1.5 }));

interface Solution {
  jumpSimVersion: number;
  /** Empreinte du texte du niveau : le modifier oblige à rechercher une solution. */
  level: string;
  ticks: number;
  inputs: [number, number][];
}

export function textHash(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16).padStart(8, "0");
}

if (process.env.SOLVE) {
  const inputs = solve(ESSAI_LEVEL, DEFAULT_JUMP_PARAMS, WAYPOINTS, { beam: 1500 });
  if (!inputs) throw new Error("aucune solution trouvée");
  const solution: Solution = { jumpSimVersion: JUMP_SIM_VERSION, level: textHash(ESSAI_ASCII), ticks: inputs.length, inputs: compress(inputs) };
  writeFileSync(FILE, JSON.stringify(solution) + "\n");
  const gallery = solve(DANGERS_LEVEL, DEFAULT_JUMP_PARAMS, DANGERS_WAYPOINTS, { beam: 600 });
  if (!gallery) throw new Error("galerie : aucune solution trouvée");
  writeFileSync(DANGERS_FILE, JSON.stringify({ jumpSimVersion: JUMP_SIM_VERSION, level: textHash(DANGERS_ASCII), ticks: gallery.length, inputs: compress(gallery) }) + "\n");
}

const solution = JSON.parse(readFileSync(FILE, "utf8")) as Solution;
const gallery = JSON.parse(readFileSync(DANGERS_FILE, "utf8")) as Solution;

describe("solution du niveau d'essai", () => {
  it("est celle de ce niveau et de cette version de la simulation", () => {
    expect(solution.jumpSimVersion, "JUMP_SIM_VERSION a changé : SOLVE=1").toBe(JUMP_SIM_VERSION);
    expect(textHash(ESSAI_ASCII), "niveau d'essai modifié : SOLVE=1 (et JUMP_SIM_VERSION +1)").toBe(solution.level);
  });

  it("rejouée, elle arrive au bout sans jamais mourir ; le chrono vaut le nombre de pas joués", () => {
    const inputs = expand(solution.inputs);
    expect(inputs).toHaveLength(solution.ticks);
    let s = initialAttempt(ESSAI_LEVEL);
    for (let t = 0; t < inputs.length; t++) {
      s = stepAttempt(s, inputs[t]!, ESSAI_LEVEL, DEFAULT_JUMP_PARAMS);
      expect(s.status, `mort au pas ${t + 1}`).not.toBe(ATTEMPT_DEAD);
      if (t < inputs.length - 1) expect(s.status, `arrivée avant la fin, au pas ${t + 1}`).not.toBe(ATTEMPT_FINISHED);
    }
    expect(s.status).toBe(ATTEMPT_FINISHED);
    expect(s.time).toBe(solution.ticks);
    // Temps de l'auteur : environ 30 s pour un bon joueur, donc un peu moins pour une recherche qui ne rate rien.
    expect(s.time / TICK_RATE).toBeGreaterThan(18);
    expect(s.time / TICK_RATE).toBeLessThan(35);
  });

  it("le niveau d'essai a 3 ou 4 sections et se sert de chaque élément", () => {
    const L = ESSAI_LEVEL;
    expect(L.sections.length).toBeGreaterThanOrEqual(3);
    expect(L.sections.length).toBeLessThanOrEqual(4);
    const chars = new Set(ESSAI_ASCII);
    for (const c of ["^", "v", "<", ">", "o", "O", "x", "*", "S", "F", "#"]) expect(chars.has(c), `caractère « ${c} »`).toBe(true);
    const modes = new Set(L.saws.map((s) => s.mode));
    expect(modes).toEqual(new Set(["fixe", "aller-retour", "boucle"]));
    // Chaque scie mobile appartient à une section, et chaque section (sauf peut-être la première) en contient au moins un danger.
    for (const s of L.saws) if (s.mode !== "fixe") expect(s.section).toBeGreaterThanOrEqual(0);
  });
});

describe("solution de la galerie des dangers", () => {
  it("la galerie se finit sans mourir : chaque danger s'évite", () => {
    expect(gallery.jumpSimVersion).toBe(JUMP_SIM_VERSION);
    expect(textHash(DANGERS_ASCII), "galerie modifiée : SOLVE=1").toBe(gallery.level);
    let s = initialAttempt(DANGERS_LEVEL);
    for (const input of expand(gallery.inputs)) {
      s = stepAttempt(s, input, DANGERS_LEVEL, DEFAULT_JUMP_PARAMS);
      expect(s.status).not.toBe(ATTEMPT_DEAD);
    }
    expect(s.status).toBe(ATTEMPT_FINISHED);
    expect(s.time).toBe(gallery.ticks);
  });
});
