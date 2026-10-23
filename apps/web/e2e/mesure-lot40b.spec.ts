import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";

// Mesure de la retouche 40b (outil, pas un test) : `MESURE=1 npx playwright test mesure-lot40b`. Profil téléphone (844 × 390 @2, processeur ×4,
// Chromium en rendu logiciel). **Le départ d'une course ne doit pas attendre la voiture** : pour la civile, puis pour le Proto (`?voiture=proto`,
// un modèle chargé à la demande), aux qualités 1 et 2 (au palier 2 de la voiture, les matériaux à deux couches se chargent aussi) — le temps
// jusqu'au décompte (navigation → `phase === "countdown"`), la construction de la civile au démarrage, et le temps jusqu'à ce que la voiture
// choisie remplace la civile. Cinq chargements chacun, la médiane. Résultat : `docs/lots/lot-40b-voitures-en-jeu/mesures.json`. Avec
// `AVANT=http://localhost:4174` (le jeu de `main` servi à côté : `npx vite preview --outDir <avant> --port 4174`), le temps jusqu'au décompte d'avant.
test.skip(!process.env.MESURE, "outil de mesure : MESURE=1");
test.setTimeout(900_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/lots/lot-40b-voitures-en-jeu");
const mediane = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)]!;

test("le départ n'attend pas la voiture (profil téléphone)", async ({ browser }) => {
  const cas: [string, string][] = [
    ...(process.env.AVANT ? ([["avant (main), qualité 1", `${process.env.AVANT}/?quality=1`], ["avant (main), qualité 2", `${process.env.AVANT}/?quality=2`]] as [string, string][]) : []),
    ["civile, qualité 1", "quality=1"],
    ["civile, qualité 2", "quality=2"],
    ["Proto, qualité 1", "quality=1&voiture=proto"],
    ["Proto, qualité 2", "quality=2&voiture=proto"],
  ];
  const resultat: Record<string, { decompteMs: number; civileMs: number; voitureMs: number | null }> = {};
  for (const [nom, q] of cas) {
    const mesures: { decompteMs: number; civileMs: number; voitureMs: number | null }[] = [];
    for (let i = 0; i < 5; i++) {
      const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fr-FR" });
      try {
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        const avant = q.startsWith("http");
        await page.goto(avant ? `${q}&home=0&debug&api=demo` : `/?home=0&debug&api=demo&${q}`);
        await page.waitForFunction(() => window.__cdj?.phase === "countdown" || window.__cdj?.phase === "racing", undefined, { timeout: 120_000 });
        const decompteMs = await page.evaluate(() => performance.now());
        if (avant) {
          mesures.push({ decompteMs, civileMs: 0, voitureMs: null });
          continue;
        }
        await page.waitForFunction(() => window.__cdj.voiture.aJour, undefined, { timeout: 120_000 });
        const v = await page.evaluate(() => window.__cdj.voiture.stats);
        mesures.push({ decompteMs, civileMs: v.civileMs, voitureMs: v.remplacees > 0 ? v.remplaceeA : null });
      } finally {
        await context.close();
      }
    }
    const remplacees = mesures.map((m) => m.voitureMs).filter((x): x is number => x !== null);
    resultat[nom] = { decompteMs: Math.round(mediane(mesures.map((m) => m.decompteMs))), civileMs: Math.round(mediane(mesures.map((m) => m.civileMs)) * 10) / 10, voitureMs: remplacees.length ? Math.round(mediane(remplacees)) : null };
  }
  writeFileSync(join(OUT, "mesures.json"), JSON.stringify(resultat, null, 1));
  console.log(resultat);
});
