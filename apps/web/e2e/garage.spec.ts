import { expect, newClockedContext, test, type Page, TODAY } from "./fixtures";
import { dailyCircuit, dailyTrackId, encodeReplay, etatGarage, formatDay, runPilot } from "@cdj/sim";
import { auditAxe, focusSur } from "./axe";

// Lot 41 : le Garage de Track — dans le jeu, sur la scène, chargé à la demande ; les déblocages viennent du serveur (ou du joueur de
// démonstration, `?api=demo`) ; le choix est enregistré et la course suivante l'utilise ; une voiture verrouillée ne se choisit pas ; à l'arrivée,
// une ligne annonce la voiture qu'une course vient de débloquer. Le rendu 3D demande WebGL : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(150_000);

const CLE = "cdj:track:garage";
const voiture = (page: Page) => page.evaluate(() => window.__cdj.voiture);

async function accueil(page: Page, query = "?api=demo&debug&home=1") {
  await page.goto(`/${query}`);
  await page.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
  await expect(page.locator("body")).toHaveClass(/home/);
}

test("ouvrir le Garage depuis l'accueil : voitures débloquées et verrouillées, progression ; une voiture verrouillée ne se choisit pas ; couleur et motif ; la course suivante a la voiture choisie", async ({ page }) => {
  await accueil(page);
  await page.locator("#home-garage").click();
  const garage = page.locator("#garage");
  await expect(garage).toBeVisible();
  // Le joueur de démonstration : la Sparrow et la Weasel (3 ors), la Moray (4/10 jours) et la Dragonfly (0/1 auteur) à gagner.
  await expect(garage.locator('[data-voiture="civile"]')).toContainText("Ta voiture");
  await expect(garage.locator('[data-voiture="evolution"]')).toContainText("WEASEL", { ignoreCase: true });
  await expect(garage.locator('[data-voiture="gt"]')).toContainText("4/10");
  await expect(garage.locator('[data-voiture="proto"]')).toContainText("0/1");
  await expect(garage.locator(".etiquette__sous-titre")).toHaveText(/2 voitures sur 4/i);
  // Rien d'autre que le Garage ne charge le Garage : il n'était pas là avant le clic (chargé à la demande).
  expect((await voiture(page)).garage).toMatchObject({ debloquees: ["civile", "evolution"], horsLigne: false });

  // Une voiture verrouillée : sa silhouette et sa condition, jamais choisie.
  await garage.locator('[data-voiture="gt"]').click();
  await expect(page.locator(".garage-fiche")).toContainText("Termine 10 circuits du jour.");
  await expect(page.locator(".garage-fiche")).toContainText("4/10 jours");
  expect((await voiture(page)).choix.id).toBe("civile");
  expect(await page.evaluate((k) => localStorage.getItem(k), CLE)).not.toContain('"id":"gt"');

  // Une voiture débloquée : touchée, elle est à toi ; puis la couleur et le motif (enregistrés tout de suite, voiture repeinte).
  await garage.locator('[data-voiture="evolution"]').click();
  await expect(garage.locator('[data-voiture="evolution"]')).toContainText("Ta voiture");
  await garage.locator('[data-couleur="4"]').click();
  await expect(garage.locator('[data-couleur="4"]')).toHaveAttribute("aria-checked", "true");
  await garage.locator('[data-motif="flancs"]').click();
  await expect(garage.locator('[data-motif="flancs"]')).toHaveAttribute("aria-checked", "true");
  const choix = { id: "evolution", couleur: 4, motif: "flancs" };
  expect((await voiture(page)).choix).toEqual(choix);
  expect(JSON.parse((await page.evaluate((k) => localStorage.getItem(k), CLE))!)).toMatchObject(choix);
  await expect.poll(async () => (await voiture(page)).aJour, { timeout: 20_000 }).toBe(true);

  await auditAxe(page, "track-garage-fr", "#garage");

  // « ‹ TRACK » (ou Échap) ferme le Garage : retour à l'accueil, le focus revient au bouton.
  await page.keyboard.press("Escape");
  await expect(garage).toBeHidden();
  await expect(page.locator("#home")).toBeVisible();
  expect(await focusSur(page)).toBe("home-garage");

  // La course : c'est la voiture choisie (le modèle construit est celui voulu, dans sa couleur et son motif).
  await page.locator("#home-daily").click();
  await page.waitForFunction(() => window.__cdj.phase === "countdown" || window.__cdj.phase === "racing");
  const v = await voiture(page);
  expect(v.choix).toEqual(choix);
  expect(v.aJour).toBe(true);
  expect(v.counted).toBe(true); // une voiture du Garage court classée (contrairement à `?voiture=`)

  // Relu au chargement suivant.
  await page.reload();
  await page.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
  expect((await voiture(page)).choix).toEqual(choix);
});

