import { expect, test, type Page } from "@playwright/test";
import { FIXED_NOW, atInstant } from "./clock";
import { hasWebGL, withPhone } from "./phone";

// Lot 7 : la variété. La galerie filtre par étiquette et par famille (au téléphone) ; un nouveau morceau (enchaînement long) se regarde
// jusqu'au bout au temps de sa solution ; un niveau du jour `g3` se regarde jusqu'au bout au temps de l'auteur, et la surimpression `?debug`
// nomme le bon morceau à chaque raccord. Toujours en pas à pas dès qu'un résultat dépend du nombre de pas.

interface Gallery {
  modules: number;
  shown: number;
  filter: { tag: string | null; family: string | null };
}
interface Jump {
  phase: string;
  module: { id: string; reference: number | null } | null;
  daily: { authorTicks: number; pieces: { id: string; variant: number; family: string; long: boolean; start: number; end: number }[] } | null;
  attempt: { status: string; time: number; deaths: number };
  manual(on: boolean): void;
  advance(n: number): unknown;
  restart(): void;
}
const SKIP = "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire";
const gallery = (page: Page) => page.evaluate(() => (window as unknown as { __jump: { gallery: Gallery } }).__jump.gallery);

/** Ouvre une lecture (`&solution`) en `?debug`, pas à pas, relancée au départ ; faux sans WebGL. */
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

/** Avance de `n` pas (ou jusqu'à `finished`) ; rend les pas joués. */
const advance = (page: Page, n: number) =>
  page.evaluate((limit) => {
    const j = (window as unknown as { __jump: Jump }).__jump;
    for (let t = 1; t <= limit; t++) {
      j.advance(1);
      if (j.phase === "finished") return t;
    }
    return limit;
  }, n);

test("?modules au téléphone : les listes « Étiquette » et « Famille » filtrent les cartes ; mutateurs affichés ; cibles d'au moins 44 px", async ({ browser }) => {
  await withPhone(browser, { width: 390, height: 844 }, async (page) => {
    await page.goto("/?modules&debug");
    await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "gallery");
    const all = await gallery(page);
    expect(all.modules).toBeGreaterThanOrEqual(50);
    expect(all.shown).toBe(all.modules);
    await expect(page.locator("#gallery .count")).toHaveText(`${all.modules} morceaux`);
    for (const sel of ["select[name=etiquette]", "select[name=famille]"]) {
      const b = (await page.locator(`#gallery ${sel}`).boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.x + b.width).toBeLessThanOrEqual(390.5);
    }
    // Les mutateurs de chaque variante.
    await expect(page.locator("#gallery .variant .mut", { hasText: "mutateurs" }).first()).toBeVisible();
    // Étiquette « ressort » : seules les cartes qui la portent restent.
    await page.locator("#gallery select[name=etiquette]").selectOption("ressort");
    const tagged = await gallery(page);
    expect(tagged.filter.tag).toBe("ressort");
    expect(tagged.shown).toBeGreaterThan(3);
    expect(tagged.shown).toBeLessThan(all.modules);
    await expect(page.locator("#gallery .card:not([hidden])")).toHaveCount(tagged.shown);
    for (const card of await page.locator("#gallery .card:not([hidden])").all()) await expect(card.locator(".tag", { hasText: /^ressort$/ })).toHaveCount(1);
    // Puis la famille « cheminee » (étiquette remise à « toutes ») : cheminée, cheminée à scie, à pics…
    await page.locator("#gallery select[name=etiquette]").selectOption("");
    await page.locator("#gallery select[name=famille]").selectOption("cheminee");
    const fam = await gallery(page);
    expect(fam.shown).toBeGreaterThanOrEqual(3);
    await expect(page.locator("#gallery .card:not([hidden])")).toHaveCount(fam.shown);
    const ids = await page.locator("#gallery .card:not([hidden])").evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.family));
    expect(new Set(ids)).toEqual(new Set(["cheminee"]));
    await expect(page.locator("#gallery .count")).toHaveText(`${fam.shown} morceaux sur ${all.modules}`);
    // Les cibles des cartes affichées gardent 44 px, rien ne déborde.
    for (const el of await page.locator("#gallery .card:not([hidden]) a.btn").all()) {
      const b = (await el.boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(44);
      expect(b.x + b.width).toBeLessThanOrEqual(390.5);
    }
  });
});

test("?module=cheminee-quinconce&solution (enchaînement long) finit en pas à pas au temps de la solution stockée, sans mort", async ({ page }) => {
  test.skip(!(await openWatch(page, "/?module=cheminee-quinconce&variante=0&solution&debug")), SKIP);
  const start = await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.module);
  expect(start).toMatchObject({ id: "cheminee-quinconce" });
  expect(start!.reference).toBeGreaterThan(600);
  expect(await advance(page, 2000)).toBe(start!.reference);
  const end = await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.attempt);
  expect(end).toMatchObject({ status: "arrivé", time: start!.reference, deaths: 0 });
});

test("?seed=…&solution (g5) finit au temps de l'auteur ; la surimpression ?debug nomme le morceau en cours, à partir de sa première colonne", async ({ browser }) => {
  await atInstant(browser, FIXED_NOW, async (page) => {
    test.skip(!(await openWatch(page, "/?seed=2026-11-03&solution&debug")), SKIP);
    const d = (await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.daily))!;
    // Lot 7 : une seule famille de chaque, au moins un enchaînement long.
    expect(new Set(d.pieces.map((p) => p.family)).size).toBe(d.pieces.length);
    expect(d.pieces.some((p) => p.long)).toBe(true);
    let played = 0;
    for (let k = 0; k < d.pieces.length; k++) {
      const p = d.pieces[k]!;
      // Le pas où le morceau k commence : la surimpression le nomme déjà (le pas d'avant, encore le précédent).
      if (k > 0) {
        played += await advance(page, p.start - 1 - played);
        await expect(page.locator("#debug")).toContainText(`morceau   ${k}/${d.pieces.length} ${d.pieces[k - 1]!.id} v`);
      }
      played += await advance(page, p.start + 1 - played);
      await expect(page.locator("#debug")).toContainText(`morceau   ${k + 1}/${d.pieces.length} ${p.id} v${p.variant}`);
    }
    played += await advance(page, d.authorTicks - played);
    expect(played).toBe(d.authorTicks);
    const end = await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump);
    expect(end.phase).toBe("finished");
    expect(end.attempt).toMatchObject({ status: "arrivé", time: d.authorTicks, deaths: 0 });
  });
});
