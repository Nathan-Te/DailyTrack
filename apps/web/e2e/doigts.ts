import type { CDPSession, Page } from "@playwright/test";

/**
 * Doigts posés sur l'écran, envoyés au navigateur comme sur un écran tactile (plusieurs doigts à la fois) : `Input.dispatchTouchEvent`, de vrais évènements tactiles qui
 * deviennent des « pointer events » comme sur un téléphone. Partagé par `tactile.spec.ts` et `captures-lot52.spec.ts` (lot 52).
 */
export class Fingers {
  private readonly points = new Map<number, { x: number; y: number }>();
  constructor(private readonly cdp: CDPSession) {}
  private send(type: "touchStart" | "touchMove" | "touchEnd", points = this.points) {
    return this.cdp.send("Input.dispatchTouchEvent", { type, touchPoints: [...points].map(([id, p]) => ({ id, x: p.x, y: p.y })) });
  }
  async down(id: number, x: number, y: number) {
    this.points.set(id, { x, y });
    await this.send("touchStart");
  }
  async move(id: number, x: number, y: number) {
    this.points.set(id, { x, y });
    await this.send("touchMove");
  }
  async up(id: number) {
    // Pour `touchEnd`, le protocole attend le ou les doigts qu'on lève (et non ceux qui restent posés).
    const lifted = new Map([[id, this.points.get(id)!]]);
    this.points.delete(id);
    await this.send("touchEnd", lifted);
  }
}

export const fingersOf = async (page: Page) => new Fingers(await page.context().newCDPSession(page));
