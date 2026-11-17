import { dailyGravity, jouer, jouerRobot, terrainDuJour, type Resultat } from "@cdj/gravity-sim";
import { parseDay } from "@cdj/core";
import type { Browser, BrowserContext, BrowserContextOptions, Page } from "@playwright/test";

// Un appareil neuf : l'horloge du serveur d'essai (le 06/11/2026 à midi UTC, comme `GRAVITY_AUJOURDHUI`), l'aide « Comment jouer » déjà vue (elle a son propre test), les droits du presse-papiers.
export const API = "http://127.0.0.1:8798";
export const JOUR = "2026-11-06";

export interface Porte {
  manuel(oui?: boolean): void;
  avancer(n: number): void;
  action(id: string): void;
  /** Lot GR6 : l'action tenue est relâchée (le doigt se lève). */
  relacher(id: string): void;
  phase(): "jeu" | "pause" | "fin";
  envoi(): { statut: string; code: string; rang: number | null };
  score(): number[] | null;
  rediffusion(): string | null;
}
declare global {
  interface Window {
    __jeu: Porte;
  }
}

export async function appareil(browser: Browser, adresse = `/?api=${API}&debug&manuel&tactile=0`, aideVue = true, options: BrowserContextOptions = {}): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: "http://localhost:4188", locale: "fr-FR", permissions: ["clipboard-read", "clipboard-write"], ...options });
  const decalage = Date.UTC(2026, 10, 6, 12) - Date.now();
  await context.addInitScript(
    ({ decalage, aideVue }) => {
      const Reel = Date;
      class Decale extends Reel {
        constructor(...args: unknown[]) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          super(...((args.length === 0 ? [Reel.now() + decalage] : args) as [any]));
        }
        static override now() {
          return Reel.now() + decalage;
        }
      }
      (globalThis as { Date: DateConstructor }).Date = Decale as unknown as DateConstructor;
      if (aideVue) localStorage.setItem("gravity:aide:vu", "1");
    },
    { decalage, aideVue },
  );
  const page = await context.newPage();
  await page.goto(adresse);
  await page.waitForSelector("#jeu-jouer", { state: "attached" });
  return { context, page };
}

/** Lance la partie du jour (JOUER) : l'adresse porte `?debug&manuel`, la partie ne joue que pas à pas — rien ne dépend de l'horloge de la page. */
export async function lancer(page: Page): Promise<void> {
  await page.locator("#jeu-jouer").click();
  await page.waitForFunction(() => !!(window as unknown as { __jeu?: unknown }).__jeu);
}

/** La partie scriptée des essais : le robot de la simulation joue le jour pendant `pas` pas (ses changements du bouton sont la rediffusion) ; sans l'aide du robot une partie d'essai meurt en quelques secondes. */
export const changementsDeLEssai = (pas = 12000): number[] => jouerRobot(terrainDuJour(dailyGravity(parseDay(JOUR)!)), { maxTicks: pas }).changements;

/**
 * Joue la partie du jour à la main, pas à pas : le doigt se pose (`action("toucher")`) puis se lève (`relacher("toucher")`) à chaque pas de la liste — le premier est un appui, ils alternent —, la rediffusion du jeu est donc cette
 * liste (lot GR6 : l'entrée est l'état du bouton) ; puis la partie se joue seule jusqu'à la mort. Rend ce que la simulation (Node, la même) attend de ces changements.
 */
export async function jouerLeJour(page: Page, changements: readonly number[] = changementsDeLEssai()): Promise<Resultat> {
  await page.evaluate((changements) => {
    let t = 0;
    changements.forEach((x, i) => {
      window.__jeu.avancer(x - t);
      t = x;
      if (i % 2 === 0) window.__jeu.action("toucher");
      else window.__jeu.relacher("toucher");
    });
    window.__jeu.avancer(80000);
  }, [...changements]);
  return jouer(terrainDuJour(dailyGravity(parseDay(JOUR)!)), changements);
}
