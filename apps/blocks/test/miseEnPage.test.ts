import { describe, expect, it } from "vitest";
import { COLONNES, PIECES } from "@cdj/blocks-sim";
import { BOUTON, coteEnMain, coteEnSuivante, dans, disposer, ETIQUETTE, metriquesPlaque, sechevauchent, VALEUR_MIN, type Rect } from "../src/miseEnPage";

// Lot B5 — la mise en page sur les sept tailles de la recette (2560 × 1440 … 360 × 640). Les entrées sont la zone UTILE de la scène : l'écran moins les marges de 8 px de chaque côté (`.jeu-plateau`).
const MARGE_ECRAN = 8;
const TAILLES: [string, number, number, boolean][] = [
  ["2560 × 1440", 2560, 1440, false],
  ["1920 × 1080", 1920, 1080, false],
  ["1366 × 768", 1366, 768, false],
  ["1280 × 720", 1280, 720, false],
  ["844 × 390 (téléphone en paysage)", 844, 390, false],
  ["390 × 844 (téléphone en portrait)", 390, 844, true],
  ["360 × 640 (petit téléphone)", 360, 640, true],
];
const utile = (w: number, h: number): [number, number] => [w - 2 * MARGE_ECRAN, h - 2 * MARGE_ECRAN];
const dedans = (r: Rect, x: number, y: number): boolean => x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;

