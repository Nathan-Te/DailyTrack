import { dailyCircuit, dailyTrackId, formatDay } from "@cdj/sim";
import { msUntilNextParisDay, parisDay } from "@cdj/clock";
import { expect, test, TODAY, newContextAt, FIXED_NOW, type Page } from "./fixtures";

// Lot 31 : pas de circuit à venir en production, jour de Paris. La « production » est simulée par `?prod` (l'adresse ne peut que restreindre) ;
// la vraie construction de production pose `VITE_PRODUCTION=1` (pages.yml, construction de `main` seulement). Rendu 3D : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(120_000);

const trackId = (page: Page) => page.evaluate(() => window.__cdj.trackId);
const ready = (page: Page) => page.waitForFunction(() => window.__cdj?.trackId, undefined, { timeout: 60_000 });
const idOf = (day: number) => dailyTrackId(day, null, 0);

test.describe("production simulée (?prod)", () => {
  test("N et T ne font rien", async ({ page }) => {
    await page.goto("/?prod&debug");
    await ready(page);
    const before = await page.evaluate(() => ({ id: window.__cdj.trackId, url: location.href }));
    expect(before.id).toBe(idOf(TODAY));
    await page.keyboard.press("KeyN");
    await page.keyboard.press("KeyT");
    await page.waitForTimeout(800); // « rien ne doit changer pendant N ms »
    expect(await page.evaluate(() => location.href)).toBe(before.url);
    expect(await trackId(page)).toBe(before.id);
  });

  test("?day= d'un jour à venir : refusé, on tombe sur le circuit du jour avec un message court, et l'adresse est nettoyée", async ({ page }) => {
    await page.goto(`/?prod&debug&day=${formatDay(TODAY + 3)}`);
    await ready(page);
    expect(await trackId(page)).toBe(idOf(TODAY));
    await expect(page.locator("#meta")).toContainText("pas encore disponible");
    expect(await page.evaluate(() => location.search)).not.toContain("day=");
    expect(await page.evaluate(() => location.search)).toContain("prod"); // le reste de l'adresse est gardé
  });

  test("?seed= de demain (le premier jour à venir) est refusé aussi ; celui d'aujourd'hui passe", async ({ page }) => {
    await page.goto(`/?prod&debug&seed=${formatDay(TODAY + 1)}`);
    await ready(page);
    expect(await trackId(page)).toBe(idOf(TODAY));
    await page.goto(`/?prod&debug&seed=${formatDay(TODAY)}`);
    await ready(page);
    expect(await trackId(page)).toBe(idOf(TODAY));
    await expect(page.locator("#meta")).not.toContainText("pas encore disponible");
  });

  test("?day= d'un jour passé : accepté (archives)", async ({ page }) => {
    await page.goto(`/?prod&debug&day=${formatDay(TODAY - 3)}`);
    await ready(page);
    expect(await trackId(page)).toBe(idOf(TODAY - 3));
    await expect(page.locator("#meta")).not.toContainText("pas encore disponible");
  });

  test("?theme= et ?variant= : refusés pour aujourd'hui, acceptés pour un jour passé", async ({ page }) => {
    await page.goto("/?prod&debug&theme=nuit");
    await ready(page);
    expect(await trackId(page)).toBe(idOf(TODAY)); // pas de thème forcé : l'id n'a pas de suffixe
    await expect(page.locator("#meta")).toContainText("réservés aux essais");
    await page.goto("/?prod&debug&variant=2");
    await ready(page);
    expect(await trackId(page)).toBe(idOf(TODAY));
    await page.goto(`/?prod&debug&day=${formatDay(TODAY - 2)}&theme=nuit`);
    await ready(page);
    expect(await trackId(page)).toBe(dailyTrackId(TODAY - 2, "nuit", 0));
  });

  test("les archives n'ont ni dé ni thèmes forcés, et ne listent aucun jour à venir", async ({ page }) => {
    await page.goto("/?prod&debug");
    await ready(page);
    await page.keyboard.press("KeyH");
    await expect(page.locator("#archive .panel .title")).toContainText("Archives");
    await expect(page.locator("#archive .dice")).toHaveCount(0);
    await expect(page.locator("#archive .chips")).toHaveCount(0);
    const dates = await page.locator("#archive a[href*='seed=']").evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href));
    for (const href of dates) expect(new URL(href).searchParams.get("seed")! <= formatDay(TODAY)).toBe(true);
  });
});

