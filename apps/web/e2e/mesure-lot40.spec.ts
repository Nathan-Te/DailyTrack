import { writeFileSync } from "node:fs";
import { test } from "@playwright/test";
import { THEME_NAMES } from "@cdj/sim";

// Mesure de la partie 1 du lot 40 (outil, pas un test) : la voiture en six maillages, avant / après, sur un circuit de chaque thème, au profil
// téléphone (844 × 390 @2, processeur ×4 : CDP `Emulation.setCPUThrottlingRate`), la voiture conduite par le pilote automatique (`?demo`),
// caméra de poursuite, qualité figée (`?quality=1` : ombres 512 ; `?quality=2` : ombres 1024 et décor dense).
//   - appels de rendu par image (`__cdj.render.calls`, l'image entière, ombres comprises : moyenne de 20 relevés) ;
//   - temps de fil principal par image (CDP `Performance.getMetrics`, `TaskDuration`) et temps passé dans `renderer.render` (`__cdj.render.renderMs`) ;
//   - intervalle moyen entre deux images (`requestAnimationFrame`) : dans le conteneur, la rastérisation est logicielle (SwiftShader) et compte.
// Servir le jeu d'avant sur 4174 et celui de la branche sur 4173 (voir captures-lot40.spec.ts), puis
// `MESURE=1 PERF_OUT=lot40.json npx playwright test mesure-lot40` (`THEMES=stade,nuit` : quelques thèmes ; `QUALITES=2` ; `DUREE=15000` : relevés plus longs).
test.skip(!process.env.MESURE, "outil de mesure : MESURE=1");
test.setTimeout(3_600_000);

const VERSIONS = { avant: process.env.AVANT ?? "http://localhost:4174", apres: process.env.APRES ?? "http://localhost:4173" };
const THEMES = process.env.THEMES?.split(",") ?? [...THEME_NAMES];
const QUALITES = (process.env.QUALITES ?? "1,2").split(",").map(Number);
const RATE = Number(process.env.RATE ?? 4);
/** Durée de chaque relevé (ms). */
const DUREE = Number(process.env.DUREE ?? 6000);

interface Mesure {
  appels: number;
  triangles: number;
  filMs: number;
  renduMs: number;
  intervalleMs: number;
  images: number;
}

test("partie 1 : appels et temps d'image, avant / après", async ({ browser }) => {
  const out: Record<string, Record<string, Mesure>> = {};
  for (const theme of THEMES) {
    for (const q of QUALITES) {
      const ligne: Record<string, Mesure> = {};
      for (const [version, base] of Object.entries(VERSIONS)) {
        const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
        try {
          const page = await context.newPage();
          const cdp = await context.newCDPSession(page);
          await cdp.send("Performance.enable");
          await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE });
          await page.addInitScript(() => localStorage.setItem("cdj:camera", "proche"));
          await page.goto(`${base}/?demo&debug&home=0&quality=${q}&theme=${theme}&today=2026-10-20`);
          await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 180_000 });
          await page.waitForTimeout(5000); // compilation des shaders, premiers effets
          await page.evaluate(() => {
            const w = window as unknown as { __mes: { images: number; somme: number; dernier: number; appels: number; triangles: number; releves: number } };
            w.__mes = { images: 0, somme: 0, dernier: 0, appels: 0, triangles: 0, releves: 0 };
            const image = (now: number) => {
              const m = w.__mes;
              if (m.dernier) {
                m.somme += now - m.dernier;
                m.images++;
              }
              m.dernier = now;
              if (m.images % 5 === 0 && m.releves < 20) {
                const r = window.__cdj.render as unknown as { calls: number; triangles: number };
                m.appels += r.calls;
                m.triangles += r.triangles;
                m.releves++;
              }
              requestAnimationFrame(image);
            };
            requestAnimationFrame(image);
          });
          const metriques = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]));
          const r0 = await page.evaluate(() => window.__cdj.render as unknown as { renderMs: number; renderFrames: number });
          const a = await metriques();
          await page.waitForTimeout(DUREE);
          const b = await metriques();
          const r1 = await page.evaluate(() => window.__cdj.render as unknown as { renderMs: number; renderFrames: number });
          const m = await page.evaluate(() => (window as unknown as { __mes: { images: number; somme: number; appels: number; triangles: number; releves: number } }).__mes);
          const rond = (n: number, d = 100) => Math.round(n * d) / d;
          ligne[version] = {
            appels: rond(m.appels / Math.max(1, m.releves), 10),
            triangles: Math.round(m.triangles / Math.max(1, m.releves)),
            filMs: rond((((b.TaskDuration ?? 0) - (a.TaskDuration ?? 0)) * 1000) / Math.max(1, m.images)),
            renduMs: rond((r1.renderMs - r0.renderMs) / Math.max(1, r1.renderFrames - r0.renderFrames)),
            intervalleMs: rond(m.somme / Math.max(1, m.images)),
            images: m.images,
          };
        } finally {
          await context.close();
        }
      }
      out[`${theme} q${q}`] = ligne;
      console.info(`${theme} q${q} ×${RATE} : ${JSON.stringify(ligne)}`);
    }
  }
  if (process.env.PERF_OUT) writeFileSync(process.env.PERF_OUT, JSON.stringify(out, null, 1));
});

// Partie 2 : le coût de chaque modèle dans la vitrine (`MESURE=1 npx playwright test mesure-lot40 -g "partie 2"`, sur le `dist` habituel) : la vue à
// l'arrêt du palier 2 (Stade), 844 × 390, processeur ×4, avec la voiture de chaque colonne puis sans elle, et les appels de rendu de l'image.
// Les chiffres vont dans `src/vitrine/mesuresVoiture.ts` (la planche les affiche sous chaque colonne).
test("partie 2 : le coût de chaque modèle (vitrine)", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATE });
    await page.goto(`${VERSIONS.apres}/vitrine/?planche=voiture`);
    await page.waitForFunction(() => window.__vitrine);
    const out: Record<string, unknown> = {};
    for (const palier of [1, 2] as const) {
      for (const col of ["existant", "A", "B", "C"] as const) {
        const m = await page.evaluate(async ([c, p]) => (await window.__vitrine!.voiture())!.mesurerColonne(c as "A", p as 2, 844, 390, 30), [col, palier] as const);
        out[`${col} P${palier}`] = m;
        console.info(`${col} P${palier} ×${RATE} : ${JSON.stringify(m)}`);
      }
    }
    if (process.env.PERF_OUT) writeFileSync(process.env.PERF_OUT, JSON.stringify(out, null, 1));
  } finally {
    await context.close();
  }
});
