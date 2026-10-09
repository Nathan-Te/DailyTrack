import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { encodeReplay, runPilot, salonCircuit } from "@cdj/sim";

// Captures du README du lot 26 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot26` (`OUT=…` change le dossier).
// Le Salon de démonstration : la voiture en course avec cinq fantômes (pseudo au-dessus de chacun) et le classement ; puis le podium.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.setTimeout(600_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/lots/img");
mkdirSync(OUT, { recursive: true });

const LEN = 10 * 60_000;
const SESSION = Math.floor(1791549980000 / LEN);
const START = SESSION * LEN;
const circuit = salonCircuit(SESSION);
const code = encodeReplay(runPilot(circuit.track, { grip: 0.9 }).replay);

test("le Salon en course avec ses fantômes, puis le podium", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.addInitScript(() => localStorage.setItem("cdj:name", "Nathan"));
  await page.goto(`/?mode=salon&api=demo&debug&salonAt=${START + 300_000}`);
  await page.waitForFunction(() => window.__cdj?.salon?.trackId, undefined, { timeout: 120_000 });
  await page.waitForFunction(() => (window.__cdj.salon!.board?.rows.length ?? 0) >= 6 && window.__cdj.salon!.ghosts!.count >= 5, undefined, { timeout: 180_000, polling: 500 });
  // En course : le joueur démarre doucement, les fantômes s'éloignent devant lui. Pas à pas jusqu'à 0,8 s après le départ, pause, image.
  await page.addStyleTag({ content: "#pause { visibility: hidden !important; }" });
  await page.evaluate(() => window.__cdj.manual(true));
  await page.keyboard.press("Enter"); // départ neuf : les fantômes repartent avec la voiture
  for (let guard = 0; guard < 400; guard++) {
    const at = await page.evaluate(() => (window.__cdj.phase === "racing" ? (window.__cdj.car as unknown as { tick: number }).tick : -1));
    if (at >= 170) break;
    await page.evaluate((n) => window.__cdj.advance(n), at < 0 ? 60 : Math.min(20, 170 - at));
  }
  await page.keyboard.press("KeyP");
  await page.evaluate(() => window.__cdj.manual(false));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(OUT, "lot-26-salon-course.png") });
  await page.evaluate(() => document.getElementById("pause-resume")!.click());

  // Podium : un tour complet (pas à pas : indépendant de la vitesse de la machine), puis la session se termine.
  await page.evaluate(() => window.__cdj.manual(true));
  await page.evaluate((c) => window.__cdj.autoplay(c), code);
  for (let guard = 0; guard < 120 && (await page.evaluate(() => window.__cdj.phase)) !== "finished"; guard++) await page.evaluate(() => window.__cdj.advance(240));
  await page.evaluate(() => window.__cdj.manual(false));
  await expect(page.locator("#finish .rank")).toContainText("Rang", { timeout: 240_000 });
  await page.evaluate(() => window.__cdj.salon!.setNow(window.__cdj.salon!.endMs + 200));
  await expect(page.locator("#podium .place")).toHaveCount(3, { timeout: 30_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, "lot-26-salon-podium.png") });
});
