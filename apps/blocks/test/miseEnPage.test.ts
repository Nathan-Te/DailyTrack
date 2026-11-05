import { describe, expect, it } from "vitest";
import { COLONNES, PIECES } from "@cdj/blocks-sim";
import { BOUTON, dans, disposer, ETIQUETTE, GABARIT, LONGUEUR_MAX, metriquesPlaque, PART_SUIVANTE, sechevauchent, VALEUR_MIN, type Rect } from "../src/miseEnPage";

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
    expect(dedans(d.suivante, d.gabarit.x, d.gabarit.y) && dedans(d.suivante, d.gabarit.x + d.gabarit.w, d.gabarit.y + d.gabarit.h), "le gabarit est dans la zone de la suivante").toBe(true);
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
      // Centrée en hauteur ; en largeur aussi, à quelques pour cent près (lot B7 : la colonne des pièces, à leur échelle fixe, est plus large que celle du HUD : elle pousse la grille vers la gauche quand elle ne tient pas autrement).
      expect(Math.abs(d.grille.x + d.grille.w / 2 - w / 2)).toBeLessThanOrEqual(0.03 * w);
      expect(Math.abs(d.grille.y + d.grille.h / 2 - h / 2)).toBeLessThanOrEqual(1);
    } else expect(d.grille.w / w, "en portrait, la grille garde au moins 90 % de la largeur utile").toBeGreaterThanOrEqual(0.9);
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
      // Lot B7 : les deux zones sont dimensionnées pour la plus grande pièce à leur échelle fixe ; la colonne est centrée sur la grille et peut la dépasser un peu en haut et en bas (sans sortir de l'écran).
      expect(d.suivante.y).toBeGreaterThanOrEqual(d.main.y + d.main.h);
      expect(d.main.y).toBeGreaterThanOrEqual(0);
      expect(d.suivante.y + d.suivante.h).toBeLessThanOrEqual(h);
      expect(d.main.y + d.main.h / 2, "la colonne est à la hauteur de la grille").toBeLessThan(d.grille.y + d.grille.h / 2);
    }
  });

  it("en portrait, la grille prend presque toute la largeur (lot B7 : les deux zones, à leur échelle fixe, tiennent côte à côte), plaques et pause sur une rangée au-dessus, les deux zones dessous côte à côte, la suivante plus étroite", () => {
    for (const [W, H] of [[390, 844], [360, 640]] as const) {
      const [w, h] = utile(W, H);
      const d = disposer(w, h);
      expect(d.portrait).toBe(true);
      expect(d.grille.w).toBeGreaterThan(w - 6 * COLONNES);
      expect(d.score.y).toBe(0);
      expect(d.combo.y).toBe(0);
      expect(d.grille.y).toBeGreaterThanOrEqual(d.score.h);
      expect(d.main.y).toBeGreaterThanOrEqual(d.grille.y + d.grille.h);
      expect(d.suivante.x).toBeGreaterThanOrEqual(d.main.x + d.main.w);
      expect(d.suivante.w).toBeLessThan(d.main.w);
      expect(d.main.y + d.main.h).toBeLessThanOrEqual(h);
    }
  });

  // Lot B7 — ÉCHELLE FIXE : la pièce du moment à la taille des cases de la grille, la suivante à 60 % constants, le même pour les 40 pièces ; plus aucun ajustement à la zone.
  it.each(TAILLES)("%s : la pièce du moment est à la taille exacte des cases de la grille, la suivante à 60 % de cette taille, et ces côtés ne dépendent d'aucune pièce", (_nom, W, H) => {
    const [w, h] = utile(W, H);
    const d = disposer(w, h);
    expect(d.coteMain).toBe(d.cote);
    expect(PART_SUIVANTE).toBe(0.6);
    expect(d.coteSuivante).toBeCloseTo(d.cote * 0.6, 10);
    // Les 40 pièces : la même taille de case (il n'y a plus de fonction qui l'ajuste à la zone : `Disposition` ne donne que ces deux côtés).
    expect(PIECES).toHaveLength(40);
    for (const p of PIECES) {
      expect(d.coteMain, p.nom).toBe(d.cote);
      expect(d.coteSuivante, p.nom).toBe(d.cote * PART_SUIVANTE);
    }
  });

  it("le côté d'une case de la suivante est identique d'une taille d'écran à l'autre, à la taille de la grille près : toujours 60 % d'une case de la grille", () => {
    for (const [, W, H] of TAILLES) {
      const [w, h] = utile(W, H);
      const d = disposer(w, h);
      expect(d.coteSuivante / d.cote).toBeCloseTo(0.6, 10);
    }
  });

  it.each(TAILLES)("%s : la plus grande pièce (barre de 5 couchée ou debout, carré 3 × 3, grand L) tient dans « Ta pièce » à la taille des cases, et dans le gabarit de « Suivante » à 60 %, sans déborder", (_nom, W, H) => {
    const [w, h] = utile(W, H);
    const d = disposer(w, h);
    expect(LONGUEUR_MAX).toBe(Math.max(...PIECES.map((p) => Math.max(p.largeur, p.hauteur))));
    for (const p of PIECES) {
      // Au repos dans la zone de saisie : centrée, à la taille des cases, tout entière dans le rectangle de la zone, sous l'étiquette.
      const lx = (p.largeur * d.coteMain) / 2;
      const ly = (p.hauteur * d.coteMain) / 2;
      expect(dedans(d.main, d.centreMain.x - lx, d.centreMain.y - ly), `${p.nom} (main, coin haut-gauche)`).toBe(true);
      expect(dedans(d.main, d.centreMain.x + lx, d.centreMain.y + ly), `${p.nom} (main, coin bas-droit)`).toBe(true);
      expect(d.centreMain.y - ly, `${p.nom} : sous l'étiquette`).toBeGreaterThanOrEqual(d.main.y + ETIQUETTE);
      // Dans la zone de la suivante : centrée dans le gabarit, qui est dans la zone.
      const sx = (p.largeur * d.coteSuivante) / 2;
      const sy = (p.hauteur * d.coteSuivante) / 2;
      expect(dedans(d.gabarit, d.centreSuivante.x - sx, d.centreSuivante.y - sy), `${p.nom} (suivante, coin haut-gauche)`).toBe(true);
      expect(dedans(d.gabarit, d.centreSuivante.x + sx, d.centreSuivante.y + sy), `${p.nom} (suivante, coin bas-droit)`).toBe(true);
      expect(d.centreSuivante.y - sy, `${p.nom} : sous l'étiquette`).toBeGreaterThanOrEqual(d.suivante.y + ETIQUETTE);
    }
    // Le gabarit : 5 × 5 cases de la suivante, centré sur la pièce.
    expect(d.gabarit.w).toBeCloseTo(GABARIT * d.coteSuivante, 6);
    expect(d.gabarit.h).toBeCloseTo(GABARIT * d.coteSuivante, 6);
    expect(d.gabarit.x + d.gabarit.w / 2).toBeCloseTo(d.centreSuivante.x, 6);
    expect(d.gabarit.y + d.gabarit.h / 2).toBeCloseTo(d.centreSuivante.y, 6);
    // Les deux zones ne dépassent pas la grille (largeur, hauteur) — la plus grande pièce ne les fait pas grandir au-delà.
    for (const z of [d.main, d.suivante]) {
      expect(z.w).toBeLessThanOrEqual(d.grille.w);
      expect(z.h).toBeLessThanOrEqual(d.grille.h);
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
