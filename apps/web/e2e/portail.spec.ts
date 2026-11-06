import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect as baseExpect, newClockedContext, test, type Page } from "./fixtures";
import { startSite } from "./domaine-serveurs";

// Lot I1 (plateforme, phase 3) : le portail passé au socle `@cdj/ui` (direction « Cartouches », français et anglais) et la vitrine `/ui/`.
//   - la langue commune : détectée à la première visite (`en-US` → anglais, `fr-CA` → français), changée sans rechargement (`<html lang>`,
//     titre, textes), gardée après un rechargement (`cdj:langue`) ;
//   - accessibilité : tout le portail au clavier, focus visible (contour de 3 px) ; aucune cible tactile sous 44 px en portrait ;
//   - captures (portrait 390 × 844, paysage 844 × 390, FR et EN, portail et vitrine) jointes au rapport ; avec `CAPTURES=1`, écrites aussi
//     dans docs/plateforme/lots/img/ (README du lot I1).
// Le portail est construit ici (vite build, avec la vitrine : comme la recette) et servi sur le port 4178 (réservé) ; aucun jeu n'est nécessaire.
// Lot I2 : ici le serveur est injoignable (port 9) — le portail reste entier (cartouches, liens) ; l'accueil riche avec un serveur est testé
// par portail-jour.spec.ts.
test.describe.configure({ mode: "serial" });
const expect = baseExpect.configure({ timeout: 15_000 });

const ROOT = resolve("../..");
const SITE = "http://localhost:4178";
const PORTRAIT = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const PAYSAGE = { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true };
const CAPTURES = process.env.CAPTURES ? join(ROOT, "docs/plateforme/lots/img") : null;

let tmp = "";
let server: Server | null = null;

test.beforeAll(async () => {
  test.setTimeout(120_000);
  tmp = mkdtempSync(join(tmpdir(), "portail-e2e-"));
  execFileSync("npx", ["vite", "build", "-c", "apps/portail/vite.config.ts", "--logLevel", "error", "--outDir", join(tmp, "site"), "--emptyOutDir"], {
    cwd: ROOT,
    env: { ...process.env, PORTAIL_VITRINE: "1", VITE_CONFIG_NATIVE_IGNORE_WARNING: "true" },
    stdio: "inherit",
  });
  server = await startSite(join(tmp, "site"), 4178, 9); // aucune requête /api/ : le portail n'en fait pas
  if (CAPTURES) mkdirSync(CAPTURES, { recursive: true });
});

