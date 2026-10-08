import { readdirSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";

// Chargement rapide sur mobile : budgets de poids (déterministes) et de temps (larges, la CI est variable).
const dist = new URL("../dist/assets/", import.meta.url);

test("le jeu pèse peu : budget de poids compressé", () => {
  const files = readdirSync(dist).filter((f) => f.endsWith(".js"));
  const gz = Object.fromEntries(files.map((f) => [f, gzipSync(readFileSync(new URL(f, dist))).length]));
  // Le fil de travail des miniatures (lot 13) ne se charge qu'à l'ouverture des archives : budget à part, hors du chargement initial.
  const worker = Object.entries(gz).find(([f]) => f.startsWith("circuitWorker-"))?.[1] ?? 0;
  const total = Object.values(gz).reduce((a, b) => a + b, 0) - worker;
  const three = Object.entries(gz).find(([f]) => f.startsWith("three-"))?.[1] ?? 0;
  expect(three, "three.js doit rester dans son propre fichier (cache entre déploiements)").toBeGreaterThan(100_000);
  expect(total, `JS compressé : ${JSON.stringify(gz)}`).toBeLessThan(204_000); // ≈ 197 ko aujourd'hui (lot 17 : +4 ko, relief, sauts, rendu des piliers et ombre d'atterrissage ; lot 14 : +10 ko, planning et panneau d'admin ; lot 9 : +8 ko ; lot 13 : +5 ko de miniatures ; budget du lot 9 : ≤ 300 ko ajoutés)
  expect(total - three, "le code du jeu et de la simulation, hors three.js").toBeLessThan(70_000); // ≈ 67 ko aujourd'hui (lot 17 : +5 ko ; le panneau d'admin du lot 14 pèse ≈ 8 ko, chargé seulement sur /admin/)
  expect(worker, "fil de travail des miniatures (une copie de sim : générateur et pilote), chargé à la demande").toBeLessThan(16_000); // ≈ 13,6 ko (lot 17 : +3,6 ko, le générateur et le pilote ont grandi)
});

test.describe("chargement sur un téléphone simulé", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "CDP : Chromium seulement");

  test("écran de chargement immédiat, jeu prêt en quelques secondes (processeur ×4, 4G lente)", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const t0 = Date.now();
    await page.goto("/?debug", { waitUntil: "commit" });
    await page.waitForFunction(() => window.__cdj?.phase, undefined, { timeout: 30_000 });
    const readyMs = Date.now() - t0;
    const fcp = await page.evaluate(() => performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? -1);
    test.info().annotations.push({ type: "mesure", description: `FCP ${Math.round(fcp)} ms, prêt ${readyMs} ms` });
    expect(fcp, "le premier affichage (écran de chargement) ne doit pas attendre le JavaScript").toBeGreaterThan(0);
    expect(fcp).toBeLessThan(2500);
    expect(readyMs).toBeLessThan(8000); // ≈ 1,9 s mesuré en local
    await expect(page.locator("#splash")).toHaveCount(0); // retiré après le premier rendu
    await context.close();
  });
});
