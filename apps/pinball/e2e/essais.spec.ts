import { expect, test } from "@playwright/test";
import { DUREE_PARTIE_ROBOT, VARIANTE, dailyPinball, graineDuRobot, jouerRobot } from "@cdj/pinball-sim";
import { parseDay } from "@cdj/core";
import { EXEMPLES } from "../src/tune-sons";
import { appareil, JOUR, lancer } from "./appareil";

// Lot PBG1 : `?plan=<id>` joue un plan donné (jamais classé), combinable avec `?theme=` ; `?robot` continue de marcher avec lui. Le panneau « Aujourd'hui » de l'accueil nomme le plan et liste ses rails.

// « Pinball » (lot PB4) — LES ESSAIS DE RECETTE `?robot` : on regarde le robot jouer la table du jour avec la mention « Le robot joue » ; `?jour=AAAA-MM-JJ&robot` pour un autre jour. La page rejoue les événements
// que la simulation (Node, la même) calcule pour la partie du robot : le jeu ne décide rien. Hors production seulement, jamais classé (la production n'a aucune de ces options : `test/essai.test.ts`).
// lot PBG2 : une partie du robot dure 6 minutes de jeu (≈ 3 s de calcul) : chaque partie n'est calculée qu'une fois par fichier
const parties = new Map<string, ReturnType<typeof jouerRobot>>();
const robot = (jour: string, k = 0) => {
  const cle = `${jour}:${k}`;
  if (!parties.has(cle)) parties.set(cle, jouerRobot(dailyPinball(parseDay(jour)!), graineDuRobot(k), { maxTicks: DUREE_PARTIE_ROBOT }));
  return parties.get(cle)!;
};

