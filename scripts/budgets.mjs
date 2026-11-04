// Lot I6 (plateforme) : les chiffres de docs/plateforme/budgets.md, mesurés comme les tests qui les gardent — Track : apps/web/e2e/perf.spec.ts (qui importe ce fichier : une seule mesure) ;
// Jump : apps/jump/e2e/poids.spec.ts ; portail : apps/portail/test/construction.test.ts (premier chargement de la page d'accueil, construction de
// production). Octets compressés (gzip, niveau par défaut de zlib pour les jeux, 9 pour le portail : la méthode de chaque test, inchangée).
//   npm run build && npm run budgets                 → les chiffres mesurés (JSON)
//   npm run budgets -- --recaler                      → (lot B1) les plafonds de docs/plateforme/budgets.md que la règle (mesure + 5 % / 10 %) donnerait aujourd'hui, pour les lignes dont la mesure a
//                                                       baissé de plus que leur marge : une PROPOSITION, rien n'est écrit (un lot l'applique quand Nathan le veut)
// Lot B1 : les plafonds sont posés une fois, en Ko ; un lot n'a plus à recopier ses chiffres dans budgets.md (le job « Budgets » compare, il ne relève jamais).
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { mesureTower as mesureTowerDetail } from "../apps/tower/tools/mesure.mjs";
import { mesureDecor } from "../apps/web/e2e/mesureDecor.mjs";
import { FICHES_CI, ficheCI } from "./fiches-lecture.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const gz = (f, level) => gzipSync(readFileSync(f), level === undefined ? {} : { level }).length;

/**
 * Les fichiers (JS et CSS) que `index.html` demande, comme un navigateur : le script d'entrée, les `modulepreload`, les feuilles de style et, de proche en proche, les imports
 * **statiques** de chaque module (`from"./x.js"`, `import"./x.js"`). Un morceau chargé par `import()` (et les fils de travail) n'y est jamais, quel que soit son nom. Les noms sont
 * relatifs à `assets/` (`dist` = le dossier des fichiers construits, `index.html` est à côté).
 */
export function graphePremierChargement(dist, entrees = []) {
  const html = readFileSync(join(dist, "../index.html"), "utf8");
  const vus = new Set();
  const file = [...html.matchAll(/(?:src|href)="\.\/assets\/([^"]+\.(?:js|css))"/g)].map((m) => m[1]).concat(entrees);
  while (file.length) {
    const f = file.shift();
    if (vus.has(f)) continue;
    vus.add(f);
    if (f.endsWith(".js")) for (const m of readFileSync(join(dist, f), "utf8").matchAll(/\bfrom\s*"\.\/([^"]+\.js)"|\bimport\s*"\.\/([^"]+\.js)"/g)) file.push(m[1] ?? m[2]);
  }
  return [...vus];
}

/**
 * Track — **la seule mesure du premier chargement** (lot de plateforme « suites de Track » ; `apps/web/e2e/perf.spec.ts` l'importe, aucune autre copie) : ce que charge un joueur
 * (`graphePremierChargement`), pas « tout `dist/assets` moins quelques préfixes ». `js` : le JS du premier chargement ; `css` ; `jsCss` ; `three` (three.js, dans son propre fichier) ;
 * `horsThree` : le code du jeu. À part (à la demande, chacun son plafond) : `anglais` (catalogue anglais), `miniatures` (fil de travail des circuits), `salon` (fil du Salon) et
 * `admin` (la page d'administration, `admin-*.js` : jamais chargée par un joueur, **hors** du premier chargement). `fichiers` : la liste du premier chargement ; `gz` : tous les JS.
 */
export function mesureTrack(dist = join(ROOT, "apps/web/dist/assets")) {
  const tous = readdirSync(dist).filter((f) => f.endsWith(".js"));
  const gz1 = (f) => gz(join(dist, f));
  const somme = (fichiers) => fichiers.reduce((n, f) => n + gz1(f), 0);
  const fichiers = graphePremierChargement(dist);
  const js = somme(fichiers.filter((f) => f.endsWith(".js")));
  const css = somme(fichiers.filter((f) => f.endsWith(".css")));
  const three = somme(fichiers.filter((f) => f.startsWith("three-")));
  const un = (p) => somme(tous.filter((f) => f.startsWith(p) && !fichiers.includes(f)));
  return {
    js,
    css,
    jsCss: js + css,
    three,
    horsThree: js - three,
    anglais: un("catalogue.en-"),
    miniatures: un("circuitWorker-"),
    salon: un("salonWorker-"),
    admin: un("admin-"),
    polices: polices(dist),
    fichiers,
    gz: Object.fromEntries(tous.map((f) => [f, gz1(f)])),
  };
}

