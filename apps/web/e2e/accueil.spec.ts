import { expect, test, type Browser, type BrowserContext, type Page, TODAY, newClockedContext, clockNow } from "./fixtures";
import { dailyCircuit, formatDay } from "@cdj/sim";
import { boxes, expectCentreLibre, expectNoOverlap } from "./layout";

// Interface du lot 29 : accueil, classement en course, barre du haut, pause, réglages, « Comment jouer », profil, chrono.
// Le jeu en démonstration (`?api=demo`) : aucune API réelle n'est touchée. Le rendu 3D demande WebGL : Chromium seulement.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(150_000);

const DESKTOP = { width: 1280, height: 720 };
const WIDE_FONT = "* { font-family: 'DejaVu Sans', Verdana, sans-serif !important; }"; // la police de la CI (large) décide des débordements

async function open(page: Page, url: string, { wide = false }: { wide?: boolean } = {}) {
  await page.goto(url);
  await page.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
  if (wide) await page.addStyleTag({ content: WIDE_FONT });
}

const ui = (page: Page) => page.evaluate(() => window.__cdj.ui);

/** Lot I4 : les réglages s'ouvrent depuis le menu de pause en course (la barre du haut n'a plus que la pause, variante A du HUD) ; à l'accueil, c'est `#home-settings`. */
async function openSettings(page: Page) {
  await page.locator("#btn-pause").click();
  await page.locator("#pause-settings").click();
}

async function fresh(browser: Browser, viewport = DESKTOP, touch = false): Promise<BrowserContext> {
  return newClockedContext(browser, { viewport, hasTouch: touch, isMobile: touch, permissions: ["clipboard-read", "clipboard-write"] });
}

