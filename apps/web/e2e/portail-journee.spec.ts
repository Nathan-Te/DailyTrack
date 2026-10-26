import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { dailyCircuit, encodeReplay, runPilot } from "@cdj/sim";
import { expect as baseExpect, hasWebGL, newClockedContext, newContextAt, test, TODAY, type BrowserContext, type Page } from "./fixtures";
import { startSite } from "./domaine-serveurs";
import { auditAxe } from "./axe";

// Lot I3 (plateforme, phase 3) : la journée partagée.
//   - le portail à partir du 23/10/2026 : « Journée n° 2 » à droite de la date, les deux tuiles (Série, Classement du jour), « Partager ma journée » et la
//     ligne qu'il enverra (copie dans le presse-papiers quand `navigator.share` manque, texte exact), FR et EN ; **une seule requête** au chargement ;
//   - un joueur neuf : la tuile invite à jouer, pas de bouton de partage ;
//   - la page `/classement/` : le haut du classement, ta ligne surlignée (dans le haut, et hors du haut), la médaille de chaque jeu, le barème, un jour passé
//     (« ‹ Veille », « Lendemain › » jamais au-delà d'aujourd'hui) ;
//   - « Jeu suivant du jour » à l'arrivée de chaque jeu, de Track vers Jump et de Jump vers Track, puis « Journée parfaite ! » (les vrais jeux, le vrai
//     serveur, le site assemblé comme Firebase Hosting le sert) ;
//   - lot I6 : la passe d'accessibilité (axe, e2e/axe.ts) sur le portail plein, le profil commun et le classement du jour, en français et en anglais.
// Captures (portrait 390 × 844, paysage 844 × 390) jointes au rapport ; avec `CAPTURES=1`, écrites dans docs/plateforme/lots/img/ (`lot-I3-*.png`).
// Serveurs lancés ici (ports réservés à ce fichier) : sites 4182 (le 24/10, recette garnie) et 4183 (le 20/10, base vide), API 8797 et 8798.
test.describe.configure({ mode: "serial" });
test.setTimeout(150_000);
const expect = baseExpect.configure({ timeout: 25_000 });

const ROOT = resolve("../..");
const PORTRAIT = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true };
const PAYSAGE = { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true };
const CAPTURES = process.env.CAPTURES ? join(ROOT, "docs/plateforme/lots/img") : null;
const DEMO_ID = "de30de30de30de30de30de30de30de30";
/** Le 24/10/2026, midi UTC : la journée n° 2 de Du Jour. */
const T24 = Date.parse("2026-10-24T12:00:00Z");
const SITE_24 = "http://localhost:4182";
const SITE_20 = "http://localhost:4183";

let tmp = "";
const servers: Server[] = [];
const apis: ChildProcess[] = [];

