import { Rng } from "@cdj/core";
import { describe, expect, it } from "vitest";
import {
  INPUT_JUMP as J,
  INPUT_RIGHT as R,
  MODULES,
  PRESS_MIN,
  PRESS_MIN_LEGACY,
  RELEASE_MIN,
  decodeReplay,
  fromRuns,
  moduleSolutions,
  pressProblems,
  shortestPress,
  variantExigence,
} from "../src/index";
import { appuis, humanized, jittered } from "../tools/exigence";
import { readSolutions } from "../tools/files";

// Retouche du lot 11 : **jouable au clavier**. Une solution ne peut pas exiger un appui de saut plus court que `PRESS_MIN` pas (un doigt tient
// une touche au moins ≈ 40 ms ; lot 30 : 6 pas, 50 ms, le maintien minimal du saut) ni un relâchement plus court que `RELEASE_MIN` pas entre deux appuis ; la gigue de la mesure
// d'exigence respecte le relâchement minimal (lot 30 : plus de prolongation des appuis courts, la physique le fait : tout appui de 1 à 10 pas est le même petit saut).

const run = (bits: number, n: number): number[] => Array.from({ length: n }, () => bits);

describe("pressProblems : la façon de tenir le bouton de saut", () => {
  it("constantes : appui de 6 pas (50 ms) au moins (5 pas jusqu'au lot 30), relâchement de 3 pas (25 ms) au moins", () => {
    expect(PRESS_MIN).toBe(6);
    expect(PRESS_MIN_LEGACY).toBe(5);
    expect(RELEASE_MIN).toBe(3);
  });

  it("un appui d'un seul pas, ou de cinq, est refusé ; six passent", () => {
    expect(pressProblems([...run(R, 10), ...run(R | J, 1), ...run(R, 10)])).toMatch(/appui de saut de 1 pas/);
    expect(pressProblems([...run(R | J, PRESS_MIN - 1), ...run(R, 10)])).toMatch(/appui de saut de 5 pas/);
    expect(pressProblems([...run(R | J, PRESS_MIN), ...run(R, 10)])).toBeNull();
    expect(pressProblems([...run(R, 10), ...run(R | J, 30), ...run(R, 10)])).toBeNull();
  });

  it("un relâchement d'un ou deux pas entre deux appuis est refusé ; trois passent", () => {
    const press = run(R | J, PRESS_MIN);
    expect(pressProblems([...press, ...run(R, 1), ...press, ...run(R, 5)])).toMatch(/relâchement de 1 pas/);
    expect(pressProblems([...press, ...run(R, RELEASE_MIN - 1), ...press, ...run(R, 5)])).toMatch(/relâchement de 2 pas/);
    expect(pressProblems([...press, ...run(R, RELEASE_MIN), ...press, ...run(R, 5)])).toBeNull();
  });

  it("l'appui qui dure jusqu'à la fin n'est pas jugé ; sans saut, rien à juger", () => {
    expect(pressProblems(run(R | J, 2))).toBeNull();
    expect(pressProblems(run(R, 40))).toBeNull();
    expect(shortestPress(run(R, 40))).toBe(0);
    expect(shortestPress([...run(R | J, 19), ...run(R, 3), ...run(R | J, 16), ...run(R, 2)])).toBe(16);
  });
});

describe("la gigue respecte ce qu'un doigt peut faire", () => {
  it("humanized : retarde un second appui trop proche, laisse intact ce qui est humain ; n'allonge plus les appuis courts (la physique le fait), sauf à le demander", () => {
    const ok = [...run(R, 6), ...run(R | J, 18), ...run(R, 6), ...run(R | J, 17), ...run(R, 6)];
    expect(humanized(ok)).toEqual(ok);
    const short = [...run(R, 6), ...run(R | J, 2), ...run(R, 20)];
    const h = humanized(short);
    expect(h).toEqual(short);
    expect(h.slice(6, 6 + PRESS_MIN_LEGACY).every((b) => (b & J) !== 0)).toBe(false);
    expect(humanized(short, PRESS_MIN_LEGACY).slice(6, 6 + PRESS_MIN_LEGACY).every((b) => (b & J) !== 0)).toBe(true);
    const close = [...run(R | J, 18), ...run(R, 1), ...run(R | J, 19), ...run(R, 20)];
    const c = humanized(close);
    expect(pressProblems(c)).toBeNull();
    expect(c).toHaveLength(close.length);
    // Les directions ne bougent jamais.
    expect(c.every((b) => (b & R) !== 0)).toBe(true);
  });

  it("jittered : un relâchement d'au moins RELEASE_MIN pas et un appui d'au moins un pas, quelle que soit l'amplitude, sur des milliers de tirages", () => {
    const rng = new Rng(11);
    const base = [...run(R, 12), ...run(R | J, 16), ...run(R, 8), ...run(R | J, 19), ...run(R, 4), ...run(R | J, 15), ...run(R, 30)];
    for (let k = 1; k <= 3; k++)
      for (let d = 0; d < 1000; d++) {
        const list = appuis(jittered(base, k, rng));
        expect(list.length, `±${k}, tirage ${d}`).toBe(3);
        list.forEach((a, i) => {
          expect(a.to - a.from, `±${k}, tirage ${d}`).toBeGreaterThanOrEqual(1);
          if (i > 0) expect(a.from - list[i - 1]!.to, `±${k}, tirage ${d}`).toBeGreaterThanOrEqual(RELEASE_MIN);
        });
      }
  });
});

describe("le catalogue est jouable au clavier", () => {
  it("chaque solution stockée tient `PRESS_MIN` et `RELEASE_MIN`, et son `press` est exact", () => {
    let n = 0;
    for (const def of MODULES) {
      for (let v = 0; v < def.variants.length; v++) {
        // Lot 15 : `press` est dans `solutions.json` (le jeu n'embarque que la rediffusion).
        const s = readSolutions()!.modules[def.id]?.variants[v];
        for (const e of ["arret", "elan"] as const) {
          const sol = s?.[e];
          if (!sol || sol.exigence === 0) continue;
          const inputs = fromRuns(decodeReplay(sol.code).runs);
          expect(pressProblems(inputs), `${def.id} v${v} ${e}`).toBeNull();
          expect(sol.press, `${def.id} v${v} ${e}`).toBe(shortestPress(inputs));
          if (sol.press !== 0) expect(sol.press).toBeGreaterThanOrEqual(PRESS_MIN);
          n++;
        }
      }
    }
    expect(n).toBeGreaterThan(400);
  });

  it("aucune variante utilisable ne dépend d'un appui qu'un clavier ne produit pas (exigence ≥ 1 ⇒ solutions humaines aux deux entrées)", () => {
    for (const def of MODULES) {
      for (let v = 0; v < def.variants.length; v++) {
        const s = moduleSolutions(def.id, v);
        if (variantExigence(s) === 0) continue;
        for (const e of ["arret", "elan"] as const) expect(pressProblems(fromRuns(decodeReplay(s![e]!.code).runs)), `${def.id} v${v} ${e}`).toBeNull();
      }
    }
  });
});
