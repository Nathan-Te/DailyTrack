import { expect, test, type Page } from "@playwright/test";
import { boxes, expectNoOverlap } from "./layout";

// Miniatures des archives (lot 13). Rendu 3D : Chromium seulement (WebGL). On vérifie le CONTENU des images (pixels), pas
// seulement leur présence : un compteur ne dit pas si l'image est vide (leçon du lot 9b).
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(180_000);

// Quatorze jours d'historique + « aujourd'hui » de la démo.
const DEMO_ROWS = 15;

const ready = (page: Page) => page.waitForFunction(() => window.__cdj?.phase, undefined, { timeout: 30_000 });

interface Look {
  w: number;
  h: number;
  /** Couleurs distinctes (canaux sur 4 bits) et part de la couleur dominante : une image vide ou unie sort de ces bornes. */
  colors: number;
  dominant: number;
  /** Signature de l'image : deux jours différents doivent donner deux images différentes. */
  sig: string;
}

/** Lit les pixels de chaque `<img>` des miniatures. */
async function looks(page: Page): Promise<Look[]> {
  return page.evaluate(async () => {
    const out: Look[] = [];
    for (const img of Array.from(document.querySelectorAll<HTMLImageElement>("#archive .thumb img"))) {
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, c.width, c.height).data;
      const counts = new Map<number, number>();
      let sig = 0;
      for (let i = 0; i < px.length; i += 4) {
        const k = ((px[i]! >> 4) << 8) | ((px[i + 1]! >> 4) << 4) | (px[i + 2]! >> 4);
        counts.set(k, (counts.get(k) ?? 0) + 1);
        if ((i / 4) % 97 === 0) sig = (Math.imul(sig, 31) + px[i]! + 7 * px[i + 1]! + 13 * px[i + 2]!) | 0;
      }
      out.push({ w: c.width, h: c.height, colors: counts.size, dominant: Math.max(...counts.values()) / (px.length / 4), sig: String(sig) });
    }
    return out;
  });
}

/** Fait défiler le panneau ligne par ligne : une miniature n'est demandée que quand sa ligne apparaît. */
async function scrollThrough(page: Page, rows: number) {
  const days = page.locator("#archive .day");
  await expect(days).toHaveCount(rows);
  // Les détails du jeu de démo arrivent juste après la liste, qui est alors redessinée : on attend ce redessin avant de défiler.
  await expect(page.locator("#archive .day .sub")).toHaveCount(rows - 1, { timeout: 30_000 });
  for (let i = 0; i < rows; i++) {
    await days.nth(i).scrollIntoViewIfNeeded();
    await expect(days.nth(i).locator(".thumb img")).toBeVisible({ timeout: 60_000 });
  }
}

function expectGoodImages(list: Look[], count: number) {
  expect(list).toHaveLength(count);
  for (const l of list) {
    expect(l.w, "image à la taille demandée (320 px ou 640 en haute densité)").toBeGreaterThanOrEqual(320);
    expect(l.h).toBeGreaterThanOrEqual(180);
    expect(l.colors, "une vraie image : plusieurs couleurs").toBeGreaterThanOrEqual(10);
    expect(l.dominant, "pas une image unie").toBeLessThan(0.97);
  }
  expect(new Set(list.map((l) => l.sig)).size, "chaque jour a sa miniature").toBe(count);
}

test("archives de démonstration : les 15 miniatures apparaissent au défilement, avec un vrai contenu", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/?api=demo&debug");
  await ready(page);
  await page.keyboard.press("KeyH");
  await scrollThrough(page, DEMO_ROWS);
  expectGoodImages(await looks(page), DEMO_ROWS);
  const { stats } = await page.evaluate(() => window.__cdj.thumbs);
  expect(stats.made).toBe(DEMO_ROWS);
  expect(stats.ranWhileBlocked, "aucun rendu pendant une course").toBe(0);
  expect(errors).toEqual([]);
  // La ligne garde ses informations (numéro, date, thème, médailles, pilotes) à côté de l'image.
  const first = page.locator("#archive .day").nth(1);
  await expect(first).toContainText("#14");
  await expect(first).toContainText("2026-10-05");
  await expect(first.locator(".sub")).toContainText("pilotes");
  test.info().annotations.push({
    type: "mesure",
    description: `génération (fil de travail) ${JSON.stringify(stats.generateMs)} ms · rendu ${JSON.stringify(stats.renderMs)} ms · encodage ${JSON.stringify(stats.encodeMs)} ms · ${stats.bytes} octets`,
  });
});

