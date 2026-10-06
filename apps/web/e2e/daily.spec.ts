import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Circuits du jour de référence calculés par Node (packages/sim/test/golden-daily.test.ts).
const golden = JSON.parse(readFileSync(new URL("../../../packages/sim/test/fixtures/daily-golden.json", import.meta.url), "utf8")) as {
  circuits: { date: string; number: number; attempt: number; spec: string; authorMs: number; palette: string }[];
};

test("le navigateur régénère les circuits du jour de référence : même texte, même temps d'auteur, même palette", async ({ page }) => {
  await page.goto("/verify.html");
  await page.waitForSelector("html[data-ready=true]");
  for (const expected of golden.circuits) {
    const got = await page.evaluate((date) => window.__daily(date), expected.date);
    const { date, ...rest } = expected;
    expect(got, date).toEqual(rest);
  }
});

test("une date impossible est refusée", async ({ page }) => {
  await page.goto("/verify.html");
  await page.waitForSelector("html[data-ready=true]");
  const error = await page.evaluate(() => {
    try {
      window.__daily("2026-02-30");
      return null;
    } catch (e) {
      return String(e);
    }
  });
  expect(error).toContain("Date invalide");
});

// Le rendu 3D demande WebGL : Chromium seulement (la génération, elle, est vérifiée partout ci-dessus).
test.describe("jeu (rendu 3D)", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");

  for (const date of ["2026-10-06", "2026-10-07", "2026-10-08"]) {
    test(`?seed=${date} : le circuit se charge, se joue, et affiche son titre et ses médailles`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

      await page.goto(`/?debug&seed=${date}`);
      await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 20_000 });
      const expected = golden.circuits.find((c) => c.date === date)!;
      await expect(page.locator("#meta")).toContainText(`#${expected.number}`);
      await expect(page.locator("#meta")).toContainText(date);
      await expect(page.locator("#medals")).toContainText("🥇");

      const z0 = await page.evaluate(() => window.__cdj.car.z);
      await page.keyboard.down("KeyW");
      await page.waitForTimeout(2500);
      const z1 = await page.evaluate(() => window.__cdj.car.z);
      expect(z1).toBeGreaterThan(z0 + 5); // la voiture roule
      expect(errors).toEqual([]);
    });
  }

  test("trois dates donnent trois circuits différents", async ({ page }) => {
    const ids = new Set<string>();
    for (const date of ["2026-10-06", "2026-10-07", "2026-10-08"]) {
      await page.goto(`/?debug&seed=${date}`);
      await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 20_000 });
      ids.add(await page.evaluate(() => (window.__cdj.race as { track: { id: string } }).track.id));
    }
    expect(ids.size).toBe(3);
  });

  test("une date invalide retombe sur le circuit d'aujourd'hui, en le disant", async ({ page }) => {
    await page.goto("/?debug&seed=pas-une-date");
    await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 20_000 });
    await expect(page.locator("#meta")).toContainText("date invalide");
  });

  test("le circuit d'essai reste accessible avec ?scenario=essai", async ({ page }) => {
    await page.goto("/?debug&scenario=essai");
    await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 20_000 });
    await expect(page.locator("#meta")).toHaveText("Circuit d'essai");
    expect((await page.evaluate(() => (window.__cdj.race as { track: { id: string } }).track.id))).toBe("essai");
  });
});
