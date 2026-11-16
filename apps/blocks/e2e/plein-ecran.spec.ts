import { expect, test, type Page } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// Lot K9 — le bouton plein écran dans le HUD de la partie d'un jeu du kit (Blocks), en portrait comme en paysage, et l'orientation qu'il verrouille (celle du moment : Blocks ne force pas le paysage).
// **Famille « Régression »** (`e2e.regression` de la fiche de Blocks) : l'Essentiel d'une PR large n'a plus une seconde de marge dans ses 900 s (`apps/web/test/ciZones.test.ts`, « le budget ») ; il tourne quand une PR le modifie
// (celle du lot K9), dans la CI complète de `main` et la nuit.
// **Ce que ce spec ne prouve pas** : le vrai verrouillage d'orientation ne se fait que sur un téléphone Android (Chromium de bureau : pas de verrou, pas de rotation). Le spec remplace donc `requestFullscreen`,
// `screen.orientation.lock` et `screen.orientation.type` par des témoins posés **avant JOUER** (le HUD lit `fullscreenEnabled` à sa création) et vérifie ce que le bouton leur demande.
interface Temoins {
  entrees: number;
  verrous: string[];
}
declare global {
  interface Window {
    __temoins: Temoins;
  }
}

async function poserLesTemoins(page: Page, pleinEcranPossible = true): Promise<void> {
  await page.evaluate((possible) => {
    const t: Temoins = { entrees: 0, verrous: [] };
    window.__temoins = t;
    Object.defineProperty(Document.prototype, "fullscreenEnabled", { configurable: true, get: () => possible });
    Element.prototype.requestFullscreen = async () => void (t.entrees += 1);
    // Une fenêtre plus haute que large est un écran en portrait : le type suit la fenêtre, comme sur un téléphone.
    Object.defineProperty(ScreenOrientation.prototype, "type", { configurable: true, get: () => (innerHeight > innerWidth ? "portrait-primary" : "landscape-primary") });
    ScreenOrientation.prototype.lock = async (o: string) => void t.verrous.push(o);
  }, pleinEcranPossible);
}

const boite = async (page: Page, sel: string) => (await page.locator(sel).boundingBox())!;
const seRecouvrent = (a: { x: number; y: number; width: number; height: number }, b: typeof a) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

for (const [nom, largeur, hauteur, verrou] of [
  ["portrait 390 × 844", 390, 844, "portrait"],
  ["portrait 360 × 640", 360, 640, "portrait"],
  ["paysage 844 × 390", 844, 390, "landscape"],
] as const) {
  test(`Blocks : le plein écran est dans le HUD de la partie, ${nom}, et garde l'orientation du moment`, async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0");
    await page.setViewportSize({ width: largeur, height: hauteur });
    await poserLesTemoins(page);
    await lancer(page);
    const plein = page.locator("#jeu-hud-plein-ecran");
    await expect(plein).toBeVisible();
    await expect(plein).toHaveAttribute("aria-label", "Plein écran");
    // 44 px au moins, dans la fenêtre, sans toucher la pause ni le fantôme.
    const b = await boite(page, "#jeu-hud-plein-ecran");
    expect(b.width).toBeGreaterThanOrEqual(44);
    expect(b.height).toBeGreaterThanOrEqual(44);
    expect(b.x).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(largeur);
    for (const autre of ["#jeu-hud-pause", "#jeu-hud-fantome"]) {
      if (await page.locator(autre).count()) expect(seRecouvrent(b, await boite(page, autre)), `le plein écran recouvre ${autre}`).toBe(false);
    }
    await plein.click();
    const temoins = await page.evaluate(() => window.__temoins);
    expect(temoins.entrees).toBe(1);
    expect(temoins.verrous).toEqual([verrou]); // jamais « landscape » en portrait : c'était le défaut du lot K9
    expect(await page.evaluate(() => window.__jeu.phase())).toBe("jeu"); // hors iPhone, le bouton ne met pas la partie en pause
    await context.close();
  });
}

test("Blocks : sans plein écran possible (ni API, ni écran tactile), le bouton est absent du HUD", async ({ browser }) => {
  const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0");
  await page.setViewportSize({ width: 390, height: 844 });
  await poserLesTemoins(page, false);
  await lancer(page);
  await expect(page.locator("#jeu-hud-pause")).toBeVisible();
  await expect(page.locator("#jeu-hud-plein-ecran")).toBeHidden();
  await context.close();
});
