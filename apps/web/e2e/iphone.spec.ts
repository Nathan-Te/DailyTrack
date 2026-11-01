import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { devices } from "@playwright/test";
import { encodeTransfer } from "@cdj/profile";
import { expect as baseExpect, hasWebGL, newClockedContext, test, type Browser, type BrowserContext, type Page } from "./fixtures";
import { startSite } from "./domaine-serveurs";

// Lot 53 (Du Jour sur iPhone : le plein écran par l'écran d'accueil). Sur iPhone une page web ne passe pas en plein écran (l'API Fullscreen n'est ouverte qu'aux vidéos) :
// le seul vrai plein écran est l'ajout du site à l'écran d'accueil. Le profil `devices["iPhone 13"]` de Playwright (portrait et « landscape », WebKit quand le projet
// est WebKit : le petit ensemble `@navigateurs` de Firefox et WebKit le lance), le site assemblé comme Hosting le sert (`node scripts/site.mjs site`) et le vrai serveur.
//   1. le bouton « Plein écran » (barre des jeux de l'accueil de Track) ouvre l'aide « Partager › Sur l'écran d'accueil » et le lien du code de transfert ; une ligne
//      « pastille » une seule fois, sur le portail ; Android, ordinateur et iPad gardent le vrai plein écran (rien de changé : plein-ecran.spec.ts) ;
//   2. le manifeste est valide et lié, l'en-tête iOS est sur chaque page d'entrée (`viewport-fit=cover`, application capable, barre d'état translucide) ;
//   3. en mode application (`display-mode: standalone`) : aucune ligne ni bouton, et **aucun bouton dans les marges de sécurité** (les `env(safe-area-inset-*)` sont remplacées
//      par les marges d'un iPhone 13 dans les feuilles et les scripts servis : le portail, l'accueil et la course de Track, l'accueil de Jump) ;
//   4. « Retrouver mon profil » au premier lancement de l'application sans profil : le code de transfert collé ou saisi, le profil trouvé sur le serveur, adopté après
//      confirmation ; « Commencer sans profil » ne revient pas ; rien quand un profil existe.
test.setTimeout(120_000);
const expect = baseExpect.configure({ timeout: 30_000 });

const ROOT = resolve("../..");
const PORT = 4196;
const SITE = `http://localhost:${PORT}`;
const API_PORT = 8816;
// Le profil que le joueur a dans Safari : le joueur de démonstration de la recette (créé par le vrai `recette:seed --demo-seulement`, comme dans portail-jour.spec.ts).
// (`DEMO_JOUEUR_ID`, `DEMO_JOUEUR_NOM`, `DEMO_JOURS_TRACK` de apps/api/src/portailDemo.ts : un spec ne peut pas importer ce fichier, il lit `config/lancement.json`.)
const ID = "de30de30de30de30de30de30de30de30";
const PSEUDO = "Démo";
const JOURS = 5;

// Captures du README (docs/lots/lot-53-iphone-plein-ecran.md) : jointes au rapport ; avec `CAPTURES=1`, écrites aussi dans docs/lots/img/.
const CAPTURES = process.env.CAPTURES ? join(ROOT, "docs/lots/img") : null;
async function capture(page: Page, nom: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot(CAPTURES ? { path: join(CAPTURES, `lot-53-${nom}.png`) } : {});
  await test.info().attach(nom, { body: png, contentType: "image/png" });
}

let tmp = "";
let server: Server | null = null;
let api: ChildProcess | null = null;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  for (const app of ["web", "jump"]) if (!existsSync(join(ROOT, "apps", app, "dist", "index.html"))) throw new Error(`apps/${app} n'est pas construit : npm run build`);
  tmp = mkdtempSync(join(tmpdir(), "iphone-"));
  execFileSync("node", ["scripts/site.mjs", "site", "--sortie", join(tmp, "site"), "--origine", SITE], { cwd: ROOT, stdio: "inherit" });
  const base = join(tmp, "recette.sqlite");
  execFileSync("npm", ["run", "recette:seed", "--", "--demo-seulement", "--today", "2026-10-20"], { cwd: ROOT, env: { ...process.env, ENVIRONMENT: "recette", DB_PATH: base, TURSO_DATABASE_URL: "" }, stdio: "inherit" });
  api = spawn("node", ["../api/dist/server.mjs"], {
    env: { ...process.env, PORT: String(API_PORT), DB_PATH: base, ALLOW_ORIGIN: "*", NODE_NO_WARNINGS: "1", TEST_CLOCK_OFFSET_MS: process.env.E2E_CLOCK_OFFSET_MS },
    stdio: "ignore",
  });
  for (let i = 0; i < 100; i++) {
    if (await fetch(`http://127.0.0.1:${API_PORT}/api/health`).then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  server = await startSite(join(tmp, "site"), PORT, API_PORT);
  if (CAPTURES) mkdirSync(CAPTURES, { recursive: true });
});

