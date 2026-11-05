import { THEMES_BLOCKS } from "@cdj/blocks-sim";
import { ENCRE, PALETTE_PORT, PAPIER, type PaletteTheme } from "@cdj/visuels/blocs";
import { PALETTES } from "@cdj/visuels/blocs/themes";
import { describe, expect, it } from "vitest";
import { couleurDeFamille, couleursDeTheme, FAMILLES } from "../src/couleurs";
import { aire, calmer, couleursDuDecor, type DecorTheme, deplacer, formesDuDecor, HAUTEUR_PLANCHE, LARGEUR_PLANCHE, R, Ruban } from "../src/decors/logique";
import { chargerDecorTheme } from "../src/decors/index";

// Lot B5 — les décors des six thèmes : de vrais décors détaillés (plans, motifs, petits éléments, animations lentes), des aplats, **plus calmes que la grille et les pièces**, et un contraste avec la grille vérifié sur chaque thème.
const PALETTES_TOUTES: Record<(typeof THEMES_BLOCKS)[number], PaletteTheme> = { port: PALETTE_PORT, ...PALETTES };
const HEX = /^#[0-9A-Fa-f]{6}$/;
const lin = (c: number): number => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const rvb = (hex: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const luminance = (hex: string): number => {
  const [r, g, b] = rvb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
};
/** Le rapport de contraste WCAG de deux couleurs. */
const contraste = (a: string, b: string): number => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};
const f = (v: number): number => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
const lab = (hex: string): [number, number, number] => {
  const [r, g, b] = rvb(hex).map(lin) as [number, number, number];
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
};
const deltaE = (a: string, b: string): number => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]!));
/** La chroma CIE Lab (C*) : 0 pour un gris, 60 à 100 pour une couleur vive. */
const chroma = (hex: string): number => Math.hypot(lab(hex)[1], lab(hex)[2]);

