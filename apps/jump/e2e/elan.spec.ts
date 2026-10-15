import { expect, test, type Page } from "@playwright/test";
import { FIXED_NOW, atInstant } from "./clock";
import { hasWebGL, withPhone } from "./phone";

// Lot 8c : l'élan adopté. Le niveau du jour se regarde jusqu'au bout au temps de l'auteur et l'élan y sert (la vitesse dépasse la course,
// au moins un morceau « elan ») ; un morceau « elan » se regarde jusqu'au bout au temps de sa solution, entré en élan plein ; la galerie
// filtre l'étiquette « elan ». Toujours en pas à pas dès qu'un résultat dépend du nombre de pas.

interface Jump {
  phase: string;
  player: { vx: number };
  params: { runSpeed: number; sprintSpeed: number };
  module: { id: string; entry: string; reference: number | null } | null;
  daily: { authorTicks: number; pieces: { id: string; tags: string[]; entry: string }[] } | null;
  attempt: { status: string; time: number; deaths: number };
  gallery: { modules: number; shown: number; filter: { tag: string | null } };
  manual(on: boolean): void;
  advance(n: number): unknown;
  restart(): void;
}
const SKIP = "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire";
const RUN = (375 * 120) / 4096; // tuiles/s

async function openWatch(page: Page, url: string): Promise<boolean> {
  await page.goto(url);
  if (!(await hasWebGL(page))) return false;
  await page.waitForFunction(() => ["ready", "playing", "finished"].includes((window as unknown as { __jump?: { phase: string } }).__jump?.phase ?? ""));
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: Jump }).__jump;
    j.manual(true);
    j.restart();
  });
  return true;
}

/** Avance jusqu'à `finished` (au plus `n` pas) ; rend les pas joués et la plus grande vitesse vue (tuiles/s). */
const watch = (page: Page, n: number) =>
  page.evaluate((limit) => {
    const j = (window as unknown as { __jump: Jump }).__jump;
    let top = 0;
    for (let t = 1; t <= limit; t++) {
      j.advance(1);
      top = Math.max(top, Math.abs(j.player.vx));
      if (j.phase === "finished") return { ticks: t, top };
    }
    return { ticks: limit, top };
  }, n);

test("?seed=…&solution finit au temps de l'auteur ; l'élan y sert (au-delà de la course) et le niveau a son morceau « elan »", async ({ browser }) => {
  await atInstant(browser, FIXED_NOW, async (page) => {
    test.skip(!(await openWatch(page, "/?seed=2026-11-05&solution&debug")), SKIP);
    const d = (await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.daily))!;
    expect(d.pieces.some((p) => p.tags.includes("elan"))).toBe(true);
    expect(d.pieces[0]!.entry).toBe("arret");
    for (const p of d.pieces.slice(1)) expect(["course", "plein"]).toContain(p.entry);
    const r = await watch(page, d.authorTicks + 10);
    expect(r.ticks).toBe(d.authorTicks);
    expect(r.top).toBeGreaterThan(RUN + 1);
    const end = await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.attempt);
    expect(end).toMatchObject({ status: "arrivé", time: d.authorTicks, deaths: 0 });
  });
});

test("?module=grand-saut&entree=plein&solution (morceau « elan ») finit en pas à pas au temps de la solution stockée, en élan plein", async ({ page }) => {
  test.skip(!(await openWatch(page, "/?module=grand-saut&variante=0&entree=plein&solution&debug")), SKIP);
  const start = (await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.module))!;
  expect(start).toMatchObject({ id: "grand-saut", entry: "plein" });
  const r = await watch(page, 3000);
  expect(r.ticks).toBe(start.reference);
  expect(r.top).toBeCloseTo((614 * 120) / 4096, 6);
  const end = await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.attempt);
  expect(end).toMatchObject({ status: "arrivé", time: start.reference, deaths: 0 });
});

test("?modules au téléphone : l'étiquette « élan » filtre les morceaux élan ; cibles d'au moins 44 px", async ({ browser }) => {
  await withPhone(browser, { width: 390, height: 844 }, async (page) => {
    await page.goto("/?modules&debug");
    await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "gallery");
    const all = await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.gallery);
    await page.locator("#gallery select[name=etiquette]").selectOption("elan");
    const g = await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.gallery);
    expect(g.filter.tag).toBe("elan");
    expect(g.shown).toBeGreaterThanOrEqual(4);
    expect(g.shown).toBeLessThan(all.modules);
    await expect(page.locator("#gallery .card:not([hidden])")).toHaveCount(g.shown);
    for (const card of await page.locator("#gallery .card:not([hidden])").all()) await expect(card.locator(".tag", { hasText: /^élan$/ })).toHaveCount(1);
    await expect(page.locator('#gallery .card[data-id="grand-saut"]')).toBeVisible();
    // Les trois entrées : à l'arrêt, à la course, en élan plein.
    await expect(page.locator("#gallery .entry button")).toHaveText(["À l'arrêt", "À la course", "En élan plein"]);
    for (const el of await page.locator("#gallery .entry button, #gallery .card:not([hidden]) a.btn").all()) {
      const b = (await el.boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.x + b.width).toBeLessThanOrEqual(390.5);
    }
  });
});
