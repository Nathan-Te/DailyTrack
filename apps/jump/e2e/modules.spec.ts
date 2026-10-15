import { expect, test, type Page } from "@playwright/test";
import { Fingers, hasWebGL, withPhone } from "./phone";

// Lot 4 : la galerie des morceaux (`?modules`), un morceau joué (`?module=`), sa solution regardée (`&solution`), au doigt en paysage.
// Toujours en pas à pas (`manual` + `advance`) dès qu'un résultat dépend du nombre de pas.

interface ModuleDebug {
  phase: string;
  module: { id: string; variant: number; entry: string; solution: boolean; levelId: string; reference: number | null; next: string } | null;
  attempt: { status: string; time: number; deaths: number };
  touch: { bits: number };
  manual(on: boolean): void;
  advance(n: number): unknown;
}
const debug = (page: Page) => page.evaluate(() => {
  const j = (window as unknown as { __jump: ModuleDebug }).__jump;
  return { phase: j.phase, module: j.module, attempt: j.attempt };
});
const step = (page: Page, n = 1) => page.evaluate((k) => (window as unknown as { __jump: ModuleDebug }).__jump.advance(k), n);

/**
 * Ouvre une adresse du jeu en `?debug`, passe en pas à pas et repart du départ (une lecture de solution démarre d'elle-même : on la
 * relance, comme la touche R) ; faux sans WebGL.
 */
async function open(page: Page, search: string): Promise<boolean> {
  await page.goto(`/${search}`);
  if (!(await hasWebGL(page))) return false;
  await page.waitForFunction(() => ["ready", "playing", "finished"].includes((window as unknown as { __jump?: { phase: string } }).__jump?.phase ?? ""));
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: ModuleDebug & { restart(): void } }).__jump;
    j.manual(true);
    j.restart();
  });
  await page.waitForFunction(() => (window as unknown as { __jump: ModuleDebug }).__jump.phase === "ready");
  return true;
}

/** Avance jusqu'à ce que la phase soit l'une de `phases` (au plus `max` pas) ; rend le nombre de pas joués. */
async function until(page: Page, phases: string[], max = 1200): Promise<number> {
  return page.evaluate(
    ([want, limit]) => {
      const j = (window as unknown as { __jump: ModuleDebug }).__jump;
      for (let t = 1; t <= (limit as number); t++) {
        j.advance(1);
        if ((want as string[]).includes(j.phase)) return t;
      }
      return -1;
    },
    [phases, max] as const,
  );
}

for (const format of [
  { name: "portrait", viewport: { width: 390, height: 844 } },
  { name: "paysage", viewport: { width: 844, height: 390 } },
]) {
  test(`?modules (${format.name}) : la galerie liste les morceaux et leurs variantes, cibles d'au moins 44 px, sans débordement`, async ({ browser }) => {
    await withPhone(browser, format.viewport, async (page) => {
      await page.goto("/?modules&debug");
      await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "gallery");
      const info = await page.evaluate(() => (window as unknown as { __jump: { gallery: { modules: number; variants: number } } }).__jump.gallery);
      expect(info.modules).toBeGreaterThanOrEqual(50); // lot 7 : au moins 50 morceaux
      await expect(page.locator("#gallery .card")).toHaveCount(info.modules);
      await expect(page.locator("#gallery .variant")).toHaveCount(info.variants);
      await expect(page.locator("#gallery a.play")).toHaveCount(info.variants);
      await expect(page.locator("#gallery a.watch")).toHaveCount(info.variants);
      // Chaque carte : intention, étiquettes, exigence et durées par variante.
      const first = page.locator("#gallery .card").first();
      await expect(first.locator(".intent")).not.toBeEmpty();
      await expect(first.locator(".tag").first()).toBeVisible();
      await expect(first.locator(".ex").first()).toContainText("/5");
      await expect(first.locator(".dur").first()).toContainText("élan");
      // Cibles d'au moins 44 px (toutes, même hors de l'écran : la page défile), aucune page plus large que l'écran.
      for (const el of await page.locator("#gallery a.btn, #gallery .entry button").all()) {
        const b = (await el.boundingBox())!;
        expect(b.width, "largeur").toBeGreaterThanOrEqual(44);
        expect(b.height, "hauteur").toBeGreaterThanOrEqual(44);
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.width).toBeLessThanOrEqual(format.viewport.width + 0.5);
      }
      const overflow = await page.evaluate(() => {
        const g = document.getElementById("gallery")!;
        return { scroll: g.scrollWidth, client: g.clientWidth, tall: g.scrollHeight > g.clientHeight };
      });
      expect(overflow.scroll).toBeLessThanOrEqual(overflow.client);
      expect(overflow.tall).toBe(true); // elle défile
      // L'entrée change les liens.
      await expect(page.locator("#gallery a.play").first()).not.toHaveAttribute("href", /entree=elan/);
      await page.locator("#gallery .entry button", { hasText: "En élan" }).tap();
      await expect(page.locator("#gallery a.play").first()).toHaveAttribute("href", /entree=elan/);
      await expect(page.locator("#gallery a.watch").first()).toHaveAttribute("href", /entree=elan&solution/);
      // « Jouer » ouvre le morceau.
      const id = await page.locator("#gallery .card").first().getAttribute("data-id");
      await page.locator("#gallery a.play").first().tap();
      await page.waitForURL(new RegExp(`module=${id}`));
      test.skip(!(await hasWebGL(page)), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
      await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "ready");
      const d = await debug(page);
      expect(d.module).toMatchObject({ id, variant: 0, entry: "elan", solution: false });
    });
  });
}