/** Lance le vrai serveur (`dist/server.mjs`) sur `port`, avec la base `db` et l'horloge réglée pour valoir `instant` maintenant. */
async function api(port: number, db: string, instant?: number): Promise<void> {
  const offset = instant === undefined ? process.env.E2E_CLOCK_OFFSET_MS : String(instant - Date.now());
  const child = spawn("node", ["../api/dist/server.mjs"], {
    env: { ...process.env, PORT: String(port), DB_PATH: db, ALLOW_ORIGIN: "*", NODE_NO_WARNINGS: "1", TEST_CLOCK_OFFSET_MS: offset },
    stdio: "ignore",
  });
  apis.push(child);
  for (let i = 0; i < 100; i++) {
    if (await fetch(`http://127.0.0.1:${port}/api/health`).then((r) => r.ok, () => false)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`serveur ${port} injoignable`);
}

test.beforeAll(async () => {
  test.setTimeout(420_000);
  for (const app of ["web", "jump"]) if (!existsSync(join(ROOT, "apps", app, "dist", "index.html"))) throw new Error(`apps/${app} n'est pas construit : npm run build`);
  tmp = mkdtempSync(join(tmpdir(), "portail-journee-"));
  // Le site comme sur la recette et les aperçus : portail (vitrine et lien de démonstration compris), DailyTrack sous /track/, DailyJump sous /jump/.
  execFileSync("node", ["scripts/site.mjs", "site", "--sortie", join(tmp, "site")], { cwd: ROOT, stdio: "inherit" });
  // La recette garnie le 24/10 : le joueur « Démo » et la vingtaine de joueurs du classement du jour (le vrai `recette:seed`, rejoué par le vrai serveur).
  execFileSync("npm", ["run", "recette:seed", "--", "--demo-seulement", "--classement", "--today", "2026-10-24"], {
    cwd: ROOT,
    env: { ...process.env, ENVIRONMENT: "recette", DB_PATH: join(tmp, "recette-24.sqlite"), TURSO_DATABASE_URL: "" },
    stdio: "inherit",
  });
  await api(8797, join(tmp, "recette-24.sqlite"), T24);
  await api(8798, ":memory:");
  servers.push(await startSite(join(tmp, "site"), 4182, 8797), await startSite(join(tmp, "site"), 4183, 8798));
  if (CAPTURES) mkdirSync(CAPTURES, { recursive: true });
});

test.afterAll(async () => {
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  for (const a of apis) a.kill();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

/** Capture jointe au rapport (et écrite pour le README avec CAPTURES=1). */
async function capture(page: Page, nom: string): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  const png = await page.screenshot({ fullPage: true, ...(CAPTURES ? { path: join(CAPTURES, `lot-I3-${nom}.png`) } : {}) });
  await test.info().attach(nom, { body: png, contentType: "image/png" });
}

/** Les requêtes `/api/…` faites par la page. */
function requetesApi(page: Page): { url: string; joueur: string | null }[] {
  const vues: { url: string; joueur: string | null }[] = [];
  page.on("request", (r) => {
    if (new URL(r.url()).pathname.startsWith("/api/")) vues.push({ url: new URL(r.url()).pathname, joueur: r.headers()["x-player-id"] ?? null });
  });
  return vues;
}

/** Pas de feuille de partage (comme un ordinateur sans `navigator.share`) : le presse-papiers est simulé et garde ce qu'on lui confie dans `window.__copied`. */
async function sansFeuilleDePartage(context: BrowserContext): Promise<void> {
  await context.addInitScript(() => {
    const w = window as unknown as { __copied?: string };
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => void (w.__copied = t) } });
  });
}

/** Ce que le serveur dit du joueur de démonstration à cet instant (la vérité des attentes ci-dessous). */
async function jourDeDemo(): Promise<{ journee: number; joueur: { serie: number; points: number; rangDuJour: number | null; classesDuJour: number | null; aujourdhuiParfaite: boolean }; jeux: { etat: { statut: string; medaille?: string | null } }[] }> {
  const r = await fetch("http://127.0.0.1:8797/api/portail/jour", { headers: { "X-Player-Id": DEMO_ID } });
  return (await r.json()) as never;
}
const EMOJI: Record<string, string> = { author: "🏆", gold: "🥇", silver: "🥈", bronze: "🥉" };
const rangFr = (n: number) => (n === 1 ? "1er" : `${n}e`);
const rangEn = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;