test.describe("l'accueil", () => {
  test("ouvrir le jeu : TRACK, circuit du jour, médailles, classement, Courir, Salon, profil, liens", async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await open(page, "/?api=demo");
    await expect(page.locator("body")).toHaveClass(/home/);
    // Lot I4 : l'étiquette Track dans le cadre crème de Du Jour (barre « ‹ DU JOUR », date et numéro du circuit).
    await expect(page.locator("#home h1")).toHaveText("TRACK");
    await expect(page.locator("#home .home-circuit")).toContainText("Circuit du jour ·");
    await expect(page.locator("#home .dj-barre-jeu")).toContainText("n°");
    await expect(page.locator("#home-portail")).toBeVisible();
    // Les quatre médailles en cases, nommées, avec leur temps.
    const medals = page.locator("#home .home-medailles .dj-medaille--case");
    await expect(medals).toHaveCount(4);
    for (const [i, name] of ["Diamant", "Or", "Argent", "Bronze"].entries()) await expect(medals.nth(i)).toContainText(name);
    await expect(medals.nth(0)).toContainText(/\d,\d{3}\ss/); // lot I4 : le temps s'écrit avec l'espace insécable du socle (« 36,892\u00a0s »), `\s` la couvre
    await expect(page.locator("#home .board-card .row").first()).toBeVisible({ timeout: 15_000 }); // classement (de démonstration)
    await expect(page.locator("#home-daily")).toContainText("Courir");
    await expect(page.locator("#home-salon")).toContainText("Rejoindre le Salon");
    await expect(page.locator("#home .salon-state")).toContainText("En cours :", { timeout: 15_000 });
    await expect(page.locator("#home .salon-state")).toContainText("prochain circuit dans");
    // Plus de carte de profil sur l'accueil : un lien vers le profil commun du portail, avec le chemin de retour vers le jeu.
    await expect(page.locator("#home-profile")).toHaveAttribute("href", /profil\/\?retour=/);
    for (const label of ["Archives", "Réglages", "Comment jouer"]) await expect(page.locator("#home .links").getByRole("button", { name: new RegExp(label) })).toBeVisible();
    // Le HUD de course n'est pas là : on est à l'accueil.
    await expect(page.locator("#menu")).toBeHidden();
    await expect(page.locator("#speed")).toBeHidden();
    await ctx.close();
  });

  test("la course ne démarre pas tant qu'on n'a pas choisi ; « Circuit du jour » la lance avec le classement visible", async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await open(page, "/?home=1&debug&api=demo&timescale=4");
    // Lot R13 : repris de « les liens de test… sautent l'accueil ; ?home=1 le force » (supprimé : la règle est dans test/homeLogic.test.ts).
    expect(page.url()).not.toContain("home="); // l'accueil forcé une fois ne reste pas dans l'adresse
    await page.waitForTimeout(2500);
    let state = await ui(page);
    expect(state.home).toBe(true);
    expect(await page.evaluate(() => window.__cdj.phase)).toBe("countdown");
    expect(await page.evaluate(() => (window.__cdj.race as { car: { tick: number } }).car.tick)).toBe(0); // rien n'a bougé derrière l'accueil
    await page.locator("#home-daily").click();
    await expect(page.locator("#home")).toBeHidden();
    state = await ui(page);
    expect(state.home).toBe(false);
    await expect(page.locator("#menu")).toBeVisible();
    await page.waitForFunction(() => window.__cdj.phase === "racing");
    // Le classement est affiché par défaut, dans un coin (ici : celui, figé, de la veille de la démonstration).
    await expect(page.locator("#board")).toBeVisible();
    await expect(page.locator("#board .row").first()).toBeVisible({ timeout: 15_000 });
    expect(state.boardFolded).toBe(false);
    await ctx.close();
  });

  test("Accueil (barre) : sans confirmation avant le départ, avec confirmation en pleine course ; (pause) idem", { tag: "@regression" }, async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await open(page, "/?home=1&debug&api=demo"); // temps réel : le décompte dure 3 s, le temps de cliquer
    await page.locator("#home-daily").click();
    // Décompte : pas de tour à perdre, on revient tout de suite. Lot I4 : la barre du haut n'a plus que la pause (variante A du HUD) ; « Accueil de Track » est dans son menu.
    expect(await page.evaluate(() => window.__cdj.phase)).toBe("countdown");
    await page.locator("#btn-pause").click();
    await expect(page.locator("#pause")).toBeVisible();
    await page.locator("#pause-home").click();
    await expect(page.locator("#home")).toBeVisible();
    expect(await page.evaluate(() => window.__cdj.phase)).toBe("countdown");
    await page.locator("#home-daily").click();
    await page.waitForFunction(() => window.__cdj.phase === "racing");
    // En pleine course : « Accueil de Track » demande confirmation, « Rester » reprend le menu de pause.
    await page.locator("#btn-pause").click();
    await expect(page.locator("#pause")).toBeVisible();
    await page.locator("#pause-home").click();
    await expect(page.locator("#pause-confirm")).toBeVisible();
    await expect(page.locator("#pause-menu")).toBeHidden();
    await page.locator("#pause-stay").click();
    await expect(page.locator("#pause-menu")).toBeVisible();
    // Depuis le menu de pause : « Accueil », « Retour à l'accueil ».
    await page.locator("#pause-home").click();
    await expect(page.locator("#pause-confirm")).toBeVisible();
    await page.locator("#pause-leave").click();
    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("#pause")).toBeHidden();
    expect(await page.evaluate(() => window.__cdj.phase)).toBe("countdown"); // la voiture est revenue au départ
    expect(await page.evaluate(() => window.__cdj.paused)).toBe(false);
    await ctx.close();
  });

  test("clavier : tout l'accueil se parcourt à la tabulation, focus visible (contour ambre de 3 px sur l'asphalte)", { tag: "@regression" }, async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await open(page, "/?api=demo&home=1");
    await expect(page.locator("#home-daily")).toBeVisible();
    const vus = new Map<string, { sombre: boolean; style: string; largeur: string; couleur: string }>();
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const e = document.activeElement as HTMLElement | null;
        if (!e || !e.closest("#home")) return null;
        const cs = getComputedStyle(e);
        return { cle: e.id || (e.getAttribute("aria-label") ?? e.textContent ?? "").trim().slice(0, 40), sombre: !!e.closest(".etiquette"), style: cs.outlineStyle, largeur: cs.outlineWidth, couleur: cs.outlineColor };
      });
      if (info) vus.set(info.cle, info);
    }
    // Tout ce que l'accueil propose est joignable au clavier : retour au portail, Courir, le Salon, les archives, les réglages, l'aide, le profil.
    for (const id of ["home-portail", "home-daily", "home-salon", "home-archive", "home-settings", "home-howto", "home-profile"]) expect([...vus.keys()], id).toContain(id);
    for (const [cle, v] of vus) {
      expect(v.style, `${cle} : un contour au focus`).toBe("solid");
      expect(parseFloat(v.largeur), `${cle} : contour d'au moins 3 px`).toBeGreaterThanOrEqual(3);
      if (v.sombre) expect(v.couleur, `${cle} : ambre sur asphalte`).toBe("rgb(242, 181, 68)"); // --dj-ambre
    }
    await ctx.close();
  });

  test("sans serveur : le classement le dit, le Salon est grisé, le jeu reste jouable", async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await open(page, "/?home=1&debug");
    await expect(page.locator("#home .board-card")).toContainText("Pas de classement ici");
    await expect(page.locator("#home .salon-state")).toContainText("a besoin du serveur", { timeout: 15_000 });
    await expect(page.locator("#home-salon")).toBeDisabled();
    await page.locator("#home-daily").click();
    await page.waitForFunction(() => window.__cdj.phase === "racing");
    await expect(page.locator("#board")).toBeHidden(); // rien à montrer sans classement
    await ctx.close();
  });

  test("serveur muet : messages clairs, « Réessayer », la course reste jouable", { tag: "@regression" }, async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await open(page, "/?home=1&debug&api=http://127.0.0.1:9");
    await expect(page.locator("#home .board-card")).toContainText("Hors ligne", { timeout: 15_000 });
    await expect(page.locator("#home .salon-state")).toContainText("ne répond pas", { timeout: 15_000 });
    await expect(page.locator("#home .salon-state").getByRole("button", { name: "Réessayer" })).toBeVisible();
    await expect(page.locator("#home-salon")).toBeEnabled(); // on peut essayer : le jeu retombe sur le circuit du jour avec un message
    await ctx.close();
  });
});

