import { expect, test, type Page } from "@playwright/test";
import { EV_MISSION, Partie, dailyPinball, jouerRobot, type ThemePinball } from "@cdj/pinball-sim";
import { parseDay } from "@cdj/core";
import { appareil, JOUR, lancer } from "./appareil";

// « Pinball » (lot PB3) — LES THÈMES ET LES MISSIONS : chaque lien `?theme=` joue la table de son thème avec son élément et sa mission ; la pastille de la mission dit la phrase avant le premier lancer, puis « n / but » avec sa
// jauge ; `?essai=mission` met la partie au but moins un et le moment fort (message, score, multiplicateur) est celui que la simulation calcule. Rendu de secours (à plat) : rapide, et la mission ne dépend pas du rendu.
const MISSIONS: Record<ThemePinball, { phrase: string; compteur: string; but: number }> = {
  foire: { phrase: "Fais 5 tours de manège", compteur: "Manège 0 / 5", but: 5 },
  ocean: { phrase: "Plonge 3 fois dans le tourbillon", compteur: "Tourbillon 0 / 3", but: 3 },
  espace: { phrase: "Passe 3 fois par le portail", compteur: "Portail 0 / 3", but: 3 },
  volcan: { phrase: "Déclenche 4 geysers", compteur: "Geysers 0 / 4", but: 4 },
};
const chiffres = (t: string | null): number => Number((t ?? "").replace(/\D/g, ""));

/** Lance la première bille (le lanceur tenu puis relâché) : la pastille passe de la phrase à la jauge. */
async function lancerLaBille(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.__pinball!.regler(2, true);
    window.__jeu.avancer(100);
    window.__pinball!.regler(2, false);
    window.__jeu.avancer(2);
  });
}

test.describe("Pinball : les thèmes et les missions", () => {
  for (const [theme, m] of Object.entries(MISSIONS) as [ThemePinball, (typeof MISSIONS)[ThemePinball]][]) {
    test(`${theme} : la pastille dit la mission avant le lancer, puis « ${m.compteur} » et sa jauge de ${m.but} lampes`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&theme=${theme}&qualite=basse`);
      await lancer(page);
      const pastille = page.locator(".pinball-mission");
      await expect(pastille).toHaveText(m.phrase);
      await expect(pastille).toHaveAttribute("data-etat", "debut");
      await lancerLaBille(page);
      await expect(pastille).toHaveText(m.compteur);
      await expect(pastille).toHaveAttribute("data-etat", "en-cours");
      await expect(pastille.locator(".pinball-mission-jauge i")).toHaveCount(m.but);
      await expect(pastille.locator('.pinball-mission-jauge i[data-plein="1"]')).toHaveCount(0);
      await context.close();
    });
  }

  test("l'anglais : la phrase et le compteur de la mission passent par le catalogue", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&theme=espace&qualite=basse");
    await page.evaluate(() => localStorage.setItem("cdj:langue", "en"));
    await page.reload();
    await page.waitForSelector("#jeu-jouer", { state: "attached" });
    await lancer(page);
    await expect(page.locator(".pinball-mission")).toHaveText("Go through the portal 3 times");
    await lancerLaBille(page);
    await expect(page.locator(".pinball-mission")).toHaveText("Portal 0 / 3");
    await context.close();
  });

  for (const theme of ["foire", "espace", "volcan"] as const) {
    test(`${theme} : ?essai=mission commence au but moins un ; le moment fort (message, 10 000 points, multiplicateur) est celui de la simulation`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&theme=${theme}&qualite=basse&essai=mission`);
      await lancer(page);
      const but = MISSIONS[theme].but;
      // la même simulation, à Node : la partie du pilote d'essai, au but moins un, jusqu'au pas de la mission réussie
      const contenu = dailyPinball(parseDay(JOUR)!, undefined, theme);
      const evenements = jouerRobot(contenu, 1, { maxTicks: 60000 }).evenements;
      const p = new Partie(contenu);
      p.compteur = p.but - 1;
      let k = 0;
      while (!p.finie && p.tick < 60000 && !(p.ev & EV_MISSION)) {
        while (k < evenements.length && evenements[k]!.tick === p.tick) p.regler(evenements[k]!.c, evenements[k++]!.enfonce);
        p.avancer();
      }
      expect(p.ev & EV_MISSION, "le pilote d'essai réussit la mission sur cette table").toBeTruthy();
      const pas = p.tick;
      const message = page.locator(".pinball-mission-reussie");
      await expect(message).toBeHidden();
      // la page joue les mêmes événements, aux mêmes pas, jusqu'à un pas avant la mission
      await page.evaluate(
        ({ evenements, pas }) => {
          let t = 0;
          for (const e of evenements) {
            if (e.tick >= pas - 1) break;
            if (e.tick > t) window.__jeu.avancer(e.tick - t);
            t = Math.max(t, e.tick);
            window.__pinball!.regler(e.c, e.enfonce);
          }
          window.__jeu.avancer(pas - 1 - t);
        },
        { evenements, pas },
      );
      await expect(page.locator(".pinball-mission")).toHaveText(MISSIONS[theme].compteur.replace(" 0 /", ` ${but - 1} /`));
      await expect(message).toBeHidden();
      await page.evaluate(() => window.__jeu.avancer(1));
      await expect(message).toBeVisible();
      await expect(message).toHaveText(`Mission réussie ! ×${p.mult}`);
      await expect(page.locator(".pinball-mission")).toHaveAttribute("data-etat", "reussie");
      await expect(page.locator(".pinball-mission")).toHaveText("Mission réussie");
      await expect(page.locator('.pinball-mission-jauge i[data-plein="1"]')).toHaveCount(but);
      expect(chiffres(await page.locator("#jeu-hud-score").textContent()), "le score de la page est celui de la simulation").toBe(p.score);
      await expect(page.locator("#jeu-hud-temps")).toContainText(`×${p.mult}`);
      expect(p.score).toBeGreaterThanOrEqual(10000);
      await context.close();
    });
  }

  test("une partie sans ?essai=mission commence à zéro (la mission n'est pas avancée)", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&theme=foire&qualite=basse");
    await lancer(page);
    await lancerLaBille(page);
    await expect(page.locator(".pinball-mission")).toHaveText("Manège 0 / 5");
    await context.close();
  });
});
