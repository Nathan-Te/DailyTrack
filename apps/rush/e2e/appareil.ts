import { dailyRush, jouer, type Changement, type Choix, type Resultat } from "@cdj/rush-sim";
import { parseDay } from "@cdj/core";
import type { Browser, BrowserContext, Page } from "@playwright/test";

// Un appareil neuf : l'horloge du serveur d'essai (le 06/11/2026 à midi UTC, comme `RUSH_AUJOURDHUI`), l'aide « Comment jouer » déjà vue (elle a son propre test), les droits du presse-papiers.
export const API = "http://127.0.0.1:8795";
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
/** La porte d'essai de la scène (`?debug`) : l'état de la simulation et le pilote automatique. */
export interface PorteScene {
  partie(): { tick: number; c: { coeurs: number; dir: number }; golem: { hp: number } | null; monstres: unknown[]; barriere: number; golemEveille: boolean; niveau: { empreinte: number } | null };
  /** Lot BR1 (niveau du jour) : pose le chevalier en (x, z) mètres, recadre la caméra ; les points utiles du niveau (mètres) pour les captures et les tests. */
  aller(x: number, z: number): void;
  recadrer(): void;
  pointSurLeChemin(fraction: number): [number, number];
  avantLArene(metres: number): [number, number];
  centreDuCamp(i: number): [number, number];
  /** L'octet d'entrée qui va vers le centre de l'arène. */
  versLArene(): number;
  visee(): number;
  souris(x: number | null, y?: number): void;
  forcer(octet: number, ticks: number): void;
  empreinte(): string;
  changements(): Changement[];
  /** Lot BR2 : les choix d'amélioration faits (un événement d'entrée de la rediffusion), le choix en attente (les identifiants des trois cartes) et la carte en surbrillance ; `choisir(i)` choisit la carte `i`. */
  choix(): Choix[];
  choixEnAttente(): { nv: number; cartes: string[] } | null;
  selection(): number;
  choisir(i: number): void;
  sons(): string[];
  calls(): number;
  scene(): { getObjectByName(nom: string): { visible: boolean } | undefined };
  qualite(): "haute" | "basse";
  definirQualite(q: "haute" | "basse"): void;
  dessinerMaintenant(): void;
  jouerPilote(ticks: number, attente?: number): void;
}
declare global {
  interface Window {
    __jeu: Porte;
    __rush: PorteScene;
  }
}

export async function appareil(browser: Browser, adresse = `/?api=${API}&debug&manuel&tactile=0`, aideVue = true): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ baseURL: "http://localhost:4181", locale: "fr-FR", permissions: ["clipboard-read", "clipboard-write"] });
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
      if (aideVue) localStorage.setItem("rush:aide:vu", "1");
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
  await page.waitForFunction(() => !!(window as unknown as { __jeu?: unknown }).__jeu && !!(window as unknown as { __rush?: unknown }).__rush);
}

/**
 * Joue la partie du jour avec le pilote de la simulation (pas à pas, dans la page ; `attente` ticks immobile d'abord, pour ne pas jouer exactement la partie du Diamant, que le serveur refuserait comme une copie ; le pilote n'est pas parfait : 5 ticks d'attente le 06/11/2026 donnent une victoire (vérifié au lot BR0c)), puis rend ce que la simulation (Node, la même) trouve en rejouant les changements d'entrée que la page a enregistrés : c'est la preuve que
 * ce que le joueur a fait dans le navigateur est exactement ce que le serveur rejouera.
 */
export async function jouerLeJour(page: Page, attente = 5): Promise<Resultat> {
  const { changements, choix } = await page.evaluate((attente) => {
    window.__rush.jouerPilote(40_000, attente);
    return { changements: window.__rush.changements(), choix: window.__rush.choix() };
  }, attente);
  return jouer(dailyRush(parseDay(JOUR)!), changements, undefined, choix);
}