/** Jump : JS du premier chargement (hors catalogue anglais, `tune`, `verify`, le menu à la manette `manette-*` (lot M1 : à la première manette), l'écran des commandes `commandesEcran-*` et sa feuille `commandes-*.css` (lot M2 : à la première ouverture de Réglages › Commandes) et la page d'outils `admin-*` : jamais chargée par un joueur) + CSS (feuilles et style écrit dans la page). */
export function mesureJump(dist = join(ROOT, "apps/jump/dist/assets")) {
  const js = readdirSync(dist).filter((f) => f.endsWith(".js"));
  // Lot « musique » : le lecteur (`demarrage-`) et le panneau des réglages (`panneauMusique-`) sont chargés à la demande, au premier geste : ligne `musique.lecteur`. Lot M1 : `manette-` aussi ; lot M2 : `commandesEcran-` (l'écran Commandes).
  const aLaDemande = (f) => ["catalogue.en-", "tune-", "verify-", "admin-", "interrupteur-", "manette-", "commandesEcran-", "demarrage-", "panneauMusique-", "liensCommunauteJeu-", "classementAmis-", "course-", "retoursJeu-", "message-", "suite-", "versionJeu-", "simuler-"].some((p) => f.startsWith(p)); // lot K3 : message- et suite- = les briques du kit (message en direct, jeu suivant) chargées par `import()` ; lot D2 : versionJeu- et simuler- = le bandeau « Nouvelle version en ligne » (brique du kit) et les essais `?debug&simuler=`, chargés par `import()` ; lot F2 : classementAmis- = les amis du classement, course- = la barre de la course du n° 1 (à la demande ; mesure alignée sur `apps/jump/e2e/poids.spec.ts`, qui exclut aussi interrupteur-)
  const total = js.filter((f) => !aLaDemande(f)).reduce((n, f) => n + gz(join(dist, f)), 0);
  const html = readFileSync(join(dist, "../index.html"), "utf8");
  const style = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].reduce((n, m) => n + gzipSync(m[1]).length, 0);
  const css = readdirSync(dist).filter((f) => f.endsWith(".css") && !f.startsWith("admin-") && !f.startsWith("interrupteur-") && !f.startsWith("manette-") && !f.startsWith("commandes-") && !f.startsWith("panneauMusique-") && !f.startsWith("liensCommunauteJeu-") && !f.startsWith("classementAmis-") && !f.startsWith("course-") && !f.startsWith("retoursJeu-") && !f.startsWith("versionJeu-")).reduce((n, f) => n + gz(join(dist, f)), 0) + style;
  return { js: total, css, jsCss: total + css, anglais: js.filter((f) => f.startsWith("catalogue.en-")).reduce((n, f) => n + gz(join(dist, f)), 0), polices: polices(dist) };
}

/**
 * Tower (lots R15 et TP) — **le premier chargement est l'accueil seul** (`/tower/`, lot T4 : l'interface du socle, l'identité, la lecture du serveur, le catalogue français et le contenu du jour
 * que l'accueil charge dès qu'il est dessiné ; ni Three.js, ni la partie, ni Rapier) ; le jeu (la scène, la partie, le HUD, l'arrivée) est **à la demande** : `tower.jeu`. Le détail du graphe
 * d'imports est dans `apps/tower/tools/mesure.mjs` (`detail`) ; ici les nombres que garde `apps/tower/e2e/poids.spec.ts`. Hors de la mesure, à la demande : la physique (le JavaScript de
 * Rapier et son `.wasm` : `physique`), le catalogue anglais, l'aide de l'iPhone, l'interrupteur, la démonstration du banc (jamais en production). Les chiffres vont dans
 * `docs/plateforme/budgets.md` (lignes `tower.*`).
 */
