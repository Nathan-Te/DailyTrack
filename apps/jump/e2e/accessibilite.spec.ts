import { expect, test, type Page } from "@playwright/test";
import { auditAxe, focusDans, focusSur } from "./axe";
import { FIXED_NOW, atInstant } from "./clock";
import { hasWebGL } from "./phone";

// Lot I6 (plateforme) : l'accessibilité de Jump, en français et en anglais.
//   1. axe (e2e/axe.ts : WCAG 2.x A et AA, bonnes pratiques) sur « Comment jouer », l'accueil, les réglages, la pause et l'arrivée : aucune violation grave ;
//   2. les écrans en surimpression sont des dialogues pour un lecteur d'écran : `role="dialog"`, un nom, le focus mis dedans à l'ouverture et rendu à
//      la fermeture (Réglages → le bouton qui les a ouverts ; la pause rend la main à la partie : le focus revient à la page).
test.setTimeout(120_000);

interface J {
  phase: string;
  home: { ready: boolean };
  manual(on: boolean): void;
  advance(n: number): unknown;
  autoplay(code?: string): number;
  carnage: { skip(): void };
}

/** Un écran ouvert est un dialogue nommé. */
async function dialogueNomme(page: Page, selecteur: string): Promise<void> {
  const d = page.locator(selecteur);
  await expect(d).toHaveAttribute("role", "dialog");
  expect((await d.getAttribute("aria-label"))?.trim().length ?? 0, `${selecteur} : un nom pour le lecteur d'écran`).toBeGreaterThan(2);
}

for (const [langue, locale] of [["fr", "fr-FR"], ["en", "en-US"]] as const) {
  test(`Jump (${langue}) : « Comment jouer », accueil, réglages et pause — axe, dialogues et focus`, async ({ browser }) => {
    await atInstant(
      browser,
      FIXED_NOW,
      async (page) => {
        await page.goto("/?debug");
        test.skip(!(await hasWebGL(page)), "WebGL indisponible");
        await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.home.ready === true);
        await expect(page.locator("html")).toHaveAttribute("lang", langue);
        // Première visite : « Comment jouer » s'ouvre seul, le focus sur « C'est parti ».
        await expect(page.locator("#help")).toBeVisible();
        await dialogueNomme(page, "#help [role=dialog]");
        await expect.poll(() => focusSur(page)).toBe("help-close");
        await auditAxe(page, `jump-aide-${langue}`);
        await page.locator("#help-close").click();
        await expect(page.locator("#help")).toBeHidden();

        // L'accueil.
        await expect(page.locator("#home")).toBeVisible();
        await dialogueNomme(page, "#home");
        await expect.poll(() => focusDans(page, "#home"), { message: "le focus est dans l'accueil" }).toBe(true);
        await auditAxe(page, `jump-accueil-${langue}`);

        // Réglages depuis l'accueil : le focus y entre, puis revient au bouton « Réglages » (Échap).
        await page.locator("#home-settings").click();
        await expect(page.locator("#settings")).toBeVisible();
        await dialogueNomme(page, "#settings");
        await expect.poll(() => focusDans(page, "#settings")).toBe(true);
        await auditAxe(page, `jump-reglages-${langue}`);
        await page.keyboard.press("Escape");
        await expect(page.locator("#settings")).toBeHidden();
        await expect.poll(() => focusSur(page), { message: "le focus revient au bouton qui a ouvert les réglages" }).toBe("home-settings");

        // La pause, en partie : un dialogue nommé, le focus sur « Reprendre » ; fermée, le focus revient à la partie (la page).
        await page.locator("#home-play").click();
        await expect(page.locator("#home")).toBeHidden();
        await page.keyboard.press("Escape");
        await expect(page.locator("#menu")).toBeVisible();
        await dialogueNomme(page, "#menu [role=dialog]");
        await expect.poll(() => focusSur(page)).toBe("menu-resume");
        await auditAxe(page, `jump-pause-${langue}`);
        await page.keyboard.press("Escape");
        await expect(page.locator("#menu")).toBeHidden();
        await expect.poll(() => focusSur(page), { message: "la pause fermée rend le clavier à la partie" }).toBe("BODY");
      },
      { locale },
    );
  });

  test(`Jump (${langue}) : l'arrivée — axe, dialogue et focus`, async ({ browser }) => {
    await atInstant(
      browser,
      FIXED_NOW,
      async (page) => {
        await page.goto("/?accueil=0&debug");
        test.skip(!(await hasWebGL(page)), "WebGL indisponible");
        await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.phase === "ready");
        await page.evaluate(() => {
          const j = (window as unknown as { __jump: J }).__jump;
          j.manual(true);
          const n = j.autoplay();
          j.advance(n + 5);
          j.carnage.skip();
          j.advance(2);
        });
        await expect(page.locator("#arrival")).toBeVisible();
        await dialogueNomme(page, "#arrival");
        await expect.poll(() => focusDans(page, "#arrival"), { message: "le focus est dans l'arrivée" }).toBe(true);
        await auditAxe(page, `jump-arrivee-${langue}`);
      },
      { locale },
    );
  });
}