test.afterAll(async () => {
  await new Promise((r) => (server ? server.close(r) : r(null)));
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

/** Capture jointe au rapport (et écrite pour le README avec CAPTURES=1). */
async function capture(page: Page, nom: string, zone?: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  // Une zone de la page (la vitrine est très haute : une capture par bloc), sinon l'écran.
  const options = CAPTURES ? { path: join(CAPTURES, `lot-I1-${nom}.png`) } : {};
  const png = zone ? await page.locator(zone).screenshot(options) : await page.screenshot(options);
  await test.info().attach(nom, { body: png, contentType: "image/png" });
}

test("portail en français : barre, date, une cartouche par jeu (numéro du jour, bouton vers le jeu), pied et mentions", { tag: "@navigateurs" }, async ({ browser }) => {
  const page = await (await newClockedContext(browser, { ...PORTRAIT, locale: "fr-FR" })).newPage();
  await page.goto(`${SITE}/`);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page).toHaveTitle("Du Jour");
  await expect(page.locator(".salle-barre .dj-logo")).toHaveText("DU JOUR");
  await expect(page.locator("#date")).toHaveText("Mardi 20 octobre"); // TODAY = 20/10/2026, Paris
  await expect(page.locator("#portail-jeux-titre")).toHaveText("Les jeux du jour");
  await expect(page.locator('[data-jeu="track"] .track-etiquette__titre')).toHaveText("TRACK");
  await expect(page.locator('[data-jeu="track"] .track-etiquette__numero')).toHaveText("n° 8");
  await expect(page.locator('[data-jeu="jump"] .jump-etiquette__titre')).toHaveText("JUMP");
  await expect(page.locator('[data-jeu="jump"] .jump-etiquette__numero')).toHaveText("n° 5");
  await expect(page.locator('[data-jeu="track"] a.dj-bouton')).toHaveAttribute("href", "track/");
  await expect(page.locator('[data-jeu="jump"] a.dj-bouton')).toHaveAttribute("href", "jump/");
  await expect(page.locator('[data-jeu="track"] a.dj-bouton')).toHaveAccessibleName("Jouer à Track");
  await expect(page.locator("#mentions")).toHaveText("Mentions légales et confidentialité");
  await expect(page.locator("#mentions")).toHaveAttribute("href", "mentions-legales/");
  // Le pied : la communauté et le soutien de l'éditeur, de simples liens (aucun script ni bouton intégré de ces services), nouvel onglet sans transmettre la page.
  await expect(page.locator("#discord")).toHaveText("Rejoindre le Discord");
  await expect(page.locator("#discord")).toHaveAttribute("href", "https://discord.gg/2KZkUSpDej");
  await expect(page.locator("#kofi")).toHaveText("Me soutenir sur Ko-fi");
  await expect(page.locator("#kofi")).toHaveAttribute("href", "https://ko-fi.com/C7X829MCE1");
  for (const id of ["discord", "kofi"]) {
    await expect(page.locator(`#${id}`)).toHaveAttribute("target", "_blank");
    await expect(page.locator(`#${id}`)).toHaveAttribute("rel", "noopener noreferrer");
  }
  expect(await page.evaluate(() => [...document.scripts].filter((s) => s.src && new URL(s.src).origin !== location.origin).length)).toBe(0);
  // Sans pseudo : l'icône profil (lot I2 : un lien vers le profil commun) ; les polices de la charte chargées (aucune police système).
  await expect(page.locator(".salle-barre .dj-avatar")).toHaveAccessibleName("Ton profil");
  await expect(page.locator(".salle-barre .dj-avatar")).toHaveAttribute("href", "profil/");
  expect(await page.evaluate(async () => (await document.fonts.ready, ["Archivo Black", "Archivo", "JetBrains Mono", "Lilita One"].every((f) => document.fonts.check(`16px "${f}"`))))).toBe(true);
  await capture(page, "portail-portrait-fr");
});

test("langue : EN sans rechargement (lang, titre, textes, formats), gardée au rechargement, puis FR", async ({ browser }) => {
  // Lot U1 : le choix de langue est dans la barre à partir de 760 px (sur téléphone, il est dans le profil).
  const page = await (await newClockedContext(browser, { ...PORTRAIT, viewport: { width: 800, height: 900 }, locale: "fr-FR" })).newPage();
  await page.goto(`${SITE}/`);
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await page.evaluate(() => ((window as unknown as { __sansRechargement: boolean }).__sansRechargement = true));
  await page.locator('.dj-choix-langue [data-langue="en"]').click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#portail-jeux-titre")).toHaveText("Today's games");
  await expect(page.locator("#date")).toHaveText("Tuesday, October 20");
  await expect(page.locator('[data-jeu="track"] .track-etiquette__numero')).toHaveText("#8");
  await expect(page.locator('[data-jeu="jump"] a.dj-bouton')).toHaveText("Play");
  await expect(page.locator('.dj-choix-langue [data-langue="en"]')).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('.dj-choix-langue [data-langue="en"]')).toBeFocused();
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /one game a day/);
  expect(await page.evaluate(() => (window as unknown as { __sansRechargement?: boolean }).__sansRechargement)).toBe(true);
  expect(await page.evaluate(() => localStorage.getItem("cdj:langue"))).toBe("en");
  await capture(page, "portail-portrait-en");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#portail-jeux-titre")).toHaveText("Today's games");
  await expect(page.locator('.dj-choix-langue [data-langue="en"]')).toHaveAttribute("aria-pressed", "true");

  await page.locator('.dj-choix-langue [data-langue="fr"]').click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.locator("#portail-jeux-titre")).toHaveText("Les jeux du jour");
  expect(await page.evaluate(() => localStorage.getItem("cdj:langue"))).toBe("fr");
});

