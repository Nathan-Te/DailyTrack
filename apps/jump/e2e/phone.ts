import type { Browser, BrowserContext, CDPSession, Page } from "@playwright/test";

// Outils communs des tests tactiles (lots 1b et 2) : WebGL présent ?, un téléphone émulé, des doigts posés sur l'écran.

export const hasWebGL = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  });

/** Un téléphone : écran tactile, et (Chromium) émulation mobile complète. Le contexte se ferme à la fin du test. */
export async function withPhone(browser: Browser, viewport: { width: number; height: number }, run: (page: Page, context: BrowserContext) => Promise<void>): Promise<void> {
  const chromium = browser.browserType().name() === "chromium";
  const context = await browser.newContext({ viewport, hasTouch: true, ...(chromium ? { isMobile: true, deviceScaleFactor: 2 } : {}) });
  try {
    await run(await context.newPage(), context);
  } finally {
    await context.close();
  }
}

/** Doigts posés sur l'écran, envoyés comme sur un téléphone (plusieurs à la fois). */
export class Fingers {
  private readonly points = new Map<number, { x: number; y: number }>();
  private constructor(
    private readonly page: Page,
    private readonly cdp: CDPSession | null,
  ) {}

  static async on(page: Page): Promise<Fingers> {
    const cdp = page.context().browser()?.browserType().name() === "chromium" ? await page.context().newCDPSession(page) : null;
    return new Fingers(page, cdp);
  }

  private async send(type: "touchStart" | "touchMove" | "touchEnd", all: Map<number, { x: number; y: number }>) {
    await this.cdp!.send("Input.dispatchTouchEvent", { type, touchPoints: [...all].map(([id, p]) => ({ id, x: p.x, y: p.y })) });
  }

  private async synthetic(type: "pointerdown" | "pointermove" | "pointerup", id: number, x: number, y: number) {
    await this.page.evaluate(
      ([t, i, px, py]) => {
        const layer = document.getElementById("touch")!;
        layer.dispatchEvent(new PointerEvent(t as string, { pointerId: (i as number) + 100, pointerType: "touch", clientX: px as number, clientY: py as number, bubbles: true, cancelable: true, isPrimary: i === 1 }));
      },
      [type, id, x, y] as const,
    );
  }

  async down(id: number, x: number, y: number) {
    this.points.set(id, { x, y });
    if (this.cdp) await this.send("touchStart", this.points);
    else await this.synthetic("pointerdown", id, x, y);
  }

  async move(id: number, x: number, y: number) {
    this.points.set(id, { x, y });
    if (this.cdp) await this.send("touchMove", this.points);
    else await this.synthetic("pointermove", id, x, y);
  }

  async up(id: number) {
    const p = this.points.get(id)!;
    this.points.delete(id);
    if (this.cdp) await this.send("touchEnd", new Map([[id, p]])); // pour touchEnd, le protocole attend le doigt qu'on lève
    else await this.synthetic("pointerup", id, p.x, p.y);
  }
}
