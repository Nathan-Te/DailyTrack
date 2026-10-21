import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { auditAxe } from "./axe";
import { FIXED_NOW, shiftDate } from "./clock";
import { boxes, expectCentreLibre, expectNoOverlap, SURIMPRESSIONS } from "./layout";
import { hasWebGL } from "./phone";

// Lot I7 (plateforme) : le plein écran revient en vue dans Jump (pas de bouton caméra : Jump n'a pas de choix de caméra).
//   - en partie, en haut à gauche, juste après la pause (44 px, hors de la zone du personnage, rien ne se chevauche) ;
//   - sur l'accueil : dans la barre des jeux, à côté de la date ; il bascule (`aria-pressed`, nom lu) et tente de verrouiller le paysage ;
//   - caché quand l'API n'existe pas ou quand le site est déjà une application ; sur iPhone, une ligne « Partager › Sur l'écran d'accueil », une seule fois.
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

interface J {
  phase: string;
  manual(on: boolean): void;
  home: { ready: boolean };
}

/** Les verrous d'orientation demandés sont notés dans `window.__verrous` (le verrou réel n'existe pas sur un ordinateur). */
async function noterLesVerrous(context: BrowserContext) {
  await context.addInitScript(() => {
    (window as unknown as { __verrous: string[] }).__verrous = [];
    Object.defineProperty(ScreenOrientation.prototype, "lock", {
      configurable: true,
      value: async (o: string) => void (window as unknown as { __verrous: string[] }).__verrous.push(o),
    });
  });
}
/** Un navigateur sans API plein écran (iPhone) : `document.fullscreenEnabled` est faux. */
const sansPleinEcran = (context: BrowserContext) => context.addInitScript(() => { for (const k of ["fullscreenEnabled", "webkitFullscreenEnabled"]) Object.defineProperty(Document.prototype, k, { configurable: true, get: () => false }); });
/** Le site ouvert comme une application (« Ajouter à l'écran d'accueil ») : `display-mode: standalone`. */
const commeApplication = (context: BrowserContext) =>
  context.addInitScript(() => {
    const vrai = window.matchMedia.bind(window);
    window.matchMedia = (q: string) => (q.includes("display-mode: standalone") ? ({ matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false } as MediaQueryList) : vrai(q));
  });
/**
 * L'API plein écran existe-t-elle dans cette page ? Le WebKit de Playwright en `isMobile` émule un appareil d'Apple : après une navigation, ni
 * `document.fullscreenEnabled` ni `requestFullscreen` n'existent (comme sur iPhone) ; le jeu cache alors, à raison, ses boutons (cas couvert par les
 * tests « sans API » et « iPhone »). Les tests qui ont besoin du bouton se sautent sur cette capacité, jamais sur le nom du navigateur.
 */
const pleinEcranDisponible = (page: Page) => page.evaluate(() => document.fullscreenEnabled === true && typeof document.documentElement.requestFullscreen === "function");
const SANS_API = "API plein écran absente dans ce navigateur (WebKit mobile, comme l'iPhone) : le bouton est caché à raison";
const verrous = (page: Page) => page.evaluate(() => (window as unknown as { __verrous: string[] }).__verrous);

async function telephone(browser: Browser, viewport: { width: number; height: number }, options: { locale?: string; userAgent?: string } = {}) {
  const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: options.locale ?? "fr-FR", userAgent: options.userAgent });
  await shiftDate(context, FIXED_NOW);
  await context.addInitScript(() => localStorage.setItem("jump:aide", "1")); // « Comment jouer » ne s'ouvre pas tout seul
  return context;
}

/** La partie, prête, en police large (le pire cas), pas à pas ; sautée sans API plein écran quand le test a besoin du bouton (`avecBouton`). */
async function enPartie(context: BrowserContext, avecBouton = true): Promise<Page> {
  const page = await context.newPage();
  await page.goto("/?accueil=0&debug&touch=1");
  test.skip(!(await hasWebGL(page)), "WebGL indisponible");
  if (avecBouton) test.skip(!(await pleinEcranDisponible(page)), SANS_API);
  await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.phase === "ready");
  await page.addStyleTag({ content: "#debug, #stamp, #tuned { display: none !important; }" });
  await page.evaluate(() => (window as unknown as { __jump: J }).__jump.manual(true));
  return page;
}

