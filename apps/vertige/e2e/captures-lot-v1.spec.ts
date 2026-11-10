import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, expect, test, type Browser, type Page } from "@playwright/test";
import { Partie, T_SAUT, decoderRediffusion, niveau, type Commande } from "@cdj/vertige-sim";
import { jouerCibles } from "../../../packages/vertige-sim/tools/robot";
import type {} from "./appareil"; // les types de `window.__jeu` et `window.__vertige`

// Lot V1 — les captures (la salle de la gravité, le plafond, un portail), les images des GIF (le parcours des portails, le cube) et les mesures d'images par seconde avec un portail à l'écran. **Un outil, jamais en CI**
// (le fichier s'appelle `captures-*` : la configuration l'ignore sans `CAPTURES=1`) : `CAPTURES=1 npx playwright test captures-lot-v1 --project=chromium`. « Portable moyen simulé » = le rendu logiciel (SwiftShader) avec le
// processeur ralenti 4 fois (CDP), à 960 × 540. Ce sont des ORDRES DE GRANDEUR : aucun vrai portable n'a servi (`?debug&fps` donne les chiffres de celui de Nathan).
const SORTIE = new URL("../../../docs/vertige/lots/images/", import.meta.url);
const IMAGES = new URL("../test-results/gif-v1/", import.meta.url);
const chemin = (u: URL): string => u.pathname.replace(/^\/([A-Za-z]:)/, "$1");
const logiciel = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];
const sansLimite = ["--disable-frame-rate-limit", "--disable-gpu-vsync"];
const golden = JSON.parse(readFileSync(new URL("../../../packages/vertige-sim/test/fixtures/golden-vertige.json", import.meta.url), "utf8")) as { rediffusions: { nom: string; code: string }[] };
const reference = (nom: string): Commande[] => decoderRediffusion(golden.rediffusions.find((r) => r.nom === nom)!.code).commandes;

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
const montrer = async (page: Page, nom: string): Promise<void> => {
  await page.waitForTimeout(500);
  await page.screenshot({ path: chemin(new URL(nom, SORTIE)) });
};

test("captures : la salle de la gravité, le plafond, un portail, et les images des GIF", async () => {
  test.setTimeout(1_800_000);
  mkdirSync(chemin(SORTIE), { recursive: true });
  mkdirSync(chemin(IMAGES), { recursive: true });
  const browser = await chromium.launch({ args: logiciel });

  // La salle de la gravité au départ (surfaces à gauche, orbes à droite), puis la marche au plafond : on va sous le plafond marqué, on saute, on marche la tête en bas.
  let page = await ouvrir(browser, "/?debug&manuel&tactile=0&scenario=gravite", 1280, 720);
  await page.evaluate(() => window.__jeu.avancer(3));
  await montrer(page, "lot-V1-gravite-salle.png");
  const versPlafond = jouerCibles("gravite", [[-12, 0, 0]], { apres: 0, maxPas: 600 }).commandes;
  const plafond: Commande[] = [...versPlafond, { k: T_SAUT, dl: 0, dt: 0 }, ...Array.from({ length: 70 }, () => ({ k: 0, dl: 0, dt: 0 })), ...Array.from({ length: 150 }, () => ({ k: 1, dl: 0, dt: 0 }))];
  await page.evaluate((c) => window.__vertige.jouer(c), plafond);
  await page.evaluate((n) => window.__jeu.avancer(n), plafond.length);
  await montrer(page, "lot-V1-gravite-plafond.png");
  await page.context().close();

  // Un portail : de loin, de près, et de l'autre côté.
  const parcours = reference("portails-parcours");
  page = await ouvrir(browser, "/?debug&manuel&tactile=0&scenario=portails", 1280, 720);
  await page.evaluate((c) => window.__vertige.jouer(c), parcours);
  await page.evaluate(() => window.__jeu.avancer(150));
  await montrer(page, "lot-V1-portail-de-loin.png");
  await page.evaluate(() => window.__jeu.avancer(65));
  await montrer(page, "lot-V1-portail-de-pres.png");
  await page.evaluate(() => window.__jeu.avancer(30));
  await montrer(page, "lot-V1-portail-apres.png");
  await page.context().close();

  // Les images des GIF : la scène seule, 8 pas de simulation entre deux images (15 images par seconde), 640 × 360.
  for (const [dossier, scenario, nom] of [["portails", "portails", "portails-parcours"], ["cube", "cube", "cube-six-directions"]] as const) {
    const c = reference(nom);
    page = await ouvrir(browser, `/?debug&manuel&tactile=0&scenario=${scenario}`, 640, 400);
    await page.evaluate((x) => window.__vertige.jouer(x), c);
    const scene = page.locator(".vertige-scene");
    mkdirSync(chemin(new URL(`${dossier}/`, IMAGES)), { recursive: true });
    let n = 0;
    for (let t = 0; t < c.length; t += 8) {
      await page.evaluate(() => window.__jeu.avancer(8));
      await scene.screenshot({ path: chemin(new URL(`${dossier}/f${String(n++).padStart(3, "0")}.png`, IMAGES)), animations: "allow" });
    }
    await page.context().close();
  }
  await browser.close();
});

