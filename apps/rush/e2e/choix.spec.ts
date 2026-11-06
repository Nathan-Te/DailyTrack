import { expect, test, type Page } from "@playwright/test";
import { parseDay } from "@cdj/core";
import { AMELIORATIONS, Partie, contenuScenario } from "@cdj/rush-sim";
import { API, JOUR, appareil, jouerLeJour, lancer } from "./appareil";

// « Rush » (lot BR2) — le choix d'une amélioration : au clavier (1 2 3, flèches puis Entrée), à la manette (croix, stick, A), au doigt et à la souris (le toucher d'une carte). Le monde est figé pendant le choix, Entrée ne relance pas la partie
// (c'est « Recommencer » pour le kit), le choix est noté pour la rediffusion. `?scenario=cartes&nv=5` ouvre l'écran tout de suite. Les règles (tirage, validation par le serveur) sont dans `packages/rush-sim/test/xp.test.ts`.
const URL_CARTES = `/?api=${API}&debug&manuel&tactile=0&scenario=cartes&nv=5`;

/** Les trois cartes que la simulation tire pour le jour d'essai au niveau 5 (le même tirage que la page). */
const cartesAttendues = (): string[] => new Partie(contenuScenario("cartes", { jour: parseDay(JOUR)!, nv: 5 })).choix!.cartes.map((i) => AMELIORATIONS[i]!.id);
const noms = (page: Page): Promise<string[]> => page.locator(".rush-option").evaluateAll((l) => l.map((e) => (e as HTMLElement).dataset.carte!));

