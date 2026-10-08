import { expect, test } from "@playwright/test";
import { FIGURES, createFigureTrack, createFiguresTrack, encodeReplay, runPilot } from "@cdj/sim";

// Lot 20 : scénarios `figures` (le tour des figures marquantes) et `figure` (une seule figure, en boucle), et l'admin qui les propose.
test.setTimeout(150_000);

test.describe("jeu (WebGL : Chromium seulement)", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");

  test("?scenario=figures : le pilote finit le tour au temps de Node, sans reprise", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const track = createFiguresTrack();
    const run = runPilot(track, { grip: 1 });
    expect(run.valid).toBe(true);
    await page.goto("/?debug&scenario=figures&timescale=8&quality=0");
    await page.waitForFunction(() => window.__cdj?.phase);
    await expect(page.locator("#meta")).toHaveText("Les figures");
    expect(await page.evaluate(() => window.__cdj.trackId)).toBe("figures");
    await page.evaluate((c) => window.__cdj.autoplay(c), encodeReplay(run.replay));
    await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 140_000 });
    const end = await page.evaluate(() => {
      const r = window.__cdj.race as unknown as { finishMs: number; respawns: number };
      return { finishMs: r.finishMs, respawns: r.respawns };
    });
    expect(end.finishMs).toBe(run.finishMs);
    expect(end.respawns).toBe(0);
    expect(errors).toEqual([]);
  });

  test("?scenario=figure&f=… : la figure demandée, sa variante et son miroir ; un nom inconnu retombe sur l'essai", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    const f = FIGURES.find((x) => x.name === "slalom-route")!;
    await page.goto("/?debug&scenario=figure&f=slalom-route&v=1&m=1&quality=0");
    await page.waitForFunction(() => window.__cdj?.phase);
    await expect(page.locator("#meta")).toHaveText(`Figure : ${f.label}`);
    expect(await page.evaluate(() => window.__cdj.trackId)).toBe("figure-slalom-route");
    const run = runPilot(createFigureTrack("slalom-route", 1, true)!, { grip: 1 });
    expect(run.valid).toBe(true);
    await page.evaluate((c) => window.__cdj.autoplay(c), encodeReplay(run.replay));
    await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 30_000 });
    await page.evaluate(() => window.__cdj.manual(true));
    // Pas à pas, sans rendu : le rejeu de la variante 1 (quatre virages) en miroir finit au temps de Node, sans reprise.
    for (let i = 0; i < 40; i++) {
      await page.evaluate(() => window.__cdj.advance(240));
      if ((await page.evaluate(() => window.__cdj.phase)) === "finished") break;
    }
    const end = await page.evaluate(() => {
      const r = window.__cdj.race as unknown as { finishMs: number; respawns: number };
      return { finishMs: r.finishMs, respawns: r.respawns };
    });
    expect(end.finishMs).toBe(run.finishMs);
    expect(end.respawns).toBe(0);

    await page.goto("/?debug&scenario=figure&f=n-importe-quoi&quality=0");
    await page.waitForFunction(() => window.__cdj?.phase);
    await expect(page.locator("#meta")).toHaveText("Circuit d'essai");
    expect(errors).toEqual([]);
  });
});

test("admin : « Une figure » propose la liste des figures, la variante et le miroir, et construit l'adresse", async ({ page }) => {
  await page.goto("/admin/");
  await expect(page.locator("#figurerow")).toBeHidden();
  await page.locator('input[name="scenario"][value="figure"]').check();
  await expect(page.locator("#figurerow")).toBeVisible();
  await expect(page.locator("#figure option")).toHaveCount(FIGURES.length + 1);
  await expect(page.locator("#url")).toContainText(`scenario=figure&f=${FIGURES[0]!.name}`);
  await page.locator("#figure").selectOption("slalom-glace");
  await page.locator("#figurevariant").fill("1");
  await page.locator("#figuremirror").check();
  await expect(page.locator("#url")).toContainText("scenario=figure&f=slalom-glace&v=1&m=1");
  await page.locator('input[name="scenario"][value="figures"]').check();
  await expect(page.locator("#figurerow")).toBeHidden();
  await expect(page.locator("#url")).toContainText("scenario=figures");
  await expect(page.locator("#url")).not.toContainText("f=");
});
