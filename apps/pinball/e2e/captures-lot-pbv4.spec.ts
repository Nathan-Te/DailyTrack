import { test, type Page } from "@playwright/test";
import { dailyPinball, jouerRobot, type ThemePinball } from "@cdj/pinball-sim";
import { parseDay } from "@cdj/core";
import { appareil, JOUR, lancer } from "./appareil";

// Un OUTIL, jamais lancé en CI (`captures-*.spec.ts` est ignoré sans `CAPTURES=1`, lot R13) : les images et les mesures du lot PBV4 (un vrai modèle par module et par thème) pour Nathan.
//   CAPTURES=1 DOSSIER=/chemin PREFIXE=apres npx playwright test captures-lot-pbv4 -g "table"     (dans `apps/pinball`, après `npm run build`) → les tables, haute et basse qualité, 390 × 844
//   npx vite --port 4190 & CAPTURES=1 DOSSIER=/chemin npx playwright test captures-lot-pbv4 -g catalogue   → les 16 modèles de près (`e2e/catalogue-modeles.ts`, par le serveur de dev de Vite)
//   CAPTURES=1 DOSSIER=/chemin npx playwright test captures-lot-pbv4 -g contact                            → la table de près pendant une partie (bumper enfoncé, cible tombée…)
//   CAPTURES=1 MESURE=1 npx playwright test captures-lot-pbv4 -g mesure                                     → la fluidité, comme au PBV1 (fil principal, processeur ralenti ×4)
const dossier = process.env.DOSSIER ?? "captures";
const prefixe = process.env.PREFIXE ?? "pbv4";
const THEMES: ThemePinball[] = ["foire", "ocean", "espace", "volcan"];
/** Le pas de la capture, par thème (ceux du PBV2, pour comparer avant et après à l'identique). */
const PAS: Record<ThemePinball, number> = { foire: 1600, ocean: 2200, espace: 2200, volcan: 3000 };

/** Joue le robot (lot PB4) de la table du thème pendant `pas` pas. */
async function jouer(page: Page, theme: ThemePinball, pas: number): Promise<void> {
  const evenements = jouerRobot(dailyPinball(parseDay(JOUR)!, undefined, theme), 1, { maxTicks: pas }).evenements;
  await page.evaluate(
    ({ evenements, pas }) => {
      let t = 0;
      for (const e of evenements) {
        if (e.tick > pas) break;
        window.__jeu.avancer(e.tick - t);
        t = e.tick;
        window.__pinball!.regler(e.c, e.enfonce);
      }
      window.__jeu.avancer(pas - t);
    },
    { evenements, pas },
  );
}

for (const theme of THEMES) {
  for (const qualite of ["haute", "basse"] as const) {
    test(`table ${theme} ${qualite} 390 × 844`, async ({ browser }) => {
      const { context: c, page } = await appareil(browser, `/?debug&manuel&tactile=1&theme=${theme}&qualite=${qualite}`);
      await page.setViewportSize({ width: 390, height: 844 });
      await lancer(page);
      await page.evaluate(() => window.__pinball!.contours(false));
      await jouer(page, theme, PAS[theme]);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${dossier}/${prefixe}-${theme}-${qualite}-390x844.png` });
      await c.close();
    });
  }
  // la table de près pendant la partie, aux pas où le robot vient de toucher des modules (écran de 3 pixels par point : on y voit les objets réagir)
  test(`contact ${theme}`, async ({ browser }) => {
    const { context: c, page } = await appareil(browser, `/?debug&manuel&tactile=1&theme=${theme}&qualite=haute`);
    await page.setViewportSize({ width: 390, height: 844 });
    await lancer(page);
    await page.evaluate(() => window.__pinball!.contours(false));
    const evenements = jouerRobot(dailyPinball(parseDay(JOUR)!, undefined, theme), 1, { maxTicks: 9000 }).evenements;
    let fait = 0;
    for (const pas of [PAS[theme], PAS[theme] + 900, PAS[theme] + 2400]) {
      await page.evaluate(
        ({ evenements, pas, depuis }) => {
          let t = depuis;
          for (const e of evenements) {
            if (e.tick <= depuis || e.tick > pas) continue;
            window.__jeu.avancer(e.tick - t);
            t = e.tick;
            window.__pinball!.regler(e.c, e.enfonce);
          }
          window.__jeu.avancer(pas - t);
        },
        { evenements, pas, depuis: fait },
      );
      fait = pas;
      await page.waitForTimeout(150);
      await page.screenshot({ path: `${dossier}/${prefixe}-contact-${theme}-${pas}.png`, clip: { x: 20, y: 150, width: 350, height: 330 } });
    }
    await c.close();
  });
}

test("catalogue", async ({ browser }) => {
  const page = await browser.newPage({ viewport: { width: 900, height: 900 }, deviceScaleFactor: 1 });
  const base = process.env.CATALOGUE ?? "http://localhost:4190";
  for (const contact of [false, true]) {
    await page.goto(`${base}/src/modeles/types.ts`);
    await page.setContent(`<body style="margin:0;background:#24170e"><canvas id="c" style="width:900px;height:900px;display:block"></canvas></body>`);
    await page.evaluate(async (contact) => {
      const m = await import("/e2e/catalogue-modeles.ts" as string);
      m.dessinerCatalogue(document.getElementById("c"), contact);
    }, contact);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${dossier}/${prefixe}-catalogue-${contact ? "contact" : "repos"}.png` });
  }
  await page.close();
});

// La fluidité, mesurée comme au PBV1 et au PBV2 : le temps que le fil principal passe dans une image (`__pinball.trois().ms`), processeur ralenti ×4, 390 × 844, bille en jeu, avec le bloom ; les appels de dessin et les triangles.
for (const theme of process.env.MESURE ? THEMES : []) {
  test(`mesure ${theme}`, async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=1&theme=${theme}&qualite=haute`);
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
    console.log(`MESURE ${theme} : fil principal ${mesures[Math.floor(mesures.length / 2)]!.toFixed(1)} ms (médiane), ${info.appels} appels, ${info.triangles} triangles`);
    await context.close();
  });
}
