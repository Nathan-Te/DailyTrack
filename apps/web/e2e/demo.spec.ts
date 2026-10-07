import { expect, test } from "@playwright/test";
import { PREMIER_JOUR, formatDay } from "@cdj/sim";

// Quatorze jours d'historique (`DEMO_DAYS` de src/demo.ts ; le test Vitest vérifie que le jeu de données en contient autant).
const DEMO_DAYS = 14;

// Mode démo `?api=demo` (lot 11) : archives complètes, sans API ni serveur, en lecture seule. Rendu 3D : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(120_000);

const ready = (page: import("@playwright/test").Page) => page.waitForFunction(() => window.__cdj?.phase, undefined, { timeout: 30_000 });

test("les archives listent quatorze jours d'historique, avec seuils de médailles et nombre de pilotes", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/?api=demo&debug");
  await ready(page);
  await expect(page.locator("#meta")).toContainText("mode démo");
  await page.keyboard.press("KeyH");
  const days = page.locator("#archive .day");
  await expect(days).toHaveCount(DEMO_DAYS + 1); // « aujourd'hui » de la démo + les quatorze jours passés
  await expect(days.nth(0)).toContainText("aujourd'hui");
  await expect(days.nth(1)).toContainText(formatDay(PREMIER_JOUR + DEMO_DAYS - 1));
  await expect(days.nth(DEMO_DAYS)).toContainText("#1");
  await expect(days.nth(DEMO_DAYS)).toContainText(formatDay(PREMIER_JOUR));
  // Les détails (jeu de données de démo) arrivent juste après la liste : seuils de médailles et pilotes pour les 14 jours.
  await expect(page.locator("#archive .day .sub")).toHaveCount(DEMO_DAYS);
  await expect(page.locator("#archive .day .sub").first()).toContainText("pilotes");
  await expect(page.locator("#archive .day .sub").first()).toContainText("🥇");
  expect(errors).toEqual([]);
});

test("ouvrir un jour : son classement figé est affiché et le fantôme du premier est chargé", async ({ page }) => {
  await page.goto("/?api=demo&debug");
  await ready(page);
  await page.keyboard.press("KeyH");
  await page.locator("#archive .day", { hasText: "2026-09-30" }).click();
  await page.waitForURL(/seed=2026-09-30/);
  expect(new URL(page.url()).searchParams.get("api")).toBe("demo"); // le mode démo suit
  await ready(page);
  await expect(page.locator("#meta")).toContainText("2026-09-30");
  await expect(page.locator("#ghostinfo")).toContainText("premier : Démo", { timeout: 20_000 });
  await expect(page.locator("#board")).toBeVisible();
  await expect(page.locator("#board .title")).toContainText("Classement figé · 2026-09-30");
  expect(await page.locator("#board .row").count()).toBeGreaterThanOrEqual(8);
  await expect(page.locator("#board .row .who").first()).toContainText("Démo");
  // le fantôme roule : il a avancé pendant que le joueur ne touche à rien
  await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 20_000 });
  await page.waitForFunction(() => (window.__cdj.ghost?.tick ?? 0) > 60, undefined, { timeout: 20_000 });
});

test("accès direct par ?day= : même jour, même classement figé", async ({ page }) => {
  await page.goto("/?api=demo&day=2026-09-30&debug");
  await ready(page);
  await expect(page.locator("#meta")).toContainText("2026-09-30");
  await expect(page.locator("#ghostinfo")).toContainText("premier : Démo", { timeout: 20_000 });
  await expect(page.locator("#board .title")).toContainText("Classement figé");
});

test("ton meilleur temps est placé dans la liste des archives (rang figé parmi les pilotes de démo)", async ({ page }) => {
  await page.goto("/?api=demo&debug");
  await ready(page);
  // Un record local pour le 30/09 : 1 s, devant tous les pilotes de démonstration.
  await page.evaluate(async () => {
    const index = await fetch("demo/index.json").then((r) => r.json());
    localStorage.setItem(`cdj:best:jour-2026-09-30-g${index.generatorVersion}`, JSON.stringify({ ms: 1000, splits: [], medal: "author", simVersion: index.simVersion }));
  });
  await page.reload();
  await ready(page);
  await page.keyboard.press("KeyH");
  await expect(page.locator("#archive .day", { hasText: "2026-09-30" }).locator(".best")).toContainText("1ᵉʳ/", { timeout: 10_000 });
});

test("sans le mode démo, le jeu marche comme avant : pas de classement, pas de bandeau", async ({ page }) => {
  await page.goto("/?debug");
  await ready(page);
  await expect(page.locator("#meta")).not.toContainText("mode démo");
  await expect(page.locator("#btn-board")).toBeHidden();
});