test.describe("« Comment jouer »", { tag: "@regression" }, () => {
  test("dans le jeu, une seule fois : le voile à rayures sur la scène, trois points, « C'est parti » ; ensuite depuis la pause et l'accueil", async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await open(page, "/?api=demo");
    await expect(page.locator("#howto")).toBeHidden(); // l'accueil d'abord
    await page.locator("#home-daily").click();
    // Retouche du lot I4 (charte rév. 7) : l'aide s'ouvre dans le jeu (voile à rayures + étiquette asphalte), plus dans le cadre crème de l'accueil.
    await expect(page.locator("#howto")).toBeVisible();
    await expect(page.locator("#howto")).toHaveClass(/voile/);
    await expect(page.locator("#howto")).not.toHaveClass(/cadre/);
    await expect(page.locator("#howto")).toContainText("Comment jouer");
    await expect(page.locator("#howto .point")).toHaveCount(3);
    await expect(page.locator("#howto kbd", { hasText: "Entrée" })).toBeVisible(); // au clavier : les touches des actions de course
    await expect(page.locator("#home")).toBeHidden(); // la scène est derrière, l'accueil est parti ; le jeu est gelé tant que l'aide est ouverte
    await page.locator("#howto-done").click();
    await expect(page.locator("#howto")).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem("cdj:howto"))).toBe("1");

    // Seconde visite : directement la course, l'aide ne revient pas.
    await page.reload();
    await page.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
    await page.locator("#home-daily").click();
    await expect(page.locator("#howto")).toBeHidden();
    await expect(page.locator("#home")).toBeHidden();
    // Toujours accessible : depuis la pause (Échap la ferme et ramène à la pause), puis depuis l'accueil.
    await page.keyboard.press("p");
    await page.locator("#pause-howto").click();
    await expect(page.locator("#howto")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#howto")).toBeHidden();
    await expect(page.locator("#pause")).toBeVisible();
    await page.locator("#pause-resume").click();
    await ctx.close();
  });

  test("un lien direct (course) à la première visite montre l'aide avant le départ, une seule fois", async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await open(page, "/?scenario=essai");
    await expect(page.locator("#howto")).toBeVisible();
    await page.locator("#howto-done").click();
    await expect(page.locator("#howto")).toBeHidden();
    await page.reload();
    await page.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
    await expect(page.locator("#howto")).toBeHidden();
    await ctx.close();
  });

  // Lot R13 (docs/tests.md) : deux formats, le téléphone en paysage et l'ordinateur ; le paysage compact 740×360 est retiré.
  for (const vp of [{ width: 844, height: 390 }]) {
    test(`téléphone en paysage (${vp.width}×${vp.height}) : les doigts d'abord, le schéma aux bords, tout tient dans l'écran, « C'est parti » de 44 px`, async ({ browser }) => {
      const ctx = await fresh(browser, vp, true);
      const page = await ctx.newPage();
      await open(page, "/?api=demo&touch=1&scenario=essai", { wide: true });
      await expect(page.locator("#howto")).toBeVisible();
      await expect(page.locator("#howto .point")).toHaveCount(3);
      await expect(page.locator("#howto .point").first()).toContainText("bas à gauche");
      await expect(page.locator("#howto .schema")).toBeVisible();
      await expect(page.locator("#howto kbd")).toHaveCount(0); // sur téléphone : le schéma, pas la liste des touches
      const dialogue = (await page.locator("#howto .dialogue").boundingBox())!;
      expect(dialogue.x).toBeGreaterThanOrEqual(-1);
      expect(dialogue.y).toBeGreaterThanOrEqual(-1);
      expect(dialogue.x + dialogue.width).toBeLessThanOrEqual(vp.width + 1);
      expect(dialogue.y + dialogue.height).toBeLessThanOrEqual(vp.height + 1);
      const done = page.locator("#howto-done");
      await done.scrollIntoViewIfNeeded(); // si le contenu dépasse (police large de la CI), il défile dans le dialogue
      const box = (await done.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(43.5);
      expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
      await done.click();
      await expect(page.locator("#howto")).toBeHidden();
      await ctx.close();
    });
  }
});