test.describe("Pinball : le robot joue (?robot)", () => {
  test("la mention « Le robot joue », et la page rejoue les événements de la partie du robot au pas près", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&qualite=basse&robot");
    await lancer(page);
    await expect(page.locator(".pinball-robot")).toHaveText("Le robot joue");
    const attendu = robot(JOUR);
    const PAS = 9000;
    await page.evaluate((pas) => window.__jeu.avancer(pas), PAS);
    const joues = await page.evaluate(() => window.__pinball!.evenements());
    expect(joues).toEqual(attendu.evenements.filter((e) => e.tick < PAS));
    expect(joues.length).toBeGreaterThan(5);
    // le score de la page est celui de la simulation à ce pas (le robot a joué sa partie, pas autre chose)
    const verite = jouerRobot(dailyPinball(parseDay(JOUR)!), graineDuRobot(0), { maxTicks: PAS });
    await expect(page.locator("#jeu-hud-score")).toHaveText(VARIANTE.formatScore([verite.partie.score, PAS], "fr"));
    await context.close();
  });

  test("le toucher et le clavier ne changent rien quand le robot joue ; la partie n'est pas classable", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&qualite=basse&robot");
    await lancer(page);
    await page.evaluate(() => {
      window.__pinball!.regler(0, true); // le joueur appuie : ignoré
      window.__jeu.avancer(2000);
    });
    const joues = await page.evaluate(() => window.__pinball!.evenements());
    expect(joues).toEqual(robot(JOUR).evenements.filter((e) => e.tick < 2000));
    await page.keyboard.down("KeyQ");
    await page.evaluate(() => window.__jeu.avancer(300));
    await page.keyboard.up("KeyQ");
    expect(await page.evaluate(() => window.__pinball!.evenements())).toEqual(robot(JOUR).evenements.filter((e) => e.tick < 2300));
    await context.close();
  });

  test("`?robot=2` : la troisième partie du robot ; `?jour=…&robot` : un autre jour", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&qualite=basse&robot=2&jour=2026-11-03");
    await lancer(page);
    await page.evaluate(() => window.__jeu.avancer(4000));
    const attendu = jouerRobot(dailyPinball(parseDay("2026-11-03")!), graineDuRobot(2), { maxTicks: DUREE_PARTIE_ROBOT });
    expect(await page.evaluate(() => window.__pinball!.evenements())).toEqual(attendu.evenements.filter((e) => e.tick < 4000));
    await context.close();
  });

  test("la partie du robot s'arrête au pas où il s'est arrêté, et l'arrivée dit que ce n'est pas un classement", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&qualite=basse&robot");
    await lancer(page);
    await page.evaluate((pas) => window.__jeu.avancer(pas + 500), DUREE_PARTIE_ROBOT);
    await expect(page.locator("#jeu-fin")).toBeVisible();
    expect(await page.evaluate(() => window.__pinball!.tick())).toBe(robot(JOUR).partie.tick);
    await expect(page.locator("#jeu-fin-score")).toHaveText(/\d/);
    await context.close();
  });

  test("l'anglais : « The robot plays »", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&qualite=basse&robot");
    await page.evaluate(() => localStorage.setItem("cdj:langue", "en"));
    await page.reload();
    await page.waitForSelector("#jeu-jouer", { state: "attached" });
    await lancer(page);
    await expect(page.locator(".pinball-robot")).toHaveText("The robot plays");
    await context.close();
  });

  test("sans `?robot`, aucune mention ni robot : une partie normale", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&qualite=basse");
    await lancer(page);
    await expect(page.locator(".pinball-robot")).toHaveCount(0);
    await context.close();
  });

  test("`?plan=` : l'accueil nomme le plan demandé et ses rails ; avec `?theme=`, le thème aussi ; un plan inconnu est ignoré", async ({ browser }) => {
    const jour = parseDay(JOUR)!;
    const duJour = dailyPinball(jour);
    const noms: Record<string, string> = { doublette: "Doublette", tremplin: "Tremplin", bretelle: "Bretelle", boucle: "Boucle" };
    const autre = Object.keys(noms).find((p) => p !== duJour.plan)!;
    const a = await appareil(browser, `/?debug&manuel&tactile=0&qualite=basse&plan=${autre}`);
    await expect(a.page.locator(".p-plan")).toHaveText(`Plan : ${noms[autre]}`);
    // les rails du plan sont de la liste des modules présents (au nom du thème du jour)
    await expect(a.page.locator(".p-module").filter({ hasText: /Montagnes russes|Toboggan|Tube orbital|Wagonnet/ })).toHaveCount(1);
    await expect(a.page.locator(".p-module").filter({ hasText: /Grand huit|Courant|Orbite|Galerie/ })).toHaveCount(1);
    await a.context.close();
    const b = await appareil(browser, `/?debug&manuel&tactile=0&qualite=basse&plan=${autre}&theme=volcan`);
    await expect(b.page.locator(".p-plan")).toHaveText(`Plan : ${noms[autre]}`);
    await expect(b.page.locator(".p-module").filter({ hasText: "Wagonnet" })).toHaveCount(1);
    await b.context.close();
    const c = await appareil(browser, "/?debug&manuel&tactile=0&qualite=basse&plan=inconnu");
    await expect(c.page.locator(".p-plan")).toHaveText(`Plan : ${noms[duJour.plan]}`);
    await c.context.close();
  });

  test("`?plan=` + `?robot` : le robot joue le plan demandé (ses événements sont ceux de la simulation sur ce plan), et la partie n'est pas classable", async ({ browser }) => {
    const plan = "tremplin";
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&qualite=basse&robot&plan=${plan}`);
    await lancer(page);
    const PAS = 6000;
    await page.evaluate((pas) => window.__jeu.avancer(pas), PAS);
    const attendu = jouerRobot(dailyPinball(parseDay(JOUR)!, undefined, undefined, plan), graineDuRobot(0), { maxTicks: DUREE_PARTIE_ROBOT });
    expect(await page.evaluate(() => window.__pinball!.evenements())).toEqual(attendu.evenements.filter((e) => e.tick < PAS));
    // la partie d'essai n'est pas classée : l'arrivée le dit
    await page.evaluate((pas) => window.__jeu.avancer(pas), DUREE_PARTIE_ROBOT);
    await expect(page.locator("#jeu-fin")).toBeVisible({ timeout: 30_000 }); // les seuils d'un plan d'essai (pas de fichier figé) sont ceux du robot : calculés ici, d'un trait
    await expect(page.locator("#jeu-fin-rang")).toContainText("essai");
    await context.close();
  });
});

// Lot PBS1 — LES SONS : `?debug&sons` ouvre la table des sons (un bouton par son), aucun son avant le premier geste, et la partie joue ses sons sans toucher à la simulation. **L'écoute ne se vérifie pas ici** (le navigateur de test n'a pas de
// haut-parleur) : on lit ce que la scène a décidé de jouer (`__pinball.sons()`).
test.describe("Pinball : les sons (?debug&sons)", () => {
  test("la table des sons : un bouton par son, un par thème pour les bumpers, et un bouton joue son son", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&qualite=basse&sons");
    await lancer(page);
    await page.locator(".pinball-sons > button").click();
    const attendu = Object.values(EXEMPLES).reduce((n, l) => n + l.length, 0);
    // les boutons des sons, plus les trois actions du bas (le spinner qui tourne, la rafale, fermer)
    await expect(page.locator(".pinball-sons button")).toHaveCount(attendu + 3 + 1);
    for (const nom of ["pomme d'amour", "bulle", "planète", "braise"]) await expect(page.getByRole("button", { name: `Bumper ${nom}` })).toBeVisible();
    // un bouton est un geste : le premier crée le contexte audio, le suivant joue
    await page.getByRole("button", { name: "Lance-pierre" }).click();
    await page.waitForFunction(() => window.__pinball!.sons().pret);
    await page.waitForTimeout(150);
    await page.getByRole("button", { name: "Lance-pierre" }).click();
    expect(await page.evaluate(() => window.__pinball!.sons().joues.some((j) => j.son === "sling" && j.joue))).toBe(true);
    await context.close();
  });

  test("sans `&sons`, ni panneau ni bouton", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&qualite=basse");
    await lancer(page);
    await expect(page.locator(".pinball-sons")).toHaveCount(0);
    await context.close();
  });

  test("aucun son avant le premier geste ; le premier appui de touche ouvre le contexte audio, et le batteur est décidé", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&qualite=basse");
    await lancer(page);
    await page.evaluate(() => window.__jeu.avancer(30));
    expect((await page.evaluate(() => window.__pinball!.sons())).pret).toBe(false);
    await page.keyboard.down("KeyQ");
    await page.evaluate(() => window.__jeu.avancer(30));
    await page.keyboard.up("KeyQ");
    await page.evaluate(() => window.__jeu.avancer(30));
    const sons = await page.evaluate(() => window.__pinball!.sons());
    expect(sons.pret).toBe(true);
    // l'appui du batteur est un son (joué si le contexte tournait déjà à cet instant, sinon perdu : jamais mis en file) ; la relâche aussi
    expect(sons.joues.filter((j) => j.son === "batteur").length).toBeGreaterThanOrEqual(1);
    await context.close();
  });

  test("le robot joue 9 000 pas : la partie décide des sons de la table, jamais le contraire (la rediffusion est celle de la simulation)", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&qualite=basse&robot");
    await lancer(page);
    await page.keyboard.press("Shift"); // un geste : le son s'ouvre
    await page.waitForFunction(() => window.__pinball!.sons().pret);
    await page.evaluate(() => window.__jeu.avancer(9000));
    const sons = await page.evaluate(() => window.__pinball!.sons());
    expect(sons.stats.appels).toBeGreaterThan(5);
    expect(sons.joues.some((j) => j.son === "batteur")).toBe(true);
    // la simulation n'a rien su des sons : les événements sont ceux du robot, au pas près
    expect(await page.evaluate(() => window.__pinball!.evenements())).toEqual(robot(JOUR).evenements.filter((e) => e.tick < 9000));
    await context.close();
  });
});

// Lot PBG3 — LA PORTE, LE POTEAU SAUVEUR ET L'AIGUILLAGE : `?essai=porte` ouvre la porte, `?essai=poteau` arme le poteau (hors production, jamais classés) ; le HUD dit l'état du poteau, la scène en décide les sons, les deux
// rendus les dessinent sans erreur.
test.describe("Pinball : la porte, le poteau et l'aiguillage (?essai=porte, ?essai=poteau)", () => {
  for (const qualite of ["basse", "haute"] as const) {
    test(`?essai=porte : la porte est ouverte et le plan en a une, rendu ${qualite}`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&qualite=${qualite}&plan=doublette&theme=foire&essai=porte`);
      const erreurs: string[] = [];
      page.on("pageerror", (e) => erreurs.push(e.message));
      await lancer(page);
      await page.evaluate(() => window.__jeu.avancer(120));
      expect(await page.evaluate(() => window.__pinball!.partie().passageOuvert)).toBeGreaterThan(1000);
      expect(await page.evaluate(() => window.__pinball!.partie().table.passage !== null)).toBe(true);
      await page.waitForTimeout(200);
      expect(erreurs).toEqual([]);
      await context.close();
    });
    test(`?essai=poteau : le poteau est armé, le HUD le dit, la bille entre les batteurs est renvoyée, rendu ${qualite}`, async ({ browser }) => {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&qualite=${qualite}&essai=poteau`);
      const erreurs: string[] = [];
      page.on("pageerror", (e) => erreurs.push(e.message));
      await lancer(page);
      await page.evaluate(() => window.__jeu.avancer(30));
      await expect(page.locator(".pinball-hud__poteau")).toHaveAttribute("data-etat", "arme");
      await page.keyboard.press("Shift"); // un geste : le son s'ouvre
      await page.waitForFunction(() => window.__pinball!.sons().pret);
      await page.evaluate(() => {
        const p = window.__pinball!.partie();
        p.dansLanceur = false;
        p.x = 184 * 4096;
        p.y = 600 * 4096;
        p.px = p.x;
        p.py = p.y;
        p.vx = 0;
        p.vy = 500 * 4096;
        window.__jeu.avancer(90);
      });
      expect(await page.evaluate(() => window.__pinball!.partie().sauvetages)).toBe(1);
      expect(await page.evaluate(() => window.__pinball!.partie().billes)).toBe(3);
      await expect(page.locator(".pinball-hud__poteau")).toHaveAttribute("data-etat", "rentre");
      const sons = await page.evaluate(() => window.__pinball!.sons().joues.map((j) => j.son));
      expect(sons).toContain("sauveur");
      // lot PBL1 : une fois par bille — la bille servie redescend les deux couloirs de retour : rien ne se rallume, le poteau ne se réarme pas
      await page.evaluate(() => {
        const p = window.__pinball!.partie();
        for (const x of [31, 337]) {
          p.x = x * 4096;
          p.y = 480 * 4096;
          p.px = p.x;
          p.py = p.y;
          p.vx = 0;
          p.vy = 120 * 4096;
          window.__jeu.avancer(90);
        }
      });
      expect(await page.evaluate(() => window.__pinball!.partie().lampes)).toEqual([false, false]);
      await expect(page.locator(".pinball-hud__poteau")).toHaveAttribute("data-etat", "rentre");
      await page.waitForTimeout(200);
      expect(erreurs).toEqual([]);
      await context.close();
    });
  }
});