test.afterAll(async () => {
  await new Promise((r) => (server ? server.close(r) : r(null)));
  api?.kill();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

// --- L'iPhone ----------------------------------------------------------------------------------------------------------------------------------------
const FORMATS = {
  portrait: { device: devices["iPhone 13"], ecran: { width: 390, height: 844 }, marges: { top: 47, right: 0, bottom: 34, left: 0 } },
  paysage: { device: devices["iPhone 13 landscape"], ecran: { width: 844, height: 390 }, marges: { top: 0, right: 47, bottom: 21, left: 47 } },
} as const;
type Format = keyof typeof FORMATS;
const FORMES = Object.keys(FORMATS) as Format[];

/** Sur iPhone la page n'a pas de plein écran (le WebKit de la CI en a un) ; `standalone` : l'application ajoutée à l'écran d'accueil (`display-mode: standalone`, `navigator.standalone`). */
async function iphone(browser: Browser, format: Format, { standalone = false, marges = false, locale = "fr-FR" }: { standalone?: boolean; marges?: boolean; locale?: string } = {}): Promise<BrowserContext> {
  const f = FORMATS[format];
  const { defaultBrowserType: _, ...profil } = f.device;
  // Safari a la fenêtre moins ses barres ; une application a tout l'écran (c'est ce qui compte pour les marges de sécurité).
  const context = await newClockedContext(browser, { ...profil, locale, ...(standalone ? { viewport: f.ecran } : {}) });
  await context.addInitScript((appli: boolean) => {
    for (const k of ["fullscreenEnabled", "webkitFullscreenEnabled"]) Object.defineProperty(Document.prototype, k, { configurable: true, get: () => false });
    Object.defineProperty(navigator, "maxTouchPoints", { configurable: true, get: () => 5 });
    if (appli) {
      Object.defineProperty(navigator, "standalone", { configurable: true, get: () => true });
      const vrai = window.matchMedia.bind(window);
      window.matchMedia = (q: string) => (q.includes("display-mode: standalone") ? ({ matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false } as MediaQueryList) : vrai(q));
    }
    localStorage.setItem("cdj:howto", "1");
  }, standalone);
  if (marges) await marges_de_securite(context, f.marges);
  return context;
}

/** Les `env(safe-area-inset-*)` des feuilles et des scripts servis deviennent les marges d'un iPhone 13 : Playwright ne sait pas les poser, le CSS les lit comme sur le téléphone. */
async function marges_de_securite(context: BrowserContext, m: { top: number; right: number; bottom: number; left: number }): Promise<void> {
  const remplace = (texte: string) => texte.replace(/env\(\s*safe-area-inset-(top|right|bottom|left)\s*(?:,\s*[^)]*)?\)/g, (_, cote: "top" | "right" | "bottom" | "left") => `${m[cote]}px`);
  await context.route(/\.(css|js)(\?.*)?$/, async (route) => {
    try {
      const reponse = await route.fetch();
      await route.fulfill({ response: reponse, body: remplace(await reponse.text()) });
    } catch {
      /* la page s'est fermée pendant la réponse (fin du test) : rien à rendre */
    }
  });
}

/** Un profil de Safari dans le stockage de cette page (le portail est sur la même origine que les jeux). */
const avecProfil = (context: BrowserContext) => context.addInitScript(([id, nom]) => (localStorage.setItem("cdj:player", id!), localStorage.setItem("cdj:name", nom!)), [ID, PSEUDO]);

// --- 1. Le bouton « Plein écran » et la pastille -----------------------------------------------------------------------------------------------------
for (const format of FORMES) {
  test(`iPhone ${format} : le bouton « Plein écran » de l'accueil de Track ouvre l'aide (Partager › Sur l'écran d'accueil, code de transfert) ; Échap la ferme`, { tag: format === "portrait" ? "@navigateurs" : ["@navigateurs", "@regression"] }, async ({ browser }) => {
    const context = await iphone(browser, format);
    await avecProfil(context);
    const page = await context.newPage();
    await page.goto(`${SITE}/track/?home=1&debug&api=demo`);
    test.skip(!(await hasWebGL(page)), "ce navigateur n'a pas WebGL : le jeu ne démarre pas");
    const bouton = page.locator("#home > .dj-barre-jeu .dj-plein-ecran");
    await expect(bouton).toBeVisible();
    await expect(bouton).toHaveAttribute("aria-label", "Plein écran");
    await expect(bouton).not.toHaveAttribute("aria-pressed", /.*/); // ce n'est pas un interrupteur : il ouvre l'aide
    expect((await bouton.boundingBox())!.width).toBeGreaterThanOrEqual(43.5);
    await bouton.click();
    const aide = page.getByRole("dialog", { name: "Jouer en plein écran" });
    await expect(aide).toBeVisible();
    await expect(aide).toContainText("Pour jouer en plein écran : touche");
    await expect(aide).toContainText("puis « Sur l'écran d'accueil ».");
    await expect(aide).toContainText("Ton profil se retrouve avec ton code de transfert.");
    await expect(aide.getByRole("img", { name: "Partager" })).toBeVisible(); // l'icône de Safari, dans la phrase
    await expect(aide.getByRole("link", { name: "Voir mon code de transfert" })).toHaveAttribute("href", /^\.\.\/profil\/\?retour=%2Ftrack%2F$/);
    // Avec un profil : « Copier mon code » (le presse-papiers n'existe pas partout : la réponse dit ce qui s'est passé).
    await aide.getByRole("button", { name: "Copier mon code" }).click();
    await expect(aide.locator('[role="status"]')).toHaveText(/Code copié|Copie impossible/);
    await expect(aide.getByRole("button", { name: "Fermer" })).toBeVisible();
    await capture(page, `aide-${format}`);
    await page.keyboard.press("Escape");
    await expect(aide).toHaveCount(0);
    await context.close();
  });
}

test("iPhone (anglais) : le bouton et l'aide parlent anglais, avec le lien du profil", { tag: ["@navigateurs", "@regression"] }, async ({ browser }) => {
  const context = await iphone(browser, "paysage", { locale: "en-US" });
  const page = await context.newPage();
  await page.goto(`${SITE}/track/?home=1&debug&api=demo`);
  test.skip(!(await hasWebGL(page)), "ce navigateur n'a pas WebGL : le jeu ne démarre pas");
  const bouton = page.locator("#home > .dj-barre-jeu .dj-plein-ecran");
  await expect(bouton).toHaveAttribute("aria-label", "Full screen");
  await bouton.click();
  const aide = page.getByRole("dialog", { name: "Play full screen" });
  await expect(aide).toContainText("To play full screen: tap");
  await expect(aide).toContainText("then “Add to Home Screen”.");
  await expect(aide).toContainText("You get your profile back with your transfer code.");
  await expect(aide.getByRole("link", { name: "See my transfer code" })).toBeVisible();
  await expect(aide.getByRole("button", { name: "Close" })).toBeVisible();
  await context.close();
});

test("iPhone : la pastille « Partager › Sur l'écran d'accueil » du portail s'affiche une seule fois ; la page a une barre qui ne la masque pas", { tag: "@navigateurs" }, async ({ browser }) => {
  const context = await iphone(browser, "portrait");
  const page = await context.newPage();
  await page.goto(`${SITE}/`);
  const pastille = page.locator(".dj-astuce");
  await expect(pastille).toBeVisible();
  await expect(pastille).toContainText("Pour jouer en plein écran : Partager › Sur l'écran d'accueil");
  await capture(page, "portail-pastille-portrait");
  await pastille.getByRole("button", { name: "Fermer cette astuce" }).click();
  await expect(pastille).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("cdj:astuce:plein-ecran"))).toBe("1");
  await page.reload();
  await expect(page.locator("#portail .portail-date")).toBeVisible();
  await expect(page.locator(".dj-astuce")).toHaveCount(0);
  await context.close();
});