test.describe("Rush : le choix d'une amélioration", () => {
  test("au clavier : l'écran s'ouvre figé avec les trois cartes du jour, les flèches déplacent la surbrillance, Entrée choisit sans relancer la partie, 1 2 3 choisissent", async ({ browser }) => {
    const { context, page } = await appareil(browser, URL_CARTES);
    await lancer(page);
    await expect(page.locator(".rush-choix")).toBeVisible();
    await expect(page.locator(".rush-choix__titre")).toHaveText("NIVEAU 5 !");
    await expect(page.locator(".rush-niveau__nv")).toHaveText("Nv 5");
    expect(await noms(page)).toEqual(cartesAttendues());
    for (const nom of await page.locator(".rush-option__nom").allTextContents()) expect(nom.length).toBeGreaterThan(2);
    for (const effet of await page.locator(".rush-option__effet").allTextContents()) expect(effet).not.toMatch(/[{}]/); // aucun paramètre resté en clair
    // le monde est figé : ni tick, ni chrono
    await page.evaluate(() => window.__jeu.avancer(120));
    expect(await page.evaluate(() => window.__rush.partie().tick)).toBe(0);
    await expect(page.locator("#jeu-hud-score")).toBeVisible();
    // les flèches déplacent la surbrillance (elle fait le tour)
    expect(await page.evaluate(() => window.__rush.selection())).toBe(0);
    await page.keyboard.press("ArrowRight");
    expect(await page.evaluate(() => window.__rush.selection())).toBe(1);
    await expect(page.locator(".rush-option").nth(1)).toHaveClass(/rush-option--sel/);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    expect(await page.evaluate(() => window.__rush.selection())).toBe(0);
    await page.keyboard.press("ArrowLeft");
    expect(await page.evaluate(() => window.__rush.selection())).toBe(2);
    // Entrée choisit la carte en surbrillance — et ne relance PAS la partie (« Recommencer » est sur Entrée pour le kit)
    await page.keyboard.press("Enter");
    await expect(page.locator(".rush-choix")).toBeHidden();
    expect(await page.evaluate(() => window.__jeu.phase())).toBe("jeu");
    expect(await page.evaluate(() => window.__rush.choix())).toEqual([{ tick: 0, nv: 5, carte: 2 }]);
    expect(await page.evaluate(() => window.__rush.choixEnAttente())).toBeNull();
    // le monde repart
    await page.evaluate(() => window.__jeu.avancer(30));
    expect(await page.evaluate(() => window.__rush.partie().tick)).toBe(30);
    // un autre niveau, choisi par un chiffre
    await page.evaluate(() => window.__rush.redemarrer());
    await expect(page.locator(".rush-choix")).toBeVisible();
    await page.keyboard.press("Digit2");
    await expect(page.locator(".rush-choix")).toBeHidden();
    expect(await page.evaluate(() => window.__rush.choix())).toEqual([{ tick: 0, nv: 5, carte: 1 }]);
    await context.close();
  });

  test("à la manette : la croix et le stick déplacent la surbrillance, A choisit", async ({ browser }) => {
    const { context, page } = await appareil(browser, URL_CARTES);
    await page.evaluate(() => {
      const pad = { id: "manette d'essai", index: 0, connected: true, mapping: "standard", timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) };
      (window as unknown as { __pad: typeof pad }).__pad = pad;
      navigator.getGamepads = () => [pad as unknown as Gamepad, null, null, null];
    });
    await lancer(page);
    await expect(page.locator(".rush-choix")).toBeVisible();
    const appuyer = async (bouton: number): Promise<void> => {
      await page.evaluate((b) => ((window as unknown as { __pad: { buttons: { pressed: boolean }[] } }).__pad.buttons[b]!.pressed = true), bouton);
      await page.waitForTimeout(120);
      await page.evaluate((b) => ((window as unknown as { __pad: { buttons: { pressed: boolean }[] } }).__pad.buttons[b]!.pressed = false), bouton);
      await page.waitForTimeout(60);
    };
    await appuyer(15); // croix à droite
    expect(await page.evaluate(() => window.__rush.selection())).toBe(1);
    await page.evaluate(() => ((window as unknown as { __pad: { axes: number[] } }).__pad.axes[0] = 0.9)); // le stick à droite
    await page.waitForTimeout(120);
    await page.evaluate(() => ((window as unknown as { __pad: { axes: number[] } }).__pad.axes[0] = 0));
    expect(await page.evaluate(() => window.__rush.selection())).toBe(2);
    await appuyer(14); // croix à gauche
    expect(await page.evaluate(() => window.__rush.selection())).toBe(1);
    await appuyer(0); // A
    await expect(page.locator(".rush-choix")).toBeHidden();
    expect(await page.evaluate(() => window.__rush.choix())).toEqual([{ tick: 0, nv: 5, carte: 1 }]);
    await context.close();
  });

  test("au doigt et à la souris sur un téléphone en paysage (844 × 390) : les trois cartes tiennent à l'écran, le toucher d'une carte la choisit", async ({ browser }) => {
    const { context, page } = await appareil(browser, URL_CARTES);
    await page.setViewportSize({ width: 844, height: 390 });
    await lancer(page);
    await expect(page.locator(".rush-choix")).toBeVisible();
    const cartes = page.locator(".rush-option");
    await expect(cartes).toHaveCount(3);
    const boites = await cartes.evaluateAll((l) => l.map((e) => e.getBoundingClientRect().toJSON() as { left: number; right: number; top: number; bottom: number; height: number }));
    for (const b of boites) {
      expect(b.left).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(844);
      expect(b.top).toBeGreaterThanOrEqual(0);
      expect(b.bottom).toBeLessThanOrEqual(390);
      expect(b.height).toBeGreaterThanOrEqual(44); // une cible tactile
    }
    expect(boites[0]!.right).toBeLessThanOrEqual(boites[1]!.left); // elles ne se chevauchent pas
    expect(boites[1]!.right).toBeLessThanOrEqual(boites[2]!.left);
    await cartes.nth(2).click();
    await expect(page.locator(".rush-choix")).toBeHidden();
    expect(await page.evaluate(() => window.__rush.choix())).toEqual([{ tick: 0, nv: 5, carte: 2 }]);
    await context.close();
  });

  test("une partie du jour : des niveaux gagnés, des choix notés, et ce que le serveur rejouera (avec ces choix) est ce que la page a joué", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?api=${API}&debug&manuel&tactile=0`);
    await lancer(page);
    await expect(page.locator(".rush-niveau")).toBeVisible();
    await expect(page.locator(".rush-niveau__nv")).toHaveText("Nv 1");
    const attendu = await jouerLeJour(page); // rejoue en Node les changements ET les choix de la page : le résultat est celui de la page, ou la rediffusion serait refusée
    expect(attendu.victoire).toBe(true);
    expect(attendu.nv).toBeGreaterThanOrEqual(2);
    const choix = await page.evaluate(() => window.__rush.choix());
    expect(choix.map((c) => c.nv)).toEqual(choix.map((_, i) => i + 2));
    await context.close();
  });
});
