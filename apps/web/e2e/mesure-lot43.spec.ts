import { writeFileSync } from "node:fs";
import { test } from "@playwright/test";

// Mesure du lot 43 (outil, pas un test) : le palier 1 contre l'existant, **sur la même construction** (`?palier=existant` charge l'ancienne scène), au profil
// téléphone (844 × 390 @2, processeur ×4), sur un circuit de chaque thème : à l'accueil et au départ d'une course, les appels de rendu et les triangles par
// image (ombres comprises), la durée de construction de la scène (`__cdj.socle.constructionMs`) ; puis la bascule d'une session du Salon (trois essais).
//   MESURE=1 PERF_OUT=docs/lots/lot-43/mesure.json npx playwright test mesure-lot43 --project=chromium
// Rendu logiciel : les images par seconde ne disent rien d'un téléphone (« À tester ») ; les appels, les triangles et les durées de construction, oui.
test.skip(!process.env.MESURE, "outil de mesure : MESURE=1");
test.skip(({ browserName }) => browserName !== "chromium", "CDP : Chromium seulement");
test.setTimeout(3_600_000);

const BASE = process.env.PERF_BASE ?? "http://localhost:4173";
const SCENES: Record<string, string> = {
  stade: "seed=2026-10-08",
  rallye: "seed=2026-10-21",
  banquise: "seed=2026-10-10&theme=banquise",
  nuit: "seed=2026-10-14",
  campagne: "seed=2026-10-14&theme=campagne",
  canyon: "seed=2026-10-06",
  col: "seed=2026-10-12",
  ville: "seed=2026-10-16",
};
const PALIERS: Record<string, string> = { existant: "&palier=existant", P1: "" };
const LEN = 10 * 60_000;
const START = Math.floor(1791549980000 / LEN) * LEN;

test("palier 1 contre existant : appels, triangles, construction ; bascule du Salon", async ({ browser }) => {
  const out: Record<string, number> = {};
  const nouveau = async () => {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    return { context, page };
  };
  for (const [nom, query] of Object.entries(SCENES)) {
    for (const [palier, extra] of Object.entries(PALIERS)) {
      for (const [moment, home] of [["accueil", "1"], ["depart", "0"]] as const) {
        const { context, page } = await nouveau();
        await page.addInitScript(() => localStorage.setItem("cdj:howto", "1"));
        await page.goto(`${BASE}/?debug&fps=0&${query}&quality=2&ghost=off&fx=off&shake=0&home=${home}${extra}`);
        await page.waitForFunction(() => window.__cdj?.phase);
        await page.waitForTimeout(6000);
        const r = await page.evaluate(() => ({ calls: window.__cdj.render.calls, triangles: window.__cdj.render.triangles, construction: window.__cdj.socle.constructionMs, palier: window.__cdj.socle.palier() }));
        if (r.palier !== palier) throw new Error(`${nom} : palier ${r.palier} au lieu de ${palier}`);
        out[`${nom} ${palier} ${moment} appels`] = r.calls;
        out[`${nom} ${palier} ${moment} triangles`] = r.triangles;
        out[`${nom} ${palier} ${moment} construction ms`] = Math.round(r.construction);
        console.info(`${nom} ${palier} ${moment} : ${r.calls} appels, ${r.triangles} triangles, scène construite en ${r.construction.toFixed(0)} ms`);
        await context.close();
      }
    }
  }
  // La bascule d'une session du Salon (démo) : la scène suivante est construite derrière le classement final puis adoptée à l'heure pile ; on lit les durées du jeu.
  for (const [palier, extra] of Object.entries(PALIERS)) {
    for (let essai = 0; essai < 3; essai++) {
      const { context, page } = await nouveau();
      await page.addInitScript(() => localStorage.setItem("cdj:name", "Mesure"));
      const session = Math.floor(START / LEN) + essai * 3;
      await page.goto(`${BASE}/?mode=salon&api=demo&debug&fps=0&salonAt=${session * LEN + 100_000}&quality=2&fx=off&shake=0${extra}`);
      await page.waitForFunction(() => window.__cdj?.salon?.trackId, undefined, { timeout: 180_000 });
      const avant = await page.evaluate(() => window.__cdj.salon!.trackId);
      await page.evaluate((ms) => window.__cdj.salon!.setNow(ms), (session + 1) * LEN - 800);
      await page.waitForFunction((id) => window.__cdj.salon!.trackId !== id && window.__cdj.salon!.state === "playing", avant, { timeout: 120_000 });
      const s = await page.evaluate(() => window.__cdj.salon!.stats as unknown as { buildMs: number; swapMs: number });
      out[`salon ${palier} ${essai} bascule ms`] = Math.round(s.swapMs * 10) / 10;
      out[`salon ${palier} ${essai} construction ms`] = Math.round(s.buildMs);
      console.info(`salon ${palier} ${essai} : bascule ${s.swapMs.toFixed(1)} ms, scène construite en ${s.buildMs.toFixed(0)} ms`);
      await context.close();
    }
  }
  if (process.env.PERF_OUT) writeFileSync(process.env.PERF_OUT, JSON.stringify(out, null, 1));
});
