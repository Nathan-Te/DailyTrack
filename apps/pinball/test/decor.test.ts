import { describe, expect, it } from "vitest";
import { Partie, UNITE, dailyPinball } from "@cdj/pinball-sim";
import { ARC_CENTRE, BANDES, PALETTES, RAYON_MODULE, lampesDecor, lueurLampe, styleEtiquette } from "../src/dessin";
import { BORNES_VUE, VUE_DEFAUT, vueDe } from "../src/bornes";

// Lot PBV1 : la recette visuelle commune (bandes lumineuses, petites lampes, plaques de bois, curseurs de la lumière). La règle de lisibilité : le décor ne ressemble jamais à un élément de jeu — les bandes sont SUR les rails,
// les lampes au ras de l'arc (loin de tout module, de tout poteau) ou sur le dessus des lance-pierres, jamais au milieu du champ.
const px = (u: number): number => u / UNITE;

describe("les bandes lumineuses et les lampes du décor (lot PBV1)", () => {
  const table = new Partie(dailyPinball(20850, undefined, "foire")).table;

  it("chaque bande court le long d'un rail latéral de la table (le mur gauche, le mur du couloir du lanceur), sur toute sa longueur", () => {
    for (const [x, y0, y1] of BANDES) {
      const rail = table.murs.find((m) => px(m.ax) === x && px(m.bx) === x && Math.min(px(m.ay), px(m.by)) <= y0 && Math.max(px(m.ay), px(m.by)) >= y1);
      expect(rail, `bande x = ${x}`).toBeDefined();
    }
  });

  it("chaque thème a sa couleur de bande et de lampe", () => {
    for (const P of Object.values(PALETTES)) {
      expect(P.bande).toMatch(/^#[0-9A-F]{6}$/i);
      expect(P.lampe).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });

  it("les lampes de l'arc sont au ras du rail ; celles des lance-pierres, sur leur dessus (dans le triangle)", () => {
    const lampes = lampesDecor();
    expect(lampes.filter((l) => !l.pierre)).toHaveLength(10);
    for (const l of lampes) {
      if (!l.pierre) {
        const d = Math.hypot(l.x - ARC_CENTRE.x, l.y - ARC_CENTRE.y);
        expect(d).toBeGreaterThan(ARC_CENTRE.r - 16);
        expect(d).toBeLessThan(ARC_CENTRE.r - 6);
        continue;
      }
      // le lance-pierre gauche (42,468) (42,546) (92,574) et son image : la lampe est dedans, à 3 px au moins de ses bords
      const x = l.x < 184 ? l.x : 2 * 184 - l.x;
      const surHyp = 42 + ((l.y - 468) * 50) / 106;
      expect(x).toBeGreaterThan(42 + 3);
      expect(x).toBeLessThan(surHyp - 3);
      expect(l.y).toBeLessThan(546 + ((x - 42) * 28) / 50 - 3);
    }
  });

  it("aucune lampe de l'arc n'est près d'un module, d'un poteau ou d'un couloir du haut, sur 120 jours des quatre thèmes", () => {
    const arc = lampesDecor().filter((l) => !l.pierre);
    for (const theme of ["foire", "ocean", "espace", "volcan"] as const) {
      for (let j = 20800; j < 20830; j++) {
        const t = new Partie(dailyPinball(j, undefined, theme)).table;
        for (const l of arc) {
          for (const m of t.poses) expect(Math.hypot(l.x - px(m.x), l.y - px(m.y)), `${theme} ${j} ${m.type}`).toBeGreaterThan((RAYON_MODULE[m.type] ?? 30) + 6);
          for (const p of t.poteaux) expect(Math.hypot(l.x - px(p.x), l.y - px(p.y))).toBeGreaterThan(px(p.r) + 8);
          for (const v of t.voies) expect(Math.hypot(l.x - px(v.x), l.y - px(v.y) - 24)).toBeGreaterThan(14);
        }
      }
    }
  });

  it("la lueur d'une lampe ne dépend que du pas, entre 0,35 et 1", () => {
    for (let i = 0; i < 16; i++)
      for (let tick = 0; tick < 1200; tick += 37) {
        const v = lueurLampe(i, tick);
        expect(v).toBeGreaterThanOrEqual(0.35);
        expect(v).toBeLessThanOrEqual(1);
        expect(lueurLampe(i, tick)).toBe(v);
      }
  });

  it("les étiquettes de l'Océan sont des plaques de bois, les autres des pastilles d'encre", () => {
    expect(styleEtiquette("ocean")).toBe("bois");
    for (const t of ["foire", "espace", "volcan"] as const) expect(styleEtiquette(t)).toBe("encre");
  });
});

describe("les curseurs de la lumière (`?debug&tune`, lot PBV1)", () => {
  it("les valeurs par défaut sont dans leurs bornes", () => {
    for (const cle of Object.keys(BORNES_VUE) as (keyof typeof BORNES_VUE)[]) {
      const [min, max] = BORNES_VUE[cle];
      expect(VUE_DEFAUT[cle], cle).toBeGreaterThanOrEqual(min);
      expect(VUE_DEFAUT[cle], cle).toBeLessThanOrEqual(max);
    }
  });
  it("un JSON exporté (`{ vue }`) les recharge, ramenés dans leurs bornes ; un ancien export (sans eux) garde les valeurs par défaut", () => {
    expect(vueDe({ vue: { soleil: 180, azimut: -200, hauteur: 50, bloom: 0, bandes: 999 } })).toMatchObject({ soleil: 180, azimut: -90, hauteur: 50, bloom: 0, bandes: 300 });
    expect(vueDe({ vue: { angle: 60 } })).toEqual({ ...VUE_DEFAUT, angle: 60 });
  });
});
