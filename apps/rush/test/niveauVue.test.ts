import { describe, expect, it } from "vitest";
import { PREMIER_JOUR_RUSH, dailyRush } from "@cdj/rush-sim";
import { CASE, MUR, PONT, SOL, type Niveau } from "@cdj/rush-sim/niveau";
import { M } from "@cdj/rush-sim/constantes";
import { MUR_MAX, PAS_MORCEAU, THEMES_VUS, construireNiveau, hauteurDesMurs } from "../src/niveauVue";
import { PALETTES } from "../src/palette";

// Le décor du niveau (lot BR1), sans navigateur : de la géométrie construite d'après la grille.
const triangles = (g: { index: { count: number } | null; getAttribute(n: string): { count: number } } | null): number => (g ? (g.index ? g.index.count : g.getAttribute("position").count) / 3 : 0);
const type = (n: Niveau, x: number, z: number): number => {
  const i = Math.floor((x * M - n.ox) / CASE);
  const j = Math.floor((z * M - n.oy) / CASE);
  return i < 0 || j < 0 || i >= n.l || j >= n.h ? 2 : n.cases[j * n.l + i]!;
};

describe("le décor du niveau (lot BR1)", () => {
  for (const theme of THEMES_VUS) {
    describe(theme, () => {
      const c = dailyRush(PREMIER_JOUR_RUSH + 2);
      const n = c.niveau!;
      const r = construireNiveau(n, PALETTES[theme]!, theme);
      it("est regroupé par morceaux de 16 × 16 cases : au plus quatre maillages par morceau (sol, relief, végétation, hauts), jamais un par case", () => {
        const possibles = Math.ceil(n.l / PAS_MORCEAU) * Math.ceil(n.h / PAS_MORCEAU);
        expect(r.morceaux.length).toBeLessThanOrEqual(possibles);
        const maillages = r.morceaux.reduce((s, m) => s + (m.sol ? 1 : 0) + (m.relief ? 1 : 0) + (m.vegetation ? 1 : 0) + (m.hauts ? 1 : 0), 0);
        expect(maillages).toBeLessThanOrEqual(4 * r.morceaux.length);
        const cases = n.cases.reduce((s, k) => s + (k === SOL || k === MUR || k === PONT ? 1 : 0), 0);
        expect(maillages).toBeLessThan(cases / 8);
      });
      it("pèse peu : le niveau entier tient sous 400 000 triangles (lot BR1b : les boucles étalent le niveau ; le moteur coupe les morceaux hors du champ ; lot BR-A2 : un décor plus dense) et un morceau sous 30 000 (un écran n'en montre que quatre ou cinq)", () => {
        let total = 0;
        for (const m of r.morceaux) {
          const t = triangles(m.sol) + triangles(m.relief) + triangles(m.vegetation) + triangles(m.hauts);
          total += t;
          expect(t).toBeLessThan(30000);
        }
        expect(total).toBeLessThan(400000);
      });
      it("les murs bas ne dépassent pas 1,3 m", () => {
        expect(hauteurDesMurs(theme)).toBeLessThanOrEqual(MUR_MAX);
      });
      it("rien ne se dresse au milieu d'une clairière ou d'un chemin : tout ce qui est bas (sous 1,8 m) touche un mur ou un pont", () => {
        for (const m of r.morceaux) {
          for (const g of [m.relief, m.vegetation]) {
            if (!g) continue;
            const p = g.getAttribute("position");
            for (let k = 0; k < p.count; k += 3) {
              const x = p.getX(k);
              const y = p.getY(k);
              const z = p.getZ(k);
              if (y < 0.3 || y > 1.8) continue;
              if (type(n, x, z) === SOL) {
                // (lot BR6 : un rocher isolé est posé à une case de tout mur et déborde de la sienne : avec 0,55 m, un jour de la carrière faisait échouer le test pour un rocher à une case d'une haie ; on vérifie qu'aucun élément ne se dresse à plus d'une case — 2 m — d'un mur)
                // (lot BR-A2 : les diagonales aussi — un buisson posé près du coin d'une case de mur déborde sur la case voisine)
                const voisin = [[2.05, 0], [-2.05, 0], [0, 2.05], [0, -2.05], [2.05, 2.05], [-2.05, 2.05], [2.05, -2.05], [-2.05, -2.05], [0.55, 0], [-0.55, 0], [0, 0.55], [0, -0.55]].some(([dx, dz]) => [MUR, PONT].includes(type(n, x + dx!, z + dz!)));
                expect(voisin, `un élément bas à (${x.toFixed(1)}, ${z.toFixed(1)}) sur le sol`).toBe(true);
              }
            }
          }
        }
      });
      it("pose du décor sur les murs, de façon déterministe", () => {
        expect(r.stats.murs).toBeGreaterThan(50);
        expect(r.stats.decors).toBeGreaterThan(r.stats.murs / 2); // lot BR-A2 : un bord hors jeu dense (les petites pièces ne sont pas toutes posées)
        expect(r.stats.decors).toBeLessThan(r.stats.murs * 3);
        expect(construireNiveau(n, PALETTES[theme]!, theme).stats).toEqual(r.stats);
      });
    });
  }
});
