import { test } from "@playwright/test";
import { EV_MISSION, Partie, dailyPinball, jouerRobot, type ThemePinball } from "@cdj/pinball-sim";
import { parseDay } from "@cdj/core";
import { appareil, JOUR, lancer } from "./appareil";

// Un OUTIL, jamais lancé en CI (`captures-*.spec.ts` est ignoré sans `CAPTURES=1`, lot R13) : les images du lot PB3 pour Nathan — les quatre thèmes en three.js (portrait 390 × 844), le rendu de secours, et la mission
// presque finie puis réussie (`?essai=mission`). `CAPTURES=1 DOSSIER=/chemin npx playwright test captures-lot-pb3` (dans `apps/pinball`, après `npm run build`).
const dossier = process.env.DOSSIER ?? "captures";
const THEMES: ThemePinball[] = ["foire", "ocean", "espace", "volcan"];

/** Joue le pilote d'essai de la table du thème pendant `pas` pas. */
async function jouer(page: import("@playwright/test").Page, theme: ThemePinball, pas: number): Promise<void> {
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

for (const theme of THEMES) {
  test(`la table en three.js, thème ${theme}, 390 × 844, en partie`, async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=1&theme=${theme}&qualite=haute`);
    await page.setViewportSize({ width: 390, height: 844 });
    await lancer(page);
    await jouer(page, theme, 3000);
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${dossier}/pb3-${theme}-haute.png` });
    await context.close();
  });
}

test("le rendu de secours (qualité basse), thème espace, 390 × 844", async ({ browser }) => {
  const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1&theme=espace&qualite=basse");
  await page.setViewportSize({ width: 390, height: 844 });
  await lancer(page);
  await jouer(page, "espace", 3000);
  await page.screenshot({ path: `${dossier}/pb3-espace-secours.png` });
  await context.close();
});

for (const theme of THEMES) {
  test(`la mission presque finie puis réussie (?essai=mission), thème ${theme}, three.js 390 × 844`, async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=1&theme=${theme}&qualite=haute&essai=mission`);
    await page.setViewportSize({ width: 390, height: 844 });
    await lancer(page);
    // le pas où le pilote d'essai réussit la mission (calculé ici par la même simulation), puis la page y est menée d'un trait
    const contenu = dailyPinball(parseDay(JOUR)!, undefined, theme);
    const evenements = jouerRobot(contenu, 1, { maxTicks: 60000 }).evenements;
    const p = new Partie(contenu);
    p.compteur = p.but - 1;
    let k = 0;
    while (!p.finie && p.tick < 60000 && !(p.ev & EV_MISSION)) {
      while (k < evenements.length && evenements[k]!.tick === p.tick) p.regler(evenements[k]!.c, evenements[k++]!.enfonce);
      p.avancer();
    }
    console.log(`${theme} : mission réussie au pas ${p.tick}`);
    await page.evaluate(
      ({ evenements, pas }) => {
        let t = 0;
        for (const e of evenements) {
          if (e.tick >= pas) break;
          if (e.tick > t) window.__jeu.avancer(e.tick - t);
          t = Math.max(t, e.tick);
          window.__pinball!.regler(e.c, e.enfonce);
        }
        window.__jeu.avancer(pas - t + 6);
      },
      { evenements, pas: p.tick },
    );
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${dossier}/pb3-${theme}-mission-reussie.png` });
    await context.close();
  });
}

test("l'écran avant le premier lancer : la phrase de la mission (?essai=mission), thème foire, 390 × 844", async ({ browser }) => {
  const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1&theme=foire&qualite=haute&essai=mission");
  await page.setViewportSize({ width: 390, height: 844 });
  await lancer(page);
  await page.evaluate(() => window.__jeu.avancer(1));
  await page.screenshot({ path: `${dossier}/pb3-foire-mission-debut.png` });
  await context.close();
});
