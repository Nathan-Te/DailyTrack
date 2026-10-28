import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { auditAxe } from "./axe";
import { FIXED_NOW, shiftDate } from "./clock";
import { boxes, expectCentreLibre, expectNoOverlap, SURIMPRESSIONS } from "./layout";
import { hasWebGL } from "./phone";
import { encoderTrajectoire } from "@cdj/jump-sim";

// Lot G1 (charte rév. 12) : le fantôme reste en vue, comme le plein écran — un bouton de 44 px juste après lui, qui passe au fantôme suivant (Aucun compris) ; le Diamant n'est dans le
// cycle qu'une fois débloqué (ici : une trajectoire posée par l'outil `__jump.diamond.inject`, sans serveur).
// Lot I7 (plateforme) : le plein écran revient en vue dans Jump (pas de bouton caméra : Jump n'a pas de choix de caméra).
//   - en partie, en haut à gauche, juste après la pause et ses actions (44 px, hors de la zone du personnage, rien ne se chevauche) ;
//   - sur l'accueil : dans la barre des jeux, à côté de la date ; il bascule (`aria-pressed`, nom lu) et tente de verrouiller le paysage ;
//   - caché quand l'API n'existe pas ou quand le site est déjà une application ; sur iPhone, une ligne « Partager › Sur l'écran d'accueil », une seule fois.
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

