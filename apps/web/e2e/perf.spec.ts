import { readdirSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { aLaDemandeTrack, mesureTrack } from "../../../scripts/budgets.mjs";
// @ts-expect-error — module JavaScript (mesure du décor, lot 44), sans déclarations
import { THEMES_DECOR, mesureDecor } from "./mesureDecor.mjs";

// Chargement rapide sur mobile. **Lot R17 : les plafonds de poids ne sont plus ici** — ils sont dans `docs/plateforme/budgets.md` (la seule source) et contrôlés par le job « Budgets » de la CI
// (`scripts/budgets-controle.mjs`) sur toute PR qui touche ce que charge un joueur, qu'un spec de Track tourne ou non. Ce fichier ne garde que la **composition** du chargement (ce qui est ou n'est
// pas dans le premier chargement : un morceau à la demande qui y reviendrait) et ce qu'un navigateur seul mesure (le temps de chargement sur un téléphone simulé).
const dist = new URL("../dist/assets/", import.meta.url);

/**
 * Le poids du premier chargement : **une seule mesure** (lot de plateforme « suites de Track »), `mesureTrack` de `scripts/budgets.mjs` — la même que `node scripts/budgets.mjs` et que
 * le tableau de `docs/plateforme/budgets.md`. Le premier chargement est ce que `index.html` demande (le script d'entrée, les `modulepreload`, les feuilles et, de proche en proche, les
 * imports statiques) ; tout ce que le jeu charge par `import()` (le générateur de circuits, les scénarios d'essai, la démo, le Salon et le spectateur, l'anglais, le réglage de conduite
 * `?debug&tune`) et les fils de travail n'en font pas partie, quel que soit le nom que le constructeur leur donne. La page d'admin (`admin-*.js`, jamais chargée par un joueur) non plus :
 * elle a sa ligne et son plafond (test plus bas).
 */
test("le premier chargement : ni la bibliothèque de figures ni three.js dans le mauvais fichier (les plafonds : job « Budgets »)", () => {
  const m: { js: number; css: number; three: number; fichiers: string[]; gz: Record<string, number> } = mesureTrack();
  const { js: total, css, three, fichiers: premier } = m;
  test.info().annotations.push({ type: "mesure", description: `premier chargement : JS ${total} + CSS ${css} = ${total + css} o (hors page d'admin, mesureTrack de scripts/budgets.mjs)` });
  // Lot 36 : le générateur et sa bibliothèque de figures ne reviennent pas dans le premier chargement (ils se calculent dans le fil de travail, ou dans un morceau chargé à
  // la demande) : aucun fichier du premier chargement ne contient les noms de la bibliothèque.
  for (const f of premier) expect(readFileSync(new URL(f, dist), "utf8"), `${f} : la bibliothèque de figures est dans le premier chargement`).not.toContain("Rétrécissement et virage");
  expect(
    readdirSync(dist).filter((f) => f.endsWith(".js") && !premier.includes(f) && readFileSync(new URL(f, dist), "utf8").includes("Rétrécissement et virage")),
    "la bibliothèque de figures est chargée à la demande (fils de travail, morceau de génération)",
  ).not.toHaveLength(0);
  expect(three, "three.js doit rester dans son propre fichier (cache entre déploiements)").toBeGreaterThan(100_000);
});

// La page d'administration (`admin-*.js`, lot 14) n'est jamais chargée par un joueur : elle n'est pas dans le premier chargement (son plafond est la ligne `track.admin` du job « Budgets »).
test("la page d'admin est à part et hors du premier chargement", () => {
  const { admin, fichiers } = mesureTrack() as { admin: number; fichiers: string[] };
  expect(fichiers.filter((f) => f.startsWith("admin-")), "la page d'admin n'est pas chargée par le premier écran").toEqual([]);
  expect(admin, "page d'admin (admin-*.js), compressée").toBeGreaterThan(0);
});

/**
 * Lot 46 : ce que chargent les pas d'un module à la demande — ses morceaux et, de proche en proche, ceux qu'ils importent hors du premier chargement. Lot R17 : une seule implémentation,
 * celle du job « Budgets » (`aLaDemandeTrack` de `scripts/budgets.mjs`) ; ici on n'en lit que les fichiers (le poids est une ligne de budgets.md).
 */
const aLaDemande = (entrees: RegExp): { octets: number; fichiers: string[] } => aLaDemandeTrack(entrees);

// Lot 46 : la vie et le ciel du palier 3 (et du groupe « vie et ciel » des téléphones récents), à la demande, hors du premier chargement : 8 ko au plus (énoncé du
// lot, docs/plateforme/budgets.md). Les ombres fines (pas « ombres », un réglage du compositeur) ont leur module à part, minuscule.
test("la vie et le ciel, à la demande : rien dans le premier chargement", () => {
  const { fichiers: premier } = mesureTrack() as { fichiers: string[] };
  expect(premier.filter((f) => /^(vieJeu|cielJeu|ombres3|lumiere3|vie|drapeaux)-/.test(f)), "aucun module des pas dans le premier chargement").toEqual([]);
  const vieCiel = aLaDemande(/^(vieJeu|cielJeu)-.*\.js$/);
  test.info().annotations.push({ type: "mesure", description: `vie et ciel à la demande : ${vieCiel.octets} o (${vieCiel.fichiers.join(", ")})` });
  expect(vieCiel.fichiers.length, "les deux modules sont construits à part").toBeGreaterThanOrEqual(2);
  expect(aLaDemande(/^ombres3-.*\.js$/).fichiers.length, "les ombres fines, à la demande : un morceau à part").toBeGreaterThanOrEqual(1);
});

// Lot 45 : le palier 2 (le pas « finition » : géométrie, variété, matière sobre, traces, reflets ciblés), à la demande, hors du premier chargement : 7 000 o au
// plus (énoncé du lot : 6 000 o ; relevé à 7 000 o par Nathan le 23/10/2026 — les rebords complets, ≈ 1,2 ko, n'étaient pas comptés dans les 5,0 ko de la 38b).
// La mesure de la règle de qualité (`qualiteMesure`) : à la demande aussi (première visite, chaque semaine), petite.
test("le palier 2, à la demande : rien dans le premier chargement ; la mesure de la règle de qualité aussi", () => {
  const { fichiers: premier } = mesureTrack() as { fichiers: string[] };
  expect(premier.filter((f) => /^(finitionJeu|finition|matiere|reflets|rebordsComplets|uvMonde|qualiteMesure)-/.test(f)), "rien du palier 2 ni de la mesure dans le premier chargement").toEqual([]);
  const palier2 = aLaDemande(/^finitionJeu-.*\.js$/);
  test.info().annotations.push({ type: "mesure", description: `palier 2 à la demande : ${palier2.octets} o (${palier2.fichiers.join(", ")})` });
  expect(palier2.fichiers.length, "le module de la finition est construit à part").toBeGreaterThanOrEqual(1);
  expect(aLaDemande(/^qualiteMesure-.*\.js$/).fichiers.length, "la mesure de la règle de qualité, à la demande : un morceau à part").toBeGreaterThanOrEqual(1);
});

// Lot 47 : le post-traitement du palier 3 (halo, étalonnage, FXAA ; ordinateur seulement), à la demande, hors du premier chargement : 7 000 o au plus (énoncé du lot :
// « 7 ko compressés au plus »). **Ni occlusion GTAO ni SMAA** : aucun morceau ne les contient, FXAA y est. Lot 50 : la ligne ne grossit pas (≈ 5 ko : une seule passe
// de fin, plus aucune passe de three.js dans le morceau du jeu ; la chaîne du lot 47, gardée le temps du lot pour le banc, est un morceau à part que le jeu ne charge pas).
test("le post-traitement, à la demande : rien dans le premier chargement, FXAA seul (ni GTAO ni SMAA)", () => {
  const { fichiers: premier } = mesureTrack() as { fichiers: string[] };
  expect(premier.filter((f) => /^(postJeu|post|lineaire|themesPost)-/.test(f)), "rien du post-traitement dans le premier chargement").toEqual([]);
  for (const f of premier.filter((x) => x.endsWith(".js"))) expect(readFileSync(new URL(f, dist), "utf8"), `${f} : une passe de post-traitement dans le premier chargement`).not.toMatch(/FXAAShader|UnrealBloomPass|Etalonnage|LuminosityHighPassShader/);
  const post = aLaDemande(/^postJeu-.*\.js$/);
  test.info().annotations.push({ type: "mesure", description: `post-traitement à la demande : ${post.octets} o (${post.fichiers.join(", ")})` });
  expect(post.fichiers.length, "le module du post-traitement est construit à part").toBeGreaterThanOrEqual(1);
  const code = post.fichiers.map((f) => readFileSync(new URL(f, dist), "utf8")).join("\n");
  expect(code, "FXAA (dans la passe de fin)").toContain("#ifdef FXAA");
  expect(code, "lot 50 : aucune passe de three.js dans le morceau du jeu").not.toMatch(/FXAAShader|UnrealBloomPass|OutputShader|LuminosityHighPass/);
  for (const f of readdirSync(dist).filter((x) => x.endsWith(".js"))) expect(readFileSync(new URL(f, dist), "utf8"), `${f} : ni GTAO ni SMAA`).not.toMatch(/GTAO|SMAA/);
});

// Lot 41 (ligne ajoutée par le lot de plateforme « suites de Track 2 ») : le Garage, à la demande, hors du premier chargement : `garage-*.js` et ce qu'il tire hors du
// premier chargement (les modèles des voitures et le morceau `voiture`, déjà à la demande, ne sont pas dans cette ligne : ils sont chargés par `import()`). 10 000 o au plus
// (≈ 8,3 ko après le lot 42 : studio de lumière, reflet plan, vignettes et textes fr + en, couleur du motif).
test("le Garage, à la demande : rien dans le premier chargement", () => {
  const { fichiers: premier } = mesureTrack() as { fichiers: string[] };
  expect(premier.filter((f) => /^garage-/.test(f)), "rien du Garage dans le premier chargement").toEqual([]);
  const garage = aLaDemande(/^garage-.*\.js$/);
  test.info().annotations.push({ type: "mesure", description: `Garage à la demande (JS) : ${garage.octets} o (${garage.fichiers.join(", ")})` });
  expect(garage.fichiers.length, "le morceau du Garage est construit à part").toBeGreaterThanOrEqual(1);
});

// Lot 55 : le choix des fantômes (cases du classement, compteur, rediffusions choisies, cycle du bouton), à la demande, hors du premier chargement. 6 000 o au plus (≈ 4,1 ko de JS
// et 0,9 ko de feuille de style) : une ligne du tableau de `budgets.md` serait à ajouter par un lot de plateforme (le test qui la garde est dans `apps/portail`).
test("le choix des fantômes, à la demande : rien dans le premier chargement", () => {
  const { fichiers: premier } = mesureTrack() as { fichiers: string[] };
  expect(premier.filter((f) => /^fantomesJeu-/.test(f)), "rien du choix des fantômes dans le premier chargement").toEqual([]);
  const fantomes = aLaDemande(/^fantomesJeu-.*\.js$/);
  test.info().annotations.push({ type: "mesure", description: `choix des fantômes à la demande (JS) : ${fantomes.octets} o (${fantomes.fichiers.join(", ")})` });
  expect(fantomes.fichiers.length, "le morceau du choix des fantômes est construit à part").toBeGreaterThanOrEqual(1);
});

// Lot 55 (partie B) : le nouveau son (moteur de la voiture, boîte virtuelle, dix profils, pneus, bruitages, compresseur), à la demande, au premier geste, hors du premier chargement : seul un
// crochet reste dans `audio.ts` (≈ +370 o, ligne `track.jsCss`). Le code : 10 000 o au plus compressés (≈ 8,4 ko) ; les boucles de moteur ne sont **jamais** dans le premier chargement, et
// **une voiture n'en charge que huit** (≈ 67 ko de fichiers AAC) : 80 ko au plus par voiture. Le « plafond de l'audio à la demande » est une proposition à Nathan (`budgets.md`, ligne à ajouter
// par un lot de plateforme : le test qui la garde est dans `apps/portail`).
test("le nouveau son, à la demande : huit boucles par voiture, rien dans le premier chargement", () => {
  const { fichiers: premier } = mesureTrack() as { fichiers: string[] };
  expect(premier.filter((f) => /^extension-|\.m4a$/.test(f)), "rien du nouveau son dans le premier chargement").toEqual([]);
  const son = aLaDemande(/^extension-.*\.js$/);
  test.info().annotations.push({ type: "mesure", description: `nouveau son à la demande (JS) : ${son.octets} o (${son.fichiers.join(", ")})` });
  expect(son.fichiers.length, "le morceau du nouveau son est construit à part").toBeGreaterThanOrEqual(1);
  const boucles = readdirSync(dist).filter((f) => /\.m4a$/.test(f));
  for (const id of ["civile", "fourgon", "evolution", "rallye", "gt", "roadster", "pickup", "proto", "muscle", "monoplace"]) {
    const siennes = boucles.filter((f) => f.startsWith(`${id}-`));
    expect(siennes, `huit boucles pour ${id}`).toHaveLength(8);
  }
});

// Lot 52 : les trois modes de direction tactiles (glissière, volant, gyroscope) et les réglages tactiles de Réglages › Commandes, à la demande, hors du premier chargement : les
// boutons, mode par défaut, restent dans le premier chargement (≤ +1 ko, ligne `track.jsCss`). Chaque mode : sa logique, son dessin, ses réglages, ses textes (fr + en) et sa feuille de
// style (le CSS n'est pas dans cette mesure, comme celle du Garage : `steer*.css`, 0,4 à 0,8 ko compressés chacun). Plafonds = mesure + 20 %, arrondis à 100 o (docs/plateforme/budgets.md,
// section « Lot 52 »).
test("les modes de direction tactiles, à la demande : rien dans le premier chargement, un morceau chacun", () => {
  const { fichiers: premier } = mesureTrack() as { fichiers: string[] };
  expect(premier.filter((f) => /^(steerSlider|steerWheel|steerGyro|steerMath|touchReglages)-/.test(f)), "aucun mode de direction dans le premier chargement").toEqual([]);
  const mesure = (entree: RegExp, nom: string) => {
    const m = aLaDemande(entree);
    test.info().annotations.push({ type: "mesure", description: `${nom} à la demande : ${m.octets} o (${m.fichiers.join(", ")})` });
    expect(m.fichiers.length, `${nom} : un morceau à part`).toBeGreaterThanOrEqual(1);
    return m.octets;
  };
  mesure(/^steerSlider-.*\.js$/, "glissière");
  mesure(/^steerWheel-.*\.js$/, "volant");
  mesure(/^steerGyro-.*\.js$/, "gyroscope");
  mesure(/^touchReglages-.*\.js$/, "réglages tactiles");
});

// Lot I4 : les polices. Au plus 150 ko (charte § 4), servies par un chemin unique et absolu (`/assets/…`, les mêmes fichiers que le portail : un joueur qui vient du portail les a
// déjà en cache), et seules les deux faces du premier écran sont préchargées.
test("les polices : chemin du site partagé avec le portail, deux faces préchargées", () => {
  const css = readdirSync(dist).filter((f) => f.endsWith(".css"));
  const faces = new Set<string>();
  for (const f of css) for (const m of readFileSync(new URL(f, dist), "utf8").matchAll(/url\(["']?([^)"']+\.woff2)["']?\)/g)) faces.add(m[1]!);
  expect(faces.size, "Archivo Black, Archivo 400 et 700, JetBrains Mono 700, Barlow Condensed 600, 700 italique et 800 italique").toBe(7);
  for (const face of faces) {
    expect(face, "les polices sont servies par /assets/ (la racine du site, comme le portail), pas relativement à la page").toMatch(/^\/assets\/[a-z-]+-latin-\d+-(normal|italic)-[\w-]+\.woff2$/);
  }
  const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  const precharges = [...html.matchAll(/<link rel="preload" as="font" type="font\/woff2" crossorigin href="([^"]+)"/g)].map((m) => m[1]!);
  expect(precharges.map((p) => p.replace(/^\/assets\//, "").replace(/-[\w-]{8}\.woff2$/, "")).sort()).toEqual(["archivo-latin-400-normal", "barlow-condensed-latin-800-italic"]);
  for (const p of precharges) expect(faces.has(p), `${p} : le préchargement vise le même chemin que la feuille`).toBe(true);
});

test("le fil de travail du Salon pèse peu (une copie de sim : générateur et pilote, chargée seulement dans le Salon)", () => {
  const files = readdirSync(dist).filter((f) => f.startsWith("salonWorker-") && f.endsWith(".js"));
  expect(files).toHaveLength(1);
  // Il ne retarde pas le premier écran (téléchargé en parallèle, calcul hors du fil principal) : plafond relevé à 32 000 o par Nathan le 22/10/2026 (docs/plateforme/budgets.md).
});

// Lot 44 : la ligne « décor 3D à la demande » (docs/plateforme/budgets.md, décision de Nathan du 23/10/2026 : 16 ko) — le décor du palier 1, un morceau par thème
// et un morceau commun, chargés à la demande (`src/scene/decor.ts`) : rien n'en est dans le premier chargement ; les huit ensemble (le commun une fois), et chaque thème.
test("le décor 3D à la demande : chaque thème à part, rien dans le premier chargement", () => {
  const m: { total: number; commun: number; parTheme: Record<string, { seul: number; avecCommun: number; fichiers: string[] }>; dansPremier: string[] } = mesureDecor();
  test.info().annotations.push({ type: "mesure", description: `décor : ${m.total} o pour les huit thèmes (commun ${m.commun} o) ; ${Object.entries(m.parTheme).map(([t, v]) => `${t} ${v.avecCommun}`).join(", ")}` });
  expect(m.dansPremier, "le décor n'est pas dans le premier chargement").toEqual([]);
  expect(Object.keys(m.parTheme).sort()).toEqual([...THEMES_DECOR].sort());
  for (const [t, v] of Object.entries(m.parTheme)) expect(v.fichiers.length, `${t} : son morceau et le morceau commun`).toBeGreaterThanOrEqual(2);
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
