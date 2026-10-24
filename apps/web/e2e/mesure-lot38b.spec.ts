import { writeFileSync } from "node:fs";
import { test } from "@playwright/test";

// Mesure de la retouche 38b (outil, pas un test) : `MESURE=1 npx playwright test mesure-lot38b --project=chromium`. Au profil d'un téléphone
// (paysage 844 × 390, densité 1, processeur ×4 par CDP), en caméra de poursuite :
//   - chaque colonne (existant, paliers 1, 2, 3) sur les huit thèmes : construction de la scène (textures déjà dessinées), temps d'image
//     (attendue jusqu'au bout) et d'envoi (fil principal), appels, triangles, mémoire des textures et des cibles ;
//   - chaque pas **seul** au-dessus du palier 1 (colonne « à la carte »), sur quatre thèmes (Stade, Rallye, Nuit, Col) : ce qu'il ajoute.
// Écrit `src/vitrine/mesuresPaliers.ts` (que la vitrine affiche) ; le README de la retouche recopie les tableaux. `CPU=…` change le ralentissement,
// `THEMES_PAS=…` les thèmes des pas.
test.skip(!process.env.MESURE, "outil de mesure : MESURE=1");
test.skip(({ browserName }) => browserName !== "chromium", "CDP : Chromium seulement");
test.setTimeout(7_200_000);

const COLONNES = ["existant", "P1", "P2", "P3"] as const;
const PAS = ["geometrie", "variete", "matiere", "traces", "reflets", "ombres", "occlusion", "brume", "nuages", "drapeaux", "foule", "ecrans", "particules", "etalonnage", "anticrenelage", "halo"] as const;
type Mesure = { constructionMs: number; moyenneMs: number; pireMs: number; envoiMs: number; appels: number; triangles: number; textures: number; cibles: number };