// --- 2. Le manifeste et l'en-tête iOS ------------------------------------------------------------------------------------------------------------------
test("le manifeste est valide, lié depuis chaque page d'entrée, et l'en-tête iOS y est (application capable, barre d'état translucide, viewport-fit=cover)", { tag: "@navigateurs" }, async ({ browser }) => {
  const context = await iphone(browser, "portrait");
  for (const chemin of ["/", "/track/", "/jump/", "/profil/", "/classement/", "/nouveautes/", "/mentions-legales/", "/legal/"]) {
    const page = await context.newPage();
    await page.goto(`${SITE}${chemin}`);
    const tete = await page.evaluate(() => ({
      manifeste: document.querySelector<HTMLLinkElement>('link[rel="manifest"]')?.getAttribute("href"),
      icone: document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')?.getAttribute("href"),
      capable: document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.getAttribute("content"),
      barre: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')?.getAttribute("content"),
      titre: document.querySelector('meta[name="apple-mobile-web-app-title"]')?.getAttribute("content"),
      viewport: document.querySelector('meta[name="viewport"]')?.getAttribute("content"),
    }));
    if (["/", "/track/", "/jump/"].includes(chemin)) {
      // Les trois entrées qu'on ajoute à l'écran d'accueil (le portail, Track, Jump : « Track ouvert directement ») portent le manifeste et l'icône.
      expect(tete.manifeste, `${chemin} : manifeste lié`).toBe("/manifest.webmanifest");
      expect(tete.icone, `${chemin} : apple-touch-icon`).toBe("/partage/icone-180.png");
    }
    expect(tete.capable, chemin).toBe("yes");
    expect(tete.barre, chemin).toBe("black-translucent");
    expect(tete.titre, chemin).toBe("Du Jour");
    expect(tete.viewport, `${chemin} : sous l'encoche`).toContain("viewport-fit=cover");
    await page.close();
  }
  const reponse = await fetch(`${SITE}/manifest.webmanifest`);
  expect(reponse.status).toBe(200);
  expect(reponse.headers.get("content-type")).toContain("application/manifest+json");
  const m = (await reponse.json()) as { name: string; short_name: string; id: string; start_url: string; scope: string; display: string; background_color: string; theme_color: string; icons: { src: string; sizes: string; type: string }[] };
  expect(m).toMatchObject({ name: "Du Jour", short_name: "Du Jour", id: "/", start_url: "/", scope: "/", display: "standalone" });
  expect(m.background_color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  expect(m.theme_color).toMatch(/^#[0-9A-Fa-f]{6}$/);
  expect(m.icons.map((i) => i.sizes)).toEqual(["192x192", "512x512"]);
  for (const i of m.icons) {
    const image = await fetch(`${SITE}${i.src}`);
    expect(image.status, i.src).toBe(200);
    expect(image.headers.get("content-type"), i.src).toBe("image/png");
  }
  expect((await fetch(`${SITE}/partage/icone-180.png`)).status).toBe(200);
  await context.close();
});

// --- 3. Le mode application : rien ne revient, rien sous l'encoche ni la barre d'accueil ---------------------------------------------------------------
/**
 * Les boutons et liens visibles qui touchent une marge de sécurité (leur rectangle sort de la zone sûre) : leurs noms. Une page **qui défile** (le portail) : en haut de page
 * rien ne touche le haut ni les côtés, en bas de page rien ne touche le bas (le reste passe sous le bord en défilant, c'est normal) ; une page **de jeu** (rien ne défile : tout
 * est posé contre un bord) : les quatre côtés d'un coup, ou ceux de `cotes` (l'accueil de Jump défile **dans** sa carte : son bas passe sous la marge en défilant).
 */
async function dansLesMarges(page: Page, marges: { top: number; right: number; bottom: number; left: number }, { defile = false, cotes = ["top", "right", "bottom", "left"] }: { defile?: boolean; cotes?: ("top" | "right" | "bottom" | "left")[] } = {}): Promise<string[]> {
  const lire = (cotes: ("top" | "right" | "bottom" | "left")[]) =>
    page.evaluate(
      ([m, cotesVoulus]) => {
        const largeur = innerWidth;
        const hauteur = innerHeight;
        const fautifs: string[] = [];
        for (const e of document.querySelectorAll<HTMLElement>("button, a[href], input, [role=button]")) {
          const r = e.getBoundingClientRect();
          if (r.width === 0 || r.height === 0 || e.closest("[hidden]")) continue;
          const style = getComputedStyle(e);
          if (style.visibility === "hidden" || style.display === "none" || style.pointerEvents === "none") continue;
          if (r.right < 0 || r.bottom < 0 || r.left > largeur || r.top > hauteur) continue; // hors de l'écran : pas dans une marge
          const dedans = {
            top: r.top >= m.top - 0.5,
            left: r.left >= m.left - 0.5,
            right: r.right <= largeur - m.right + 0.5,
            bottom: r.bottom <= hauteur - m.bottom + 0.5,
          };
          if ((cotesVoulus as string[]).some((c) => !dedans[c as keyof typeof dedans])) {
            fautifs.push(`${e.id || e.className || e.tagName} ${e.getAttribute("aria-label") ?? e.textContent?.trim().slice(0, 20)} [${Math.round(r.left)},${Math.round(r.top)} ${Math.round(r.right)},${Math.round(r.bottom)}]`);
          }
        }
        return fautifs;
      },
      [marges, cotes] as const,
    );
  if (!defile) return lire(cotes);
  await page.evaluate(() => scrollTo(0, 0));
  const haut = await lire(["top", "right", "left"]);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  return [...haut, ...(await lire(["bottom", "right", "left"]))];
}

for (const format of FORMES) {
  test(`application (${format}) : le portail n'a ni pastille ni bouton dans les marges de sécurité`, { tag: ["@navigateurs", "@regression"] }, async ({ browser }) => {
    const context = await iphone(browser, format, { standalone: true, marges: true });
    await avecProfil(context);
    const page = await context.newPage();
    await page.goto(`${SITE}/`);
    await expect(page.locator("#portail .portail-date")).toBeVisible();
    await expect(page.locator(".dj-astuce")).toHaveCount(0);
    await expect(page.locator(".dj-modale")).toHaveCount(0); // un profil existe : rien à retrouver
    await expect(page.locator(".dj-plein-ecran")).toHaveCount(0);
    expect(await dansLesMarges(page, FORMATS[format].marges, { defile: true })).toEqual([]);
    await page.evaluate(() => scrollTo(0, 0));
    await capture(page, `application-portail-${format}`);
    // La preuve que le contrôle n'est pas vide : sans la marge du haut (portrait) la barre du portail y serait.
    await page.evaluate(() => scrollTo(0, 0));
    const barre = (await page.locator("#portail .dj-barre-portail").first().boundingBox())!;
    expect(barre.y).toBeGreaterThanOrEqual(FORMATS[format].marges.top - 0.5);
    expect(barre.x).toBeGreaterThanOrEqual(FORMATS[format].marges.left - 0.5);
    await context.close();
  });

  test(`application (${format}) : l'accueil de Track, sans bouton « Plein écran », garde ses boutons hors des marges`, { tag: ["@navigateurs", "@regression"] }, async ({ browser }) => {
    const context = await iphone(browser, format, { standalone: true, marges: true });
    await avecProfil(context);
    const page = await context.newPage();
    await page.goto(`${SITE}/track/?home=1&debug&api=demo`);
    test.skip(!(await hasWebGL(page)), "ce navigateur n'a pas WebGL : le jeu ne démarre pas");
    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("#home .dj-plein-ecran")).toBeHidden();
    await expect(page.locator("#home .dj-astuce")).toHaveCount(0);
    expect(await dansLesMarges(page, FORMATS[format].marges)).toEqual([]);
    await context.close();
  });

  test(`application (${format}) : la course de Track (pause, caméra, commandes, HUD) reste hors des marges`, { tag: ["@navigateurs", "@regression"] }, async ({ browser }) => {
    const context = await iphone(browser, format, { standalone: true, marges: true });
    await avecProfil(context);
    await context.route(/\/api\//, (route) => route.abort());
    const page = await context.newPage();
    await page.goto(`${SITE}/track/?debug&home=0&touch=1`);
    test.skip(!(await hasWebGL(page)), "ce navigateur n'a pas WebGL : le jeu ne démarre pas");
    await page.waitForFunction(() => window.__cdj?.phase);
    await page.evaluate(() => window.__cdj.manual(true));
    await page.evaluate(() => window.__cdj.advance(3 * 120 + 40 + 2 * 120));
    if (format === "portrait") {
      // Le jeu se joue en paysage : l'invitation à tourner le téléphone marche en mode application comme dans Safari.
      await expect(page.locator("#rotate .card")).toBeVisible();
      await page.locator("#rotate .card button").first().click(); // « Jouer quand même »
    }
    await expect(page.locator("#btn-pause")).toBeVisible();
    await expect(page.locator("#btn-fullscreen")).toBeHidden();
    expect(await dansLesMarges(page, FORMATS[format].marges)).toEqual([]);
    // Les commandes tactiles sont dessinées hors des marges (la sonde lit les mêmes valeurs).
    const touche = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>("#touch button, #touch .pedal-brake, #touch .pedal-gas, #touch .steer-left, #touch .steer-right")].map((e) => e.getBoundingClientRect()).filter((r) => r.width > 0).map((r) => [r.left, r.top, r.right, r.bottom]));
    const m = FORMATS[format].marges;
    for (const [l, t, r, b] of touche!) {
      expect(l).toBeGreaterThanOrEqual(m.left - 0.5);
      expect(t).toBeGreaterThanOrEqual(m.top - 0.5);
      expect(r).toBeLessThanOrEqual(FORMATS[format].ecran.width - m.right + 0.5);
      expect(b).toBeLessThanOrEqual(FORMATS[format].ecran.height - m.bottom + 0.5);
    }
    await context.close();
  });

  test(`application (${format}) : l'accueil de Jump, sans bouton « Plein écran », garde ses boutons hors des marges`, { tag: ["@navigateurs", "@regression"] }, async ({ browser }) => {
    const context = await iphone(browser, format, { standalone: true, marges: true });
    await avecProfil(context);
    const page = await context.newPage();
    await page.goto(`${SITE}/jump/?api=demo`);
    test.skip(!(await hasWebGL(page)), "ce navigateur n'a pas WebGL : le jeu ne démarre pas");
    await expect(page.locator("#home")).toBeVisible();
    await expect(page.locator("#home .dj-plein-ecran")).toBeHidden();
    await expect(page.locator("#home .dj-astuce")).toHaveCount(0);
    expect(await dansLesMarges(page, FORMATS[format].marges, { cotes: ["top", "right", "left"] })).toEqual([]);
    await context.close();
  });
}

