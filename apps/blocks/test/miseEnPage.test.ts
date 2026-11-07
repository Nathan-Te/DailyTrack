import { describe, expect, it } from "vitest";
import { COLONNES, PIECES } from "@cdj/blocks-sim";
import { BOUTON, dans, disposer, ETIQUETTE, LONGUEUR_MAX, metriquesPlaque, PART_PLATEAU, sechevauchent, VALEUR_MIN, type Rect } from "../src/miseEnPage";

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
    const rects: [string, Rect][] = [["grille", d.grille], ["plateau", d.plateau], ["score", d.score], ["combo", d.combo], ["boutons", d.boutons]];
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
      // Centrée en hauteur ; en largeur aussi, à quelques pour cent près (la colonne des pièces peut pousser la grille vers la gauche quand elle ne tient pas autrement).
      expect(Math.abs(d.grille.x + d.grille.w / 2 - w / 2)).toBeLessThanOrEqual(0.03 * w);
      expect(Math.abs(d.grille.y + d.grille.h / 2 - h / 2)).toBeLessThanOrEqual(1);
    } else expect(d.grille.w / w, "en portrait, la grille garde au moins 90 % de la largeur utile").toBeGreaterThanOrEqual(0.9);
  });

  it.each(TAILLES)("%s : le plateau des trois pièces et chacun de ses emplacements restent plus petits que la grille", (_nom, W, H) => {
    const [w, h] = utile(W, H);
    const d = disposer(w, h);
    expect(d.plateau.w * d.plateau.h).toBeLessThan(d.grille.w * d.grille.h);
    expect(d.plateau.w).toBeLessThanOrEqual(Math.max(d.grille.w, w));
    for (const e of d.emplacements) {
      expect(e.w).toBeLessThanOrEqual(d.grille.w / 2);
      expect(e.h).toBeLessThanOrEqual(d.grille.h / 2);
    }
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

  it("au PC en paysage, le HUD est collé à la grille (à gauche), et le plateau des trois pièces à droite, au bord de la grille, les trois emplacements l'un sous l'autre", () => {
    for (const [W, H] of [[2560, 1440], [1920, 1080], [1366, 768], [1280, 720], [844, 390]] as const) {
      const [w, h] = utile(W, H);
      const d = disposer(w, h);
      expect(d.portrait).toBe(false);
      const ecart = d.grille.x - (d.score.x + d.score.w);
      expect(ecart).toBeGreaterThanOrEqual(0);
      expect(ecart).toBeLessThanOrEqual(20);
      expect(d.combo.y).toBeGreaterThanOrEqual(d.score.y + d.score.h);
      const ecartD = d.plateau.x - (d.grille.x + d.grille.w);
      expect(ecartD).toBeGreaterThanOrEqual(0);
      expect(ecartD).toBeLessThanOrEqual(20);
      // La colonne est centrée sur la grille et peut la dépasser un peu en haut et en bas (sans sortir de l'écran) ; les emplacements sont rangés de haut en bas, sous l'étiquette, sans se toucher.
      expect(d.plateau.y).toBeGreaterThanOrEqual(0);
      expect(d.plateau.y + d.plateau.h).toBeLessThanOrEqual(h);
      expect(d.emplacements[0].y).toBeGreaterThanOrEqual(d.plateau.y + ETIQUETTE);
      for (let k = 1; k < 3; k++) expect(d.emplacements[k]!.y).toBeGreaterThan(d.emplacements[k - 1]!.y + d.emplacements[k - 1]!.h - 1);
      expect(d.emplacements.every((e) => e.x === d.emplacements[0].x)).toBe(true);
      expect(d.plateau.y + d.plateau.h / 2, "la colonne est à la hauteur de la grille").toBeLessThan(d.grille.y + d.grille.h / 2 + 1);
    }
  });

  it("en portrait, la grille prend presque toute la largeur, plaques et pause sur une rangée au-dessus, le plateau dessous avec ses trois emplacements côte à côte", () => {
    for (const [W, H] of [[390, 844], [360, 640]] as const) {
      const [w, h] = utile(W, H);
      const d = disposer(w, h);
      expect(d.portrait).toBe(true);
      expect(d.grille.w).toBeGreaterThan(w - 6 * COLONNES);
      expect(d.score.y).toBe(0);
      expect(d.combo.y).toBe(0);
      expect(d.grille.y).toBeGreaterThanOrEqual(d.score.h);
      expect(d.plateau.y).toBeGreaterThanOrEqual(d.grille.y + d.grille.h);
      expect(d.plateau.y + d.plateau.h).toBeLessThanOrEqual(h);
      for (let k = 1; k < 3; k++) expect(d.emplacements[k]!.x).toBeGreaterThan(d.emplacements[k - 1]!.x + d.emplacements[k - 1]!.w - 1);
      expect(d.emplacements.every((e) => e.y === d.emplacements[0].y && e.w === d.emplacements[0].w)).toBe(true);
      expect(d.emplacements[2].x + d.emplacements[2].w).toBeLessThanOrEqual(d.plateau.x + d.plateau.w);
    }
  });

  // Lot B8 — ÉCHELLE FIXE : les trois pièces à `PART_PLATEAU` des cases de la grille, le même pour les 40 pièces ; jamais ajustée à la taille de la pièce ni de l'emplacement.
  it.each(TAILLES)("%s : les trois pièces sont à la même échelle fixe (PART_PLATEAU des cases), qui ne dépend d'aucune pièce", (_nom, W, H) => {
    const [w, h] = utile(W, H);
    const d = disposer(w, h);
    expect(PART_PLATEAU).toBe(0.46);
    expect(d.coteMain).toBeCloseTo(d.cote * PART_PLATEAU, 10);
    expect(PIECES).toHaveLength(40);
    // Il n'y a plus de fonction qui ajuste le côté à la pièce : `Disposition` ne donne qu'un côté, le même pour les trois emplacements et les 40 pièces.
    expect(d.centresMain).toHaveLength(3);
  });

  it("le côté d'une case au repos vaut toujours PART_PLATEAU d'une case de la grille, d'une taille d'écran à l'autre", () => {
    for (const [, W, H] of TAILLES) {
      const [w, h] = utile(W, H);
      const d = disposer(w, h);
      expect(d.coteMain / d.cote).toBeCloseTo(PART_PLATEAU, 10);
    }
  });

  it.each(TAILLES)("%s : la plus grande pièce (barre de 5 couchée ou debout, carré 3 × 3, grand L) tient dans chacun des trois emplacements à l'échelle fixe, sans déborder, sous l'étiquette", (_nom, W, H) => {
    const [w, h] = utile(W, H);
    const d = disposer(w, h);
    expect(LONGUEUR_MAX).toBe(Math.max(...PIECES.map((p) => Math.max(p.largeur, p.hauteur))));
    d.emplacements.forEach((e, k) => {
      const c = d.centresMain[k]!;
      for (const p of PIECES) {
        const lx = (p.largeur * d.coteMain) / 2;
        const ly = (p.hauteur * d.coteMain) / 2;
        expect(dedans(e, c.x - lx, c.y - ly), `${p.nom} (emplacement ${k}, coin haut-gauche)`).toBe(true);
        expect(dedans(e, c.x + lx, c.y + ly), `${p.nom} (emplacement ${k}, coin bas-droit)`).toBe(true);
      }
      expect(e.y, `emplacement ${k} : sous l'étiquette`).toBeGreaterThanOrEqual(d.plateau.y + ETIQUETTE);
      expect(dedans(d.plateau, e.x, e.y) && dedans(d.plateau, e.x + e.w, e.y + e.h), `emplacement ${k} dans le plateau`).toBe(true);
    });
  });

  it("l'étiquette du plateau a sa place (12 px et sa marge) et chaque emplacement est une cible tactile large : au moins 44 px dans les deux sens, même pour un domino, son centre est dedans", () => {
    expect(ETIQUETTE).toBeGreaterThanOrEqual(12 + 8);
    for (const [W, H] of [[360, 640], [844, 390], [390, 844]] as const) {
      const [w, h] = utile(W, H);
      const d = disposer(w, h);
      d.emplacements.forEach((e, k) => {
        expect(e.w).toBeGreaterThanOrEqual(BOUTON);
        expect(e.h).toBeGreaterThanOrEqual(BOUTON);
        expect(dans(e, d.centresMain[k]!.x, d.centresMain[k]!.y)).toBe(true);
      });
      // Un domino (2 cases) à l'échelle fixe reste petit dans une grande cible : sa zone de saisie est bien plus grande que lui.
      const domino = PIECES.find((p) => p.nom === "domino-0")!;
      expect(domino.largeur * d.coteMain * (domino.hauteur * d.coteMain)).toBeLessThan(d.emplacements[0].w * d.emplacements[0].h / 2);
    }
  });

  it("le bouton pause du kit (en haut à droite) ne recouvre rien, avec ses marges de sécurité", () => {
    for (const [W, H] of TAILLES.map(([, a, b]) => [a, b] as const)) {
      const [w, h] = utile(W, H);
      const d = disposer(w, h);
      for (const r of [d.grille, d.plateau, ...d.emplacements, d.score, d.combo]) expect(sechevauchent(r, d.boutons)).toBe(false);
    }
  });
});
