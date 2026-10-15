import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Lot 3 : déterminisme entre moteurs. Les rediffusions de référence et leurs empreintes sont calculées par Node
// (`packages/jump-sim/test/replay-golden.test.ts`, vérifiées à chaque `npm test`) : la solution de l'essai, des essais fictifs à graine fixe
// avec morts et reprises sur des points de passage, des vies seules parties d'un point, la galerie. Chaque navigateur (Chromium, Firefox,
// WebKit) les rejoue sur `verify.html`, sans rendu, et doit trouver exactement les mêmes empreintes (tous les états de tous les pas).

interface Fingerprinted {
  name: string;
  code: string;
  hash: string;
  finished: boolean;
  ticks: number;
  time: number;
  deaths: number;
}
const golden = JSON.parse(readFileSync(new URL("../../../packages/jump-sim/test/fixtures/replay-golden.json", import.meta.url), "utf8")) as {
  solution: { code: string; ticks: number; time: number };
  replays: Fingerprinted[];
};

interface VerifyResult {
  hash: string;
  finished: boolean;
  ticks: number;
  time: number;
  deaths: number;
  lives: number;
}

test("le navigateur rejoue chaque rediffusion de référence et trouve exactement l'empreinte de Node", async ({ page }) => {
  await page.goto("/verify.html");
  await page.waitForSelector("html[data-ready=true]");
  expect(golden.replays.length).toBeGreaterThanOrEqual(12);
  expect(golden.replays.some((r) => r.deaths >= 2)).toBe(true);
  const results = await page.evaluate((codes) => codes.map((c) => (window as unknown as { __verify(code: string): VerifyResult }).__verify(c)), golden.replays.map((r) => r.code));
  golden.replays.forEach((ref, i) => {
    const got = results[i]!;
    expect({ name: ref.name, hash: got.hash, finished: got.finished, ticks: got.ticks, time: got.time, deaths: got.deaths }).toEqual({
      name: ref.name,
      hash: ref.hash,
      finished: ref.finished,
      ticks: ref.ticks,
      time: ref.time,
      deaths: ref.deaths,
    });
  });
  // La solution : le temps de l'auteur.
  expect(results[0]).toMatchObject({ finished: true, time: golden.solution.time, deaths: 0, lives: 1 });
});

test("une rediffusion falsifiée ne donne pas la même empreinte (ou elle est refusée)", async ({ page }) => {
  await page.goto("/verify.html");
  await page.waitForSelector("html[data-ready=true]");
  const code = golden.solution.code;
  const at = Math.floor(code.length / 2);
  const tampered = code.slice(0, at) + (code[at] === "A" ? "B" : "A") + code.slice(at + 1);
  const outcome = await page.evaluate((c) => {
    try {
      return { hash: (window as unknown as { __verify(code: string): VerifyResult }).__verify(c).hash };
    } catch (e) {
      return { error: String(e) };
    }
  }, tampered);
  if ("hash" in outcome) expect(outcome.hash).not.toBe(golden.replays[0]!.hash);
  else expect(outcome.error).toContain("JumpReplayError");
});