// Lot K1 : les lignes du grand tableau de `budgets.md` que mesure `mesureTower` sont celles de la fiche du jeu (`budget.lignes` de `config/jeux/tower.json`) ; les plafonds restent dans `budgets.md`.
export const LIGNES_TOWER = ficheCI("tower").budget;
/** Lot K1c : les lignes de Track (quatorze, dont celles « à la demande »), lues dans sa fiche (la mesure reste `mesureTrack`, le graphe de `index.html` ; les plafonds, dans `budgets.md`). */
export const LIGNES_TRACK = ficheCI("track").budget;
/** Lot K1b : les lignes de Jump, lues dans sa fiche comme celles de Tower (la mesure reste `mesureJump`, propre à son découpage ; les plafonds, dans `budgets.md`). */
export const LIGNES_JUMP = ficheCI("jump").budget;
export function mesureTower(dist = join(ROOT, "apps/tower/dist/assets")) {
  const detail = mesureTowerDetail(dist);
  return {
    js: detail.accueil.js,
    css: detail.accueil.css,
    jsCss: detail.accueil.total,
    jeu: detail.jeu.total,
    physique: detail.physique,
    physiqueWasm: detail.physiqueWasm,
    anglais: detail.anglais,
    polices: polices(dist),
    fichiers: detail.accueil.fichiers,
    detail,
  };
}

/**
 * Lot K4e — **un jeu neuf se mesure sans qu'on écrive sa mesure** : les trois jeux livrés ont chacun la leur (`mesureTrack`, `mesureJump`, `mesureTower` : leur découpage est propre), tout autre jeu des fiches
 * est mesuré par `mesureJeuNeuf`. Premier chargement = le JS et le CSS que le joueur charge d'emblée, **hors de ce que les briques du kit chargent à la demande** (`A_LA_DEMANDE_PAR_DEFAUT` : catalogue anglais,
 * interrupteur, manette, commandes, musique, plaques de la communauté, amis du classement, retours, message en direct, jeu suivant, outils `?debug`) ; sa fiche peut ajouter les siens (`budget.aLaDemande` : des
 * préfixes de fichiers, `essai-` pour `essai-<empreinte>.js`) — c'est le champ de fiche « sa façon de mesurer son chargement ».
 */
export const JEUX_A_MESURE_PROPRE = ["track", "jump", "tower"];
export const A_LA_DEMANDE_PAR_DEFAUT = ["catalogue.en-", "interrupteur-", "manette-", "commandesEcran-", "demarrage-", "panneauMusique-", "liensCommunauteJeu-", "classementAmis-", "amisClassement-", "retoursJeu-", "message-", "suite-", "tune-", "verify-", "admin-"];
/** Les lignes de budget qu'un jeu neuf obtient d'office (les autres demandent leur propre mesure). */
export const LIGNES_DE_JEU_NEUF = ["jsCss", "anglais", "polices"];
export function mesureJeuNeuf(fiche, dist = join(ROOT, "apps", fiche.app, "dist/assets")) {
  if (!existsSync(join(dist, "../index.html"))) return null; // pas construit : aucune mesure
  const aLaDemande = (f) => [...A_LA_DEMANDE_PAR_DEFAUT, ...(fiche.budgetALaDemande ?? [])].some((p) => f.startsWith(p));
  const js = readdirSync(dist).filter((f) => f.endsWith(".js"));
  const total = js.filter((f) => !aLaDemande(f)).reduce((n, f) => n + gz(join(dist, f)), 0);
  const html = readFileSync(join(dist, "../index.html"), "utf8");
  const style = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].reduce((n, m) => n + gzipSync(m[1]).length, 0);
  const css = readdirSync(dist).filter((f) => f.endsWith(".css") && !aLaDemande(f)).reduce((n, f) => n + gz(join(dist, f)), 0) + style;
  return { jsCss: total + css, anglais: js.filter((f) => f.startsWith("catalogue.en-")).reduce((n, f) => n + gz(join(dist, f)), 0), polices: polices(dist) };
}
/** Les jeux des fiches qui se mesurent par `mesureJeuNeuf`. */
export const jeuxNeufs = () => FICHES_CI.filter((f) => !JEUX_A_MESURE_PROPRE.includes(f.id));
/** Les lignes de budget de ces jeux (`<id>.jsCss`…) : celles de leur fiche ; une ligne que `mesureJeuNeuf` ne sait pas mesurer est une erreur claire (un champ de fiche à ajouter), jamais un silence. */
export function lignesDesJeuxNeufs() {
  return jeuxNeufs().flatMap((f) =>
    f.budget.map((ligne) => {
      const nom = ligne.slice(f.id.length + 1);
      if (!LIGNES_DE_JEU_NEUF.includes(nom)) throw new Error(`fiche « ${f.id} » : la ligne de budget « ${ligne} » n'a pas de mesure (un jeu neuf obtient d'office ${LIGNES_DE_JEU_NEUF.map((n) => `${f.id}.${n}`).join(", ")}) : ajoute sa mesure à scripts/budgets.mjs`);
      return ligne;
    }),
  );
}