test("vitrine : coût de chaque palier et de chaque pas au profil téléphone", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/vitrine/");
  await page.waitForFunction(() => window.__vitrine);
  const sujets = (await page.evaluate(() => [...new Set(window.__vitrine!.vues().map((v) => v.sujet))])).filter((s) => s.startsWith("theme-"));
  // Les circuits des thèmes, les morceaux et les textures d'abord, sans ralentissement (ce n'est pas ce qu'on mesure).
  await page.evaluate(() => window.__vitrine!.reglages("3"));
  for (const s of sujets) await page.evaluate((x) => window.__vitrine!.construireTout(x), s);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.CPU ?? 4) });
  const mesurer = (s: string, v: string, images: number) => page.evaluate(([x, y, n]) => window.__vitrine!.mesurer(x, y, 844, 390, n), [s, v, images] as const) as Promise<Mesure | null>;

  const lignes: Record<string, Mesure[]> = {};
  const parTheme: Record<string, Record<string, Mesure>> = {};
  for (const s of sujets) {
    for (const v of COLONNES) {
      const m = await mesurer(s, v, 30);
      if (!m) continue;
      (lignes[v] ??= []).push(m);
      (parTheme[s] ??= {})[v] = m;
      console.info(`${s} ${v} : construction ${m.constructionMs.toFixed(0)} ms, image ${m.moyenneMs.toFixed(1)} ms (envoi ${m.envoiMs.toFixed(1)}), ${m.appels} appels, ${m.triangles} triangles, textures ${(m.textures / 1048576).toFixed(1)} Mo, cibles ${(m.cibles / 1048576).toFixed(1)} Mo`);
    }
  }
  const moy = (a: number[]) => Math.round((a.reduce((n, x) => n + x, 0) / Math.max(1, a.length)) * 10) / 10;
  const max = (a: number[]) => Math.round(Math.max(...a) * 10) / 10;
  const colonnes = Object.fromEntries(
    Object.entries(lignes).map(([v, l]) => [
      v,
      {
        imageMs: moy(l.map((m) => m.moyenneMs)),
        imageMaxMs: max(l.map((m) => m.moyenneMs)),
        envoiMs: moy(l.map((m) => m.envoiMs)),
        constructionMs: moy(l.map((m) => m.constructionMs)),
        constructionMaxMs: max(l.map((m) => m.constructionMs)),
        appels: moy(l.map((m) => m.appels)),
        triangles: Math.round(moy(l.map((m) => m.triangles))),
        trianglesMax: max(l.map((m) => m.triangles)),
        textures: Math.round(moy(l.map((m) => m.textures))),
        cibles: Math.round(moy(l.map((m) => m.cibles))),
      },
    ]),
  );

  // Chaque pas seul au-dessus du palier 1 : l'écart avec le palier 1 du même thème, mesuré dans la même séance.
  const themesPas = (process.env.THEMES_PAS ?? "theme-stade,theme-rallye,theme-nuit,theme-col").split(",");
  const pas: Record<string, { imageMs: number; constructionMs: number; triangles: number; appels: number; memoire: number }> = {};
  for (const id of PAS) {
    const ecarts: Mesure[] = [];
    await page.evaluate((r) => window.__vitrine!.reglages(r), `1+${id}`);
    for (const s of themesPas) {
      const base = parTheme[s]?.P1;
      const m = await mesurer(s, "carte", 20);
      if (!base || !m) continue;
      ecarts.push({ constructionMs: m.constructionMs - base.constructionMs, moyenneMs: m.moyenneMs - base.moyenneMs, pireMs: 0, envoiMs: m.envoiMs - base.envoiMs, appels: m.appels - base.appels, triangles: m.triangles - base.triangles, textures: m.textures - base.textures, cibles: m.cibles - base.cibles });
    }
    pas[id] = { imageMs: moy(ecarts.map((e) => e.moyenneMs)), constructionMs: moy(ecarts.map((e) => e.constructionMs)), triangles: Math.round(moy(ecarts.map((e) => e.triangles))), appels: moy(ecarts.map((e) => e.appels)), memoire: Math.round(moy(ecarts.map((e) => e.textures + e.cibles))) };
    console.info(`pas ${id} : ${JSON.stringify(pas[id])}`);
  }

  const date = new Date().toISOString().slice(0, 10);
  const profil = `Chromium ${page.context().browser()?.version()} (rendu logiciel SwiftShader), paysage 844 × 390, densité 1, processeur ×${process.env.CPU ?? 4} ; colonnes : moyenne des ${sujets.length} thèmes, 30 images par vue ; pas : écart au palier 1 sur ${themesPas.join(", ")}, 20 images`;
  const source = `// Retouche 38b — mesures de référence des paliers, au profil téléphone (Chromium, processeur ×4, rendu logiciel). **Écrit par**
// \`MESURE=1 npx playwright test mesure-lot38b --project=chromium\` (apps/web/e2e/mesure-lot38b.spec.ts) : ne pas modifier à la main.
import type { PasId } from "../scene/paliers";

export interface MesureColonne {
  /** Temps d'image moyen (ms, image attendue jusqu'au bout) en caméra de poursuite, moyenne des thèmes ; et le pire thème. */
  imageMs?: number;
  imageMaxMs?: number;
  /** Temps d'envoi seul (fil principal, ms). */
  envoiMs?: number;
  /** Construction de la scène d'un circuit (ms, textures déjà dessinées), moyenne des thèmes ; et le pire thème. */
  constructionMs?: number;
  constructionMaxMs?: number;
  appels?: number;
  triangles?: number;
  trianglesMax?: number;
  /** Mémoire des textures dessinées et des cibles de rendu (octets), moyenne des thèmes. */
  textures?: number;
  cibles?: number;
}

/** Ce qu'un pas ajoute, seul, au palier 1 (moyenne des thèmes mesurés) : écarts d'image, de construction, de triangles, d'appels, de mémoire. */
export interface MesurePas {
  imageMs?: number;
  constructionMs?: number;
  triangles?: number;
  appels?: number;
  memoire?: number;
}

export const MESURES_PALIERS: { date: string | null; profil: string | null; colonnes: Record<string, MesureColonne>; pas: Partial<Record<PasId, MesurePas>> } = ${JSON.stringify({ date, profil, colonnes, pas }, null, 2)};
`;
  writeFileSync(new URL("../src/vitrine/mesuresPaliers.ts", import.meta.url), source);
  console.info(JSON.stringify({ colonnes, pas }, null, 2));
});