test("?module=<id>&solution finit en pas à pas : le temps est celui de la solution stockée, le bandeau propose le morceau suivant", async ({ page }) => {
  test.skip(!(await open(page, "?module=cheminee&variante=1&entree=elan&solution&debug")), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
  const start = await debug(page);
  expect(start.module).toMatchObject({ id: "cheminee", variant: 1, entry: "elan", solution: true, levelId: "module:cheminee:1" });
  expect(start.module!.reference).toBeGreaterThan(240);
  const ticks = await until(page, ["finished"]);
  expect(ticks).toBe(start.module!.reference);
  const end = await debug(page);
  expect(end.attempt.status).toBe("arrivé");
  expect(end.attempt.time).toBe(start.module!.reference);
  expect(end.attempt.deaths).toBe(0);
  await expect(page.locator("#finish")).toBeVisible();
  await expect(page.locator("#finish .title")).toHaveText("Solution");
  await expect(page.locator("#finish .ref")).toContainText("Solution : ");
  const next = page.locator("#finish-next");
  await expect(next).toBeVisible();
  await expect(next).toHaveAttribute("href", /module=[a-z-]+&variante=0&entree=elan&debug/);
  await expect(page.locator("#modname")).toContainText("cheminee");
});

test.describe("au doigt (téléphone en paysage)", () => {
  const VIEW = { width: 844, height: 390 };
  const at = { right: [VIEW.width * 0.37, VIEW.height * 0.75], jump: [VIEW.width * 0.75, VIEW.height * 0.75] } as const;

  test("?module=pont-friable se joue au doigt : courir jusqu'au bout, passer le carnage, lire le bandeau, recommencer", async ({ browser }) => {
    test.setTimeout(120_000);
    await withPhone(browser, VIEW, async (page) => {
      test.skip(!(await open(page, "?module=pont-friable&variante=1&touch=1&debug")), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
      const fingers = await Fingers.on(page);
      await fingers.down(1, ...at.right);
      await page.waitForFunction(() => (window as unknown as { __jump: ModuleDebug }).__jump.touch.bits === 2);
      expect(await until(page, ["carnage", "finished"])).toBeGreaterThan(0);
      await fingers.up(1);
      const done = await debug(page);
      expect(done.attempt.status).toBe("arrivé");
      expect(done.attempt.deaths).toBe(0);
      // Le carnage (ton essai rejoué) démarre ; un doigt le passe.
      if (done.phase === "carnage") {
        await fingers.down(2, ...at.jump);
        await step(page, 1);
        await fingers.up(2);
      }
      expect((await debug(page)).phase).toBe("finished");
      await expect(page.locator("#finish")).toBeVisible();
      await expect(page.locator("#finish .ref")).toContainText("Solution : ");
      for (const sel of ["#finish button", "#finish-next"]) {
        const b = (await page.locator(sel).boundingBox())!;
        expect(b.height, sel).toBeGreaterThanOrEqual(44);
        expect(b.width, sel).toBeGreaterThanOrEqual(44);
      }
      await page.locator("#finish button").tap();
      await page.waitForFunction(() => (window as unknown as { __jump: ModuleDebug }).__jump.phase === "ready");
      await expect(page.locator("#finish")).toBeHidden();
    });
  });
});
