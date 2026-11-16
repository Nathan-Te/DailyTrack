import { test, type Page } from "@playwright/test";
import { dailyPinball, jouerRobot, IDS_PLANS, Partie, type ThemePinball } from "@cdj/pinball-sim";
import { parseDay } from "@cdj/core";
import { appareil, JOUR, lancer } from "./appareil";

// Un OUTIL, jamais lancé en CI (`captures-*.spec.ts` est ignoré sans `CAPTURES=1`, lot R13) : les images et les mesures du lot PBG1 (les plans de table, les rampes, l'orbite, le combo, le mini-batteur) pour Nathan.
//   CAPTURES=1 DOSSIER=/chemin npx playwright test captures-lot-pbg1 -g "plan"        (dans `apps/pinball`, après `npm run build`) → chaque plan dans un thème, haute et basse qualité, 390 × 844
//   CAPTURES=1 DOSSIER=/chemin npx playwright test captures-lot-pbg1 -g "bille sur"   → la bille sur une rampe, en haute et en basse qualité (le robot joue jusqu'à une rampe)
//   CAPTURES=1 MESURE=1 PLAN=doublette npx playwright test captures-lot-pbg1 -g mesure → la fluidité, comme au PBV1 (fil principal, processeur ralenti ×4), sur le plan donné (le plus chargé : doublette)
const dossier = process.env.DOSSIER ?? "captures";
const prefixe = process.env.PREFIXE ?? "pbg1";
const THEMES: ThemePinball[] = ["foire", "ocean", "espace", "volcan"];
/** Un thème par plan : quatre plans, quatre thèmes, comme les liens du scénario de test du README. */
const COUPLES: Record<string, ThemePinball> = { doublette: "foire", tremplin: "ocean", bretelle: "espace", boucle: "volcan" };

/** Joue le robot de la table (thème, plan) pendant `pas` pas. */
async function jouer(page: Page, theme: ThemePinball, plan: string, pas: number): Promise<void> {
  const evenements = jouerRobot(dailyPinball(parseDay(JOUR)!, undefined, theme, plan), 1, { maxTicks: pas }).evenements;
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

for (const plan of IDS_PLANS) {
  const theme = COUPLES[plan] ?? "foire";
  for (const qualite of ["haute", "basse"] as const) {
    test(`plan ${plan} ${theme} ${qualite} 390 × 844`, async ({ browser }) => {
      const { context: c, page } = await appareil(browser, `/?debug&manuel&tactile=1&plan=${plan}&theme=${theme}&qualite=${qualite}`);
      await page.setViewportSize({ width: 390, height: 844 });
      await lancer(page);
      await page.evaluate(() => window.__pinball!.contours(false));
      await jouer(page, theme, plan, 2400);
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${dossier}/${prefixe}-${plan}-${theme}-${qualite}-390x844.png` });
      await c.close();
    });
  }
}

// la bille sur une rampe : on joue le robot pas à pas jusqu'à ce que la partie dise que la bille est sur un rail
for (const qualite of ["haute", "basse"] as const) {
  test(`bille sur une rampe ${qualite}`, async ({ browser }) => {
    const plan = "tremplin";
    const theme: ThemePinball = "espace";
    const { context: c, page } = await appareil(browser, `/?debug&manuel&tactile=1&plan=${plan}&theme=${theme}&qualite=${qualite}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await lancer(page);
    await page.evaluate(() => window.__pinball!.contours(false));
    // le pas où la bille est à la moitié d'un rail, trouvé dans la simulation seule (Node), puis la page joue jusque-là
    const contenu = dailyPinball(parseDay(JOUR)!, undefined, theme, plan);
    const evenements = jouerRobot(contenu, 1, { maxTicks: 30000 }).evenements;
    const essai = new Partie(contenu);
    let trouve = -1;
    let k = 0;
    for (let pas = 0; pas < 30000 && trouve < 0; pas++) {
      while (k < evenements.length && evenements[k]!.tick === pas) essai.regler(evenements[k]!.c, evenements[k++]!.enfonce);
      essai.avancer();
      if (essai.couche === 1 && essai.railS > essai.table.rails[essai.rail]!.len / 2 && essai.table.rails[essai.rail]!.genre === "rampe") trouve = essai.tick;
    }
    if (trouve > 0) await jouer(page, theme, plan, trouve);
    console.log(`bille sur une rampe ${qualite} : au pas ${trouve}`);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${dossier}/${prefixe}-bille-sur-rampe-${qualite}-390x844.png` });
    await c.close();
  });
}

// La fluidité, mesurée comme au PBV1 : le temps que le fil principal passe dans une image (`__pinball.trois().ms`), processeur ralenti ×4, 390 × 844, bille en jeu, avec le bloom ; les appels de dessin et les triangles.
for (const theme of process.env.MESURE ? THEMES : []) {
  test(`mesure ${theme}`, async ({ browser }) => {
    const plan = process.env.PLAN ?? "doublette";
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=1&plan=${plan}&theme=${theme}&qualite=haute`);
    await page.setViewportSize({ width: 390, height: 844 });
    await lancer(page);
    await jouer(page, theme, plan, 3000);
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
    console.log(`MESURE ${plan} ${theme} : fil principal ${mesures[Math.floor(mesures.length / 2)]!.toFixed(1)} ms (médiane), ${info.appels} appels, ${info.triangles} triangles`);
    await context.close();
  });
}