test("le cache garde les images : à la visite suivante, rien n'est refabriqué", async ({ page }) => {
  await page.goto("/?api=demo&debug");
  await ready(page);
  await page.keyboard.press("KeyH");
  const days = page.locator("#archive .day");
  for (let i = 0; i < 3; i++) await expect(days.nth(i).locator(".thumb img")).toBeVisible({ timeout: 60_000 });
  const first = await page.evaluate(() => window.__cdj.thumbs.stats.made);
  expect(first).toBeGreaterThanOrEqual(3);
  await page.waitForFunction(() => window.__cdj.thumbs.pending === 0, undefined, { timeout: 60_000 });
  const stored = await page.evaluate(() => window.__cdj.thumbs.stats.made);
  await page.waitForTimeout(500); // l'écriture dans IndexedDB suit la fabrication

  await page.reload(); // même navigateur : IndexedDB est gardée, la mémoire est vidée
  await ready(page);
  await page.keyboard.press("KeyH");
  for (let i = 0; i < Math.min(3, stored); i++) await expect(days.nth(i).locator(".thumb img")).toBeVisible({ timeout: 30_000 });
  const again = await page.evaluate(() => window.__cdj.thumbs.stats);
  expect(again.storeHits, "images relues du cache du navigateur").toBeGreaterThanOrEqual(3);
  // Tout ce qui était déjà gardé n'est pas refabriqué : au plus les lignes visibles et non gardées auparavant.
  expect(again.made).toBeLessThanOrEqual(Math.max(0, DEMO_ROWS - stored));
  expectGoodImages((await looks(page)).slice(0, 3), 3);
});

test("jamais de miniature pendant une course : archives ouvertes = course gelée ; fermées = plus aucun travail", async ({ page }) => {
  await page.goto("/?api=demo&debug");
  await ready(page);
  await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 30_000 });
  const t0 = await page.evaluate(() => window.__cdj.car.tick);
  await page.keyboard.press("KeyH");
  await expect(page.locator("#archive .day").nth(0).locator(".thumb img")).toBeVisible({ timeout: 60_000 }); // la course est gelée : on peut travailler
  const t1 = await page.evaluate(() => window.__cdj.car.tick);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => window.__cdj.car.tick), "la course ne tourne pas pendant qu'on regarde les archives").toBe(t1);
  expect(t1 - t0).toBeLessThan(400);
  // On ferme : la file est abandonnée, plus rien n'est fabriqué pendant que la course repart.
  await page.keyboard.press("Escape");
  await expect(page.locator("#archive")).toBeHidden();
  await page.waitForTimeout(500); // la fabrication en cours, s'il y en a une, se termine
  const made = await page.evaluate(() => window.__cdj.thumbs.stats.made);
  await page.waitForTimeout(2500);
  const after = await page.evaluate(() => window.__cdj.thumbs);
  expect(after.stats.made, "rien de fabriqué course rouvrante").toBe(made);
  expect(after.pending).toBe(0);
  expect(after.stats.ranWhileBlocked).toBe(0);
  expect(await page.evaluate(() => window.__cdj.car.tick), "la course repart").toBeGreaterThan(t1);
});

test("sans WebGL le tracé 2D prend le relais, aux couleurs du thème", async ({ page }) => {
  await page.goto("/?api=demo&debug&thumbs=2d");
  await ready(page);
  await page.keyboard.press("KeyH");
  const days = page.locator("#archive .day");
  for (let i = 0; i < 5; i++) await expect(days.nth(i).locator(".thumb img")).toBeVisible({ timeout: 60_000 });
  const list = await looks(page);
  expect(list.length).toBeGreaterThanOrEqual(5);
  for (const l of list.slice(0, 5)) {
    expect(l.colors).toBeGreaterThanOrEqual(4);
    expect(l.dominant).toBeLessThan(0.97);
  }
  expect(new Set(list.map((l) => l.sig)).size).toBe(list.length);
});

