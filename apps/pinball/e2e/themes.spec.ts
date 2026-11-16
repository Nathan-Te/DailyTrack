import { expect, test, type Page } from "@playwright/test";
import { EV_MISSION, Partie, dailyPinball, grouper, jouerRobot, type ThemePinball } from "@cdj/pinball-sim";
import { parseDay } from "@cdj/core";
import { appareil, JOUR, lancer } from "./appareil";

// « Pinball » (lot PB3, HUD du lot PB5b) — LES THÈMES ET LES MISSIONS : chaque lien `?theme=` joue la table de son thème avec son élément et sa mission ; la plaque de la mission du HUD dit son nom, sa jauge à cases et « n/but » ;
// `?essai=mission` met la partie au but moins un et le moment fort (« +10 000 » dans l'afficheur, plaque en moutarde, multiplicateur) est celui que la simulation calcule. Rendu de secours (à plat) : rapide, et la mission ne dépend pas du rendu.
const MISSIONS: Record<ThemePinball, { nom: string; but: number }> = {
  foire: { nom: "Manège", but: 5 },
  ocean: { nom: "Tourbillon", but: 3 },
  espace: { nom: "Portails", but: 3 },
  volcan: { nom: "Geysers", but: 4 },
};
const chiffres = (t: string | null): number => Number((t ?? "").replace(/\D/g, ""));

/** Lance la première bille (le lanceur tenu puis relâché) : la plaque passe de « avant le lancer » à « en cours », l'aide d'avant le lancer s'en va. */
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
    test(`${theme} : la plaque dit « ${m.nom} », « 0/${m.but} » et sa jauge de ${m.but} cases, avant puis après le lancer`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&theme=${theme}&qualite=basse`);
      await lancer(page);
      const plaque = page.locator(".pinball-mission");
      await expect(plaque.locator(".pinball-mission__nom")).toHaveText(m.nom);
      await expect(plaque.locator(".pinball-mission__val")).toHaveText(`0/${m.but}`);
      await expect(plaque).toHaveAttribute("data-etat", "debut");
      await expect(page.locator(".pinball-hud__aide")).toBeVisible();
      await lancerLaBille(page);
      await expect(plaque).toHaveAttribute("data-etat", "en-cours");
      await expect(plaque.locator(".pinball-mission__jauge i")).toHaveCount(m.but);
      await expect(plaque.locator('.pinball-mission__jauge i[data-plein="1"]')).toHaveCount(0);
      await expect(page.locator(".pinball-hud__aide")).toBeHidden(); // l'aide part au premier lancer
      await context.close();
    });
  }

  test("l'anglais : le nom de la mission et l'aide du HUD passent par le catalogue", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&theme=espace&qualite=basse");
    await page.evaluate(() => localStorage.setItem("cdj:langue", "en"));
    await page.reload();
    await page.waitForSelector("#jeu-jouer", { state: "attached" });
    await lancer(page);
    await expect(page.locator(".pinball-mission__nom")).toHaveText("Portals");
    await expect(page.locator(".pinball-mission__val")).toHaveText("0/3");
    await expect(page.locator(".pinball-hud__aide")).toHaveText("Hold, then release to launch");
    await expect(page.locator("#pinball-pause")).toHaveAttribute("aria-label", "Pause");
    await lancerLaBille(page);
    await expect(page.locator(".pinball-mission__val")).toHaveText("0/3");
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
      const afficheur = page.locator(".pinball-hud__chiffres");
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
      await expect(page.locator(".pinball-mission__val")).toHaveText(`${but - 1}/${but}`);
      await expect(page.locator(".pinball-mission")).toHaveAttribute("data-etat", "en-cours");
      await page.evaluate(() => window.__jeu.avancer(1));
      // le moment fort : « +10 000 » (au multiplicateur d'avant) dans l'afficheur, la plaque en moutarde (« Réussie », cases pleines), le multiplicateur monte d'un cran
      await expect(afficheur).toHaveText(`+${grouper(10000 * (p.mult - 1), "fr")}`);
      await expect(page.locator(".pinball-mission")).toHaveAttribute("data-etat", "reussie");
      await expect(page.locator(".pinball-mission__val")).toHaveText("Réussie");
      await expect(page.locator('.pinball-mission__jauge i[data-plein="1"]')).toHaveCount(but);
      await expect(page.locator(".pinball-hud__mult")).toHaveText(`×${p.mult}`);
      await expect(page.locator(".pinball-hud__mult")).toHaveAttribute("data-haut", "1");
      expect(chiffres(await page.locator("#jeu-hud-score").textContent()), "le score de la page est celui de la simulation").toBe(p.score);
      await expect(afficheur, "deux secondes plus tard, l'afficheur montre de nouveau le score").toHaveText(grouper(p.score, "fr"), { timeout: 4000 });
      await expect(page.locator("#jeu-hud-temps")).toContainText(`×${p.mult}`);
      expect(p.score).toBeGreaterThanOrEqual(10000);
      await context.close();
    });
  }

  test("une partie sans ?essai=mission commence à zéro (la mission n'est pas avancée)", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&theme=foire&qualite=basse");
    await lancer(page);
    await lancerLaBille(page);
    await expect(page.locator(".pinball-mission__val")).toHaveText("0/5");
    await context.close();
  });
});
