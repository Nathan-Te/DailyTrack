import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Le déterminisme dans les navigateurs : les rediffusions de référence (`packages/blocks-sim/test/fixtures/golden-blocks.json`, produites par `npm run golden:blocks`, rejouées par Node dans `golden.test.ts`) sont rejouées
// par Chromium, Firefox et WebKit (`verify.html`) et doivent donner exactement le même résultat : score, combo maximal, nombre de poses, raison de la fin. Un seul test (famille « Essentiel », petit ensemble `@navigateurs`).
interface Reference {
  nom: string;
  date: string;
  scenario?: string;
  g: number;
  code: string;
  resultat: unknown;
}
const golden = JSON.parse(readFileSync(new URL("../../../packages/blocks-sim/test/fixtures/golden-blocks.json", import.meta.url), "utf8")) as { rediffusions: Reference[] };

test("le navigateur rejoue les rediffusions de référence et trouve exactement les résultats de Node", { tag: "@navigateurs" }, async ({ page }) => {
  await page.goto("/verify.html");
  await page.waitForSelector("html[data-ready=true]");
  const rejoue = await page.evaluate((refs) => (window as unknown as { __rejouer(r: unknown): { nom: string; resultat: unknown }[] }).__rejouer(refs), golden.rediffusions.map(({ nom, date, scenario, g, code }) => ({ nom, date, scenario, g, code })));
  expect(rejoue.map((r) => [r.nom, r.resultat])).toEqual(golden.rediffusions.map((r) => [r.nom, r.resultat]));
  expect(golden.rediffusions.length).toBeGreaterThanOrEqual(4);
});
