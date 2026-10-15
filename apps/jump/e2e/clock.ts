import type { Browser, BrowserContext, Page } from "@playwright/test";

// Horloge maîtrisée des tests de DailyJump (lot 5), comme `apps/web/e2e/fixtures.ts` de DailyTrack : seul `Date` est décalé (script
// d'initialisation, à chaque chargement de page du contexte), l'heure avance ensuite en temps réel ; minuteurs, `performance.now` et
// `requestAnimationFrame` restent réels. **Jamais `page.clock.install`** : il remplace `requestAnimationFrame` par un minuteur qui ignore le
// rendu logiciel et affame le fil principal (mesuré dans DailyTrack, retouche 29b).

/** Midi UTC le 20/10/2026 : « aujourd'hui » vaut le 20/10/2026 à Paris pendant douze heures (niveau n° 5). */
export const FIXED_NOW = Date.parse("2026-10-20T12:00:00Z");
export const TODAY = "2026-10-20";

/** Décale `Date` (constructeur sans argument, `Date.now()`) pour que « maintenant » vaille `instantMs` à l'ouverture du contexte. */
export async function shiftDate(context: BrowserContext, instantMs: number): Promise<void> {
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
  }, instantMs - Date.now());
}

/** Un contexte (et sa page) dont l'horloge vaut `instantMs` à l'ouverture ; `run` reçoit la page, le contexte est fermé ensuite. */
export async function atInstant(
  browser: Browser,
  instantMs: number,
  run: (page: Page, context: BrowserContext) => Promise<void>,
  options: Parameters<Browser["newContext"]>[0] = {},
): Promise<void> {
  const context = await browser.newContext(options);
  try {
    await shiftDate(context, instantMs);
    await run(await context.newPage(), context);
  } finally {
    await context.close();
  }
}

/**
 * Le **site publié** simulé : les adresses `https://nathan-te.github.io/DailyTrack/jump/…` (chemin sans `/b/<branche>/`, donc pas un aperçu)
 * sont servies par le serveur de test (`vite preview`, port 4174). Aucun workflow ni aucune configuration ne change.
 */
export const PUBLISHED = "https://nathan-te.github.io/DailyTrack/jump/";
export async function servePublished(context: BrowserContext): Promise<void> {
  await context.route("https://nathan-te.github.io/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^\/DailyTrack\/jump/, "") || "/";
    const response = await route.fetch({ url: `http://localhost:4174${path}${url.search}` });
    await route.fulfill({ response });
  });
}
