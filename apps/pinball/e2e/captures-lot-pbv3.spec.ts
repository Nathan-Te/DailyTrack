import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test, type Page } from "@playwright/test";
import { dailyPinball, jouerRobot, type ThemePinball } from "@cdj/pinball-sim";
import { parseDay } from "@cdj/core";
import { appareil, JOUR, lancer } from "./appareil";
import { ZONE_CIBLE, ligne, mesurerCouleurs, type Point } from "../test/couleurs";

// Un OUTIL, jamais lancé en CI (`captures-*.spec.ts` est ignoré sans `CAPTURES=1`, lot R13) : les images et les mesures du lot PBV3 (la lumière et les couleurs des images cibles) pour Nathan.
//   CAPTURES=1 DOSSIER=/chemin PREFIXE=tour1 npx playwright test captures-lot-pbv3 -g table     (dans `apps/pinball`, après `npm run build`) → les quatre thèmes en 390 × 844, et le rendu de secours
//   CAPTURES=1 npx playwright test captures-lot-pbv3 -g couleurs                                 → la luminance, la saturation, la teinte et le contraste de la table, contre ceux des cibles (`test/couleurs.ts`)
//   CAPTURES=1 MESURE=1 npx playwright test captures-lot-pbv3 -g mesure                         → la fluidité (fil principal, processeur ralenti ×4) : tel quel, sans bloom, sans tone mapping ni étalonnage
// Les tables sont prises sans les contours de `?debug` (`__pinball.contours(false)`), en portrait 390 × 844, la bille en jeu (le robot du lot PB4, `PAS`).
const dossier = process.env.DOSSIER ?? "captures";
const prefixe = process.env.PREFIXE ?? "pbv3";
/** `VUE='{"exposition":120}'` : une vue d'essai (les curseurs de `?debug&tune`) pour les tables et les couleurs. */
const vue = process.env.VUE ? `&reglages=${encodeURIComponent(JSON.stringify({ vue: JSON.parse(process.env.VUE) }))}` : "";
const THEMES: ThemePinball[] = ["foire", "ocean", "espace", "volcan"];
/** Le pas de la capture, par thème (le même qu'aux lots PBV1 et PBV2). */
const PAS: Record<ThemePinball, number> = { foire: 1600, ocean: 2200, espace: 2200, volcan: 3000 };

async function jouer(page: Page, theme: ThemePinball, pas: number): Promise<void> {
  const evenements = jouerRobot(dailyPinball(parseDay(JOUR)!, undefined, theme), 1, { maxTicks: pas }).evenements;
  await page.evaluate(
    ({ evenements, pas }) => {
      let t = 0;
      for (const e of evenements) {
        window.__jeu.avancer(e.tick - t);
        t = e.tick;
        window.__pinball!.regler(e.c, e.enfonce);
      }
      window.__jeu.avancer(pas - t);
    },
    { evenements, pas },
  );
}

async function table(page: Page, theme: ThemePinball): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  await lancer(page);
  await page.evaluate(() => window.__pinball!.contours(false));
  await jouer(page, theme, PAS[theme]);
  await page.waitForTimeout(400);
}

for (const theme of THEMES) {
  for (const qualite of ["haute", "basse"] as const) {
    test(`table ${theme} ${qualite}`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=1&theme=${theme}&qualite=${qualite}${vue}`);
      await table(page, theme);
      await page.screenshot({ path: `${dossier}/${prefixe}-${theme}-${qualite}-390x844.png` });
      await context.close();
    });
  }
}

/** Les pixels RGBA d'une image PNG, lus par le navigateur. */
async function pixels(page: Page, png: Buffer): Promise<{ l: number; h: number; rgba: Uint8Array }> {
  const r = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext("2d")!;
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let s = "";
    for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode(...d.subarray(i, i + 0x8000));
    return { l: c.width, h: c.height, b: btoa(s) };
  }, png.toString("base64"));
  return { l: r.l, h: r.h, rgba: new Uint8Array(Buffer.from(r.b, "base64")) };
}

// La mesure des couleurs : la table du jeu (haute qualité, 390 × 844, au pas des captures) contre la cible, sur la zone de la table (`ZONE_CIBLE`, et `__pinball.trois().table` pour le jeu)
for (const theme of ["foire", "ocean"] as const) {
  test(`couleurs ${theme}`, async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=1&theme=${theme}&qualite=haute${vue}`);
    await table(page, theme);
    const zone = await page.evaluate(() => {
      const canvas = document.querySelector("canvas:not(.pinball-surcouche)")!.getBoundingClientRect();
      return window.__pinball!.trois()!.table.map(([x, y]) => [x + canvas.left, y + canvas.top] as Point);
    });
    const capture = await pixels(page, await page.screenshot());
    const cible = await pixels(page, readFileSync(fileURLToPath(new URL(`../../../docs/pinball/maquettes/cibles/cible-${theme}.png`, import.meta.url))));
    const jeu = mesurerCouleurs(capture.rgba, capture.l, capture.h, zone, 1);
    const ref = mesurerCouleurs(cible.rgba, cible.l, cible.h, ZONE_CIBLE[theme], 2);
    console.log(`COULEURS ${theme} (luminance | saturation | teinte | contraste)\n  jeu   : ${ligne(jeu)}\n  cible : ${ligne(ref)}`);
    await context.close();
  });
}

// La fluidité, mesurée comme aux lots PBV1 et PBV2 : le temps que le fil principal passe dans une image, processeur ralenti ×4, 390 × 844, bille en jeu ; tel quel, sans bloom (`bloom: 0`) et sans tone mapping ni étalonnage
// (`exposition: 0`, lot PBV3) : les différences sont le coût du bloom et celui de l'étalonnage. Le travail de la carte graphique n'est pas mesurable ici (WebGL logiciel).
const VARIANTES: Record<string, object | null> = { tel: null, "sans bloom": { bloom: 0 }, "sans etalonnage": { exposition: 0 } };
for (const theme of process.env.MESURE ? THEMES : []) {
  for (const [nom, vue] of Object.entries(VARIANTES)) {
    test(`mesure ${theme} ${nom}`, async ({ browser }) => {
      const reglages = vue ? `&reglages=${encodeURIComponent(JSON.stringify({ vue }))}` : "";
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=1&theme=${theme}&qualite=haute${reglages}`);
      await page.setViewportSize({ width: 390, height: 844 });
      await lancer(page);
      await jouer(page, theme, 3000);
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      const mesures: number[] = [];
      for (let k = 0; k < 12; k++) {
        await page.evaluate(() => window.__jeu.avancer(20));
        await page.waitForTimeout(500);
        mesures.push(await page.evaluate(() => window.__pinball!.trois()!.ms));
      }
      const info = await page.evaluate(() => window.__pinball!.trois()!);
      mesures.sort((a, b) => a - b);
      console.log(`MESURE ${theme} ${nom} : fil principal ${mesures[Math.floor(mesures.length / 2)]!.toFixed(1)} ms (médiane), ${info.appels} appels, ${info.triangles} triangles`);
      await context.close();
    });
  }
}