for (const viewport of [
  { width: 844, height: 390 },
  { width: 740, height: 360 },
]) {
  test(`paysage ${viewport.width}×${viewport.height} : en partie, le plein écran est juste après la pause, à 44 px, hors du centre, sans rien chevaucher ; il bascule`, async ({ browser }) => {
    const context = await telephone(browser, viewport);
    await noterLesVerrous(context);
    try {
      const page = await enPartie(context);
      const pause = (await page.locator("#pausebtn").boundingBox())!;
      const plein = (await page.locator("#fullscreenbtn").boundingBox())!;
      expect(plein.width, "44 px").toBeGreaterThanOrEqual(43.5);
      expect(plein.height, "44 px").toBeGreaterThanOrEqual(43.5);
      expect(Math.round(plein.y), "sur la ligne de la pause").toBe(Math.round(pause.y));
      expect(plein.x, "juste à droite de la pause").toBeGreaterThanOrEqual(pause.x + pause.width);
      expect(plein.x, "juste à droite de la pause").toBeLessThan(pause.x + pause.width + 16);
      const partie = await boxes(page, SURIMPRESSIONS.filter((s) => s !== "#dayline" && s !== "#toast" && s !== "#rotate"));
      expect(partie.map((b) => b.name)).toContain("#fullscreenbtn");
      expectNoOverlap(partie, viewport);
      expectCentreLibre(await boxes(page, SURIMPRESSIONS), viewport);
      // Il bascule : état, nom lu, vrai plein écran, paysage demandé une fois.
      const bouton = page.locator("#fullscreenbtn");
      await expect(bouton).toHaveAttribute("aria-pressed", "false");
      await expect(bouton).toHaveAttribute("aria-label", "Plein écran");
      await bouton.click();
      await expect(bouton).toHaveAttribute("aria-pressed", "true");
      await expect(bouton).toHaveAttribute("aria-label", "Quitter le plein écran");
      expect(await page.evaluate(() => !!document.fullscreenElement), "le navigateur est vraiment en plein écran").toBe(true);
      expect(await verrous(page)).toEqual(["landscape"]);
      // La pause porte le même bouton, dans le même état.
      await page.locator("#pausebtn").click();
      await expect(page.locator("#menu")).toBeVisible();
      await expect(page.locator("#menu-fullscreen")).toHaveAttribute("aria-pressed", "true");
      await expect(page.locator("#menu-fullscreen")).toHaveText("Quitter le plein écran");
      await page.locator("#menu-fullscreen").click();
      await expect(page.locator("#menu-fullscreen")).toHaveAttribute("aria-pressed", "false");
      await expect(page.locator("#menu-fullscreen")).toHaveText("Plein écran");
      await expect(bouton).toHaveAttribute("aria-pressed", "false");
      expect(await verrous(page), "sortir ne verrouille rien").toEqual(["landscape"]);
    } finally {
      await context.close();
    }
  });
}

test("anglais : « Full screen », « Exit full screen »", async ({ browser }) => {
  const context = await telephone(browser, { width: 844, height: 390 }, { locale: "en-US" });
  try {
    const page = await enPartie(context);
    await expect(page.locator("#fullscreenbtn")).toHaveAttribute("aria-label", "Full screen");
    await page.locator("#fullscreenbtn").click();
    await expect(page.locator("#fullscreenbtn")).toHaveAttribute("aria-label", "Exit full screen");
  } finally {
    await context.close();
  }
});

test("sans API plein écran ou en mode application : aucun bouton plein écran (ni en partie, ni à l'accueil, ni dans la pause)", async ({ browser }) => {
  for (const cache of [sansPleinEcran, commeApplication]) {
    const context = await telephone(browser, { width: 844, height: 390 });
    try {
      await cache(context);
      const page = await enPartie(context, false);
      await expect(page.locator("#fullscreenbtn")).toBeHidden();
      await page.locator("#pausebtn").click();
      await expect(page.locator("#menu")).toBeVisible();
      await expect(page.locator("#menu-fullscreen")).toBeHidden();
      await page.goto("/?debug");
      await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.home.ready === true);
      await expect(page.locator("#home")).toBeVisible();
      await expect(page.locator("#home .dj-plein-ecran")).toBeHidden();
      await expect(page.locator("#home .dj-astuce")).toHaveCount(0); // ni l'astuce : ce n'est pas un iPhone
    } finally {
      await context.close();
    }
  }
});

