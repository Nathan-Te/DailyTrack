import { dailyPilepoil, jouer, joueurScripte, type Resultat } from "@cdj/pilepoil-sim";
import { parseDay } from "@cdj/core";
import type { Browser, BrowserContext, Page } from "@playwright/test";

// Un appareil neuf : l'horloge du serveur d'essai (le 06/11/2026 à midi UTC, comme `PILEPOIL_AUJOURDHUI`), l'aide « Comment jouer » déjà vue (elle a son propre test), les droits du presse-papiers.
export const API = "http://127.0.0.1:8804";
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
  const context = await browser.newContext({ baseURL: "http://localhost:4191", locale: "fr-FR", permissions: ["clipboard-read", "clipboard-write"] });
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
      if (aideVue) localStorage.setItem("pilepoil:aide:vu", "1");
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
 * Joue la partie du jour à la main, pas à pas : un appui (l'action `arreter`, comme Espace ou un toucher) quand le curseur est à `ecart` du centre de la cible au plus (en millièmes de jauge) ; `sauf` : les rangs des
 * jauges qu'on laisse filer (ratées faute d'appui). La rediffusion du jeu est la suite de ces pas. Rend ce que la simulation (Node, la même) attend de ces appuis.
 */
export async function jouerLeJour(page: Page, ecart = 30000, sauf: readonly number[] = []): Promise<Resultat> {
  const contenu = dailyPilepoil(parseDay(JOUR)!);
  const appuis = joueurScripte(contenu.jauges, (i) => (sauf.includes(i) ? null : ecart));
  await page.evaluate((appuis) => {
    let t = 0;
    for (const p of appuis) {
      window.__jeu.avancer(p - t);
      t = p;
      window.__jeu.action("arreter");
    }
    window.__jeu.avancer(20000);
  }, appuis);
  return jouer(contenu.jauges, appuis);
}
