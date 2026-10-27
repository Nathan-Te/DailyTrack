import { expect, hasWebGL, newClockedContext, test, TODAY, type Page } from "./fixtures";
import { dailyCircuit, encodeReplay, runPilot } from "@cdj/sim";

// Retouche 40b : la voiture du jeu. Sans choix, la civile ; un choix enregistré (`cdj:track:garage`) d'une voiture non débloquée retombe sur la
// civile en orange de Track ; `?voiture=<id>&couleur=<n>&motif=<m>` (recette et aperçus) montre une autre voiture sans rien vérifier ni
// enregistrer, et la course jouée ainsi **n'est ni envoyée au classement ni enregistrée** (comme `?tune`). Rendu 3D : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(150_000);

const API = "http://127.0.0.1:8787";
const circuit = dailyCircuit(TODAY);
const code = encodeReplay(runPilot(circuit.track, { grip: 1 }).replay);

async function ouvrir(page: Page, adresse: string) {
  await page.goto(adresse);
  test.skip(!(await hasWebGL(page)), "ce navigateur n'a pas WebGL : le jeu ne démarre pas");
  await page.waitForFunction(() => window.__cdj?.phase === "countdown" || window.__cdj?.phase === "racing");
}

test("?voiture=proto&couleur=5&motif=flancs : le Proto, chargé à la demande ; la course n'est ni envoyée ni enregistrée", async ({ browser }) => {
  const context = await newClockedContext(browser, { viewport: { width: 1000, height: 560 } });
  const page = await context.newPage();
  const envois: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST" && new URL(r.url()).pathname.startsWith("/api/")) envois.push(new URL(r.url()).pathname);
  });
  const charges: string[] = [];
  page.on("response", (r) => {
    const m = /assets\/(modele[ABC]|materiaux2)-/.exec(r.url());
    if (m) charges.push(m[1]!);
  });
  // L'accueil ouvert (jeu gelé) : le Proto, chargé à la demande, remplace la civile. Sans accueil, avec `timescale=6`, le décompte ne dure
  // qu'une demi-seconde : sur un runner lent le morceau arrivait après le départ, et la voiture n'est jamais remplacée en course (voulu).
  await ouvrir(page, `/?home=1&debug&timescale=6&quality=1&voiture=proto&couleur=5&motif=flancs&api=${encodeURIComponent(API)}`);
  await expect.poll(() => page.evaluate(() => window.__cdj.voiture.aJour), { timeout: 60_000 }).toBe(true);
  const v = await page.evaluate(() => window.__cdj.voiture);
  expect(v.essai).toEqual({ id: "proto", couleur: 5, motif: "flancs", teinteMotif: 0 });
  expect(v.choix).toEqual(v.essai);
  expect(v.counted).toBe(false);
  expect(v.maillages).toBe(6);
  expect(v.stats.remplacees).toBe(1);
  // Seul le modèle affiché est téléchargé (qualité figée à 1 : pas de matériaux des paliers 2 et 3).
  expect(charges).toEqual(["modeleC"]);
  await expect(page.locator("#tuned")).toContainText("Voiture d'essai (Dragonfly)"); // lot 41 : noms en anglais dans les deux langues (décision de Nathan)
  await page.locator("#home-daily").click();
  await expect(page.locator("#home")).toBeHidden();
  await page.evaluate((c) => window.__cdj.autoplay(c), code);
  await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 90_000 });
  await expect(page.locator("#finish")).toContainText("Voiture d'essai : course non classée ni enregistrée");
  await expect(page.locator("#finish .online form")).toHaveCount(0);
  // Rien d'envoyé au classement, rien d'enregistré.
  await page.waitForTimeout(1500); // rien ne doit partir pendant ce temps
  expect(envois.filter((p) => p === "/api/submit")).toEqual([]);
  expect(await page.evaluate((id) => localStorage.getItem(`cdj:best:${id}`), circuit.track.id)).toBeNull();
  await context.close();
});
