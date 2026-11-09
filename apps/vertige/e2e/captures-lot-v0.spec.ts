import { mkdirSync, writeFileSync } from "node:fs";
import { chromium, expect, test, type Browser, type Page } from "@playwright/test";
import type {} from "./appareil"; // les types de `window.__jeu` et `window.__vertige`

// Lot V0 — les captures (une par style, plus les images d'un GIF du parcours) et les mesures d'images par seconde. **Un outil, jamais en CI** (le fichier s'appelle `captures-*` : la configuration l'ignore sans
// `CAPTURES=1`) : `CAPTURES=1 npx playwright test captures-lot-v0 --project=chromium`. Sous Windows, le GPU se prend avec `--use-angle=d3d11` ; le « portable moyen simulé » est le rendu logiciel (SwiftShader) avec le
// processeur ralenti 4 fois (CDP), à 960 × 540. Ce sont des ORDRES DE GRANDEUR : aucun vrai portable n'a servi (`?debug&fps` donne les chiffres de celui de Nathan).
const SORTIE = new URL("../../../docs/vertige/lots/images/", import.meta.url);
const IMAGES = new URL("../test-results/gif/", import.meta.url);
const gpu = process.platform === "win32" ? ["--use-angle=d3d11", "--ignore-gpu-blocklist"] : ["--ignore-gpu-blocklist"];
const sansLimite = ["--disable-frame-rate-limit", "--disable-gpu-vsync"];

async function ouvrir(browser: Browser, adresse: string, largeur: number, hauteur: number): Promise<Page> {
  const context = await browser.newContext({ baseURL: "http://localhost:4187", locale: "fr-FR", viewport: { width: largeur, height: hauteur } });
  await context.addInitScript(() => localStorage.setItem("vertige:aide:vu", "1"));
  const page = await context.newPage();
  await page.goto(adresse);
  await page.waitForSelector("#jeu-jouer", { state: "attached" });
  await page.locator("#jeu-jouer").click();
  await page.waitForFunction(() => !!(window as unknown as { __vertige?: unknown }).__vertige);
  await page.waitForTimeout(800); // le joueur scripté se charge à la demande
  return page;
}

test("captures : une image par style et les images du GIF du parcours", async () => {
  test.setTimeout(600_000);
  mkdirSync(SORTIE, { recursive: true });
  mkdirSync(IMAGES, { recursive: true });
  const browser = await chromium.launch({ args: gpu });
  for (const style of ["doux", "cartouche"] as const) {
    const page = await ouvrir(browser, `/?debug&manuel&demo&tactile=0&scenario=parcours&style=${style}`, 1280, 720);
    // L'image du style : sur le mur, la caméra penchée, le geste de la maquette (tick 440).
    await page.evaluate(() => window.__jeu.avancer(440));
    await page.waitForTimeout(500);
    await page.screenshot({ path: new URL(`lot-V0-${style === "doux" ? "lumiere-douce" : "cartouche"}.png`, SORTIE).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
    await page.context().close();
  }
  // Les images du GIF : la scène seule (le style « Lumière douce »), 8 pas de simulation entre deux images (15 images par seconde), 480 × 270.
  const page = await ouvrir(browser, "/?debug&manuel&demo&tactile=0&scenario=parcours&style=doux", 960, 600);
  await page.evaluate(() => window.__jeu.avancer(1));
  const scene = page.locator(".vertige-scene");
  let n = 0;
  for (let t = 0; t < 760; t += 8) {
    await page.evaluate(() => window.__jeu.avancer(8));
    await scene.screenshot({ path: new URL(`f${String(n++).padStart(3, "0")}.png`, IMAGES).pathname.replace(/^\/([A-Za-z]:)/, "$1") });
  }
  await browser.close();
  expect(n).toBeGreaterThan(80);
});

interface Mesure {
  config: string;
  environnement: string;
  ips: number;
  appels: number;
  triangles: number;
}
const mesures: Mesure[] = [];

async function mesurer(browser: Browser, environnement: string, largeur: number, hauteur: number, ralentissement: number): Promise<void> {
  const configs: [string, string][] = [
    ["Lumière douce, halo et ombres", "style=doux"],
    ["Lumière douce, sans halo", "style=doux&bloom=0"],
    ["Lumière douce, sans ombres", "style=doux&ombres=0"],
    ["Lumière douce, sans halo ni ombres", "style=doux&bloom=0&ombres=0"],
    ["Cartouche, avec ombres", "style=cartouche"],
    ["Cartouche, sans ombres", "style=cartouche&ombres=0"],
  ];
  for (const [nom, q] of configs) {
    const page = await ouvrir(browser, `/?debug&demo&fps&tactile=0&scenario=parcours&${q}`, largeur, hauteur);
    if (ralentissement > 1) await (await page.context().newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: ralentissement });
    await page.waitForTimeout(1500); // le premier tour de shaders
    const ips = await page.evaluate(
      () =>
        new Promise<number>((fin) => {
          let n = 0;
          const t0 = performance.now();
          const f = (): void => {
            n++;
            if (performance.now() - t0 < 5000) requestAnimationFrame(f);
            else fin((n * 1000) / (performance.now() - t0));
          };
          requestAnimationFrame(f);
        }),
    );
    const texte = (await page.locator(".vertige-mesure").textContent()) ?? "";
    const m = /(\d+) appels · (\d+) k tri/.exec(texte);
    mesures.push({ config: nom, environnement, ips: Math.round(ips * 10) / 10, appels: Number(m?.[1] ?? 0), triangles: Number(m?.[2] ?? 0) * 1000 });
    await page.context().close();
  }
}

test("images par seconde : le GPU de la machine, puis un portable moyen simulé (rendu logiciel, processeur ralenti)", async () => {
  test.setTimeout(900_000);
  const b1 = await chromium.launch({ args: [...gpu, ...sansLimite] });
  await mesurer(b1, "GPU de la machine, 1280 × 720, sans limite d'images", 1280, 720, 1);
  await b1.close();
  const b2 = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", ...sansLimite] });
  await mesurer(b2, "portable simulé : rendu logiciel, processeur ÷ 4, 960 × 540", 960, 540, 4);
  await b2.close();
  mkdirSync(IMAGES, { recursive: true });
  writeFileSync(new URL("fps.json", IMAGES).pathname.replace(/^\/([A-Za-z]:)/, "$1"), JSON.stringify(mesures, null, 2));
  expect(mesures.length).toBe(12);
});
