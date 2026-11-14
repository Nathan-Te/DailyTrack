import { dailyGravity, jouer, piloter, terrainDuJour, type Resultat } from "@cdj/gravity-sim";
import { parseDay } from "@cdj/core";
import type { Browser, BrowserContext, Page } from "@playwright/test";

// Un appareil neuf : l'horloge du serveur d'essai (le 06/11/2026 à midi UTC, comme `GRAVITY_AUJOURDHUI`), l'aide « Comment jouer » déjà vue (elle a son propre test), les droits du presse-papiers.
export const API = "http://127.0.0.1:8798";
export const JOUR = "2026-11-06";

export interface Porte {
  manuel(oui?: boolean): void;
  avancer(n: number): void;
  action(id: string): void;
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

export async function appareil(browser: Browser, adresse = `/?api=${API}&debug&manuel&tactile=0`, aideVue = true): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: "http://localhost:4188", locale: "fr-FR", permissions: ["clipboard-read", "clipboard-write"] });
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

/** La partie scriptée des essais : le pilote d'essai de la simulation joue le jour pendant `pas` pas (ses appuis sont la rediffusion) ; sans l'aide du pilote une partie d'essai meurt en quelques secondes. */
export const appuisDeLEssai = (pas = 12000): number[] => piloter(terrainDuJour(dailyGravity(parseDay(JOUR)!)), pas).appuis;

/**
 * Joue la partie du jour à la main, pas à pas : un appui (`action("toucher")`) à chaque pas de la liste, la rediffusion du jeu est donc cette liste ; puis la partie se joue seule jusqu'à la mort. Rend ce que la
 * simulation (Node, la même) attend de ces appuis.
 */
export async function jouerLeJour(page: Page, appuis: readonly number[] = appuisDeLEssai()): Promise<Resultat> {
  await page.evaluate((appuis) => {
    let t = 0;
    for (const x of appuis) {
      window.__jeu.avancer(x - t);
      t = x;
      window.__jeu.action("toucher");
    }
    window.__jeu.avancer(80000);
  }, [...appuis]);
  return jouer(terrainDuJour(dailyGravity(parseDay(JOUR)!)), appuis);
}
