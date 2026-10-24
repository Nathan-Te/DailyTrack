import { writeFileSync } from "node:fs";
import { test } from "@playwright/test";

// Mesure du lot 45 (outil, pas un test) : ce que coûte le palier 2 (la finition), **sur la même construction** que le lot 46, au profil téléphone (844 × 390 @2,
// processeur ×4), au départ d'une course, sur le Stade, le Rallye, la Nuit et le Col (les thèmes du 38b) : le palier 1, le palier 2, chaque partie retirée du
// palier 2 (`?reglages=2-reflets`…), le palier 2 + vie et ciel (« Équilibrée ») et le palier 3 (« Maximale ») — appels de rendu et triangles par image (ombres
// comprises), construction de la scène, programmes compilés, textures sur la carte graphique, temps d'envoi d'une image (le fil principal : `renderer.render`).
//   MESURE=1 PERF_OUT=docs/lots/lot-45/mesure.json npx playwright test mesure-lot45 --project=chromium
// Rendu logiciel : le temps d'image ne dit rien d'un téléphone (lecture des textures par pixel : la carte graphique) — « À tester » au Pixel 7 avec le compteur de
// `?debug`. Les appels, les triangles, la construction et l'envoi, oui.
test.skip(!process.env.MESURE, "outil de mesure : MESURE=1");
test.skip(({ browserName }) => browserName !== "chromium", "CDP : Chromium seulement");
test.setTimeout(3_600_000);

const BASE = process.env.PERF_BASE ?? "http://localhost:4173";
const SCENES: Record<string, string> = { stade: "seed=2026-10-08", rallye: "seed=2026-10-21", nuit: "seed=2026-10-14", col: "seed=2026-10-12" };
const REGLAGES = ["1", "2", "2-geometrie", "2-variete", "2-matiere", "2-traces", "2-reflets", "1+vie+ciel", "2+vie+ciel", "3"];

test("palier 2 : appels, triangles, construction, textures, envoi", async ({ browser }) => {
  const out: Record<string, number> = {};
  for (const [nom, query] of Object.entries(SCENES)) {
    for (const r of REGLAGES) {
      const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
      const page = await context.newPage();
      const cdp = await context.newCDPSession(page);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await page.addInitScript(() => localStorage.setItem("cdj:howto", "1"));
      await page.goto(`${BASE}/?debug&fps=0&${query}&quality=2&ghost=off&fx=off&shake=0&home=0&reglages=${encodeURIComponent(r)}`);
      await page.waitForFunction(() => window.__cdj?.phase);
      await page.evaluate(() => window.__cdj.manual(false));
      await page.waitForTimeout(4000);
      const a = await page.evaluate(() => ({ ms: window.__cdj.render.renderMs, n: window.__cdj.render.renderFrames }));
      await page.waitForTimeout(4000);
      const m = await page.evaluate(() => ({ calls: window.__cdj.render.calls, triangles: window.__cdj.render.triangles, programmes: window.__cdj.render.programs, construction: window.__cdj.socle.constructionMs, ms: window.__cdj.render.renderMs, n: window.__cdj.render.renderFrames, textures: window.__cdj.render.textures }));
      const envoi = (m.ms - a.ms) / Math.max(1, m.n - a.n);
      const cle = `${nom} ${r}`;
      out[`${cle} appels`] = m.calls;
      out[`${cle} triangles`] = m.triangles;
      out[`${cle} programmes`] = m.programmes;
      out[`${cle} construction ms`] = Math.round(m.construction);
      out[`${cle} envoi ms`] = Math.round(envoi * 10) / 10;
      out[`${cle} textures`] = m.textures;
      console.info(`${cle} : ${m.calls} appels, ${m.triangles} triangles, ${m.programmes} programmes, ${m.textures} textures, construite en ${m.construction.toFixed(0)} ms, envoi ${envoi.toFixed(1)} ms/image`);
      await context.close();
    }
  }
  if (process.env.PERF_OUT) writeFileSync(process.env.PERF_OUT, JSON.stringify(out, null, 1));
});
