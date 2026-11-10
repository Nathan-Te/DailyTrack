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
const golden = JSON.parse(readFileSync(new URL("../../../packages/vertige-sim/test/fixtures/golden-vertige.json", import.meta.url), "utf8")) as { rediffusions: Reference[] };

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
