import { expect, test as base, type Browser, type BrowserContext, type Page } from "@playwright/test";

// Horloge maîtrisée (retouche 29b) : aucun test ne dépend de l'heure réelle ni ne peut changer de jour en cours de route.
//   - `playwright.config.ts` fixe UNE FOIS un décalage (E2E_CLOCK_OFFSET_MS) tel que « maintenant » tombe à FIXED_NOW (midi UTC, 20/10/2026) ;
//   - côté API : les serveurs de test démarrent avec `TEST_CLOCK_OFFSET_MS` = ce décalage (variable réservée aux tests, refusée en production,
//     voir apps/api/src/config.ts) ;
//   - côté navigateur : `Date` décalé de la même valeur (script d'initialisation), l'heure avance en temps réel ; le Salon se cale sur l'heure
//     du serveur : sans cela, il verrait un changement de session au chargement. **Pas `page.clock.install`** (essayé, mesuré) : il remplace
//     `requestAnimationFrame` par un minuteur de 16 ms qui ignore le rendu (34 images/s simulées contre 3,5 réelles en rendu logiciel) et
//     affame le fil principal : les pages deviennent plus lentes et les tests plus instables, pas moins. Seul `Date` est décalé ;
//   - côté test (Node) : `TODAY` / `FIXED_NOW` remplacent `Date.now()` pour calculer « aujourd'hui ».
// Midi UTC : un run de moins de douze heures reste dans la même journée.
export const FIXED_NOW = Date.parse("2026-10-20T12:00:00Z");
/** Numéro de jour UTC (jours depuis 1970) de l'horloge de test. */
export const TODAY = Math.floor(FIXED_NOW / 86_400_000);
/** Décalage entre l'heure réelle et l'horloge de test (posé par playwright.config.ts avant le démarrage des workers). */
const OFFSET = Number(process.env.E2E_CLOCK_OFFSET_MS ?? FIXED_NOW - Date.now());

/** Décale `Date` (constructeur sans argument, `Date.now()`) de `offset` ms ; minuteurs, `performance.now` et rAF restent réels. */
async function shiftDate(context: BrowserContext): Promise<void> {
  await context.addInitScript((offset: number) => {
    const Real = Date;
    class Shifted extends Real {
      constructor(...args: unknown[]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        super(...((args.length === 0 ? [Real.now() + offset] : args) as [any]));
      }
      static override now() {
        return Real.now() + offset;
      }
    }
    (globalThis as { Date: DateConstructor }).Date = Shifted as unknown as DateConstructor;
  }, OFFSET);
}

export const test = base.extend({
  context: async ({ context }, use) => {
    await shiftDate(context);
    await use(context);
  },
});

/** Un contexte supplémentaire (autre appareil) avec la même horloge maîtrisée. */
export async function newClockedContext(browser: Browser, options: Parameters<Browser["newContext"]>[0] = {}): Promise<BrowserContext> {
  const context = await browser.newContext(options);
  await shiftDate(context);
  return context;
}

export { expect };
export type { Browser, BrowserContext, Page };

/** « Maintenant » sur l'horloge de test, côté Node (pour simuler un serveur qui répond avec l'heure du navigateur). */
export const clockNow = () => Date.now() + OFFSET;

/** Ce navigateur sait-il créer un contexte WebGL ? (Le Firefox de la CI, non : le jeu ne démarre pas, `__cdj` n'existe jamais.) */
export const hasWebGL = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  });
