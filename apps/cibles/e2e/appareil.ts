import { dailyCibles, jouer, VARIANTE, type Resultat } from "@cdj/cibles-sim";
import { parseDay } from "@cdj/core";
import type { Browser, BrowserContext, Page } from "@playwright/test";

// Un appareil neuf : l'horloge du serveur d'essai (le 06/11/2026 à midi UTC, comme `CIBLES_AUJOURDHUI`), l'aide « Comment jouer » déjà vue (elle a son propre test), les droits du presse-papiers.
export const API = "http://127.0.0.1:8793";
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
  const context = await browser.newContext({ baseURL: "http://localhost:4176", locale: "fr-FR", permissions: ["clipboard-read", "clipboard-write"] });
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
      if (aideVue) localStorage.setItem("cibles:aide:vu", "1");
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

/**
 * Joue la partie du jour à la main, pas à pas : une touche sur la case de chaque cible, `delai` ticks après son apparition (la rediffusion du jeu est donc la suite de ces touches). `sauf` : les rangs des cibles
 * qu'on laisse filer (variante « score ») ou sur lesquelles on hésite (variante « temps »). Rend ce que la simulation (Node, la même) attend de ces touches.
 */
export async function jouerLeJour(page: Page, delai = 15, sauf: readonly number[] = []): Promise<Resultat> {
  const contenu = dailyCibles(parseDay(JOUR)!);
  const touches = VARIANTE.joueur(contenu, () => delai, (i) => sauf.includes(i));
  await page.evaluate((touches) => {
    let t = 0;
    for (const x of touches) {
      window.__jeu.avancer(x.tick - t);
      t = x.tick;
      window.__jeu.action(`case:${x.c}`);
    }
    window.__jeu.avancer(1000);
  }, touches);
  return jouer(contenu, touches);
}
