import { describe, expect, it } from "vitest";
import { GENERATOR_VERSION, THEMES, THEME_NAMES, TURF_FIGURES, FIGURES, themeOfVersion, type ThemeName } from "@cdj/sim";
import { mix, shade } from "../src/meshKit";
import { PALETTE_DEFS, SURFACE_COLORS } from "../src/trackMesh";
import { THEMES_C } from "../src/scene/lumiere";
import { PISTE_A } from "../src/scene/piste";
import { BORD_HERBE, HERBE_HAUTE, TONTE_SOMBRE } from "../src/scene/route";
import { PALETTE, ecartCouleurs } from "../src/voiture/livree";

// Lot 48 : l'herbe de course se voit. Écart ΔE 2000 > 12 entre chacune de ses couleurs (les deux tons, la bande de tonte assombrie) et chaque sol
// qui l'entoure, sur la Campagne et sur tout thème qui l'utilise ; l'orange reste à la voiture (lot 43). Chiffres dans docs/lots/lot-48-herbe.md.

const ORANGE = 0xe8552d;
const hex = (s: string) => parseInt(s.slice(1), 16);

/** Les thèmes qui roulent sur l'herbe de course avec le dernier générateur : zones de revêtement ou figures propres. */
function themesAvecHerbe(): ThemeName[] {
  return THEME_NAMES.filter((n) => {
    const t = themeOfVersion(THEMES[n], GENERATOR_VERSION);
    const zones = t.zones?.surfaces.some(([s]) => s === "turf") ?? false;
    const figures = FIGURES.some((f) => (TURF_FIGURES as readonly string[]).includes(f.name) && (!f.only || f.only.includes(n)));
    return zones || figures;
  });
}

/** Ce qui entoure la piste d'un thème : sol relevé (lot 44), sol lointain dessiné, sol de la palette du palier 1 et de l'existant, bas-côtés. */
function solsAutour(n: ThemeName): Record<string, number> {
  const pal = THEMES[n].palette;
  const [a, b] = THEMES_C[pal].sol;
  const out: Record<string, number> = {
    "sol relevé": shade(mix(hex(a), hex(b), 0.5), 0.94),
    "sol lointain (1)": hex(a),
    "sol lointain (2)": hex(b),
    "sol du palier 1 (1)": hex(PISTE_A[pal].sol[0]),
    "sol du palier 1 (2)": hex(PISTE_A[pal].sol[1]),
    "sol de l'existant (1)": hex(PALETTE_DEFS[pal].floorA),
    "sol de l'existant (2)": hex(PALETTE_DEFS[pal].floorB),
  };
  const sh = THEMES[n].shoulder.kind;
  if (sh !== "void") {
    const [c1, c2] = sh === "grass" && PALETTE_DEFS[pal].scenery === "trees" ? HERBE_HAUTE : SURFACE_COLORS[sh];
    out["bas-côté (1)"] = c1;
    out["bas-côté (2)"] = c2;
  }
  return out;
}

const couleursHerbe = (): Record<string, number> => ({
  "ton 1": SURFACE_COLORS.turf[0],
  "ton 2": SURFACE_COLORS.turf[1],
  "tonte (1)": shade(SURFACE_COLORS.turf[0], TONTE_SOMBRE),
  "tonte (2)": shade(SURFACE_COLORS.turf[1], TONTE_SOMBRE),
});

describe("lot 48 : l'herbe de course se voit", () => {
  it("la Campagne est le thème qui l'utilise (et le seul, au lot 48)", () => {
    expect(themesAvecHerbe()).toEqual(["campagne"]);
  });

  for (const n of ["campagne"] as const) {
    it(`${n} : ΔE 2000 > 12 entre chaque couleur de l'herbe de course et chaque sol autour`, () => {
      for (const [nom, c] of Object.entries(couleursHerbe())) for (const [autour, s] of Object.entries(solsAutour(n))) expect(ecartCouleurs(c, s), `${nom} contre ${autour}`).toBeGreaterThan(12);
    });
  }

  it("tout thème qui l'utilise suit la même règle", () => {
    for (const n of themesAvecHerbe()) for (const c of Object.values(couleursHerbe())) for (const s of Object.values(solsAutour(n))) expect(ecartCouleurs(c, s)).toBeGreaterThan(12);
  });

  it("plus claire et plus saturée que le sol autour", () => {
    const hsl = (c: number) => {
      const r = ((c >> 16) & 255) / 255;
      const g = ((c >> 8) & 255) / 255;
      const b = (c & 255) / 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const l = (max + min) / 2;
      return { l, s: max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1)) };
    };
    const herbe = hsl(SURFACE_COLORS.turf[0]);
    for (const [autour, s] of Object.entries(solsAutour("campagne"))) {
      expect(herbe.l, autour).toBeGreaterThan(hsl(s).l);
      expect(herbe.s, autour).toBeGreaterThan(hsl(s).s);
    }
  });

  it("l'orange reste à la voiture : l'herbe de course et son bord blanc à plus de 12 de l'orange de Track", () => {
    for (const c of [...Object.values(couleursHerbe()), BORD_HERBE]) expect(ecartCouleurs(c, ORANGE)).toBeGreaterThan(12);
  });

  it("elle ne ressemble pas à l'herbe d'avant (celle des anciens circuits, qui freine) : ΔE > 12 pour ses deux tons", () => {
    for (const c of SURFACE_COLORS.turf) for (const g of SURFACE_COLORS.grass) expect(ecartCouleurs(c, g)).toBeGreaterThan(12);
  });

  it("chaque livrée de la voiture se détache de l'herbe de course (ΔE > 12, comme de tout élément de piste)", () => {
    for (const v of PALETTE) for (const c of [...Object.values(couleursHerbe()), BORD_HERBE]) expect(ecartCouleurs(v.hex, c), v.nom).toBeGreaterThan(12);
  });

  it("le bord net se détache de l'herbe de course", () => {
    for (const c of Object.values(couleursHerbe())) expect(ecartCouleurs(c, BORD_HERBE)).toBeGreaterThan(20);
  });
});