test("première visite : langue du navigateur (en-US → anglais, fr-CA → français), rien d'écrit tant qu'on n'a pas choisi", async ({ browser }) => {
  for (const [locale, lang, titre] of [["en-US", "en", "Today's games"], ["fr-CA", "fr", "Les jeux du jour"], ["de-DE", "en", "Today's games"]] as const) {
    const page = await (await newClockedContext(browser, { ...PORTRAIT, locale })).newPage();
    await page.goto(`${SITE}/`);
    await expect(page.locator("html"), locale).toHaveAttribute("lang", lang);
    await expect(page.locator("#portail-jeux-titre"), locale).toHaveText(titre);
    expect(await page.evaluate(() => localStorage.getItem("cdj:langue")), locale).toBeNull();
  }
});

test("avatar : les initiales du pseudo du profil commun", { tag: "@regression" }, async ({ browser }) => {
  const context = await newClockedContext(browser, { ...PORTRAIT, locale: "fr-FR" });
  await context.addInitScript(() => {
    localStorage.setItem("cdj:player", "0123456789abcdef0123456789abcdef");
    localStorage.setItem("cdj:name", "Nathan");
  });
  const page = await context.newPage();
  await page.goto(`${SITE}/`);
  await expect(page.locator(".salle-barre .dj-avatar")).toHaveText("NA");
  await expect(page.locator(".salle-barre .dj-avatar")).toHaveAccessibleName("Ton profil : Nathan");
});

test("clavier : tout le portail joignable à la tabulation, dans l'ordre, avec un focus visible", { tag: "@regression" }, async ({ browser }) => {
  const page = await (await newClockedContext(browser, { viewport: { width: 1024, height: 768 }, locale: "fr-FR" })).newPage();
  await page.goto(`${SITE}/`);
  await expect(page.locator("#jeux .dj-cartouche")).toHaveCount(2);
  const attendus = ['[data-cle="nav-haut-aujourdhui"]', '[data-cle="nav-haut-classements"]', '[data-cle="nav-haut-amis"]', '[data-cle="nav-haut-profil"]', '[data-langue="fr"]', '[data-langue="en"]', "#cloche", ".salle-barre .dj-avatar", '[data-jeu="track"] a.dj-bouton', '[data-cle="favori-track"]', '[data-jeu="jump"] a.dj-bouton', '[data-cle="favori-jump"]', "#retours", "#discord", "#kofi", "#mentions"]; // lot U1 : la navigation du haut, puis la langue, la cloche et l'avatar ; lot C1 : « Un bug ? Une idée ? » est un bouton visible avant le pied ; lot F1 : l'étoile de chaque cartouche suit son « Jouer » ; pied : Discord et Ko-fi (retouche) ; lot I3 : sans réponse du serveur (ici, aucun), la tuile « Classement du jour » n'est pas là
  for (const sel of attendus) {
    await page.keyboard.press("Tab");
    await expect(page.locator(sel), sel).toBeFocused();
    const contour = await page.locator(sel).evaluate((e) => {
      const s = getComputedStyle(e);
      return { style: s.outlineStyle, largeur: parseFloat(s.outlineWidth) };
    });
    expect(contour.style, sel).not.toBe("none");
    expect(contour.largeur, sel).toBeGreaterThanOrEqual(3);
  }
  // Entrée sur le bouton d'un jeu : on y va (les jeux ne sont pas construits ici : la demande de la page suffit).
  for (let i = 0; i < 5; i++) await page.keyboard.press("Shift+Tab"); // mentions › Ko-fi › Discord › « Un bug ? Une idée ? » (lot C1) › l'étoile de Jump (lot F1) › le bouton de Jump
  const vers = page.waitForRequest((r) => r.isNavigationRequest() && r.url() === `${SITE}/jump/`);
  await page.keyboard.press("Enter");
  await vers;
});

