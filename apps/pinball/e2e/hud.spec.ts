import { expect, test } from "@playwright/test";
import { EV_COMBO, EV_ORBITE, EV_RAMPE, Partie, dailyPinball, grouper, graineDuRobot, jouerRobot } from "@cdj/pinball-sim";
import { parseDay } from "@cdj/core";
import { appareil, JOUR, lancer } from "./appareil";

// « Pinball » (lot PB5b) — LE HUD EN SURIMPRESSION : **aucune plaque ne prend de toucher** (le doigt y joue les batteurs), les deux boutons (pause, plein écran) font 44 px, la pause du HUD ouvre celle du kit, les noms lus, l'aide
// d'avant le lancer part au premier lancer, l'aide du clavier n'est que sur ordinateur et à la première partie de la page. Le cadrage de la table entre les bandes (sept écrans, haute qualité) est dans `hud-cadrage.spec.ts` (Régression).
test.describe("Pinball : le HUD en surimpression", () => {
  test("aucune plaque ne prend de toucher ; les deux boutons en prennent et font 44 px ; le doigt sur une plaque joue le batteur", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1&qualite=basse");
    await page.setViewportSize({ width: 390, height: 844 });
    await lancer(page);
    const evenements = await page.evaluate(() => {
      const pe = (s: string): string => getComputedStyle(document.querySelector(s)!).pointerEvents;
      return {
        racine: pe(".pinball-hud"),
        plaques: [".pinball-hud__afficheur", ".pinball-hud__mult", ".pinball-mission", ".pinball-hud__billes", ".pinball-hud__aide", ".pinball-combo", ".pinball-verrou"].map(pe),
        boutons: [".pinball-hud__pause", ".pinball-hud__plein"].map((s) => { const e = document.querySelector<HTMLElement>(s); return e && !e.hidden ? { pe: pe(s), l: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height } : null; }),
      };
    });
    expect(evenements.racine).toBe("none");
    expect(evenements.plaques).toEqual(["none", "none", "none", "none", "none", "none", "none"]);
    expect(evenements.boutons[0]).toEqual({ pe: "auto", l: 44, h: 44 });
    for (const b of evenements.boutons) if (b) expect(b.pe).toBe("auto");
    // le toucher sur la plaque de la mission traverse jusqu'à la table : la bille attend dans le lanceur, un toucher tenu est le lanceur
    const m = (await page.locator(".pinball-mission").boundingBox())!;
    await page.mouse.move(m.x + m.width / 2, m.y + m.height / 2);
    await page.mouse.down();
    await page.evaluate(() => window.__jeu.avancer(2));
    await page.mouse.up();
    await page.evaluate(() => window.__jeu.avancer(2));
    expect(await page.evaluate(() => window.__pinball!.evenements().map((e) => [e.c, e.enfonce]))).toEqual([[2, true], [2, false]]);
    await context.close();
  });

  test("la pause du HUD ouvre celle du kit, la barre crème du kit n'est plus à l'écran, son texte reste dans la page", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1&qualite=basse");
    await lancer(page);
    await expect(page.locator(".jeu-hud")).toBeHidden();
    await expect(page.locator("#pinball-pause")).toBeVisible();
    await expect(page.locator("#jeu-hud-score")).toHaveText("0"); // lu par la pause et les lecteurs d'écran
    await page.locator("#pinball-pause").click();
    await expect(page.locator("#jeu-pause")).toBeVisible();
    expect(await page.evaluate(() => window.__jeu.phase())).toBe("pause");
    await context.close();
  });

  test("les noms lus : le score, le multiplicateur et les billes", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1&qualite=basse");
    await lancer(page);
    await expect(page.locator(".pinball-hud__afficheur")).toHaveAttribute("aria-label", "Score : 0");
    await expect(page.locator(".pinball-hud__mult")).toHaveAttribute("aria-label", "Multiplicateur ×1");
    await expect(page.locator(".pinball-hud__mult")).toHaveText("×1");
    await expect(page.locator(".pinball-hud__mult")).toHaveAttribute("data-haut", "0");
    await expect(page.locator(".pinball-hud__billes")).toHaveAttribute("aria-label", "Billes : 3 sur 3");
    await expect(page.locator('.pinball-hud__bille[data-perdue="1"]')).toHaveCount(0);
    await context.close();
  });

  test("l'aide du clavier : sur ordinateur, à la première partie de la page seulement, et elle part au premier lancer ; jamais sur écran tactile", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&qualite=basse");
    await page.setViewportSize({ width: 1440, height: 900 });
    await lancer(page);
    await expect(page.locator(".pinball-hud__clavier")).toBeVisible();
    await expect(page.locator(".pinball-hud__touche")).toHaveCount(3);
    await expect(page.locator(".pinball-hud__touche").nth(2)).toContainText("Maintiens, relâche : lancer");
    await page.evaluate(() => {
      window.__pinball!.regler(2, true);
      window.__jeu.avancer(100);
      window.__pinball!.regler(2, false);
      window.__jeu.avancer(2);
    });
    await expect(page.locator(".pinball-hud__clavier")).toBeHidden();
    await expect(page.locator(".pinball-hud__aide")).toBeHidden();
    // une autre partie sur la même page : l'aide du clavier n'est pas redonnée
    await page.evaluate(() => window.__jeu.avancer(600000));
    await page.locator("#jeu-rejouer").click();
    await expect(page.locator(".pinball-hud__clavier")).toHaveCount(0);
    await expect(page.locator(".pinball-hud__aide")).toBeVisible();
    await context.close();
    const t = await appareil(browser, "/?debug&manuel&tactile=1&qualite=basse");
    await t.page.setViewportSize({ width: 1440, height: 900 });
    await lancer(t.page);
    await expect(t.page.locator(".pinball-hud__clavier")).toHaveCount(0);
    await t.context.close();
  });

  // --- Lot PBG1 : le compteur de combo « COMBO ×3 » et sa fine jauge de temps, et le gain d'un rail à l'afficheur.
  test("le compteur de combo : caché sans combo, « Combo ×n » avec sa jauge qui se vide, moutarde dès le rang 2, et il disparaît quand le délai est passé ; il ne prend aucun toucher", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1&qualite=basse");
    await page.setViewportSize({ width: 390, height: 844 });
    await lancer(page);
    const combo = page.locator(".pinball-combo");
    await expect(combo).toBeHidden(); // posé dans la grille, mais caché : rien à dire
    expect(await combo.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");
    // un combo de rang 3 qui a 1 800 pas devant lui (le délai de 3 000 pas : 60 % de la jauge)
    await page.evaluate(() => {
      const p = window.__pinball!.partie();
      Object.assign(p, { combo: 3, comboFin: p.tick + 1800 });
      window.__jeu.avancer(1);
    });
    await expect(combo).toBeVisible();
    await expect(combo.locator(".pinball-combo__texte")).toHaveText("Combo ×3");
    await expect(combo).toHaveAttribute("data-haut", "1");
    await expect(combo).toHaveAttribute("aria-label", "Combo ×3");
    const reste = await combo.locator(".pinball-combo__jauge i").evaluate((e) => Number(getComputedStyle(e).getPropertyValue("--p-reste")));
    expect(reste).toBeGreaterThan(0.55);
    expect(reste).toBeLessThan(0.65);
    // la jauge se vide : à la moitié du reste, elle est à 30 %
    await page.evaluate(() => window.__jeu.avancer(900));
    const moitie = await combo.locator(".pinball-combo__jauge i").evaluate((e) => Number(getComputedStyle(e).getPropertyValue("--p-reste")));
    expect(moitie).toBeGreaterThan(0.25);
    expect(moitie).toBeLessThan(0.35);
    // le rang 1 est papier : pas encore un combo
    await page.evaluate(() => {
      Object.assign(window.__pinball!.partie(), { combo: 1 });
      window.__jeu.avancer(1);
    });
    await expect(combo.locator(".pinball-combo__texte")).toHaveText("Combo ×1");
    await expect(combo).toHaveAttribute("data-haut", "0");
    // le délai passé : le compteur s'en va
    await page.evaluate(() => window.__jeu.avancer(1000));
    await expect(combo).toBeHidden();
    await context.close();
  });

  test("l'anglais : « Combo ×2 » (catalogue) et le compteur est dans l'écran, sous la bande du haut, sur quatre écrans", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1&qualite=basse");
    await page.evaluate(() => localStorage.setItem("cdj:langue", "en"));
    await page.reload();
    await page.waitForSelector("#jeu-jouer", { state: "attached" });
    await lancer(page);
    await page.evaluate(() => {
      const p = window.__pinball!.partie();
      Object.assign(p, { combo: 2, comboFin: p.tick + 2000 });
      window.__jeu.avancer(1);
    });
    await expect(page.locator(".pinball-combo__texte")).toHaveText("Combo ×2");
    for (const [l, h] of [[390, 844], [360, 640], [844, 390], [1440, 900]] as const) {
      await page.setViewportSize({ width: l, height: h });
      await page.evaluate(() => window.__jeu.avancer(1));
      const r = (await page.locator(".pinball-combo").boundingBox())!;
      expect(r.x, `${l} × ${h}`).toBeGreaterThanOrEqual(0);
      expect(r.y, `${l} × ${h}`).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width, `${l} × ${h}`).toBeLessThanOrEqual(l);
      expect(r.y + r.height, `${l} × ${h}`).toBeLessThanOrEqual(h);
      // petit : jamais un rideau sur la table (la taille de la mise en page : la plaque « saute » d'un cran de combo, son rectangle à l'écran grossit un instant)
      const taille = await page.locator(".pinball-combo").evaluate((e) => ({ l: (e as HTMLElement).offsetWidth, h: (e as HTMLElement).offsetHeight }));
      expect(taille.h, `${l} × ${h}`).toBeLessThanOrEqual(32);
      expect(taille.l, `${l} × ${h}`).toBeLessThanOrEqual(140);
    }
    await context.close();
  });

  test("un rail mené à son bout : « + points » à l'afficheur (ceux que la simulation compte) et le combo monte au rail suivant dans le délai", async ({ browser }) => {
    // la partie du robot sur la « Doublette » de l'Océan ce jour-là (graine 0) : on cherche, dans la simulation (Node), le premier rail mené à son bout et le premier combo
    const contenu = dailyPinball(parseDay(JOUR)!, undefined, "ocean", "doublette"); // lot PBL1 : l'Océan (le robot de l'Espace y perd ses billes en 70 s et ne chaîne plus deux rails)
    const robot = jouerRobot(contenu, graineDuRobot(0), { maxTicks: 216000 });
    const p = new Partie(contenu);
    let k = 0;
    let premier: { pas: number; gain: number } | null = null;
    let combo: { pas: number; rang: number } | null = null;
    for (let t = 0; t < robot.partie.tick && !combo; t++) {
      while (k < robot.evenements.length && robot.evenements[k]!.tick === t) p.regler(robot.evenements[k]!.c, robot.evenements[k++]!.enfonce);
      p.avancer();
      if (p.ev & (EV_RAMPE | EV_ORBITE)) {
        if (!premier) premier = { pas: t, gain: p.gains.reduce((s, g) => s + g.points, 0) };
        if (p.ev & EV_COMBO) combo = { pas: t, rang: p.combo };
      }
    }
    expect(premier, "le robot mène un rail à son bout").not.toBeNull();
    expect(combo, "et il en enchaîne deux").not.toBeNull();
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&qualite=basse&robot&theme=ocean&plan=doublette");
    await lancer(page);
    await page.evaluate((pas) => window.__jeu.avancer(pas + 1), premier!.pas);
    await expect(page.locator(".pinball-hud__chiffres")).toHaveText(`+${grouper(premier!.gain, "fr")}`);
    await expect(page.locator(".pinball-combo")).toBeVisible();
    await expect(page.locator(".pinball-combo__texte")).toHaveText("Combo ×1");
    await page.evaluate((pas) => window.__jeu.avancer(pas), combo!.pas - premier!.pas);
    await expect(page.locator(".pinball-combo__texte")).toHaveText(`Combo ×${combo!.rang}`);
    await expect(page.locator(".pinball-combo")).toHaveAttribute("data-haut", "1");
    await context.close();
  });

  // --- Lot PBG2 : le verrou, la multibille et le niveau de la mission dans le HUD.
  test("le verrou : deux billes à verrouiller et le niveau, « Verrou allumé » en moutarde quand la mission est réussie ; pendant la multibille la bande du bas dit « MULTIBILLE » et le prochain jackpot ; ensuite la mission revient au niveau 2", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1&qualite=basse&essai=verrou&plan=doublette&theme=espace");
    await page.setViewportSize({ width: 390, height: 844 });
    await lancer(page);
    const verrou = page.locator(".pinball-verrou");
    await expect(verrou).toBeHidden(); // avant le premier lancer : l'aide d'avant le lancer a sa place
    await page.evaluate(() => {
      window.__pinball!.regler(2, true);
      window.__jeu.avancer(300);
      window.__pinball!.regler(2, false);
      window.__jeu.avancer(5);
    });
    await expect(verrou).toBeVisible();
    await expect(verrou).toHaveAttribute("data-etat", "allume");
    await expect(verrou.locator(".pinball-verrou__texte")).toHaveText("Verrou allumé");
    await expect(page.locator(".pinball-mission")).toHaveAttribute("data-etat", "reussie");
    expect(await verrou.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");
    expect(await verrou.locator(".pinball-verrou__billes i").count()).toBe(2);
    // une bille verrouillée : une petite bille pleine
    await page.evaluate(() => {
      const p = window.__pinball!.partie();
      p.verrouillees = 1;
      p.verrouAllume = false;
      window.__jeu.avancer(1);
    });
    await expect(verrou).toHaveAttribute("data-etat", "plein");
    await expect(verrou.locator(".pinball-verrou__billes i[data-plein='1']")).toHaveCount(1);
    await expect(verrou.locator(".pinball-verrou__texte")).toHaveText("Niveau 1");
    // la multibille : la bande du bas
    await page.evaluate(() => {
      window.__pinball!.partie().lancerLaMultibille();
      window.__jeu.avancer(2);
    });
    const mission = page.locator(".pinball-mission");
    await expect(mission).toHaveAttribute("data-etat", "multibille");
    await expect(mission.locator(".pinball-mission__nom")).toHaveText("MULTIBILLE");
    await expect(mission.locator(".pinball-mission__val")).toHaveText(/Jackpot 5\s?000/);
    await expect(mission.locator(".pinball-mission__jauge")).toBeHidden();
    // la multibille finie : la mission est revenue, au niveau 2, et son but est plus haut
    await page.evaluate(() => {
      const p = window.__pinball!.partie();
      p.autres.length = 0;
      p.aLacher = 0;
      window.__jeu.avancer(2);
    });
    await expect(mission).not.toHaveAttribute("data-etat", "multibille");
    await expect(verrou.locator(".pinball-verrou__texte")).toHaveText("Niveau 2");
    await context.close();
  });
});