test.describe("réglages", { tag: "@regression" }, () => {

  test("chaque onglet : les commandes sont là, tiennent à l'écran, font au moins 44 px, et les choix s'appliquent", async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await open(page, "/?home=1&debug&api=demo&timescale=4", { wide: true });
    await page.locator("#home-daily").click();
    await page.waitForFunction(() => window.__cdj.phase === "racing");
    await openSettings(page);
    expect((await ui(page)).settings).toBe(true);
    expect((await ui(page)).paused).toBe(true); // lot I4 : on y arrive par le menu de pause (qui reste dessous) ; le jeu est gelé
    const t0 = await page.locator("#timer").textContent();
    await page.waitForTimeout(800);
    expect(await page.locator("#timer").textContent()).toBe(t0); // gelé : le chrono ne bouge pas

    const shots: Record<string, string> = { graphics: "graphismes", sound: "son", game: "jeu", controls: "commandes" }; // lot I4 : plus d'onglet Profil (le profil est au portail)
    for (const [tab] of Object.entries(shots)) {
      await page.locator(`#tab-${tab}`).click();
      await expect(page.locator(`#page-${tab}`)).toBeVisible();
      for (const b of await page.locator(`#page-${tab} button:visible, #page-${tab} summary:visible`).all()) {
        const box = (await b.boundingBox())!;
        expect(box.height, `${tab} : un bouton fait moins de 44 px`).toBeGreaterThanOrEqual(43.5);
      }
      expectNoOverlap(await boxes(page, ["#settings .etiquette"]), DESKTOP);
    }

    // Graphismes : secousses, particules, vitesse.
    await page.locator("#tab-graphics").click();
    const row = (label: string) => page.locator("#page-graphics .reglage", { hasText: label });
    await row("Secousses de caméra").getByRole("radio", { name: "Non" }).click();
    await row("Particules").getByRole("radio", { name: "Non" }).click();
    await row("Traces de pneus").getByRole("radio", { name: "Non" }).click();
    await row("Ombres").getByRole("radio", { name: "Non" }).click();
    await row("Sensation de vitesse").getByRole("radio", { name: "Aucune" }).click();
    let s = (await ui(page)).settingsValues;
    expect(s).toMatchObject({ shake: false, particles: false, skids: false, shadows: false, speedFeel: "off" });
    expect((await page.evaluate(() => window.__cdj.render)).shadowMap).toBe(0); // plus de carte d'ombres
    await row("Ombres").getByRole("radio", { name: "Oui" }).click();
    await row("Particules").getByRole("radio", { name: "Oui" }).click();

    // Son : le volume général, le moteur, muet.
    await page.locator("#tab-sound").click();
    await page.getByLabel("Moteur", { exact: true }).fill("0.3");
    await page.getByLabel("Volume général").fill("0.8");
    let audio = await page.evaluate(() => JSON.parse(localStorage.getItem("cdj:audio")!));
    expect(audio).toMatchObject({ engine: 0.3, volume: 0.8 });
    await page.getByRole("radio", { name: "Muet" }).click();
    audio = await page.evaluate(() => JSON.parse(localStorage.getItem("cdj:audio")!));
    expect(audio.volume).toBe(0);
    await expect(page.locator("#pause-sound")).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("radio", { name: "Son", exact: true }).click();
    audio = await page.evaluate(() => JSON.parse(localStorage.getItem("cdj:audio")!));
    expect(audio.volume).toBe(0.8); // le dernier volume revient

    // Jeu : caméra par défaut, unité, temps intermédiaires, classement.
    await page.locator("#tab-game").click();
    await page.getByRole("radio", { name: "Capot" }).click();
    expect(await page.evaluate(() => localStorage.getItem("cdj:camera"))).toBe("capot");
    await page.getByRole("radio", { name: "mph" }).click();
    await page.getByRole("radio", { name: "Le premier" }).click();
    await page.locator("#page-game .reglage", { hasText: "Temps intermédiaires" }).getByRole("radio", { name: "Non" }).click();
    await page.locator("#page-game .reglage", { hasText: "Classement en course" }).getByRole("radio", { name: "Non" }).click();
    s = (await ui(page)).settingsValues;
    expect(s).toMatchObject({ unit: "mph", ghost: "first", splits: false, board: false });
    await expect(page.locator("#board")).toHaveClass(/folded/);
    await page.keyboard.press("Escape");
    await expect(page.locator("#settings")).toBeHidden();
    await expect(page.locator("#speed")).toContainText("mph");
    await expect(page.locator("body")).toHaveClass(/no-splits/);

    // Tout est mémorisé et versionné ; rechargé, c'est pareil.
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cdj:settings")!))).toMatchObject({ version: 1, unit: "mph", ghost: "first", splits: false, board: false, shake: false, speedFeel: "off" });
    await open(page, "/?debug&api=demo&timescale=4"); // (l'accueil forcé s'était retiré de l'adresse : même page qu'un rechargement)
    await page.waitForFunction(() => window.__cdj?.ui);
    s = (await ui(page)).settingsValues;
    expect(s).toMatchObject({ unit: "mph", ghost: "first", splits: false, board: false });
    expect((await ui(page)).boardFolded).toBe(true);
    // Rétablir les réglages par défaut.
    await openSettings(page);
    await page.locator("#settings-reset").click();
    s = (await ui(page)).settingsValues;
    expect(s).toMatchObject({ unit: "kmh", ghost: "mine", splits: true, board: true, shake: true, speedFeel: "normal" });
    await ctx.close();
  });

});