test("aucune cible tactile sous 44 px sur le portail, en portrait et en paysage", { tag: "@regression" }, async ({ browser }) => {
  for (const [nom, options] of [["portrait", PORTRAIT], ["paysage", PAYSAGE]] as const) {
    const page = await (await newClockedContext(browser, { ...options, locale: "fr-FR" })).newPage();
    await page.goto(`${SITE}/`);
    await expect(page.locator("#jeux .dj-cartouche")).toHaveCount(2);
    const cibles = await page.locator("a[href], button, [tabindex]").evaluateAll((els) =>
      els.map((e) => {
        const r = e.getBoundingClientRect();
        return { quoi: e.id || e.getAttribute("data-langue") || e.textContent?.trim() || e.tagName, l: r.width, h: r.height };
      }),
    );
    expect(cibles.length, nom).toBeGreaterThanOrEqual(5);
    for (const c of cibles) {
      expect(c.l, `${nom} ${c.quoi}`).toBeGreaterThanOrEqual(44);
      expect(c.h, `${nom} ${c.quoi}`).toBeGreaterThanOrEqual(44);
    }
    // Lot U1 : la barre (logo, navigation, langue, cloche, avatar) ne se chevauche pas à 844 px ; sur téléphone la navigation du haut est remplacée par la barre d'onglets du bas.
    if (nom === "paysage") {
      const boites = await page.locator(".salle-barre .dj-logo, .salle-nav a, .salle-barre__outils > *").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((r) => [Math.round(r.left), Math.round(r.right)]));
      for (let i = 1; i < boites.length; i++) expect(boites[i]![0], `${nom} élément ${i} de la barre`).toBeGreaterThanOrEqual(boites[i - 1]![1] - 1);
    } else {
      await expect(page.locator(".salle-nav")).toBeHidden();
      await expect(page.locator(".salle-onglets")).toBeVisible();
    }
    // Aucun défilement horizontal ; lot U1 : à 844 px la colonne de droite prend 360 px, les deux cartouches se superposent (de même taille).
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), nom).toBe(true);
    const [a, b] = await page.locator("#jeux .dj-cartouche").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top));
    expect(b!, nom).toBeGreaterThan(a!);
    await capture(page, `portail-${nom}-fr`);
    if (nom === "paysage") {
      await page.locator('.dj-choix-langue [data-langue="en"]').click(); // 844 px : la langue est dans la barre
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await capture(page, "portail-paysage-en");
    }
  }
});

