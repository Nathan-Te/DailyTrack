import { dailyBlocks, type Resultat } from "@cdj/blocks-sim";
import { jouerGlouton } from "@cdj/blocks-sim/glouton";
import type { PorteBlocks } from "../src/scene";
import { parseDay } from "@cdj/core";
import type { Browser, BrowserContext, Page } from "@playwright/test";

// Un appareil neuf : l'horloge du serveur d'essai (le 06/11/2026 à midi UTC, comme `BLOCKS_AUJOURDHUI`), l'aide « Comment jouer » déjà vue (elle a son propre test), les droits du presse-papiers.
export const API = "http://127.0.0.1:8794";
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
    __blocks: PorteBlocks;
  }
}

export async function appareil(browser: Browser, adresse = `/?api=${API}&debug&manuel&tactile=0`, aideVue = true): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: "http://localhost:4179", locale: "fr-FR", permissions: ["clipboard-read", "clipboard-write"] });
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
      if (aideVue) localStorage.setItem("blocks:aide:vu", "1");
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

/** La partie du glouton simple sur le jour d'essai (06/11/2026) : ses poses, et ce que la simulation (Node, la même) en attend. */
export function partieDuGlouton(): { actions: number[]; resultat: Resultat } {
  const { actions, resultat } = jouerGlouton(dailyBlocks(parseDay(JOUR)!));
  return { actions, resultat };
}

/** Pose, dans le navigateur, une suite d'actions (`ligne × 8 + colonne`) par la porte du jeu, puis laisse passer « Plus de place ! » (le kit termine la partie une seconde après la dernière pose). */
export async function poserLesActions(page: Page, actions: readonly number[], terminer = true): Promise<void> {
  await page.evaluate(
    ({ actions, terminer }) => {
      for (const a of actions) window.__jeu.action(`pose:${a % 8}:${Math.floor(a / 8)}`);
      if (terminer) window.__jeu.avancer(100);
    },
    { actions, terminer },
  );
}

/** Joue la partie du jour du glouton jusqu'à sa fin ; rend ce que la simulation attend. */
export async function jouerLeJour(page: Page): Promise<Resultat> {
  const { actions, resultat } = partieDuGlouton();
  await poserLesActions(page, actions);
  return resultat;
}