test("portail du 24/10 (journée n° 2) : la date et la journée, les deux tuiles, « Partager ma journée » et sa ligne ; une seule requête ; FR et EN", async ({ browser }) => {
  const demo = await jourDeDemo();
  expect(demo.journee).toBe(2);
  expect(demo.joueur.rangDuJour).not.toBeNull();
  const medailleTrack = demo.jeux[0]!.etat.medaille ?? null;
  expect(demo.jeux[1]!.etat.statut).toBe("en_cours"); // Jump en cours : « Jump ⬜ » dans la ligne
  const ligne = `Du Jour #2 — Track ${medailleTrack ? EMOJI[medailleTrack] : "✅"} · Jump ⬜ — 🔥 ${demo.joueur.serie}`;

  const context = await newContextAt(browser, T24, { ...PORTRAIT, locale: "fr-FR" });
  await sansFeuilleDePartage(context);
  const page = await context.newPage();
  const vues = requetesApi(page);
  await page.goto(`${SITE_24}/?demo=joueur`);
  await expect(page.locator('[data-jeu="track"] .portail-statut')).toHaveAttribute("data-statut", "fini");
  // « Journée n° 2 » à droite de la date, sur la même ligne.
  await expect(page.locator("#date")).toHaveText("Samedi 24 octobre");
  await expect(page.locator("#journee")).toHaveText("Journée n° 2");
  const [d, j] = await Promise.all([page.locator("#date").boundingBox(), page.locator("#journee").boundingBox()]);
  expect(j!.x).toBeGreaterThan(d!.x + d!.width - 1);
  expect(Math.abs(j!.y + j!.height / 2 - (d!.y + d!.height / 2))).toBeLessThan(d!.height);
  // Les deux tuiles côte à côte : Série et Classement du jour (sa place, ses points tous jeux).
  await expect(page.locator("#serie .dj-tuile__valeur")).toHaveText(`${demo.joueur.serie} jours`);
  await expect(page.locator("#classement .dj-tuile__legende")).toHaveText("Classement du jour");
  await expect(page.locator("#classement .dj-tuile__valeur")).toHaveText(rangFr(demo.joueur.rangDuJour!));
  await expect(page.locator("#classement .dj-tuile__sous-texte")).toHaveText(`${demo.joueur.points} points, tous jeux`);
  const [a, b] = await Promise.all([page.locator("#serie").boundingBox(), page.locator("#classement").boundingBox()]);
  expect(Math.abs(a!.y - b!.y)).toBeLessThan(2);
  expect(b!.x).toBeGreaterThan(a!.x + a!.width - 1);
  expect(b!.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator("#classement")).toHaveAttribute("href", "classement/");
  // Le bouton de partage et la ligne qu'il enverra (JetBrains Mono), sous les tuiles.
  const partager = page.locator("#partager");
  await expect(partager).toHaveText("Partager ma journée");
  await expect(partager).toHaveClass(/dj-bouton--marque/);
  expect((await partager.boundingBox())!.height).toBeGreaterThanOrEqual(46);
  const apercu = page.locator("#partage-apercu");
  await expect(apercu).toHaveText(`${ligne}\n${SITE_24}/`);
  expect(await apercu.evaluate((e) => getComputedStyle(e).fontFamily)).toContain("JetBrains Mono");
  // Une seule requête à l'API au chargement, avec l'identifiant en en-tête (jamais dans l'adresse).
  await page.waitForTimeout(1500);
  expect(vues).toEqual([{ url: "/api/portail/jour", joueur: DEMO_ID }]);
  await capture(page, "portail-plein-portrait-fr");
  // Pas de feuille de partage : la ligne est copiée, avec un message de confirmation du catalogue.
  await partager.click();
  await expect(page.locator("#partage-message")).toHaveText("Ligne copiée : colle-la où tu veux.");
  expect(await page.evaluate(() => (window as unknown as { __copied?: string }).__copied)).toBe(`${ligne}\n${SITE_24}/`);
  expect(vues).toHaveLength(1); // partager ne relit rien

  await page.locator('.dj-choix-langue [data-langue="en"]').click();
  await expect(page.locator("#journee")).toHaveText("Day #2");
  await expect(page.locator("#date")).toHaveText("Saturday, October 24");
  await expect(page.locator("#classement .dj-tuile__legende")).toHaveText("Today's leaderboard");
  await expect(page.locator("#classement .dj-tuile__valeur")).toHaveText(rangEn(demo.joueur.rangDuJour!));
  await expect(page.locator("#classement .dj-tuile__sous-texte")).toHaveText(`${demo.joueur.points} points, all games`);
  await expect(partager).toHaveText("Share my day");
  await expect(apercu).toHaveText(`${ligne}\n${SITE_24}/`);
  await capture(page, "portail-plein-portrait-en");
  await partager.click();
  await expect(page.locator("#partage-message")).toHaveText("Line copied: paste it wherever you like.");
  expect(vues).toHaveLength(1);

  // Paysage : les deux cartouches côte à côte, puis les tuiles, rien ne déborde.
  const paysage = await (await newContextAt(browser, T24, { ...PAYSAGE, locale: "fr-FR" })).newPage();
  await paysage.goto(`${SITE_24}/?demo=joueur`);
  await expect(paysage.locator("#classement")).toBeVisible();
  expect(await paysage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await capture(paysage, "portail-plein-paysage-fr");
  await paysage.locator('.dj-choix-langue [data-langue="en"]').click();
  await expect(paysage.locator("#journee")).toHaveText("Day #2");
  await capture(paysage, "portail-plein-paysage-en");
});

for (const [langue, locale] of [["fr", "fr-FR"], ["en", "en-US"]] as const) {
  test(`lot I6 : accessibilité (axe) du portail plein, du profil commun et du classement du jour (${langue})`, async ({ browser }) => {
    const context = await newContextAt(browser, T24, { ...PORTRAIT, locale });
    const page = await context.newPage();
    await page.goto(`${SITE_24}/?demo=joueur`);
    await expect(page.locator('[data-jeu="track"] .portail-statut')).toHaveAttribute("data-statut", "fini");
    await expect(page.locator("html")).toHaveAttribute("lang", langue);
    await auditAxe(page, `portail-${langue}`);
    await page.goto(`${SITE_24}/profil/`);
    await expect(page.locator("#pseudo-actuel")).not.toHaveText("—");
    await expect(page.locator("#code")).toBeVisible();
    await auditAxe(page, `profil-${langue}`);
    await page.goto(`${SITE_24}/classement/`);
    await expect(page.locator("#classement-liste li")).not.toHaveCount(0);
    await auditAxe(page, `classement-${langue}`);
  });
}

test("avant le 23/10 : aucun numéro de journée, et la ligne partagée dit « Du Jour » sans numéro", async ({ browser }) => {
  // Le même serveur (le 24/10) mais un téléphone resté au 22/10 ne change rien : le numéro vient du serveur. Ici, le site du 20/10 (base vide) : pas de journée.
  const page = await (await newClockedContext(browser, { ...PORTRAIT, locale: "fr-FR" })).newPage();
  await page.goto(`${SITE_20}/`);
  await expect(page.locator("#date")).toHaveText("Mardi 20 octobre");
  await expect(page.locator("#journee")).toHaveCount(0);
});

test("joueur neuf : la tuile invite à jouer (aucun chiffre inventé), pas de bouton de partage ; la requête ne porte aucun identifiant", async ({ browser }) => {
  for (const [nom, options] of [["portrait", PORTRAIT], ["paysage", PAYSAGE]] as const) {
    for (const langue of ["fr", "en"] as const) {
      const page = await (await newContextAt(browser, T24, { ...options, locale: langue === "fr" ? "fr-FR" : "en-US" })).newPage();
      const vues = requetesApi(page);
      await page.goto(`${SITE_24}/`);
      await expect(page.locator("#journee")).toHaveText(langue === "fr" ? "Journée n° 2" : "Day #2");
      await expect(page.locator("#classement .dj-tuile__valeur")).toHaveText("—");
      await expect(page.locator("#classement .dj-tuile__sous-texte")).toHaveText(langue === "fr" ? "Finis un jeu pour entrer au classement" : "Finish a game to enter the leaderboard");
      await expect(page.locator("#serie")).toHaveCount(0);
      await expect(page.locator("#partager")).toHaveCount(0);
      expect(vues).toEqual([{ url: "/api/portail/jour", joueur: null }]);
      await capture(page, `portail-neuf-${nom}-${langue}`);
    }
  }
});

test("un joueur connu qui n'a encore fini aucun jeu aujourd'hui : la tuile l'invite à jouer, pas de bouton de partage, la série reste là", async ({ browser }) => {
  const context = await newContextAt(browser, T24, { ...PORTRAIT, locale: "fr-FR" });
  await context.addInitScript(() => {
    localStorage.setItem("cdj:player", "0123456789abcdef0123456789abcdef");
    localStorage.setItem("cdj:name", "Kiwi");
  });
  // Réponse fabriquée : un joueur du serveur sans jeu fini aujourd'hui (rang et points : rien).
  await context.route("**/api/portail/jour", async (route) => {
    const vrai = (await (await route.fetch()).json()) as { jeux: Record<string, unknown>[] };
    const corps = { ...vrai, jeux: vrai.jeux.map((j) => ({ ...j, etat: { statut: "pas_joue" } })), joueur: { pseudo: "Kiwi", serie: 3, aProlonger: true, journeesParfaites: 0, aujourdhuiParfaite: false, points: 0, rangDuJour: null, classesDuJour: null } };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corps) });
  });
  const page = await context.newPage();
  await page.goto(`${SITE_24}/`);
  await expect(page.locator("#serie .dj-tuile__valeur")).toHaveText("3 jours");
  await expect(page.locator("#classement .dj-tuile__valeur")).toHaveText("—");
  await expect(page.locator("#classement .dj-tuile__sous-texte")).toHaveText("Finis un jeu pour entrer au classement");
  await expect(page.locator("#partager")).toHaveCount(0);
});

