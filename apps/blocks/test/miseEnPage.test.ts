import { describe, expect, it } from "vitest";
import { COLONNES, PIECES } from "@cdj/blocks-sim";
import { dans, disposer, type Rect } from "../src/miseEnPage";

const dedans = (r: Rect, x: number, y: number, marge = 0): boolean => x >= r.x - marge && y >= r.y - marge && x <= r.x + r.w + marge && y <= r.y + r.h + marge;
const TAILLES: [string, number, number][] = [["téléphone portrait", 358, 640], ["grand téléphone portrait", 358, 760], ["petit téléphone", 320, 520], ["téléphone paysage", 700, 330], ["tablette portrait", 760, 900], ["bureau", 1200, 760]];

describe("la mise en page", () => {
  it.each(TAILLES)("%s : la grille est carrée, dans la zone, et ne chevauche pas la zone de saisie", (_nom, w, h) => {
    const d = disposer(w, h);
    expect(d.grille.w).toBe(d.cote * COLONNES);
    expect(d.grille.h).toBe(d.grille.w);
    expect(dedans({ x: 0, y: 0, w, h }, d.grille.x + d.grille.w, d.grille.y + d.grille.h)).toBe(true);
    expect(d.grille.x).toBeGreaterThanOrEqual(0);
    const chevauche = d.grille.x < d.main.x + d.main.w && d.grille.x + d.grille.w > d.main.x && d.grille.y < d.main.y + d.main.h && d.grille.y + d.grille.h > d.main.y;
    expect(chevauche).toBe(false);
  });
  it("portrait : la grille prend toute la largeur (aux cases entières près) et la pièce du moment est dessous", () => {
    const d = disposer(358, 760);
    expect(d.portrait).toBe(true);
    expect(d.grille.w).toBeGreaterThan(358 - COLONNES);
    expect(d.main.y).toBeGreaterThanOrEqual(d.grille.y + d.grille.h);
  });
  it("paysage et bureau : la zone de saisie est à droite de la grille", () => {
    for (const [w, h] of [[700, 330], [1200, 760]] as const) {
      const d = disposer(w, h);
      expect(d.portrait).toBe(false);
      expect(d.main.x).toBeGreaterThanOrEqual(d.grille.x + d.grille.w);
    }
  });
  it.each(TAILLES)("%s : aucune pièce, au repos dans la zone, ne dépasse la zone de saisie ; la suivante est plus petite et ne recouvre pas la pièce du moment", (_nom, w, h) => {
    const d = disposer(w, h);
    expect(d.coteSuivante).toBeLessThan(d.coteMain);
    for (const p of PIECES) {
      const demi = { x: (p.largeur * d.coteMain) / 2, y: (p.hauteur * d.coteMain) / 2 };
      expect(dedans(d.main, d.centreMain.x - demi.x, d.centreMain.y - demi.y)).toBe(true);
      expect(dedans(d.main, d.centreMain.x + demi.x, d.centreMain.y + demi.y)).toBe(true);
      const suivante = { x: (p.largeur * d.coteSuivante) / 2, y: (p.hauteur * d.coteSuivante) / 2 };
      expect(dedans(d.main, d.centreSuivante.x - suivante.x, d.centreSuivante.y - suivante.y)).toBe(true);
      expect(dedans(d.main, d.centreSuivante.x + suivante.x, d.centreSuivante.y + suivante.y)).toBe(true);
    }
    // La plus grande pièce du moment (5 cases) et la plus grande suivante (5 cases) ne se recouvrent pas.
    const m = { gauche: d.centreMain.x - (5 * d.coteMain) / 2, droite: d.centreMain.x + (5 * d.coteMain) / 2, haut: d.centreMain.y - (5 * d.coteMain) / 2 };
    const s = { gauche: d.centreSuivante.x - (5 * d.coteSuivante) / 2, bas: d.centreSuivante.y + (5 * d.coteSuivante) / 2 };
    expect(m.droite <= s.gauche || m.haut >= s.bas).toBe(true);
  });
  it("une case de la zone de saisie est tactile : la zone fait au moins 44 px dans les deux sens sur un téléphone", () => {
    const d = disposer(358, 640);
    expect(d.main.w).toBeGreaterThanOrEqual(44);
    expect(d.main.h).toBeGreaterThanOrEqual(44);
    expect(dans(d.main, d.centreMain.x, d.centreMain.y)).toBe(true);
  });
});
