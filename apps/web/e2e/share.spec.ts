import { expect, test, type Page, TODAY } from "./fixtures";
import { GENERATOR_VERSION, SIM_VERSION, dailyCircuit, encodeReplay, medalFor, runPilot } from "@cdj/sim";
import { shareLine } from "../src/share";
import { setLangue } from "../src/i18n";

// Ce processus Node a un `navigator` (langue de la machine) : la ligne attendue se calcule en français, comme celle du navigateur de test (`locale: "fr-FR"`).
void setLangue("fr", { ecrire: false });

// Écran d'arrivée : ligne à partager, copie, archives. Le rendu 3D demande WebGL : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(120_000);

const day = TODAY;
const circuit = dailyCircuit(day);
const run = runPilot(circuit.track, { grip: 0.9 });
const code = encodeReplay(run.replay);
const medal = medalFor(run.finishMs, circuit.medals);

async function finishRace(page: Page, url = "/?debug&timescale=6") {
  await page.goto(url);
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.evaluate((c) => window.__cdj.autoplay(c), code);
  await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 90_000 });
}

test("l'écran d'arrivée donne la ligne à partager, et le bouton la copie avec l'adresse du jeu", async ({ page, context, baseURL }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await finishRace(page);
  const expected = shareLine({ number: circuit.number, date: circuit.date, ms: run.finishMs, medal });
  await expect(page.locator("#finish .share")).toHaveText(expected);
  expect(expected).toMatch(/^Du Jour · Track #\d+ — \d+,\d{3}\ss( — .+)?$/);

  await page.getByRole("button", { name: "Partager mon temps" }).click();
  await expect(page.getByRole("button", { name: "Copié" })).toBeVisible();
  const pasted = await page.evaluate(() => navigator.clipboard.readText());
  expect(pasted).toBe(`${expected}\n${baseURL}/`);
});

test("le bouton « Rejouer » relance un décompte (utile sans clavier)", async ({ page }) => {
  await finishRace(page);
  // Pas à pas : avec timescale=6, une seule image lente du rendu logiciel (0,5 s × 6) mangeait tout le décompte de 3 s
  // avant que le test lise la phase (instable vu en CI, retouche 31b). Le décompte n'avance plus que par `advance`.
  await page.evaluate(() => window.__cdj.manual(true));
  await page.getByRole("button", { name: "Recourir" }).click();
  await expect(page.locator("#finish")).toBeHidden();
  expect(await page.evaluate(() => window.__cdj.phase)).toBe("countdown");
  await page.evaluate(() => window.__cdj.advance(3 * 120 + 1)); // 3 s de décompte
  expect(await page.evaluate(() => window.__cdj.phase)).toBe("racing");
});

test("le record garde sa médaille pour la liste des archives", async ({ page }) => {
  await finishRace(page);
  const stored = await page.evaluate((id) => JSON.parse(localStorage.getItem(`cdj:best:${id}`)!), circuit.track.id);
  expect(stored.medal).toBe(medal);
});

test.describe("archives", () => {
  const TODAY = "2026-10-30"; // 17 jours après le premier jour (13/10, circuit n° 1) : 18 circuits jouables
  const url = `/?debug&today=${TODAY}&seed=${TODAY}`;

  test("listent les jours du lancement à aujourd'hui, avec le meilleur temps de chacun, et ouvrent le jour choisi", async ({ page }) => {
    await page.addInitScript(
      ([g, simVersion]) => localStorage.setItem(`cdj:best:jour-2026-10-29-g${g}`, JSON.stringify({ ms: 40123, splits: [], medal: "gold", simVersion })),
      [GENERATOR_VERSION, SIM_VERSION] as const,
    );
    await page.goto(url);
    await page.waitForFunction(() => window.__cdj?.phase);
    await page.keyboard.press("KeyH");
    const days = page.locator("#archive .day");
    await expect(days).toHaveCount(18);
    await expect(days.nth(0)).toContainText(/n°\s18(?!\d)/); // lot I4 : « n° 18 » / “#18”, la date dans la langue du joueur (la ligne porte sa date ISO en `data-date`)
    await expect(days.nth(0)).toContainText("aujourd'hui");
    await expect(days.nth(0)).toHaveClass(/current/);
    await expect(days.nth(1)).toHaveAttribute("data-date", "2026-10-29");
    await expect(days.nth(1)).toContainText(/Or\s*40,123\ss/); // la médaille est nommée (plus d'émoji dans l'interface)
    await expect(days.nth(17)).toContainText(/n°\s1(?!\d)/);
    await expect(days.nth(17)).toHaveAttribute("data-date", "2026-10-13");

    await days.nth(2).click(); // 2026-10-28 = circuit #16
    await page.waitForFunction(() => window.__cdj?.phase);
    await expect(page.locator("#meta")).toContainText("n° 16");
    await expect(page.locator("#meta")).toContainText("28 oct.");
    expect(new URL(page.url()).searchParams.get("seed")).toBe("2026-10-28");
    expect(new URL(page.url()).searchParams.get("today")).toBe(TODAY); // les réglages de test sont conservés
  });

  test("s'ouvrent et se ferment au clavier (H, Échap) et par « ‹ TRACK » (le cadre couvre l'écran : plus de clic à côté)", async ({ page }) => {
    await page.goto(url);
    await page.waitForFunction(() => window.__cdj?.phase);
    await page.keyboard.press("KeyH");
    await expect(page.locator("#archive")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#archive")).toBeHidden();
    await page.keyboard.press("KeyH");
    await page.locator("#archive .dj-barre-jeu__retour").click();
    await expect(page.locator("#archive")).toBeHidden();
  });

  test("le lien d'aujourd'hui n'a pas de seed", async ({ page }) => {
    await page.goto(`/?debug&today=${TODAY}&seed=2026-10-28`);
    await page.waitForFunction(() => window.__cdj?.phase);
    await page.keyboard.press("KeyH");
    expect(await page.locator("#archive .day").first().getAttribute("href")).toBe("?debug=&today=2026-10-30");
  });

  test("un jour passé se joue sans envoyer de temps au classement", async ({ page }) => {
    // Le serveur réel (heure réelle) refuse un jour futur et un jour d'avant le premier : le seul jour passé sûr, quelle que soit la date
    // du test, est le premier jour (13/10/2026) ; « aujourd'hui » du jeu est le lendemain.
    const past = "2026-10-13";
    const today = "2026-10-14";
    const c = dailyCircuit(Math.floor(Date.parse(past) / 86_400_000));
    const pastCode = encodeReplay(runPilot(c.track, { grip: 0.9 }).replay);
    let submissions = 0;
    page.on("request", (r) => r.url().includes("/api/submit") && submissions++);
    await page.goto(`/?debug&timescale=6&today=${today}&seed=${past}&api=${encodeURIComponent("http://127.0.0.1:8787")}`);
    await page.waitForFunction(() => window.__cdj?.phase);
    await page.evaluate((cc) => window.__cdj.autoplay(cc), pastCode);
    await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 90_000 });
    await expect(page.locator("#finish .online")).toContainText("classement est figé");
    expect(submissions).toBe(0);
  });
});