/** Une réponse du classement fabriquée : 50 joueurs au haut, et ta ligne à la 57ᵉ place (hors du haut). Seul but : montrer la mise en page, à la place du serveur. */
function classementFabrique(): unknown {
  const medailles = ["author", "gold", "silver", "bronze", null] as const;
  const ligne = (i: number, moi = false) => ({
    rang: i,
    pseudo: moi ? "Démo" : `Joueur ${i}`,
    points: Math.max(0, 7 - Math.floor(i / 9)),
    resultats: { cdj: { rang: i, medaille: medailles[i % 5]! }, jump: i % 4 === 0 ? null : { rang: i + 1, medaille: medailles[(i + 2) % 5]! } },
    ...(moi ? {} : {}),
  });
  return {
    date: "2026-10-24",
    journee: 2,
    ouvert: true,
    bareme: { author: 4, gold: 3, silver: 2, bronze: 1 },
    jeux: [
      { jeu: "cdj", site: "track", nom: "Track" },
      { jeu: "jump", site: "jump", nom: "Jump" },
    ],
    classes: 212,
    top: Array.from({ length: 50 }, (_, i) => ligne(i + 1)),
    moi: { ...ligne(57, true), classes: 212 },
  };
}

for (const [nom, options] of [["portrait", PORTRAIT], ["paysage", PAYSAGE]] as const) {
  test(`/classement/ (${nom}) : le haut, ta ligne surlignée, la médaille de chaque jeu, le barème ; ta ligne hors du haut ; FR et EN`, async ({ browser }) => {
    const demo = await jourDeDemo();
    const context = await newContextAt(browser, T24, { ...options, locale: "fr-FR" });
    const page = await context.newPage();
    // L'identité de démonstration, puis la tuile mène à la page.
    await page.goto(`${SITE_24}/?demo=joueur`);
    await expect(page.locator("#classement .dj-tuile__valeur")).toHaveText(rangFr(demo.joueur.rangDuJour!));
    await page.locator("#classement").click();
    await expect(page).toHaveURL(`${SITE_24}/classement/`);
    await expect(page.locator("#classement-liste li")).not.toHaveCount(0);
    const vues = requetesApi(page); // la page est chargée : on compte ce que fait un nouveau chargement
    await page.reload();
    await expect(page.locator("#classement-liste li")).not.toHaveCount(0);
    await expect(page).toHaveTitle("Classement du jour");
    await expect(page.locator("h1")).toHaveText("Classement du jour");
    // Le haut du classement : tous les classés de la recette garnie (moins de 50), dans l'ordre des places.
    const total = demo.joueur.classesDuJour!;
    await expect(page.locator("#classement-compte")).toHaveText(`${total} joueurs classés`);
    await expect(page.locator("#classement-liste li")).toHaveCount(total);
    const rangs = await page.locator("#classement-liste li").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-rang"))));
    expect(rangs).toEqual(Array.from({ length: total }, (_, i) => i + 1));
    // Ta ligne : une seule, surlignée (moutarde, « Toi »), à la place du serveur, avec ton pseudo ; la médaille de chaque jeu est dite en toutes lettres.
    const moi = page.locator('#classement-liste li[data-moi="oui"]');
    await expect(moi).toHaveCount(1);
    await expect(moi).toHaveAttribute("data-rang", String(demo.joueur.rangDuJour));
    await expect(moi.locator(".classement-pseudo")).toContainText("Démo");
    await expect(moi.locator(".classement-toi")).toHaveText("Toi");
    await expect(moi.locator(".classement-points")).toHaveText(`${demo.joueur.points} pts`);
    expect(await moi.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(232, 178, 58)"); // --dj-moutarde
    await expect(moi.locator('[data-jeu="cdj"]')).toContainText(medailleTrackNom(demo));
    await expect(moi.locator('[data-jeu="jump"]')).toContainText("pas fini"); // Jump en cours : pas de médaille, dit en texte
    await expect(page.locator("#bareme")).toHaveText("Points par jeu : auteur 4, or 3, argent 2, bronze 1, fini sans médaille 0.");
    // Chaque ligne dit le nom de ses médailles (la couleur seule ne porte rien) ; les cibles tactiles (précédent / suivant) font 44 px.
    const sansNom = await page.locator("#classement-liste .dj-medaille").evaluateAll((els) => els.filter((e) => !(e.getAttribute("aria-label") ?? "").includes(":")).length);
    expect(sansNom).toBe(0);
    for (const id of ["#veille", "#lendemain"]) expect((await page.locator(id).boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // Une requête par jour affiché, avec l'identifiant en en-tête.
    expect(vues.filter((v) => v.url === "/api/portail/classement")).toEqual([{ url: "/api/portail/classement", joueur: DEMO_ID }]);
    await capture(page, `classement-${nom}-fr`);
    await page.locator('.dj-choix-langue [data-langue="en"]').click();
    await expect(page.locator("h1")).toHaveText("Today's leaderboard");
    await expect(page.locator("#classement-compte")).toHaveText(`${total} players ranked`);
    await expect(page.locator("#bareme")).toHaveText("Points per game: author 4, gold 3, silver 2, bronze 1, finished with no medal 0.");
    await expect(moi.locator(".classement-toi")).toHaveText("You");
    await expect(page.locator("#veille")).toHaveText("‹ Previous day");
    await capture(page, `classement-${nom}-en`);
    await page.locator('.dj-choix-langue [data-langue="fr"]').click();

    // Ta ligne hors du haut : séparée par « … », à sa vraie place (57ᵉ sur 212), surlignée. (Réponse fabriquée : la recette n'a pas 50 classés.)
    await page.route("**/api/portail/classement*", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(classementFabrique()) }));
    await page.reload();
    await expect(page.locator("#classement-liste li")).toHaveCount(50);
    await expect(page.locator("#classement-moi li")).toHaveCount(1); // ta ligne, à part
    await expect(page.locator("#classement-compte")).toHaveText("212 joueurs classés");
    const horsHaut = page.locator("#classement-moi");
    await expect(horsHaut.locator('li[data-moi="oui"]')).toHaveAttribute("data-rang", "57");
    await expect(horsHaut.locator(".classement-rang")).toHaveText("57");
    await expect(horsHaut.locator(".classement-coupure")).toHaveText("…");
    await expect(page.locator('#classement-liste li[data-moi="oui"]')).toHaveCount(0); // pas dans le haut
    await capture(page, `classement-hors-haut-${nom}-fr`);
    await page.locator('.dj-choix-langue [data-langue="en"]').click();
    await expect(horsHaut.locator(".classement-toi")).toHaveText("You");
    await capture(page, `classement-hors-haut-${nom}-en`);
  });
}

/** Le nom de la médaille de Track de la démonstration, tel que la page le dit (« Or », « Auteur »…, « Fini » sans médaille). */
function medailleTrackNom(demo: Awaited<ReturnType<typeof jourDeDemo>>): string {
  const m = demo.jeux[0]!.etat.medaille ?? null;
  return m ? ({ author: "Auteur", gold: "Or", silver: "Argent", bronze: "Bronze" } as Record<string, string>)[m]! : "Fini";
}

test("un jour passé dans /classement/ : « ‹ Veille » et « Lendemain › », jamais au-delà d'aujourd'hui ni avant la journée n° 1 (lot R8)", async ({ browser }) => {
  const context = await newContextAt(browser, T24, { ...PORTRAIT, locale: "fr-FR" });
  const page = await context.newPage();
  await page.goto(`${SITE_24}/?demo=joueur`);
  await expect(page.locator('[data-jeu="track"] .portail-statut')).toHaveAttribute("data-statut", "fini");
  await page.goto(`${SITE_24}/classement/`);
  await expect(page.locator("#classement-liste li")).not.toHaveCount(0);
  await expect(page.locator("#classement-date")).toHaveText("Sam. 24 oct.");
  // Aujourd'hui : on ne va pas plus loin.
  await expect(page.locator("#lendemain")).toBeDisabled();
  await expect(page.locator("#veille")).toBeEnabled();
  await expect(page.locator(".classement-ferme")).toHaveCount(0);
  const aujourdhui = await page.locator("#classement-compte").innerText();
  // La veille : un classement figé, lisible, avec les médailles de chaque jeu ; l'adresse garde le jour.
  await page.locator("#veille").click();
  await expect(page).toHaveURL(`${SITE_24}/classement/?date=2026-10-23`);
  await expect(page.locator("#classement-date")).toHaveText("Ven. 23 oct.");
  await expect(page.locator("#classement-compte")).toContainText("Jour terminé : ce classement est figé.");
  await expect(page.locator("#classement-liste li")).not.toHaveCount(0);
  await expect(page.locator("#classement-liste .dj-medaille").first()).toBeVisible();
  await expect(page.locator("#lendemain")).toBeEnabled();
  await expect(page.locator('#classement-liste li[data-moi="oui"]')).toHaveCount(1); // Démo avait fini Track ce jour-là (sa série)
  await capture(page, "classement-jour-passe-portrait-fr");
  // Recharger garde le jour ; « Lendemain › » revient à aujourd'hui (l'adresse perd le paramètre).
  await page.reload();
  await expect(page.locator("#classement-date")).toHaveText("Ven. 23 oct.");
  await page.locator("#lendemain").click();
  await expect(page).toHaveURL(`${SITE_24}/classement/`);
  await expect(page.locator("#classement-compte")).toHaveText(aujourdhui);
  // Lot R8 : les archives commencent à la journée n° 1 (ici le 23/10, épinglé par playwright.config.ts) : « ‹ Veille » est éteint ce jour-là…
  await page.goto(`${SITE_24}/classement/?date=2026-10-23`);
  await expect(page.locator("#classement-date")).toHaveText("Ven. 23 oct.");
  await expect(page.locator("#veille")).toBeDisabled();
  // …et un jour d'avant le lancement, demandé par l'adresse, est refusé par le serveur (code `unknown_day`), dit clairement.
  await page.goto(`${SITE_24}/classement/?date=2026-10-14`);
  await expect(page.locator("#classement-etat")).toHaveText("Ce jour n'a pas de classement.");
  // Un jour futur dans l'adresse : refusé par le serveur, dit clairement, rien de cassé.
  await page.goto(`${SITE_24}/classement/?date=2026-12-31`);
  await expect(page.locator("#classement-etat")).toHaveText("Ce jour n'a pas de classement.");
});

// --- « Jeu suivant du jour » à l'arrivée de chaque jeu (les vrais jeux, le vrai serveur du 20/10, base vide) ------------------------------
const circuit = dailyCircuit(TODAY);
const pilote = runPilot(circuit.track, { grip: 0.9 });
const codeTrack = encodeReplay(pilote.replay);

/** DailyTrack : court jusqu'à l'arrivée (rejeu du pilote), choisit un pseudo et attend le classement. */
async function finirTrack(page: Page, pseudo: string): Promise<void> {
  await page.goto(`${SITE_20}/track/?debug&timescale=6&api=/`);
  // Lot I6 : WebGL d'abord — sans lui le jeu ne démarre pas et l'attente de `__cdj` durait jusqu'au délai du test (Firefox de la CI, sur main).
  test.skip(!(await hasWebGL(page)), "ce navigateur n'a pas WebGL : les jeux ne démarrent pas");
  await page.waitForFunction(() => !!(window as unknown as { __cdj?: { phase?: string } }).__cdj);
  await page.evaluate((c) => (window as unknown as { __cdj: { autoplay(code: string): void } }).__cdj.autoplay(c), codeTrack);
  await page.waitForFunction(() => (window as unknown as { __cdj: { phase: string } }).__cdj.phase === "finished", undefined, { timeout: 90_000 });
  await page.locator("#finish .online input").fill(pseudo);
  await page.locator("#finish .online button[type=submit]").click();
  await expect(page.locator("#finish .online .rank")).toBeVisible();
}

/** DailyJump : joue la preuve de l'auteur (pas à pas), passe le carnage, et attend l'écran d'arrivée. */
async function finirJump(page: Page, pseudo: string | null): Promise<void> {
  await page.goto(`${SITE_20}/jump/?debug&api=/&accueil=0`);
  test.skip(!(await hasWebGL(page)), "ce navigateur n'a pas WebGL : les jeux ne démarrent pas");
  await page.waitForFunction(() => ["ready", "playing"].includes((window as unknown as { __jump?: { phase: string } }).__jump?.phase ?? ""));
  const ticks = await page.evaluate(() => {
    const j = (window as unknown as { __jump: { phase: string; manual(on: boolean): void; autoplay(): number; advance(n: number): unknown } }).__jump;
    j.manual(true);
    const n = j.autoplay();
    for (let t = 1; t <= n + 10; t++) {
      j.advance(1);
      if (j.phase === "carnage" || j.phase === "finished") return t;
    }
    return -1;
  });
  expect(ticks).toBeGreaterThan(0);
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: { input(bits: number | null): void; advance(n: number): unknown } }).__jump;
    j.input(0);
    j.advance(1);
    j.input(2);
    j.advance(1);
    j.input(null);
  });
  await expect(page.locator("#arrival")).toBeVisible();
  if (pseudo) {
    await page.locator("#arrival-name").fill(pseudo);
    await page.locator("#arrival-name-ok").click();
  }
  await expect(page.locator("#arrival-rank")).toHaveText(/sur \d+$/);
}

