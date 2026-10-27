import { readFileSync } from "node:fs";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { FIXED_NOW, TODAY, atInstant } from "./clock";
import { Fingers, hasWebGL } from "./phone";
import { dayId } from "./jours";

// Lot 10 : la boucle quotidienne. Accueil → Jouer → arrivée (la preuve de l'auteur jouée comme les commandes du joueur, en pas à pas) →
// carnage passé → écran d'arrivée → Partager (presse-papiers ou feuille de partage simulés) → Accueil qui montre le résultat ; « Comment
// jouer » à la première visite seulement ; archives (la liste, une archive jouée qui ne touche pas la série) ; compte à rebours ; au doigt,
// en portrait et en paysage, cibles ≥ 44 px. Horloge maîtrisée par décalage de `Date` (`clock.ts`), jamais `page.clock.install`.
// Lot I5 : mêmes parcours sur la nouvelle interface (cadre crème, accueil sur la scène) ; les sélecteurs ont suivi le DOM du socle (`#arrival-time`,
// `#arrival-medal`, `.archive`…), les textes le catalogue français. Les captures du lot 10 restent celles de son README (les nouvelles :
// `e2e/captures.spec.ts`, lot I5).

const GENERATOR = (JSON.parse(readFileSync(new URL("../../../packages/jump-sim/test/fixtures/daily-golden-v8.json", import.meta.url), "utf8")) as { jumpGeneratorVersion: number }).jumpGeneratorVersion;
const SKIP = "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire";

interface DayRecord {
  id: string;
  date: string;
  best: number | null;
  medal: string | null;
  deaths: number;
  attempts: number;
}
interface J {
  phase: string;
  daily: { date: string; number: number; id: string; authorTicks: number; mode: string } | null;
  home: { available: boolean; atStart: boolean; open: boolean; ready: boolean; help: boolean; archives: boolean; archiveDates: string[] };
  history: DayRecord[];
  streak: number;
  arrival: { shown: boolean; share: string; message: string };
  carnage: { state: { active: boolean } };
  attempt: { status: string; time: number };
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  autoplay(code?: string): number;
}
const jump = (page: Page) =>
  page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    return { phase: j.phase, daily: j.daily, home: j.home, history: j.history, streak: j.streak, arrival: j.arrival, carnage: j.carnage.state, attempt: j.attempt };
  });
const loaded = (page: Page) => page.waitForFunction(() => ["ready", "playing", "finished"].includes((window as unknown as { __jump?: { phase: string } }).__jump?.phase ?? ""));
/** L'accueil prêt : le niveau est chargé, Jouer répond. */
const homeReady = (page: Page) => page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.home.ready === true);

/** Simule le presse-papiers et la feuille de partage : ce qui leur est confié est gardé dans `window.__copied` / `window.__shared`. */
async function stubSharing(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const w = window as unknown as { __copied?: string; __shared?: string };
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => void (w.__copied = t) } });
    Object.defineProperty(navigator, "share", { configurable: true, value: async (d: { text: string }) => void (w.__shared = d.text) });
  });
}

/**
 * Joue la preuve de l'auteur comme les commandes du joueur (pas à pas), jusqu'au carnage ; le passe d'une commande (comme le joueur) : l'écran
 * d'arrivée s'ouvre. `pass` : passe le carnage autrement (au doigt). Rend le nombre de pas joués jusqu'à l'arrivée.
 */
async function playAuthor(page: Page, pass?: () => Promise<void>): Promise<number> {
  const ticks = await page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.manual(true);
    const n = j.autoplay();
    for (let t = 1; t <= n + 10; t++) {
      j.advance(1);
      if (j.phase === "carnage" || j.phase === "finished") return t;
    }
    return -1;
  });
  expect((await jump(page)).phase).toBe("carnage");
  // Seul un **appui** passe le carnage (une commande tenue depuis l'arrivée ne le passe pas) : un pas sans rien, puis la commande.
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.input(0);
    j.advance(1);
    j.input(null);
  });
  if (pass) await pass();
  else
    await page.evaluate(() => {
      const j = (window as unknown as { __jump: J }).__jump;
      j.input(2);
      j.advance(1);
      j.input(null);
    });
  return ticks;
}

