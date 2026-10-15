import { describe, expect, it } from "vitest";
import {
  COURSE_SPRINT,
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  INPUT_RIGHT,
  MODULES,
  MODULE_ENTRIES,
  RACCORD_COUNT,
  buildModule,
  canonicalOf,
  centerCol,
  entryPrefix,
  moduleSolutions,
  moduleStart,
  raccordPositions,
  sprintTop,
  stepAttempt,
  stepPlayer,
  type AttemptState,
  type PlayerState,
} from "../src/index";
import { room, standAt } from "./helpers";

// Lot 8c : les **deux états canoniques** au bord droit d'un palier (course, élan plein), l'approche canonique des entrées lancées, et ce
// qu'il faut pour sortir d'un morceau dans l'un ou l'autre. Les solutions stockées elles-mêmes sont vérifiées dans `modules.test.ts` (sortie
// dans un état canonique, raccord ≥ 90 % à chaque entrée lancée) et l'enchaînement dans `daily.test.ts`.

const P = DEFAULT_JUMP_PARAMS;
const R = INPUT_RIGHT;
const HALL = room(120, 8);

/** L'état au bord du palier d'entrée, après l'approche canonique. */
function atEdge(id: string, v: number, entry: "course" | "plein"): AttemptState {
  const m = buildModule(id, v);
  let s = moduleStart(m, entry);
  for (const bits of entryPrefix(m, entry)) s = stepAttempt(s, bits, m.level, P);
  return s;
}

describe("deux états canoniques (lot 8c)", () => {
  it("course : au sol, à `runSpeed`, compteur à `COURSE_SPRINT` (1) ; élan plein : à `sprintSpeed`, compteur au maximum (`sprintDelay`)", () => {
    expect(COURSE_SPRINT).toBe(1);
    const c = atEdge("tunnel", 0, "course").player;
    expect(canonicalOf(c)).toBe("course");
    expect([c.vx, c.sprint, c.ground]).toEqual([P.runSpeed, 1, 1]);
    const p = atEdge("tunnel", 0, "plein").player;
    expect(canonicalOf(p)).toBe("plein");
    expect([p.vx, p.sprint, p.ground]).toEqual([sprintTop(P), P.sprintDelay, 1]);
  });

  it("exacts : deux personnages dans le même état canonique ne diffèrent que par leur position (morceaux, rangées et positions différents)", () => {
    for (const entry of ["course", "plein"] as const) {
      const states = MODULES.slice(0, 12).map((d) => atEdge(d.id, 0, entry).player);
      const strip = (p: PlayerState) => ({ ...p, x: 0, y: 0 });
      for (const s of states) expect(strip(s), entry).toEqual(strip(states[0]!));
    }
  });

  it("l'approche canonique de chaque entrée lancée passe le bord du palier d'entrée exactement dans son état, pour tout le catalogue", () => {
    for (const def of MODULES) {
      for (let v = 0; v < def.variants.length; v++) {
        const m = buildModule(def.id, v);
        expect(entryPrefix(m, "arret")).toEqual([]);
        for (const entry of ["course", "plein"] as const) {
          const prefix = entryPrefix(m, entry);
          let s = moduleStart(m, entry);
          prefix.forEach((bits, t) => {
            s = stepAttempt(s, bits, m.level, P);
            if (t + 1 < prefix.length) expect(centerCol(s.player), `${def.id} v${v} ${entry}`).toBeLessThan(m.lead);
          });
          expect(centerCol(s.player)).toBe(m.lead);
          expect(canonicalOf(s.player), `${def.id} v${v} ${entry}`).toBe(entry);
        }
        // Élan plein : droite tenue ; course : un bref relâchement (un pas sans rien) deux pas avant le bord.
        expect(entryPrefix(m, "plein").every((b) => b === R)).toBe(true);
        const course = entryPrefix(m, "course");
        expect(course.filter((b) => b !== R)).toEqual([0]);
        expect(course.length - 1 - course.indexOf(0)).toBe(2);
      }
    }
  });

  it("atteignable à la sortie de tout morceau : depuis n'importe quelle course ou élan, un bref relâchement mène à l'état « course »", () => {
    // Depuis la course (compteur quelconque) : un pas relâché, puis droite ; deux pas plus tard, « course ».
    for (const counter of [0, 1, 7, 20, 41]) {
      let s: PlayerState = { ...standAt(HALL, 10, 7), vx: P.runSpeed, sprint: counter };
      s = stepPlayer(s, 0, HALL, P);
      s = stepPlayer(s, R, HALL, P);
      expect(canonicalOf(s)).toBeNull();
      s = stepPlayer(s, R, HALL, P);
      expect(canonicalOf(s), `compteur ${counter}`).toBe("course");
    }
    // Depuis l'élan plein : un pas relâché, puis droite ; la vitesse retombe à la course en huit pas (≈ 1,1 tuile), compteur à 1.
    let s: PlayerState = { ...standAt(HALL, 10, 7), vx: sprintTop(P), sprint: P.sprintDelay };
    s = stepPlayer(s, 0, HALL, P);
    let n = 0;
    while (canonicalOf(s) !== "course" && n < 20) {
      s = stepPlayer(s, R, HALL, P);
      n++;
    }
    expect(n).toBe(7);
    // Après un saut mural (compteur à 0) : posé au sol à la course, le premier pas compté donne « course ».
    let w: PlayerState = { ...standAt(HALL, 10, 7), vx: P.runSpeed, sprint: 0 };
    w = stepPlayer(w, R, HALL, P);
    expect(canonicalOf(w)).toBe("course");
    // Et l'élan plein se garde de lui-même : droite tenue, l'état ne change plus (point fixe).
    let f: PlayerState = { ...standAt(HALL, 10, 7), vx: sprintTop(P), sprint: P.sprintDelay };
    for (let t = 0; t < 40; t++) {
      f = stepPlayer(f, R, HALL, P);
      expect(canonicalOf(f)).toBe("plein");
    }
  });

  it("aucun autre état n'est canonique : en l'air, bouton tenu, entre la course et l'élan, compteur différent", () => {
    const base: PlayerState = { ...standAt(HALL, 10, 7), vx: P.runSpeed, sprint: 1 };
    expect(canonicalOf(base)).toBe("course");
    expect(canonicalOf({ ...base, sprint: 2 })).toBeNull();
    expect(canonicalOf({ ...base, held: 1 })).toBeNull();
    expect(canonicalOf({ ...base, ground: 0 })).toBeNull();
    expect(canonicalOf({ ...base, vx: 500, sprint: P.sprintDelay })).toBeNull();
    expect(canonicalOf({ ...base, vx: sprintTop(P), sprint: P.sprintDelay - 1 })).toBeNull();
    expect(canonicalOf({ ...base, buffer: 3 })).toBeNull();
    const jumped = stepPlayer(base, R | INPUT_JUMP, HALL, P);
    expect(canonicalOf(jumped)).toBeNull();
  });

  it("le test de raccord couvre un pas de chaque entrée lancée ; chaque variante a ses trois solutions", () => {
    expect(raccordPositions("course")).toHaveLength(RACCORD_COUNT);
    expect(raccordPositions("plein")[RACCORD_COUNT - 1]).toBeLessThan(sprintTop(P));
    for (const def of MODULES) def.variants.forEach((_, v) => for_(def.id, v));
    function for_(id: string, v: number) {
      const s = moduleSolutions(id, v);
      for (const e of MODULE_ENTRIES) expect(s?.[e], `${id} v${v} ${e}`).toBeTruthy();
    }
  });
});
