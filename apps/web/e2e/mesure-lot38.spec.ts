import { writeFileSync } from "node:fs";
import { test } from "@playwright/test";

// Mesure du lot 38 (outil, pas un test) : `MESURE=1 npx playwright test mesure-lot38 --project=chromium`. Pour chaque colonne de la vitrine
// (existant, A, B, C, mélange) et chaque thème : temps de construction de la scène du circuit, temps d'image (attendue jusqu'au bout) et temps
// d'envoi (fil principal) en caméra de poursuite, au profil d'un téléphone (paysage 844 × 390, densité 1, processeur ×4 par CDP). Écrit
// `src/vitrine/mesures.ts` (que la vitrine affiche) ; le README du lot recopie le tableau.
test.skip(!process.env.MESURE, "outil de mesure : MESURE=1");
test.skip(({ browserName }) => browserName !== "chromium", "CDP : Chromium seulement");
test.setTimeout(1_800_000);

const VARIANTES = ["existant", "A", "B", "C", "M"] as const;

test("vitrine : coût de chaque direction au profil téléphone", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/vitrine/?planche=directions");
  await page.waitForFunction(() => window.__vitrine);
  const sujets = (await page.evaluate(() => [...new Set(window.__vitrine!.vues().map((v) => v.sujet))])).filter((s) => s.startsWith("theme-"));
  // Les circuits des thèmes et les morceaux des directions d'abord, sans ralentissement (ce n'est pas ce qu'on mesure).
  for (const s of sujets) await page.evaluate((x) => window.__vitrine!.construireTout(x), s);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.CPU ?? 4) });
  const lignes: Record<string, { imageMs: number[]; envoiMs: number[]; constructionMs: number[]; appels: number[]; triangles: number[] }> = {};
  for (const v of VARIANTES) lignes[v] = { imageMs: [], envoiMs: [], constructionMs: [], appels: [], triangles: [] };
  for (const s of sujets) {
    for (const v of VARIANTES) {
      const m = await page.evaluate(([x, y]) => window.__vitrine!.mesurer(x, y, 844, 390, 40), [s, v] as const);
      if (!m) continue;
      const l = lignes[v]!;
      l.imageMs.push(m.moyenneMs);
      l.envoiMs.push(m.envoiMs);
      l.constructionMs.push(m.constructionMs);
      l.appels.push(m.appels);
      l.triangles.push(m.triangles);
      console.info(`${s} ${v} : construction ${m.constructionMs.toFixed(0)} ms, image ${m.moyenneMs.toFixed(1)} ms (envoi ${m.envoiMs.toFixed(1)}), ${m.appels} appels, ${m.triangles} triangles`);
    }
  }
  const moy = (a: number[]) => Math.round((a.reduce((n, x) => n + x, 0) / Math.max(1, a.length)) * 10) / 10;
  const max = (a: number[]) => Math.round(Math.max(...a) * 10) / 10;
  const variantes = Object.fromEntries(
    Object.entries(lignes).map(([v, l]) => [v, { imageMs: moy(l.imageMs), imageMaxMs: max(l.imageMs), envoiMs: moy(l.envoiMs), constructionMs: moy(l.constructionMs), constructionMaxMs: max(l.constructionMs), appels: moy(l.appels), triangles: Math.round(moy(l.triangles)), trianglesMax: max(l.triangles) }]),
  );
  const date = new Date().toISOString().slice(0, 10);
  const profil = `Chromium ${page.context().browser()?.version()} (rendu logiciel SwiftShader), paysage 844 × 390, densité 1, processeur ×${process.env.CPU ?? 4} ; moyenne des ${sujets.length} thèmes, 40 images par vue`;
  const source = `// Lot 38 — mesures de référence de la vitrine, au profil téléphone (Chromium, processeur ×4, rendu logiciel). **Écrit par**
// \`MESURE=1 npx playwright test mesure-lot38 --project=chromium\` (apps/web/e2e/mesure-lot38.spec.ts) : ne pas modifier à la main.

export interface MesureVariante {
  /** Temps d'image moyen (ms, image attendue jusqu'au bout) en caméra de poursuite, moyenne des huit thèmes ; et le pire thème. */
  imageMs?: number;
  imageMaxMs?: number;
  /** Temps d'envoi seul (fil principal, ms). */
  envoiMs?: number;
  /** Construction de la scène d'un circuit (ms), moyenne des huit thèmes ; et le pire thème. */
  constructionMs?: number;
  constructionMaxMs?: number;
  appels?: number;
  triangles?: number;
  trianglesMax?: number;
}

export const MESURES: { date: string | null; profil: string | null; variantes: Record<string, MesureVariante> } = ${JSON.stringify({ date, profil, variantes }, null, 2)};
`;
  writeFileSync(new URL("../src/vitrine/mesures.ts", import.meta.url), source);
  console.info(JSON.stringify(variantes, null, 2));
});
