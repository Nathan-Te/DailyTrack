import { SIM_VERSION, dailyCircuit, encodeReplay, runPilot } from "@cdj/sim";
import { expect, test, newClockedContext, hasWebGL, TODAY, type BrowserContext, type Page } from "./fixtures";
import { auditAxe } from "./axe";
import { boxes, expectCentreLibre, expectNoOverlap } from "./layout";

// Lot I7 (plateforme) : le plein écran revient en vue dans Track, la caméra aussi.
//   - en course, en haut à gauche, à droite de la pause : pause · dernier point de contrôle · recommencer · caméra · plein écran (44 px, hors de la zone centrale, rien
//     ne se chevauche) ; si la rangée toucherait la bande du centre (740 × 360), la caméra passe en tête du groupe de droite ;
//   - sur l'accueil : dans la barre des jeux, à côté de la date ; il bascule (`aria-pressed`, nom lu) et tente de verrouiller le paysage ;
//   - caché quand l'API n'existe pas ou quand le site est déjà une application ; sur iPhone, une ligne « Partager › Sur l'écran d'accueil », une seule fois ;
//   - le bouton caméra fait ce que fait la touche C, et son nom lu suit la caméra.
//   - lot G1 (charte rév. 12) : le fantôme reste en vue ; `#btn-ghost`, 44 px, en tête du groupe de droite, devant l'objectif ; chaque appui passe au fantôme suivant (Aucun compris).
// Chromium seulement : le rendu 3D demande WebGL.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(150_000);

const WIDE_FONT = "* { font-family: 'DejaVu Sans', Verdana, sans-serif !important; }";
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

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
const verrous = (page: Page) => page.evaluate(() => (window as unknown as { __verrous: string[] }).__verrous);

async function telephone(browser: Parameters<typeof newClockedContext>[0], viewport: { width: number; height: number }, locale = "fr-FR") {
  const context = await newClockedContext(browser, { viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale });
  await context.addInitScript(() => localStorage.setItem("cdj:howto", "1"));
  return context;
}

// Lot G1 : un circuit fini aujourd'hui (le meilleur temps du pilote, gardé comme le jeu le garde) : le fantôme de ton record existe.
const circuit = dailyCircuit(TODAY);
const pilote = runPilot(circuit.track, { grip: 0.9 });
const record = (context: BrowserContext) =>
  context.addInitScript(
    ([id, replay, ms, simVersion]) => localStorage.setItem(`cdj:best:${id}`, JSON.stringify({ ms, splits: [9000, 18000, 27000], replay, simVersion })),
    [circuit.track.id, encodeReplay(pilote.replay), pilote.finishMs, SIM_VERSION] as const,
  );

