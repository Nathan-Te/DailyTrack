import { mkdirSync } from "node:fs";
import { chromium, test, type Browser, type Page } from "@playwright/test";
import { enchainement, MODULES, robotDuModule } from "@cdj/vertige-sim/modules";
import type {} from "./appareil"; // les types de `window.__jeu` et `window.__vertige`

// Lot V2 — les captures de la galerie de modules, les images du GIF de l'enchaînement (le robot le joue en entier) et les mesures de dessin de l'enchaînement. **Un outil, jamais en CI** (le fichier s'appelle `captures-*` :
// la configuration l'ignore sans `CAPTURES=1`) : `CAPTURES=1 npx playwright test captures-lot-v2 --project=chromium`. Rendu logiciel (SwiftShader) : des ordres de grandeur d'images par seconde, des appels de dessin exacts.
const SORTIE = new URL("../../../docs/vertige/lots/images/", import.meta.url);
const IMAGES = new URL("../test-results/gif-v2/", import.meta.url);
const chemin = (u: URL): string => u.pathname.replace(/^\/([A-Za-z]:)/, "$1");
const logiciel = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

async function ouvrir(browser: Browser, adresse: string, largeur: number, hauteur: number): Promise<Page> {
  const context = await browser.newContext({ baseURL: "http://localhost:4187", locale: "fr-FR", viewport: { width: largeur, height: hauteur } });
  await context.addInitScript(() => localStorage.setItem("vertige:aide:vu", "1"));
  const page = await context.newPage();
  await page.goto(adresse);
  await page.waitForSelector("#jeu-jouer", { state: "attached" });
  await page.locator("#jeu-jouer").click();
  await page.waitForFunction(() => !!(window as unknown as { __vertige?: unknown }).__vertige);
  return page;
}

test("captures : la galerie de modules, l'enchaînement, les images du GIF et les appels de dessin", async () => {
  test.setTimeout(3_600_000);
  mkdirSync(chemin(SORTIE), { recursive: true });
  mkdirSync(chemin(IMAGES), { recursive: true });
  const browser = await chromium.launch({ args: logiciel });

  // La galerie : trois modules en cours de solution (le robot joue : la caméra rejoue la solution).
  let page = await ouvrir(browser, "/?debug&manuel&tactile=0&scenario=modules", 1280, 720);
  for (const [id, pas, nom] of [["saut-1", 190, "saut"], ["gravite-2", 420, "tonneau"], ["portail-quart", 420, "portail"], ["mur-2", 400, "mur"]] as const) {
    await page.evaluate(([x]) => window.__vertige.charger(x, true), [id]);
    await page.evaluate((n) => window.__jeu.avancer(n), pas);
    await page.waitForTimeout(600);
    await page.screenshot({ path: chemin(new URL(`lot-V2-galerie-${nom}.png`, SORTIE)) });
  }
  void MODULES;
  void robotDuModule;
  await page.context().close();

  // L'enchaînement : le robot le joue en entier ; une image toutes les 16 pas de simulation (7,5 images par seconde), 480 × 270 ; et les appels de dessin à quelques endroits.
  const e = enchainement();
  page = await ouvrir(browser, "/?debug&manuel&tactile=0&scenario=enchainement", 480, 300);
  await page.evaluate((c) => window.__vertige.jouer(c), e.solution);
  const scene = page.locator(".vertige-scene");
  mkdirSync(chemin(new URL("enchainement/", IMAGES)), { recursive: true });
  const dessin: { pas: number; appels: number; triangles: number; fenetres: number }[] = [];
  let n = 0;
  for (let t = 0; t < e.solution.length; t += 16) {
    await page.evaluate(() => window.__jeu.avancer(16));
    await scene.screenshot({ path: chemin(new URL(`enchainement/f${String(n++).padStart(3, "0")}.png`, IMAGES)), animations: "allow" });
    if (t % 400 < 16) dessin.push({ pas: t, ...(await page.evaluate(() => ({ appels: window.__vertige.monde.renderer.info.render.calls, triangles: window.__vertige.monde.renderer.info.render.triangles, fenetres: window.__vertige.monde.fenetres?.dessinees ?? 0 }))) });
  }
  console.log("dessin de l'enchaînement (pas, appels, triangles, fenêtres) :", JSON.stringify(dessin));
  await page.context().close();
  await browser.close();
});
