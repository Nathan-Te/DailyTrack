import type { Route } from "@playwright/test";
import { expect, test, type Page } from "./fixtures";

// Lot 44 : le décor du palier 1, **chargé à la demande, thème par thème** (`src/scene/decor.ts`). La scène s'affiche d'abord avec la piste, les rebords et les
// éléments de course ; le décor arrive pendant l'accueil, avant le départ. S'il n'est pas prêt au décompte, la course part sans lui, et il s'ajoute à la
// prochaine pause ou à l'arrivée, **jamais en course** (ni pendant le décompte).
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");

/** Les morceaux du décor chargés par la page. */
const morceauxDecor = (page: Page) => page.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name.split("/").pop()!).filter((n) => /^(commun|stade|rallye|banquise|nuit|campagne|canyon|col|ville)-[^/]*\.js$/.test(n)));
const decor = (page: Page) => page.evaluate(() => window.__cdj.decor);

test("le décor du thème arrive pendant l'accueil : un morceau à lui et le morceau commun, rien de plus ; la scène le porte avant « Courir »", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/?home=1&debug&api=demo&ghost=off&fx=off");
  await page.waitForFunction(() => window.__cdj?.phase);
  await expect(page.locator("#home")).toBeVisible();
  await page.waitForFunction(() => window.__cdj.decor.dansScene, undefined, { timeout: 30_000 });
  const d = await decor(page);
  expect(["construction", "accueil"]).toContain(d.posePhase);
  expect(d.poseEnCourse).toBe(0);
  await expect(page.locator("#home"), "toujours à l'accueil : le décor n'a pas attendu le départ").toBeVisible();
  // Le décor d'un seul thème : son morceau et le commun.
  const charges = await morceauxDecor(page);
  expect(charges.some((n) => n.startsWith("commun-"))).toBe(true);
  expect(charges.filter((n) => !n.startsWith("commun-")), "un seul thème chargé").toHaveLength(1);
  expect(await page.evaluate(() => window.__cdj.render.decor)).toBe(true);
});

test("pas prêt au décompte : la course part sans lui, il n'arrive pas en course ; il s'ajoute à la pause", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  // Le morceau commun du décor est retenu jusqu'à ce qu'on le libère : il « arrive » en pleine course.
  let liberer: () => void = () => undefined;
  const retenu = new Promise<void>((r) => (liberer = r));
  await page.route(/\/assets\/commun-[^/]*\.js$/, async (route: Route) => {
    await retenu;
    await route.continue();
  });
  await page.goto("/?debug&seed=2026-10-16&ghost=off&fx=off&home=0");
  await page.waitForFunction(() => window.__cdj?.phase === "countdown" || window.__cdj?.phase === "racing");
  expect((await decor(page)).dansScene, "la scène s'affiche sans le décor").toBe(false);
  expect(await page.evaluate(() => window.__cdj.render.decor)).toBe(false);
  // La course part (pas à pas : rien ne dépend du temps réel).
  await page.evaluate(() => window.__cdj.manual(true));
  for (let i = 0; i < 40 && (await page.evaluate(() => window.__cdj.phase)) !== "racing"; i++) await page.evaluate(() => window.__cdj.advance(60));
  expect(await page.evaluate(() => window.__cdj.phase)).toBe("racing");
  // Le décor arrive en pleine course : il est prêt, mais pas posé.
  liberer();
  await page.waitForFunction(() => window.__cdj.decor.pret, undefined, { timeout: 30_000 });
  for (let i = 0; i < 6; i++) await page.evaluate(() => window.__cdj.advance(30));
  await page.waitForTimeout(500); // « rien ne doit changer pendant N ms » : des images passent, la scène reste sans décor
  let d = await decor(page);
  expect(await page.evaluate(() => window.__cdj.phase)).toBe("racing");
  expect(d.dansScene, "jamais en course").toBe(false);
  expect(d.poseMs).toBeNull();
  // La pause : il s'ajoute (une fois), la course reprend avec lui.
  await page.keyboard.press("KeyP");
  await page.waitForFunction(() => window.__cdj.decor.dansScene);
  d = await decor(page);
  expect(d.posePhase).toBe("pause");
  expect(d.poseEnCourse).toBe(0);
  await page.keyboard.press("KeyP");
  await page.evaluate(() => window.__cdj.advance(60));
  expect(await page.evaluate(() => window.__cdj.render.decor)).toBe(true);
});