describe("la mise en page (maquette A, à l'échelle du PC et du téléphone)", () => {
  it.each(TAILLES)("%s : la grille est carrée, la disposition est la bonne, tout est dans l'écran et rien ne se recouvre", (_nom, W, H, portrait) => {
    const [w, h] = utile(W, H);
    const d = disposer(w, h);
    expect(d.portrait).toBe(portrait);
    expect(d.grille.w).toBe(d.cote * COLONNES);
    expect(d.grille.h).toBe(d.grille.w);
    const ecran = { x: 0, y: 0, w, h };
    const rects: [string, Rect][] = [["grille", d.grille], ["main", d.main], ["suivante", d.suivante], ["score", d.score], ["combo", d.combo], ["boutons", d.boutons]];
    for (const [nom, r] of rects) {
      expect(dedans(ecran, r.x, r.y), `${nom} : coin haut-gauche`).toBe(true);
      expect(dedans(ecran, r.x + r.w, r.y + r.h), `${nom} : coin bas-droit`).toBe(true);
    }
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(sechevauchent(rects[i]![1], rects[j]![1]), `${rects[i]![0]} / ${rects[j]![0]}`).toBe(false);
    expect(d.aide.h === 0 || !sechevauchent(d.aide, d.grille)).toBe(true);
  });

  it.each(TAILLES)("%s : la grille occupe au moins 70 % de la plus petite dimension utile ; au PC en paysage, environ 80 % de la hauteur, centrée", (_nom, W, H, portrait) => {
    const [w, h] = utile(W, H);
    const d = disposer(w, h);
    expect(d.grille.w / Math.min(w, h)).toBeGreaterThanOrEqual(0.7);
    if (!portrait) {
      expect(d.grille.h / h).toBeGreaterThan(0.77);
      expect(d.grille.h / h).toBeLessThanOrEqual(0.8);
      expect(Math.abs(d.grille.x + d.grille.w / 2 - w / 2)).toBeLessThanOrEqual(1); // centrée
      expect(Math.abs(d.grille.y + d.grille.h / 2 - h / 2)).toBeLessThanOrEqual(1);
    }
  });

  it.each(TAILLES)("%s : les zones de la pièce du moment et de la suivante ne sont jamais plus grandes que la grille (ni en largeur, ni en hauteur, ni en surface)", (_nom, W, H) => {
    const [w, h] = utile(W, H);
    const d = disposer(w, h);
    for (const z of [d.main, d.suivante]) {
      expect(z.w).toBeLessThanOrEqual(d.grille.w);
      expect(z.h).toBeLessThanOrEqual(d.grille.h);
      expect(z.w * z.h).toBeLessThan(d.grille.w * d.grille.h);
    }
    expect(d.main.w * d.main.h + d.suivante.w * d.suivante.h).toBeLessThan(d.grille.w * d.grille.h); // à elles deux aussi : « Ta pièce » et « Suivante » n'occupent plus les deux tiers de l'écran
  });

  it.each(TAILLES)("%s : le HUD est lisible (valeurs au moins 18 px, étiquettes au moins 12 px) et ses plaques tiennent dans leur rectangle", (_nom, W, H) => {
    const [w, h] = utile(W, H);
    const d = disposer(w, h);
    for (const p of [d.score, d.combo]) {
      const m = metriquesPlaque(p.h);
      expect(m.etiquette).toBeGreaterThanOrEqual(12);
      expect(m.valeur).toBeGreaterThanOrEqual(VALEUR_MIN);
      expect(m.valeur).toBeGreaterThanOrEqual(20);
      expect(m.pad + m.etiquette + m.valeur + m.pad, "étiquette et valeur ne se chevauchent pas").toBeLessThanOrEqual(p.h * 1.02);
      expect(p.w, "un score de huit chiffres tient (police à chasse fixe de 0,6 em)").toBeGreaterThanOrEqual(2 * m.pad + 8 * 0.6 * VALEUR_MIN + 4);
    }
  });

  it("au PC en paysage, le HUD est collé à la grille (à gauche), et la pièce du moment avec la suivante à droite, au bord de la grille", () => {
    for (const [W, H] of [[2560, 1440], [1920, 1080], [1366, 768], [1280, 720], [844, 390]] as const) {
      const [w, h] = utile(W, H);
      const d = disposer(w, h);
      expect(d.portrait).toBe(false);
      const ecart = d.grille.x - (d.score.x + d.score.w);
      expect(ecart).toBeGreaterThanOrEqual(0);
      expect(ecart).toBeLessThanOrEqual(20);
      expect(d.combo.y).toBeGreaterThanOrEqual(d.score.y + d.score.h);
      const ecartD = d.main.x - (d.grille.x + d.grille.w);
      expect(ecartD).toBeGreaterThanOrEqual(0);
      expect(ecartD).toBeLessThanOrEqual(20);
      expect(d.main.y).toBe(d.grille.y);
      expect(d.suivante.y).toBeGreaterThanOrEqual(d.main.y + d.main.h);
      expect(d.suivante.y + d.suivante.h).toBeLessThanOrEqual(d.grille.y + d.grille.h);
    }
  });

  it("en portrait, la grille prend toute la largeur (aux cases entières près), plaques et pause sur une rangée au-dessus, les deux zones dessous côte à côte, la suivante plus étroite", () => {
    for (const [W, H] of [[390, 844], [360, 640]] as const) {
      const [w, h] = utile(W, H);
      const d = disposer(w, h);
      expect(d.portrait).toBe(true);
      expect(d.grille.w).toBeGreaterThan(w - COLONNES);
      expect(d.score.y).toBe(0);
      expect(d.combo.y).toBe(0);
      expect(d.grille.y).toBeGreaterThanOrEqual(d.score.h);
      expect(d.main.y).toBeGreaterThanOrEqual(d.grille.y + d.grille.h);
      expect(d.suivante.x).toBeGreaterThanOrEqual(d.main.x + d.main.w);
      expect(d.suivante.w).toBeLessThan(d.main.w);
      expect(d.main.y + d.main.h).toBeLessThanOrEqual(h);
    }
  });

  it.each(TAILLES)("%s : chaque pièce tient, au repos, dans sa zone — celle du moment à la taille des cases au plus, la suivante plus petite", (_nom, W, H) => {
    const [w, h] = utile(W, H);
    const d = disposer(w, h);
    expect(d.coteSuivante).toBeLessThan(d.coteMain);
    expect(d.coteMain).toBeLessThanOrEqual(d.cote);
    for (const p of PIECES) {
      const c = coteEnMain(d, p);
      const demi = { x: (p.largeur * c) / 2, y: (p.hauteur * c) / 2 };
      expect(dedans(d.main, d.centreMain.x - demi.x, d.centreMain.y - demi.y), p.nom).toBe(true);
      expect(dedans(d.main, d.centreMain.x + demi.x, d.centreMain.y + demi.y), p.nom).toBe(true);
      expect(c, p.nom).toBeLessThanOrEqual(d.cote);
      if (p.largeur <= 3 && p.hauteur <= 3) expect(c, `${p.nom} : une pièce de 3 cases au plus se pose à la taille des cases`).toBe(d.cote);
      const s = coteEnSuivante(d, p);
      expect(s, p.nom).toBeLessThanOrEqual(c);
      expect(dedans(d.suivante, d.centreSuivante.x - (p.largeur * s) / 2, d.centreSuivante.y - (p.hauteur * s) / 2), p.nom).toBe(true);
      expect(dedans(d.suivante, d.centreSuivante.x + (p.largeur * s) / 2, d.centreSuivante.y + (p.hauteur * s) / 2), p.nom).toBe(true);
    }
  });

  it("l'étiquette d'une zone a sa place (12 px et sa marge) et une zone de saisie est tactile : au moins 44 px dans les deux sens, son centre est dedans", () => {
    expect(ETIQUETTE).toBeGreaterThanOrEqual(12 + 8);
    for (const [W, H] of [[360, 640], [844, 390]] as const) {
      const [w, h] = utile(W, H);
      const d = disposer(w, h);
      expect(d.main.w).toBeGreaterThanOrEqual(BOUTON);
      expect(d.main.h).toBeGreaterThanOrEqual(BOUTON);
      expect(dans(d.main, d.centreMain.x, d.centreMain.y)).toBe(true);
    }
  });

  it("le bouton pause du kit (en haut à droite) ne recouvre rien, avec ses marges de sécurité", () => {
    for (const [W, H] of TAILLES.map(([, a, b]) => [a, b] as const)) {
      const [w, h] = utile(W, H);
      const d = disposer(w, h);
      for (const r of [d.grille, d.main, d.suivante, d.score, d.combo]) expect(sechevauchent(r, d.boutons)).toBe(false);
    }
  });
});
