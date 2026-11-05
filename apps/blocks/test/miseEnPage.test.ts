import { describe, expect, it } from "vitest";
import { COLONNES, PIECES } from "@cdj/blocks-sim";
import { BOUTON, coteEnMain, coteEnSuivante, dans, disposer, sechevauchent, type Rect } from "../src/miseEnPage";

const dedans = (r: Rect, x: number, y: number, marge = 0): boolean => x >= r.x - marge && y >= r.y - marge && x <= r.x + r.w + marge && y <= r.y + r.h + marge;
const TAILLES: [string, number, number][] = [["téléphone portrait", 374, 800], ["grand téléphone portrait", 374, 760], ["petit téléphone", 344, 560], ["téléphone paysage", 828, 372], ["petit paysage", 624, 342], ["tablette portrait", 760, 900], ["bureau", 1264, 702]];

describe("la mise en page (maquette A)", () => {
  it.each(TAILLES)("%s : la grille est carrée, dans l'écran, et rien ne se recouvre (grille, zones, plaques, boutons du kit)", (_nom, w, h) => {
    const d = disposer(w, h);
    expect(d.grille.w).toBe(d.cote * COLONNES);
    expect(d.grille.h).toBe(d.grille.w);
    const ecran = { x: 0, y: 0, w, h };
    const rects: [string, Rect][] = [["grille", d.grille], ["main", d.main], ["suivante", d.suivante], ["score", d.score], ["combo", d.combo], ["boutons", d.boutons]];
    for (const [nom, r] of rects) {
      expect(dedans(ecran, r.x, r.y), `${nom} : coin haut-gauche`).toBe(true);
      expect(dedans(ecran, r.x + r.w, r.y + r.h), `${nom} : coin bas-droit`).toBe(true);
    }
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(sechevauchent(rects[i]![1], rects[j]![1]), `${rects[i]![0]} / ${rects[j]![0]}`).toBe(false);
  });
  it("portrait : la grille prend toute la largeur (aux cases entières près), les plaques et les boutons sont sur une rangée au-dessus, les deux zones dessous côte à côte", () => {
    const d = disposer(374, 800);
    expect(d.portrait).toBe(true);
    expect(d.grille.w).toBeGreaterThan(374 - COLONNES);
    expect([d.score.y, d.combo.y, d.boutons.y]).toEqual([0, 0, 0]);
    expect(d.score.h).toBe(BOUTON);
    expect(d.grille.y).toBeGreaterThanOrEqual(BOUTON);
    expect(d.main.y).toBeGreaterThanOrEqual(d.grille.y + d.grille.h);
    expect(d.suivante.x).toBeGreaterThanOrEqual(d.main.x + d.main.w);
    expect(d.suivante.w).toBeLessThan(d.main.w);
  });
  it("paysage et bureau : score et combo à gauche de la grille, la zone de saisie à droite et la suivante dessous", () => {
    for (const [w, h] of [[828, 372], [1264, 702]] as const) {
      const d = disposer(w, h);
      expect(d.portrait).toBe(false);
      expect(d.score.x + d.score.w).toBeLessThanOrEqual(d.grille.x);
      expect(d.combo.y).toBeGreaterThanOrEqual(d.score.y + d.score.h);
      expect(d.main.x).toBeGreaterThanOrEqual(d.grille.x + d.grille.w);
      expect(d.suivante.y).toBeGreaterThanOrEqual(d.main.y + d.main.h);
      expect(d.main.y).toBeGreaterThanOrEqual(BOUTON); // sous les boutons du kit
    }
  });
  it.each(TAILLES)("%s : chaque pièce tient, au repos, dans sa zone (celle du moment dans la zone de saisie, la suivante, plus petite, dans la sienne)", (_nom, w, h) => {
    const d = disposer(w, h);
    expect(d.coteSuivante).toBeLessThan(d.coteMain);
    for (const p of PIECES) {
      const c = coteEnMain(d, p);
      const demi = { x: (p.largeur * c) / 2, y: (p.hauteur * c) / 2 };
      expect(dedans(d.main, d.centreMain.x - demi.x, d.centreMain.y - demi.y), p.nom).toBe(true);
      expect(dedans(d.main, d.centreMain.x + demi.x, d.centreMain.y + demi.y), p.nom).toBe(true);
      expect(c, p.nom).toBeLessThanOrEqual(d.cote);
      const s = coteEnSuivante(d, p);
      expect(s, p.nom).toBeLessThanOrEqual(c); // jamais plus grande que celle du moment (une barre verticale, bornée par la hauteur des deux zones, peut être aussi grande)
      expect(dedans(d.suivante, d.centreSuivante.x - (p.largeur * s) / 2, d.centreSuivante.y - (p.hauteur * s) / 2), p.nom).toBe(true);
      expect(dedans(d.suivante, d.centreSuivante.x + (p.largeur * s) / 2, d.centreSuivante.y + (p.hauteur * s) / 2), p.nom).toBe(true);
    }
  });
  it("une zone de saisie est tactile : au moins 44 px dans les deux sens sur un téléphone, et son centre est dedans", () => {
    for (const [w, h] of [[344, 560], [624, 342]] as const) {
      const d = disposer(w, h);
      expect(d.main.w).toBeGreaterThanOrEqual(BOUTON);
      expect(d.main.h).toBeGreaterThanOrEqual(BOUTON);
      expect(dans(d.main, d.centreMain.x, d.centreMain.y)).toBe(true);
    }
  });
});

describe("la plaque du fantôme (lot B4)", () => {
  it.each(TAILLES)("%s : sans fantôme rien ne change (pas de plaque) ; avec, elle est dans l'écran et ne recouvre ni la grille, ni les zones, ni les autres plaques, ni les boutons du kit", (_nom, w, h) => {
    const sans = disposer(w, h);
    expect(sans.fantome).toBeNull();
    expect(disposer(w, h, false)).toEqual(sans);
    const d = disposer(w, h, true);
    const f = d.fantome!;
    expect(f).not.toBeNull();
    const ecran = { x: 0, y: 0, w, h };
    expect(dedans(ecran, f.x, f.y) && dedans(ecran, f.x + f.w, f.y + f.h)).toBe(true);
    for (const [nom, r] of [["grille", d.grille], ["main", d.main], ["suivante", d.suivante], ["score", d.score], ["combo", d.combo], ["boutons", d.boutons]] as [string, Rect][]) expect(sechevauchent(f, r), `fantôme / ${nom}`).toBe(false);
    expect(d.grille).toEqual(sans.grille); // la grille ne bouge pas quand un fantôme apparaît
  });
});
