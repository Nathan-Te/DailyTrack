import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const golden = JSON.parse(readFileSync(new URL("../../../packages/sim/test/fixtures/essai-autopilot.json", import.meta.url), "utf8")) as {
  code: string;
  finishMs: number;
  splits: number[];
  simVersion: number;
};

// Le rendu 3D demande WebGL : on ne le vérifie que dans Chromium (rendu logiciel). La simulation, elle, est
// vérifiée dans tous les navigateurs par replay.spec.ts.
test.describe("fantôme (rendu 3D)", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");

  test("le meilleur temps enregistré devient un fantôme qui roule tout seul", async ({ page }, testInfo) => {
    await page.addInitScript((best) => localStorage.setItem("cdj:best:essai", JSON.stringify(best)), {
      ms: golden.finishMs,
      splits: golden.splits,
      replay: golden.code,
      simVersion: golden.simVersion,
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await page.goto("/?debug&scenario=essai");
    await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 15_000 });
    const z0 = await page.evaluate(() => window.__cdj.ghost?.z);
    expect(z0).toBeDefined();

    // Le joueur ne touche à rien : seul le fantôme avance.
    // (on attend qu'il ait avancé plutôt qu'un temps fixe : la CI rend en logiciel, plus ou moins vite)
    await page.waitForFunction((z) => (window.__cdj.ghost?.z ?? 0) > z + 10, z0!, { timeout: 30_000 });
    const after = await page.evaluate(() => ({ ghost: window.__cdj.ghost, car: window.__cdj.car.z }));
    expect(after.ghost!.tick).toBeGreaterThan(30);
    expect(after.ghost!.z).toBeGreaterThan(z0! + 10);
    expect(after.car).toBeLessThan(z0! + 1);

    await testInfo.attach("fantome.png", { body: await page.screenshot(), contentType: "image/png" });
    expect(errors).toEqual([]);
  });

  test("sans rediffusion enregistrée (ancien record), il n'y a pas de fantôme mais le jeu marche", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("cdj:best:essai", JSON.stringify({ ms: 50_000, splits: [1, 2, 3] })));
    await page.goto("/?debug&scenario=essai");
    await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 15_000 });
    expect(await page.evaluate(() => window.__cdj.ghost)).toBeNull();
  });
});

test.describe("enregistrement du record (rendu 3D)", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");

  test("à l'arrivée, le temps est enregistré avec sa rediffusion", async ({ page }) => {
    await page.goto("/?debug&scenario=essai");
    await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 15_000 });
    // On se téléporte juste avant la ligne d'arrivée : on teste l'enregistrement, pas la conduite
    // (la rediffusion de cette course truquée n'est donc pas rejouable, seule sa présence compte).
    await page.evaluate(() => {
      const r = window.__cdj.race as unknown as { car: Record<string, number>; nextGate: number; track: { gates: { x: number; z: number }[] } };
      r.nextGate = r.track.gates.length - 1;
      const c = r.car;
      c.x = -10 * 32 + 16;
      c.z = 8 * 32 + 28;
      c.y = 0;
      c.yaw = Math.PI;
      c.vx = 0;
      c.vz = -40;
    });
    await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 15_000 });
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("cdj:best:essai")!));
    expect(stored.ms).toBeGreaterThan(0);
    expect(stored.simVersion).toBe(golden.simVersion);
    expect(stored.replay).toMatch(/^[A-Za-z0-9_-]{10,}$/);
    await expect(page.locator("#finish")).toBeVisible();
  });
});
