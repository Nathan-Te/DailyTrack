import { test, TODAY, newClockedContext, type Page } from "./fixtures";
import { dailyCircuit, encodeReplay, runPilot } from "@cdj/sim";

// Outil (hors CI : `CAPTURES=1 npx playwright test captures-lot55 --project=chromium`) : les écrans du choix des fantômes, pour la relecture de Nathan (docs/lots/lot-55/img/).
test.skip(({ browserName }) => browserName !== "chromium" || !process.env.CAPTURES, "outil : CAPTURES=1");
test.setTimeout(300_000);
const API = "http://127.0.0.1:8802";
const circuit = dailyCircuit(TODAY);
const OUT = process.env.OUT ?? "../../docs/lots/lot-55/img";
const JOUEURS = [
  { id: "a1".repeat(16), name: "Mika", grip: 1 },
  { id: "b2".repeat(16), name: "Léa", grip: 0.92 },
  { id: "c3".repeat(16), name: "Tom", grip: 0.85 },
  { id: "d4".repeat(16), name: "Inès", grip: 0.8 },
  { id: "e5".repeat(16), name: "Raph", grip: 0.74 },
  { id: "f6".repeat(16), name: "Noa", grip: 0.7 },
  { id: "17".repeat(16), name: "Sam", grip: 0.66 },
  { id: "28".repeat(16), name: "Yan", grip: 0.62 },
];

async function ouvrir(page: Page, home: boolean) {
  await page.goto(`/?${home ? "home=1&" : ""}debug&timescale=1&api=${encodeURIComponent(API)}`);
  await page.waitForFunction(() => (window as unknown as { __cdjFantomes?: unknown }).__cdjFantomes !== undefined, undefined, { timeout: 60_000 });
}

test("captures", async ({ browser }) => {
  for (const j of JOUEURS) {
    const replay = encodeReplay(runPilot(circuit.track, { grip: j.grip }).replay);
    await fetch(`${API}/api/submit`, { method: "POST", headers: { "Content-Type": "application/json", "X-Player-Id": j.id }, body: JSON.stringify({ name: j.name, date: circuit.date, replay }) });
  }
  for (const [nom, viewport] of [["telephone", { width: 844, height: 390 }], ["ordinateur", { width: 1280, height: 720 }]] as const) {
    const context = await newClockedContext(browser, { viewport });
    const page = await context.newPage();
    await ouvrir(page, true);
    await page.waitForSelector("#home .row[data-ref] .tg", { timeout: 30_000 });
    await page.locator("#home .home-classement").scrollIntoViewIfNeeded();
    await page.locator("#home .home-classement").evaluate((e) => e.scrollIntoView({ block: "center" }));
    await page.screenshot({ path: `${OUT}/${nom}-accueil.png` });
    await page.locator("#home-board-all").click({ timeout: 30_000 });
    await page.waitForSelector("#board-screen .row[data-ref] .tg", { timeout: 30_000 });
    await page.locator("#board-screen .row[data-ref] .tg").nth(1).click();
    await page.locator("#board-screen .row[data-ref] .tg").nth(3).click();
    await page.screenshot({ path: `${OUT}/${nom}-classement.png` });
    await page.keyboard.press("Escape");
    await page.close();
    const course = await context.newPage();
    await ouvrir(course, false);
    await course.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 60_000 });
    await course.keyboard.press("p");
    await course.screenshot({ path: `${OUT}/${nom}-pause.png` });
    await course.keyboard.press("p");
    await course.keyboard.press("Enter");
    await course.waitForFunction(() => window.__cdj.phase === "racing" && (window.__cdj.race as { car: { tick: number } }).car.tick > 240, undefined, { timeout: 60_000 });
    await course.screenshot({ path: `${OUT}/${nom}-course.png` });
    await context.close();
  }
});
