import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

/** « 2026-10-13 » → « 13 oct. » (même format que l'en-tête du jeu, `src/profile.ts` : non importé ici, le projet de test ne compile pas `src`). */
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const dayShort = (d: string) => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]}`;

// Circuits du jour de référence calculés par Node (packages/sim/test/golden-daily.test.ts).
const golden = JSON.parse(readFileSync(new URL("../../../packages/sim/test/fixtures/daily-golden.json", import.meta.url), "utf8")) as {
  circuits: { date: string; number: number; attempt: number; spec: string; authorMs: number; palette: string; theme: string; trackId: string }[];
};

test("le navigateur régénère les circuits du jour de référence : même texte, même temps d'auteur, même palette", { tag: "@navigateurs" }, async ({ page }) => {
  await page.goto("/verify.html");
  await page.waitForSelector("html[data-ready=true]");
  for (const expected of golden.circuits) {
    // Lot R11 : chaque circuit de référence porte sa version (son identifiant) : les anciennes (v15, v16) ne sont plus celles du jour par défaut.
    const generator = Number(/-g(\d+)/.exec(expected.trackId)?.[1]);
    const got = await page.evaluate(([date, g]) => window.__daily(date, g), [expected.date, generator] as [string, number]);
    const { date, ...rest } = expected;
    expect(got, date).toEqual(rest);
  }
});

test("une date impossible est refusée", { tag: "@navigateurs" }, async ({ page }) => {
  await page.goto("/verify.html");
  await page.waitForSelector("html[data-ready=true]");
  const error = await page.evaluate(() => {
    try {
      window.__daily("2026-02-30");
      return null;
    } catch (e) {
      return String(e);
    }
  });
  expect(error).toContain("Date invalide");
});

// Le rendu 3D demande WebGL : Chromium seulement (la génération, elle, est vérifiée partout ci-dessus).
test.describe("jeu (rendu 3D)", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");

  // Une date d'avant le lancement (13/10/2026 : pas de numéro) et une d'après (numéro affiché). Lot R13 : le 07/10 (deuxième date d'avant, mêmes
  // vérifications) est retiré ; « trois dates, trois circuits » aussi (les identifiants de référence distincts : « au bit près » ci-dessous).
  for (const date of ["2026-10-06", "2026-12-25"]) {
    test(`?seed=${date} : le circuit se charge, se joue, et affiche son titre et ses médailles`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

      await page.goto(`/?debug&seed=${date}`);
      await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 20_000 });
      const expected = golden.circuits.find((c) => c.date === date)!;
      if (expected.number >= 1) await expect(page.locator("#meta")).toContainText(`n° ${expected.number}`);
      else await expect(page.locator("#meta")).not.toContainText("n°");
      await expect(page.locator("#meta")).toContainText(dayShort(date));
      // Lot I4 : l'objectif de médaille (plaque en haut à droite) : sans record, la première médaille à décrocher — le bronze — et son seuil.
      await expect(page.locator("#medals")).toHaveAttribute("aria-label", /Bronze/); // charte rév. 7 : pastille et seuil seulement, le nom est dans le libellé
      await expect(page.locator("#medals")).toContainText(/\d,\d{3}\ss/);

      // Pas à pas (lot 29b) : « la voiture roule » se mesure en 300 pas (2,5 s de simulation), pas en 2,5 s de temps réel — en rendu logiciel
      // la boucle ne fait que quelques pas par seconde et la distance parcourue dépendait de la charge de la machine (10,6 m relevés pour 13 attendus).
      await page.evaluate(() => window.__cdj.manual(true));
      const z0 = await page.evaluate(() => window.__cdj.car.z);
      await page.keyboard.down("KeyW");
      await page.evaluate(() => window.__cdj.advance(300));
      const z1 = await page.evaluate(() => window.__cdj.car.z);
      expect(z1).toBeGreaterThan(z0 + 5); // la voiture roule (seuil inchangé)
      expect(errors).toEqual([]);
    });
  }

  // Lot 36 : le circuit du jour se calcule dans un fil de travail (le générateur n'est plus dans le paquet du jeu) ; il doit être celui de Node, au bit près :
  // texte, tentative, temps de l'auteur, palette, thème, identifiant — les circuits de référence.
  test("le circuit calculé dans le fil de travail du jeu est celui de Node, au bit près", async ({ page }) => {
    test.setTimeout(240_000);
    for (const expected of golden.circuits.filter((c) => ["2026-10-06", "2026-10-21", "2026-11-05", "2026-12-25"].includes(c.date))) {
      await page.goto(`/?debug&seed=${expected.date}`);
      await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 60_000 });
      const got = await page.evaluate(() => window.__cdj.circuit);
      expect(got, expected.date).toMatchObject({ number: expected.number, attempt: expected.attempt, spec: expected.spec, authorMs: expected.authorMs, palette: expected.palette, theme: expected.theme, trackId: expected.trackId, fallback: false });
    }
  });

  test("une date invalide retombe sur le circuit d'aujourd'hui, en le disant", async ({ page }) => {
    await page.goto("/?debug&seed=pas-une-date");
    await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 20_000 });
    await expect(page.locator("#meta")).toContainText("date invalide");
  });

});
