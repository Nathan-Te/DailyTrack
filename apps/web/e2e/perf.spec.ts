import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { mesureTrack } from "../../../scripts/budgets.mjs";
// @ts-expect-error — module JavaScript (mesure du décor, lot 44), sans déclarations
import { THEMES_DECOR, mesureDecor } from "./mesureDecor.mjs";

// Chargement rapide sur mobile : budgets de poids (déterministes) et de temps (larges, la CI est variable).
const dist = new URL("../dist/assets/", import.meta.url);

/**
 * Le poids du premier chargement : **une seule mesure** (lot de plateforme « suites de Track »), `mesureTrack` de `scripts/budgets.mjs` — la même que `node scripts/budgets.mjs` et que
 * le tableau de `docs/plateforme/budgets.md`. Le premier chargement est ce que `index.html` demande (le script d'entrée, les `modulepreload`, les feuilles et, de proche en proche, les
 * imports statiques) ; tout ce que le jeu charge par `import()` (le générateur de circuits, les scénarios d'essai, la démo, le Salon et le spectateur, l'anglais, le réglage de conduite
 * `?debug&tune`) et les fils de travail n'en font pas partie, quel que soit le nom que le constructeur leur donne. La page d'admin (`admin-*.js`, jamais chargée par un joueur) non plus :
 * elle a sa ligne et son plafond (test plus bas).
 */
test("le jeu pèse peu : budget de poids compressé", () => {
  const m: { js: number; css: number; three: number; horsThree: number; anglais: number; miniatures: number; fichiers: string[]; gz: Record<string, number> } = mesureTrack();
  const { js: total, css, three, horsThree, anglais, miniatures: worker, fichiers: premier, gz } = m;
  test.info().annotations.push({ type: "mesure", description: `premier chargement : JS ${total} + CSS ${css} = ${total + css} o (hors page d'admin, mesureTrack de scripts/budgets.mjs)` });
  // Lot 36 : le générateur et sa bibliothèque de figures ne reviennent pas dans le premier chargement (ils se calculent dans le fil de travail, ou dans un morceau chargé à
  // la demande) : aucun fichier du premier chargement ne contient les noms de la bibliothèque.
  for (const f of premier) expect(readFileSync(new URL(f, dist), "utf8"), `${f} : la bibliothèque de figures est dans le premier chargement`).not.toContain("Rétrécissement et virage");
  expect(
    readdirSync(dist).filter((f) => f.endsWith(".js") && !premier.includes(f) && readFileSync(new URL(f, dist), "utf8").includes("Rétrécissement et virage")),
    "la bibliothèque de figures est chargée à la demande (fils de travail, morceau de génération)",
  ).not.toHaveLength(0);
  expect(three, "three.js doit rester dans son propre fichier (cache entre déploiements)").toBeGreaterThan(100_000);
  // Lot I4 (budget de la phase 3) : premier chargement ≤ aujourd'hui + 20 ko de JS et de CSS compressés. « Aujourd'hui » = le lot R4 : 260,2 ko de JS (le « 259 ko » du lot)
  // et 3,8 ko de CSS, soit 264,1 ko ; le lot I4 ajoute le socle (@cdj/ui : composants, jetons), le catalogue français, la langue, les nouveaux écrans et leurs feuilles.
  // Les plafonds ne comptent plus la page d'admin (lot de plateforme « suites de Track », décision de Nathan du 22/10/2026) : −10 800 o chacun (admin-*.js, 10 882 o), la marge de Track reste la même.
  expect(total + css, `JS ${total} + CSS ${css} compressés : ${JSON.stringify(gz)}`).toBeLessThan(264_100 + 27_500); // lot 43 : +15 000 o, décision de Nathan du 23/10/2026 (le palier 1 de la scène entre en jeu : docs/plateforme/budgets.md) ; lot 35 : +1 000 o autorisés par Nathan (la page d'admin « Médailles », alors comptée) ; lot I7 : +1 024 o autorisés par Nathan (le plein écran et la caméra en vue) ; lot 34 : +1 276 o autorisés par Nathan (freinage après les boosts, dans le générateur : docs/plateforme/budgets.md)
  expect(total, `JS compressé : ${JSON.stringify(gz)}`).toBeLessThan(280_200); // lot 43 : +15 000 o, décision de Nathan du 23/10/2026 (le palier 1 de la scène) ; −10 800 o (page d'admin sortie du décompte) ; lot 35 : +1 000 o autorisés par Nathan ; lot 34 : +1 000 o autorisés par Nathan (freinage après les boosts) ; ≈ 271,5 ko au lot I4 (lot I4 : +11,3 ko, hors catalogue anglais et réglage de conduite) ; ≈ 260,2 ko au lot R4 (lot 30 : +5,4 ko, synchronisation du profil, pseudos réservés, code de transfert CDJ2, changer son code ; lot 29 : +8,7 ko, accueil, réglages à onglets, aide, profil, classement compact, trois bus sonores ; lot 28 : +3,1 ko ; lot 26 : +10 ko, le Salon ; lot 23 : +5,6 ko ; lot 20 : +7 ko, la bibliothèque de figures ; lot 18 : +5 ko, cuves ; lot 17 : +4 ko ; lot 14 : +10 ko, planning et panneau d'admin ; lot 9 : +8 ko ; lot 13 : +5 ko de miniatures ; budget du lot 9 : ≤ 300 ko ajoutés)
  expect(horsThree, "le code du jeu et de la simulation, hors three.js").toBeLessThan(147_500); // lot 43 : +15 000 o, décision de Nathan du 23/10/2026 (le palier 1 de la scène) ; −10 800 o (page d'admin sortie du décompte) ; lot 35 : +1 000 o autorisés par Nathan ; lot 34 : +1 300 o autorisés par Nathan (freinage après les boosts) ; ≈ 138,7 ko au lot I4 (lot I4 : +15 ko) ; ≈ 123,7 ko au lot R4 (lot 30 : +4,1 ko ; lot 29 : +10 ko ; lot 28 : +3,1 ko ; lot 26 : +10 ko ; lot 23 : +5,6 ko ; lot 22 : +6 ko ; lot 20 : +7 ko ; lots 17 et 18 : +10 ko)
  expect(anglais, "le catalogue anglais, chargé à la demande").toBeLessThan(8_000); // ≈ 6,6 ko aujourd'hui
  // Le fil de travail des circuits (lots 13 et 36) ne se charge qu'à la demande du premier circuit : budget à part (une copie de sim : générateur et pilote). Il ne retarde pas le premier
  // écran (téléchargé en parallèle, calcul hors du fil principal) : plafond relevé à 30 000 o par Nathan le 22/10/2026 (docs/plateforme/budgets.md).
  expect(worker, "fil de travail des miniatures (une copie de sim : générateur et pilote), chargé à la demande").toBeLessThan(30_000); // ≈ 26,5 ko aujourd'hui (lot 21 : +2 ko, bas-côtés, route bosselée, règles d'identité des thèmes, moments de choix) ; ≈ 22,4 ko au lot 20 (+5,6 ko, les figures) ; ≈ 16,7 ko avant ( (lot 18 : +3 ko, les cuves du générateur et du pilote ; lot 17 : +3,6 ko, le générateur et le pilote ont grandi) ; lot 34 : +600 o autorisés par Nathan (la règle de freinage du générateur)
});

