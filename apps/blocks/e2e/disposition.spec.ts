import { expect, test, type Page } from "@playwright/test";
import { THEMES_BLOCKS } from "@cdj/blocks-sim";
import { PALETTE_PORT } from "@cdj/visuels/blocs";
import { PALETTES } from "@cdj/visuels/blocs/themes";
import { appareil, lancer } from "./appareil";

// « Blocks » — la LISIBILITÉ au PC et au téléphone (lot B5) : la mise en page de la partie (trois colonnes autour d'une grille haute d'environ 80 % de l'écran en paysage, grille en pleine largeur en portrait), l'accueil du jeu à l'échelle des
// autres jeux, le fantôme retiré, les décors des six thèmes. Les sept tailles de la recette : 2560 × 1440, 1920 × 1080, 1366 × 768, 1280 × 720, 844 × 390, 390 × 844, 360 × 640. Rien ne déborde ni ne se recouvre.
const ECRANS: [string, number, number, boolean][] = [
  ["2560 × 1440", 2560, 1440, false],
  ["1920 × 1080", 1920, 1080, false],
  ["1366 × 768", 1366, 768, false],
  ["1280 × 720", 1280, 720, false],
  ["844 × 390 (téléphone en paysage)", 844, 390, false],
  ["390 × 844 (téléphone en portrait)", 390, 844, true],
  ["360 × 640 (petit téléphone)", 360, 640, true],
];
const chevauche = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

for (const [nom, largeur, hauteur, portrait] of ECRANS) {
  test(`${nom} : l'accueil du jeu est à l'échelle (aucun débordement), la grille est la vedette, le HUD est lisible, rien ne déborde ni ne se recouvre`, async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1&scenario=presque-plein", true, false);
    await page.setViewportSize({ width: largeur, height: hauteur });
    await page.waitForSelector("#jeu-jouer", { state: "attached" });
    // L'accueil : le bouton JOUER prend la largeur de la carte ; la carte est celle des autres jeux (760 px chez Jump, 940 chez Track), agrandie sur un grand écran ; la page ne défile jamais de côté.
    const jouer = (await page.locator("#jeu-jouer").boundingBox())!;
    const minimum = largeur >= 1700 ? 900 : largeur >= 700 ? 700 : largeur - 80;
    expect(jouer.width, "JOUER prend la largeur de la carte").toBeGreaterThanOrEqual(minimum);
    expect(jouer.x).toBeGreaterThanOrEqual(0);
    expect(jouer.x + jouer.width).toBeLessThanOrEqual(largeur);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/accueil-${largeur}x${hauteur}.png` });

    await lancer(page);
    const d = await page.evaluate(() => window.__blocks.disposition());
    expect(d.portrait).toBe(portrait);
    const ecran = { x: 0, y: 0, w: largeur, h: hauteur };
    const rects = [["score", d.score], ["combo", d.combo], ["grille", d.grille], ["main", d.main], ["suivante", d.suivante], ["pause", d.boutons]] as const;
    for (const [n, r] of rects) {
      expect(r.x, n).toBeGreaterThanOrEqual(0);
      expect(r.y, n).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w, n).toBeLessThanOrEqual(largeur);
      expect(r.y + r.h, n).toBeLessThanOrEqual(hauteur);
    }
    expect(chevauche(d.grille, ecran)).toBe(true);
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(chevauche(rects[i]![1], rects[j]![1]), `${rects[i]![0]} / ${rects[j]![0]} ne se recouvrent pas`).toBe(false);
    // Le bouton pause du kit, 44 × 44, tient à l'écran et ne recouvre rien ; **le bouton fantôme n'existe plus** (caché : le kit n'a pas d'option « sans fantôme »).
    const pause = (await page.locator("#jeu-hud-pause").boundingBox())!;
    expect([Math.round(pause.width), Math.round(pause.height)]).toEqual([44, 44]);
    expect(pause.x + pause.width).toBeLessThanOrEqual(largeur);
    for (const [n, r] of rects.filter(([n]) => n !== "pause")) expect(chevauche(r, { x: pause.x, y: pause.y, w: 44, h: 44 }), `pause / ${n}`).toBe(false);
    await expect(page.locator("#jeu-hud-fantome")).toBeHidden();
    // La grille est la vedette : au moins 70 % de la plus petite dimension ; en paysage, environ 80 % de la hauteur, centrée, avec la pièce du moment et la suivante dans une colonne qui ne dépasse jamais la grille.
    expect(d.grille.w / Math.min(largeur, hauteur)).toBeGreaterThanOrEqual(0.7);
    if (!portrait) {
      expect(d.grille.h / hauteur).toBeGreaterThan(0.74);
      expect(Math.abs(d.grille.x + d.grille.w / 2 - largeur / 2)).toBeLessThanOrEqual(2);
      expect(d.main.x).toBeGreaterThanOrEqual(d.grille.x + d.grille.w);
      expect(d.score.x + d.score.w).toBeLessThanOrEqual(d.grille.x);
    } else expect(d.grille.w).toBeGreaterThan(largeur - 40);
    for (const z of [d.main, d.suivante]) {
      expect(z.w).toBeLessThanOrEqual(d.grille.w);
      expect(z.h).toBeLessThanOrEqual(d.grille.h);
    }
    expect(d.main.w * d.main.h + d.suivante.w * d.suivante.h).toBeLessThan(d.grille.w * d.grille.h);
    expect(d.coteMain).toBeLessThanOrEqual(d.cote);
    expect(d.coteSuivante).toBeLessThan(d.coteMain);
    // Le HUD est lisible : ce que la scène dessine vraiment (valeurs du HUD au moins 18 px, étiquettes au moins 12 px).
    await page.waitForTimeout(150);
    const polices = await page.evaluate(() => window.__blocks.polices());
    expect(polices.valeur, "valeurs du HUD").toBeGreaterThanOrEqual(18);
    expect(polices.etiquette, "étiquettes").toBeGreaterThanOrEqual(12);
    expect(await page.evaluate(() => window.__blocks.hud())).toEqual({ score: "0", combo: null, carres: 0, moutarde: false });
    if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/partie-${largeur}x${hauteur}.png` });
    await context.close();
  });
}