for (const viewport of [
  { width: 844, height: 390 },
  { width: 740, height: 360 },
]) {
  test(`accueil ${viewport.width}×${viewport.height} : le plein écran est dans la barre des jeux, à côté de la date ; il bascule`, async ({ browser }) => {
    const context = await telephone(browser, viewport);
    await noterLesVerrous(context);
    try {
      const page = await context.newPage();
      await page.goto("/?debug");
      test.skip(!(await hasWebGL(page)), "WebGL indisponible");
      test.skip(!(await pleinEcranDisponible(page)), SANS_API);
      await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.home.ready === true);
      await expect(page.locator("#home")).toBeVisible();
      const bouton = page.locator("#home .dj-plein-ecran");
      await expect(bouton).toBeVisible();
      const barre = await boxes(page, ["#home .dj-barre-jeu__retour", "#home .dj-barre-jeu__jour", "#home .dj-plein-ecran"]);
      expect(barre).toHaveLength(3);
      expectNoOverlap(barre, viewport);
      expect(barre[2]!.w).toBeGreaterThanOrEqual(43.5);
      expect(barre[2]!.h).toBeGreaterThanOrEqual(43.5);
      expect(barre[2]!.x, "côté droit, après la date").toBeGreaterThan(barre[1]!.x);
      await expect(bouton).toHaveAttribute("aria-pressed", "false");
      await bouton.click();
      await expect(bouton).toHaveAttribute("aria-pressed", "true");
      await expect(bouton).toHaveAttribute("aria-label", "Quitter le plein écran");
      expect(await verrous(page)).toEqual(["landscape"]);
      await bouton.click();
      await expect(bouton).toHaveAttribute("aria-pressed", "false");
    } finally {
      await context.close();
    }
  });
}

test("axe : l'accueil avec son bouton plein écran, la partie avec le sien — aucune violation grave", async ({ browser }) => {
  const context = await telephone(browser, { width: 844, height: 390 });
  try {
    const page = await context.newPage();
    await page.goto("/?debug");
    test.skip(!(await hasWebGL(page)), "WebGL indisponible");
    test.skip(!(await pleinEcranDisponible(page)), SANS_API);
    await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.home.ready === true);
    await expect(page.locator("#home .dj-plein-ecran")).toBeVisible();
    await auditAxe(page, "jump-plein-ecran-accueil");
    await page.locator("#home-play").click();
    await expect(page.locator("#home")).toBeHidden();
    await expect(page.locator("#fullscreenbtn")).toBeVisible();
    await auditAxe(page, "jump-plein-ecran-partie");
  } finally {
    await context.close();
  }
});

for (const [langue, locale, ligne, fermer] of [
  ["fr", "fr-FR", "Pour jouer en plein écran : Partager › Sur l'écran d'accueil", "Fermer cette astuce"],
  ["en", "en-US", "To play full screen: Share › Add to Home Screen", "Dismiss this tip"],
] as const) {
  test(`iPhone (${langue}) : pas de bouton plein écran ; la ligne « Partager › Sur l'écran d'accueil » s'affiche une fois, se ferme et ne revient pas`, async ({ browser }) => {
    const context = await telephone(browser, { width: 844, height: 390 }, { locale, userAgent: IPHONE_UA });
    try {
      await sansPleinEcran(context);
      const page = await context.newPage();
      await page.goto("/?debug");
      test.skip(!(await hasWebGL(page)), "WebGL indisponible");
      await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.home.ready === true);
      await expect(page.locator("#home")).toBeVisible();
      await expect(page.locator("#home .dj-plein-ecran")).toBeHidden();
      const astuce = page.locator("#home .dj-astuce");
      await expect(astuce).toBeVisible();
      await expect(astuce).toContainText(ligne);
      const croix = astuce.getByRole("button", { name: fermer });
      expect((await croix.boundingBox())!.width, "cible de 44 px").toBeGreaterThanOrEqual(43.5);
      expectNoOverlap(await boxes(page, ["#home .dj-astuce", "#home-play", "#home .accueil__tete"]), { width: 844, height: 390 });
      await croix.click();
      await expect(astuce).toHaveCount(0);
      expect(await page.evaluate(() => localStorage.getItem("cdj:astuce:plein-ecran"))).toBe("1");
      await page.goto("/?debug");
      await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.home.ready === true);
      await expect(page.locator("#home")).toBeVisible();
      await expect(page.locator("#home .dj-astuce")).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
}
