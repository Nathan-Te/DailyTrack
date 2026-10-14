import { expect, test, type Browser, type BrowserContext, type Page, TODAY, newClockedContext, clockNow } from "./fixtures";
import { dailyCircuit, formatDay } from "@cdj/sim";
import { boxes, expectNoOverlap } from "./layout";

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

async function fresh(browser: Browser, viewport = DESKTOP, touch = false): Promise<BrowserContext> {
  return newClockedContext(browser, { viewport, hasTouch: touch, isMobile: touch, permissions: ["clipboard-read", "clipboard-write"] });
}

test.describe("l'accueil", () => {
  test("ouvrir le jeu : titre, circuit du jour, classement, deux grands boutons, profil, liens", async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await open(page, "/?api=demo");
    await expect(page.locator("body")).toHaveClass(/home/);
    await expect(page.locator("#home h1")).toHaveText("Circuit du Jour");
    await expect(page.locator("#home .today h2")).toContainText("Circuit du Jour n°");
    await expect(page.locator("#home .today .when")).toContainText("thème");
    // Les quatre médailles, nommées, avec leur temps.
    const medals = page.locator("#home .medals li");
    await expect(medals).toHaveCount(4);
    for (const [i, name] of ["Auteur", "Or", "Argent", "Bronze"].entries()) await expect(medals.nth(i)).toContainText(name);
    await expect(medals.nth(0)).toContainText(/\d,\d{3} s/);
    await expect(page.locator("#home .board-card .row").first()).toBeVisible({ timeout: 15_000 }); // classement (de démonstration)
    await expect(page.locator("#home-daily")).toContainText("Circuit du jour");
    await expect(page.locator("#home-salon")).toContainText("Salon live");
    await expect(page.locator("#home .salon-state")).toContainText("En cours :", { timeout: 15_000 });
    await expect(page.locator("#home .salon-state")).toContainText("prochain circuit dans");
    await expect(page.locator("#home .profile h3")).toHaveText("Ton profil");
    await expect(page.getByRole("button", { name: "Copier mon code" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Charger un code" })).toBeVisible();
    for (const label of ["Archives", "Réglages", "Comment jouer"]) await expect(page.locator("#home .links").getByRole("button", { name: new RegExp(label) })).toBeVisible();
    // Le HUD de course n'est pas là : on est à l'accueil.
    await expect(page.locator("#menu")).toBeHidden();
    await expect(page.locator("#speed")).toBeHidden();
    await page.screenshot({ path: "../../docs/lots/img/lot-29-accueil-ordinateur.png" });
    await ctx.close();
  });

  test("la course ne démarre pas tant qu'on n'a pas choisi ; « Circuit du jour » la lance avec le classement visible", async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await open(page, "/?home=1&debug&api=demo&timescale=4");
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

  test("Accueil (barre) : sans confirmation avant le départ, avec confirmation en pleine course ; (pause) idem", async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await open(page, "/?home=1&debug&api=demo"); // temps réel : le décompte dure 3 s, le temps de cliquer
    await page.locator("#home-daily").click();
    // Décompte : pas de tour à perdre, on revient tout de suite.
    expect(await page.evaluate(() => window.__cdj.phase)).toBe("countdown");
    await page.locator("#btn-home").click();
    await expect(page.locator("#home")).toBeVisible();
    expect(await page.evaluate(() => window.__cdj.phase)).toBe("countdown");
    await page.locator("#home-daily").click();
    await page.waitForFunction(() => window.__cdj.phase === "racing");
    // En pleine course : la pause s'ouvre avec la question, « Rester » reprend le menu de pause.
    await page.locator("#btn-home").click();
    await expect(page.locator("#pause")).toBeVisible();
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

  test("« Salon live » ouvre le Salon (démonstration)", async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await open(page, "/?home=1&debug&api=demo&salonMinutes=1");
    await expect(page.locator("#home .salon-state")).toContainText("En cours :", { timeout: 15_000 });
    await page.locator("#home-salon").click();
    await page.waitForURL(/mode=salon/);
    expect(page.url()).not.toContain("home=");
    await page.waitForFunction(() => window.__cdj?.salon);
    await expect(page.locator("#meta")).toContainText("Salon");
    await expect(page.locator("#home")).toBeHidden();
    // Dans le Salon, la barre du haut garde Accueil ; il n'y a plus de bouton Salon ; l'accueil est un lien de la page.
    await expect(page.locator("#btn-home")).toBeVisible();
    await expect(page.locator("#btn-mode")).toHaveCount(0);
    await page.locator("#btn-home").click();
    await page.waitForURL(/home=1/);
    await expect(page.locator("#home")).toBeVisible();
    await ctx.close();
  });

  test("les liens de test, de partage et d'archive sautent l'accueil ; ?home=1 le force", async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    const day = formatDay(TODAY - 1);
    for (const url of [`/?seed=${day}`, `/?day=${day}&api=demo`, "/?scenario=essai", "/?demo", "/?debug", "/?mode=salon&api=demo", "/?watch=best&api=demo&seed=2026-10-26", "/?theme=nuit"]) {
      await open(page, url);
      await expect(page.locator("#home"), url).toBeHidden();
      await expect(page.locator("body"), url).not.toHaveClass(/\bhome\b/);
    }
    await open(page, "/?home=1&debug&api=demo");
    await expect(page.locator("#home")).toBeVisible();
    expect(page.url()).not.toContain("home="); // l'accueil forcé une fois ne reste pas dans l'adresse
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

  test("serveur muet : messages clairs, « Réessayer », la course reste jouable", async ({ browser }) => {
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

test.describe("« Comment jouer »", () => {
  test("montré à la première visite, pas à la seconde ; accessible partout", async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await open(page, "/?api=demo");
    await expect(page.locator("#howto")).toBeHidden(); // l'accueil d'abord
    await page.locator("#home-daily").click();
    await expect(page.locator("#howto")).toBeVisible();
    await expect(page.locator("#howto")).toContainText("Comment jouer");
    await expect(page.locator("#howto")).toContainText("Points de contrôle");
    await expect(page.locator("#howto")).toContainText("Médailles");
    await expect(page.locator("#howto kbd", { hasText: "Espace" })).toBeVisible();
    await page.screenshot({ path: "../../docs/lots/img/lot-29-comment-jouer.png" });
    await expect(page.locator("#home")).toBeVisible(); // la course n'est pas lancée tant qu'on n'a pas fermé l'aide
    await page.locator("#howto-done").click();
    await expect(page.locator("#howto")).toBeHidden();
    await expect(page.locator("#home")).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem("cdj:howto"))).toBe("1");

    // Seconde visite : directement la course.
    await page.reload();
    await page.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
    await page.locator("#home-daily").click();
    await expect(page.locator("#howto")).toBeHidden();
    await expect(page.locator("#home")).toBeHidden();
    // Toujours accessible : bouton d'aide en course, pause, accueil, réglages.
    await page.locator("#helpchip").click();
    await expect(page.locator("#howto")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.locator("#howto")).toBeHidden();
    await page.keyboard.press("p");
    await page.locator("#pause-howto").click();
    await expect(page.locator("#howto")).toBeVisible();
    await ctx.close();
  });

  test("un lien direct (course) à la première visite montre l'aide avant le départ", async ({ browser }) => {
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

  test("sur téléphone, les doigts d'abord", async ({ browser }) => {
    const ctx = await fresh(browser, { width: 390, height: 844 }, true);
    const page = await ctx.newPage();
    await open(page, "/?api=demo&touch=1&scenario=essai");
    await expect(page.locator("#howto details.dev").first()).toHaveJSProperty("open", true);
    await expect(page.locator("#howto details.dev").first().locator("summary")).toHaveText("Avec les doigts");
    await expect(page.locator("#howto .tdiagram")).toBeVisible();
    await ctx.close();
  });
});

test.describe("réglages", () => {
  test("un changement de qualité s'applique tout de suite et survit au rechargement", async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await open(page, "/?debug&api=demo"); // sans accueil : derrière l'accueil la scène est plafonnée à « moyenne »
    await page.locator("#btn-settings").click();
    await expect(page.locator("#settings")).toBeVisible();
    await expect(page.locator("#tab-graphics")).toHaveAttribute("aria-selected", "true");
    await page.getByRole("radio", { name: "Basse", exact: true }).click();
    let state = await ui(page);
    expect(state.settingsValues.quality).toBe("low");
    expect(state.quality).toBe(0);
    expect(state.qualityLocked).toBe(true);
    expect((await page.evaluate(() => window.__cdj.render)).quality).toBe(0); // le rendu a vraiment changé (décor, ombres, halos)
    await page.getByRole("radio", { name: "Haute", exact: true }).click();
    expect((await page.evaluate(() => window.__cdj.render)).quality).toBe(2);
    await page.getByRole("radio", { name: "Moyenne", exact: true }).click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("cdj:settings")!));
    expect(saved).toMatchObject({ version: 1, quality: "medium" });
    await page.reload();
    await page.waitForFunction(() => window.__cdj?.ui);
    state = await ui(page);
    expect(state.settingsValues.quality).toBe("medium");
    expect(state.quality).toBe(1);
    expect((await page.evaluate(() => window.__cdj.render)).quality).toBe(1);
    // `?quality=` (essais) l'emporte, sans toucher au choix mémorisé.
    await open(page, "/?debug&api=demo&quality=2");
    expect((await ui(page)).quality).toBe(2);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cdj:settings")!).quality)).toBe("medium");
    // Retour à l'automatique.
    await open(page, "/?debug&api=demo");
    await page.locator("#btn-settings").click();
    await page.getByRole("radio", { name: "Automatique" }).click();
    state = await ui(page);
    expect(state.settingsValues.quality).toBe("auto");
    expect(state.qualityLocked).toBe(false);
    await ctx.close();
  });

  test("chaque onglet : les commandes sont là, tiennent à l'écran, font au moins 44 px, et les choix s'appliquent", async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await open(page, "/?home=1&debug&api=demo&timescale=4", { wide: true });
    await page.locator("#home-daily").click();
    await page.waitForFunction(() => window.__cdj.phase === "racing");
    await page.locator("#btn-settings").click();
    expect((await ui(page)).settings).toBe(true);
    expect((await ui(page)).paused).toBe(false); // ouvrir les réglages gèle le jeu sans mettre en pause
    const t0 = await page.locator("#timer").textContent();
    await page.waitForTimeout(800);
    expect(await page.locator("#timer").textContent()).toBe(t0); // gelé : le chrono ne bouge pas

    const shots: Record<string, string> = { graphics: "graphismes", sound: "son", game: "jeu", controls: "commandes", profile: "profil" };
    for (const [tab, name] of Object.entries(shots)) {
      await page.locator(`#tab-${tab}`).click();
      await expect(page.locator(`#page-${tab}`)).toBeVisible();
      for (const b of await page.locator(`#page-${tab} button:visible, #page-${tab} summary:visible`).all()) {
        const box = (await b.boundingBox())!;
        expect(box.height, `${tab} : un bouton fait moins de 44 px`).toBeGreaterThanOrEqual(43.5);
      }
      expectNoOverlap(await boxes(page, ["#settings .panel"]), DESKTOP);
      await page.screenshot({ path: `../../docs/lots/img/lot-29-reglages-${name}.png` });
    }

    // Graphismes : secousses, particules, vitesse.
    await page.locator("#tab-graphics").click();
    const row = (label: string) => page.locator("#page-graphics .setrow", { hasText: label });
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
    await expect(page.locator("#btn-sound")).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("radio", { name: "Son", exact: true }).click();
    audio = await page.evaluate(() => JSON.parse(localStorage.getItem("cdj:audio")!));
    expect(audio.volume).toBe(0.8); // le dernier volume revient

    // Jeu : caméra par défaut, unité, temps intermédiaires, classement.
    await page.locator("#tab-game").click();
    await page.getByRole("radio", { name: "Capot" }).click();
    expect(await page.evaluate(() => localStorage.getItem("cdj:camera"))).toBe("capot");
    await page.getByRole("radio", { name: "mph" }).click();
    await page.getByRole("radio", { name: "Le premier" }).click();
    await page.locator("#page-game .setrow", { hasText: "Temps intermédiaires" }).getByRole("radio", { name: "Non" }).click();
    await page.locator("#page-game .setrow", { hasText: "Classement en course" }).getByRole("radio", { name: "Non" }).click();
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
    await page.locator("#btn-settings").click();
    await page.locator("#settings-reset").click();
    s = (await ui(page)).settingsValues;
    expect(s).toMatchObject({ unit: "kmh", ghost: "mine", splits: true, board: true, shake: true, speedFeel: "normal" });
    await ctx.close();
  });

  test("le classement se replie (touche L, bouton) et l'état est mémorisé", async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await open(page, "/?debug&api=demo&seed=2026-10-26");
    await expect(page.locator("#board")).toBeVisible();
    await expect(page.locator("#board .row").first()).toBeVisible({ timeout: 15_000 });
    expect((await ui(page)).boardFolded).toBe(false);
    await page.keyboard.press("l");
    await expect(page.locator("#board")).toHaveClass(/folded/);
    await expect(page.locator("#board .bbody")).toBeHidden();
    await page.reload();
    await page.waitForFunction(() => window.__cdj?.ui);
    expect((await ui(page)).boardFolded).toBe(true);
    await page.locator("#board .bhead").click();
    await expect(page.locator("#board .bbody")).toBeVisible();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cdj:settings")!).board)).toBe(true);
    await ctx.close();
  });
});

test.describe("pause et touches", () => {
  test("Échap et P : pause, reprise ; Échap ferme d'abord la fenêtre du dessus", async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await open(page, "/?debug&scenario=essai&timescale=4");
    await page.waitForFunction(() => window.__cdj.phase === "racing");
    await page.keyboard.press("Escape");
    await expect(page.locator("#pause")).toBeVisible();
    for (const label of ["Reprendre", "Recommencer", "Dernier point de contrôle", "Réglages", "Comment jouer", "Accueil"]) await expect(page.locator("#pause-menu").getByRole("button", { name: label })).toBeVisible();
    await page.locator("#pause-settings").click();
    await expect(page.locator("#settings")).toBeVisible();
    await page.keyboard.press("Escape"); // ferme les réglages, la pause reste
    await expect(page.locator("#settings")).toBeHidden();
    await expect(page.locator("#pause")).toBeVisible();
    await page.keyboard.press("Escape"); // reprend
    await expect(page.locator("#pause")).toBeHidden();
    expect(await page.evaluate(() => window.__cdj.paused)).toBe(false);
    await page.keyboard.press("p");
    await page.waitForFunction(() => window.__cdj.paused === true);
    await page.keyboard.press("p");
    await page.waitForFunction(() => window.__cdj.paused === false);
    await ctx.close();
  });

  test("manette : Start ouvre la pause, X recommence, Y reprend au point de contrôle", async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      const pad = { connected: true, axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
      (window as unknown as { __pad: typeof pad }).__pad = pad;
      navigator.getGamepads = () => [pad as unknown as Gamepad];
    });
    await open(page, "/?debug&scenario=essai&timescale=4");
    await page.waitForFunction(() => window.__cdj.phase === "racing");
    const press = async (index: number) => {
      await page.evaluate((i) => ((window as unknown as { __pad: { buttons: { pressed: boolean }[] } }).__pad.buttons[i]!.pressed = true), index);
      await page.waitForTimeout(700); // le rendu logiciel est lent : l'appui doit durer plus d'une image
      await page.evaluate((i) => ((window as unknown as { __pad: { buttons: { pressed: boolean }[] } }).__pad.buttons[i]!.pressed = false), index);
      await page.waitForTimeout(400);
    };
    await press(9); // Start : pause
    await page.waitForFunction(() => window.__cdj.paused === true);
    await expect(page.locator("#pause")).toBeVisible();
    await press(2); // X : depuis le départ (referme aussi la pause)
    await page.waitForFunction(() => window.__cdj.paused === false);
    await page.waitForFunction(() => window.__cdj.phase === "racing");
    await page.waitForTimeout(1200);
    await press(3); // Y : dernier point de contrôle (ici le départ : la reprise est comptée)
    await page.waitForFunction(() => (window.__cdj.race as { respawns: number }).respawns >= 1);
    await ctx.close();
  });

  test("le chrono : il part au « PARTEZ ! », même voiture immobile ; il ne tourne ni à l'accueil, ni au décompte, ni en pause", async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await open(page, "/?home=1&debug&api=demo&timescale=2");
    await page.waitForTimeout(1500);
    await expect(page.locator("#timer")).toBeHidden(); // à l'accueil, le HUD de course est caché et rien ne tourne
    expect(await page.evaluate(() => (window.__cdj.race as { car: { tick: number } }).car.tick)).toBe(0);
    await page.locator("#home-daily").click();
    await page.waitForTimeout(500);
    await expect(page.locator("#timer")).toHaveText("0,000 s"); // décompte : zéro
    await page.waitForFunction(() => window.__cdj.phase === "racing");
    await page.waitForTimeout(1200);
    const running = await page.evaluate(() => (window.__cdj.race as { car: { tick: number } }).car.tick);
    expect(running).toBeGreaterThan(100); // il tourne depuis le départ, la voiture n'a pas bougé : c'est voulu (comme Trackmania)
    expect(await page.evaluate(() => Math.hypot(window.__cdj.car.vx, window.__cdj.car.vz))).toBeLessThan(0.5);
    await expect(page.locator("#banner")).toContainText("Le chrono tourne", { timeout: 20_000 }); // et on le dit au joueur
    // Pause : le chrono s'arrête net, et repart là où il était.
    await page.keyboard.press("p");
    await page.waitForFunction(() => window.__cdj.paused === true);
    const a = await page.locator("#timer").textContent();
    await page.waitForTimeout(1200);
    expect(await page.locator("#timer").textContent()).toBe(a);
    await page.keyboard.press("p");
    await expect(page.locator("#timer")).not.toHaveText(a!, { timeout: 15_000 });
    await ctx.close();
  });
});

