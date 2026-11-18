import { test, type Page } from "@playwright/test";
import { parseDay } from "@cdj/core";
import { CASE, LARGEUR_MORCEAU, CLIGNOTANT, LIGNES, dailyGravity, jouerRobot, planDuJour, terrainDuJour } from "@cdj/gravity-sim";
import { appareil, lancer } from "./appareil";

// Lot GR7 — les captures des trois dangers et du passage de la Nuit : un outil, jamais en CI (`testIgnore` de la configuration) ; `CAPTURES=<dossier> npx playwright test captures-lot-gr7` (après `npm run build -w @cdj/gravity`).
// Chaque image est prise **à l'instant voulu** : on calcule avec la simulation le pas où le danger est à l'écran (la scie au milieu de son rail, le sol qui craque, le laser qui brûle, le bloc de la Nuit qui prévient) et on y avance la partie.
const DOSSIER = process.env.CAPTURES;
const JOUR = "2026-11-17";
const jour = parseDay(JOUR)!;
const contenu = dailyGravity(jour);
const terrain = terrainDuJour(contenu);
const plan = planDuJour(jour, terrain.regles!, contenu.ordre);

/** Le pas où la partie d'essai commence quand on demande `?morceau=n` (comme `niveau.ts` : le robot joue jusqu'à douze colonnes avant le morceau). */
function departAvant(n: number): number {
  const cible = Math.max(1, n * LARGEUR_MORCEAU - 3 - 12);
  let depart = 0;
  jouerRobot(terrain, { maxDistance: cible, arrets: [cible], surPoint: (_d, p) => void (depart = p.tick) });
  return depart;
}
/** Le pas où le joueur arrive à la colonne `c` du morceau `m`. */
const arrivee = (m: number, c: number): number => plan.trajectoire.tickOuLeJoueurArrive((m * LARGEUR_MORCEAU + c) * CASE);

async function photographier(page: Page, adresse: string, morceau: number, pasCible: number, fichier: string, browser: Parameters<typeof appareil>[0]): Promise<void> {
  const { context, page: p } = await appareil(browser, adresse, true, { deviceScaleFactor: 1 });
  await p.setViewportSize({ width: 1280, height: 720 });
  await lancer(p);
  const avance = Math.max(0, pasCible - departAvant(morceau));
  await p.evaluate((n) => window.__jeu.avancer(n), avance);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${DOSSIER}/${fichier}` });
  await context.close();
  void page;
}

test("capture — les scies (la première, à l'écran)", async ({ browser, page }) => {
  test.skip(!DOSSIER, "CAPTURES=<dossier> pour produire les images");
  const m = plan.premierMorceauDuDanger("scies");
  const sc = terrain.morceau(m).scies[0]!;
  const col = Math.trunc((sc.x0 / CASE + sc.x1 / CASE) / 2) - m * LARGEUR_MORCEAU;
  await photographier(page, `/?debug&manuel&tactile=0&danger=scies&robot&jour=${JOUR}`, m, arrivee(m, col) - 70, "scies.png", browser);
});
test("capture — le sol fragile qui craque (un joueur qui ne fait rien s'y pose)", async ({ browser, page }) => {
  test.skip(!DOSSIER, "CAPTURES=<dossier> pour produire les images");
  const m = plan.premierMorceauDuDanger("fragiles");
  const mo = terrain.morceau(m);
  let a = 0;
  for (let c = 0; c < LARGEUR_MORCEAU; c++) if (mo.cases[c * LIGNES + 10] === 10 || mo.cases[c * LIGNES + 1] === 10) { a = c; break; }
  await photographier(page, `/?debug&manuel&tactile=0&danger=fragiles&jour=${JOUR}`, m, arrivee(m, a) + 34, "fragiles.png", browser);
});
test("capture — le laser qui brûle", async ({ browser, page }) => {
  test.skip(!DOSSIER, "CAPTURES=<dossier> pour produire les images");
  const m = plan.premierMorceauDuDanger("lasers");
  const l = terrain.morceau(m).lasers[0]!;
  await photographier(page, `/?debug&manuel&tactile=0&danger=lasers&robot&jour=${JOUR}`, m, arrivee(m, l.c) - 24, "lasers.png", browser);
});
test("capture — la Nuit : le bloc prévient avant de s'éteindre", async ({ browser, page }) => {
  test.skip(!DOSSIER, "CAPTURES=<dossier> pour produire les images");
  const m = 77; // une section de la Nuit du 2026-11-17 (`special-nuit`)
  const mo = terrain.morceau(m);
  const cols: number[] = [];
  for (let c = 0; c < LARGEUR_MORCEAU; c++) for (let r = 0; r < LIGNES; r++) if (mo.cases[c * LIGNES + r] === CLIGNOTANT) cols.push(c);
  const milieu = arrivee(m, Math.trunc((Math.min(...cols) + Math.max(...cols) + 1) / 2));
  await photographier(page, `/?debug&manuel&tactile=0&morceau=${m}&robot&jour=${JOUR}`, m, milieu - 14, "nuit-avertissement.png", browser);
});
