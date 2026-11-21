import { test } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// Un OUTIL, jamais lancé en CI (`captures-*.spec.ts` est ignoré sans `CAPTURES=1`, lot R13) : les images du lot PBG3 (la porte, le poteau sauveur, l'aiguillage) pour Nathan.
//   CAPTURES=1 DOSSIER=/chemin npx playwright test captures-lot-pbg3 -g "porte"      (dans `apps/pinball`, après `npm run build`) → la porte fermée puis ouverte, haute et basse qualité, 390 × 844
//   CAPTURES=1 DOSSIER=/chemin npx playwright test captures-lot-pbg3 -g "poteau"     → le poteau rentré, avec une lampe, armé (`?essai=poteau`), puis la bille renvoyée
//   CAPTURES=1 DOSSIER=/chemin npx playwright test captures-lot-pbg3 -g "aiguillage" → la lame vers le verrou (`?essai=verrou`) et la bille qui vole, puis vers l'élément du thème (`?essai=multibille`)
//   CAPTURES=1 MESURE=1 PLAN=B npx playwright test captures-lot-pbg3 -g mesure → la fluidité, comme au PBG2 (fil principal, processeur ralenti ×4, 390 × 844, bloom compris), porte ouverte et poteau armé
const dossier = process.env.DOSSIER ?? "captures";
const prefixe = process.env.PREFIXE ?? "pbg3";
const THEMES = ["foire", "ocean", "espace", "volcan"] as const;

for (const qualite of ["haute", "basse"] as const) {
  test(`porte ${qualite} 390 × 844`, async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=1&plan=B&theme=volcan&qualite=${qualite}&essai=porte`);
    await page.setViewportSize({ width: 390, height: 844 });
    await lancer(page);
    await page.evaluate(() => window.__pinball!.contours(false));
    await page.evaluate(() => window.__jeu.avancer(40));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dossier}/${prefixe}-porte-ouverte-${qualite}.png` });
    // fermée : la même table sans l'essai
    await page.goto(`/?debug&manuel&tactile=1&plan=B&theme=volcan&qualite=${qualite}`);
    await lancer(page);
    await page.evaluate(() => window.__pinball!.contours(false));
    await page.evaluate(() => window.__jeu.avancer(10));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dossier}/${prefixe}-porte-fermee-${qualite}.png` });
    await context.close();
  });
  test(`poteau ${qualite} 390 × 844`, async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=1&theme=foire&qualite=${qualite}&essai=poteau`);
    await page.setViewportSize({ width: 390, height: 844 });
    await lancer(page);
    await page.evaluate(() => window.__pinball!.contours(false));
    await page.evaluate(() => window.__jeu.avancer(60));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dossier}/${prefixe}-poteau-arme-${qualite}.png` });
    // une bille entre les batteurs : le poteau la renvoie (on s'arrête juste après)
    await page.evaluate(() => {
      const p = window.__pinball!.partie();
      p.dansLanceur = false;
      p.x = 184 * 4096;
      p.y = 600 * 4096;
      p.px = p.x;
      p.py = p.y;
      p.vx = 0;
      p.vy = 500 * 4096;
      window.__jeu.avancer(52);
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dossier}/${prefixe}-poteau-renvoi-${qualite}.png` });
    await context.close();
  });
  test(`aiguillage ${qualite} 390 × 844`, async ({ browser }) => {
    for (const essai of ["verrou", "multibille"] as const) {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=1&plan=C&theme=ocean&qualite=${qualite}&essai=${essai}`);
      await page.setViewportSize({ width: 390, height: 844 });
      await lancer(page);
      await page.evaluate(() => window.__pinball!.contours(false));
      await page.evaluate(() => window.__jeu.avancer(20));
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${dossier}/${prefixe}-aiguillage-${essai}-lame-${qualite}.png` });
      // la bille sur la rampe, juste avant l'aiguillage : elle quitte la rampe et vole vers le verrou ou l'élément du thème
      await page.evaluate(() => {
        const p = window.__pinball!.partie();
        const a = p.table.aiguillage!;
        p.dansLanceur = false;
        p.couche = 1;
        p.rail = a.rail;
        p.railBout = 0;
        p.railS = a.s - 3 * 4096;
        p.railV = 600 * 4096;
        window.__jeu.avancer(12);
      });
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${dossier}/${prefixe}-aiguillage-${essai}-vol-${qualite}.png` });
      await context.close();
    }
  });
}

// La fluidité : la porte ouverte, le poteau armé et l'aiguillage vers le verrou, trois billes (multibille) sur le plan donné.
for (const theme of process.env.MESURE ? THEMES : []) {
  test(`mesure ${theme}`, async ({ browser }) => {
    const plan = process.env.PLAN ?? "B";
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=1&plan=${plan}&theme=${theme}&qualite=haute&essai=multibille`);
    await page.setViewportSize({ width: 390, height: 844 });
    await lancer(page);
    await page.evaluate(() => {
      const p = window.__pinball!.partie();
      p.ouvrirLaPorte();
      p.armerLeSauveur();
      window.__jeu.avancer(1200); // les deux billes sont lâchées
      window.__pinball!.regler(2, true);
      window.__jeu.avancer(300);
      window.__pinball!.regler(2, false);
      window.__jeu.avancer(200);
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const mesures: number[] = [];
    for (let k = 0; k < 12; k++) {
      await page.evaluate(() => {
        const p = window.__pinball!.partie();
        p.sauveeMulti = 100000;
        p.ouvrirLaPorte();
        window.__jeu.avancer(20);
      });
      await page.waitForTimeout(500);
      mesures.push(await page.evaluate(() => window.__pinball!.trois()!.ms));
    }
    const info = await page.evaluate(() => window.__pinball!.trois()!);
    mesures.sort((a, b) => a - b);
    console.log(`MESURE déblocages ${plan} ${theme} : fil principal ${mesures[Math.floor(mesures.length / 2)]!.toFixed(1)} ms (médiane), ${info.appels} appels, ${info.triangles} triangles`);
    await context.close();
  });
}
