import { expect, test } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// « Blocks » — la disposition (seed § 6 : vérifié en portrait ET en paysage) et le HUD de la maquette A (lot B2) : portrait, une rangée score / combo / fantôme / pause, la grille en pleine largeur, la pièce du moment dessous dans
// une zone de saisie large et la suivante à côté ; paysage et bureau, score et combo à gauche, la grille, la zone de saisie et la suivante à droite. Rien ne sort de l'écran ni ne se recouvre.
const ECRANS: [string, number, number, boolean][] = [
  ["téléphone portrait", 390, 844, true],
  ["petit téléphone portrait", 360, 640, true],
  ["téléphone paysage", 844, 390, false],
  ["bureau", 1280, 720, false],
];

for (const [nom, largeur, hauteur, portrait] of ECRANS) {
  test(`${nom} (${largeur} × ${hauteur}) : la grille et la zone de saisie tiennent à l'écran, sans se recouvrir`, async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1&scenario=presque-plein");
    await page.setViewportSize({ width: largeur, height: hauteur });
    await lancer(page);
    const d = await page.evaluate(() => window.__blocks.disposition());
    expect(d.portrait).toBe(portrait);
    for (const r of [d.grille, d.main]) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(largeur);
      expect(r.y + r.h).toBeLessThanOrEqual(hauteur);
    }
    const chevauche = d.grille.x < d.main.x + d.main.w && d.grille.x + d.grille.w > d.main.x && d.grille.y < d.main.y + d.main.h && d.grille.y + d.grille.h > d.main.y;
    expect(chevauche).toBe(false);
    if (portrait) expect(d.grille.w).toBeGreaterThan(largeur - 40); // la grille en pleine largeur
    else expect(d.main.x).toBeGreaterThanOrEqual(d.grille.x + d.grille.w);
    expect(d.main.w).toBeGreaterThanOrEqual(120);
    expect(d.main.h).toBeGreaterThanOrEqual(120);
    // Le HUD de la maquette A : score et combo (plaques de la scène) et les deux boutons du kit (fantôme, pause, 44 px) tiennent à l'écran, ne se recouvrent pas et ne recouvrent ni la grille ni les zones.
    const boutons = await Promise.all(["#jeu-hud-fantome", "#jeu-hud-pause"].map(async (id) => (await page.locator(id).boundingBox())!));
    for (const b of boutons) {
      expect([Math.round(b.width), Math.round(b.height)]).toEqual([44, 44]);
      expect(b.x + b.width).toBeLessThanOrEqual(largeur);
    }
    const rects = [["score", d.score], ["combo", d.combo], ["fantôme", { x: boutons[0]!.x, y: boutons[0]!.y, w: 44, h: 44 }], ["pause", { x: boutons[1]!.x, y: boutons[1]!.y, w: 44, h: 44 }], ["grille", d.grille], ["main", d.main], ["suivante", d.suivante]] as const;
    for (const [nom, r] of rects) {
      expect(r.x, nom).toBeGreaterThanOrEqual(0);
      expect(r.y, nom).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w, nom).toBeLessThanOrEqual(largeur);
      expect(r.y + r.h, nom).toBeLessThanOrEqual(hauteur);
    }
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i]![1];
        const b = rects[j]![1];
        expect(a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y, `${rects[i]![0]} / ${rects[j]![0]} ne se recouvrent pas`).toBe(false);
      }
    }
    expect(await page.evaluate(() => window.__blocks.hud())).toEqual({ score: "0", combo: null, carres: 0, moutarde: false });
    if (process.env.CAPTURES) await page.screenshot({ path: process.env.CAPTURES + `/blocks-${nom.replace(/ /g, "-")}.png` });
    await context.close();
  });
}
