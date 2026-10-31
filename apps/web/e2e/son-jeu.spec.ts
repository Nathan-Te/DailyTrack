import { expect, test, type Page } from "./fixtures";

// Lot 55 (partie B) — le nouveau son dans le jeu : au premier geste le jeu charge, à la demande, le moteur de la voiture qu'on voit (huit boucles rendues hors ligne), la boîte
// virtuelle règle son régime, les pneus et les bruitages suivent. Personne n'écoute en CI : on lit l'état de l'extension (`__cdj.audio.ext`) — le moteur est prêt, c'est celui de la
// voiture affichée, il tourne en course, il se tait en pause, il suit le changement de voiture, il se coupe en arrière-plan, rien ne fuit après des redémarrages.
// Famille Régression (e2e/zones.json) : la CI de PR n'a pas de marge ; `npm run verifier -- --regression` le lance.
test.skip(({ browserName }) => browserName !== "chromium", "Web Audio et rendu : Chromium seulement");
test.setTimeout(120_000);

const ext = (page: Page) => page.evaluate(() => window.__cdj.audio.ext);

async function demarrer(page: Page, adresse: string) {
  await page.goto(adresse);
  await page.waitForFunction(() => window.__cdj?.phase === "racing", undefined, { timeout: 30_000 });
  await page.keyboard.down("KeyW"); // le premier geste
  await page.waitForFunction(() => window.__cdj.audio.running, undefined, { timeout: 10_000 });
  await page.waitForFunction(() => window.__cdj.audio.ext?.pret === true, undefined, { timeout: 20_000 });
}

test("le moteur de la voiture se charge au premier geste, tourne en course, se tait en pause", async ({ page }) => {
  await demarrer(page, "/?debug&scenario=pilotage&son=complet");
  const e = (await ext(page))!;
  expect(e.voiture).toBe("civile");
  expect(e.leger).toBe(false);
  expect(e.compresseur).toBe(true);
  expect(e.chargements).toBe(1);
  // En course, gaz tenu : le régime monte au-dessus du ralenti, deux boucles jouent, trois au plus pendant un passage (jamais les huit).
  await page.waitForFunction(() => (window.__cdj.audio.ext?.sources ?? 0) >= 1 && (window.__cdj.audio.ext?.rpm ?? 0) > 1500, undefined, { timeout: 15_000 });
  const roule = (await ext(page))!;
  expect(roule.sources).toBeLessThanOrEqual(3); // les deux boucles voisines du régime et celle qui vient de s'éteindre
  expect(roule.noeuds).toBeLessThan(80);
  // En pause : le jeu se tait, puis toutes les boucles s'arrêtent (rien ne tourne pour rien).
  await page.keyboard.up("KeyW");
  await page.keyboard.press("KeyP");
  await page.waitForFunction(() => window.__cdj.audio.ext?.sources === 0, undefined, { timeout: 8_000 });
});

test("la version légère n'a qu'une boucle à la fois et pas de compresseur", async ({ page }) => {
  await demarrer(page, "/?debug&scenario=pilotage&son=leger");
  const e = (await ext(page))!;
  expect(e.leger).toBe(true);
  expect(e.compresseur).toBe(false);
  await page.waitForFunction(() => (window.__cdj.audio.ext?.sources ?? 0) >= 1, undefined, { timeout: 15_000 });
  expect((await ext(page))!.sources).toBe(1);
});

test("la voiture qu'on voit change : son moteur se charge et remplace le précédent", async ({ page }) => {
  await demarrer(page, "/?debug&scenario=pilotage&voiture=roadster&couleur=1&motif=bande");
  await page.waitForFunction(() => window.__cdj.audio.ext?.voiture === "roadster", undefined, { timeout: 20_000 });
  expect((await ext(page))!.pret).toBe(true);
});

test("arrière-plan : le contexte se suspend, puis reprend au retour", async ({ page }) => {
  await demarrer(page, "/?debug&scenario=pilotage");
  const cacher = (hidden: boolean) =>
    page.evaluate((h) => {
      Object.defineProperty(document, "hidden", { value: h, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
    }, hidden);
  await cacher(true);
  await page.waitForFunction(() => !window.__cdj.audio.running, undefined, { timeout: 5_000 });
  await cacher(false);
  await page.waitForFunction(() => window.__cdj.audio.running, undefined, { timeout: 5_000 });
});

test("aucun nœud audio ne s'accumule : des redémarrages et des bruitages laissent le même nombre de nœuds", async ({ page }) => {
  await demarrer(page, "/?debug&scenario=pilotage");
  const avant = (await ext(page))!;
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("KeyR"); // recommencer : décompte, départ, bruitages
    await page.waitForTimeout(250);
  }
  await page.waitForFunction(() => window.__cdj.audio.log.length > 3, undefined, { timeout: 10_000 });
  await page.waitForTimeout(1500); // les nœuds brefs finissent leur son et se détachent
  const apres = (await ext(page))!;
  expect(apres.noeuds).toBe(avant.noeuds);
  expect(apres.brefs).toBeLessThan(40);
  expect(apres.chargements).toBe(1);
});
