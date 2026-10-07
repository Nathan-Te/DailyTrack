import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { THEMES, parseTrack, type ThemeName } from "@cdj/sim";
import { FOCUS_BLOCKS, pickFocus, signatureBlocks } from "../src/thumbFocus";

const golden = JSON.parse(readFileSync(new URL("../../../packages/sim/test/fixtures/daily-golden.json", import.meta.url), "utf8")) as {
  circuits: { date: string; spec: string; theme: ThemeName }[];
};

const track = (spec: string) => parseTrack("test", spec);
const FILL = "S S S S S S S S S S S S";

describe("passage signature des miniatures", () => {
  it("super turbo puis grand virage relevé : du turbo au virage", () => {
    const t = track(`S@start S S T S S S S S L2/b S S S S@finish`);
    expect(signatureBlocks(t, "turboBank")).toEqual([3, 9]);
  });
  it("tremplin sur la terre", () => {
    const t = track(`S@start S S/t J/t S/t S S S@finish`);
    expect(signatureBlocks(t, "dirtJump")).toEqual([3, 3]);
    expect(signatureBlocks(track("S@start S J S S@finish"), "dirtJump")).toBeNull(); // un tremplin sur la route n'est pas la signature
  });
  it("chicane sur la glace : deux virages de sens opposés", () => {
    const t = track(`S@start S S/g L/g R/g S S S S@finish`);
    expect(signatureBlocks(t, "iceChicane")).toEqual([3, 4]);
    expect(signatureBlocks(track("S@start S L/g L/g S S@finish"), "iceChicane")).toBeNull();
  });
  it("moteur coupé : jusqu'au point de contrôle deux blocs plus loin", () => {
    const t = track(`S@start S S C S S@cp S S@finish`);
    expect(signatureBlocks(t, "cutRun")).toEqual([3, 6]);
  });
  it("étranglement puis virage serré sur la terre, route étroite", () => {
    const t = track(`S@start S/e>n S/n>e S/t L/t S S S@finish`);
    expect(signatureBlocks(t, "dirtPinch")).toEqual([1, 4]);
    expect(signatureBlocks(track("S@start S L/t S S@finish"), "dirtPinch")).not.toBeNull(); // déjà étroit : le virage lui-même
    expect(signatureBlocks(track("S@start S/e>l S/l L/t S S@finish"), "dirtPinch")).toBeNull(); // route large : pas un étranglement
  });
});

describe("portion montrée", () => {
  it("centrée sur le passage signature, de FOCUS_BLOCKS blocs, dans le circuit", () => {
    const t = track(`S@start ${FILL} J/t ${FILL} S@finish`);
    const f = pickFocus(t, "rallye");
    expect(f.reason).toBe("signature");
    expect(f.to - f.from + 1).toBe(FOCUS_BLOCKS);
    expect(f.from).toBeLessThanOrEqual(13);
    expect(f.to).toBeGreaterThanOrEqual(13); // le tremplin est le 14ᵉ bloc (indice 13)
  });
  it("sans signature : la zone la plus sinueuse", () => {
    // une longue droite, puis une série de virages, puis une droite : la portion doit tomber sur les virages
    const t = track(`S@start ${FILL} L R L R L R L R ${FILL} S@finish`);
    const f = pickFocus(t, "stade"); // pas de turbo ici : repli sur les virages
    expect(f.reason).toBe("winding");
    expect(f.from).toBeGreaterThanOrEqual(12);
    expect(f.to).toBeLessThanOrEqual(21);
  });
  it("un circuit plus court que la portion : tout le circuit", () => {
    const f = pickFocus(track("S@start S S S@finish"), "stade");
    expect([f.from, f.to]).toEqual([0, 3]);
  });
  it("l'axe principal est unitaire et va du départ vers l'arrivée de la portion", () => {
    const f = pickFocus(track(`S@start S S S S S S S S@finish`), "stade");
    expect(Math.hypot(...f.right)).toBeCloseTo(1, 6);
    // le circuit part vers +z : la droite de l'écran suit +z
    expect(f.right[1]).toBeGreaterThan(0.99);
  });
  it("les points couvrent la route de la portion avec une marge", () => {
    const t = track(`S@start S S S S@finish`);
    const f = pickFocus(t, "stade");
    const zs = f.points.map((p) => p[2]);
    expect(Math.min(...zs)).toBeLessThan(0);
    expect(Math.max(...zs)).toBeGreaterThan(5 * 32 - 1);
  });
});

describe("circuits de référence du générateur", () => {
  for (const c of golden.circuits) {
    it(`${c.date} (${THEMES[c.theme].label}) : un passage signature est trouvé, la portion tient dans le circuit`, () => {
      const t = track(c.spec);
      expect(signatureBlocks(t, THEMES[c.theme].signature), "le générateur place toujours le passage signature du thème").not.toBeNull();
      const f = pickFocus(t, c.theme);
      expect(f.reason).toBe("signature");
      expect(f.from).toBeGreaterThanOrEqual(0);
      expect(f.to).toBeLessThan(t.blocks.length);
      expect(f.to - f.from + 1).toBe(Math.min(FOCUS_BLOCKS, t.blocks.length));
      expect(f.points.length).toBeGreaterThan(8);
    });
  }
});