// La page d'administration (`admin-*.js`, lot 14) n'est jamais chargée par un joueur : elle n'est pas dans le premier chargement, mais elle a son plafond pour ne pas grossir sans qu'on le voie
// (lot de plateforme « suites de Track » : mesure + 15 %, arrondi à 500 o).
test("la page d'admin est à part, avec son plafond, et hors du premier chargement", () => {
  const { admin, fichiers } = mesureTrack() as { admin: number; fichiers: string[] };
  expect(fichiers.filter((f) => f.startsWith("admin-")), "la page d'admin n'est pas chargée par le premier écran").toEqual([]);
  expect(admin, "page d'admin (admin-*.js), compressée").toBeGreaterThan(0);
  expect(admin, "page d'admin (admin-*.js), compressée").toBeLessThan(12_500); // ≈ 10,9 ko aujourd'hui
});

// Lot I4 : les polices. Au plus 150 ko (charte § 4), servies par un chemin unique et absolu (`/assets/…`, les mêmes fichiers que le portail : un joueur qui vient du portail les a
// déjà en cache), et seules les deux faces du premier écran sont préchargées.
test("les polices : au plus 150 ko, chemin du site partagé avec le portail, deux faces préchargées", () => {
  const css = readdirSync(dist).filter((f) => f.endsWith(".css"));
  const faces = new Set<string>();
  for (const f of css) for (const m of readFileSync(new URL(f, dist), "utf8").matchAll(/url\(["']?([^)"']+\.woff2)["']?\)/g)) faces.add(m[1]!);
  expect(faces.size, "Archivo Black, Archivo 400 et 700, JetBrains Mono 700, Barlow Condensed 600, 700 italique et 800 italique").toBe(7);
  let octets = 0;
  for (const face of faces) {
    expect(face, "les polices sont servies par /assets/ (la racine du site, comme le portail), pas relativement à la page").toMatch(/^\/assets\/[a-z-]+-latin-\d+-(normal|italic)-[\w-]+\.woff2$/);
    octets += readFileSync(new URL(`.${face}`, new URL("../dist/", import.meta.url))).length;
  }
  expect(octets, `polices : ${(octets / 1024).toFixed(1)} ko`).toBeLessThanOrEqual(150 * 1024); // ≈ 136,3 Ko
  const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  const precharges = [...html.matchAll(/<link rel="preload" as="font" type="font\/woff2" crossorigin href="([^"]+)"/g)].map((m) => m[1]!);
  expect(precharges.map((p) => p.replace(/^\/assets\//, "").replace(/-[\w-]{8}\.woff2$/, "")).sort()).toEqual(["archivo-latin-400-normal", "barlow-condensed-latin-800-italic"]);
  for (const p of precharges) expect(faces.has(p), `${p} : le préchargement vise le même chemin que la feuille`).toBe(true);
});

test("le fil de travail du Salon pèse peu (une copie de sim : générateur et pilote, chargée seulement dans le Salon)", () => {
  const files = readdirSync(dist).filter((f) => f.startsWith("salonWorker-") && f.endsWith(".js"));
  expect(files).toHaveLength(1);
  // Il ne retarde pas le premier écran (téléchargé en parallèle, calcul hors du fil principal) : plafond relevé à 32 000 o par Nathan le 22/10/2026 (docs/plateforme/budgets.md).
  expect((mesureTrack() as { salon: number }).salon).toBeLessThan(32_000); // ≈ 28,5 ko aujourd'hui
});

// Lot 44 : la ligne « décor 3D à la demande » (docs/plateforme/budgets.md, décision de Nathan du 23/10/2026 : 16 ko) — le décor du palier 1, un morceau par thème
// et un morceau commun, chargés à la demande (`src/scene/decor.ts`) : rien n'en est dans le premier chargement ; les huit ensemble (le commun une fois), et chaque thème.
test("le décor 3D à la demande : chaque thème à part, 16 ko au plus pour les huit, rien dans le premier chargement", () => {
  const m: { total: number; commun: number; parTheme: Record<string, { seul: number; avecCommun: number; fichiers: string[] }>; dansPremier: string[] } = mesureDecor();
  test.info().annotations.push({ type: "mesure", description: `décor : ${m.total} o pour les huit thèmes (commun ${m.commun} o) ; ${Object.entries(m.parTheme).map(([t, v]) => `${t} ${v.avecCommun}`).join(", ")}` });
  expect(m.dansPremier, "le décor n'est pas dans le premier chargement").toEqual([]);
  expect(Object.keys(m.parTheme).sort()).toEqual([...THEMES_DECOR].sort());
  for (const [t, v] of Object.entries(m.parTheme)) expect(v.fichiers.length, `${t} : son morceau et le morceau commun`).toBeGreaterThanOrEqual(2);
  expect(m.total, "décor 3D à la demande, les huit thèmes (gzip)").toBeLessThan(16_000); // ≈ 12,2 ko aujourd'hui (lot 44)
});

test.describe("chargement sur un téléphone simulé", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "CDP : Chromium seulement");

  test("écran de chargement immédiat, jeu prêt en quelques secondes (processeur ×4, 4G lente)", async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const t0 = Date.now();
    await page.goto("/?debug", { waitUntil: "commit" });
    await page.waitForFunction(() => window.__cdj?.phase, undefined, { timeout: 30_000 });
    const readyMs = Date.now() - t0;
    const fcp = await page.evaluate(() => performance.getEntriesByName("first-contentful-paint")[0]?.startTime ?? -1);
    test.info().annotations.push({ type: "mesure", description: `FCP ${Math.round(fcp)} ms, prêt ${readyMs} ms` });
    expect(fcp, "le premier affichage (écran de chargement) ne doit pas attendre le JavaScript").toBeGreaterThan(0);
    expect(fcp).toBeLessThan(2500);
    expect(readyMs).toBeLessThan(8000); // ≈ 1,9 s mesuré en local
    await expect(page.locator("#splash")).toHaveCount(0); // retiré après le premier rendu
    await context.close();
  });
});
