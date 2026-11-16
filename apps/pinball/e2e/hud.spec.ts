import { expect, test } from "@playwright/test";
import { appareil, lancer } from "./appareil";

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
        plaques: [".pinball-hud__afficheur", ".pinball-hud__mult", ".pinball-mission", ".pinball-hud__billes", ".pinball-hud__aide"].map(pe),
        boutons: [".pinball-hud__pause", ".pinball-hud__plein"].map((s) => { const e = document.querySelector<HTMLElement>(s); return e && !e.hidden ? { pe: pe(s), l: e.getBoundingClientRect().width, h: e.getBoundingClientRect().height } : null; }),
      };
    });
    expect(evenements.racine).toBe("none");
    expect(evenements.plaques).toEqual(["none", "none", "none", "none", "none"]);
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
});
