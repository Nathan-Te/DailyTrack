import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Le déterminisme dans les navigateurs : les rediffusions de référence (`packages/vertige-sim/test/fixtures/golden-vertige.json`, produites par `npm run golden:vertige`, rejouées par Node dans `golden.test.ts`) sont rejouées
// par Chromium, Firefox et WebKit (`verify.html`) et doivent donner exactement le même résultat ET les mêmes empreintes de l'état entier, tous les 600 pas : un seul bit d'écart se voit. Un seul test (famille
// « Essentiel », petit ensemble `@navigateurs`).
interface Reference {
  nom: string;
  scenario: string | null;
  date: string;
  g: number;
  code: string;
  resultat: unknown;
  empreintes: string[];
}
const golden = JSON.parse(readFileSync(new URL("../../../packages/vertige-sim/test/fixtures/golden-vertige.json", import.meta.url), "utf8")) as { rediffusions: Reference[]; jours: { date: string; empreinte: string; modules: string[]; ticksRobot: number; niveau: string }[] };

test("le navigateur rejoue les rediffusions de référence et trouve exactement les résultats et l'état de Node", { tag: "@navigateurs" }, async ({ page }) => {
  await page.goto("/verify.html");
  await page.waitForSelector("html[data-ready=true]");
  const rejoue = await page.evaluate(
    (refs) => (window as unknown as { __rejouer(r: unknown): { nom: string; resultat: unknown; empreintes: string[] }[] }).__rejouer(refs),
    golden.rediffusions.map(({ nom, scenario, date, g, code }) => ({ nom, scenario, date, g, code })),
  );
  expect(rejoue.map((r) => [r.nom, r.resultat, r.empreintes])).toEqual(golden.rediffusions.map((r) => [r.nom, r.resultat, r.empreintes]));
  expect(golden.rediffusions.length).toBeGreaterThanOrEqual(4);
});

// Lot V3 : le générateur du niveau du jour, dans le navigateur (sa PRNG semée, les modules, leur assemblage, le robot rejoué) donne exactement le même niveau que Node — les modules, le temps du robot, l'empreinte du contenu et celle des
// boîtes du niveau assemblé. Le temps de génération de chaque jour est affiché dans le rapport (mesure du README du lot).
test("le navigateur génère les mêmes niveaux du jour que Node : modules, temps du robot, empreintes", { tag: "@navigateurs" }, async ({ page }, info) => {
  await page.goto("/verify.html");
  await page.waitForSelector("html[data-ready=true]");
  const r = await page.evaluate((dates) => (window as unknown as { __jours(d: string[]): { jours: unknown[]; ms: number[] } }).__jours(dates), golden.jours.map((j) => j.date));
  expect(r.jours).toEqual(golden.jours);
  info.annotations.push({ type: "génération (ms par niveau)", description: r.ms.map((m) => m.toFixed(0)).join(" ") });
  expect(golden.jours.length).toBeGreaterThanOrEqual(5);
});