test.describe("aperçus et ?debug (pas de production)", () => {
  test("N change de circuit, ?day= d'un jour à venir marche, ?theme= force le thème", async ({ page }) => {
    await page.goto(`/?debug&day=${formatDay(TODAY + 3)}`);
    await ready(page);
    expect(await trackId(page)).toBe(idOf(TODAY + 3));
    await page.goto("/?debug&theme=nuit");
    await ready(page);
    expect(await trackId(page)).toBe(dailyTrackId(TODAY, "nuit", 0));
    await page.goto("/?debug&seed=" + formatDay(TODAY));
    await ready(page);
    await page.keyboard.press("KeyN");
    await page.waitForURL(/seed=/, { timeout: 15_000 });
    await page.waitForFunction((id) => window.__cdj?.trackId && window.__cdj.trackId !== id, idOf(TODAY), { timeout: 60_000 });
  });

  test("?prod ne se lève pas par ?debug", async ({ page }) => {
    await page.goto(`/?debug&prod&day=${formatDay(TODAY + 1)}`);
    await ready(page);
    expect(await trackId(page)).toBe(idOf(TODAY));
  });
});

test.describe("jour de Paris", () => {
  const INSTANT = Date.UTC(2026, 9, 20, 21, 40); // 21 h 40 UTC le 20/10 : 23 h 40 à Paris, 3 h 10 le 21 à Delhi, 17 h 40 le 20 à New York

  test("un joueur à Delhi et un à New York voient le même circuit au même instant : celui de la date de Paris", async ({ browser }) => {
    const delhi = await newContextAt(browser, INSTANT, { timezoneId: "Asia/Kolkata" });
    const newYork = await newContextAt(browser, INSTANT, { timezoneId: "America/New_York" });
    try {
      const [a, b] = await Promise.all([delhi.newPage(), newYork.newPage()]);
      await Promise.all([a.goto("/?debug"), b.goto("/?debug")]);
      await Promise.all([ready(a), ready(b)]);
      const expected = idOf(parisDay(INSTANT));
      expect(parisDay(INSTANT)).toBe(TODAY); // le 20/10
      expect(await trackId(a)).toBe(expected);
      expect(await trackId(b)).toBe(expected);
      // Le jour local de Delhi est déjà le 21 : ce n'est pas lui qui compte.
      expect(await a.evaluate(() => new Date().getDate())).toBe(21);
      expect(await b.evaluate(() => new Date().getDate())).toBe(20);
    } finally {
      await delhi.close();
      await newYork.close();
    }
  });

  test("l'accueil compte jusqu'à minuit de Paris, puis se recharge sur le nouveau circuit", async ({ browser }) => {
    const start = Date.UTC(2026, 9, 20, 21, 59, 52); // 23 h 59 min 52 s à Paris : 8 s avant le jour suivant
    const ctx = await newContextAt(browser, start);
    try {
      const page = await ctx.newPage();
      await page.goto("/");
      await page.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
      const line = page.locator("#home-nextday");
      await expect(line).toBeVisible();
      await expect(line).toContainText(/Prochain circuit dans 00:00:0\d/);
      const next = dailyCircuit(TODAY + 1);
      // À zéro l'accueil se recharge sur le nouveau circuit (n° suivant).
      await expect(page.locator("#home .today h2")).toContainText(`n° ${next.number}`, { timeout: 40_000 });
    } finally {
      await ctx.close();
    }
  });

  test("le décompte de l'accueil donne le temps jusqu'à minuit de Paris (heure d'été : 22 h UTC)", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
    const pageNow = await page.evaluate(() => Date.now()); // l'horloge de la page (décalée) continue d'avancer pendant tous les tests : on la lit
    const text = (await page.locator("#home-nextday").textContent()) ?? "";
    const m = /(\d\d):(\d\d):(\d\d)/.exec(text);
    expect(m).not.toBeNull();
    const shown = (Number(m![1]) * 3600 + Number(m![2]) * 60 + Number(m![3])) * 1000;
    expect(Math.abs(shown - msUntilNextParisDay(pageNow))).toBeLessThan(10_000); // quelques secondes de lenteur de la CI
    // Heure d'été : minuit de Paris = 22 h UTC ; l'horloge de test part de midi UTC (la page peut avoir avancé de plusieurs minutes depuis).
    expect(msUntilNextParisDay(FIXED_NOW)).toBe(Date.UTC(2026, 9, 20, 22) - FIXED_NOW);
    expect(Date.UTC(2026, 9, 20, 22) - FIXED_NOW).toBe(10 * 3_600_000);
  });
});