test("dans la pause : « Garage » ouvre le Garage sur la scène, Échap le ferme et rend la pause", async ({ page }) => {
  await accueil(page);
  await page.locator("#home-daily").click();
  await page.waitForFunction(() => window.__cdj.phase === "countdown" || window.__cdj.phase === "racing");
  await page.keyboard.press("Escape");
  await expect(page.locator("#pause-garage")).toBeVisible();
  await page.locator("#pause-garage").click();
  await expect(page.locator("#garage")).toBeVisible();
  await expect(page.locator("#pause")).toBeHidden(); // un seul voile : la pause s'efface sous le Garage
  await page.keyboard.press("Escape");
  await expect(page.locator("#garage")).toBeHidden();
  await expect(page.locator("#pause-resume")).toBeVisible();
});

test("en anglais : les noms des voitures sont les mêmes, les textes du Garage sont traduits", async ({ browser }) => {
  const context = await newClockedContext(browser, { locale: "en-US" });
  const page = await context.newPage();
  await accueil(page);
  await page.locator("#home-garage").click();
  await expect(page.locator("#garage .etiquette__sous-titre")).toHaveText(/2 of 4 cars/i);
  await expect(page.locator('#garage [data-voiture="civile"]')).toContainText("Your car");
  await expect(page.locator('#garage [data-voiture="evolution"]')).toContainText("WEASEL", { ignoreCase: true });
  await page.locator('#garage [data-voiture="proto"]').click();
  await expect(page.locator(".garage-fiche")).toContainText("Beat the Author time on a daily track.");
  await auditAxe(page, "track-garage-en", "#garage");
});

test("hors connexion : le Garage s'ouvre quand même (la civile et ce que le navigateur sait), la progression n'est pas inventée", async ({ page }) => {
  const API = "https://api.garage-hors-ligne.test";
  await page.route(`${API}/**`, (route) => route.abort("internetdisconnected"));
  await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ debloquees: ["gt"] })), CLE);
  await accueil(page, `?api=${encodeURIComponent(API)}&debug&home=1`);
  await page.locator("#home-garage").click();
  await expect(page.locator("#garage")).toBeVisible();
  // La ligne arrive avec la réponse (ici : la panne) de `GET /api/garage` ; un appel à l'API attend au plus 8 s (`@cdj/profile`, TIMEOUT_MS).
  await expect(page.locator(".garage-hors-ligne")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#garage [data-voiture="gt"]')).not.toContainText("Verrouillée"); // « Nouveau » : jamais vue au Garage
  await expect(page.locator('#garage [data-voiture="proto"]')).toContainText("Verrouillée");
  await expect(page.locator('#garage [data-voiture="proto"]')).not.toContainText("/");
  await page.locator('#garage [data-voiture="gt"]').click();
  expect((await voiture(page)).choix.id).toBe("gt");
});

test("à l'arrivée : la course qui débloque une voiture l'annonce en une ligne, « Voir au Garage » l'ouvre sur elle sans la choisir", async ({ page }) => {
  // Un serveur d'essai dans la page (aucune base partagée : le classement de 8787 sert à d'autres specs) : le circuit du jour, un envoi accepté
  // dont la réponse débloque la Weasel ; le reste : rien.
  const API = "https://api.garage.test";
  const circuit = dailyCircuit(TODAY);
  const run = runPilot(circuit.track, { grip: 0.9 });
  const date = formatDay(TODAY);
  const progres = { jours: 3, or: 3, auteur: 0 };
  await page.route(`${API}/**`, async (route) => {
    const url = new URL(route.request().url());
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body), headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" } });
    if (route.request().method() === "OPTIONS") return json({});
    if (url.pathname === `/api/day/${date}`) return json({ date, number: circuit.number, trackId: dailyTrackId(TODAY), variant: 0, theme: null });
    if (url.pathname === "/api/submit")
      return json({ accepted: true, improved: true, ms: run.finishMs, splits: [], respawns: 0, bestMs: run.finishMs, rank: 1, participants: 1, medal: "gold", garage: { progres, voitures: etatGarage(progres), nouvelles: ["evolution"] } });
    if (url.pathname.endsWith("/leaderboard")) return json({ date, participants: 1, top: [], me: null });
    if (url.pathname === "/api/garage") return json({ progres, voitures: etatGarage(progres) });
    return json({ error: "not_found" }, 404);
  });
  await page.addInitScript(() => localStorage.setItem("cdj:name", "Garagiste"));
  await page.goto(`/?debug&timescale=6&api=${encodeURIComponent(API)}`);
  await page.waitForFunction(() => window.__cdj?.phase === "countdown" || window.__cdj?.phase === "racing");
  await page.evaluate((c) => window.__cdj.autoplay(c), encodeReplay(run.replay));
  await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 90_000 });
  const ligne = page.locator("#finish .arrivee__garage");
  await expect(ligne).toBeVisible({ timeout: 20_000 });
  await expect(ligne).toContainText("Nouvelle voiture :");
  await expect(ligne).toContainText("Weasel");
  await page.locator("#finish-garage").click();
  await expect(page.locator("#garage")).toBeVisible();
  await expect(page.locator('#garage [data-voiture="evolution"]')).toHaveAttribute("aria-current", "true");
  await expect(page.locator(".garage-fiche")).toContainText("WEASEL", { ignoreCase: true });
  expect((await voiture(page)).choix.id).toBe("civile"); // montrée, pas choisie : c'est au joueur de la toucher
  await page.keyboard.press("Escape");
  await expect(page.locator("#finish")).toBeVisible();
});