/** La part des points d'une zone du canevas dont la couleur diffère de `ciel` (les cadres et les plaques sont hors de la zone : seulement le décor). */
async function partDeDecor(page: Page, ciel: string, zone: { x: number; y: number; w: number; h: number }): Promise<number> {
  return page.evaluate(
    ({ ciel, zone }) => {
      const c = document.querySelector("canvas.blocks-plateau") as HTMLCanvasElement;
      const g = c.getContext("2d")!;
      const k = c.width / c.getBoundingClientRect().width;
      const img = g.getImageData(Math.round(zone.x * k), Math.round(zone.y * k), Math.round(zone.w * k), Math.round(zone.h * k)).data;
      const ref = [1, 3, 5].map((i) => parseInt(ciel.slice(i, i + 2), 16));
      let autres = 0;
      let n = 0;
      for (let i = 0; i < img.length; i += 4 * 7) {
        n++;
        if (Math.abs(img[i]! - ref[0]!) + Math.abs(img[i + 1]! - ref[1]!) + Math.abs(img[i + 2]! - ref[2]!) > 12) autres++;
      }
      return autres / n;
    },
    { ciel, zone },
  );
}

const PALETTES_TOUTES = { port: PALETTE_PORT, ...PALETTES };
for (const theme of THEMES_BLOCKS) {
  test(`?theme=${theme} : le décor est dessiné derrière la grille (la marge gauche n'est plus un aplat), sans toucher à la grille ni aux pièces`, async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&theme=${theme}`, true, false);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForSelector("#jeu-jouer", { state: "attached" });
    await lancer(page);
    expect(await page.evaluate(() => window.__blocks.decor())).toBe(true);
    await page.waitForTimeout(200);
    const d = await page.evaluate(() => window.__blocks.disposition());
    const gauche = { x: 0, y: 0, w: d.score.x - 8, h: 1080 }; // la marge à gauche des plaques : que du décor
    const part = await partDeDecor(page, PALETTES_TOUTES[theme].ciel, gauche);
    expect(part, `${theme} : la part de la marge qui n'est pas le ciel`).toBeGreaterThan(0.12);
    if (process.env.CAPTURES) await page.screenshot({ path: `${process.env.CAPTURES}/theme-${theme}-1920x1080.png` });
    await context.close();
  });
}

test("« mouvements réduits » : le décor ne bouge plus (la neige de la banquise tombe sinon)", async ({ browser }) => {
  const prises: string[][] = [];
  for (const reduit of [false, true]) {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&theme=banquise", true, false);
    if (reduit) await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.reload();
    await page.waitForSelector("#jeu-jouer", { state: "attached" });
    await lancer(page);
    const empreinte = (): Promise<string> =>
      page.evaluate(() => {
        const c = document.querySelector("canvas.blocks-plateau") as HTMLCanvasElement;
        const k = c.width / c.getBoundingClientRect().width;
        const img = c.getContext("2d")!.getImageData(0, 0, Math.round(480 * k), Math.round(1080 * k)).data; // la marge gauche
        let h = 0;
        for (let i = 0; i < img.length; i += 4 * 3) h = (h * 31 + img[i]! + 7 * img[i + 1]! + 13 * img[i + 2]!) | 0;
        return String(h);
      });
    await page.waitForTimeout(300);
    const a = await empreinte();
    await page.waitForTimeout(1400);
    prises.push([a, await empreinte()]);
    await context.close();
  }
  expect(prises[0]![0], "mouvement normal : la neige a bougé").not.toBe(prises[0]![1]);
  expect(prises[1]![0], "mouvements réduits : rien ne bouge").toBe(prises[1]![1]);
});
