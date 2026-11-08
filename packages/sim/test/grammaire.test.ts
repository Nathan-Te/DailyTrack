import { describe, expect, it } from "vitest";
import { essai } from "./helpers/fenetre";
import { GRAMMAIRE_LOT57, SAUTS_LOT57, TRANSITIONS_LOT57, bestPilotRun, buildFigure, classerSauts, createFigureTrack, parseTrack, trackJumps, type WidthLetter } from "../src/index";

// Lot 57 : chaque prototype de la grammaire (saut ou transition) est fini par le pilote automatique, dans chaque variante, dans les deux sens et
// sur les trois largeurs d'entrée — comme une figure (`figures.test.ts`) — et ses sauts sont pris dans leur fenêtre.

const WIDTHS: readonly WidthLetter[] = ["e", "n", "l"];

describe("grammaire du lot 57", () => {
  it("au moins 8 sauts et 6 transitions, des noms `saut-…` et `transition-…`", () => {
    expect(SAUTS_LOT57.length).toBeGreaterThanOrEqual(8);
    expect(TRANSITIONS_LOT57.length).toBeGreaterThanOrEqual(6);
    for (const e of SAUTS_LOT57) expect(e.name.startsWith("saut-")).toBe(true);
    for (const e of TRANSITIONS_LOT57) expect(e.name.startsWith("transition-")).toBe(true);
  });

  for (const e of GRAMMAIRE_LOT57) {
    it(`${e.name} : le pilote finit chaque variante, deux sens, trois largeurs`, () => {
      for (let v = 0; v < e.variants; v++) {
        for (const left of [true, false]) {
          for (const w of WIDTHS) {
            const body = buildFigure(e, left, w, v);
            if (!body) continue;
            const spec = [`S/${w}@start`, "S", "S", "S", "S", "S@cp", ...body.slice(body[0] === "S" ? 1 : 0), "S", "S@finish"].join(" ");
            const run = bestPilotRun(parseTrack(`g-${e.name}`, spec), { cut: false });
            expect(run, `${e.name} v${v} ${left ? "L" : "R"} ${w}`).not.toBeNull();
          }
        }
      }
    });
  }

  it("chaque saut de la grammaire est un vrai saut, rangé selon ses parties annoncées", () => {
    for (const e of SAUTS_LOT57) {
      const track = createFigureTrack(e.name)!;
      expect(trackJumps(track).length, e.name).toBeGreaterThan(0);
      const s = classerSauts(track)[0]!;
      expect(s.appel, e.name).toBe(e.parties!.appel);
      expect(s.vol, e.name).toBe(e.parties!.vol);
    }
  });
});

describe("fenêtre de chaque saut de la grammaire (simulation)", () => {
  // Toute la fenêtre de vitesse au bord de l'appel — du plancher (× 1,08, la marge exigée du pilote) jusqu'au plafond calculé, borné à ce qu'un
  // joueur peut porter (la vitesse du pilote + 6 m/s) — et d'angle (cap ± 4°, ± 2 m de l'axe) : la voiture se pose sur la route.
  for (const e of SAUTS_LOT57) {
    it(`${e.name} : se pose sur toute sa fenêtre`, () => {
      let essais = 0;
      for (let v = 0; v < e.variants; v++) {
        const track = createFigureTrack(e.name, v)!;
        const run = bestPilotRun(track, { cut: false })!;
        trackJumps(track).forEach((jp, j) => {
          const lo = jp.minSpeed * 1.08;
          const hi = Math.min(jp.maxSpeed, run.jumps[j]!.speed + 6);
          expect(hi - lo, `${e.name} v${v} : fenêtre trop étroite`).toBeGreaterThanOrEqual(4);
          for (let sp = lo; sp <= hi + 1e-9; sp += (hi - lo) / 4) {
            for (const a of [-0.07, 0, 0.07]) {
              for (const l of [-2, 0, 2]) {
                // On lance la voiture un peu sous la vitesse visée : la rampe la ralentit (≈ 1 à 2 m/s), on lit la vitesse au bord.
                const r = essai(track, j, sp + 1.5, a, l);
                if (r.lip < lo || r.lip > hi) continue;
                essais++;
                expect(r.ok, `${e.name} v${v} saut ${j} : ${r.lip.toFixed(1)} m/s, cap ${a}, écart ${l} m`).toBe(true);
              }
            }
          }
        });
      }
      // Pas une fenêtre vide : au moins la moitié des lancers (5 vitesses × 9 caps et écarts par saut) tombe dans la fenêtre.
      expect(essais, `${e.name} : lancers dans la fenêtre`).toBeGreaterThanOrEqual(20);
    });
  }
});
