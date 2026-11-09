import { dailyVertige, decoderRediffusion, jouer, niveau, type Commande, type Resultat } from "@cdj/vertige-sim";
import { PARTIES_ESSAIS } from "@cdj/vertige-sim/essais";
import { parseDay } from "@cdj/core";
import type { Browser, BrowserContext, Page } from "@playwright/test";

// Un appareil neuf : l'horloge du serveur d'essai (le 06/11/2026 à midi UTC, comme `VERTIGE_AUJOURDHUI`), l'aide « Comment jouer » déjà vue (elle a son propre test), les droits du presse-papiers.
export const API = "http://127.0.0.1:8796";
export const JOUR = "2026-11-06";

/** La porte `window.__vertige` du jeu (`?debug`) : la simulation, les commandes enregistrées, et `jouer` qui fait jouer des commandes à la place des touches. */
export interface PorteVertige {
  sim(): { tick: number; x: number; y: number; z: number; vx: number; vy: number; vz: number; lacet: number; tangage: number; sol: boolean; surMur: boolean; dash: number; chrono: number; fin: number; depart: number; prises: boolean[]; resultat(): Resultat };
  commandes(): Commande[];
  jouer(c: Commande[]): void;
  monde: { hab: { style: string } };
}
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
    __vertige: PorteVertige;
  }
}

export async function appareil(browser: Browser, adresse = `/?api=${API}&debug&manuel&tactile=0`, aideVue = true): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: "http://localhost:4187", locale: "fr-FR", permissions: ["clipboard-read", "clipboard-write"] });
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
      if (aideVue) localStorage.setItem("vertige:aide:vu", "1");
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
 * Joue la partie du jour : les commandes de la partie d'essai `variante` (le joueur scripté du parcours, `PARTIES_ESSAIS`) sont données à la simulation à la place des touches, pas à pas (la rediffusion du jeu est donc
 * ces commandes). Rend ce que la simulation (Node, la même) attend d'elles. La partie reste classable : aucune option d'essai dans l'adresse.
 */
export async function jouerLeJour(page: Page, variante = 0): Promise<Resultat> {
  const commandes = decoderRediffusion(PARTIES_ESSAIS[variante]!.code).commandes;
  await page.evaluate((c) => {
    window.__vertige.jouer(c);
    window.__jeu.avancer(c.length + 5);
  }, commandes);
  return jouer(niveau(dailyVertige(parseDay(JOUR)!).niveau), commandes).resultat();
}
