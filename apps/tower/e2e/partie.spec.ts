import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Lot T1 — LE test de navigateur du nouveau parcours (règle R13 : un unitaire d'abord, un seul e2e par parcours de joueur ; les règles de la partie sont dans
// `packages/tower-sim/test/partie.test.ts`). Chromium seulement : le déterminisme dans les trois navigateurs est celui du banc (`determinisme.spec.ts`).
// Le parcours : charger `?scenario=essai`, jouer au clavier, voir le HUD changer, perdre des vies, atteindre l'écran de fin, « Rejouer » et retrouver le fantôme de la partie.

interface Porte {
  vue(): { phase: string; numero: number; vies: number; hauteurMm: number; tombees: number; pieces: { x: number; rot: number; etat: string }[]; active: number };
  manuel(oui?: boolean): void;
  avancer(n: number, commandes?: number): void;
  fantome(): number;
  etatFantome(): { etat: string; meilleure: boolean; diamant: boolean };
  rediffusion(): string | null;
  partie(): { resultat(): { hauteurMm: number } | null };
  contenu(): { theme?: string };
  medailles(): { medailles: { auteur: number; or: number; argent: number; bronze: number } | null; provisoire: boolean; enCalcul: boolean };
}
declare global {
  interface Window {
    __tower: Porte;
  }
}

/** Ouvre le jeu d'un jour par l'accueil : l'aide « Comment jouer » est déjà vue (sinon elle s'ouvre au premier lancement), puis JOUER (le jeu et la physique se chargent à la demande). */
async function jouerLeJour(page: import("@playwright/test").Page, adresse: string): Promise<void> {
  await page.addInitScript(() => localStorage.setItem("tower:aide:vu", "1"));
  await page.goto(adresse);
  await page.locator("#accueil-jouer").click();
  await page.waitForSelector("html[data-ready=true] .tower__scene");
}
const GAUCHE = 1;
const DESCENDRE = 8;

test("une partie de la suite d'essai : clavier, HUD, vies perdues, écran de fin, rejouer et fantôme", async ({ page }) => {
  await page.goto("/?scenario=essai&tactile=0");
  await page.waitForSelector("html[data-ready=true]");
  await expect(page.locator(".tower__scene")).toBeVisible();

  // Le HUD au départ : 0 m, pièce 1/40, trois vies ; la plaque « Suivante » ; pas d'objectif de médaille (lot T3) ; pas de boutons tactiles (souris).
  await expect(page.locator(".bande__hauteur")).toHaveText(/^0[,.]000\s*m$/i);
  await expect(page.locator(".bande__pieces")).toHaveText("1/40");
  await expect(page.locator(".bande__vies")).toHaveAttribute("aria-label", /3/);
  await expect(page.locator(".suivante")).toBeVisible();
  await expect(page.locator(".commande--tourner")).toBeHidden();
  await expect(page.locator("#fin-ecran")).toBeHidden();

  // Au clavier : ← déplace la pièce active (un maintien répète), ↑ la fait pivoter.
  const avant = await page.evaluate(() => ({ x: window.__tower.vue().pieces[0]!.x, rot: window.__tower.vue().pieces[0]!.rot }));
  await page.keyboard.down("ArrowLeft");
  await page.waitForFunction((x) => window.__tower.vue().pieces[0]!.x <= x - 1.5, avant.x);
  await page.keyboard.up("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  await page.waitForFunction((rot) => window.__tower.vue().pieces[0]!.rot !== rot, avant.rot);

  // Puis le test avance lui-même, tick par tick (aucune attente sur une durée) : trois pièces posées au centre, le HUD compte.
  await page.evaluate(() => window.__tower.manuel(true));
  await page.evaluate((d) => {
    const T = window.__tower;
    for (let i = 0; i < 3000 && T.vue().numero < 3; i++) T.avancer(1, d);
  }, DESCENDRE);
  await expect(page.locator(".bande__pieces")).toHaveText("3/40");
  await expect.poll(() => page.locator(".bande__hauteur").textContent()).not.toMatch(/^0[,.]000/);

  // Une pièce poussée dans le vide : une vie de moins, une seule, et le HUD le dit.
  const viesAvant = await page.evaluate(() => window.__tower.vue().vies);
  await page.evaluate(
    ([g, d]) => {
      const T = window.__tower;
      const id = T.vue().active;
      for (let i = 0; i < 4000 && T.vue().pieces[id]!.etat !== "perdue"; i++) T.avancer(1, i < 20 ? g! : d!);
    },
    [GAUCHE, DESCENDRE],
  );
  expect(await page.evaluate(() => window.__tower.vue().vies)).toBe(viesAvant - 1);
  await expect(page.locator(".bande__vies")).toHaveAttribute("aria-label", new RegExp(String(viesAvant - 1)));

  // On va jusqu'à la fin : chaque pièce part dans le vide jusqu'à la dernière vie.
  await page.evaluate(
    ([g, d]) => {
      const T = window.__tower;
      let id = -1;
      let k = 0;
      for (let i = 0; i < 40000 && T.vue().phase !== "fini"; i++) {
        const a = T.vue().active;
        if (a !== id) {
          id = a;
          k = 0;
        }
        T.avancer(1, k++ < 20 ? g! : d!);
      }
    },
    [GAUCHE, DESCENDRE],
  );
  await expect(page.locator("#fin-ecran")).toBeVisible();
  await expect(page.locator(".fin__hauteur")).not.toBeEmpty();
  await expect(page.locator("#fin-posees")).toContainText("/40");
  await expect(page.locator("#fin-tombees")).toHaveText("3");
  await expect(page.locator("#fin-rejouer")).toBeFocused();
  // La partie qui vient de finir est ta meilleure : on en garde la REDIFFUSION, et la silhouette du fantôme est l'état final de cette partie rejouée (calculée tranche par tranche, juste après la fin).
  await expect.poll(() => page.evaluate(() => window.__tower.rediffusion())).toMatch(/^[A-Za-z0-9_-]{20,}$/);
  await expect.poll(() => page.evaluate(() => window.__tower.etatFantome().meilleure)).toBe(true);

  // « Rejouer » : une nouvelle partie, le fantôme de la précédente est derrière la tour.
  await page.locator("#fin-rejouer").click();
  await expect(page.locator("#fin-ecran")).toBeHidden();
  await expect(page.locator(".bande__pieces")).toHaveText("1/40");
  expect(await page.evaluate(() => window.__tower.vue().vies)).toBe(3);
  expect(await page.evaluate(() => window.__tower.fantome())).toBeGreaterThan(0);
});

// Lot T3 — les médailles et le bot. Un jour PRÉPARÉ (deux sont dans `packages/tower-sim/test/fixtures/jours/`, préparés par `npm run preparer:tower` ; aucun n'est commité dans l'application) est
// servi à la place de `jours/2026-11-06.json` : médailles du fichier, preuve de l'auteur (hors production, pour `&bot`), thème du jour (banquise).
const JOUR_PREPARE = readFileSync(new URL("../../../packages/tower-sim/test/fixtures/jours/2026-11-06.json", import.meta.url), "utf8");
const MEDAILLES = (JSON.parse(JOUR_PREPARE) as { medailles: { auteur: number; bronze: number } }).medailles;
const DIAMANT = MEDAILLES.auteur;
/** Un seuil en millimètres tel que le HUD l'écrit (« 23,090 m » en français, « 23.090 m » en anglais). */
const seuil = (mm: number): RegExp => new RegExp(`${String(mm).slice(0, -3)}[,.]${String(mm).slice(-3)}`);

test("un jour préparé : l'objectif de médaille dans le HUD, le thème du jour, puis le bloc « Médailles du jour » à la fin", async ({ page }) => {
  await page.route("**/jours/2026-11-06.json", (r) => r.fulfill({ contentType: "application/json", body: JOUR_PREPARE }));
  await jouerLeJour(page, "/?seed=2026-11-06&tactile=0");
  expect(await page.evaluate(() => window.__tower.contenu().theme)).toBe("banquise");
  // L'objectif : la première médaille (Bronze) et son seuil en mètres, d'après le fichier, sans « Médailles en calcul… ».
  await expect(page.locator(".objectif")).toBeVisible();
  await expect(page.locator(".objectif")).toContainText(/Bronze/i);
  await expect(page.locator(".objectif")).toContainText(seuil(MEDAILLES.bronze));
  expect(await page.evaluate(() => window.__tower.medailles())).toMatchObject({ provisoire: false, enCalcul: false });
  // Une partie menée au bout, au centre, tout droit : l'écran de fin porte le bloc des médailles (quatre cases) et la médaille obtenue.
  await page.evaluate(() => {
    const T = window.__tower;
    T.manuel(true);
    for (let i = 0; i < 40000 && T.vue().phase !== "fini"; i++) T.avancer(1, 8);
  });
  await expect(page.locator("#fin-ecran")).toBeVisible();
  await expect(page.locator("#fin-medailles .dj-medaille")).toHaveCount(4);
  await expect(page.locator("#fin-medailles-note")).toContainText(/encore|Diamant/i);
});

test("?bot : le bot rejoue la preuve du jour et finit exactement sur son Diamant", async ({ page }) => {
  await page.route("**/jours/2026-11-06.json", (r) => r.fulfill({ contentType: "application/json", body: JOUR_PREPARE }));
  await jouerLeJour(page, "/?seed=2026-11-06&bot&tactile=0");
  await page.waitForFunction(() => window.__tower.vue().phase === "jeu");
  await page.evaluate(() => {
    const T = window.__tower;
    T.manuel(true);
    for (let i = 0; i < 60000 && T.vue().phase !== "fini"; i++) T.avancer(1);
  });
  expect(await page.evaluate(() => window.__tower.partie().resultat()!.hauteurMm)).toBe(DIAMANT);
  await expect(page.locator("#fin-ecran")).toBeVisible();
  await expect(page.locator("#fin-medailles-session")).toContainText(/Diamant du jour|Today's Diamond/);
  await expect(page.locator("#fin-medaille")).toHaveText(/Diamant/i);
});
