import { expect, test, type Page } from "@playwright/test";
import { dailyRush } from "@cdj/rush-sim";
import { parseDay } from "@cdj/core";
import { appareil, JOUR, lancer } from "./appareil";
import { MODELE_BOSS, modelesDuContenu, NOMS_MODELES } from "../src/modeles";

// « Rush » (lot BR-A1) — les MODÈLES (Blender → glTF compressé) dans le vrai jeu construit : la partie ne charge que les modèles du jour (le boss du jour, les monstres présents), le bestiaire et la horde les
// dessinent sous 200 appels en haute et en basse qualité (60 monstres, des vases qui éclatent), et sans modèle (réseau coupé) le jeu se joue avec les formes d'avant.
const modelesCharges = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .filter((n) => /\/modeles\/[^/]+\.glb$/.test(n))
      .map((n) => n.split("/").pop()!.replace(/\.glb$/, "")),
  );

test.describe("Rush : les modèles (lot BR-A1)", () => {
  test("le jour ne charge que ses modèles : le chevalier, les vases, le boss DU JOUR et les monstres de son niveau", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&scenario=jour&jour=${JOUR}`);
    await lancer(page);
    const charges = (await modelesCharges(page)).sort();
    const attendus = modelesDuContenu(dailyRush(parseDay(JOUR)!)).sort();
    expect(charges).toEqual(attendus);
    const boss = dailyRush(parseDay(JOUR)!).boss;
    for (const b of MODELE_BOSS) if (b !== MODELE_BOSS[boss]) expect(charges).not.toContain(b);
    await context.close();
  });

  test("le bestiaire des boss et celui des monstres : tous les modèles, sous 200 appels de dessin", async ({ browser }) => {
    for (const scenario of ["bestiaire", "bestiaire-monstres"]) {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&scenario=${scenario}`);
      await lancer(page, null);
      await page.evaluate(() => {
        window.__jeu.avancer(2);
        window.__rush.dessinerMaintenant();
      });
      const charges = await modelesCharges(page);
      if (scenario === "bestiaire") for (const b of MODELE_BOSS) expect(charges).toContain(b);
      else for (const n of ["gelee", "gelaton", "chauve-souris", "cracheur", "chaman", "totem", "porte-bouclier", "couronne"]) expect(charges).toContain(n);
      expect(await page.evaluate(() => window.__rush.calls())).toBeLessThan(200);
      await context.close();
    }
  });

  test("la horde au tourbillon : des dizaines de gélatons, des vases qui éclatent en éclats modélisés, sous 200 appels en haute et en basse qualité", async ({ browser }) => {
    for (const q of ["haute", "basse"] as const) {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&scenario=horde&competence=tourbillon&qualite=${q}`);
      await lancer(page);
      const r = await page.evaluate(() => {
        window.__jeu.avancer(75);
        const p = window.__rush.partie() as unknown as { vases: { x: number; y: number; id: number }[]; monstres: unknown[] };
        const avant = p.vases.filter((v) => v.id >= 0).length;
        const v = p.vases.find((x) => x.id >= 0)!;
        window.__rush.aller(v.x / 4096 + 0.7, v.y / 4096 + 0.7);
        window.__jeu.action("competence");
        window.__jeu.avancer(16);
        window.__rush.dessinerMaintenant();
        const apres = (window.__rush.partie() as unknown as { vases: { id: number }[] }).vases.filter((x) => x.id >= 0).length;
        return { avant, apres, monstres: p.monstres.length, appels: window.__rush.calls(), sons: window.__rush.sons() };
      });
      expect(r.monstres).toBeGreaterThanOrEqual(30);
      expect(r.apres).toBeLessThan(r.avant); // des vases ont cédé
      expect(r.appels).toBeLessThan(200);
      await context.close();
    }
  });

  test("60 monstres de tous les types (élites comprises) : sous 200 appels de dessin en haute et en basse qualité", async ({ browser }) => {
    for (const q of ["haute", "basse"] as const) {
      const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&scenario=arene&monstres=60&qualite=${q}`);
      await lancer(page);
      await page.evaluate(() => {
        window.__jeu.avancer(600);
        window.__rush.dessinerMaintenant();
      });
      expect(await page.evaluate(() => window.__rush.calls())).toBeLessThan(200);
      await context.close();
    }
  });

  test("sans les modèles (réseau coupé), le jeu se lance et se joue avec les formes d'avant", async ({ browser }) => {
    // un contexte à la main : la route doit être posée AVANT le premier chargement (l'accueil demande déjà le contenu, donc les modèles)
    const context = await browser.newContext({ baseURL: "http://localhost:4181", locale: "fr-FR" });
    await context.addInitScript(() => localStorage.setItem("rush:aide:vu", "1"));
    await context.route("**/modeles/*.glb", (r) => r.abort());
    const page = await context.newPage();
    await page.goto(`/?debug&manuel&tactile=0&scenario=boss&boss=golem`);
    await page.waitForSelector("#jeu-jouer", { state: "attached" });
    await lancer(page);
    await page.evaluate(() => {
      window.__jeu.avancer(120);
      window.__rush.dessinerMaintenant();
    });
    expect(await page.evaluate(() => window.__rush.partie().tick)).toBeGreaterThan(100);
    await expect(page.locator(".rush-monde canvas")).toBeVisible();
    expect(NOMS_MODELES.length).toBe(19);
    await context.close();
  });
});