interface J {
  phase: string;
  manual(on: boolean): void;
  home: { ready: boolean };
  ghost: { choice: string };
  diamond: { status: string; locked: boolean; loaded: boolean; choice: string; choices: string[]; shown: boolean; inject(trajectoire: string, ticks: number): boolean };
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

// Lot R13 (docs/tests.md) : deux formats (téléphone en paysage, ordinateur) et le portrait là où l'écran s'y affiche ; 740×360 et 360×640 sont retirés.
for (const viewport of [
  { width: 844, height: 390 },
]) {
  test(`paysage ${viewport.width}×${viewport.height} : en partie, le plein écran est juste après la pause et ses actions, à 44 px, hors du centre, sans rien chevaucher ; il bascule`, async ({ browser }) => {
    const context = await telephone(browser, viewport);
    await noterLesVerrous(context);
    try {
      const page = await enPartie(context);
      const pause = (await page.locator("#pausebtn").boundingBox())!;
      const plein = (await page.locator("#fullscreenbtn").boundingBox())!;
      // Lot 27 : l'ordre de DailyTrack, pause · point de passage · recommencer · plein écran (aux doigts) : le plein écran suit la dernière
      // plaque visible de la pause et de ses actions.
      const avant = (await Promise.all(["#pausebtn", "#btn-respawn", "#btn-restart"].map((s) => page.locator(s).boundingBox())))
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .reduce((a, b) => (b.x > a.x ? b : a));
      expect(plein.width, "44 px").toBeGreaterThanOrEqual(43.5);
      expect(plein.height, "44 px").toBeGreaterThanOrEqual(43.5);
      expect(Math.round(plein.y), "sur la ligne de la pause").toBe(Math.round(pause.y));
      expect(plein.x, "juste après la pause et ses actions").toBeGreaterThanOrEqual(avant.x + avant.width);
      expect(plein.x, "juste après la pause et ses actions").toBeLessThan(avant.x + avant.width + 16);
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

for (const viewport of [
  { width: 844, height: 390 },
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

for (const [langue, locale, ligne, fermer] of [
  // Lot R13 : le français seulement (l'anglais des mêmes clés : packages/ui/test/catalogues.test.ts et langue.spec.ts).
  ["fr", "fr-FR", "Pour jouer en plein écran : Partager › Sur l'écran d'accueil", "Fermer cette astuce"],
] as const) {
  test(`iPhone (${langue}) : le bouton plein écran ouvre l'aide (lot 53) ; la ligne « Partager › Sur l'écran d'accueil » s'affiche une fois, se ferme et ne revient pas`, async ({ browser }) => {
    const context = await telephone(browser, { width: 844, height: 390 }, { locale, userAgent: IPHONE_UA });
    try {
      await sansPleinEcran(context);
      const page = await context.newPage();
      await page.goto("/?debug");
      test.skip(!(await hasWebGL(page)), "WebGL indisponible");
      await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.home.ready === true);
      await expect(page.locator("#home")).toBeVisible();
      const bouton = page.locator("#home .dj-plein-ecran");
      await expect(bouton).toBeVisible(); // lot 53 : il ouvre l'aide « Sur l'écran d'accueil » (le détail : apps/web/e2e/iphone.spec.ts)
      await bouton.click();
      await expect(page.getByRole("dialog", { name: "Jouer en plein écran" })).toBeVisible();
      await page.keyboard.press("Escape");
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

// --- Lot G1 : le bouton fantôme -------------------------------------------------------------------------------------------------------------------------------------------------------
/** Une trajectoire d'essai (une ligne droite de 3 s, 30 points par seconde) : ce que le serveur rendrait, sans serveur. */
const droite = () => {
  const pts: number[] = [];
  for (let i = 0; i <= 90; i++) pts.push(10 * 64 + i * 8, 20 * 64);
  return { trajectoire: encoderTrajectoire(pts), ticks: 90 * 4 };
};

for (const viewport of [
  { width: 844, height: 390 },
  { width: 740, height: 360 },
]) {
  test(`paysage ${viewport.width}×${viewport.height} : le bouton fantôme est en vue, juste après le plein écran, à 44 px, hors du centre, sans rien chevaucher ; chaque appui passe au fantôme suivant`, async ({ browser }) => {
    const context = await telephone(browser, viewport);
    try {
      const page = await enPartie(context, false);
      const bouton = page.locator("#ghostbtn");
      await expect(bouton).toBeVisible();
      const pause = (await page.locator("#pausebtn").boundingBox())!;
      const fantome = (await bouton.boundingBox())!;
      // Après le plein écran quand il y en a un, sinon après la dernière plaque de la pause et de ses actions.
      const precedents = (await Promise.all(["#pausebtn", "#btn-respawn", "#btn-restart", "#fullscreenbtn"].map(async (s) => ((await page.locator(s).isVisible()) ? page.locator(s).boundingBox() : null))))
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .reduce((a, b) => (b.x > a.x ? b : a));
      expect(fantome.width, "44 px").toBeGreaterThanOrEqual(43.5);
      expect(fantome.height, "44 px").toBeGreaterThanOrEqual(43.5);
      expect(Math.round(fantome.y), "sur la ligne de la pause").toBe(Math.round(pause.y));
      expect(fantome.x, "juste après le plein écran").toBeGreaterThanOrEqual(precedents.x + precedents.width);
      expect(fantome.x, "juste après le plein écran").toBeLessThan(precedents.x + precedents.width + 16);
      const partie = await boxes(page, SURIMPRESSIONS.filter((s) => s !== "#dayline" && s !== "#toast" && s !== "#rotate"));
      expect(partie.map((b) => b.name)).toContain("#ghostbtn");
      expectNoOverlap(partie, viewport);
      expectCentreLibre(await boxes(page, SURIMPRESSIONS), viewport);

      // Le cycle : sans serveur ni premier, le tien ↔ aucun ; « Diamant » n'y est pas avant le déblocage.
      const j = (page: Page) => page.evaluate(() => (window as unknown as { __jump: J }).__jump.ghost.choice);
      expect(await j(page)).toBe("mien");
      await expect(bouton).toHaveAttribute("aria-label", "Fantôme : le tien");
      await bouton.tap();
      expect(await j(page)).toBe("aucun");
      await expect(bouton).toHaveAttribute("aria-label", "Fantôme : aucun");
      await bouton.tap();
      expect(await j(page)).toBe("mien");
      expect(await page.evaluate(() => (window as unknown as { __jump: J }).__jump.diamond.loaded), "avant le déblocage : pas de Diamant").toBe(false);

      // Débloqué (une trajectoire posée) : le Diamant entre dans le cycle, après le tien, avant aucun ; son nom est celui de la médaille.
      const { trajectoire, ticks } = droite();
      expect(await page.evaluate(([t, n]) => (window as unknown as { __jump: J }).__jump.diamond.inject(t as string, n as number), [trajectoire, ticks])).toBe(true);
      await bouton.tap();
      expect(await j(page)).toBe("diamant");
      await expect(bouton).toHaveAttribute("aria-label", "Fantôme : Diamant");
      expect(await page.evaluate(() => (window as unknown as { __jump: J }).__jump.diamond.shown)).toBe(true);
      await bouton.tap();
      expect(await j(page)).toBe("aucun");
      await bouton.tap();
      expect(await j(page)).toBe("mien");
      expect(await page.evaluate(() => localStorage.getItem("jump:fantome")), "mémorisé sous la clé d'avant le lot").toBe("1");
      // La touche G fait la même chose que le bouton.
      await page.keyboard.press("KeyG");
      expect(await j(page)).toBe("diamant");
      expect(await page.evaluate(() => localStorage.getItem("jump:fantome"))).toBe("diamant");
      await expect(bouton).toHaveAttribute("aria-label", "Fantôme : Diamant");
      // La pause dit le même choix et le fait tourner de la même façon.
      await page.locator("#pausebtn").tap();
      await expect(page.locator("#menu-ghost")).toHaveText("Fantôme : Diamant");
      await page.locator("#menu-ghost").tap();
      await expect(page.locator("#menu-ghost")).toHaveText("Fantôme : aucun");
      expect(await j(page)).toBe("aucun");
    } finally {
      await context.close();
    }
  });
}

test("le bouton fantôme en anglais : « Ghost: yours » puis « Ghost: Diamond » ; à l'accueil, un toucher sur le fantôme choisi le change, et la ligne du Diamant grisée n'existe pas sans serveur", async ({ browser }) => {
  const context = await telephone(browser, { width: 844, height: 390 }, { locale: "en-US" });
  try {
    const page = await context.newPage();
    await page.goto("/?debug");
    test.skip(!(await hasWebGL(page)), "WebGL indisponible");
    await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.home.ready === true);
    // L'accueil : le fantôme choisi est un bouton, un toucher passe au suivant ; pas de serveur : pas de ligne du Diamant.
    const accueil = page.locator("#home-ghost");
    await expect(accueil).toBeVisible();
    await expect(accueil).toHaveText("Ghost: yours");
    expect((await accueil.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
    await expect(page.locator("#home-diamant")).toBeHidden();
    await accueil.tap();
    await expect(accueil).toHaveText("Ghost: none");
    await accueil.tap();
    await expect(accueil).toHaveText("Ghost: yours");
    const { trajectoire, ticks } = droite();
    await page.evaluate(([t, n]) => (window as unknown as { __jump: J }).__jump.diamond.inject(t as string, n as number), [trajectoire, ticks]);
    await accueil.tap();
    await expect(accueil).toHaveText("Ghost: Diamond");
    await expect(page.locator("#ghostbtn")).toHaveAttribute("aria-label", "Ghost: Diamond");
  } finally {
    await context.close();
  }
});
