import { describe, expect, it } from "vitest";
import { INPUT_JUMP, INPUT_RIGHT, MODULES, attemptReplay, encodeReplay, moduleSolutions, type ModuleSolution } from "../src/index";
import { BANAL_EXIGENCE, BANAL_PRESSES, BANAL_RIGHT, banalCatalog, banalReasons, pressesOf } from "../tools/banal";

// Lot 8c : le critère de banalité, **mesuré sur les solutions stockées** (`tools/banal.ts`). Avec l'élan, un morceau fait pour la course
// peut devenir une ligne droite : il est alors repris ou ses variantes retirées. Ce test vérifie le critère lui-même, puis qu'aucune variante
// du catalogue n'est banale.

describe("critère de banalité (lot 8c)", () => {
  it("les seuils : au plus 1 appui, droite seule ≥ 90 % du temps, exigence ≤ 2 ; ou « precision » à exigence 1", () => {
    expect([BANAL_PRESSES, BANAL_RIGHT, BANAL_EXIGENCE]).toEqual([1, 900, 2]);
  });

  it("compte les appuis (fronts montants du saut) et la part de droite seule entre l'entrée et la sortie", () => {
    const sol = moduleSolutions("petits-trous", 0)!.plein!;
    const { presses, right } = pressesOf(sol);
    expect(presses).toBeGreaterThanOrEqual(2); // une file de trous : plusieurs sauts
    expect(right).toBeGreaterThanOrEqual(0);
    expect(right).toBeLessThanOrEqual(1000);
    // Une solution fictive qui tient la droite d'un bout à l'autre et ne saute qu'une fois : 1 appui, droite seule 97,6 % du temps.
    const inputs = [...new Array<number>(100).fill(INPUT_RIGHT), ...new Array<number>(5).fill(INPUT_RIGHT | INPUT_JUMP), ...new Array<number>(100).fill(INPUT_RIGHT)];
    const fake: ModuleSolution = { ...sol, code: encodeReplay(attemptReplay("module:essai:0", inputs)), entryTick: 0, exitTick: inputs.length, ticks: inputs.length };
    expect(pressesOf(fake)).toEqual({ presses: 1, right: 976 });
  });

  it("aucune variante du catalogue n'est banale", () => {
    const banal = banalCatalog();
    expect(banal.map((b) => `${b.id} v${b.variant} : ${b.reasons.join(" ; ")}`)).toEqual([]);
    // Et le critère porte bien sur tout le catalogue (chaque variante a ses solutions lancées).
    let checked = 0;
    for (const def of MODULES) {
      def.variants.forEach((_, v) => {
        expect(banalReasons(def, v)).toEqual([]);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(150);
  });
});