test.describe("pause et touches", () => {

  test("manette : Start ouvre la pause, X recommence, Y reprend au point de contrôle", { tag: "@regression" }, async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      const pad = { connected: true, axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
      (window as unknown as { __pad: typeof pad }).__pad = pad;
      navigator.getGamepads = () => [pad as unknown as Gamepad];
    });
    await open(page, "/?debug&scenario=essai&timescale=4");
    await page.waitForFunction(() => window.__cdj.phase === "racing");
    // Le bouton reste enfoncé JUSQU'À ce que l'effet soit visible (puis relâché) : le jeu lit la manette une fois par image, et en rendu
    // logiciel une image peut durer plus que n'importe quelle durée d'appui choisie d'avance (700 ms ne suffisait pas : test bloqué en CI).
    const press = async (index: number, effect: () => boolean) => {
      await page.evaluate((i) => ((window as unknown as { __pad: { buttons: { pressed: boolean }[] } }).__pad.buttons[i]!.pressed = true), index);
      await page.waitForFunction(effect);
      await page.evaluate((i) => ((window as unknown as { __pad: { buttons: { pressed: boolean }[] } }).__pad.buttons[i]!.pressed = false), index);
    };
    await press(9, () => window.__cdj.paused === true); // Start : pause
    await expect(page.locator("#pause")).toBeVisible();
    await press(2, () => window.__cdj.paused === false); // X : depuis le départ (referme aussi la pause)
    await page.waitForFunction(() => window.__cdj.phase === "racing");
    await page.waitForFunction(() => (window.__cdj.race as { car: { tick: number } }).car.tick > 120); // la course tourne (1 s de simulation)
    await press(3, () => (window.__cdj.race as { respawns: number }).respawns >= 1); // Y : dernier point de contrôle (ici le départ : la reprise est comptée)
    await ctx.close();
  });

  test("le chrono : il part au « PARTEZ ! », même voiture immobile ; il ne tourne ni à l'accueil, ni au décompte, ni en pause", async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await open(page, "/?home=1&debug&api=demo");
    await page.waitForTimeout(1500); // à l'accueil, en temps réel : rien ne doit changer pendant 1,5 s
    await expect(page.locator("#timer")).toBeHidden(); // à l'accueil, le HUD de course est caché et rien ne tourne
    expect(await page.evaluate(() => (window.__cdj.race as { car: { tick: number } }).car.tick)).toBe(0);
    // Lot R3 : la suite se fait pas à pas (`manual` + `advance`). Avant, des attentes en temps réel accéléré (`timescale=2`, 500 ms puis 1,2 s)
    // supposaient qu'une image au moins était dessinée dans la fenêtre : sur un runner chargé, la première image de la course a pris plus de
    // 1,2 s (reproduit en local, processeur occupé : 0 pas au lieu de > 100, comme en CI : 7 et 0). En pas à pas, chaque étape attend son
    // image et compte des pas exacts : le décompte qui ne tourne pas, la course qui tourne voiture immobile, la pause qui fige tout.
    await page.evaluate(() => window.__cdj.manual(true));
    await page.locator("#home-daily").click();
    await page.waitForFunction(() => window.__cdj.phase === "countdown");
    await page.evaluate(() => window.__cdj.advance(120)); // 1 s de décompte
    expect(await page.evaluate(() => window.__cdj.phase)).toBe("countdown");
    await expect(page.locator("#timer")).toHaveText("0,000 s"); // décompte : zéro
    expect(await page.evaluate(() => (window.__cdj.race as { car: { tick: number } }).car.tick)).toBe(0);
    await page.evaluate(() => window.__cdj.advance(240)); // la fin des 3 s de décompte : « PARTEZ ! »
    await page.waitForFunction(() => window.__cdj.phase === "racing");
    await page.evaluate(() => window.__cdj.advance(240)); // 2 s de course sans toucher à rien
    const running = await page.evaluate(() => (window.__cdj.race as { car: { tick: number } }).car.tick);
    expect(running).toBeGreaterThan(100); // il tourne depuis le départ, la voiture n'a pas bougé : c'est voulu (comme Trackmania)
    expect(await page.evaluate(() => Math.hypot(window.__cdj.car.vx, window.__cdj.car.vz))).toBeLessThan(0.5);
    await page.evaluate(() => window.__cdj.advance(120)); // au-delà de 2,5 s immobile : l'aide apparaît
    await expect(page.locator("#aide")).toContainText("Le chrono tourne", { timeout: 20_000 }); // et on le dit au joueur
    // Pause : le chrono s'arrête net (même 2 s de pas demandés n'y changent rien), et repart là où il était.
    await page.keyboard.press("p");
    await page.waitForFunction(() => window.__cdj.paused === true);
    const a = await page.locator("#timer").textContent();
    const pausedTick = await page.evaluate(() => (window.__cdj.race as { car: { tick: number } }).car.tick);
    await page.evaluate(() => window.__cdj.advance(240));
    expect(await page.locator("#timer").textContent()).toBe(a);
    expect(await page.evaluate(() => (window.__cdj.race as { car: { tick: number } }).car.tick)).toBe(pausedTick);
    await page.keyboard.press("p");
    await page.waitForFunction(() => window.__cdj.paused === false);
    await page.evaluate(() => window.__cdj.advance(120));
    await expect(page.locator("#timer")).not.toHaveText(a!, { timeout: 15_000 });
    expect(await page.evaluate(() => (window.__cdj.race as { car: { tick: number } }).car.tick)).toBe(pausedTick + 120);
    await ctx.close();
  });
});