test("ouvrir un jour : sa miniature s'affiche pendant le décompte, et disparaît au départ", async ({ page }) => {
  await page.goto("/?api=demo&day=2026-09-30&debug");
  await page.waitForFunction(() => window.__cdj?.manual && (window.__cdj.manual(true), true), undefined, { timeout: 30_000 }); // décompte figé
  const card = page.locator("#daycard img");
  await expect(card).toBeVisible({ timeout: 60_000 });
  const stat = await card.evaluate(async (img: HTMLImageElement) => {
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, c.width, c.height).data;
    const seen = new Set<number>();
    for (let i = 0; i < px.length; i += 4) seen.add(((px[i]! >> 4) << 8) | ((px[i + 1]! >> 4) << 4) | (px[i + 2]! >> 4));
    return { w: c.width, colors: seen.size };
  });
  expect(stat.w).toBeGreaterThanOrEqual(320);
  expect(stat.colors).toBeGreaterThanOrEqual(10);
  await page.evaluate(() => window.__cdj.advance(400)); // le décompte finit
  await expect(page.locator("#daycard")).toBeHidden();
});

test("le jour d'aujourd'hui (sans archive ouverte) n'affiche pas de carte", async ({ page }) => {
  await page.goto("/?debug");
  await ready(page);
  await expect(page.locator("#daycard")).toBeHidden();
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => window.__cdj.thumbs.stats.made)).toBe(0); // rien n'est fabriqué tant qu'on n'ouvre pas les archives
});

test("vues : inclinée et d'aplomb donnent deux images différentes du même circuit", async ({ page }) => {
  await page.goto("/?debug&thumbs=off");
  await ready(page);
  const [a, b] = await page.evaluate(() => [window.__cdj.thumbnail("2026-10-01", { view: "tilted" }).url, window.__cdj.thumbnail("2026-10-01", { view: "top" }).url]);
  expect(a.startsWith("data:image/png")).toBe(true);
  expect(a).not.toBe(b);
});

test("l'ouverture des archives ne gèle pas l'interface (processeur ×4 : la génération se fait hors du fil principal)", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await page.addInitScript(() => {
    (window as unknown as { __long: number[] }).__long = [];
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) (window as unknown as { __long: number[] }).__long.push(Math.round(e.duration));
    }).observe({ type: "longtask", buffered: true });
  });
  // `thumbs=2d` : sans WebGL logiciel (très lent en conteneur, rapide sur une vraie carte), ce qui reste est la génération et le dessin.
  await page.goto("/?api=demo&debug&thumbs=2d&touch=0");
  await ready(page);
  await page.evaluate(() => window.__cdj.manual(true)); // le jeu ne dessine plus : on ne mesure que les miniatures
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.evaluate(() => ((window as unknown as { __long: number[] }).__long.length = 0));
  await page.keyboard.press("KeyH");
  await scrollThrough(page, DEMO_ROWS);
  const long = await page.evaluate(() => (window as unknown as { __long: number[] }).__long);
  const stats = await page.evaluate(() => window.__cdj.thumbs.stats);
  const worst = Math.max(0, ...long);
  test.info().annotations.push({ type: "mesure", description: `processeur ×4 : ${stats.made} miniatures, plus longue tâche ${worst} ms (${long.length} tâches > 50 ms) ; génération ${JSON.stringify(stats.generateMs)} ms` });
  // Un circuit coûte ≈ 200 ms (800 ms à ×4) : sur le fil principal, 15 d'entre eux gèleraient l'écran plusieurs secondes.
  expect(stats.mainThreadGenerations, "la génération se fait dans le fil de travail").toBe(0);
  expect(worst, "aucune tâche ne bloque l'écran longtemps").toBeLessThan(1500);
  expect(stats.made).toBe(DEMO_ROWS);
  await context.close();
});

for (const viewport of [
  { name: "petit portrait", width: 360, height: 640 },
  { name: "portrait", width: 390, height: 844 },
  { name: "paysage", width: 844, height: 390 },
]) {
  test(`téléphone ${viewport.name} : les lignes d'archives ne débordent pas et l'image ne recouvre rien`, async ({ browser }) => {
    const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    await page.goto("/?api=demo&debug&thumbs=2d&touch=0");
    await ready(page);
    await page.keyboard.press("KeyH");
    const row = page.locator("#archive .day").nth(1);
    await expect(row.locator(".sub")).toBeVisible({ timeout: 30_000 });
    await expect(row.locator(".thumb img")).toBeVisible({ timeout: 60_000 });
    await row.scrollIntoViewIfNeeded();
    const panel = await page.locator("#archive .panel").evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(panel.scroll, "pas de défilement horizontal").toBeLessThanOrEqual(panel.client + 1);
    const list = await boxes(page, ["#archive .day:nth-child(2) .thumb", "#archive .day:nth-child(2) .what", "#archive .day:nth-child(2) .best", "#archive .day:nth-child(2) .sub"]);
    expect(list.length).toBe(4);
    expectNoOverlap(list, viewport);
    await context.close();
  });
}
