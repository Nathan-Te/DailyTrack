// Lot I6 (plateforme) : les chiffres de docs/plateforme/budgets.md, mesurés comme les tests qui les gardent — Track : apps/web/e2e/perf.spec.ts (qui importe ce fichier : une seule mesure) ;
// Jump : apps/jump/e2e/poids.spec.ts ; portail : apps/portail/test/construction.test.ts (premier chargement de la page d'accueil, construction de
// production). Octets compressés (gzip, niveau par défaut de zlib pour les jeux, 9 pour le portail : la méthode de chaque test, inchangée).
//   npm run build && node scripts/budgets.mjs        → les chiffres, à recopier dans docs/plateforme/budgets.md
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

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

/** Jump : JS du premier chargement (hors catalogue anglais, `tune`, `verify`, le menu à la manette `manette-*` (lot M1 : à la première manette) et la page d'outils `admin-*` : jamais chargée par un joueur) + CSS (feuilles et style écrit dans la page). */
export function mesureJump(dist = join(ROOT, "apps/jump/dist/assets")) {
  const js = readdirSync(dist).filter((f) => f.endsWith(".js"));
  const aLaDemande = (f) => ["catalogue.en-", "tune-", "verify-", "admin-", "interrupteur-", "manette-"].some((p) => f.startsWith(p));
  const total = js.filter((f) => !aLaDemande(f)).reduce((n, f) => n + gz(join(dist, f)), 0);
  const html = readFileSync(join(dist, "../index.html"), "utf8");
  const style = [...html.matchAll(/<style>([\s\S]*?)<\/style>/g)].reduce((n, m) => n + gzipSync(m[1]).length, 0);
  const css = readdirSync(dist).filter((f) => f.endsWith(".css") && !f.startsWith("admin-") && !f.startsWith("interrupteur-") && !f.startsWith("manette-")).reduce((n, f) => n + gz(join(dist, f)), 0) + style;
  return { js: total, css, jsCss: total + css, anglais: js.filter((f) => f.startsWith("catalogue.en-")).reduce((n, f) => n + gz(join(dist, f)), 0), polices: polices(dist) };
}

/**
 * Tower (lot R15) — le premier chargement de **la page du jeu** (`/tower/`), mesuré comme Track (`graphePremierChargement`, gzip par défaut) : l'aiguillage `main-*.js` charge
 * le jeu par `import()`, donc le graphe de `index.html` seul ne dirait rien (1 ko) ; on y ajoute le fichier du jeu (`jeu-*.js`) et ce qu'il importe statiquement, avec la feuille
 * de chaque morceau (la feuille d'un morceau porte son nom : `jeu-*.css`). **Hors de la mesure, à la demande** : la physique (le JavaScript de Rapier et son `.wasm`, deux
 * fichiers : `physique`), le catalogue anglais, l'aide de l'iPhone, la démonstration du banc (`demo-*`, `?scenario=banc`, jamais en production) et `verify`. Les chiffres vont dans
 * `docs/plateforme/budgets.md` (lignes `tower.*`) ; `apps/tower/e2e/poids.spec.ts` les garde.
 */
export const LIGNES_TOWER = ["tower.jsCss", "tower.physique", "tower.anglais", "tower.polices"];
export function mesureTower(dist = join(ROOT, "apps/tower/dist/assets")) {
  const tous = readdirSync(dist);
  const gz1 = (f) => gz(join(dist, f));
  const jeu = tous.filter((f) => /^jeu-.*\.js$/.test(f));
  const fichiers = graphePremierChargement(dist, jeu);
  const css = tous.filter((c) => c.endsWith(".css") && fichiers.some((f) => f.endsWith(".js") && c.startsWith(`${f.replace(/-[\w-]{8}\.js$/, "")}-`)));
  const js = fichiers.filter((f) => f.endsWith(".js"));
  const somme = (liste) => liste.reduce((n, f) => n + gz1(f), 0);
  const physique = tous.filter((f) => /^rapier-.*\.(js|wasm)$/.test(f));
  return {
    js: somme(js),
    css: somme(css),
    jsCss: somme(js) + somme(css),
    physique: somme(physique),
    physiqueWasm: somme(physique.filter((f) => f.endsWith(".wasm"))),
    anglais: somme(tous.filter((f) => f.startsWith("catalogue.en-"))),
    polices: polices(dist),
    fichiers: [...js, ...css],
  };
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
      env: { ...process.env, VITE_CONFIG_NATIVE_IGNORE_WARNING: "true", PORTAIL_VITRINE: "0" },
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

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  for (const app of ["web", "jump"]) if (!existsSync(join(ROOT, "apps", app, "dist/index.html"))) throw new Error(`apps/${app} n'est pas construit : npm run build`);
  const { fichiers, gz: _tous, ...track } = mesureTrack();
  const { fichiers: _t, ...tower } = existsSync(join(ROOT, "apps/tower/dist/index.html")) ? mesureTower() : { fichiers: [] };
  console.log(JSON.stringify({ track, jump: mesureJump(), tower, portail: mesurePortail() }, null, 2));
}
