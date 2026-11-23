import { test, type Page } from "@playwright/test";
import { API, appareil, lancer } from "./appareil";

// Les captures du lot BR-A3 (jamais en CI : les modèles tiers ne sont que sur la machine de Nathan) : `TOUR=1 CAPTURES=1 npx playwright test captures-lot-br-a3 --project=chromium` dans apps/rush,
// après `npm run modeles-tiers -w @cdj/rush` et `npm run build -w @cdj/rush`. La vitrine (1920 × 1080) avec et sans les modèles (`&modeles=0`), côte à côte avec la cible (`docs/rush/lots/bra3-tN-comparaison.png`, écrite par
// `scripts/bra3-planche.py`), l'arène du golem, le bestiaire des monstres, et le CONTOUR en 1280 × 720, 1920 × 1080 et 2560 × 1440 à DPR 1 et 2.
const DOSSIER = "../../docs/rush/lots";
const TOUR = process.env.TOUR ?? "1";
const BASE = `/?api=${API}&debug&manuel&tactile=0&fps&theme=prairie`;

/** Attend les modèles tiers (s'ils sont demandés), joue `ticks` ticks puis dessine deux fois. */
const poser = async (page: Page, ticks: number, modeles = true): Promise<void> => {
  if (modeles) await page.waitForFunction(() => (window as unknown as { __rush: { tiers(): { prets: boolean } } }).__rush.tiers().prets, null, { timeout: 20_000 });
  await page.evaluate((n) => {
    window.__jeu.avancer(n);
    window.__rush.dessinerMaintenant();
  }, ticks);
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__rush.dessinerMaintenant());
};

test.describe("captures du lot BR-A3", () => {
  test("vitrine avant / après", async ({ browser }) => {
    for (const modeles of [true, false]) {
      const { context, page } = await appareil(browser, `${BASE}&scenario=vitrine${modeles ? "" : "&modeles=0"}`);
      await page.setViewportSize({ width: 1920, height: 1080 });
      await lancer(page, null);
      await poser(page, 2, modeles);
      await page.screenshot({ path: `${DOSSIER}/bra3-t${TOUR}-vitrine${modeles ? "" : "-procedural"}.png` });
      await context.close();
    }
  });

  test("vitrine basse qualité", async ({ browser }) => {
    const { context, page } = await appareil(browser, `${BASE}&scenario=vitrine&qualite=basse`);
    await page.setViewportSize({ width: 1920, height: 1080 });
    await lancer(page, null);
    await poser(page, 2);
    await page.screenshot({ path: `${DOSSIER}/bra3-t${TOUR}-vitrine-basse.png` });
    await context.close();
  });

  test("arène du golem et monstres", async ({ browser }) => {
    for (const [nom, adresse, ticks] of [
      ["boss-golem", "&scenario=boss&boss=golem&competence=tourbillon", 260],
      ["bestiaire-monstres", "&scenario=bestiaire-monstres", 2],
    ] as const) {
      const { context, page } = await appareil(browser, `${BASE}${adresse}`);
      await page.setViewportSize({ width: 1920, height: 1080 });
      await lancer(page, nom === "boss-golem" ? "pilote" : null);
      await poser(page, ticks);
      await page.screenshot({ path: `${DOSSIER}/bra3-t${TOUR}-${nom}.png` });
      await context.close();
    }
  });

  test("mesures : appels, triangles, maillages animés, coût d'une image", async ({ browser }) => {
    const mesures: Record<string, unknown> = {};
    const mesurer = async (page: Page, images: number) =>
      page.evaluate((n) => {
        const r = window.__rush as unknown as { dessinerMaintenant(): void; calls(): number; triangles(): number; scene(): { traverse(f: (o: { isSkinnedMesh?: boolean; visible: boolean; layers: { mask: number } }) => void): void } };
        r.dessinerMaintenant();
        let animes = 0;
        r.scene().traverse((o) => {
          if (o.isSkinnedMesh && o.visible && o.layers.mask & 1) animes++;
        });
        // le coût d'une image (avancer d'un tick + dessiner), moyenné
        const t0 = performance.now();
        for (let i = 0; i < n; i++) {
          window.__jeu.avancer(1);
          r.dessinerMaintenant();
        }
        return { appels: r.calls(), triangles: r.triangles(), skinnedMesh: animes, msParImage: (performance.now() - t0) / n };
      }, images);
    for (const [nom, adresse, ticks] of [
      ["vitrine", "&scenario=vitrine", 2],
      ["vitrine-procedural", "&scenario=vitrine&modeles=0", 2],
      ["vitrine-basse", "&scenario=vitrine&qualite=basse", 2],
      ["arene-40", "&scenario=arene&monstres=40", 1500],
      ["arene-40-procedural", "&scenario=arene&monstres=40&modeles=0", 1500],
    ] as const) {
      const { context, page } = await appareil(browser, `${BASE}${adresse}`);
      await page.setViewportSize({ width: 1920, height: 1080 });
      await lancer(page, nom.startsWith("arene") ? "pilote" : null);
      await poser(page, ticks, !nom.includes("procedural"));
      mesures[nom] = await mesurer(page, 60);
      await context.close();
    }
    const { writeFileSync } = await import("node:fs");
    writeFileSync(`${DOSSIER}/bra3-mesures.json`, JSON.stringify(mesures, null, 1));
  });

  test("contour : définitions et densités de pixels", async ({ browser }) => {
    for (const [l, h] of [
      [1280, 720],
      [1920, 1080],
      [2560, 1440],
    ] as const) {
      for (const dpr of [1, 2]) {
        const { context, page } = await appareil(browser, `${BASE}&scenario=vitrine`, true, { width: l, height: h, dpr });
        await lancer(page, null);
        await poser(page, 2);
        await page.screenshot({ path: `${DOSSIER}/bra3-t${TOUR}-contour-${l}x${h}-dpr${dpr}.png` });
        await context.close();
      }
    }
  });
});
