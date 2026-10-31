import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { hasWebGL } from "./phone";

// Lot M2 (outil, pas un test de CI) : Réglages › Commandes de Jump, onglets Clavier et Manette, ordinateur 1100 × 760, français.
//   CAPTURES=1 npx playwright test captures-lot-m2 --project=chromium   (dans `apps/jump`) → docs/plateforme/lots/img/lot-M2-jump-<onglet>.png
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(300_000);
const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/plateforme/lots/img");

test("Réglages › Commandes : Clavier et Manette", async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 1100, height: 760 });
  await page.addInitScript(() => localStorage.setItem("jump:aide", "1"));
  await page.goto("/?scenario=bac-a-sable&debug");
  test.skip(!(await hasWebGL(page)), "WebGL indisponible");
  await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "ready");
  await page.locator("#pausebtn").click();
  await page.locator("#menu-settings").click();
  await page.locator('#settings-commandes [data-focus="k:sauter:0"]').click();
  await page.keyboard.press("KeyZ"); // Sauter sur Z : la touche échangée est montrée
  await expect(page.locator('#settings-commandes [data-action="sauter"]')).toContainText("Z");
  await page.locator("#settings-commandes").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, "lot-M2-jump-clavier.png") });
  await page.locator('#settings-commandes [data-onglet="manette"]').click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, "lot-M2-jump-manette.png") });
});
