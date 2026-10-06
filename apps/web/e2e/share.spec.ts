import { expect, test, type Page } from "@playwright/test";
import { dailyCircuit, encodeReplay, medalFor, runPilot } from "@cdj/sim";
import { shareLine } from "../src/share";

// Écran d'arrivée : ligne à partager, copie, archives. Le rendu 3D demande WebGL : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(120_000);

const day = Math.floor(Date.now() / 86_400_000);
const circuit = dailyCircuit(day);
const run = runPilot(circuit.track, { curveSpeed: 26 });
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
  expect(expected).toMatch(/^Circuit du Jour #\d+ — \d+,\d{3} s( — .+)?$/);

  await page.getByRole("button", { name: "Copier le résultat" }).click();
  await expect(page.getByRole("button", { name: "Copié ✓" })).toBeVisible();
  const pasted = await page.evaluate(() => navigator.clipboard.readText());
  expect(pasted).toBe(`${expected}\n${baseURL}/`);
});

test("le bouton « Rejouer » relance un décompte (utile sans clavier)", async ({ page }) => {
  await finishRace(page);
  await page.getByRole("button", { name: "Rejouer" }).click();
  await expect(page.locator("#finish")).toBeHidden();
  expect(await page.evaluate(() => window.__cdj.phase)).toBe("countdown");
});

test("le record garde sa médaille pour la liste des archives", async ({ page }) => {
  await finishRace(page);
  const stored = await page.evaluate((id) => JSON.parse(localStorage.getItem(`cdj:best:${id}`)!), circuit.track.id);
  expect(stored.medal).toBe(medal);
});

test.describe("archives", () => {
  const TODAY = "2026-10-09"; // 3 jours après le lancement : 4 circuits jouables
  const url = `/?debug&today=${TODAY}&seed=${TODAY}`;

  test("listent les jours du lancement à aujourd'hui, avec le meilleur temps de chacun, et ouvrent le jour choisi", async ({ page }) => {
    await page.addInitScript(() =>
      localStorage.setItem("cdj:best:jour-2026-10-08-g1", JSON.stringify({ ms: 40123, splits: [], medal: "gold" })),
    );
    await page.goto(url);
    await page.waitForFunction(() => window.__cdj?.phase);
    await page.locator("#btn-archive").click();
    const days = page.locator("#archive .day");
    await expect(days).toHaveCount(4);
    await expect(days.nth(0)).toContainText("#4");
    await expect(days.nth(0)).toContainText("aujourd'hui");
    await expect(days.nth(0)).toHaveClass(/current/);
    await expect(days.nth(1)).toContainText("2026-10-08");
    await expect(days.nth(1)).toContainText("🥇 40,123 s");
    await expect(days.nth(3)).toContainText("#1");
    await expect(days.nth(3)).toContainText("2026-10-06");

    await days.nth(2).click(); // 2026-10-07 = circuit #2
    await page.waitForFunction(() => window.__cdj?.phase);
    await expect(page.locator("#meta")).toContainText("#2");
    await expect(page.locator("#meta")).toContainText("2026-10-07");
    expect(new URL(page.url()).searchParams.get("seed")).toBe("2026-10-07");
    expect(new URL(page.url()).searchParams.get("today")).toBe(TODAY); // les réglages de test sont conservés
  });

  test("s'ouvrent et se ferment au clavier (H, Échap), et au clic à côté", async ({ page }) => {
    await page.goto(url);
    await page.waitForFunction(() => window.__cdj?.phase);
    await page.keyboard.press("KeyH");
    await expect(page.locator("#archive")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#archive")).toBeHidden();
    await page.keyboard.press("KeyH");
    await page.mouse.click(5, 5);
    await expect(page.locator("#archive")).toBeHidden();
    await page.locator("#btn-archive").click();
    await page.locator("#archive .close").click();
    await expect(page.locator("#archive")).toBeHidden();
  });

  test("le lien d'aujourd'hui n'a pas de seed", async ({ page }) => {
    await page.goto(`/?debug&today=${TODAY}&seed=2026-10-07`);
    await page.waitForFunction(() => window.__cdj?.phase);
    await page.locator("#btn-archive").click();
    expect(await page.locator("#archive .day").first().getAttribute("href")).toBe("?debug=&today=2026-10-09");
  });

  test("un jour passé se joue sans envoyer de temps au classement", async ({ page }) => {
    const past = "2026-10-07";
    const c = dailyCircuit(Math.floor(Date.parse(past) / 86_400_000));
    const pastCode = encodeReplay(runPilot(c.track, { curveSpeed: 26 }).replay);
    let submissions = 0;
    page.on("request", (r) => r.url().includes("/api/submit") && submissions++);
    await page.goto(`/?debug&timescale=6&today=${TODAY}&seed=${past}&api=${encodeURIComponent("http://127.0.0.1:8787")}`);
    await page.waitForFunction(() => window.__cdj?.phase);
    await page.evaluate((cc) => window.__cdj.autoplay(cc), pastCode);
    await page.waitForFunction(() => window.__cdj.phase === "finished", undefined, { timeout: 90_000 });
    await expect(page.locator("#finish .online")).toContainText("Classement figé");
    expect(submissions).toBe(0);
  });
});
