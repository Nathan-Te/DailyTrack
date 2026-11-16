import { expect, test, type Page } from "@playwright/test";
import { appareil, lancer } from "./appareil";

// « Pinball » (lot PB5b) — LE CADRAGE DU HUD (**famille « Régression »**, `e2e.regression` de la fiche : haute qualité, sept écrans, une dizaine de secondes) : la table tient **entre** les deux bandes du HUD (ou à côté de sa marge de gauche en paysage), aucune plaque ne la
// recouvre, toutes les plaques sont dans l'écran. Lot PBG1 : le compteur de combo en fait partie — il est toujours posé dans la grille (caché par `visibility`), donc mesuré même sans combo. Haute qualité : c'est elle qu'on cadre (`__pinball.trois()` dit où tombent les coins du terrain à l'écran et la zone libre). Les marges de sécurité de l'iPhone
// (`env(safe-area-inset-*)`) ne se simulent pas ici : la feuille les met dans la grille **et** dans le gabarit de la table, par construction (`hud.css`) — le test relit le gabarit mesuré, jamais une valeur écrite.
const ECRANS: { nom: string; l: number; h: number; pc: boolean }[] = [
  { nom: "portrait 390 × 844", l: 390, h: 844, pc: false },
  { nom: "portrait 360 × 640", l: 360, h: 640, pc: false },
  { nom: "paysage 844 × 390", l: 844, h: 390, pc: false },
  { nom: "paysage 667 × 375", l: 667, h: 375, pc: false },
  { nom: "paysage 640 × 360", l: 640, h: 360, pc: false },
  { nom: "tablette 1024 × 768", l: 1024, h: 768, pc: false },
  { nom: "ordinateur 1440 × 900", l: 1440, h: 900, pc: true },
];
/** Les plaques du HUD (hors aide d'avant le lancer, qui peut recouvrir le haut du meuble) et leurs rectangles à l'écran. */
const PLAQUES = ".pinball-hud__bouton, .pinball-hud__afficheur, .pinball-hud__mult, .pinball-mission, .pinball-hud__billes, .pinball-hud__clavier, .pinball-combo";

async function rectangles(page: Page): Promise<{ nom: string; x: number; y: number; l: number; h: number }[]> {
  return page.evaluate((sel) => [...document.querySelectorAll<HTMLElement>(sel)].filter((e) => e.getClientRects().length > 0).map((e) => { const r = e.getBoundingClientRect(); return { nom: e.className.split(" ")[0]!, x: r.left, y: r.top, l: r.width, h: r.height }; }), PLAQUES);
}

test.describe("Pinball : le cadrage du HUD", () => {
  test("la table tient entre les bandes du HUD, aucune plaque ne la recouvre, sur sept écrans", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=1&qualite=haute");
    await page.setViewportSize({ width: 390, height: 844 });
    await lancer(page);
    for (const e of ECRANS) {
      await page.setViewportSize({ width: e.l, height: e.h });
      await page.evaluate(() => window.__jeu.avancer(5));
      const info = (await page.evaluate(() => window.__pinball!.trois()))!;
      // le cadrage : le sommet de l'arc, les épaules et les coins bas sont à l'image **de la zone libre** (de -1 à 1 : son bord)
      expect(info.cadre.x, e.nom).toBeLessThanOrEqual(1);
      expect(info.cadre.y0, e.nom).toBeGreaterThanOrEqual(-1);
      expect(info.cadre.y1, e.nom).toBeLessThanOrEqual(1);
      expect(Math.max(info.cadre.x, -info.cadre.y0, info.cadre.y1), `${e.nom} : la table remplit sa zone`).toBeGreaterThan(0.85);
      // la zone libre est dans l'écran, et la table (des épaules au bas du terrain) dans la zone libre
      const { x, y, l, h } = info.libre;
      expect(x, e.nom).toBeGreaterThanOrEqual(-0.5);
      expect(y + h, e.nom).toBeLessThanOrEqual(e.h + 0.5);
      expect(x + l, e.nom).toBeLessThanOrEqual(e.l + 0.5);
      const xs = info.table.map((p) => p[0]);
      const ys = info.table.map((p) => p[1]);
      const table = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
      expect(table.x0, `${e.nom} : le bord gauche de la table`).toBeGreaterThanOrEqual(x - 1);
      expect(table.x1, `${e.nom} : le bord droit de la table`).toBeLessThanOrEqual(x + l + 1);
      expect(table.y0, `${e.nom} : les épaules de la table`).toBeGreaterThanOrEqual(y - 1);
      expect(table.y1, `${e.nom} : le bas de la table`).toBeLessThanOrEqual(y + h + 1);
      // aucune plaque ne recouvre la table, et toutes tiennent dans l'écran
      for (const r of await rectangles(page)) {
        expect(r.x, `${e.nom} : ${r.nom} dans l'écran`).toBeGreaterThanOrEqual(0);
        expect(r.y, `${e.nom} : ${r.nom} dans l'écran`).toBeGreaterThanOrEqual(0);
        expect(r.x + r.l, `${e.nom} : ${r.nom} dans l'écran`).toBeLessThanOrEqual(e.l);
        expect(r.y + r.h, `${e.nom} : ${r.nom} dans l'écran`).toBeLessThanOrEqual(e.h);
        const dedans = r.x < table.x1 && r.x + r.l > table.x0 && r.y < table.y1 && r.y + r.h > table.y0;
        expect(dedans, `${e.nom} : ${r.nom} ne recouvre pas la table`).toBe(false);
      }
    }
    await context.close();
  });

});
