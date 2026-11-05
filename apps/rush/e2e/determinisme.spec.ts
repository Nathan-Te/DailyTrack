import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Le déterminisme dans les navigateurs : les rediffusions de référence (`packages/rush-sim/test/fixtures/golden-rush.json`, produites par `npm run golden:rush`, rejouées par Node dans `golden.test.ts`) sont rejouées
// par Chromium, Firefox et WebKit (`verify.html`) et doivent donner exactement le même résultat : victoire, tick de la chute, cœurs, monstres tués, dégâts subis ; et l'empreinte de tout l'état d'un scénario (le golem, l'arène à 30 monstres) après 3 000 ticks. Un seul test (famille « Essentiel », petit ensemble `@navigateurs`).
interface Reference {
  nom: string;
  date: string;
  g: number;
  code: string;
  resultat: unknown;
}
interface Scenario {
  nom: string;
  scenario: string;
  monstres: number;
  code: string;
  ticks: number;
  empreinte: string;
  resultat: unknown;
}
const golden = JSON.parse(readFileSync(new URL("../../../packages/rush-sim/test/fixtures/golden-rush.json", import.meta.url), "utf8")) as { rediffusions: Reference[]; scenarios: Scenario[] };

test("le navigateur rejoue les rediffusions de référence et trouve exactement les résultats de Node", { tag: "@navigateurs" }, async ({ page }) => {
  await page.goto("/verify.html");
  await page.waitForSelector("html[data-ready=true]");
  const rejoue = await page.evaluate((refs) => (window as unknown as { __rejouer(r: unknown): { nom: string; resultat: unknown }[] }).__rejouer(refs), golden.rediffusions.map(({ nom, date, g, code }) => ({ nom, date, g, code })));
  expect(rejoue.map((r) => [r.nom, r.resultat])).toEqual(golden.rediffusions.map((r) => [r.nom, r.resultat]));
  expect(golden.rediffusions.length).toBeGreaterThanOrEqual(3);

  const scenarios = await page.evaluate((refs) => (window as unknown as { __scenarios(r: unknown): { nom: string; empreinte: string; resultat: unknown }[] }).__scenarios(refs), golden.scenarios.map(({ nom, scenario, monstres, code, ticks }) => ({ nom, scenario, monstres, code, ticks })));
  expect(scenarios.map((r) => [r.nom, r.empreinte, r.resultat])).toEqual(golden.scenarios.map((r) => [r.nom, r.empreinte, r.resultat]));
  expect(golden.scenarios.length).toBe(2);
});
