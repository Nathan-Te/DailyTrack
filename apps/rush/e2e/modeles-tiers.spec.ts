import { expect, test, type Page } from "@playwright/test";
import { API, appareil, lancer } from "./appareil";

// Lot BR-A3 : les modèles tiers (l'essai de style). En CI les fichiers n'existent pas (ils ne sont jamais commités : le dépôt est public) : le jeu doit le constater et garder ses formes procédurales.
// Sur la machine de Nathan (après `npm run modeles-tiers -w @cdj/rush`), les mêmes tests vérifient que les modèles remplacent les formes et que leurs clips suivent la simulation.
// Rien n'est sauté : chaque test lit ce que le serveur sert vraiment et vérifie le comportement qui en découle.
const BASE = `/?api=${API}&debug&manuel&tactile=0`;
interface Tiers {
  prets: boolean;
  modeles: string[];
  chevalier: string | null;
  boss: string | null;
  monstres: string[];
}
const tiers = (page: Page): Promise<Tiers> => page.evaluate(() => (window.__rush as unknown as { tiers(): Tiers }).tiers());
const servi = (page: Page, nom: string): Promise<boolean> =>
  page.evaluate(async (n) => {
    const r = await fetch(`modeles-tiers/${n}.glb`);
    return r.ok && /gltf|octet|model/.test(r.headers.get("content-type") ?? "");
  }, nom);

test.describe("les modèles tiers (lot BR-A3)", () => {
  test("le chargement suit les fichiers servis : un modèle présent remplace la forme, un absent la laisse ; `&modeles=0` ne charge rien", async ({ browser }) => {
    const { context, page } = await appareil(browser, `${BASE}&scenario=vitrine`);
    await lancer(page, null);
    await page.waitForFunction(() => (window.__rush as unknown as { tiers(): Tiers }).tiers().prets, null, { timeout: 20_000 });
    const t = await tiers(page);
    for (const nom of ["chevalier", "golem", "gelee", "chauve-souris"]) expect(t.modeles.includes(nom), nom).toBe(await servi(page, nom));
    await page.evaluate(() => {
      window.__jeu.avancer(2);
      window.__rush.dessinerMaintenant();
    });
    const apres = await tiers(page);
    expect(apres.chevalier !== null).toBe(t.modeles.includes("chevalier"));
    expect(apres.boss !== null).toBe(t.modeles.includes("golem"));
    // la vitrine : 4 gelées et 2 chauves-souris ; un acteur tiers par monstre converti
    const attendus = (t.modeles.includes("gelee") ? 4 : 0) + (t.modeles.includes("chauve-souris") ? 2 : 0);
    expect(apres.monstres).toHaveLength(attendus);
    await context.close();

    const sans = await appareil(browser, `${BASE}&scenario=vitrine&modeles=0`);
    await lancer(sans.page, null);
    await sans.page.waitForTimeout(500);
    const t0 = await tiers(sans.page);
    expect(t0.prets).toBe(false);
    expect(t0.modeles).toEqual([]);
    await sans.context.close();
  });

  test("le golem joue le clip de l'état de la sim : l'annonce pendant une annonce, la marche ou l'attente sinon", async ({ browser }) => {
    const { context, page } = await appareil(browser, `${BASE}&scenario=boss&boss=golem&competence=tourbillon`);
    await lancer(page);
    await page.waitForFunction(() => (window.__rush as unknown as { tiers(): Tiers }).tiers().prets, null, { timeout: 20_000 });
    const golem = (await tiers(page)).modeles.includes("golem");
    // avancer jusqu'à la première annonce du golem (état 1)
    const etat = await page.evaluate(() => {
      for (let i = 0; i < 1200; i++) {
        window.__jeu.avancer(1);
        if (window.__rush.partie().golem?.etat === 1) break;
      }
      window.__rush.dessinerMaintenant();
      return window.__rush.partie().golem?.etat;
    });
    expect(etat).toBe(1);
    expect((await tiers(page)).boss).toBe(golem ? "annonce" : null);
    await context.close();
  });

  test("le chevalier frappe : le clip du coup de l'enchaînement, puis il revient à l'attente", async ({ browser }) => {
    const { context, page } = await appareil(browser, `${BASE}&scenario=mannequin&competence=tourbillon`);
    await lancer(page);
    await page.waitForFunction(() => (window.__rush as unknown as { tiers(): Tiers }).tiers().prets, null, { timeout: 20_000 });
    const chevalier = (await tiers(page)).modeles.includes("chevalier");
    await page.evaluate(() => {
      window.__rush.forcer(1 << 6, 3); // le bit du coup
      window.__jeu.avancer(8);
      window.__rush.dessinerMaintenant();
    });
    expect((await tiers(page)).chevalier).toBe(chevalier ? "coup1" : null);
    await page.evaluate(() => {
      window.__jeu.avancer(120);
      window.__rush.dessinerMaintenant();
    });
    expect((await tiers(page)).chevalier).toBe(chevalier ? "attente" : null);
    await context.close();
  });
});