interface Mesure {
  config: string;
  environnement: string;
  ips: number;
  appels: number;
  triangles: number;
  fenetres: number;
}
const mesures: Mesure[] = [];

async function mesurer(browser: Browser, environnement: string, largeur: number, hauteur: number, ralentissement: number): Promise<void> {
  const configs: [string, string][] = [
    ["portail à l'écran, halo et ombres", "scenario=portails"],
    ["portail à l'écran, sans halo", "scenario=portails&bloom=0"],
    ["portail à l'écran, sans ombres", "scenario=portails&ombres=0"],
    ["portail à l'écran, sans halo ni ombres", "scenario=portails&bloom=0&ombres=0"],
    ["sans portail (salle de la gravité), halo et ombres", "scenario=gravite"],
    ["sans portail (salle de la gravité), sans halo", "scenario=gravite&bloom=0"],
  ];
  const parcours = reference("portails-parcours").slice(0, 150);
  for (const [nom, q] of configs) {
    const page = await ouvrir(browser, `/?debug&manuel&fps&tactile=0&${q}`, largeur, hauteur);
    await page.evaluate((c) => window.__vertige.jouer(c), parcours);
    await page.evaluate(() => window.__jeu.avancer(150)); // devant le premier portail, à six mètres
    await page.evaluate(() => window.__jeu.manuel(false)); // puis la partie tourne seule, sans rien demander à la souris
    if (ralentissement > 1) await (await page.context().newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate: ralentissement });
    await page.waitForTimeout(2500); // le premier tour de shaders
    const ips = await page.evaluate(
      () =>
        new Promise<number>((fin) => {
          let n = 0;
          const t0 = performance.now();
          const f = (): void => {
            n++;
            if (performance.now() - t0 < 8000) requestAnimationFrame(f);
            else fin((n * 1000) / (performance.now() - t0));
          };
          requestAnimationFrame(f);
        }),
    );
    const texte = (await page.locator(".vertige-mesure").textContent()) ?? "";
    const m = /(\d+) appels · (\d+) k tri/.exec(texte);
    const fenetres = await page.evaluate(() => window.__vertige.monde.fenetres?.dessinees ?? 0);
    mesures.push({ config: nom, environnement, ips: Math.round(ips * 10) / 10, appels: Number(m?.[1] ?? 0), triangles: Number(m?.[2] ?? 0) * 1000, fenetres });
    await page.context().close();
  }
}

test("images par seconde avec un portail à l'écran : la machine de la PR, puis un portable moyen simulé (processeur ralenti)", async () => {
  test.setTimeout(1_800_000);
  const b1 = await chromium.launch({ args: [...logiciel, ...sansLimite] });
  await mesurer(b1, "machine de la PR (aucun GPU : rendu logiciel), 960 × 540", 960, 540, 1);
  await b1.close();
  const b2 = await chromium.launch({ args: [...logiciel, ...sansLimite] });
  await mesurer(b2, "portable simulé : rendu logiciel, processeur ÷ 4, 960 × 540", 960, 540, 4);
  await b2.close();
  mkdirSync(chemin(IMAGES), { recursive: true });
  writeFileSync(chemin(new URL("fps.json", IMAGES)), JSON.stringify(mesures, null, 2));
  expect(mesures.length).toBe(12);
  void niveau;
  void Partie;
});