test.describe("profil", () => {
  test("pseudo modifiable, statistiques d'après les records, meilleure place retenue", async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    // En démonstration, « aujourd'hui » est figé au 27/10/2026 (le lendemain de l'historique).
    const today = "2026-10-27";
    const yesterday = "2026-10-26";
    await page.addInitScript(
      ([t, y]) => {
        if (localStorage.getItem("cdj:player")) return;
        localStorage.setItem("cdj:player", "0123456789abcdef0123456789abcdef");
        localStorage.setItem("cdj:name", "Alice");
        localStorage.setItem(`cdj:best:jour-${t}-g15`, JSON.stringify({ ms: 41000, splits: [], simVersion: 1, medal: "gold" }));
        localStorage.setItem(`cdj:best:jour-${y}-g15`, JSON.stringify({ ms: 44000, splits: [], simVersion: 1, medal: "bronze" }));
        localStorage.setItem(`cdj:rank:${y}`, JSON.stringify({ rank: 3, participants: 12 }));
      },
      [today, yesterday],
    );
    await open(page, "/?home=1&debug&api=demo");
    const stats = page.locator("#home .profile .stats");
    await expect(page.locator("#home .profile input.name")).toHaveValue("Alice");
    await expect(stats).toContainText("Jours joués2");
    await expect(stats).toContainText("2 jours de suite");
    await expect(stats).toContainText("3e sur 12");
    await expect(stats).toContainText("🥇 1");
    await expect(stats).toContainText("🥉 1");
    await page.locator("#home .profile input.name").fill("Alice 2");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.locator("#home .profile")).toContainText("Pseudo enregistré : Alice 2");
    expect(await page.evaluate(() => localStorage.getItem("cdj:name"))).toBe("Alice 2");
    await page.locator("#home .profile input.name").fill("<b>");
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await expect(page.locator("#home .profile")).toContainText("1 à 20 caractères");
    expect(await page.evaluate(() => localStorage.getItem("cdj:name"))).toBe("Alice 2"); // refusé : rien n'a changé
    await page.screenshot({ path: "../../docs/lots/img/lot-29-profil.png" });
    await ctx.close();
  });

  test("« Copier mon code » puis « Charger un code » dans un autre contexte : mêmes pseudo, records et places", async ({ browser }) => {
    const ID = "0123456789abcdef0123456789abcdef";
    const OTHER = "fedcba9876543210fedcba9876543210";
    const today = formatDay(TODAY);
    const a = await fresh(browser);
    const pa = await a.newPage();
    await pa.addInitScript(
      ([id, t]) => {
        if (localStorage.getItem("cdj:player")) return;
        localStorage.setItem("cdj:player", id!);
        localStorage.setItem("cdj:name", "Alice");
        localStorage.setItem(`cdj:best:jour-${t}-g15`, JSON.stringify({ ms: 41000, splits: [10000, 20000], simVersion: 14, medal: "silver" }));
        localStorage.setItem(`cdj:sub:jour-${t}-g15`, "41000");
        localStorage.setItem(`cdj:rank:${t}`, JSON.stringify({ rank: 2, participants: 7 }));
      },
      [ID, today],
    );
    await open(pa, "/?home=1&debug&api=demo");
    await pa.getByRole("button", { name: "Copier mon code" }).click();
    await expect(pa.locator("#home .tr-msg")).toContainText("Code copié");
    await expect(pa.locator("#home .tr-msg")).toContainText("Garde-le pour toi");
    await expect(pa.locator("#home .profile .warn")).toContainText("ne le partage pas"); // l'avertissement est toujours là
    const code = await pa.evaluate(() => navigator.clipboard.readText());
    expect(code).toMatch(/^CDJ1\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
    expect(await pa.locator("#home .tr-code").inputValue()).toBe(""); // le code n'est pas montré à l'écran

    // Autre navigateur : une autre identité, d'autres records.
    const b = await fresh(browser);
    const pb = await b.newPage();
    await pb.addInitScript(
      ([id]) => {
        if (localStorage.getItem("cdj:player")) return;
        localStorage.setItem("cdj:player", id!);
        localStorage.setItem("cdj:name", "Bob");
        localStorage.setItem("cdj:best:jour-2026-10-20-g15", JSON.stringify({ ms: 50000, splits: [], simVersion: 14 }));
        localStorage.setItem("cdj:touch", '{"vibration":false}');
      },
      [OTHER],
    );
    await open(pb, "/?home=1&debug&api=demo");
    await expect(pb.locator("#home .profile input.name")).toHaveValue("Bob");
    await pb.getByRole("button", { name: "Charger un code" }).click();
    await pb.locator("#home .tr-code").fill(code);
    // Aperçu du profil trouvé, avec confirmation ; rien n'a changé.
    await expect(pb.locator("#home .tr-preview")).toBeVisible();
    await expect(pb.locator("#home .tr-preview")).toContainText("« Alice »");
    await expect(pb.locator("#home .tr-preview")).toContainText("Jours joués1");
    await expect(pb.locator("#home .tr-preview")).toContainText("2e sur 7");
    await expect(pb.locator("#home .tr-preview")).toContainText("« Bob »");
    expect(await pb.evaluate(() => localStorage.getItem("cdj:player"))).toBe(OTHER);
    await pb.screenshot({ path: "../../docs/lots/img/lot-29-charger-un-code.png" });
    const reloaded = pb.waitForEvent("load");
    await pb.locator("#home .tr-apply").click();
    await reloaded;
    await pb.waitForSelector("#splash", { state: "detached", timeout: 60_000 });
    await expect(pb.locator("#home .profile input.name")).toHaveValue("Alice");
    const state = await pb.evaluate(() => ({ ...localStorage }));
    expect(state["cdj:player"]).toBe(ID);
    expect(JSON.parse(state[`cdj:best:jour-${today}-g15`]!).ms).toBe(41000);
    expect(state["cdj:best:jour-2026-10-20-g15"]).toBeUndefined(); // les anciens records sont remplacés
    expect(JSON.parse(state[`cdj:rank:${today}`]!)).toEqual({ rank: 2, participants: 7 });
    expect(state["cdj:touch"]).toBe('{"vibration":false}'); // les réglages restent
    await expect(pb.locator("#home .profile .stats")).toContainText("🥈 1");
    await a.close();
    await b.close();
  });

  test("un code abîmé est refusé sans rien changer ; annuler ne change rien non plus ; taper dans la zone ne commande pas le jeu", async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await page.addInitScript(() => {
      if (!localStorage.getItem("cdj:player")) {
        localStorage.setItem("cdj:player", "0123456789abcdef0123456789abcdef");
        localStorage.setItem("cdj:name", "Alice");
      }
    });
    await open(page, "/?home=1&debug&api=demo");
    await page.getByRole("button", { name: "Copier mon code" }).click();
    const code = await page.evaluate(() => navigator.clipboard.readText());
    await page.getByRole("button", { name: "Charger un code" }).click();
    await page.locator("#home .tr-code").fill(code.slice(0, 40) + code.slice(52));
    await expect(page.locator("#home .tr-msg")).toContainText("somme de contrôle");
    await expect(page.locator("#home .tr-preview")).toBeHidden();
    await page.locator("#home .tr-code").fill("bonjour");
    await expect(page.locator("#home .tr-msg")).toContainText("Ce n'est pas un code de transfert");
    await page.locator("#home .tr-code").fill(code);
    await expect(page.locator("#home .tr-preview")).toBeVisible();
    await page.locator("#home .tr-cancel").click();
    await expect(page.locator("#home .tr-preview")).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem("cdj:player"))).toBe("0123456789abcdef0123456789abcdef");
    await page.locator("#home .tr-code").fill("");
    await page.locator("#home .tr-code").press("p");
    await page.locator("#home .tr-code").press("Enter");
    expect(await page.evaluate(() => window.__cdj.paused)).toBe(false); // rien n'a été pris pour une commande
    expect(await page.evaluate(() => window.__cdj.phase)).toBe("countdown");
    await ctx.close();
  });

  test("les mêmes actions sont dans Réglages › Profil", async ({ browser }) => {
    const ctx = await fresh(browser);
    const page = await ctx.newPage();
    await open(page, "/?debug&api=demo&scenario=essai");
    await page.locator("#btn-settings").click();
    await page.locator("#tab-profile").click();
    await expect(page.locator("#page-profile input.name")).toBeVisible();
    await expect(page.locator("#page-profile").getByRole("button", { name: "Copier mon code" })).toBeVisible();
    await expect(page.locator("#page-profile").getByRole("button", { name: "Charger un code" })).toBeVisible();
    await expect(page.locator("#page-profile .warn")).toContainText("ne le partage pas");
    await ctx.close();
  });
});

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

