import { describe, expect, it } from "vitest";
import { PREMIER_JOUR_RUSH, dailyRush } from "@cdj/rush-sim";
import { CASE, MUR, SOL, VIDE, Z_ARENE, Z_PORTE } from "@cdj/rush-sim/niveau";
import { DALLE, masqueDuNiveau, texel } from "../src/sol";

// Le masque du sol du niveau (lot BR-A2), sans navigateur : dalles dans l'arène et la salle d'épreuve, terre sur les autres sols, herbe sur les murs bas et sur les bords.
describe("le masque du sol du niveau (lot BR-A2)", () => {
  const n = dailyRush(PREMIER_JOUR_RUSH + 2).niveau!;
  const m = masqueDuNiveau(n);
  const E = n.epreuve;
  it("a un texel par case, et une dalle fait une case (2 m)", () => {
    expect(m.l).toBe(n.l);
    expect(m.h).toBe(n.h);
    expect(m.data.length).toBe(n.l * n.h * 4);
    expect(DALLE).toBe(2);
  });
  it("les dalles couvrent l'arène et la salle d'épreuve (au centre de la salle : des dalles, pas de terre) ; la porte de l'arène reste de la terre", () => {
    let arene = 0;
    let porte = 0;
    for (let j = 0; j < n.h; j++)
      for (let i = 0; i < n.l; i++) {
        const k = j * n.l + i;
        if (n.cases[k] === SOL && n.zones[k] === Z_ARENE) {
          arene++;
          expect(texel(m, i, j)[0], `arène ${i},${j}`).toBe(255);
        }
        if (n.zones[k] === Z_PORTE) {
          porte++;
          expect(texel(m, i, j)[0], `porte ${i},${j}`).toBe(0);
          expect(texel(m, i, j)[1], `porte ${i},${j}`).toBe(255);
        }
      }
    expect(arene).toBeGreaterThan(100);
    expect(porte).toBeGreaterThan(0);
    const ci = Math.floor((E.x - n.ox) / CASE);
    const cj = Math.floor((E.y - n.oy) / CASE);
    expect(texel(m, ci, cj)[0], "centre de la salle d'épreuve").toBe(255);
  });
  it("la terre couvre les chemins et les clairières hors dalles ; l'herbe, les murs bas (entièrement) et le bord des cases marchables (à moitié)", () => {
    let terre = 0;
    let herbeMurs = 0;
    let bordMoitie = 0;
    for (let j = 0; j < n.h; j++)
      for (let i = 0; i < n.l; i++) {
        const t = n.cases[j * n.l + i]!;
        const [r, g, b] = texel(m, i, j);
        if (t === MUR) {
          expect(b, `mur ${i},${j}`).toBe(255);
          herbeMurs++;
        } else if (t === SOL && r === 0) {
          expect(g, `sol ${i},${j}`).toBe(255);
          terre++;
          if (b === 140) bordMoitie++;
        }
      }
    expect(terre).toBeGreaterThan(200);
    expect(herbeMurs).toBeGreaterThan(100);
    expect(bordMoitie).toBeGreaterThan(50);
  });
  it("le vide prend l'herbe de ses voisines (le bord de la falaise a sa lèvre) et reste nu partout ailleurs", () => {
    let pres = 0;
    let loin = 0;
    const type = (i: number, j: number): number => (i < 0 || j < 0 || i >= n.l || j >= n.h ? VIDE : n.cases[j * n.l + i]!);
    for (let j = 0; j < n.h; j++)
      for (let i = 0; i < n.l; i++) {
        if (type(i, j) !== VIDE) continue;
        const toucheLeSol = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([di, dj]) => type(i + di!, j + dj!) !== VIDE);
        const b = texel(m, i, j)[2];
        if (toucheLeSol) {
          pres++;
          expect(b).toBe(255);
        } else {
          loin++;
          expect(b).toBe(0);
        }
      }
    expect(pres).toBeGreaterThan(100);
    expect(loin).toBeGreaterThan(100);
  });
  it("est déterministe", () => {
    expect(masqueDuNiveau(n).data).toEqual(m.data);
  });
});