/** Une cible tactile : au moins 44 px dans les deux sens, à l'écran. */
async function bigEnough(locator: Locator, viewport: { width: number; height: number }, name: string): Promise<void> {
  await locator.scrollIntoViewIfNeeded();
  const box = (await locator.boundingBox())!;
  expect(box, name).not.toBeNull();
  expect(box.width, `${name} : largeur`).toBeGreaterThanOrEqual(44);
  expect(box.height, `${name} : hauteur`).toBeGreaterThanOrEqual(44);
  expect(box.x, `${name} : à l'écran`).toBeGreaterThanOrEqual(0);
  expect(box.y, `${name} : à l'écran`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${name} : à l'écran`).toBeLessThanOrEqual(viewport.width + 0.5);
  expect(box.y + box.height, `${name} : à l'écran`).toBeLessThanOrEqual(viewport.height + 0.5);
}

/** Le temps comme l'écrit le socle (`formatTemps`) : « 31,402 s », espace insécable avant l'unité. */
const formatTicks = (ticks: number): string => {
  const ms = Math.round((ticks * 1000) / 120);
  return `${Math.floor(ms / 1000)},${String(ms % 1000).padStart(3, "0")}\u00a0s`;
};

test("accueil → Jouer → arrivée → écran d'arrivée → Partager (presse-papiers) → Accueil qui montre le résultat", { tag: "@navigateurs" }, async ({ browser }) => {
  test.setTimeout(90_000);
  await atInstant(browser, FIXED_NOW, async (page, context) => {
    await stubSharing(context);
    await page.goto("/?debug");
    test.skip(!(await hasWebGL(page)), SKIP);
    // L'accueil est l'écran d'ouverture ; « Comment jouer » s'ouvre par-dessus à la première visite.
    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("#home .accueil__titre")).toHaveText("JUMP");
    await expect(page.locator("#home .accueil__niveau")).toHaveText(/^Niveau n°\s5 · /);
    await expect(page.locator("#home .dj-barre-jeu")).toContainText("20 oct.");
    await expect(page.locator("#home-status")).toHaveText("Pas encore joué");
    await expect(page.locator("#home-play")).toHaveText("JOUER");
    await expect(page.locator("#help")).toBeVisible();
    await homeReady(page);
    await loaded(page);
    await page.locator("#help-close").click();
    await expect(page.locator("#help")).toBeHidden();
    let j = await jump(page);
    expect(j.home).toMatchObject({ available: true, atStart: true, open: true, ready: true, help: false });
    expect(j.streak).toBe(0);
    // Ouvert, l'accueil tient la partie en pause : les touches ne font rien.
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(150);
    await page.keyboard.up("ArrowRight");
    expect((await jump(page)).attempt).toMatchObject({ status: "attend", time: 0 });

    await page.locator("#home-play").click();
    await expect(page.locator("#home")).toBeHidden();
    expect((await jump(page)).home.open).toBe(false);

    const ticks = await playAuthor(page);
    j = await jump(page);
    expect(ticks).toBe(j.daily!.authorTicks);
    expect(j.daily!.id).toBe(dayId(TODAY));
    // Le carnage passe d'abord, puis l'écran d'arrivée (pas le bandeau).
    await expect(page.locator("#arrival")).toBeVisible();
    await expect(page.locator("#finish")).toBeHidden();
    const time = formatTicks(j.daily!.authorTicks);
    // Lot I5 (maquette jump-arrivee.html) : le temps en grand, l'autocollant des morts, le bandeau de la médaille (l'auteur battu : plus de prochaine
    // médaille ; la liste des quatre seuils du lot 10 est remplacée par ce bandeau), la phrase du palier « 0 mort ».
    await expect(page.locator("#arrival .etiquette__titre")).toHaveText("ARRIVÉE !");
    await expect(page.locator("#arrival-time")).toHaveText(time);
    await expect(page.locator("#arrival-medal")).toHaveAttribute("data-medal", "author");
    await expect(page.locator("#arrival-medal .dj-medaille")).toHaveCount(1);
    await expect(page.locator("#arrival .arrivee__medaille-texte")).toHaveText("Temps de l'auteur battu !");
    await expect(page.locator("#arrival .arrivee__prochaine")).toBeHidden();
    await expect(page.locator("#arrival .arrivee__meilleur")).toHaveText("Nouveau record du jour !");
    await expect(page.locator("#arrival-deaths .autocollant__nombre")).toHaveText("0");
    await expect(page.locator("#arrival-deaths .autocollant__mot")).toHaveText("mort");
    await expect(page.locator("#arrival-phrase")).toHaveText("«\u00a0Zéro mort. On va vérifier que tu n'as pas triché.\u00a0»");
    await expect(page.locator("#arrival .arrivee__stats")).toHaveText("0 mort aujourd'hui · 1 essai · Essai sans faute · Série : 1 jour");
    await expect(page.locator("#arrival .arrivee__decompte")).toHaveText(/^Prochain niveau dans (09:5\d|10:00):\d\d$/);
    for (const id of ["replay", "share", "carnage", "home"]) await expect(page.locator(`#arrival-${id}`)).toBeVisible();
    j = await jump(page);
    expect(j.arrival.shown).toBe(true);
    expect(j.streak).toBe(1);
    expect(j.history).toEqual([{ id: dayId(TODAY), date: TODAY, best: j.daily!.authorTicks, medal: "author", deaths: 0, attempts: 1 }]);

    // Partager : sur ordinateur, le presse-papiers (simulé), avec confirmation ; le lien est celui de la page.
    await page.locator("#arrival-share").click();
    await expect(page.locator("#arrival .arrivee__message")).toHaveText("Copié dans le presse-papiers");
    const copied = await page.evaluate(() => (window as unknown as { __copied?: string }).__copied);
    expect(copied).toBe(`Du Jour · Jump #5 — ${time} — 🏆 — 0 💀\nhttp://localhost:4174/`);
    expect((await jump(page)).arrival.share).toBe(copied);

    // Revoir le carnage : il repart, puis l'écran d'arrivée revient.
    await page.locator("#arrival-carnage").click();
    expect((await jump(page)).carnage.active).toBe(true);
    await expect(page.locator("#arrival")).toBeHidden();
    await page.evaluate(() => {
      const j = (window as unknown as { __jump: J }).__jump;
      j.input(0);
      j.advance(1);
      j.input(1);
      j.advance(1);
      j.input(null);
    });
    await expect(page.locator("#arrival")).toBeVisible();

    // Accueil : il montre le résultat du jour et la série.
    await page.locator("#arrival-home").click();
    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("#arrival")).toBeHidden();
    await expect(page.locator("#home-status")).toHaveText(`Auteur · Meilleur : ${time} · 0 mort`);
    await expect(page.locator("#home-record .tuile__valeur")).toHaveText(time);
    await expect(page.locator("#home-streak .tuile__valeur")).toHaveText("1 jour");
    await expect(page.locator("#home-play")).toHaveText("REJOUER");

    // Rechargée, la page s'ouvre sur l'accueil (sans l'aide, déjà vue) avec le même résultat ; Jouer repart d'un nouvel essai.
    await page.reload();
    await homeReady(page);
    await expect(page.locator("#home-status")).toHaveText(`Auteur · Meilleur : ${time} · 0 mort`);
    await expect(page.locator("#help")).toBeHidden();
    await page.locator("#home-play").click();
    await expect(page.locator("#home")).toBeHidden();
    expect((await jump(page)).attempt).toMatchObject({ status: "attend", time: 0 });
  });
});

