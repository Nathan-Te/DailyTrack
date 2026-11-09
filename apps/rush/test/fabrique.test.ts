import { afterEach, describe, expect, it } from "vitest";
import { BoxGeometry } from "three";
import { GENRES, HAUTEUR_MAX_MUR, VARIANTES, brancher, debrancher, fabriquer, fondre, hauteurDe, rail } from "../src/fabrique";
import { PALETTES } from "../src/palette";
import { THEMES_VUS } from "../src/niveauVue";

// La fabrique de pièces du décor (lot BR-A2), sans navigateur : de la géométrie.
const ctx = (theme: (typeof THEMES_VUS)[number]) => ({ a: PALETTES[theme]!, theme });
const triangles = (g: { index: { count: number } | null; getAttribute(n: string): { count: number } }): number => (g.index ? g.index.count : g.getAttribute("position").count) / 3;

describe("la fabrique de pièces du décor (lot BR-A2)", () => {
  afterEach(() => debrancher());
  for (const theme of THEMES_VUS) {
    describe(theme, () => {
      it("fabrique chaque genre et chaque variante : position, normale, couleur et vent, sans rien d'infini", () => {
        for (const genre of GENRES) {
          for (let v = 0; v < VARIANTES[genre]; v++) {
            const g = fabriquer(genre, ctx(theme), v);
            for (const attribut of ["position", "normal", "color", "vent"]) expect(g.getAttribute(attribut), `${genre} ${v} : ${attribut}`).toBeDefined();
            const p = g.getAttribute("position");
            expect(p.count % 3, `${genre} ${v} : des triangles entiers`).toBe(0);
            for (let i = 0; i < p.count; i++) expect(Number.isFinite(p.getX(i) + p.getY(i) + p.getZ(i)), `${genre} ${v}`).toBe(true);
            expect(g.getAttribute("vent").count).toBe(p.count);
          }
        }
      });
      it("rend la même pièce à chaque demande (mise en mémoire) et se plie au nombre de variantes", () => {
        expect(fabriquer("arbre", ctx(theme), 1)).toBe(fabriquer("arbre", ctx(theme), 1));
        expect(fabriquer("arbre", ctx(theme), 1)).toBe(fabriquer("arbre", ctx(theme), 1 + VARIANTES.arbre));
        expect(fabriquer("arbre", ctx(theme), -1)).toBe(fabriquer("arbre", ctx(theme), VARIANTES.arbre - 1));
      });
      it("les pièces posées sur un mur restent basses : le poteau, la haie et le rocher (à l'échelle des murs de la carrière) ne dépassent pas 1,3 m", () => {
        expect(hauteurDe(fabriquer("poteau", ctx(theme), 0))).toBeLessThanOrEqual(HAUTEUR_MAX_MUR);
        for (let v = 0; v < VARIANTES.poteau; v++) expect(hauteurDe(fabriquer("poteau", ctx(theme), v)), `poteau ${v}`).toBeLessThanOrEqual(HAUTEUR_MAX_MUR - 0.05);
        for (let v = 0; v < VARIANTES.haie; v++) expect(hauteurDe(fabriquer("haie", ctx(theme), v)), `haie ${v}`).toBeLessThanOrEqual(HAUTEUR_MAX_MUR - 0.05);
      });
      it("les pièces grandes (arbre, pilier) dépassent un mur ; elles servent d'habillage et d'entrée, jamais de mur", () => {
        for (let v = 0; v < VARIANTES.arbre; v++) expect(hauteurDe(fabriquer("arbre", ctx(theme), v))).toBeGreaterThan(3);
        expect(hauteurDe(fabriquer("pilier", ctx(theme), 0))).toBeGreaterThan(4);
      });
      it("pèse peu : une pièce de mur ou de végétation tient sous 400 triangles (un niveau en pose des centaines)", () => {
        for (const genre of ["poteau", "haie", "buisson", "herbeHaute", "fleurs", "fougere", "rocher", "champignons", "souche"] as const)
          for (let v = 0; v < VARIANTES[genre]; v++) expect(triangles(fabriquer(genre, ctx(theme), v)), `${genre} ${v}`).toBeLessThan(400);
      });
    });
  }
  it("la végétation bouge au vent (un attribut `vent` de 0 au pied à plus de 0 en haut) ; un poteau ou un rocher ne bouge pas", () => {
    const max = (g: ReturnType<typeof fabriquer>): number => Math.max(...(g.getAttribute("vent").array as Float32Array));
    for (const genre of ["herbeHaute", "fleurs", "buisson", "arbre"] as const) expect(max(fabriquer(genre, ctx("prairie"), 0)), genre).toBeGreaterThan(0.1);
    for (const genre of ["poteau", "rocher", "haie", "pilier"] as const) expect(max(fabriquer(genre, ctx("prairie"), 0)), genre).toBe(0);
    const pied = fabriquer("herbeHaute", ctx("prairie"), 0);
    const p = pied.getAttribute("position");
    const v = pied.getAttribute("vent");
    for (let i = 0; i < p.count; i++) if (p.getY(i) < 0.01) expect(v.getX(i)).toBeLessThan(0.05);
  });
  it("on y branche un modèle à la place d'une pièce (la fabrique rend le modèle, avec un `vent` ajouté s'il manque) ; `debrancher` rend les pièces d'origine", () => {
    const origine = fabriquer("arbre", ctx("prairie"), 0);
    brancher("arbre", () => fondre([new BoxGeometry(1, 7, 1).translate(0, 3.5, 0)]));
    const modele = fabriquer("arbre", ctx("prairie"), 0);
    expect(modele).not.toBe(origine);
    expect(hauteurDe(modele)).toBeCloseTo(7, 5);
    expect(modele.getAttribute("vent")).toBeDefined();
    brancher("arbre", () => new BoxGeometry(1, 2, 1).translate(0, 1, 0)); // un modèle sans couleur ni vent : la fabrique complète le vent
    expect(fabriquer("arbre", ctx("prairie"), 0).getAttribute("vent")).toBeDefined();
    debrancher();
    expect(hauteurDe(fabriquer("arbre", ctx("prairie"), 0))).toBeCloseTo(hauteurDe(origine), 5);
  });
  it("une lisse de muret a la longueur demandée, posée de bout en bout le long de x", () => {
    const g = rail(ctx("prairie"), 3.3);
    g.computeBoundingBox();
    expect(g.boundingBox!.max.x - g.boundingBox!.min.x).toBeCloseTo(3.3, 5);
    expect(rail(ctx("prairie"), 3.3)).toBe(g);
  });
});
