import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// La rediffusion de référence est produite et vérifiée par Node (packages/sim/test/golden.test.ts).
// Ici, chaque navigateur la rejoue avec le même code de simulation et doit retrouver exactement les mêmes
// nombres, au bit près : c'est la garantie « une course vaut la même chose partout » du seed (§ 7).
const golden = JSON.parse(readFileSync(new URL("../../../packages/sim/test/fixtures/essai-autopilot.json", import.meta.url), "utf8")) as {
  code: string;
  finishMs: number;
  splits: number[];
  final: Record<"x" | "y" | "z" | "yaw" | "vx" | "vy" | "vz", number>;
};

test("le navigateur rejoue la rediffusion de référence et trouve exactement le même résultat que Node", async ({ page }) => {
  await page.goto("/verify.html");
  await page.waitForSelector("html[data-ready=true]");
  const result = await page.evaluate((code) => window.__verify(code), golden.code);

  expect(result.finishMs).toBe(golden.finishMs);
  expect(result.splits).toEqual(golden.splits);
  expect(result.respawns).toBe(0);
  for (const k of Object.keys(golden.final) as (keyof typeof golden.final)[]) {
    // Object.is : distingue 0 et −0 et ne tolère aucun écart sur le dernier chiffre.
    expect(Object.is(result.final[k], golden.final[k]), `${k} : ${result.final[k]} ≠ ${golden.final[k]}`).toBe(true);
  }
});

test("une rediffusion falsifiée ne donne pas le temps de la rediffusion de référence", async ({ page }) => {
  await page.goto("/verify.html");
  await page.waitForSelector("html[data-ready=true]");
  // On remplace un caractère au milieu : la commande change, la course aussi (ou la rediffusion est refusée).
  const tampered = golden.code.slice(0, 600) + (golden.code[600] === "A" ? "B" : "A") + golden.code.slice(601);
  const outcome = await page.evaluate((code) => {
    try {
      return { finishMs: window.__verify(code).finishMs };
    } catch (e) {
      return { error: String(e) };
    }
  }, tampered);
  if ("finishMs" in outcome) expect(outcome.finishMs).not.toBe(golden.finishMs);
  else expect(outcome.error).toContain("ReplayError");
});
