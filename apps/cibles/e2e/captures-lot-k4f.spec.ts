import { CIBLES_GENERATOR_VERSION, CIBLES_SIM_VERSION } from "@cdj/cibles-sim";
import { test } from "@playwright/test";
import { ESSAIS_CIBLES } from "../../api/scripts/cibles-essais";
import { API, appareil, jouerLeJour, lancer } from "./appareil";

// Outil (jamais en CI : `CAPTURES=1`) — les captures du lot K4f pour Nathan : l'accueil en portrait et en paysage, une partie en cours, l'arrivée, le classement « Amis ». Dossier : `CAPTURES_DIR` (défaut `captures-k4f`).
const DOSSIER = process.env.CAPTURES_DIR ?? "captures-k4f";
const JOUR_CIVIL = Date.UTC(2026, 10, 6) / 86_400_000;
test("captures du lot K4f", async ({ browser }) => {
  for (const [nom, v] of [["accueil-portrait", { width: 390, height: 844 }], ["accueil-paysage", { width: 844, height: 390 }]] as const) {
    const { context, page } = await appareil(browser, `/?api=${API}&debug&manuel&tactile=0`);
    await page.setViewportSize(v);
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${DOSSIER}/${nom}.png` });
    await context.close();
  }
  for (const [nom, variante] of [["Carla", 3], ["Denis", 5]] as const) {
    const id = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    await fetch(`${API}/api/cibles/submit`, { method: "POST", headers: { "Content-Type": "application/json", "X-Player-Id": id }, body: JSON.stringify({ replay: ESSAIS_CIBLES.partie(JOUR_CIVIL, { simVersion: CIBLES_SIM_VERSION, generatorVersion: CIBLES_GENERATOR_VERSION }, variante).rediffusion, name: nom }) });
  }
  const { context, page } = await appareil(browser);
  await page.setViewportSize({ width: 844, height: 390 });
  await lancer(page);
  await page.evaluate(() => window.__jeu.avancer(160));
  await page.screenshot({ path: `${DOSSIER}/partie.png` });
  await page.locator("#jeu-hud-pause").click();
  await page.locator("#jeu-pause-recommencer").click(); // une partie neuve : les touches de `jouerLeJour` partent du tick 0
  await jouerLeJour(page, 15, [3, 4]);
  await page.locator("#jeu-pseudo").fill("Eve");
  await page.locator("#jeu-pseudo-ok").click();
  await page.locator("#jeu-fin-rang").filter({ hasText: " sur " }).waitFor();
  await page.screenshot({ path: `${DOSSIER}/arrivee.png` });
  await page.locator("#jeu-fin-accueil").click();
  await page.waitForSelector("#jeu-tout-le-classement:not([hidden])");
  await page.locator("#jeu-tout-le-classement").click();
  await page.locator("#jeu-classement-liste .rang__bouton", { hasText: "Carla" }).click();
  await page.locator(".dj-feuille__principal").click();
  await page.locator(".dj-feuille__fermer").click();
  await page.locator('[data-filtre="amis"]').click();
  await page.locator("#jeu-classement-liste .rang").nth(1).waitFor();
  await page.screenshot({ path: `${DOSSIER}/classement-amis.png` });
  await context.close();
});