test("de Track vers Jump : « Jeu suivant du jour : Jump › » ; puis, Jump fini, « Journée parfaite ! » et le retour au portail", async ({ browser }) => {
  test.setTimeout(300_000);
  const pseudo = `Pilote${test.info().retry}${test.info().project.name.length}`;
  for (const [nom, options] of [["portrait", PORTRAIT], ["paysage", PAYSAGE]] as const) {
    const context = await newClockedContext(browser, { ...options, locale: "fr-FR" });
    const page = await context.newPage();
    const vues = requetesApi(page);
    await finirTrack(page, `${pseudo}${nom === "portrait" ? "A" : "B"}`);
    // L'arrivée propose le jeu suivant (une lecture de /api/portail/jour après l'envoi accepté, l'identifiant en en-tête), sans cacher ce qu'elle montre.
    const suivant = page.locator("#finish-next-game");
    await expect(suivant).toHaveText("Jeu suivant du jour : Jump ›");
    await expect(suivant).toHaveAttribute("href", "../jump/");
    expect((await suivant.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
    expect(vues.filter((v) => v.url === "/api/portail/jour")).toHaveLength(1);
    expect(vues.find((v) => v.url === "/api/portail/jour")!.joueur).toMatch(/^[0-9a-f]{32}$/);
    for (const sel of ["#finish .big", "#finish .online .rank", "#finish .actions button:first-child"]) await expect(page.locator(sel).first()).toBeVisible();
    await page.locator("#finish").evaluate((e) => e.scrollTo(0, 0));
    await capture(page, `arrivee-track-jeu-suivant-${nom}-fr`);
    // Le bouton ouvre DailyJump (même identité, même pseudo).
    await suivant.click();
    await expect(page).toHaveURL(new RegExp(`${SITE_20}/jump/`));
    await page.goto(`${SITE_20}/jump/?debug&api=/&accueil=0`); // sans la page d'accueil du jeu
    await finirJump(page, null);
    // Tous les jeux du jour sont finis : « Journée parfaite ! » et le lien « ‹ Du Jour » vers le portail.
    await expect(page.locator("#arrival-perfect")).toHaveText("Journée parfaite !");
    const retour = page.locator("#arrival-portail");
    await expect(retour).toHaveText("DU JOUR"); // lot I5 : le bouton de marque du socle, comme Track
    await expect(retour).toHaveAttribute("href", "../");
    await expect(page.locator("#arrival-next-game")).toHaveCount(0);
    expect((await retour.boundingBox())!.height).toBeGreaterThanOrEqual(43.5);
    await capture(page, `arrivee-journee-parfaite-${nom}-fr`);
    await retour.click();
    await expect(page).toHaveURL(`${SITE_20}/`);
    // Le portail le sait : journée parfaite aujourd'hui.
    await expect(page.locator("#serie .portail-serie__parfaite")).toBeVisible();
    await context.close();
  }
});

test("de Jump vers Track : « Jeu suivant du jour : Track › » à l'arrivée de DailyJump ; il ouvre DailyTrack", async ({ browser }) => {
  test.setTimeout(240_000);
  const pseudo = `Sauteur${test.info().retry}${test.info().project.name.length}`;
  for (const [nom, options] of [["portrait", PORTRAIT], ["paysage", PAYSAGE]] as const) {
    const context = await newClockedContext(browser, { ...options, locale: "fr-FR" });
    const page = await context.newPage();
    const vues = requetesApi(page);
    await finirJump(page, `${pseudo}${nom === "portrait" ? "A" : "B"}`);
    const suivant = page.locator("#arrival-next-game");
    await expect(suivant).toHaveText("Jeu suivant du jour : Track ›");
    await expect(suivant).toHaveAttribute("href", "../track/");
    expect((await suivant.boundingBox())!.height).toBeGreaterThanOrEqual(43.5); // lot I5 : le bouton de marque du socle (46 px), comme Track ; avant : 48 px
    expect(vues.filter((v) => v.url === "/api/portail/jour").length).toBeGreaterThanOrEqual(1);
    for (const id of ["replay", "share", "carnage", "home"]) expect((await page.locator(`#arrival-${id}`).boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.locator("#arrival").evaluate((e) => e.querySelector(".cadre__defile")!.scrollTo(0, 0)); // lot I5 : le cadre crème défile
    await capture(page, `arrivee-jump-jeu-suivant-${nom}-fr`);
    await suivant.click();
    await expect(page).toHaveURL(new RegExp(`${SITE_20}/track/`));
    await context.close();
  }
});

test("serveur injoignable à l'arrivée : pas de bouton, rien de bloquant", async ({ browser }) => {
  const context = await newClockedContext(browser, { ...PORTRAIT, locale: "fr-FR" });
  const page = await context.newPage();
  await context.route("**/api/portail/jour", (route) => route.abort());
  await finirTrack(page, `Muet${test.info().retry}${test.info().project.name.length}`);
  await page.waitForTimeout(1500);
  await expect(page.locator("#finish-next-game")).toHaveCount(0);
  await expect(page.locator("#finish-next")).toBeHidden();
  await expect(page.locator("#finish .actions button").first()).toBeVisible();
});