test("« Comment jouer » s'ouvre de lui-même à la première visite seulement, puis depuis l'accueil", { tag: "@regression" }, async ({ browser }) => {
  await atInstant(browser, FIXED_NOW, async (page) => {
    await page.goto("/");
    await expect(page.locator("#help")).toBeVisible();
    // Lot I5 (charte § 9) : trois points courts et les commandes de l'appareil (ici le clavier).
    await expect(page.locator("#help .dialogue__titre")).toHaveText("COMMENT JOUER");
    await expect(page.locator("#help")).toContainText("Va jusqu'au drapeau");
    await expect(page.locator("#help")).toContainText("Contre un mur, saute");
    await expect(page.locator("#help")).toContainText("R : recommencer");
    await page.locator("#help-close").click();
    await expect(page.locator("#help")).toBeHidden();
    await page.reload();
    await expect(page.locator("#home")).toBeVisible();
    await page.waitForTimeout(300);
    await expect(page.locator("#help")).toBeHidden();
    await page.locator("#home-help").click();
    await expect(page.locator("#help")).toBeVisible();
    // Échap ferme la fenêtre du dessus.
    await page.keyboard.press("Escape");
    await expect(page.locator("#help")).toBeHidden();
    await expect(page.locator("#home")).toBeVisible();
    // Un lien direct n'ouvre ni l'accueil ni l'aide. (Lot I5 : « Comment jouer » s'ouvre aussi depuis la pause, partout : il est monté, caché.)
    await page.goto("/?seed=2026-10-18");
    await page.waitForTimeout(300);
    await expect(page.locator("#home")).toHaveCount(0);
    await expect(page.locator("#help")).toBeHidden();
  });
});

