import { dailyPinball, jouer, piloter, type Evenement, type Resultat } from "@cdj/pinball-sim";
import { parseDay } from "@cdj/core";
import type { Browser, BrowserContext, Page } from "@playwright/test";

// Un appareil neuf : l'horloge du serveur d'essai (le 06/11/2026 à midi UTC, comme `PINBALL_AUJOURDHUI`), l'aide « Comment jouer » déjà vue (elle a son propre test), les droits du presse-papiers.
export const API = "http://127.0.0.1:8803";
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
/** Les essais de la scène (`?debug`) : dicter un changement de commande (0 gauche, 1 droite, 2 lanceur), lire le pas et le journal des changements datés. */
export interface PorteScene {
  regler(c: number, enfonce: boolean): void;
  tick(): number;
  evenements(): Evenement[];
  /** Le rendu qui est à l'écran, ce que dessine le rendu three.js (appels, triangles, ms de fil principal par image, où tombent les points du terrain à l'écran : tout est à l'image si |x| ≤ 1 et −1 ≤ y ≤ 1), les vibrations demandées. */
  qualite(): "haute" | "basse";
  trois(): { appels: number; triangles: number; ms: number; cadre: { x: number; y0: number; y1: number } } | null;
  vibrations(): number;
}
declare global {
  interface Window {
    __jeu: Porte;
    __pinball?: PorteScene;
  }
}

export async function appareil(browser: Browser, adresse = `/?api=${API}&debug&manuel&tactile=0`, aideVue = true): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: "http://localhost:4189", locale: "fr-FR", permissions: ["clipboard-read", "clipboard-write"] });
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
      if (aideVue) localStorage.setItem("pinball:aide:vu", "1");
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

/** La partie scriptée des essais : le pilote d'essai de la simulation joue le jour pendant `pas` pas (ses changements de commandes sont la rediffusion). */
export const evenementsDeLEssai = (pas = 9000): Evenement[] => piloter(dailyPinball(parseDay(JOUR)!), pas).evenements;

/**
 * Joue la partie du jour à la main, pas à pas : chaque changement de commande est dicté à son pas (`__pinball.regler`), la rediffusion du jeu est donc cette liste ; puis la partie se joue seule jusqu'à sa fin
 * (les commandes restent comme elles sont : une bille perdue finit la partie). Rend ce que la simulation (Node, la même) attend de ces événements.
 */
export async function jouerLeJour(page: Page, evenements: readonly Evenement[] = evenementsDeLEssai()): Promise<Resultat> {
  await page.evaluate((evenements) => {
    let t = 0;
    for (const e of evenements) {
      window.__jeu.avancer(e.tick - t);
      t = e.tick;
      window.__pinball!.regler(e.c, e.enfonce);
    }
    window.__jeu.avancer(600000);
  }, [...evenements]);
  return jouer(dailyPinball(parseDay(JOUR)!), evenements);
}