// Lot I4 : la carte du profil (pseudo, statistiques, copier / charger un code) n'existe plus dans le jeu — « plus d'écran de profil propre au jeu » : Réglages › « Mon profil Du Jour › » et
// l'accueil mènent au profil commun du portail (`?retour=`). Les cas qui vivaient ici (pseudo modifiable, statistiques d'après les records, meilleure place, code copié / chargé, code
// invalide) sont ceux du profil du portail : `apps/web/e2e/portail-jour.spec.ts` (« profil », « code chargé dans le profil ») ; le lien du jeu vers le profil : `accueil` (plus haut) et `profil.spec.ts`.

// --- Classement et arrivée, avec une API simulée ---------------------------------------------------------------------------------------
const API = "http://api.test";
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS" };
const json = (body: unknown, status = 200) => ({ status, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });
const day = TODAY;
const circuit = dailyCircuit(day);

async function mockApi(ctx: BrowserContext, board: { rank: number; name: string; ms: number; medal: string | null }[], me: { rank: number; name: string; ms: number; medal: string | null } | null) {
  await ctx.route(`${API}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (url.pathname === `/api/day/${circuit.date}`) return route.fulfill(json({ date: circuit.date, variant: 0, theme: null, trackId: circuit.track.id }));
    if (url.pathname.endsWith("/leaderboard")) return route.fulfill(json({ date: circuit.date, participants: Math.max(12, me?.rank ?? 0), top: board, me }));
    if (url.pathname === "/api/salon/now") {
      const serverMs = clockNow();
      return route.fulfill(json({ serverMs, session: Math.floor(serverMs / 600_000), startMs: Math.floor(serverMs / 600_000) * 600_000, endMs: (Math.floor(serverMs / 600_000) + 1) * 600_000, trackId: "salon-x", players: 4 }));
    }
    return route.fulfill(json({ error: "no_ghost", message: "Aucun fantôme" }, 404));
  });
}

test.describe("classement", { tag: "@regression" }, () => {
  const rows = [
    { rank: 1, name: "Nowy", ms: 30_000, medal: "gold" },
    { rank: 2, name: "Alice", ms: 31_000, medal: "silver" },
    { rank: 3, name: "Nowy", ms: 32_000, medal: "bronze" },
    { rank: 4, name: "Bob", ms: 33_000, medal: null },
  ];

  test("deux joueurs au même pseudo se distinguent ; ta ligne est marquée « toi » ; l'accueil montre ta ligne même hors du top", async ({ browser }) => {
    const ctx = await fresh(browser);
    const me = { rank: 11, name: "Nowy", ms: 44_000, medal: null };
    await mockApi(ctx, rows, me);
    const page = await ctx.newPage();
    await open(page, `/?home=1&debug&api=${encodeURIComponent(API)}`);
    const board = page.locator("#home .board-card");
    await expect(board.locator(".row")).toHaveCount(5, { timeout: 15_000 });
    await expect(board.locator(".row").nth(0)).toContainText("Nowy");
    await expect(board.locator(".row").nth(2)).toContainText("Nowy·2");
    await expect(board.locator(".gap")).toHaveText("…");
    await expect(board.locator(".row.me")).toContainText("Nowy·3");
    await expect(board.locator(".row.me .you")).toHaveText("toi");
    await expect(board.locator(".you")).toHaveCount(1);
    // Le Salon, vu par l'accueil : thème, temps restant, joueurs (réponse du serveur simulé).
    await expect(page.locator("#home .salon-state")).toContainText("4 joueurs présents", { timeout: 15_000 });
    // Ta meilleure place est retenue pour le profil (le profil commun du portail la relit).
    await expect.poll(() => page.evaluate((date) => localStorage.getItem(`cdj:rank:${date}`), circuit.date)).toContain('"rank":11');
    await ctx.close();
  });

  test("en course : classement compact dans le coin, ta ligne marquée, et il se replie", async ({ browser }) => {
    const ctx = await fresh(browser);
    await mockApi(ctx, rows, { rank: 2, name: "Alice", ms: 31_000, medal: "silver" });
    const page = await ctx.newPage();
    await open(page, `/?debug&api=${encodeURIComponent(API)}`);
    await expect(page.locator("#board")).toBeVisible();
    await expect(page.locator("#board .row")).toHaveCount(4, { timeout: 15_000 });
    await expect(page.locator("#board .row.me .you")).toHaveText("toi");
    await expect(page.locator("#board .row").nth(2)).toContainText("Nowy·2");
    await page.locator("#board .bhead").click();
    await expect(page.locator("#board")).toHaveClass(/folded/);
    await ctx.close();
  });
});

// --- Mise en page : accueil, réglages, aide, pause et HUD, en portrait et en paysage, avec la police large de la CI -----------------
const PHONES = [
  { name: "portrait", width: 390, height: 844 },
  { name: "paysage", width: 844, height: 390 },
] as const;

for (const vp of PHONES) {
  test(`téléphone ${vp.name} (${vp.width}×${vp.height}) : accueil, réglages, aide et pause sans chevauchement, cibles d'au moins 44 px`, { tag: "@regression" }, async ({ browser }) => {
    const ctx = await fresh(browser, vp, true);
    const page = await ctx.newPage();
    await open(page, "/?home=1&debug&api=demo&touch=1&timescale=4", { wide: true });
    await expect(page.locator("#home .board-card .row").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#home .salon-state")).toContainText("En cours :", { timeout: 15_000 });

    // Accueil : rien ne déborde à droite, les cartes ne se chevauchent pas, tout se touche du doigt.
    const sizes = await page.evaluate(() => {
      // Lot I4 : le défilement est celui de l'étiquette (`.etiquette__corps`) ; « Courir » est collé en bas (sticky) : il recouvre exprès ce qui défile dessous.
      const corps = document.querySelector<HTMLElement>("#home .etiquette__corps")!;
      const cards = [...document.querySelectorAll("#home .etiquette__tete, #home .home-apercu, #home .home-resume, #home .home-medailles, #home .home-fantome, #home .card, #home .home-liens")].filter((e) => (e as HTMLElement).offsetParent).map((e) => {
        const r = e.getBoundingClientRect();
        return { name: e.className, x: r.x, y: r.y + corps.scrollTop, w: r.width, h: r.height };
      });
      return { overflowX: corps.scrollWidth - corps.clientWidth, cards, clip: [...document.querySelectorAll("#home .card")].map((c) => c.scrollWidth - c.clientWidth) };
    });
    expect(sizes.overflowX, "l'accueil déborde en largeur").toBeLessThanOrEqual(1);
    for (const c of sizes.clip) expect(c, "une carte coupe son contenu").toBeLessThanOrEqual(1);
    for (let i = 0; i < sizes.cards.length; i++) {
      for (let j = i + 1; j < sizes.cards.length; j++) {
        const a = sizes.cards[i]!;
        const b = sizes.cards[j]!;
        const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        expect(ox > 2 && oy > 2, `${a.name} chevauche ${b.name}`).toBe(false);
      }
    }
    for (const b of await page.locator("#home button:visible").all()) expect((await b.boundingBox())!.height, `un bouton de l'accueil est trop petit (${await b.textContent()})`).toBeGreaterThanOrEqual(43.5);
    await expect(page.locator("#home-daily")).toBeInViewport(); // le grand bouton se voit sans défiler
    // Défiler jusqu'en bas : « Courir » reste visible (collé en bas de l'étiquette), le dernier bloc se voit.
    await page.locator("#home .etiquette__corps").evaluate((e) => e.scrollTo(0, 99999));
    await expect(page.locator("#home-daily")).toBeInViewport();
    await expect(page.locator("#home .home-liens")).toBeInViewport();
    await page.locator("#home .etiquette__corps").evaluate((e) => e.scrollTo(0, 0));

    // Réglages, onglet par onglet.
    await page.locator("#home-settings").click();
    for (const tab of ["graphics", "sound", "game", "controls"]) {
      await page.locator(`#tab-${tab}`).click();
      expectNoOverlap(await boxes(page, ["#settings .etiquette"]), vp);
      for (const b of await page.locator(`#page-${tab} button:visible, #page-${tab} summary:visible`).all()) expect((await b.boundingBox())!.height, `${tab} : bouton trop petit`).toBeGreaterThanOrEqual(43.5);
      const over = await page.locator(`#page-${tab}`).evaluate((e) => e.scrollWidth - e.clientWidth);
      expect(over, `${tab} déborde en largeur`).toBeLessThanOrEqual(1);
    }
    await page.locator("#tab-controls").click();
    await expect(page.locator("#page-controls .reglages__tactile")).toBeVisible(); // les réglages tactiles sont dans Commandes
    await page.getByRole("radio", { name: "Boutons" }).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cdj:touch")!).steerMode)).toBe("buttons");
    await page.getByRole("radio", { name: "Glissière" }).click();
    await page.locator("#settings .dj-barre-jeu__retour").click();
    await expect(page.locator("#settings")).toBeHidden();

    // Aide.
    await page.locator("#home-howto").click();
    expectNoOverlap(await boxes(page, ["#howto .dialogue"]), vp);
    await page.locator("#howto-done").click();

    // Course, pause, HUD.
    await page.locator("#home-daily").click();
    await page.waitForFunction(() => window.__cdj.phase === "racing");
    await page.addStyleTag({ content: "#banner { display: none !important; }" });
    if (vp.name !== "portrait") {
      // paysage : on conduit ; le HUD complet ne se chevauche pas (classement compris)
      await expect(page.locator("#board")).toBeHidden(); // téléphone : le classement est replié par défaut en course
      await page.keyboard.press("l");
      await expect(page.locator("#board .row").first()).toBeVisible({ timeout: 15_000 });
      await expect(page.locator("#intro")).not.toHaveClass(/\bon\b/, { timeout: 30_000 }); // l'introduction (titre, fantôme) s'efface (lot R10 : un état, plus 1,6 s d'attente)
      const hud = await boxes(page, ["#hud-centre", "#medals", "#menu", "#speed", "#board", "#touch .steer-left", "#touch .steer-right", "#touch .pedal-brake", "#touch .pedal-gas"]);
      expectNoOverlap(hud, vp);
      expectCentreLibre(hud, vp);
    } else {
      await page.locator("#rotate button").click().catch(() => undefined); // portrait : « Jouer quand même »
      await page.keyboard.press("l");
      await expect(page.locator("#board .row").first()).toBeVisible({ timeout: 15_000 });
      await expect(page.locator("#intro")).not.toHaveClass(/\bon\b/, { timeout: 30_000 });
      expectNoOverlap(await boxes(page, ["#hud-centre", "#medals", "#menu", "#speed", "#board"]), vp);
    }
    for (const b of await page.locator("#menu button:visible").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
    await page.locator("#btn-pause").click(); // lot I4 : la pause est le bouton du HUD en haut à gauche
    await expect(page.locator("#pause")).toBeVisible();
    expectNoOverlap(await boxes(page, ["#pause .dialogue"]), vp);
    for (const b of await page.locator("#pause button:visible").all()) expect((await b.boundingBox())!.height, `pause : ${await b.textContent()}`).toBeGreaterThanOrEqual(43.5);
    await ctx.close();
  });
}

test("ordinateur : le HUD de course, la pause et l'arrivée tiennent dans l'écran (police large)", { tag: "@regression" }, async ({ browser }) => {
  const ctx = await fresh(browser, { width: 1000, height: 560 });
  await mockApi(ctx, rows(), { rank: 2, name: "Alice", ms: 31_000, medal: "silver" });
  const page = await ctx.newPage();
  await open(page, `/?debug&api=${encodeURIComponent(API)}&timescale=4`, { wide: true });
  await page.waitForFunction(() => window.__cdj.phase === "racing");
  await expect(page.locator("#board .row").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("#banner")).toHaveText("", { timeout: 30_000 }); // le bandeau du départ s'efface (lot R10 : un état, plus 3,5 s d'attente)
  await expect(page.locator("#intro")).not.toHaveClass(/\bon\b/, { timeout: 30_000 });
  expectNoOverlap(await boxes(page, ["#hud-centre", "#medals", "#rang", "#menu", "#speed", "#board", "#helpchip"]), { width: 1000, height: 560 });
  await ctx.close();
});

function rows() {
  return [
    { rank: 1, name: "Alice", ms: 30_000, medal: "gold" },
    { rank: 2, name: "Bob", ms: 31_000, medal: "silver" },
  ];
}

// Les liens et boutons de l'ancienne interface ont disparu.
test("plus de bouton Salon ni de ligne d'aide minuscule en course ; « Comment jouer » la remplace", { tag: "@regression" }, async ({ browser }) => {
  const ctx = await fresh(browser);
  const page = await ctx.newPage();
  await open(page, "/?debug&api=demo&scenario=essai");
  await expect(page.locator("#btn-mode, #btn-archive, #btn-board, #pause-mode")).toHaveCount(0);
  await expect(page.locator("#info")).toHaveText("");
  await expect(page.locator("#helpchip")).toContainText("Comment jouer");
  const labels = await page.locator("#menu button:visible").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") || e.textContent));
  // Lot I4 (HUD « plaques en haut ») : la barre du haut n'a que la pause (ni point de contrôle ni recommencer : le clavier a ses touches) ; Accueil, Réglages, Fantôme et Son sont dans son menu.
  // Lot I7 : la caméra et le plein écran y sont aussi, toujours en vue (le plein écran seulement si le navigateur le permet : Chromium oui).
  expect(labels).toEqual(["Pause", "Caméra : proche", "Plein écran"]);
  await page.locator("#btn-pause").click();
  await expect(page.locator("#pause-settings")).toHaveText("Réglages");
  await expect(page.locator("#pause-home")).toHaveText("Accueil de Track");
  await expect(page.locator("#pause-ghost")).toContainText("Fantôme");
  await expect(page.locator("#pause-sound")).toContainText("Son");
  await ctx.close();
});
