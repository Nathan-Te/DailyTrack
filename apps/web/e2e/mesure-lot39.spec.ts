import { writeFileSync } from "node:fs";
import { test } from "@playwright/test";

// Mesure du lot 39 (outil, pas un test) : la scène passe par le socle, le coût ne doit pas reculer. Au profil téléphone (844 × 390 @2, processeur ×4), sur trois thèmes :
// l'accueil (appels et triangles de la scène en fond), le départ d'une course (idem) et la bascule d'une session du Salon (durée de la bascule et de la construction de la
// scène, `__cdj.salon.stats`). `MESURE=1 PERF_BASE=http://localhost:4174 PERF_OUT=avant.json npx playwright test mesure-lot39` (`main` servi sur un autre port pour l'« avant »).
// Rendu logiciel : les images par seconde ne disent rien ; les appels, les triangles et les durées de construction, oui.
test.skip(!process.env.MESURE, "outil de mesure : MESURE=1");
test.skip(({ browserName }) => browserName !== "chromium", "CDP : Chromium seulement");
test.setTimeout(1_800_000);

const BASE = process.env.PERF_BASE ?? "http://localhost:4173";
const SCENES: Record<string, string> = { stade: "seed=2026-10-08", nuit: "seed=2026-10-14", ville: "seed=2026-10-16" };
const LEN = 10 * 60_000;
const START = Math.floor(1791549980000 / LEN) * LEN;

test("accueil, départ et bascule du Salon", async ({ browser }) => {
  const out: Record<string, number> = {};
  const nouveau = async () => {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    return { context, page };
  };
  for (const [nom, query] of Object.entries(SCENES)) {
    for (const [moment, home] of [["accueil", "1"], ["depart", "0"]] as const) {
      const { context, page } = await nouveau();
      await page.goto(`${BASE}/?debug&${query}&quality=2&ghost=off&fx=off&shake=0&home=${home}`);
      await page.waitForFunction(() => window.__cdj?.phase);
      await page.waitForTimeout(6000);
      const r = await page.evaluate(() => ({ calls: window.__cdj.render.calls, triangles: window.__cdj.render.triangles }));
      out[`${nom} ${moment} appels`] = r.calls;
      out[`${nom} ${moment} triangles`] = r.triangles;
      console.info(`${nom} ${moment} : ${r.calls} appels, ${r.triangles} triangles`);
      await context.close();
    }
  }
  // La bascule d'une session du Salon (démo) : la scène suivante est construite derrière le classement final puis adoptée à l'heure pile ; on lit les durées du jeu.
  for (let essai = 0; essai < 3; essai++) {
    const { context, page } = await nouveau();
    await page.addInitScript(() => localStorage.setItem("cdj:name", "Mesure"));
    const session = Math.floor(START / LEN) + essai * 3;
    await page.goto(`${BASE}/?mode=salon&api=demo&debug&salonAt=${session * LEN + 100_000}&quality=2&fx=off&shake=0`);
    await page.waitForFunction(() => window.__cdj?.salon?.trackId, undefined, { timeout: 180_000 });
    const avant = await page.evaluate(() => window.__cdj.salon!.trackId);
    await page.evaluate((ms) => window.__cdj.salon!.setNow(ms), (session + 1) * LEN - 800);
    await page.waitForFunction((id) => window.__cdj.salon!.trackId !== id && window.__cdj.salon!.state === "playing", avant, { timeout: 120_000 });
    const s = await page.evaluate(() => window.__cdj.salon!.stats as unknown as { buildMs: number; swapMs: number; prebuilt: number });
    out[`salon bascule ${essai} swapMs`] = Math.round(s.swapMs * 10) / 10;
    out[`salon bascule ${essai} buildMs`] = Math.round(s.buildMs * 10) / 10;
    console.info(`salon bascule ${essai} : ${s.swapMs.toFixed(1)} ms (scène construite : ${s.buildMs.toFixed(0)} ms), construite d'avance : ${s.prebuilt}`);
    await context.close();
  }
  if (process.env.PERF_OUT) writeFileSync(process.env.PERF_OUT, JSON.stringify(out, null, 1));
});
