import { expect, type Page } from "@playwright/test";

// Aides de mise en page des tests de téléphone : rien ne doit se chevaucher ni dépasser de l'écran.
export type Box = { name: string; x: number; y: number; w: number; h: number };

export async function boxes(page: Page, selectors: string[]): Promise<Box[]> {
  const out: Box[] = [];
  for (const sel of selectors) {
    const loc = page.locator(sel);
    if ((await loc.count()) === 0 || !(await loc.first().isVisible())) continue;
    const b = await loc.first().boundingBox();
    if (b && b.width > 0 && b.height > 0) out.push({ name: sel, x: b.x, y: b.y, w: b.width, h: b.height });
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