// --- 4. « Retrouver mon profil » ---------------------------------------------------------------------------------------------------------------------------
for (const format of FORMES) {
  test(`application (${format}) : sans profil, « Retrouver mon profil » apparaît au premier lancement ; un code collé est vérifié sur le serveur, montré, puis adopté`, { tag: format === "portrait" ? "@navigateurs" : ["@navigateurs", "@regression"] }, async ({ browser }) => {
    const context = await iphone(browser, format, { standalone: true });
    const page = await context.newPage();
    await page.goto(`${SITE}/`);
    const dialogue = page.getByRole("dialog", { name: "Retrouver mon profil" });
    await expect(dialogue).toBeVisible();
    await expect(dialogue).toContainText("Cette application a son propre stockage");
    await capture(page, `retrouver-${format}`);
    // Le moyen le plus simple : « Coller mon code » lit le presse-papiers (un geste du joueur). Ici il est refusé : le champ prend le relais.
    // Le refus est imposé : Firefox ouvre un menu « Coller » que personne ne touche dans un navigateur piloté (la lecture ne finirait jamais).
    await page.evaluate(() => {
      if (navigator.clipboard) Object.defineProperty(navigator.clipboard, "readText", { configurable: true, value: () => Promise.reject(new DOMException("refusé", "NotAllowedError")) });
    });
    await dialogue.getByRole("button", { name: "Coller mon code" }).click();
    await expect(dialogue.locator('[role="status"]')).toHaveText(/presse-papiers est vide ou refusé/);
    // Un texte qui n'est pas un code, puis le code (collé avec d'autres mots : le code est repéré dedans).
    const champ = dialogue.getByLabel("Ou colle ton code ici");
    await champ.fill("bonjour");
    await dialogue.getByRole("button", { name: "Vérifier" }).click();
    await expect(dialogue.locator('[role="status"]')).toHaveText(/Ce n'est pas un code de transfert valide/);
    await champ.fill(`Mon code : ${encodeTransfer(ID)} (à garder)`);
    await dialogue.getByRole("button", { name: "Vérifier" }).click();
    await expect(dialogue.locator('[role="status"]')).toHaveText(`Profil trouvé : ${PSEUDO}, ${JOURS} jours finis.`);
    expect(await page.evaluate(() => localStorage.getItem("cdj:player"))).toBeNull(); // rien n'est adopté avant la confirmation
    await dialogue.getByRole("button", { name: "Ce n'est pas le mien" }).click(); // on peut revenir en arrière
    await expect(dialogue.getByLabel("Ou colle ton code ici")).toBeVisible();
    await dialogue.getByLabel("Ou colle ton code ici").fill(encodeTransfer(ID));
    await dialogue.getByRole("button", { name: "Vérifier" }).click();
    await dialogue.getByRole("button", { name: "Reprendre ce profil" }).click();
    await page.waitForFunction((id) => localStorage.getItem("cdj:player") === id, ID);
    expect(await page.evaluate(() => [localStorage.getItem("cdj:name"), localStorage.getItem("cdj:retrouver:vu"), localStorage.getItem("cdj:identite:code")])).toEqual([PSEUDO, "1", "1"]);
    // La page repart avec le profil retrouvé : plus de carte, et l'avatar du portail porte les initiales du pseudo.
    await expect(page.locator(".dj-modale")).toHaveCount(0);
    await expect(page.locator("#portail .portail-date")).toBeVisible();
    await expect(page.getByRole("link", { name: /profil/i }).first()).toBeVisible();
    await context.close();
  });
}

test("application : « Commencer sans profil » ne revient pas ; un code inconnu du serveur est refusé avec son message ; dans Safari (hors application) rien n'est proposé", { tag: "@navigateurs" }, async ({ browser }) => {
  const context = await iphone(browser, "portrait", { standalone: true });
  const page = await context.newPage();
  await page.goto(`${SITE}/`);
  const dialogue = page.getByRole("dialog", { name: "Retrouver mon profil" });
  await dialogue.getByLabel("Ou colle ton code ici").fill(encodeTransfer("fedcba9876543210fedcba9876543210"));
  await dialogue.getByRole("button", { name: "Vérifier" }).click();
  await expect(dialogue.locator('[role="status"]')).toHaveText("Ce profil n'a encore aucun résultat.");
  expect(await page.evaluate(() => localStorage.getItem("cdj:player"))).toBeNull();
  await dialogue.getByRole("button", { name: "Commencer sans profil" }).click();
  await expect(page.locator(".dj-modale")).toHaveCount(0);
  await page.reload();
  await expect(page.locator("#portail .portail-date")).toBeVisible();
  await expect(page.locator(".dj-modale")).toHaveCount(0);
  await context.close();

  const safari = await iphone(browser, "portrait");
  const p2 = await safari.newPage();
  await p2.goto(`${SITE}/`);
  await expect(p2.locator("#portail .portail-date")).toBeVisible();
  await expect(p2.locator(".dj-modale")).toHaveCount(0);
  await safari.close();
});

test("application : Track et Jump ouverts directement proposent aussi « Retrouver mon profil », le profil retrouvé est celui des deux jeux", { tag: ["@navigateurs", "@regression"] }, async ({ browser }) => {
  for (const jeu of ["track", "jump"]) {
    const context = await iphone(browser, "paysage", { standalone: true });
    const page = await context.newPage();
    await page.goto(`${SITE}/${jeu}/${jeu === "track" ? "?home=1&debug&api=/" : "?accueil=1&api=/"}`); // `api=/` : le serveur de la même origine (la construction de production a `VITE_API_URL=/`, pas celle-ci)
    const dialogue = page.getByRole("dialog", { name: "Retrouver mon profil" });
    await expect(dialogue, jeu).toBeVisible();
    await dialogue.getByLabel("Ou colle ton code ici").fill(encodeTransfer(ID));
    await dialogue.getByRole("button", { name: "Vérifier" }).click();
    await expect(dialogue.locator('[role="status"]')).toContainText(PSEUDO);
    await dialogue.getByRole("button", { name: "Reprendre ce profil" }).click();
    await page.waitForFunction((id) => localStorage.getItem("cdj:player") === id, ID);
    // L'autre jeu, même origine : le profil y est (le stockage de l'application est partagé par ses pages).
    await page.goto(`${SITE}/`);
    expect(await page.evaluate(() => localStorage.getItem("cdj:name"))).toBe(PSEUDO);
    await context.close();
  }
});
