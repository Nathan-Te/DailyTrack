import { expect, test } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// « Blocks » — la disposition (seed § 6 : vérifié en portrait ET en paysage) : portrait, la grille en pleine largeur et la pièce du moment dessous dans une zone de saisie large ; paysage et bureau, la grille à gauche et
// la zone à droite. Rien ne sort de l'écran ni ne se recouvre.
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
    if (process.env.CAPTURES) await page.screenshot({ path: process.env.CAPTURES + `/blocks-${nom.replace(/ /g, "-")}.png` });
    await context.close();
  });
}
