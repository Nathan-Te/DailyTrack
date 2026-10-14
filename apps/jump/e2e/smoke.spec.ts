import { expect, test, type Page } from "@playwright/test";

// Test de fumée du lot 0 : `/jump/?debug` se construit, un canvas est à l'écran et il montre autre chose qu'un fond uni.
// Lot 1 : le personnage bouge (pas à pas, commandes injectées puis clavier), le panneau de réglages marque la partie.

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

// ——— Lot 1 : le personnage ———

interface PlayerView {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mode: string;
  ground: boolean;
}
interface JumpPlay {
  phase: string;
  player: PlayerView;
  tuned: boolean;
  ticks: number;
  manual(on: boolean): void;
  advance(n: number): PlayerView;
  input(bits: number | null): void;
  restart(): void;
}
const RIGHT = 2;
const JUMP = 4;

async function openSandbox(page: Page, extra = ""): Promise<void> {
  await page.goto(`/?scenario=bac-a-sable&debug${extra}`);
  test.skip(!(await hasWebGL(page)), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
  await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "ready");
  // Pas à pas : le résultat ne dépend plus du nombre d'images par seconde.
  await page.evaluate(() => (window as unknown as { __jump: JumpPlay }).__jump.manual(true));
}

const advance = (page: Page, bits: number | null, n: number) =>
  page.evaluate(
    ([b, k]) => {
      const j = (window as unknown as { __jump: JumpPlay }).__jump;
      j.input(b);
      return j.advance(k as number);
    },
    [bits, n] as const,
  );

test("le personnage court, saute, quitte le sol et y revient (commandes injectées, pas à pas)", async ({ page }) => {
  await openSandbox(page);
  const start = await page.evaluate(() => (window as unknown as { __jump: JumpPlay }).__jump.player);
  expect(start.ground).toBe(true);
  expect(start.mode).toBe("sol");

  const ran = await advance(page, RIGHT, 60);
  expect(ran.x).toBeGreaterThan(start.x + 3);
  expect(ran.vx).toBeCloseTo(11, 0); // pleine vitesse, en tuiles/s
  expect(ran.ground).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { __jump: JumpPlay }).__jump.phase)).toBe("playing");

  const jumped = await advance(page, RIGHT | JUMP, 1);
  expect(jumped.ground).toBe(false);
  expect(jumped.vy).toBeLessThan(0);
  let top = jumped.y;
  let landed = false;
  for (let i = 0; i < 200 && !landed; i++) {
    const p = await advance(page, RIGHT | JUMP, 1);
    top = Math.min(top, p.y);
    landed = p.ground;
  }
  expect(landed).toBe(true);
  expect(start.y - top).toBeGreaterThan(3.5); // un saut complet : environ 4 tuiles
  // Recommencer : retour au départ.
  const back = await page.evaluate(() => {
    const j = (window as unknown as { __jump: JumpPlay }).__jump;
    j.restart();
    return { player: j.player, phase: j.phase, ticks: j.ticks };
  });
  expect(back.player.x).toBe(start.x);
  expect(back.phase).toBe("ready");
  expect(back.ticks).toBe(0);
});

test("le clavier commande le personnage ; un appui bref entre deux pas n'est pas perdu", async ({ page }) => {
  await openSandbox(page);
  const start = await page.evaluate(() => (window as unknown as { __jump: JumpPlay }).__jump.player);
  await page.keyboard.down("ArrowRight");
  const ran = await advance(page, null, 40);
  await page.keyboard.up("ArrowRight");
  expect(ran.x).toBeGreaterThan(start.x + 1);
  await advance(page, null, 30);
  // Espace appuyée puis relâchée avant le pas suivant : le pas suivant saute quand même.
  await page.keyboard.press("Space");
  const p = await advance(page, null, 1);
  expect(p.ground).toBe(false);
  expect(p.vy).toBeLessThan(0);
  // KeyW (Z en AZERTY) saute aussi, une fois revenu au sol.
  await advance(page, null, 150);
  await page.keyboard.press("KeyW");
  expect((await advance(page, null, 1)).vy).toBeLessThan(0);
});

test("?debug&tune : un curseur par réglage, un réglage modifié marque la partie, « Réinitialiser » l'enlève", async ({ page }) => {
  await openSandbox(page, "&tune");
  await page.evaluate(() => localStorage.removeItem("jump:tune"));
  const sliders = page.locator("#tune input[type=range]");
  await expect(sliders).toHaveCount(18);
  await expect(page.locator("#tuned")).toBeEmpty();
  await expect(page.locator("#debug")).toContainText("vitesse");
  const gravity = page.locator('#tune input[data-key="gravity"]');
  await gravity.evaluate((el: HTMLInputElement) => {
    el.value = "30";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await advance(page, 0, 1);
  await expect(page.locator("#tuned")).toHaveText("réglages modifiés");
  expect(await page.evaluate(() => (window as unknown as { __jump: { tuned: boolean; params: { gravity: number } } }).__jump.params.gravity)).toBe(30);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("jump:tune") ?? "{}").gravity)).toBe(30);
  await page.getByRole("button", { name: "Réinitialiser" }).click();
  expect(await page.evaluate(() => localStorage.getItem("jump:tune"))).toBeNull();
  // La partie en cours reste marquée (elle a été jouée avec un autre réglage) ; recommencer l'efface.
  expect(await page.evaluate(() => (window as unknown as { __jump: JumpPlay }).__jump.tuned)).toBe(true);
  await page.evaluate(() => (window as unknown as { __jump: JumpPlay }).__jump.restart());
  await page.evaluate(() => (window as unknown as { __jump: JumpPlay }).__jump.advance(1));
  await expect(page.locator("#tuned")).toBeEmpty();
});
