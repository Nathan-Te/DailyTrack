import { writeFileSync } from "node:fs";
import { test } from "@playwright/test";

// Mesure du lot 44 (outil, pas un test) : le décor du palier 1, à la demande, contre le lot 43 (`main` servi à côté : PERF_AVANT=http://localhost:4174).
//   (avant) npx vite preview --port 4174 --outDir <dist de main>
//   MESURE=1 PERF_AVANT=http://localhost:4174 PERF_OUT=docs/lots/lot-44/mesure.json npx playwright test mesure-lot44 --project=chromium
// 1. Au profil téléphone (844 × 390 @2, processeur ×4), un circuit de chaque thème, au départ d'une course, la scène **avec son décor** : appels de rendu et
//    triangles par image (ombres comprises), construction de la scène (`__cdj.socle.constructionMs`, plus la pose du décor s'il est arrivé après : `poseDureeMs`).
// 2. L'arrivée du décor **en 4G lente** (150 ms, 1,6 Mbit/s), cache vide, processeur ×4 : le premier affichage, le décor prêt et posé, à l'accueil (le cas
//    habituel) et sans accueil (`?home=0`), cinq essais chacun.
// Rendu logiciel : les images par seconde ne disent rien d'un téléphone (« À tester ») ; les appels, les triangles et les durées de construction, oui.
test.skip(!process.env.MESURE, "outil de mesure : MESURE=1");
test.skip(({ browserName }) => browserName !== "chromium", "CDP : Chromium seulement");
test.setTimeout(3_600_000);

const APRES = process.env.PERF_BASE ?? "http://localhost:4173";
const AVANT = process.env.PERF_AVANT;
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

test("décor du palier 1 : appels, triangles, construction (contre le lot 43) ; arrivée du décor en 4G lente", async ({ browser }) => {
  const out: Record<string, number | string> = {};
  const nouveau = async (reseau = false) => {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    if (reseau) {
      await cdp.send("Network.enable");
      await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    }
    await page.addInitScript(() => localStorage.setItem("cdj:howto", "1"));
    return { context, page };
  };
  for (const [nom, query] of Object.entries(SCENES)) {
    for (const [cote, base] of [["avant", AVANT], ["apres", APRES]] as const) {
      if (!base) continue;
      const { context, page } = await nouveau();
      await page.goto(`${base}/?debug&fps=0&${query}&quality=2&ghost=off&fx=off&shake=0&home=0`);
      await page.waitForFunction(() => window.__cdj?.phase);
      // Le décor (lot 44) : s'il n'était pas là à la construction, il est posé à la pause.
      if (cote === "apres" && !(await page.evaluate(() => window.__cdj.decor.dansScene))) {
        await page.keyboard.press("KeyP");
        await page.waitForFunction(() => window.__cdj.decor.dansScene);
        await page.keyboard.press("KeyP");
      }
      await page.waitForTimeout(6000);
      const r = await page.evaluate(() => ({ calls: window.__cdj.render.calls, triangles: window.__cdj.render.triangles, construction: window.__cdj.socle.constructionMs, pose: (window.__cdj as { decor?: { poseDureeMs: number; posePhase: string | null } }).decor ?? null }));
      out[`${nom} ${cote} appels`] = r.calls;
      out[`${nom} ${cote} triangles`] = r.triangles;
      out[`${nom} ${cote} construction ms`] = Math.round(r.construction + (r.pose && r.pose.posePhase !== "construction" ? r.pose.poseDureeMs : 0));
      if (r.pose) out[`${nom} ${cote} décor posé`] = r.pose.posePhase ?? "";
      console.info(`${nom} ${cote} : ${r.calls} appels, ${r.triangles} triangles, construction ${out[`${nom} ${cote} construction ms`]} ms ${r.pose ? `(décor : ${r.pose.posePhase})` : ""}`);
      await context.close();
    }
  }
  // L'arrivée du décor en 4G lente, cache vide : à l'accueil (le circuit du jour), puis sans accueil.
  for (const [cas, query] of [["accueil", "home=1&api=demo"], ["sans accueil", "home=0&seed=2026-10-16"]] as const) {
    for (let essai = 0; essai < 5; essai++) {
      const { context, page } = await nouveau(true);
      await page.goto(`${APRES}/?debug&fps=0&ghost=off&fx=off&${query}`, { waitUntil: "commit" });
      await page.waitForFunction(() => window.__cdj?.phase, undefined, { timeout: 60_000 });
      const pret = await page.evaluate(() => performance.now());
      await page.waitForFunction(() => window.__cdj.decor.pretMs !== null, undefined, { timeout: 60_000 });
      await page.waitForTimeout(500);
      const d = await page.evaluate(() => ({ ...window.__cdj.decor, fcp: performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? -1 }));
      out[`4G ${cas} ${essai} jeu prêt ms`] = Math.round(pret);
      out[`4G ${cas} ${essai} décor demandé ms`] = Math.round(d.demandeMs);
      out[`4G ${cas} ${essai} décor prêt ms`] = Math.round(d.pretMs!);
      out[`4G ${cas} ${essai} décor posé`] = d.posePhase ?? "pas encore (course en cours)";
      console.info(`4G ${cas} ${essai} : premier affichage ${d.fcp.toFixed(0)} ms, jeu prêt ${pret.toFixed(0)} ms, décor demandé ${d.demandeMs.toFixed(0)} ms, prêt ${d.pretMs!.toFixed(0)} ms, posé : ${d.posePhase}`);
      await context.close();
    }
  }
  if (process.env.PERF_OUT) writeFileSync(process.env.PERF_OUT, JSON.stringify(out, null, 1));
});