test("archives : la liste (n° 1 à hier), une archive se joue (mode archive) et ne touche ni l'historique du jour ni la série", { tag: "@regression" }, async ({ browser }) => {
  test.setTimeout(120_000);
  await atInstant(browser, FIXED_NOW, async (page, context) => {
    await stubSharing(context);
    // D'abord le niveau du jour : une série de 1.
    await page.goto("/?debug&accueil=0");
    test.skip(!(await hasWebGL(page)), SKIP);
    await loaded(page);
    await playAuthor(page);
    expect((await jump(page)).streak).toBe(1);
    const before = (await jump(page)).history;

    await page.goto("/?archives&debug");
    await expect(page.locator("#archives")).toBeVisible();
    await expect(page.locator("#archives .archive")).toHaveCount(4);
    await expect(page.locator("#archives .archive__numero")).toHaveText([/^n°\s4$/, /^n°\s3$/, /^n°\s2$/, /^n°\s1$/]);
    await expect(page.locator("#archives .archive").nth(1)).toContainText("18 oct.");
    await expect(page.locator("#archives .archive__resultat").first()).toHaveText("pas joué");
    expect((await jump(page)).home.archiveDates).toEqual(["2026-10-19", "2026-10-18", "2026-10-17", "2026-10-16"]);

    await Promise.all([page.waitForURL(/seed=2026-10-18/), page.locator('#archives .archive[data-date="2026-10-18"]').click()]);
    await loaded(page);
    let j = await jump(page);
    expect(j.daily).toMatchObject({ date: "2026-10-18", number: 3, mode: "archive" });
    expect(j.home.available).toBe(false);
    await expect(page.locator("#modetag")).toBeVisible();
    await expect(page.locator("#modetag")).toHaveText("Archive");
    await expect(page.locator("#dayline")).toContainText("archive du dim. 18 oct.");
    await playAuthor(page);
    await expect(page.locator("#arrival")).toBeVisible();
    await expect(page.locator("#arrival .arrivee__mode")).toHaveText("Archive du dim. 18 oct. : ne compte pas dans ta série");
    await expect(page.locator("#arrival .arrivee__stats")).toContainText("Archive : ne compte pas dans ta série");
    await expect(page.locator("#arrival-medal")).toHaveAttribute("data-medal", "author");
    await page.locator("#arrival-share").click();
    const copied = await page.evaluate(() => (window as unknown as { __copied?: string }).__copied);
    expect(copied).toMatch(/^Du Jour · Jump #3 \(archive\) — \d+,\d{3}\u00a0s — 🏆 — 0 💀\nhttp:\/\/localhost:4174\/\?seed=2026-10-18$/);
    j = await jump(page);
    expect(j.history).toEqual(before);
    expect(j.streak).toBe(1);

    // Accueil (depuis une archive) : la page du niveau du jour, accueil ouvert ; la série n'a pas bougé.
    await Promise.all([page.waitForURL((u) => !u.search.includes("seed")), page.locator("#arrival-home").click()]);
    await homeReady(page);
    j = await jump(page);
    expect(j.home.open).toBe(true);
    expect(j.streak).toBe(1);
    expect(j.history).toEqual(before);
    await expect(page.locator("#home-streak .tuile__valeur")).toHaveText("1 jour");
  });
});

const FORMATS = [
  { name: "portrait", viewport: { width: 390, height: 844 } },
  { name: "paysage", viewport: { width: 844, height: 390 } },
] as const;

for (const format of FORMATS) {
  test(`au doigt (${format.name}) : accueil, archives, Jouer, carnage passé d'un doigt, écran d'arrivée, Partager, Accueil — cibles ≥ 44 px`, { tag: "@regression" }, async ({ browser }) => {
    test.setTimeout(120_000);
    const chromium = browser.browserType().name() === "chromium";
    const { viewport } = format;
    await atInstant(
      browser,
      FIXED_NOW,
      async (page, context) => {
        await stubSharing(context);
        await page.goto("/?debug&touch=1");
        test.skip(!(await hasWebGL(page)), SKIP);
        await homeReady(page);
        await loaded(page);
        await bigEnough(page.locator("#help-close"), viewport, "C'est parti");
        await page.locator("#help-close").tap();
        await expect(page.locator("#help")).toBeHidden();
        for (const id of ["#home-play", "#home-archives", "#home-help", "#home-settings"]) await bigEnough(page.locator(id), viewport, id);
        await page.locator("#home-archives").tap();
        await expect(page.locator("#archives")).toBeVisible();
        // Lot I5 : les archives et les Réglages sont des écrans du cadre crème ; « ‹ JUMP » (la barre des jeux) les ferme et rend l'accueil.
        await bigEnough(page.locator("#archives .dj-barre-jeu__retour"), viewport, "‹ JUMP");
        await bigEnough(page.locator("#archives .archive").first(), viewport, "ligne des archives");
        await page.locator("#archives .dj-barre-jeu__retour").tap();
        await expect(page.locator("#archives")).toBeHidden();
        await page.locator("#home-settings").tap();
        await expect(page.locator("#settings")).toBeVisible();
        await bigEnough(page.locator("#settings .dj-barre-jeu__retour"), viewport, "‹ JUMP (Réglages)");
        await page.locator("#settings .dj-barre-jeu__retour").tap();
        await expect(page.locator("#settings")).toBeHidden();
        await expect(page.locator("#home")).toBeVisible();

        await page.locator("#home-play").tap();
        await expect(page.locator("#home")).toBeHidden();
        const fingers = await Fingers.on(page);
        await playAuthor(page, async () => {
          // Un doigt n'importe où passe le carnage.
          await fingers.down(1, viewport.width * 0.2, viewport.height * 0.7);
          await page.evaluate(() => (window as unknown as { __jump: J }).__jump.advance(1));
          await fingers.up(1);
        });
        // Le doigt levé sur l'écran qui vient de s'ouvrir n'a touché aucun bouton.
        await expect(page.locator("#arrival")).toBeVisible();
        for (const id of ["replay", "share", "carnage", "home"]) await bigEnough(page.locator(`#arrival-${id}`), viewport, `#arrival-${id}`);
        // Au téléphone, la feuille de partage (simulée).
        await page.locator("#arrival-share").tap();
        await expect(page.locator("#arrival .arrivee__message")).toHaveText("Partagé");
        const shared = await page.evaluate(() => (window as unknown as { __shared?: string }).__shared);
        expect(shared).toMatch(/^Du Jour · Jump #5 — \d+,\d{3}\u00a0s — 🏆 — 0 💀\nhttp:\/\/localhost:4174\/$/);
        await page.locator("#arrival-home").tap();
        await expect(page.locator("#home")).toBeVisible();
        await expect(page.locator("#home-status")).toContainText("Auteur · Meilleur");
        // Rejouer depuis l'accueil, puis la pause (en haut à gauche) ramène à l'accueil.
        await page.locator("#home-play").tap();
        await expect(page.locator("#home")).toBeHidden();
        await page.locator("#pausebtn").tap();
        await expect(page.locator("#menu")).toBeVisible();
        await page.locator("#menu-home").tap();
        await expect(page.locator("#home")).toBeVisible();
        await expect(page.locator("#menu")).toBeHidden();
      },
      { viewport, hasTouch: true, ...(chromium ? { isMobile: true, deviceScaleFactor: 2 } : {}) },
    );
  });
}