test.describe("classement", () => {
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
    // Ta meilleure place est retenue pour le profil.
    await expect(page.locator("#home .profile .stats")).toContainText("11e sur 12");
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
    await page.screenshot({ path: "../../docs/lots/img/lot-29-course-classement.png" });
    await page.locator("#board .bhead").click();
    await expect(page.locator("#board")).toHaveClass(/folded/);
    await ctx.close();
  });
});

// --- Mise en page : accueil, réglages, aide, pause et HUD, en portrait et en paysage, avec la police large de la CI -----------------
const PHONES = [
  { name: "portrait", width: 390, height: 844 },
  { name: "paysage", width: 844, height: 390 },
  { name: "petit portrait", width: 360, height: 640 },
] as const;

for (const vp of PHONES) {
  test(`téléphone ${vp.name} (${vp.width}×${vp.height}) : accueil, réglages, aide et pause sans chevauchement, cibles d'au moins 44 px`, async ({ browser }) => {
    const ctx = await fresh(browser, vp, true);
    const page = await ctx.newPage();
    await open(page, "/?home=1&debug&api=demo&touch=1&timescale=4", { wide: true });
    await expect(page.locator("#home .board-card .row").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("#home .salon-state")).toContainText("En cours :", { timeout: 15_000 });

    // Accueil : rien ne déborde à droite, les cartes ne se chevauchent pas, tout se touche du doigt.
    const sizes = await page.evaluate(() => {
      const home = document.getElementById("home")!;
      const cards = [...document.querySelectorAll("#home .home-head, #home .card, #home .links")].map((e) => {
        const r = e.getBoundingClientRect();
        return { name: e.className, x: r.x, y: r.y + home.scrollTop, w: r.width, h: r.height };
      });
      return { overflowX: home.scrollWidth - home.clientWidth, cards, clip: [...document.querySelectorAll("#home .card")].map((c) => c.scrollWidth - c.clientWidth) };
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
    if (vp.name === "portrait") {
      await page.screenshot({ path: "../../docs/lots/img/lot-29-accueil-telephone.png" });
      await page.locator("#home").evaluate((e) => e.scrollTo(0, 99999));
      await page.screenshot({ path: "../../docs/lots/img/lot-29-accueil-telephone-bas.png" });
      await page.locator("#home").evaluate((e) => e.scrollTo(0, 0));
    }

    // Réglages, onglet par onglet.
    await page.locator("#home-settings").click();
    for (const tab of ["graphics", "sound", "game", "controls", "profile"]) {
      await page.locator(`#tab-${tab}`).click();
      expectNoOverlap(await boxes(page, ["#settings .panel"]), vp);
      for (const b of await page.locator(`#page-${tab} button:visible, #page-${tab} summary:visible`).all()) expect((await b.boundingBox())!.height, `${tab} : bouton trop petit`).toBeGreaterThanOrEqual(43.5);
      const over = await page.locator(`#page-${tab}`).evaluate((e) => e.scrollWidth - e.clientWidth);
      expect(over, `${tab} déborde en largeur`).toBeLessThanOrEqual(1);
    }
    await page.locator("#tab-controls").click();
    await expect(page.locator("#page-controls .touchbox")).toBeVisible(); // les réglages tactiles sont dans Commandes
    await page.getByRole("radio", { name: "Boutons ← →" }).click();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cdj:touch")!).steerMode)).toBe("buttons");
    await page.getByRole("radio", { name: "Glisser" }).click();
    await page.locator("#settings .head .btn").click();
    await expect(page.locator("#settings")).toBeHidden();

    // Aide.
    await page.locator("#home-howto").click();
    expectNoOverlap(await boxes(page, ["#howto .panel"]), vp);
    await page.locator("#howto-done").click();

    // Course, pause, HUD.
    await page.locator("#home-daily").click();
    await page.waitForFunction(() => window.__cdj.phase === "racing");
    await page.addStyleTag({ content: "#banner { display: none !important; }" });
    if (vp.name !== "portrait" && vp.name !== "petit portrait") {
      // paysage : on conduit ; le HUD complet ne se chevauche pas (classement compris)
      await expect(page.locator("#board .row").first()).toBeVisible({ timeout: 15_000 });
      expectNoOverlap(await boxes(page, ["#meta", "#medals", "#timer", "#ghostinfo", "#menu", "#speed", "#board", "#tbar"]), vp);
      await page.screenshot({ path: "../../docs/lots/img/lot-29-course-telephone.png" });
    } else {
      await page.locator("#rotate button").click().catch(() => undefined); // portrait : « Jouer quand même »
      await expect(page.locator("#board .row").first()).toBeVisible({ timeout: 15_000 });
      expectNoOverlap(await boxes(page, ["#meta", "#medals", "#timer", "#ghostinfo", "#menu", "#speed", "#board", "#tbar"]), vp);
    }
    for (const b of await page.locator("#menu button:visible").all()) expect((await b.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
    await page.locator("#tbar .pause").click();
    await expect(page.locator("#pause")).toBeVisible();
    expectNoOverlap(await boxes(page, ["#pause .panel"]), vp);
    for (const b of await page.locator("#pause button:visible").all()) expect((await b.boundingBox())!.height, `pause : ${await b.textContent()}`).toBeGreaterThanOrEqual(43.5);
    if (vp.name === "paysage") await page.screenshot({ path: "../../docs/lots/img/lot-29-pause-telephone.png" });
    await ctx.close();
  });
}

test("ordinateur : le HUD de course, la pause et l'arrivée tiennent dans l'écran (police large)", async ({ browser }) => {
  const ctx = await fresh(browser, { width: 1000, height: 560 });
  await mockApi(ctx, rows(), { rank: 2, name: "Alice", ms: 31_000, medal: "silver" });
  const page = await ctx.newPage();
  await open(page, `/?debug&api=${encodeURIComponent(API)}&timescale=4`, { wide: true });
  await page.waitForFunction(() => window.__cdj.phase === "racing");
  await expect(page.locator("#board .row").first()).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(3500); // le bandeau du départ s'efface
  expectNoOverlap(await boxes(page, ["#meta", "#medals", "#ghostinfo", "#timer", "#menu", "#speed", "#board", "#helpchip"]), { width: 1000, height: 560 });
  await ctx.close();
});

function rows() {
  return [
    { rank: 1, name: "Alice", ms: 30_000, medal: "gold" },
    { rank: 2, name: "Bob", ms: 31_000, medal: "silver" },
  ];
}

// Les liens et boutons de l'ancienne interface ont disparu.
test("plus de bouton Salon ni de ligne d'aide minuscule en course ; « Comment jouer » la remplace", async ({ browser }) => {
  const ctx = await fresh(browser);
  const page = await ctx.newPage();
  await open(page, "/?debug&api=demo&scenario=essai");
  await expect(page.locator("#btn-mode, #btn-archive, #btn-board, #pause-mode")).toHaveCount(0);
  await expect(page.locator("#info")).toHaveText("");
  await expect(page.locator("#helpchip")).toContainText("Comment jouer");
  const labels = await page.locator("#menu button:visible").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label") || e.textContent));
  expect(labels.slice(0, 3)).toEqual(["Accueil", "Réglages", "Fantôme"]);
  expect(labels).toHaveLength(4);
  expect(labels[3]).toMatch(/son/i); // « Couper le son (M) » : l'icône du son change avec le muet
  await ctx.close();
});
