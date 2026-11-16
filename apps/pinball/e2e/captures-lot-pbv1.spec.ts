import { test, type Page } from "@playwright/test";
import { dailyPinball, jouerRobot, type ThemePinball } from "@cdj/pinball-sim";
import { parseDay } from "@cdj/core";
import { appareil, JOUR, lancer } from "./appareil";

// Un OUTIL, jamais lancé en CI (`captures-*.spec.ts` est ignoré sans `CAPTURES=1`, lot R13) : les images et les mesures du lot PBV1 (la passe visuelle) pour Nathan.
//   CAPTURES=1 DOSSIER=/chemin npx playwright test captures-lot-pbv1            (dans `apps/pinball`, après `npm run build`)
//   CAPTURES=1 DOSSIER=/chemin PREFIXE=tour2 npx playwright test captures-lot-pbv1 -g "table"   → les tables seulement
//   CAPTURES=1 MESURE=1 npx playwright test captures-lot-pbv1 -g mesure                        → la fluidité (fil principal, processeur ralenti ×4), avec et sans bloom
// Les tables sont prises sans les contours de `?debug` (`__pinball.contours(false)`), au même cadrage que les images cibles (portrait 390 × 844), la bille en jeu (le robot du lot PB4, `PAS`).
const dossier = process.env.DOSSIER ?? "captures";
const prefixe = process.env.PREFIXE ?? "pbv1";
const THEMES: ThemePinball[] = ["foire", "ocean", "espace", "volcan"];
/** Le pas de la capture, par thème (choisi au lot PBV1 avec le pilote d'essai, que le PB4 a remplacé par le robot : la bille peut y être ailleurs). */
const PAS: Record<ThemePinball, number> = { foire: 1600, ocean: 2200, espace: 2200, volcan: 3000 };

/** Joue le robot (lot PB4) de la table du thème pendant `pas` pas. */
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

const TAILLES = [[390, 844], [360, 640]] as const;
for (const theme of THEMES) {
  for (const [l, h] of TAILLES) {
    for (const qualite of ["haute", "basse"] as const) {
      if (qualite === "basse" && l !== 390) continue;
      test(`table ${theme} ${qualite} ${l} × ${h}`, async ({ browser }) => {
        const { context: c, page } = await appareil(browser, `/?debug&manuel&tactile=1&theme=${theme}&qualite=${qualite}`);
        await page.setViewportSize({ width: l, height: h });
        await lancer(page);
        await page.evaluate(() => window.__pinball!.contours(false));
        await jouer(page, theme, PAS[theme]);
        await page.waitForTimeout(400);
        await page.screenshot({ path: `${dossier}/${prefixe}-${theme}-${qualite}-${l}x${h}.png` });
        await c.close();
      });
    }
  }
}

// La fluidité, mesurée comme au PB2 : le temps que le fil principal passe dans une image (`__pinball.trois().ms` : la mise à jour de la scène et l'envoi des commandes), processeur ralenti ×4, 390 × 844, bille en jeu ;
// puis la même chose sans bloom (`&reglages={"vue":{"bloom":0}}`) : la différence est le coût du bloom sur le fil principal. Le travail de la carte graphique n'est pas mesurable ici (WebGL logiciel).
for (const theme of process.env.MESURE ? (["foire", "ocean"] as const) : []) {
  for (const bloom of [true, false]) {
    test(`mesure ${theme} ${bloom ? "avec" : "sans"} bloom`, async ({ browser }) => {
      const reglages = bloom ? "" : `&reglages=${encodeURIComponent(JSON.stringify({ vue: { bloom: 0 } }))}`;
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
      const image = await page.evaluate(
        () =>
          new Promise<number>((fin) => {
            const t: number[] = [];
            const f = (m: number): void => {
              t.push(m);
              if (t.length < 20) requestAnimationFrame(f);
              else fin((t[t.length - 1]! - t[0]!) / (t.length - 1));
            };
            requestAnimationFrame(f);
          }),
      );
      const info = await page.evaluate(() => window.__pinball!.trois()!);
      mesures.sort((a, b) => a - b);
      console.log(`MESURE ${theme} bloom=${bloom} : fil principal ${mesures[Math.floor(mesures.length / 2)]!.toFixed(1)} ms (médiane), image entière ${image.toFixed(0)} ms, ${info.appels} appels, ${info.triangles} triangles`);
      await context.close();
    });
  }
}
