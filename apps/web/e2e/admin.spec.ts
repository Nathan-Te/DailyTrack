import { expect, test } from "@playwright/test";

// Page /admin : menu des outils de test. Pas de WebGL ici (la page n'affiche pas le jeu) : tous les navigateurs.

test("le menu construit l'adresse du jeu et la lance", async ({ page }) => {
  await page.goto("/admin/");
  await expect(page.locator("h1")).toContainText("admin");
  await expect(page.locator("#launch")).toHaveAttribute("href", "../");
  await page.locator("#theme").selectOption("nuit");
  await page.locator("#date").fill("2026-10-07");
  await expect(page.locator("#url")).toContainText("?seed=2026-10-07&theme=nuit");
  await page.locator("#tune").check();
  await expect(page.locator("#url")).toContainText("debug&tune");
  // un autre scénario masque date et thème
  await page.locator('input[name="scenario"][value="surfaces"]').check();
  await expect(page.locator("#dayrow")).toBeHidden();
  await expect(page.locator("#url")).toContainText("scenario=surfaces");
  await expect(page.locator("#url")).not.toContainText("theme=");
});

test("les choix survivent au rechargement ; un raccourci les remplace ; réinitialiser les efface", async ({ page }) => {
  await page.goto("/admin/");
  await page.locator("#demo").check();
  await page.reload();
  await expect(page.locator("#demo")).toBeChecked();
  await page.getByRole("button", { name: /Réglage de la voiture/ }).click();
  await expect(page.locator("#demo")).not.toBeChecked();
  await expect(page.locator("#tune")).toBeChecked();
  await page.getByRole("button", { name: "Réinitialiser les choix" }).click();
  await expect(page.locator("#url")).toHaveText(/\/$/);
});

test("« Lancer le jeu » ouvre le jeu avec les paramètres choisis", async ({ page }) => {
  await page.goto("/admin/");
  await page.locator('input[name="scenario"][value="pilotage"]').check();
  await page.locator("#debug").check();
  await page.locator("#launch").click();
  await page.waitForURL(/scenario=pilotage&debug/);
  await page.waitForFunction(() => window.__cdj?.phase, undefined, { timeout: 30_000 });
  await expect(page.locator("#meta")).toHaveText("Circuit de pilotage");
});

test("données locales : liste et effacement", async ({ page }) => {
  await page.goto("/admin/");
  await page.evaluate(() => localStorage.setItem("cdj:best:test", "{}"));
  await page.reload();
  await expect(page.locator("#keys")).toContainText("cdj:best:test");
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Effacer les données du jeu" }).click();
  await expect(page.locator("#keys")).not.toContainText("cdj:best:test");
});
