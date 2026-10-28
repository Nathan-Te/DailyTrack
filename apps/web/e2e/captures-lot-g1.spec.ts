import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { SIM_VERSION, dailyCircuit, encodeReplay, runPilot } from "@cdj/sim";
import { expect, test, newClockedContext, TODAY, type BrowserContext, type Page } from "./fixtures";

// Captures du README du lot G1 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot-g1 --project=chromium` (`OUT=…` change le dossier).
// Chromium, **français et anglais**, paysage : la course avec le bouton fantôme (844 × 390 : caméra dans la rangée de gauche ; 740 × 360 : la caméra et le fantôme côte à côte à
// droite, devant l'objectif), l'accueil avec le fantôme choisi et le Diamant grisé, et une course avec le fantôme Diamant (menthe glacée) dessiné à côté de la voiture.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(300_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/plateforme/lots/img");
mkdirSync(OUT, { recursive: true });
const LANGUES = [
  { slug: "fr", locale: "fr-FR" },
  { slug: "en", locale: "en-US" },
] as const;

const circuit = dailyCircuit(TODAY);
const pilote = runPilot(circuit.track, { grip: 0.9 });

async function telephone(browser: Parameters<typeof newClockedContext>[0], viewport: { width: number; height: number }, locale: string, avecRecord: boolean): Promise<BrowserContext> {
  const context = await newClockedContext(browser, { viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale });
  await context.addInitScript(() => localStorage.setItem("cdj:howto", "1"));
  if (avecRecord)
    await context.addInitScript(
      ([id, replay, ms, simVersion]) => localStorage.setItem(`cdj:best:${id}`, JSON.stringify({ ms, splits: [9000, 18000, 27000], replay, simVersion })),
      [circuit.track.id, encodeReplay(pilote.replay), pilote.finishMs, SIM_VERSION] as const,
    );
  return context;
}

async function enCourse(context: BrowserContext, ticks = 3 * 120 + 40 + 2 * 120): Promise<Page> {
  await context.route(/\/api\//, (route) => route.abort());
  const page = await context.newPage();
  await page.goto("/?debug&home=0");
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.evaluate(() => window.__cdj.manual(true));
  await page.evaluate((n) => window.__cdj.advance(n), ticks);
  return page;
}

for (const l of LANGUES) {
  for (const viewport of [
    { slug: "paysage", width: 844, height: 390 },
    { slug: "compact", width: 740, height: 360 },
  ]) {
    test(`course ${viewport.slug} (${l.slug})`, async ({ browser }) => {
      const context = await telephone(browser, viewport, l.locale, false);
      const page = await enCourse(context);
      await expect(page.locator("#btn-ghost")).toBeVisible();
      await page.screenshot({ path: join(OUT, `lot-G1-track-hud-${viewport.slug}-${l.slug}.png`) });
      await context.close();
    });
  }

  // Une archive (un jour passé, de jour : le Diamant est libre sans avoir fini le circuit) : la voiture du joueur reste au départ, le Diamant file devant elle.
  test(`course avec le fantôme Diamant (${l.slug})`, async ({ browser }) => {
    const context = await telephone(browser, { width: 844, height: 390 }, l.locale, false);
    await context.route(/\/api\//, (route) => route.abort());
    const page = await context.newPage();
    await page.goto(`/?debug&home=0&fps=0&seed=${dailyCircuit(TODAY - 2).date}`); // le 18/10/2026 : le Rallye, en plein jour
    await page.waitForFunction(() => window.__cdj?.phase);
    await page.locator("#btn-ghost").click(); // aucun record : le Diamant est le seul fantôme du cycle
    await expect(page.locator("#btn-ghost")).toHaveAttribute("aria-label", l.slug === "fr" ? "Fantôme : Diamant" : "Ghost: Diamond");
    // En temps réel (en pas à pas, l'image de la scène est celle du décompte) : une fois « PARTEZ ! » passé, le Diamant est devant la voiture, qui n'a pas bougé.
    await page.waitForFunction(() => (window.__cdj.car?.tick ?? 0) >= 40, undefined, { timeout: 90_000 });
    await page.screenshot({ path: join(OUT, `lot-G1-track-diamant-${l.slug}.png`) });
    await context.close();
  });

  test(`accueil (${l.slug})`, async ({ browser }) => {
    const context = await telephone(browser, { width: 844, height: 390 }, l.locale, false);
    const page = await context.newPage();
    await page.goto("/?home=1&debug&api=demo");
    await page.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
    await expect(page.locator("#home-ghost")).toBeVisible();
    await page.locator("#home-ghost").scrollIntoViewIfNeeded();
    await page.screenshot({ path: join(OUT, `lot-G1-track-accueil-${l.slug}.png`) });
    await context.close();
  });
}
