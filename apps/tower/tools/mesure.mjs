// Lot T4 — la mesure du poids de Tower avec le jeu À LA DEMANDE derrière l'accueil. `scripts/budgets.mjs` (`mesureTower`, zone de la plateforme) compte encore le jeu dans le premier chargement ;
// la mise à jour de cette mesure est au cahier des charges du lot de plateforme. D'ici là, `apps/tower/e2e/poids.spec.ts` lit celle-ci. Octets compressés (gzip niveau 9), comme tout le dépôt.
//   - `accueil` (ligne `tower.jsCss`) : le premier chargement = le graphe d'imports statiques de `index.html` (l'accueil : interface, identité, lecture du serveur, catalogue français) + le morceau du
//     CONTENU DU JOUR que l'accueil charge dès qu'il est dessiné (`preparation-*`, le générateur : il écrit les paliers du jour) + leurs feuilles. Aucune scène, aucune partie, aucune physique.
//   - `jeu` (ligne `tower.jeu`) : ce que JOUER charge en plus, à la demande — la scène (Three.js), la partie, le HUD, la pause, l'arrivée — sans la physique, sans l'anglais.
//   - `physique`, `anglais`, `polices` : comme avant (`tower.physique`, `tower.anglais`, `tower.polices`).
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const ICI = dirname(fileURLToPath(import.meta.url));
export const DIST = join(ICI, "../dist/assets");
const gz = (f, dist) => gzipSync(readFileSync(join(dist, f)), { level: 9 }).length;

/** Les fichiers JS atteints en suivant les imports statiques (`from "./x.js"`) depuis `entrees` ; `deja` : ce qu'on ne recompte pas. */
function graphe(dist, entrees, deja = new Set()) {
  const vus = new Set();
  const file = [...entrees];
  while (file.length) {
    const f = file.shift();
    if (vus.has(f) || deja.has(f)) continue;
    vus.add(f);
    if (f.endsWith(".js")) for (const m of readFileSync(join(dist, f), "utf8").matchAll(/\bfrom\s*"\.\/([^"]+\.js)"|\bimport\s*"\.\/([^"]+\.js)"/g)) file.push(m[1] ?? m[2]);
  }
  return vus;
}

/** Les feuilles d'un morceau : la feuille porte le nom de son morceau (`jeu-*.css`), le premier chargement lit aussi celles que la page déclare. */
function feuilles(tous, js) {
  return tous.filter((c) => c.endsWith(".css") && js.some((f) => c.startsWith(`${f.replace(/-[\w-]{8}\.js$/, "")}-`)));
}

export function mesureTower(dist = DIST) {
  const tous = readdirSync(dist);
  const html = readFileSync(join(dist, "../index.html"), "utf8");
  const dePage = [...html.matchAll(/(?:src|href)="\.\/assets\/([^"]+\.(?:js|css))"/g)].map((m) => m[1]);
  const premier = new Set([...graphe(dist, dePage.filter((f) => f.endsWith(".js")))]);
  const contenu = tous.filter((f) => /^preparation-.*\.js$/.test(f));
  for (const f of graphe(dist, contenu, premier)) premier.add(f);
  const jsPremier = [...premier].filter((f) => f.endsWith(".js"));
  const cssPremier = [...new Set([...dePage.filter((f) => f.endsWith(".css")), ...feuilles(tous, jsPremier)])];
  const entreeJeu = tous.filter((f) => /^jeu-.*\.js$/.test(f));
  const jsJeu = [...graphe(dist, entreeJeu, premier)].filter((f) => f.endsWith(".js"));
  const cssJeu = feuilles(tous, jsJeu).filter((c) => !cssPremier.includes(c));
  const somme = (liste) => liste.reduce((n, f) => n + gz(f, dist), 0);
  const physique = tous.filter((f) => /^rapier-.*\.(js|wasm)$/.test(f));
  return {
    accueil: { js: somme(jsPremier), css: somme(cssPremier), total: somme(jsPremier) + somme(cssPremier), fichiers: [...jsPremier, ...cssPremier] },
    jeu: { js: somme(jsJeu), css: somme(cssJeu), total: somme(jsJeu) + somme(cssJeu), fichiers: [...jsJeu, ...cssJeu] },
    physique: somme(physique),
    physiqueWasm: somme(physique.filter((f) => f.endsWith(".wasm"))),
    anglais: somme(tous.filter((f) => f.startsWith("catalogue.en-"))),
    polices: tous.filter((f) => f.endsWith(".woff2")).length ? polices(dist, tous) : 0,
  };
}

/** Les polices que le CSS déclare (octets des fichiers woff2, déjà compressés). */
function polices(dist, tous) {
  const faces = new Set();
  for (const f of tous.filter((x) => x.endsWith(".css"))) for (const m of readFileSync(join(dist, f), "utf8").matchAll(/url\(["']?([^)"']+\.woff2)["']?\)/g)) faces.add(m[1].replace(/^\/?(assets\/)?/, "").replace(/^\.\//, ""));
  return [...faces].reduce((n, f) => n + readFileSync(join(dist, f)).length, 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) console.log(JSON.stringify(mesureTower(), null, 2));