const decors = new Map<string, DecorTheme>();
const SURFACE = 0.02; // une couleur qui peint au moins 2 % de la planche est une « surface » du décor
describe.each(THEMES_BLOCKS)("le décor du thème %s", (theme) => {
  const palette = PALETTES_TOUTES[theme];
  const sombre = couleursDeTheme(palette).sombre;
  const cadre = couleursDeTheme(palette).cadre;

  it("existe : quatre plans garnis, des animations, des bandes de ciel dont la première est le ciel du thème", async () => {
    const d = await chargerDecorTheme(theme);
    decors.set(theme, d);
    expect(d.plans).toHaveLength(4);
    for (const [i, p] of d.plans.entries()) expect(p.centre.length + p.repete.length, `plan ${i}`).toBeGreaterThan(2);
    expect(formesDuDecor(d).length, "un décor détaillé : des dizaines de formes").toBeGreaterThan(70);
    expect(d.anims.length).toBeGreaterThanOrEqual(3);
    for (const a of d.anims) {
      expect(a.T).toBeGreaterThan(0);
      expect(a.formes.length).toBeGreaterThan(0);
    }
    expect(d.bandes[0]!.c.toUpperCase(), "le ciel du thème (la scène et ses zones en sont déduits)").toBe(palette.ciel.toUpperCase());
    expect(d.bandes.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < d.bandes.length; i++) expect(d.bandes[i]!.de, "les bandes se suivent").toBeGreaterThan(d.bandes[i - 1]!.de);
    expect(d.calme).toBeGreaterThan(0);
    expect(d.calme).toBeLessThanOrEqual(0.4);
  });

  it("n'écrit que des aplats #RRGGBB (aucun dégradé, aucune image), des formes dans la planche, jamais d'encre noire", async () => {
    const d = decors.get(theme) ?? (await chargerDecorTheme(theme));
    for (const forme of formesDuDecor(d)) {
      // Une couleur de forme est `#RRGGBB` ; les reflets d'un conteneur (`#00000022`) sont des traits d'ombre légers, jamais l'encre des blocs.
      expect(forme.c, theme).toMatch(/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/);
      expect(forme.c.toUpperCase(), "pas l'encre des blocs").not.toBe(ENCRE.toUpperCase());
      if (forme.t === "p") expect(forme.pts.length % 2).toBe(0);
    }
  });

  it("est calme : moins vif que les pièces (chroma moyenne), et chaque surface reste proche du ciel", async () => {
    const d = decors.get(theme) ?? (await chargerDecorTheme(theme));
    const couleurs = couleursDuDecor(d);
    const pieces = FAMILLES.map((fam) => couleurDeFamille(palette, fam));
    const vifPieces = pieces.reduce((n, c) => n + chroma(c), 0) / pieces.length;
    const poids = couleurs.reduce((n, c) => n + c.part, 0);
    const vifDecor = couleurs.reduce((n, c) => n + c.part * chroma(c.couleur), 0) / poids;
    expect(vifDecor, `chroma moyenne (pondérée par la surface) : ${vifDecor.toFixed(1)} contre ${vifPieces.toFixed(1)} pour les pièces`).toBeLessThan(0.6 * vifPieces);
    for (const { couleur, part } of couleurs.filter((c) => c.part >= SURFACE)) expect(deltaE(couleur, palette.ciel), `${couleur} (${(part * 100).toFixed(1)} %) trop loin du ciel`).toBeLessThanOrEqual(70);
  });

  it("garde la grille lisible : ses surfaces contrastent avec le cadre de la grille (au moins 3 : 1) et sont à ΔE ≥ 12 de chacune des huit couleurs de pièces", async () => {
    const d = decors.get(theme) ?? (await chargerDecorTheme(theme));
    expect(cadre.toUpperCase()).toBe((sombre ? PAPIER : ENCRE).toUpperCase());
    const pieces = FAMILLES.map((fam) => couleurDeFamille(palette, fam));
    const surfaces = couleursDuDecor(d).filter((c) => c.part >= SURFACE);
    expect(surfaces.length).toBeGreaterThan(2);
    for (const { couleur, part } of surfaces) {
      expect(couleur).toMatch(HEX);
      expect(contraste(couleur, cadre), `${theme} : ${couleur} (${(part * 100).toFixed(1)} %) contre le cadre ${cadre}`).toBeGreaterThanOrEqual(3);
      for (const [i, p] of pieces.entries()) expect(deltaE(couleur, p), `${theme} : ${couleur} contre la pièce ${FAMILLES[i]} (${p})`).toBeGreaterThanOrEqual(12);
    }
  });
});

describe("la logique des décors", () => {
  it("l'aire d'une forme : rectangle rogné à la planche, disque, polygone, trait", () => {
    expect(aire(R("#000000", 0, 0, 10, 20))).toBe(200);
    expect(aire(R("#000000", -100, -9999, 1000, 20000))).toBe(LARGEUR_PLANCHE * HAUTEUR_PLANCHE);
    expect(aire({ t: "c", c: "#000000", x: 0, y: 0, r: 2 })).toBeCloseTo(Math.PI * 4);
    expect(aire({ t: "p", c: "#000000", pts: [0, 0, 10, 0, 10, 10, 0, 10] })).toBe(100);
    expect(aire({ t: "l", c: "#000000", x1: 0, y1: 0, x2: 3, y2: 4, w: 2 })).toBe(10);
  });
  it("calmer tire une couleur vers le ciel ; déplacer et Ruban sont purs", () => {
    expect(calmer("#FF0000", "#0000FF", 0)).toBe("#FF0000");
    expect(calmer("#FF0000", "#0000FF", 1)).toBe("#0000FF");
    const formes = [R("#112233", 1, 2, 3, 4)];
    expect(deplacer(formes, 5, 6)[0]).toMatchObject({ x: 6, y: 8 });
    expect(formes[0]).toMatchObject({ x: 1, y: 2 });
    expect(Ruban("#112233", 5, [0, 0, 10, 0, 20, 5])).toHaveLength(2);
  });
});