test("vitrine /ui/ : chaque composant en français et en anglais, sur crème et sur asphalte, médailles, couleurs, contrastes qui passent", { tag: "@regression" }, async ({ browser }) => {
  for (const [nom, options] of [["portrait", PORTRAIT], ["paysage", PAYSAGE]] as const) {
    for (const locale of ["fr-FR", "en-US"] as const) {
      const page = await (await newClockedContext(browser, { ...options, locale })).newPage();
      await page.goto(`${SITE}/ui/`);
      await expect(page.locator('[data-langue-bloc="fr"]')).toHaveAttribute("lang", "fr");
      await expect(page.locator('[data-langue-bloc="en"]')).toHaveAttribute("lang", "en");
      for (const l of ["fr", "en"]) {
        const bloc = page.locator(`[data-langue-bloc="${l}"]`);
        for (const classe of [".dj-logo--grand", ".dj-logo--petit", ".dj-barre-portail", ".dj-barre-jeu", ".dj-choix-langue", ".dj-bouton--marque", ".dj-bouton--secondaire", ".dj-bouton--track", ".dj-bouton--jump", ".dj-cartouche--track", ".dj-cartouche--jump", ".dj-tuile", ".dj-afficheur", ".dj-medaille--pastille", ".dj-medaille--case", ".dj-icone"]) {
          expect(await bloc.locator(classe).count(), `${l} ${classe}`).toBeGreaterThan(0);
        }
        // Chaque bouton dans ses cinq états, sur crème et sur asphalte : 4 variantes × 5 états × 2 fonds.
        expect(await bloc.locator(".vitrine-case .dj-bouton").count(), l).toBe(40);
        await expect(bloc.locator(".dj-bouton:disabled").first()).toBeDisabled();
      }
      await expect(page.locator('[data-langue-bloc="en"] .dj-medaille--or.dj-medaille--pastille').first()).toHaveAccessibleName("Gold: earned");
      await expect(page.locator('[data-langue-bloc="fr"] .dj-medaille--or.dj-medaille--pastille').first()).toHaveAccessibleName("Or : obtenue");
      expect(await page.locator(".vitrine-contrastes tbody tr").count()).toBeGreaterThan(25);
      expect(await page.locator('.vitrine-contrastes tbody tr[data-ok="false"]').count()).toBe(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${nom} ${locale}`).toBe(true);
      const l = locale.slice(0, 2);
      await capture(page, `vitrine-${nom}-${l}`, `[data-langue-bloc="${l}"]`);
      if (l === "fr") await capture(page, `vitrine-${nom}-couleurs`, "#couleurs-contrastes");
    }
  }
});

// Lot DA1 : la planche « Blocs » de la vitrine — chaque pièce dessinée en Canvas 2D et par le dessinateur de Tower (Three.js) à partir de la même description ; la vitrine mesure l'écart de pixels de chaque paire (`data-ecart`).
// Le rendu doit être le même à l'œil : le crénelage des bords donne un peu d'écart (mesuré : 0,2 % au plus), un défaut de dessin (un œil recouvert, une couleur, un relief) en donne dix fois plus. Chromium seulement (WebGL). Régression (la nuit) : l'Essentiel d'une grosse PR tient dans son budget de specs (`ciZones.test.ts`), et la parité structurelle des deux dessinateurs est gardée par les unitaires de `packages/visuels`.
test("vitrine /ui/ › Blocs : les pièces Canvas 2D et celles de Tower sont les mêmes, sur chaque thème, avec les états des yeux", { tag: "@regression" }, async ({ browser }) => {
  const page = await (await newClockedContext(browser, { viewport: { width: 1280, height: 900 }, locale: "fr-FR" })).newPage();
  await page.goto(`${SITE}/ui/`);
  await page.waitForSelector("[data-blocs][data-pret=true]", { timeout: 60_000 });
  const paires = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".vitrine-blocs__cellule")].map((c) => ({ theme: c.dataset.theme!, forme: c.dataset.forme!, etat: c.dataset.etat ?? null, ecart: c.dataset.ecart === undefined ? null : Number(c.dataset.ecart), canvas: c.querySelectorAll("canvas").length })));
  // 6 thèmes × (7 formes + 12 états des yeux), chaque paire a ses deux canvas et son écart mesuré.
  expect(paires).toHaveLength(6 * (7 + 12));
  expect(new Set(paires.map((p) => p.theme))).toEqual(new Set(["port", "chantier", "canyon", "banquise", "jungle", "nuit"]));
  expect(new Set(paires.map((p) => p.forme))).toEqual(new Set(["I", "O", "T", "L", "J", "S", "Z"]));
  for (const p of paires) {
    expect(p.canvas, `${p.theme} ${p.forme}`).toBe(2);
    expect(p.ecart, `${p.theme} ${p.forme} ${p.etat}`).not.toBeNull();
    expect(p.ecart!, `${p.theme} ${p.forme} ${p.etat}`).toBeLessThan(0.01);
  }
  // Une pièce vide ne passerait pas pour identique : chaque canvas montre bien autre chose que le ciel.
  const nonVides = await page.evaluate(() => [...document.querySelectorAll<HTMLCanvasElement>(".vitrine-blocs__canvas")].every((c) => {
    const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
    let autres = 0;
    for (let i = 4; i < d.length; i += 4) if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) autres++;
    return autres > 200;
  }));
  expect(nonVides).toBe(true);
});