/**
 * Lot « musique » : le lecteur et le panneau des réglages, **à la demande** (chargés au premier geste, jamais dans le premier chargement d'un jeu), mesurés dans la construction d'un jeu
 * (le même morceau pour les trois : `demarrage-*.js`, `panneauMusique-*.js` et sa feuille). Le poids des morceaux eux-mêmes (non comptés dans les jeux) se lit dans `musique/servi/`.
 */
export function mesureMusique(dist = join(ROOT, "apps/web/dist/assets"), servi = join(ROOT, "musique/servi")) {
  const tous = readdirSync(dist);
  const somme = (liste) => liste.reduce((n, f) => n + gz(join(dist, f)), 0);
  const lecteur = tous.filter((f) => /^demarrage-.*\.js$/.test(f));
  const panneau = tous.filter((f) => f.startsWith("panneauMusique-"));
  const morceaux = existsSync(servi) ? readdirSync(servi).filter((f) => f.endsWith(".m4a")) : [];
  return { lecteur: somme(lecteur), panneau: somme(panneau), jsCss: somme(lecteur) + somme(panneau), morceaux: morceaux.length, octetsMorceaux: morceaux.reduce((n, f) => n + statSync(join(servi, f)).size, 0) };
}

/**
 * Lot C1 : le dialogue « Un bug ? Une idée ? » **à la demande** (le module `retoursJeu-*` d'un jeu : le dialogue, son vocabulaire français et anglais, le client des routes, sa feuille), chargé au toucher de
 * l'entrée de la pause ou de Réglages : jamais dans le premier chargement d'un jeu. Mesuré dans la construction de Track ; ligne `retours.dialogue`. (Jump compte tous ses fichiers hors liste : `retoursJeu-` y est exclu.)
 */
export function mesureRetours(dist = join(ROOT, "apps/web/dist/assets")) {
  const fichiers = readdirSync(dist).filter((f) => f.startsWith("retoursJeu-"));
  return { jsCss: fichiers.reduce((n, f) => n + gz(join(dist, f)), 0), fichiers };
}

