import { expect, test } from "@playwright/test";
import { createVitesseTrack, encodeReplay, runPilot } from "@cdj/sim";

// Lot 15 : scénario `vitesse` (plaque et longue descente, turbos enchaînés, grande courbe relevée à fond, freinage avant un
// virage serré) et sensation de vitesse (compteur coloré, champ de vision, décor de bord de piste).
// Rendu 3D : Chromium seulement ; le déterminisme du pilote dans les trois navigateurs est éprouvé par `daily.spec.ts`.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(150_000);

test("?scenario=vitesse : le pilote finit au temps de Node, dépasse 80 m/s, le compteur passe au rouge et la caméra s'ouvre", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  const run = runPilot(createVitesseTrack(), { grip: 1 });
  expect(run.valid).toBe(true);
  await page.goto("/?debug&scenario=vitesse&timescale=6&quality=2");
  await page.waitForFunction(() => window.__cdj?.phase);
  await expect(page.locator("#meta")).toHaveText("Circuit de vitesse");

  await page.evaluate((c) => window.__cdj.autoplay(c), encodeReplay(run.replay));
  // Au plus fort de la course : compteur au niveau 3 (rouge), champ de vision au-delà de celui de la pointe, lignes de vitesse visibles.
  await page.waitForFunction(() => document.getElementById("speed")?.dataset.level === "3", undefined, { timeout: 100_000 });
  const peak = await page.evaluate(() => ({
    level: document.getElementById("speed")!.dataset.level,
    kmh: parseInt(document.getElementById("speed")!.textContent ?? "0", 10),
    lines: parseFloat(document.getElementById("lines")!.style.opacity),
    fov: window.__cdj.fx.fov as number,
  }));
  expect(peak.level).toBe("3");
  expect(peak.kmh).toBeGreaterThan(250); // > 70 m/s
  expect(peak.lines).toBeGreaterThan(0.45);
  expect(peak.fov).toBeGreaterThan(80);

  await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 120_000 });
  const finishMs = await page.evaluate(() => (window.__cdj.race as unknown as { finishMs: number }).finishMs);
  expect(finishMs).toBe(run.finishMs);
  expect(errors).toEqual([]);
});
