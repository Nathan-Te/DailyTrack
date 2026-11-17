import { expect, test } from "@playwright/test";
import { decoderRediffusion } from "@cdj/gravity-sim";
import { appareil, lancer } from "./appareil";

// Les essais de recette du lot GR2 (hors production, jamais classés) : `?robot` — on regarde le robot jouer le niveau du jour — et `?morceau=<n>` — la partie commence juste avant le morceau n, dans l'état où le robot
// y arrive. La logique (lecture de l'adresse, rien en production) est testée en unitaire (`test/essai.test.ts`) ; ici, seulement ce que le joueur voit.
test.describe("Gravity : les essais de recette", () => {
  test("?robot : le robot joue seul (la distance monte sans un appui), le toucher ne change rien, la partie n'est jamais classée", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&robot");
    await lancer(page);
    await expect(page.locator("#jeu-hud-temps")).toHaveText("0 m · ×1");
    await page.evaluate(() => {
      window.__jeu.avancer(1500);
      window.__jeu.action("toucher"); // un humain qui touche pendant que le robot joue : sans effet
    });
    const texte = (await page.locator("#jeu-hud-temps").textContent()) ?? "";
    expect(Number(texte.split(" m")[0])).toBeGreaterThan(60); // 1 500 pas à 7 m/s : 88 m
    expect(Number((await page.locator("#jeu-hud-score").textContent())?.replace(/\D/g, ""))).toBeGreaterThan(100);
    // Le robot passe plusieurs minutes de jeu : la partie finit un jour, non classée.
    await page.evaluate(() => window.__jeu.avancer(100000));
    await expect(page.locator("#jeu-fin")).toBeVisible();
    await expect(page.locator("#jeu-fin-rang")).toContainText("essai"); // « Partie d'essai : non classée »
    await context.close();
  });

  test("?morceau=30 : la partie commence juste avant le morceau 30, avec le score et le multiplicateur du robot ; jamais classée", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&morceau=30");
    await lancer(page);
    const texte = (await page.locator("#jeu-hud-temps").textContent()) ?? "";
    const distance = Number(texte.split(" m")[0]);
    expect(distance).toBeGreaterThan(30 * 16 - 3 - 14); // douze colonnes avant le morceau (480 m)
    expect(distance).toBeLessThan(30 * 16);
    expect(Number((await page.locator("#jeu-hud-score").textContent())?.replace(/\D/g, ""))).toBeGreaterThan(distance);
    await page.evaluate(() => window.__jeu.avancer(100000));
    await expect(page.locator("#jeu-fin")).toBeVisible();
    await expect(page.locator("#jeu-fin-rang")).toContainText("essai");
    await context.close();
  });

  // Lot GR5 : les réglages d'essai du calibrage (`?vitesse=`, `?plafond=`, `?pente=`, `?gravite=`, `?longueur=`, `?medailles=`). La lecture, les plages et « rien en production » sont en unitaire (`test/essai.test.ts`).
  test("lot GR5 — ?vitesse=9&gravite=40&medailles=50 : la partie dit « Réglage d'essai » et ce qui a changé, la caméra part plus vite, jamais classée ; sans réglage la mention est absente", async ({ browser }) => {
    const normal = await appareil(browser, "/?debug&manuel&tactile=0");
    await lancer(normal.page);
    await expect(normal.page.locator(".g-reglage")).toBeHidden();
    await normal.context.close();
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&vitesse=9&gravite=40&medailles=50");
    await lancer(page);
    await expect(page.locator(".g-reglage")).toBeVisible();
    await expect(page.locator(".g-reglage")).toHaveText("Réglage d'essai · départ 9 m/s · gravité 40 · médailles à 50 %");
    await page.evaluate(() => window.__jeu.avancer(400));
    const texte = (await page.locator("#jeu-hud-temps").textContent()) ?? "";
    expect(Number(texte.split(" m")[0])).toBeGreaterThan(28); // 400 pas (3,3 s) à 9 m/s : ≈ 31 m (à 7 m/s : ≈ 25 m)
    await page.evaluate(() => window.__jeu.avancer(100000));
    await expect(page.locator("#jeu-fin")).toBeVisible();
    await expect(page.locator("#jeu-fin-rang")).toContainText("essai"); // « Partie d'essai : non classée »
    await context.close();
  });

  // Lot GR6 : `?mode=avion|onde|ressort` — la partie commence juste avant la première section de ce mode. La lecture, « rien en production » et « jamais classée » sont en unitaire (`test/essai.test.ts`, `test/modes.test.ts`).
  const NOMS = { avion: "Avion", onde: "Onde", ressort: "Ressort" } as const;
  for (const mode of ["avion", "onde", "ressort"] as const) {
    test(`lot GR6 — ?mode=${mode} : la partie commence avant la section, le portail annonce « ${NOMS[mode]} » avec sa consigne, l'icône du mode est près du multiplicateur ; jamais classée`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&mode=${mode}`);
      await lancer(page);
      const texte = (await page.locator("#jeu-hud-temps").textContent()) ?? "";
      expect(Number(texte.split(" m")[0])).toBeGreaterThan(30); // une section du mode : loin du départ
      await expect(page.locator(".g-modeicone")).toBeHidden(); // encore en gravité
      await expect(page.locator(".g-mode")).not.toHaveClass(/g-mode--vu/);
      await page.evaluate(() => window.__jeu.avancer(260)); // treize colonnes : le portail est franchi
      await expect(page.locator(".g-mode")).toHaveClass(/g-mode--vu/);
      await expect(page.locator(".g-mode__nom")).toHaveText(NOMS[mode]);
      await expect(page.locator(".g-mode__consigne")).not.toHaveText(""); // la première fois du mode : la consigne
      await expect(page.locator(".g-modeicone")).toBeVisible();
      await page.evaluate(() => window.__jeu.avancer(100000));
      await expect(page.locator("#jeu-fin")).toBeVisible();
      await expect(page.locator("#jeu-fin-rang")).toContainText("essai"); // « Partie d'essai : non classée »
      await context.close();
    });
  }

  test("lot GR6 — ?mode=avion&robot : on regarde le robot jouer la section ; le doigt se pose et se lève (la rediffusion est la liste des changements du bouton)", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&mode=avion&robot");
    await lancer(page);
    await expect(page.locator(".g-robot")).toBeVisible();
    await page.evaluate(() => window.__jeu.avancer(260));
    await expect(page.locator(".g-mode__nom")).toHaveText("Avion"); // le portail d'entrée de la section
    await page.evaluate(() => window.__jeu.avancer(100000));
    await expect(page.locator("#jeu-fin")).toBeVisible();
    const code = await page.evaluate(() => window.__jeu.rediffusion());
    const r = decoderRediffusion(code!);
    expect(r.changements.length).toBeGreaterThan(4); // des appuis ET des relâchés
    await context.close();
  });

  test("lot GR6 — le toucher est l'état du bouton : poser le doigt appuie, le lever relâche ; les deux sont dans la rediffusion", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&mode=avion");
    await lancer(page);
    // dans le morceau calme qui précède la section : le doigt se pose, se lève, se repose, se lève (90 pas, moins que les douze colonnes avant le portail)
    const vue = page.viewportSize()!;
    await page.mouse.move(vue.width / 2, vue.height / 2);
    await page.mouse.down();
    await page.evaluate(() => window.__jeu.avancer(40));
    await page.mouse.up();
    await page.evaluate(() => window.__jeu.avancer(30));
    await page.mouse.down();
    await page.evaluate(() => window.__jeu.avancer(20));
    await page.mouse.up();
    await page.evaluate(() => window.__jeu.avancer(100000));
    await expect(page.locator("#jeu-fin")).toBeVisible();
    const r = decoderRediffusion((await page.evaluate(() => window.__jeu.rediffusion()))!);
    // la rediffusion commence par ce que le robot a joué pour amener la partie jusque-là, puis nos quatre changements : deux appuis, deux relâchés, à 40, 30 puis 20 pas d'écart
    const [a, b, c, d] = r.changements.slice(-4) as [number, number, number, number];
    expect([b - a, c - b, d - c]).toEqual([40, 30, 20]);
    expect(r.changements.length % 2).toBe(0); // autant d'appuis que de relâchés : le doigt est levé à la fin
    await context.close();
  });
});
