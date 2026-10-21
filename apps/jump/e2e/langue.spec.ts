import { expect, test, type Page } from "@playwright/test";
import { FIXED_NOW, atInstant } from "./clock";
import { hasWebGL } from "./phone";

// Lot I5 : Jump en français et en anglais. La langue est celle de la plateforme (`cdj:langue`, écrite par le portail ou les Réglages d'un jeu), sinon celle du
// navigateur ; elle change dans Réglages › Langue **sans recharger** (un témoin posé sur `window` le prouve) et vaut pour toute la plateforme ; `<html lang>` et le
// titre suivent. Le catalogue anglais est un fichier à part, chargé à la demande. Les tests de Jump tournent en `fr-FR` (playwright.config.ts) : l'anglais ouvre
// un contexte `en-US`.

interface J {
  phase: string;
  home: { open: boolean; ready: boolean };
  manual(on: boolean): void;
  advance(n: number): unknown;
  autoplay(code?: string): number;
  carnage: { skip(): void };
  arrival: { shown: boolean };
}
const ready = (page: Page) => page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.home.ready === true);

test("en anglais (navigateur en-US) : l'accueil, « How to play », le titre, `<html lang>` ; Réglages › Langue → français sans recharger, pour toute la plateforme", async ({ browser }) => {
  await atInstant(
    browser,
    FIXED_NOW,
    async (page) => {
      await page.goto("/?debug");
      test.skip(!(await hasWebGL(page)), "WebGL indisponible");
      await ready(page);
      // Première visite : « How to play » dans le jeu (une seule fois), en anglais.
      await expect(page.locator("#help")).toBeVisible();
      await expect(page.locator("#help .dialogue__titre")).toHaveText("HOW TO PLAY");
      await expect(page.locator("#help-close")).toHaveText("Let's go");
      await page.locator("#help-close").click();
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page).toHaveTitle("Jump — Du Jour");
      await expect(page.locator("#home-play")).toHaveText("PLAY");
      await expect(page.locator("#home .accueil__niveau")).toHaveText(/^Level #5 · /);
      await expect(page.locator("#home .dj-barre-jeu__retour")).toContainText("DU JOUR");
      // Le témoin : la page n'est pas rechargée par le changement de langue.
      await page.evaluate(() => ((window as unknown as { temoin: number }).temoin = 42));
      await page.locator("#home-settings").click();
      await expect(page.locator("#settings .etiquette__titre")).toHaveText("SETTINGS");
      await page.locator('#settings .dj-choix-langue__bouton[data-langue="fr"]').click();
      await expect(page.locator("#settings .etiquette__titre")).toHaveText("RÉGLAGES");
      await expect(page.locator("html")).toHaveAttribute("lang", "fr");
      expect(await page.evaluate(() => (window as unknown as { temoin?: number }).temoin)).toBe(42);
      expect(await page.evaluate(() => localStorage.getItem("cdj:langue"))).toBe("fr");
      await page.locator("#settings .dj-barre-jeu__retour").click();
      await expect(page.locator("#home-play")).toHaveText("JOUER");
      await expect(page.locator("#home .accueil__niveau")).toHaveText(/^Niveau n°\s5 · /);
    },
    { locale: "en-US" },
  );
});

test("l'arrivée en anglais : « FINISH! », la phrase selon les morts, le partage « Du Jour · Jump #5 » au format anglais", async ({ browser }) => {
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
      await expect(page.locator("#arrival .etiquette__titre")).toHaveText("FINISH!");
      await expect(page.locator("#arrival-phrase")).toHaveText("“Zero deaths. We'll be checking for cheats.”");
      await expect(page.locator("#arrival-replay")).toHaveText("PLAY AGAIN");
      await expect(page.locator("#arrival-time")).toHaveText(/^\d+\.\d{3}\ss$/);
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => undefined);
      await page.locator("#arrival-share").click();
      const line = await page.evaluate(() => (window as unknown as { __jump: { arrival: { share: string } } }).__jump.arrival.share);
      expect(line).toMatch(/^Du Jour · Jump #5 — \d+\.\d{3}\ss — 🏆 — 0 💀\n/);
    },
    { locale: "en-US" },
  );
});
