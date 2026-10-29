import { expect, type Page } from "@playwright/test";

// Lot I5 : aides de mise en page des tests de téléphone de Jump (sur le modèle de apps/web/e2e/layout.ts) : rien ne doit se chevaucher ni dépasser de
// l'écran, et **le centre reste libre** pendant la partie (charte rév. 7, § 9).
export type Box = { name: string; x: number; y: number; w: number; h: number };

/** Les boîtes visibles des sélecteurs (un sélecteur absent ou caché est sauté). */
export async function boxes(page: Page, selectors: string[]): Promise<Box[]> {
  const out: Box[] = [];
  for (const sel of selectors) {
    const loc = page.locator(sel);
    const n = await loc.count();
    for (let i = 0; i < n; i++) {
      const item = loc.nth(i);
      if (!(await item.isVisible())) continue;
      const b = await item.boundingBox();
      if (b && b.width > 0 && b.height > 0) out.push({ name: n > 1 ? `${sel}[${i}]` : sel, x: b.x, y: b.y, w: b.width, h: b.height });
    }
  }
  return out;
}

export function expectNoOverlap(list: Box[], viewport: { width: number; height: number }) {
  for (const b of list) {
    expect(b.x, `${b.name} dépasse à gauche`).toBeGreaterThanOrEqual(-1);
    expect(b.y, `${b.name} dépasse en haut`).toBeGreaterThanOrEqual(-1);
    expect(b.x + b.w, `${b.name} dépasse à droite`).toBeLessThanOrEqual(viewport.width + 1);
    expect(b.y + b.h, `${b.name} dépasse en bas`).toBeLessThanOrEqual(viewport.height + 1);
  }
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]!;
      const b = list[j]!;
      const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      expect(overlapX > 2 && overlapY > 2, `${a.name} chevauche ${b.name} (${JSON.stringify(a)} / ${JSON.stringify(b)})`).toBe(false);
    }
  }
}

/**
 * **La zone du personnage** (lot I5, charte rév. 7 : « le centre de l'écran reste libre pendant la partie ») : la caméra le suit au centre de l'image, avec
 * une avance d'au plus 4 tuiles dans le sens de la course (≈ 15 % de la largeur sur un téléphone en paysage) et, au sol, 1,5 tuile sous le centre (≈ 61 % de
 * la hauteur) ; en l'air, une zone morte de 2,5 tuiles. Rectangle retenu : **de 30 % à 70 % de la largeur, de 20 % à 64 % de la hauteur**. La bande du haut
 * (30 px) et le titre du départ au-dessus, les boutons tactiles des bords en dessous restent en dehors ; aucune plaque, aucun bouton ne doit y entrer.
 */
export function zoneCentrale(viewport: { width: number; height: number }): Box {
  return { name: "zone du personnage", x: viewport.width * 0.3, y: viewport.height * 0.2, w: viewport.width * 0.4, h: viewport.height * 0.44 };
}

/** Aucun des éléments ne touche la zone du personnage. */
export function expectCentreLibre(list: Box[], viewport: { width: number; height: number }) {
  const z = zoneCentrale(viewport);
  for (const b of list) {
    const overlapX = Math.min(b.x + b.w, z.x + z.w) - Math.max(b.x, z.x);
    const overlapY = Math.min(b.y + b.h, z.y + z.h) - Math.max(b.y, z.y);
    expect(overlapX > 1 && overlapY > 1, `${b.name} entre dans la zone du personnage (${JSON.stringify(b)} / ${JSON.stringify(z)})`).toBe(false);
  }
}

/** Ce qu'on voit pendant la partie (les surimpressions et les boutons tactiles). */
export const SURIMPRESSIONS = ["#pausebtn", "#fullscreenbtn", "#ghostbtn", "#modetag", "#chrono", "#objectif", "#morts", "#dayline", "#toast", "#daynote", ".tbtn", "#rotate"];