/** Les polices qu'une construction déclare (octets des fichiers woff2, déjà compressés), lues dans ses feuilles. */
function polices(dist) {
  const faces = new Set();
  for (const f of readdirSync(dist).filter((x) => x.endsWith(".css"))) for (const m of readFileSync(join(dist, f), "utf8").matchAll(/url\(["']?([^)"']+\.woff2)["']?\)/g)) faces.add(m[1].replace(/^\/?(assets\/)?/, "").replace(/^\.\//, ""));
  return [...faces].reduce((n, f) => n + readFileSync(join(dist, f)).length, 0);
}

/** Portail : la page d'accueil, ses scripts (et leurs imports statiques) et ses feuilles, hors polices (construction de production). */
export function mesurePortail() {
  const tmp = mkdtempSync(join(tmpdir(), "budgets-"));
  try {
    execFileSync("npx", ["vite", "build", "-c", "apps/portail/vite.config.ts", "--logLevel", "error", "--outDir", tmp, "--emptyOutDir"], {
      cwd: ROOT,
      env: { ...process.env, VITE_CONFIG_NATIVE_IGNORE_WARNING: "true", PORTAIL_VITRINE: "0", PORTAIL_TEMOINS: "0" }, // la production : ni la vitrine, ni un jeu témoin (lot K4f)
      stdio: "pipe",
    });
    const html = readFileSync(join(tmp, "index.html"), "utf8");
    const vus = new Set();
    const file = [...html.matchAll(/<(?:script[^>]*\ssrc|link[^>]*\srel="(?:stylesheet|modulepreload)"[^>]*\shref)="\.\/([^"]+)"/g)].map((m) => m[1]);
    while (file.length) {
      const f = file.shift();
      if (vus.has(f)) continue;
      vus.add(f);
      if (f.endsWith(".js")) for (const m of readFileSync(join(tmp, f), "utf8").matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/g)) file.push(join(dirname(f), m[1]));
    }
    // Les polices que déclarent les feuilles de la page d'accueil (comme construction.test.ts).
    const faces = new Set();
    for (const f of vus) if (f.endsWith(".css")) for (const m of readFileSync(join(tmp, f), "utf8").matchAll(/url\(["']?\.?\/?([^)"']+\.woff2)["']?\)/g)) faces.add(join(dirname(f), m[1]));
    return { premierChargement: ["index.html", ...vus].reduce((n, f) => n + gz(join(tmp, f), 9), 0), polices: [...faces].reduce((n, f) => n + readFileSync(join(tmp, f)).length, 0) };
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * Lot R17 — Track, ce que le joueur charge **à la demande** : pour chaque entrée (le nom des morceaux d'un module), le JS de ses morceaux et, de proche en proche, de ce qu'ils importent
 * hors du premier chargement (le code déjà chargé par le premier écran ne compte pas : il est déjà là). Une seule implémentation : le contrôle des budgets (`scripts/budgets-controle.mjs`) et
 * les specs de composition de `apps/web/e2e/perf.spec.ts` (rien dans le premier chargement, le module existe) l'appellent.
 */
export function aLaDemandeTrack(entrees, dist = join(ROOT, "apps/web/dist/assets"), base = mesureTrack(dist)) {
  const vus = new Set();
  const file = readdirSync(dist).filter((f) => entrees.test(f));
  while (file.length) {
    const f = file.pop();
    if (vus.has(f) || base.fichiers.includes(f)) continue;
    vus.add(f);
    for (const m of readFileSync(join(dist, f), "utf8").matchAll(/(?:from|import)\s*["']\.\/([^"']+\.js)["']/g)) file.push(m[1]);
  }
  return { octets: [...vus].reduce((n, f) => n + base.gz[f], 0), fichiers: [...vus] };
}

/** Les voitures de Track dont les boucles de moteur (`<id>-*.m4a`, huit chacune) sont servies à la demande (une voiture n'en charge que huit). */
export const VOITURES_TRACK = ["civile", "fourgon", "evolution", "rallye", "gt", "roadster", "pickup", "proto", "muscle", "monoplace"];

/** Lot R17 — les lignes « à la demande » de Track (`track.*` de budgets.md) : clé → les morceaux qui la composent. */
export const ENTREES_TRACK_A_LA_DEMANDE = {
  "track.vieCiel": /^(vieJeu|cielJeu)-.*\.js$/,
  "track.ombres": /^ombres3-.*\.js$/,
  "track.palier2": /^finitionJeu-.*\.js$/,
  "track.qualiteMesure": /^qualiteMesure-.*\.js$/,
  "track.post": /^postJeu-.*\.js$/,
  "track.garage": /^garage-.*\.js$/,
  "track.fantomes": /^fantomesJeu-.*\.js$/,
  "track.son": /^extension-.*\.js$/,
  "track.steerSlider": /^steerSlider-.*\.js$/,
  "track.steerWheel": /^steerWheel-.*\.js$/,
  "track.steerGyro": /^steerGyro-.*\.js$/,
  "track.touchReglages": /^touchReglages-.*\.js$/,
};

/**
 * Lot R17 — **toutes les lignes de `docs/plateforme/budgets.md`, en une mesure** : `{ "track.jsCss": 296875, … }`, après `npm run build` (les trois jeux) ; le portail se construit à part
 * (`mesurePortail`). Même méthode que les tests qui gardaient ces lignes avant le lot R17 (ils n'imposent plus aucune limite : le contrôle est `scripts/budgets-controle.mjs`). Les clés de
 * `CLES_MESUREES` sont celles du tableau, moins `partage.image` (il faut Chromium pour dessiner les images : `scripts/images-partage.mjs`, `apps/web/e2e/domaine.spec.ts`).
 */
export const CLES_MESUREES = [
  "portail.premier", "portail.polices",
  "track.jsCss", "track.js", "track.horsThree", "track.anglais", "track.miniatures", "track.salon", "track.admin", "track.decor", "track.palier2", "track.vieCiel", "track.post", "track.qualiteMesure", "track.garage", "track.polices",
  "track.ombres", "track.fantomes", "track.son", "track.sonBoucles", "track.steerSlider", "track.steerWheel", "track.steerGyro", "track.touchReglages",
  "jump.jsCss", "jump.anglais", "jump.polices",
  "tower.jsCss", "tower.jeu", "tower.physique", "tower.anglais", "tower.polices", "tower.decors", "tower.habits",
  "musique.lecteur", "retours.dialogue",
  // Lot K4e : les lignes des jeux neufs, lues dans leurs fiches (vide tant qu'aucun jeu neuf n'existe).
  ...lignesDesJeuxNeufs(),
];

export function mesuresParLigne({ portail = mesurePortail } = {}) {
  const t = mesureTrack();
  const jump = mesureJump();
  const tower = mesureTower();
  const lignes = {
    "portail.premier": null,
    "portail.polices": null,
    "track.jsCss": t.jsCss,
    "track.js": t.js,
    "track.horsThree": t.horsThree,
    "track.anglais": t.anglais,
    "track.miniatures": t.miniatures,
    "track.salon": t.salon,
    "track.admin": t.admin,
    "track.decor": mesureDecor().total,
    "track.polices": t.polices,
    "jump.jsCss": jump.jsCss,
    "jump.anglais": jump.anglais,
    "jump.polices": jump.polices,
    "tower.jsCss": tower.jsCss,
    "tower.jeu": tower.jeu,
    "tower.physique": tower.physique,
    "tower.anglais": tower.anglais,
    "tower.polices": tower.polices,
    "tower.decors": tower.detail.decors,
    "tower.habits": tower.detail.habits,
    "musique.lecteur": mesureMusique().jsCss,
    "retours.dialogue": mesureRetours().jsCss,
  };
  // Lot K4e : chaque jeu neuf des fiches, par sa mesure d'office (`null` s'il n'est pas construit : le job « Budgets » construit tout d'abord).
  for (const f of jeuxNeufs()) {
    const m = mesureJeuNeuf(f);
    for (const ligne of f.budget) lignes[ligne] = m ? m[ligne.slice(f.id.length + 1)] : null;
  }
  for (const [cle, entrees] of Object.entries(ENTREES_TRACK_A_LA_DEMANDE)) lignes[cle] = aLaDemandeTrack(entrees, undefined, t).octets;
  // « track.sonBoucles » : les huit boucles de moteur de la voiture la plus lourde (octets des fichiers AAC, déjà compressés).
  const dist = join(ROOT, "apps/web/dist/assets");
  const boucles = readdirSync(dist).filter((f) => f.endsWith(".m4a"));
  lignes["track.sonBoucles"] = Math.max(0, ...VOITURES_TRACK.map((id) => boucles.filter((f) => f.startsWith(`${id}-`)).reduce((n, f) => n + statSync(join(dist, f)).size, 0)));
  const p = portail();
  lignes["portail.premier"] = p.premierChargement;
  lignes["portail.polices"] = p.polices;
  return lignes;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain && process.argv.includes("--recaler")) {
  for (const app of ["web", "jump"]) if (!existsSync(join(ROOT, "apps", app, "dist/index.html"))) throw new Error(`apps/${app} n'est pas construit : npm run build`);
  await (await import("./budgets-controle.mjs")).recalerCli(mesuresParLigne());
} else if (isMain) {
  for (const app of ["web", "jump"]) if (!existsSync(join(ROOT, "apps", app, "dist/index.html"))) throw new Error(`apps/${app} n'est pas construit : npm run build`);
  const { fichiers, gz: _tous, ...track } = mesureTrack();
  const { fichiers: _t, ...tower } = existsSync(join(ROOT, "apps/tower/dist/index.html")) ? mesureTower() : { fichiers: [] };
  console.log(JSON.stringify({ track, jump: mesureJump(), tower, portail: mesurePortail(), musique: mesureMusique() }, null, 2));
}
