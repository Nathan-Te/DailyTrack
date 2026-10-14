import { expect, test, type Page } from "@playwright/test";

// Test de fumée du lot 0 : `/jump/?debug` se construit, un canvas est à l'écran et il montre autre chose qu'un fond uni.

interface JumpDebugView {
  phase: string;
  day: string;
  simVersion: number;
  palette: string;
  probe(): { width: number; height: number; colors: number; background: number };
}
const jump = (page: Page) => page.evaluate(() => {
  const j = (window as unknown as { __jump: JumpDebugView }).__jump;
  return { phase: j.phase, day: j.day, simVersion: j.simVersion, palette: j.palette };
});

const hasWebGL = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  });

test("DailyJump s'ouvre : scène construite, canvas rendu, version et jour en coin", async ({ page }) => {
  await page.goto("/?debug");
  test.skip(!(await hasWebGL(page)), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");

  await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "ready");
  const info = await jump(page);
  expect(info.phase).toBe("ready");
  expect(info.simVersion).toBe(1);
  expect(info.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);
  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(100);
  expect(box!.height).toBeGreaterThan(100);

  // Le coin affiche la version de la simulation et le jour du jeu.
  await expect(page.locator("#stamp")).toHaveText(`DailyJump · sim v1 · ${info.day}`);

  // Les pixels : le fond uni, les tuiles, le personnage et l'arrivée font au moins quatre couleurs, et le fond ne couvre pas tout.
  const pixels = await page.evaluate(() => (window as unknown as { __jump: JumpDebugView }).__jump.probe());
  expect(pixels.colors).toBeGreaterThanOrEqual(4);
  expect(pixels.background).toBeGreaterThan(0.2);
  expect(pixels.background).toBeLessThan(0.98);
});

test("sans ?debug, aucun accès de débogage n'est exposé", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#stamp")).toContainText("DailyJump · sim v1");
  expect(await page.evaluate(() => "__jump" in window)).toBe(false);
});