/** La course, au « PARTEZ ! » passé : hors ligne, pas à pas, la police large de la CI. */
async function enCourse(context: BrowserContext): Promise<Page> {
  await context.route(/\/api\//, (route) => route.abort());
  const page = await context.newPage();
  await page.goto("/?debug&home=0");
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.addStyleTag({ content: WIDE_FONT });
  await page.evaluate(() => window.__cdj.manual(true));
  await page.evaluate(() => window.__cdj.advance(3 * 120 + 40 + 2 * 120));
  return page;
}

for (const viewport of [
  { width: 844, height: 390 },
  { width: 740, height: 360 },
]) {
  test(`paysage ${viewport.width}×${viewport.height} : en course, la caméra et le plein écran sont en vue, à 44 px, hors du centre, sans rien chevaucher`, async ({ browser }) => {
    const context = await telephone(browser, viewport);
    await noterLesVerrous(context);
    const page = await enCourse(context);
    const rangee = ["#btn-pause", "#btn-respawn", "#btn-restart", "#btn-fullscreen"];
    const dansLaRangee = viewport.width >= 800; // la rangée à cinq boutons ne touche la bande du centre qu'à 740 × 360
    // Chaque bouton fait au moins 44 px ; ceux de la rangée sont sur une ligne, dans l'ordre : pause, point de contrôle, recommencer, [caméra], plein écran.
    const ordre = dansLaRangee ? ["#btn-pause", "#btn-respawn", "#btn-restart", "#btn-camera", "#btn-fullscreen"] : rangee;
    let precedent = -1;
    const ys = new Set<number>();
    for (const sel of ordre) {
      const b = (await page.locator(sel).boundingBox())!;
      expect(b.width, `${sel} : 44 px`).toBeGreaterThanOrEqual(43.5);
      expect(b.height, `${sel} : 44 px`).toBeGreaterThanOrEqual(43.5);
      ys.add(Math.round(b.y));
      expect(b.x, `${sel} : à droite du précédent`).toBeGreaterThan(precedent);
      precedent = b.x + b.width - 1;
    }
    expect(ys.size, "la rangée du haut à gauche sur une seule ligne").toBe(1);
    if (!dansLaRangee) {
      // La caméra est devant l'objectif, dans le groupe de droite.
      const camera = (await page.locator("#btn-camera").boundingBox())!;
      expect(camera.width, "#btn-camera : 44 px").toBeGreaterThanOrEqual(43.5);
      expect(camera.height, "#btn-camera : 44 px").toBeGreaterThanOrEqual(43.5);
      const objectif = (await page.locator("#medals").boundingBox())!;
      expect(camera.x, "la caméra est en haut à droite").toBeGreaterThan(viewport.width / 2);
      expect(camera.x + camera.width, "devant l'objectif").toBeLessThanOrEqual(objectif.x + 1);
      await expect(page.locator("#hud-droite #btn-camera")).toHaveCount(1);
    } else await expect(page.locator("#menu #btn-camera")).toHaveCount(1);
    // Lot G1 : le fantôme, 44 px, dans le groupe de droite devant l'objectif (et derrière la caméra quand elle y est : côte à côte).
    const fantome = (await page.locator("#btn-ghost").boundingBox())!;
    expect(fantome.width, "#btn-ghost : 44 px").toBeGreaterThanOrEqual(43.5);
    expect(fantome.height, "#btn-ghost : 44 px").toBeGreaterThanOrEqual(43.5);
    const objectifBox = (await page.locator("#medals").boundingBox())!;
    expect(fantome.x, "le fantôme est en haut à droite").toBeGreaterThan(viewport.width / 2);
    expect(fantome.x + fantome.width, "devant l'objectif").toBeLessThanOrEqual(objectifBox.x + 1);
    await expect(page.locator("#hud-droite #btn-ghost")).toHaveCount(1);
    if (!dansLaRangee) expect((await page.locator("#btn-camera").boundingBox())!.x, "la caméra et le fantôme côte à côte : la caméra d'abord").toBeLessThan(fantome.x);
    const course = await boxes(page, ["#hud-centre", "#menu", "#btn-pause", "#btn-respawn", "#btn-restart", "#btn-camera", "#btn-fullscreen", "#btn-ghost", "#medals", "#rang", "#speed", "#fx", "#touch .steer-left", "#touch .steer-right", "#touch .pedal-brake", "#touch .pedal-gas"]);
    // `#menu` contient ses boutons : on ne compare que les boutons entre eux.
    expectNoOverlap(course.filter((b) => b.name !== "#menu"), viewport);
    expectCentreLibre(course, viewport);
    await context.close();
  });
}

// Lot R13 (docs/tests.md) : deux formats (téléphone en paysage, ordinateur) et le portrait là où l'écran s'y affiche ; 740×360 et 360×640 sont retirés.
for (const viewport of [
  { width: 390, height: 844 },
]) {
  test(`portrait ${viewport.width}×${viewport.height} : la caméra reste en vue (groupe de droite), le plein écran laisse la place à la bande (il reste dans la pause et sur l'accueil)`, async ({ browser }) => {
    const context = await telephone(browser, viewport);
    const page = await enCourse(context);
    await expect(page.locator("#btn-fullscreen")).toBeHidden();
    await expect(page.locator("#hud-droite #btn-camera")).toBeVisible();
    const boutons = await boxes(page, ["#btn-pause", "#btn-respawn", "#btn-restart", "#btn-camera", "#medals", "#hud-centre"]);
    expect(boutons.map((b) => b.name)).toEqual(expect.arrayContaining(["#btn-camera", "#btn-pause", "#medals", "#hud-centre"]));
    expectNoOverlap(boutons, viewport);
    expect(boutons.find((b) => b.name === "#btn-camera")!.w).toBeGreaterThanOrEqual(43.5);
    await page.locator("#btn-pause").click();
    await expect(page.locator("#pause-fullscreen")).toBeVisible();
    await context.close();
  });
}

test("plein écran : le bouton de la course et celui de la pause basculent ensemble (`aria-pressed`, nom lu) et le paysage est demandé", async ({ browser }) => {
  const context = await telephone(browser, { width: 844, height: 390 });
  await noterLesVerrous(context);
  const page = await enCourse(context);
  const bouton = page.locator("#btn-fullscreen");
  await expect(bouton).toHaveAttribute("aria-pressed", "false");
  await expect(bouton).toHaveAttribute("aria-label", "Plein écran");
  await bouton.click();
  await expect(bouton).toHaveAttribute("aria-pressed", "true");
  await expect(bouton).toHaveAttribute("aria-label", "Quitter le plein écran");
  expect(await page.evaluate(() => !!document.fullscreenElement), "le navigateur est vraiment en plein écran").toBe(true);
  expect(await verrous(page), "le paysage est demandé en entrant").toEqual(["landscape"]);
  // La pause porte le même bouton, dans le même état.
  await page.locator("#btn-pause").click();
  await expect(page.locator("#pause")).toBeVisible();
  await expect(page.locator("#pause-fullscreen")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#pause-fullscreen")).toHaveText("Quitter le plein écran");
  await page.locator("#pause-fullscreen").click();
  await expect(page.locator("#pause-fullscreen")).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator("#pause-fullscreen")).toHaveText("Plein écran");
  await expect(bouton).toHaveAttribute("aria-pressed", "false");
  expect(await verrous(page), "sortir ne verrouille rien").toEqual(["landscape"]);
  await context.close();
});

test("fantôme : chaque appui passe au fantôme suivant, Aucun compris ; le nom lu suit", async ({ browser }) => {
  // Avant d'avoir fini : pas de record, pas de classement : le cycle n'a que « aucun ».
  const avant = await telephone(browser, { width: 844, height: 390 });
  const p1 = await enCourse(avant);
  const bouton1 = p1.locator("#btn-ghost");
  await expect(bouton1).toHaveAttribute("aria-label", "Fantôme : ton record");
  await bouton1.click();
  await expect(bouton1).toHaveAttribute("aria-label", "Fantôme : aucun");
  await bouton1.click();
  await expect(bouton1).toHaveAttribute("aria-label", "Fantôme : aucun");
  await avant.close();
  // Après : ton record → aucun → ton record (même ordre que `G` et que la pause).
  const apres = await telephone(browser, { width: 844, height: 390 });
  await record(apres);
  const page = await enCourse(apres);
  const bouton = page.locator("#btn-ghost");
  await expect(bouton).toHaveAttribute("aria-label", "Fantôme : ton record");
  await bouton.click();
  await expect(bouton).toHaveAttribute("aria-label", "Fantôme : aucun");
  await page.keyboard.press("KeyG"); // la touche et le bouton font le même cycle
  await expect(bouton).toHaveAttribute("aria-label", "Fantôme : ton record");
  // La pause porte la même entrée.
  await page.locator("#btn-pause").click();
  await expect(page.locator("#pause-ghost")).toContainText("ton record");
  await apres.close();
});

test("fantôme (anglais) : le nom lu est en anglais", async ({ browser }) => {
  const context = await telephone(browser, { width: 844, height: 390 }, "en-US");
  await record(context);
  const page = await enCourse(context);
  await expect(page.locator("#btn-ghost")).toHaveAttribute("aria-label", /^Ghost: /);
  await page.locator("#btn-ghost").click();
  await expect(page.locator("#btn-ghost")).toHaveAttribute("aria-label", "Ghost: none");
  await context.close();
});

test("caméra : chaque appui passe à la caméra suivante, comme la touche C ; le nom lu suit, le choix est mémorisé", async ({ browser }) => {
  const context = await telephone(browser, { width: 844, height: 390 });
  const page = await enCourse(context);
  const camera = page.locator("#btn-camera");
  const memorisee = () => page.evaluate(() => localStorage.getItem("cdj:camera"));
  await expect(camera).toHaveAttribute("aria-label", "Caméra : proche");
  await camera.click();
  await expect(camera).toHaveAttribute("aria-label", "Caméra : loin");
  expect(await memorisee()).toBe("loin");
  await page.keyboard.press("KeyC"); // la touche et le bouton font la même chose, dans le même ordre
  await expect(camera).toHaveAttribute("aria-label", "Caméra : capot");
  expect(await memorisee()).toBe("capot");
  await camera.click();
  await expect(camera).toHaveAttribute("aria-label", "Caméra : proche");
  expect(await memorisee()).toBe("proche");
  // La pause montre la même caméra et la change avec le même résultat.
  await page.locator("#btn-pause").click();
  await expect(page.locator("#pause-camera")).toHaveText("Caméra : proche");
  await page.locator("#pause-camera").click();
  await expect(page.locator("#pause-camera")).toHaveText("Caméra : loin");
  await page.locator("#pause-resume").click();
  await expect(camera).toHaveAttribute("aria-label", "Caméra : loin");
  await context.close();
});

test("en mode application : aucun bouton plein écran (ni en course, ni à l'accueil, ni dans la pause) ; la caméra reste (lot 53 : sans API, sur iPhone, le bouton ouvre l'aide : e2e/iphone.spec.ts)", async ({ browser }) => {
  for (const cache of [commeApplication]) {
    const context = await telephone(browser, { width: 844, height: 390 });
    await cache(context);
    const page = await enCourse(context);
    await expect(page.locator("#btn-fullscreen")).toBeHidden();
    await expect(page.locator("#btn-camera")).toBeVisible();
    await expect(page.locator("#btn-camera")).toHaveAttribute("aria-label", /Caméra/);
    await page.locator("#btn-pause").click();
    await expect(page.locator("#pause")).toBeVisible();
    await expect(page.locator("#pause-fullscreen")).toBeHidden();
    await page.goto("/?home=1&debug&api=demo");
    await expect(page.locator("#home")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#home .dj-plein-ecran")).toBeHidden();
    await expect(page.locator("#home .dj-astuce")).toHaveCount(0); // ni l'astuce : ce n'est pas un iPhone
    await context.close();
  }
});

for (const viewport of [
  { width: 844, height: 390 },
]) {
  test(`accueil ${viewport.width}×${viewport.height} : le plein écran est dans la barre des jeux, à côté de la date ; il bascule`, async ({ browser }) => {
    const context = await telephone(browser, viewport);
    await noterLesVerrous(context);
    const page = await context.newPage();
    await page.goto("/?home=1&debug&api=demo");
    await page.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
    await page.addStyleTag({ content: WIDE_FONT });
    await expect(page.locator("#home")).toBeVisible();
    const bouton = page.locator("#home > .dj-barre-jeu .dj-plein-ecran");
    await expect(bouton).toBeVisible();
    const barre = await boxes(page, ["#home > .dj-barre-jeu .dj-barre-jeu__retour", "#home > .dj-barre-jeu .dj-barre-jeu__jour", "#home > .dj-barre-jeu .dj-plein-ecran"]);
    expect(barre).toHaveLength(3);
    expectNoOverlap(barre, viewport);
    const b = barre[2]!;
    expect(b.w).toBeGreaterThanOrEqual(43.5);
    expect(b.h).toBeGreaterThanOrEqual(43.5);
    expect(b.x, "côté droit, après la date").toBeGreaterThan(barre[1]!.x);
    await expect(bouton).toHaveAttribute("aria-pressed", "false");
    await bouton.click();
    await expect(bouton).toHaveAttribute("aria-pressed", "true");
    await expect(bouton).toHaveAttribute("aria-label", "Quitter le plein écran");
    expect(await verrous(page)).toEqual(["landscape"]);
    await bouton.click();
    await expect(bouton).toHaveAttribute("aria-pressed", "false");
    // Lot G1 : l'accueil montre le fantôme choisi (un bouton de 44 px qui passe au suivant).
    const choix = page.locator("#home-ghost");
    await expect(choix).toBeVisible();
    await expect(choix).toContainText("Fantôme : ton record");
    expect((await choix.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
    await choix.click();
    await expect(choix).toContainText("Fantôme : aucun");
    // Les autres écrans (réglages, classement…) ont la barre sans le plein écran : on le règle avant de jouer, pas dans un sous-écran.
    await page.locator("#home-settings").click();
    await expect(page.locator("#settings")).toBeVisible();
    await expect(page.locator("#settings .dj-plein-ecran")).toHaveCount(0);
    await context.close();
  });
}

test("axe : l'accueil avec son bouton plein écran, la course avec ses deux nouveaux boutons — aucune violation grave", async ({ browser }) => {
  const context = await telephone(browser, { width: 844, height: 390 });
  const page = await context.newPage();
  await page.goto("/?home=1&debug&api=demo");
  test.skip(!(await hasWebGL(page)), "ce navigateur n'a pas WebGL : le jeu ne démarre pas");
  await expect(page.locator("#home .dj-plein-ecran")).toBeVisible({ timeout: 30_000 });
  await auditAxe(page, "track-plein-ecran-accueil");
  await page.locator("#home-daily").click();
  await page.waitForFunction(() => window.__cdj.phase === "racing", undefined, { timeout: 30_000 });
  await expect(page.locator("#btn-camera")).toBeVisible();
  await auditAxe(page, "track-plein-ecran-course");
  await context.close();
});

for (const [langue, locale, ligne, fermer] of [
  // Lot R13 : le français seulement (l'anglais des mêmes clés : packages/ui/test/catalogues.test.ts et langue.spec.ts).
  ["fr", "fr-FR", "Pour jouer en plein écran : Partager › Sur l'écran d'accueil", "Fermer cette astuce"],
] as const) {
  test(`iPhone (${langue}) : le bouton plein écran ouvre l'aide (lot 53) ; la ligne « Partager › Sur l'écran d'accueil » s'affiche une fois, se ferme et ne revient pas`, async ({ browser }) => {
    const context = await newClockedContext(browser, { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale, userAgent: IPHONE_UA });
    await context.addInitScript(() => localStorage.setItem("cdj:howto", "1"));
    await sansPleinEcran(context);
    const page = await context.newPage();
    await page.goto("/?home=1&debug&api=demo");
    await page.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
    await expect(page.locator("#home")).toBeVisible();
    const bouton = page.locator("#home .dj-plein-ecran");
    await expect(bouton).toBeVisible(); // lot 53 : il ouvre l'aide « Sur l'écran d'accueil » (le détail : e2e/iphone.spec.ts)
    await bouton.click();
    await expect(page.getByRole("dialog", { name: "Jouer en plein écran" })).toBeVisible();
    await page.keyboard.press("Escape");
    const astuce = page.locator("#home .dj-astuce");
    await expect(astuce).toBeVisible();
    await expect(astuce).toContainText(ligne);
    const croix = astuce.getByRole("button", { name: fermer });
    expect((await croix.boundingBox())!.width, "cible de 44 px").toBeGreaterThanOrEqual(43.5);
    expectNoOverlap(await boxes(page, ["#home .dj-astuce", "#home .home-actions", "#home .etiquette__tete"]), { width: 844, height: 390 });
    await croix.click();
    await expect(astuce).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("cdj:astuce:plein-ecran"))).toBe("1");
    await page.goto("/?home=1&debug&api=demo"); // ailleurs que dans la même page : un nouveau chargement
    await page.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("#home .dj-astuce")).toHaveCount(0);
    await context.close();
  });
}
