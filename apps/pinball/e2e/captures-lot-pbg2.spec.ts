import { test } from "@playwright/test";
import type { ThemePinball } from "@cdj/pinball-sim";
import { appareil, lancer } from "./appareil";

// Un OUTIL, jamais lancé en CI (`captures-*.spec.ts` est ignoré sans `CAPTURES=1`, lot R13) : les images et la mesure du lot PBG2 (le verrou, la multibille, le jackpot) pour Nathan.
//   CAPTURES=1 DOSSIER=/chemin npx playwright test captures-lot-pbg2 -g "verrou"      (dans `apps/pinball`, après `npm run build`) → le verrou allumé puis une bille verrouillée, haute et basse qualité, 390 × 844
//   CAPTURES=1 DOSSIER=/chemin npx playwright test captures-lot-pbg2 -g "multibille"  → la multibille (trois billes) et un jackpot, haute et basse qualité
//   CAPTURES=1 MESURE=1 PLAN=B npx playwright test captures-lot-pbg2 -g mesure → la fluidité EN MULTIBILLE, comme au PBV1 (fil principal, processeur ralenti ×4, 390 × 844, bloom compris), sur le plan donné
const dossier = process.env.DOSSIER ?? "captures";
const prefixe = process.env.PREFIXE ?? "pbg2";
const THEMES: ThemePinball[] = ["foire", "ocean", "espace", "volcan"];

for (const qualite of ["haute", "basse"] as const) {
  test(`verrou foire ${qualite} 390 × 844`, async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=1&plan=B&theme=foire&qualite=${qualite}&essai=verrou`);
    await page.setViewportSize({ width: 390, height: 844 });
    await lancer(page);
    await page.evaluate(() => window.__pinball!.contours(false));
    await page.evaluate(() => {
      window.__pinball!.regler(2, true);
      window.__jeu.avancer(300);
      window.__pinball!.regler(2, false);
      window.__jeu.avancer(30);
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dossier}/${prefixe}-verrou-allume-${qualite}.png` });
    await context.close();
  });
  test(`multibille espace ${qualite} 390 × 844`, async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=1&plan=B&theme=espace&qualite=${qualite}&essai=multibille`);
    await page.setViewportSize({ width: 390, height: 844 });
    await lancer(page);
    await page.evaluate(() => window.__pinball!.contours(false));
    await page.evaluate(() => window.__jeu.avancer(1100));
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${dossier}/${prefixe}-multibille-${qualite}.png` });
    await context.close();
  });
}

// La fluidité en multibille : trois billes en jeu, collisions comprises, le plan le plus chargé.
for (const theme of process.env.MESURE ? THEMES : []) {
  test(`mesure ${theme}`, async ({ browser }) => {
    const plan = process.env.PLAN ?? "B";
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=1&plan=${plan}&theme=${theme}&qualite=haute&essai=multibille`);
    await page.setViewportSize({ width: 390, height: 844 });
    await lancer(page);
    await page.evaluate(() => {
      window.__jeu.avancer(1200); // les deux billes sont lâchées
      window.__pinball!.regler(2, true);
      window.__jeu.avancer(300);
      window.__pinball!.regler(2, false); // la troisième part du lanceur
      window.__jeu.avancer(200);
    });
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const mesures: number[] = [];
    const billes: number[] = [];
    for (let k = 0; k < 12; k++) {
      await page.evaluate(() => {
        const p = window.__pinball!.partie();
        p.sauveeMulti = 100000; // la multibille dure : les billes perdues reviennent
        window.__jeu.avancer(20);
      });
      await page.waitForTimeout(500);
      mesures.push(await page.evaluate(() => window.__pinball!.trois()!.ms));
      billes.push(await page.evaluate(() => window.__pinball!.partie().billesDeLaTable().length));
    }
    const info = await page.evaluate(() => window.__pinball!.trois()!);
    mesures.sort((a, b) => a - b);
    console.log(`MESURE multibille ${plan} ${theme} : fil principal ${mesures[Math.floor(mesures.length / 2)]!.toFixed(1)} ms (médiane), ${info.appels} appels, ${info.triangles} triangles, billes en jeu ${Math.min(...billes)} à ${Math.max(...billes)}`);
    await context.close();
  });
}
