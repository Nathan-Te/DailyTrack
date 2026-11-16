import { test, type Page } from "@playwright/test";
import { EV_MISSION, Partie, dailyPinball, jouerRobot, type ThemePinball } from "@cdj/pinball-sim";
import { parseDay } from "@cdj/core";
import { appareil, JOUR, jouerLeJour, lancer } from "./appareil";

// Un OUTIL, jamais lancé en CI (`captures-*.spec.ts` est ignoré sans `CAPTURES=1`, lot R13) : les images du lot PB5b (le HUD en surimpression, le panneau « Aujourd'hui », l'écran de fin) pour Nathan.
//   CAPTURES=1 DOSSIER=/chemin npx playwright test captures-lot-pb5b     (dans `apps/pinball`, après `npm run build`)
const dossier = process.env.DOSSIER ?? "captures";

/** Joue le robot de la table du thème pendant `pas` pas (la partie du pilote d'essai : les mêmes changements de commandes, datés). */
async function jouer(page: Page, theme: ThemePinball, pas: number, mission = false): Promise<void> {
  const evenements = jouerRobot(dailyPinball(parseDay(JOUR)!, undefined, theme), 1, { maxTicks: Math.max(pas, 20000) }).evenements;
  await page.evaluate(
    ({ evenements, pas }) => {
      let t = 0;
      for (const e of evenements) {
        if (e.tick > pas) break;
        if (e.tick > t) window.__jeu.avancer(e.tick - t);
        t = Math.max(t, e.tick);
        window.__pinball!.regler(e.c, e.enfonce);
      }
      if (pas > t) window.__jeu.avancer(pas - t);
    },
    { evenements, pas },
  );
  void mission;
}
/** Le pas où la mission est réussie avec `?essai=mission` (la partie du robot, au but moins un). */
function pasDeLaMission(theme: ThemePinball): number {
  const contenu = dailyPinball(parseDay(JOUR)!, undefined, theme);
  const evenements = jouerRobot(contenu, 1, { maxTicks: 60000 }).evenements;
  const p = new Partie(contenu);
  p.compteur = p.but - 1;
  let k = 0;
  while (!p.finie && p.tick < 60000 && !(p.ev & EV_MISSION)) {
    while (k < evenements.length && evenements[k]!.tick === p.tick) p.regler(evenements[k]!.c, evenements[k++]!.enfonce);
    p.avancer();
  }
  return p.tick;
}

const TAILLES: [string, number, number, number][] = [
  ["portrait", 390, 844, 1],
  ["portrait-petit", 360, 640, 1],
  ["paysage", 844, 390, 1],
  ["paysage-petit", 640, 360, 1],
  ["bureau", 1440, 900, 1],
];

for (const [nom, l, h, tactile] of TAILLES) {
  test(`hud ${nom} ${l} × ${h} : avant le lancer puis en cours`, async ({ browser }) => {
    const theme: ThemePinball = nom.startsWith("portrait") ? "foire" : "ocean";
    const { context: c, page } = await appareil(browser, `/?debug&manuel&tactile=${nom === "bureau" ? 0 : tactile}&theme=${theme}&qualite=haute`);
    await page.setViewportSize({ width: l, height: h });
    await lancer(page);
    await page.evaluate(() => window.__pinball!.contours(false));
    await page.evaluate(() => window.__jeu.avancer(5));
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dossier}/pb5b-hud-${nom}-1-avant.png` });
    await jouer(page, theme, 2600);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${dossier}/pb5b-hud-${nom}-2-en-cours.png` });
    await c.close();
  });
}

test("hud portrait : la mission réussie", async ({ browser }) => {
  const { context: c, page } = await appareil(browser, `/?debug&manuel&tactile=1&theme=foire&qualite=haute&essai=mission`);
  await page.setViewportSize({ width: 390, height: 844 });
  await lancer(page);
  await page.evaluate(() => window.__pinball!.contours(false));
  await jouer(page, "foire", pasDeLaMission("foire") + 2);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${dossier}/pb5b-hud-portrait-3-reussie.png` });
  await c.close();
});

test("hud portrait en anglais", async ({ browser }) => {
  const { context: c, page } = await appareil(browser, `/?debug&manuel&tactile=1&theme=espace&qualite=haute`);
  await page.evaluate(() => localStorage.setItem("cdj:langue", "en"));
  await page.reload();
  await page.waitForSelector("#jeu-jouer", { state: "attached" });
  await page.setViewportSize({ width: 390, height: 844 });
  await lancer(page);
  await page.evaluate(() => window.__pinball!.contours(false));
  await page.evaluate(() => window.__jeu.avancer(5));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dossier}/pb5b-hud-portrait-en-1-avant.png` });
  await jouer(page, "espace", 3200);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${dossier}/pb5b-hud-portrait-en-2-en-cours.png` });
  await c.close();
});

for (const [langue, l, h] of [["fr", 390, 844], ["fr", 1440, 900], ["en", 390, 844]] as const) {
  test(`accueil ${langue} ${l} × ${h}`, async ({ browser }) => {
    const { context: c, page } = await appareil(browser, `/?debug&manuel&tactile=1&qualite=basse`);
    if (langue === "en") {
      await page.evaluate(() => localStorage.setItem("cdj:langue", "en"));
      await page.reload();
      await page.waitForSelector("#jeu-jouer", { state: "attached" });
    }
    await page.setViewportSize({ width: l, height: h });
    await page.waitForSelector(".p-seuils__case");
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${dossier}/pb5b-accueil-${langue}-${l}x${h}.png`, fullPage: true });
    await c.close();
  });
}

for (const [langue, l, h] of [["fr", 390, 844], ["en", 390, 844]] as const) {
  test(`fin ${langue} ${l} × ${h}`, async ({ browser }) => {
    const { context: c, page } = await appareil(browser, `/?debug&manuel&tactile=1&qualite=basse`);
    if (langue === "en") {
      await page.evaluate(() => localStorage.setItem("cdj:langue", "en"));
      await page.reload();
      await page.waitForSelector("#jeu-jouer", { state: "attached" });
    }
    await page.setViewportSize({ width: l, height: h });
    await lancer(page);
    await jouerLeJour(page);
    await page.waitForSelector("#jeu-fin:not([hidden])");
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${dossier}/pb5b-fin-${langue}-${l}x${h}.png` });
    await c.close();
  });
}
