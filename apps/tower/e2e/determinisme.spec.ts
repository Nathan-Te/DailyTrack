import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

// Lot T0 : déterminisme entre moteurs JavaScript. Les empreintes de référence sont calculées par Node (`packages/tower-sim/test/banc.test.ts`, vérifiées à chaque
// `npm test`) pour le moteur A (entiers) et le moteur B (Rapier déterministe, WebAssembly) : le banc d'essai (40 pièces et un effondrement) et la tour propre pendant 30 s,
// avec une empreinte intermédiaire toutes les 5 s. Chaque navigateur (Chromium, Firefox, WebKit) les rejoue sur `verify.html` et doit trouver exactement les mêmes.
// Un moteur qui diffère n'est pas une erreur du lot : c'est un résultat (le message nomme le premier pas où l'empreinte s'écarte).

interface Trace {
  tick: number;
  empreinte: string;
}
interface Verification {
  banc: { empreinte: string; traces: Trace[]; tombees: number; ticks: number };
  tour: { empreinte: string; traces: Trace[] };
  ms: number;
}
interface Golden {
  a: Pick<Verification, "banc" | "tour">;
  b: Pick<Verification, "banc" | "tour">;
}
const golden = JSON.parse(readFileSync(new URL("../../../packages/tower-sim/test/fixtures/banc-golden.json", import.meta.url), "utf8")) as Golden;

/** Le premier pas où deux séries d'empreintes diffèrent (null : identiques). */
function premierEcart(a: Trace[], b: Trace[]): number | null {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if (a[i]?.empreinte !== b[i]?.empreinte) return a[i]?.tick ?? b[i]?.tick ?? -1;
  return null;
}

for (const moteur of ["a", "b"] as const) {
  test(`moteur ${moteur.toUpperCase()} : le navigateur rejoue le banc et la tour propre et trouve exactement les empreintes de Node`, { tag: "@navigateurs" }, async ({ page }, info) => {
    await page.goto("/verify.html");
    await page.waitForSelector("html[data-ready=true]");
    const v = await page.evaluate((m) => (window as unknown as { __verifier(m: string): Promise<Verification> }).__verifier(m), moteur);
    info.annotations.push({ type: "durée", description: `${Math.round(v.ms)} ms` });
    const ref = golden[moteur];
    expect({ premierEcartBanc: premierEcart(v.banc.traces, ref.banc.traces), premierEcartTour: premierEcart(v.tour.traces, ref.tour.traces) }).toEqual({ premierEcartBanc: null, premierEcartTour: null });
    expect(v.banc.empreinte).toBe(ref.banc.empreinte);
    expect(v.banc.tombees).toBe(ref.banc.tombees);
    expect(v.tour.empreinte).toBe(ref.tour.empreinte);
  });
}

test("la page de démonstration charge le moteur A et dessine le banc", async ({ page }) => {
  await page.goto("/?scenario=banc&engine=a");
  await page.waitForSelector("html[data-ready=true]");
  await expect(page.locator("#hud")).toContainText("moteur maison");
  await page.waitForFunction(() => /pas [1-9]/.test(document.getElementById("hud")!.textContent ?? ""));
  const pixels = await page.evaluate(() => {
    const c = document.getElementById("scene") as HTMLCanvasElement;
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let colores = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3]! > 0) colores++;
    return colores;
  });
  expect(pixels).toBeGreaterThan(1000);
});

test("la page de démonstration charge le moteur B (Rapier) à la demande et le mode libre lâche une pièce au clavier", async ({ page }) => {
  await page.goto("/?scenario=banc&engine=b&libre&debug&tune");
  await page.waitForSelector("html[data-ready=true]");
  await expect(page.locator("#hud")).toContainText("Rapier");
  await expect(page.locator("#reglages")).toBeVisible();
  await page.keyboard.press("Space");
  await page.waitForFunction(() => /pièces 1/.test(document.getElementById("hud")!.textContent ?? ""));
});
