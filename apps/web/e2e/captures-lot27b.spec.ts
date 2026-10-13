import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";

// Capture du README du lot 27b (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot27b` (`OUT=…` change le dossier).
// Le mode spectateur sur un jour passé de la démonstration : la voiture du premier (pleine, avec son pseudo), la barre de lecture.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.setTimeout(300_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/lots/img");
mkdirSync(OUT, { recursive: true });

test("le mode spectateur : voiture du premier, pseudo, barre de lecture", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/?api=demo&day=2026-09-30&watch=best&debug&camera=loin");
  await page.waitForFunction(() => window.__cdj?.watch, undefined, { timeout: 120_000 });
  await page.evaluate(() => window.__cdj.manual(true));
  // Pas à pas : 9 s de tour, pas de rendu pendant l'avance ; puis on rend une image.
  for (let i = 0; i < 9; i++) await page.evaluate(() => window.__cdj.advance(120));
  await page.evaluate(() => window.__cdj.manual(false));
  await page.locator("#watch-play").click();
  await page.locator("[data-speed=\"0.5\"]").click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, "lot-27b-spectateur.png") });
});
