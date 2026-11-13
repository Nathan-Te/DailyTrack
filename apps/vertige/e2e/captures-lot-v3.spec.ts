import { mkdirSync } from "node:fs";
import { chromium, test, type Page } from "@playwright/test";
import { VERTIGE_GENERATOR_VERSION, VERTIGE_SIM_VERSION } from "@cdj/vertige-sim";
import { dailyVertige, robotDuJour } from "@cdj/vertige-sim/modules";
import { parseDay } from "@cdj/core";
import { ESSAIS_VERTIGE } from "../../api/scripts/vertige-essais";
import { JOUR } from "./appareil";

// Lot V3 — les captures de la galerie des jours, du niveau du jour joué par le robot (les images du GIF), et du fantôme Diamant (la silhouette translucide, vue du joueur). **Un outil, jamais en CI** (le fichier s'appelle `captures-*` :
// la configuration l'ignore sans `CAPTURES=1`) : `CAPTURES=1 npx playwright test captures-lot-v3 --project=chromium`. Rendu logiciel (SwiftShader). Les GIF se montent ensuite avec ffmpeg (palette).
const SORTIE = new URL("../../../docs/vertige/lots/images/", import.meta.url);
const IMAGES = new URL("../test-results/gif-v3/", import.meta.url);
const chemin = (u: URL): string => u.pathname.replace(/^\/([A-Za-z]:)/, "$1");
const logiciel = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
const VERSIONS = { simVersion: VERTIGE_SIM_VERSION, generatorVersion: VERTIGE_GENERATOR_VERSION };

async function ouvrir(browser: Awaited<ReturnType<typeof chromium.launch>>, adresse: string, largeur: number, hauteur: number): Promise<Page> {
  const context = await browser.newContext({ baseURL: "http://localhost:4187", locale: "fr-FR", viewport: { width: largeur, height: hauteur }, permissions: ["clipboard-read", "clipboard-write"] });
  const decalage = Date.UTC(2026, 10, 6, 12) - Date.now();
  await context.addInitScript(
    ({ decalage }) => {
      const Reel = Date;
      class Decale extends Reel {
        constructor(...args: unknown[]) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          super(...((args.length === 0 ? [Reel.now() + decalage] : args) as [any]));
        }
        static override now() {
          return Reel.now() + decalage;
        }
      }
      (globalThis as { Date: DateConstructor }).Date = Decale as unknown as DateConstructor;
      localStorage.setItem("vertige:aide:vu", "1");
    },
    { decalage },
  );
  const page = await context.newPage();
  await page.goto(adresse);
  await page.waitForSelector("#jeu-jouer", { state: "attached" });
  await page.locator("#jeu-jouer").click();
  await page.waitForFunction(() => !!(window as unknown as { __vertige?: unknown }).__vertige);
  return page;
}

test("captures : la galerie des jours, le robot sur le niveau du jour (GIF), le fantôme Diamant (GIF)", async () => {
  test.setTimeout(3_600_000);
  mkdirSync(chemin(SORTIE), { recursive: true });
  const browser = await chromium.launch({ args: logiciel });
  const jour = parseDay(JOUR)!;
  const c = dailyVertige(jour);

  // La galerie : la liste des 14 jours, puis « Voir la démonstration » du premier (le robot joue le niveau).
  let page = await ouvrir(browser, "/?debug&manuel&tactile=0&scenario=jours", 1280, 720);
  await page.waitForFunction(() => document.querySelectorAll(".vertige-galerie--jours .vertige-galerie__module").length === 14, null, { timeout: 60_000 });
  await page.locator(".vertige-galerie__module [data-action=voir]").first().click();
  await page.evaluate(() => window.__jeu.avancer(900));
  await page.waitForTimeout(600);
  await page.screenshot({ path: chemin(new URL("lot-V3-galerie-jours.png", SORTIE)) });
  await page.context().close();

  // Le robot joue le niveau du jour en entier : une image toutes les 16 pas (7,5 images par seconde), 480 × 300.
  const robot = robotDuJour(c);
  page = await ouvrir(browser, "/?debug&manuel&tactile=0&debug", 480, 300);
  await page.evaluate((cmd) => window.__vertige.jouer(cmd), robot);
  const scene = page.locator(".vertige-scene");
  mkdirSync(chemin(new URL("robot/", IMAGES)), { recursive: true });
  let n = 0;
  for (let t = 0; t < robot.length; t += 16) {
    await page.evaluate(() => window.__jeu.avancer(16));
    await scene.screenshot({ path: chemin(new URL(`robot/f${String(n++).padStart(3, "0")}.png`, IMAGES)), animations: "allow" });
  }
  await page.context().close();

  // Le fantôme : le joueur finit une partie (le Diamant se débloque), recommence, choisit le fantôme Diamant puis joue le robot RETARDÉ (la variante 11 le laisse 33 pas derrière) : la silhouette du robot est devant lui.
  page = await ouvrir(browser, "/?debug&manuel&tactile=0", 960, 540);
  const lent = (await import("@cdj/vertige-sim")).decoderRediffusion(ESSAIS_VERTIGE.partie(jour, VERSIONS, 11).rediffusion).commandes;
  await page.evaluate((cmd) => {
    window.__vertige.jouer(cmd);
    window.__jeu.avancer(cmd.length + 5);
  }, lent);
  await page.locator("#jeu-rejouer").click();
  for (let i = 0; i < 2; i++) await page.locator("#jeu-hud-fantome").click();
  await page.evaluate((cmd) => window.__vertige.jouer(cmd), lent);
  await page.evaluate(() => window.__jeu.avancer(300));
  await page.waitForTimeout(400);
  await page.screenshot({ path: chemin(new URL("lot-V3-fantome-diamant.png", SORTIE)) });
  const petit = await ouvrir(browser, "/?debug&manuel&tactile=0", 480, 300);
  await petit.evaluate((cmd) => {
    window.__vertige.jouer(cmd);
    window.__jeu.avancer(cmd.length + 5);
  }, lent);
  await petit.locator("#jeu-rejouer").click();
  for (let i = 0; i < 2; i++) await petit.locator("#jeu-hud-fantome").click();
  await petit.evaluate((cmd) => window.__vertige.jouer(cmd), lent);
  const scenePetite = petit.locator(".vertige-scene");
  mkdirSync(chemin(new URL("fantome/", IMAGES)), { recursive: true });
  for (let i = 0; i < 90; i++) {
    await petit.evaluate(() => window.__jeu.avancer(16));
    await scenePetite.screenshot({ path: chemin(new URL(`fantome/f${String(i).padStart(3, "0")}.png`, IMAGES)), animations: "allow" });
  }
  console.log("images : robot", n, "fantôme 90");
  await page.context().close();
  await petit.context().close();
  await browser.close();
});
