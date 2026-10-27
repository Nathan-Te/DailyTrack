// La CI de PR courte (lot R10) : ce que le lot touche décide ce qui tourne. Un seul module, utilisé par le job `scope` de .github/workflows/ci.yml
// et par `npm run verifier` (scripts/verifier.mjs) — l'agent lance donc en local EXACTEMENT les mêmes tests que la CI de sa PR.
//   git diff --name-only origin/main...HEAD | node scripts/ci-zones.mjs [--mode pr|complet|nuit]   → lignes `clé=valeur` pour $GITHUB_OUTPUT
//   node scripts/ci-zones.mjs --durees-unitaires sortie-vitest.json                                  → réécrit scripts/unit-durees.json
//
// 1. e2e : la table spec → zones (`e2e/zones.json`, testée par apps/web/test/ciZones.test.ts). Une zone = des motifs de chemins ; un fichier
//    modifié lance les specs dont une zone le contient, plus la FUMÉE de chaque jeu touché (quelques specs rapides : le jeu démarre, se construit,
//    rejoue). Un spec modifié se lance lui-même ; un utilitaire de test modifié (fixtures, layout…) lance ses importeurs (la fumée s'il y en a plus de 12).
// 2. unitaires : les tests des zones touchées. Le graphe est LU dans le code (imports et chemins cités entre `packages/*`, `apps/*` et `scripts`) :
//    un dossier de tests tourne si le dossier modifié fait partie de ce qu'il atteint. Un document ou un fichier de configuration n'en lance que les
//    tests qui le LISENT (chemin cité près d'une lecture). Configuration racine (package.json, verrou, tsconfig, vitest) : tous.
// 3. « docs seuls » : une modification qui ne touche que `docs/**` ou des `*.md` ne lance rien (les jobs de verdict réussissent), sauf les tests qui
//    lisent ce document (`docsLusParLesTests`).
// 4. Les parts : les fichiers (specs ou tests) sont posés du plus long au plus court sur la part la moins chargée (assignParts), 4 parts e2e et 4 parts
//    unitaires au plus.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { assignParts } from "./e2e-parts.mjs";
import { categoriesOf } from "./ci-scope.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const E2E_DIRS = { web: "apps/web/e2e", jump: "apps/jump/e2e" };
export const PARTS_E2E_MAX = 4;
export const PARTS_UNITAIRES_MAX = 4;
/** Durée visée d'une part (secondes de la CI) : au-delà, on ajoute une part (dans la limite du maximum). */
export const CIBLE_PART_E2E_S = 240;
export const CIBLE_PART_UNITAIRE_S = 150;
export const DEFAUT_UNITAIRE_S = 5;
export const MAX_IMPORTEURS = 12;
/**
 * Budget de la CI de PR : somme des durées (durees.json) des specs choisis, hors fumée et specs modifiés par la PR (toujours lancés). 900 s en
 * 4 parts ≈ 4 min de tests + 45 s de préparation. Au-delà, les specs les moins liés aux fichiers modifiés sont reportés à la CI complète de `main`
 * (et nommés dans le résumé du run) : une PR large reste courte, et rien n'est perdu — c'est reporté.
 */
export const BUDGET_E2E_S = 900;

const norm = (p) => String(p).trim().replace(/\\/g, "/").replace(/^(\.\/)+/, "");
const estOutil = (fichier) => /^(captures|mesure)[-.]/.test(posix.basename(fichier));
const estDoc = (f) => f.startsWith("docs/") || /\.md$/i.test(f);
const SOURCES = /\.(m?[tj]s|tsx)$/;
const IGNORES = new Set(["node_modules", "dist", ".git", "blob-report", "test-results", "playwright-report", "site", ".cache"]);

function globVersRegExp(glob) {
  const re = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*");
  return new RegExp(`^${re}$`);
}

/** Tous les fichiers sous `dir` (chemins relatifs à la racine, séparateurs `/`), sans les dossiers générés. */
export function lister(racine, dir, filtre = () => true) {
  const out = [];
  const marcher = (rel) => {
    for (const e of readdirSync(join(racine, rel), { withFileTypes: true })) {
      if (IGNORES.has(e.name)) continue;
      const chemin = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) marcher(chemin);
      else if (filtre(chemin)) out.push(chemin);
    }
  };
  if (existsSync(join(racine, dir))) marcher(dir);
  return out.sort();
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// 1. La table spec → zones

export function chargerTable(racine = ROOT) {
  const t = JSON.parse(readFileSync(join(racine, "e2e/zones.json"), "utf8"));
  const zones = Object.fromEntries(
    Object.entries(t.zones).map(([nom, z]) => [nom, { globs: z.globs.map(globVersRegExp), sauf: (z.sauf ?? []).map(globVersRegExp), source: z }]),
  );
  return { ...t, compilees: zones };
}

/** Les zones qui contiennent ce fichier. */
export function zonesDuFichier(fichier, table) {
  const f = norm(fichier);
  return Object.keys(table.compilees).filter((n) => {
    const z = table.compilees[n];
    return z.globs.some((re) => re.test(f)) && !z.sauf.some((re) => re.test(f));
  });
}

/** Les specs d'un jeu (`web` | `jump`) : noms de fichiers, sans les outils (captures, mesures : ils se sautent d'eux-mêmes). */
export function specsDuJeu(jeu, racine = ROOT) {
  return lister(racine, E2E_DIRS[jeu], (f) => f.endsWith(".spec.ts") && f.split("/").length === 4)
    .map((f) => posix.basename(f))
    .filter((f) => !estOutil(f));
}

/** Les specs du dossier qui importent cet utilitaire (`./fixtures` pour `fixtures.ts`). */
export function importeursDe(jeu, utilitaire, racine = ROOT) {
  const base = posix.basename(utilitaire).replace(/\.(m?ts|mjs|js)$/, "");
  const re = new RegExp(`from\\s+["']\\./${base}(\\.[a-z]+)?["']|import\\(\\s*["']\\./${base}(\\.[a-z]+)?["']`);
  return specsDuJeu(jeu, racine).filter((s) => re.test(readFileSync(join(racine, E2E_DIRS[jeu], s), "utf8")));
}

/**
 * Les specs e2e à lancer pour ces fichiers modifiés. Rend `{ web: [...], jump: [...], raisons: [...] }` (listes triées, sans doublon).
 *  - un spec modifié se lance ; un utilitaire de test modifié lance ses importeurs (la fumée s'il y en a plus de MAX_IMPORTEURS) ;
 *  - un fichier dans une zone lance les specs de cette zone ; tout fichier de code (hors documents) lance la fumée de son jeu (zone partagée : des deux).
 */
export function specsPour(files, table, racine = ROOT, { budget = BUDGET_E2E_S } = {}) {
  const sur = { web: new Set(), jump: new Set() }; // toujours lancés : fumée, specs modifiés, importeurs d'un utilitaire modifié
  const liens = { web: new Map(), jump: new Map() }; // spec → nombre de couples (fichier modifié, zone) qui le lient à la PR
  const raisons = new Set();
  const tous = { web: specsDuJeu("web", racine), jump: specsDuJeu("jump", racine) };
  const fumee = (jeu, pourquoi) => {
    for (const s of table.fumee[jeu]) sur[jeu].add(s);
    raisons.add(`fumée ${jeu} (${pourquoi})`);
  };
  for (const brut of files) {
    const f = norm(brut);
    if (!f || estDoc(f)) continue;
    const m = /^apps\/(web|jump)\/e2e\/([^/]+)$/.exec(f);
    if (m) {
      const jeu = m[1];
      const nom = m[2];
      if (nom.endsWith(".spec.ts")) {
        if (!estOutil(nom) && tous[jeu].includes(nom)) sur[jeu].add(nom);
        raisons.add(`${jeu}/${nom} (modifié)`);
      } else if (SOURCES.test(nom)) {
        const imp = importeursDe(jeu, nom, racine);
        if (imp.length > 0 && imp.length <= MAX_IMPORTEURS) {
          imp.forEach((s) => sur[jeu].add(s));
          raisons.add(`${jeu}/${nom} (utilitaire : ${imp.length} importeur(s))`);
        } else fumee(jeu, `${nom} : utilitaire de test`);
      }
      continue;
    }
    if (/^apps\/(web|jump)\/playwright\.config\.ts$/.test(f)) {
      fumee(f.includes("/web/") ? "web" : "jump", "configuration de Playwright");
      continue;
    }
    // Un fichier de code : la fumée des jeux qu'il touche, et les specs de ses zones (une zone partagée — ui, profil, serveur — rejoint les deux jeux).
    const cats = categoriesOf(f);
    if (cats.includes("track")) fumee("web", f);
    if (cats.includes("jump")) fumee("jump", f);
    for (const z of zonesDuFichier(f, table)) {
      for (const [spec, zs] of Object.entries(table.specs)) {
        if (!zs.includes(z)) continue;
        const [jeu, nom] = spec.split("/");
        liens[jeu].set(nom, (liens[jeu].get(nom) ?? 0) + 1);
      }
      raisons.add(`zone ${z} (${f})`);
    }
  }
  // Le budget : les specs de zones, les plus liés aux fichiers modifiés d'abord, à égalité les plus courts (le plus de couverture par seconde).
  const duree = (jeu, spec) => dureeE2e(racine, jeu, spec);
  const candidats = [];
  for (const jeu of ["web", "jump"]) for (const [nom, n] of liens[jeu]) if (!sur[jeu].has(nom)) candidats.push({ jeu, nom, n, s: duree(jeu, nom) });
  // Lot R13 (docs/tests.md) : un spec de la famille « Régression » (`regression` de e2e/zones.json) ne tourne que dans la CI complète (main, nuit), sauf
  // s'il est lui-même modifié par la PR (il est alors dans `sur`).
  const regression = new Set(table.regression ?? []);
  const enRegression = [];
  for (const c of candidats.splice(0)) (regression.has(`${c.jeu}/${c.nom}`) ? enRegression : candidats).push(c);
  candidats.sort((a, b) => b.n - a.n || a.s - b.s || (a.nom < b.nom ? -1 : 1));
  const choix = { web: new Set(sur.web), jump: new Set(sur.jump) };
  const reportes = [];
  let total = 0;
  for (const c of candidats) {
    if (total + c.s <= budget || total === 0) (choix[c.jeu].add(c.nom), (total += c.s));
    else reportes.push(`${c.jeu}/${c.nom}`);
  }
  const trier = (s) => [...s].filter((x) => x).sort();
  return {
    web: trier(choix.web),
    jump: trier(choix.jump),
    raisons: [...raisons].sort(),
    reportes: reportes.sort(),
    regression: enRegression.map((c) => `${c.jeu}/${c.nom}`).sort(),
  };
}

/**
 * Durée d'un spec dans la CI de PR (lot R13) : celle de ses tests « Essentiel » (`essentiel` de durees.json : les tests `@regression` ne tournent pas en
 * PR) ; un spec tout entier « Régression » qui tourne (modifié par la PR) pèse son spec entier.
 */
export function dureeE2e(racine, jeu, spec) {
  const d = JSON.parse(readFileSync(join(racine, E2E_DIRS[jeu], "durees.json"), "utf8"));
  return d.essentiel?.[spec] ?? d.secondes[spec] ?? 60;
}

/** Les specs de la table pour des zones nommées à la main (`npm run verifier -- --zones=track-sim,jump-rendu`). */
export function specsDesZones(zones, table) {
  const choix = { web: new Set(), jump: new Set() };
  const inconnues = zones.filter((z) => !(z in table.compilees));
  for (const [spec, zs] of Object.entries(table.specs)) {
    if (!zs.some((z) => zones.includes(z))) continue;
    const [jeu, nom] = spec.split("/");
    choix[jeu].add(nom);
  }
  return { web: [...choix.web].sort(), jump: [...choix.jump].sort(), inconnues };
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// 2. Les tests unitaires

/** Les dossiers de code : `packages/*`, `apps/*` et `scripts`. */
export function dossiersDeCode(racine = ROOT) {
  const out = ["scripts"];
  for (const base of ["packages", "apps"]) for (const e of readdirSync(join(racine, base), { withFileTypes: true })) if (e.isDirectory()) out.push(`${base}/${e.name}`);
  return out.sort();
}

/** Les chaînes de texte d'un fichier qui ressemblent à un chemin du dépôt (avec un `/` ou une extension connue). */
export function chemins(texte) {
  const out = new Set();
  for (const m of texte.matchAll(/["'`]((?:\.{1,2}\/)*[\w@.-]+(?:\/[\w@.*-]+)*(?:\.[a-z]{2,5})?\/?)["'`]/g)) {
    const s = m[1];
    if (s.includes("/") || /\.(md|json|ya?ml|html|css|m?ts|mjs)$/.test(s)) out.add(s);
  }
  return [...out];
}

/** Résout un chemin cité dans `fichier` : relatif au fichier (`./`, `../`) ou à la racine. Rend un chemin existant du dépôt, sinon null. */
export function resoudre(racine, fichier, cite) {
  const essais = [];
  if (cite.startsWith(".")) essais.push(posix.normalize(posix.join(posix.dirname(fichier), cite)));
  essais.push(cite.replace(/^(\.\.?\/)+/, ""));
  for (const e of essais) {
    const p = e.replace(/\/$/, "");
    if (p && p !== "." && !p.startsWith("..") && existsSync(join(racine, p))) return p;
  }
  return null;
}

const EXTENSIONS = ["", ".ts", ".mts", ".mjs", ".js", ".tsx", "/index.ts", "/index.mjs", "/index.js"];

/** Le fichier qu'importe `spec` depuis `fichier` (relatif, ou `@cdj/*`) ; null pour une dépendance extérieure ou introuvable. */
export function fichierImporte(racine, fichier, spec) {
  const nu = spec.replace(/[?#].*$/, "");
  let base;
  if (nu.startsWith(".")) base = posix.normalize(posix.join(posix.dirname(fichier), nu));
  else {
    const m = /^@cdj\/([\w-]+)(?:\/(.+))?$/.exec(nu);
    if (!m) return null;
    const dossier = ["web", "jump", "api", "portail"].includes(m[1]) ? `apps/${m[1]}` : `packages/${m[1]}`;
    if (!existsSync(join(racine, dossier, "package.json"))) return null;
    const pkg = JSON.parse(readFileSync(join(racine, dossier, "package.json"), "utf8"));
    const cle = m[2] ? `./${m[2]}` : ".";
    const exportee = typeof pkg.exports?.[cle] === "string" ? pkg.exports[cle] : null;
    base = posix.join(dossier, exportee ?? (m[2] ? m[2] : pkg.main ?? "src/index.ts"));
    base = posix.normalize(base);
  }
  for (const ext of EXTENSIONS) {
    const c = base + ext;
    if (existsSync(join(racine, c)) && statSync(join(racine, c)).isFile()) return c;
  }
  // `./x.js` écrit pour `x.ts` (usage TypeScript).
  const sansJs = base.replace(/\.(m?js)$/, "");
  if (sansJs !== base) for (const ext of [".ts", ".mts"]) if (existsSync(join(racine, sansJs + ext))) return sansJs + ext;
  return null;
}

/**
 * Le graphe des fichiers de code (`packages/*`, `apps/*`, `scripts`, sans les e2e, qui ont leur propre table) : pour chacun, les fichiers qu'il
 * importe et les chemins existants qu'il cite (documents, workflows, configuration, dossiers de données). Un test dépend de tout ce que son
 * graphe atteint, comme `vitest related`, avec en plus ce qu'il lit sans l'importer.
 */
export function graphe(racine = ROOT) {
  const noeuds = new Map();
  for (const u of dossiersDeCode(racine)) {
    for (const f of lister(racine, u, (x) => SOURCES.test(x) && !x.includes("/e2e/") && !x.endsWith(".d.mts") && !x.endsWith(".d.ts"))) {
      const texte = readFileSync(join(racine, f), "utf8");
      const imports = new Set();
      for (const m of texte.matchAll(/(?:from|import\s*\(|import)\s*["']([^"']+)["']/g)) {
        const cible = fichierImporte(racine, f, m[1]);
        if (cible && cible !== f) imports.add(cible);
      }
      const cites = new Set();
      for (const ligne of texte.split("\n")) {
        if (/^\s*(\/\/|\*|\/\*)/.test(ligne)) continue;
        for (const c of chemins(ligne)) {
          const r = resoudre(racine, f, c);
          if (!r) continue;
          // Un dossier de premier niveau (« docs », « apps »…) cité par un `startsWith("docs/")` n'est pas une lecture de tout ce qu'il contient.
          if (!r.includes("/") && statSync(join(racine, r)).isDirectory()) continue;
          cites.add(r);
          // Un fichier de code cité par son chemin (import dynamique calculé, script lancé par `node`) compte comme un import.
          if (SOURCES.test(r) && r !== f && statSync(join(racine, r)).isFile()) imports.add(r);
        }
      }
      noeuds.set(f, { imports, cites });
    }
  }
  const tests = [...noeuds.keys()].filter((f) => f.includes("/test/") && f.endsWith(".test.ts")).sort();
  return { noeuds, tests, atteint: new Map() };
}

/** Tout ce qu'un test atteint : `{ fichiers, citees }` (fichiers du graphe, chemins cités — fichiers ou dossiers). */
export function atteint(g, test) {
  if (g.atteint.has(test)) return g.atteint.get(test);
  const fichiers = new Set([test]);
  const citees = new Set();
  const pile = [test];
  while (pile.length) {
    const n = g.noeuds.get(pile.pop());
    if (!n) continue;
    for (const i of n.imports) if (!fichiers.has(i)) (fichiers.add(i), pile.push(i));
    for (const c of n.cites) citees.add(c);
  }
  const r = { fichiers, citees };
  g.atteint.set(test, r);
  return r;
}

/** Un fichier modifié touche-t-il ce test ? Il est dans son graphe, ou c'est un chemin qu'il cite (fichier, ou dossier qui le contient). */
export function touche(g, test, f) {
  const a = atteint(g, test);
  if (a.fichiers.has(f)) return true;
  for (const c of a.citees) if (c === f || f.startsWith(`${c.replace(/\/$/, "")}/`)) return true;
  return false;
}

/** Documents que lisent les tests, par document : les fichiers de test qui les citent (la seule raison de lancer un test pour un `docs/**`). */
export function docsLusParLesTests(g) {
  const out = new Map();
  for (const t of g.tests) for (const c of atteint(g, t).citees) if (estDoc(c)) (out.has(c) ? out.get(c) : out.set(c, []).get(c)).push(t);
  return out;
}

const RACINE_TOUT = /^(package(-lock)?\.json|tsconfig(\.[\w-]+)?\.json|vitest\.config\.ts)$/;

/**
 * Les fichiers de tests unitaires à lancer pour ces fichiers modifiés. `complet` : tous. Rend `{ fichiers, tous, docsSeuls, raisons }`.
 *  - docs seuls (`docs/**`, `*.md`, `docsSeuls`) : ni vérification ni construction, et seulement les tests qui citent ces documents ;
 *  - un fichier de code lance les tests dont le graphe l'atteint (imports de proche en proche), ou qui le citent ;
 *  - configuration racine (package.json, verrou, tsconfig, vitest) : tous.
 */
export function testsPour(files, g, { complet = false, regression = [] } = {}) {
  const f2 = files.map(norm).filter(Boolean);
  if (complet) return { fichiers: [...g.tests], tous: true, docsSeuls: false, raisons: ["CI complète"] };
  if (f2.length === 0) return { fichiers: [...g.tests], tous: true, docsSeuls: false, raisons: ["aucun fichier connu (doute : tout tourne)"] };
  const choix = new Set();
  const raisons = new Set();
  for (const f of f2) {
    if (RACINE_TOUT.test(f)) return { fichiers: [...g.tests], tous: true, docsSeuls: false, raisons: [`${f} : configuration racine, tout tourne`] };
    const touches = g.tests.filter((t) => touche(g, t, f));
    touches.forEach((t) => choix.add(t));
    if (touches.length) raisons.add(`${f} → ${touches.length} fichier(s) de tests`);
  }
  // Lot R13 (docs/tests.md) : un fichier de la famille « Régression » ne tourne que dans la CI complète, sauf s'il est lui-même modifié.
  for (const t of regression) if (choix.has(t) && !f2.includes(t)) (choix.delete(t), raisons.add(`${t} : régression (CI complète de main et nuit)`));
  return { fichiers: [...choix].sort(), tous: false, docsSeuls: f2.every(estDoc), raisons: [...raisons].sort() };
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// 3. Les parts

export function dureesUnitaires(racine = ROOT) {
  const f = join(racine, "scripts/unit-durees.json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")).secondes : {};
}

/** Nombre de parts pour une charge (secondes) : une part par `cible` secondes, entre 1 et `max`. */
export const nombreDeParts = (charge, cible, max) => Math.min(max, Math.max(1, Math.ceil(charge / cible)));

/** Parts unitaires : `[{ part: "1/3", fichiers: [...], secondes }]`, durées égales. */
export function partsUnitaires(fichiers, durees, { max = PARTS_UNITAIRES_MAX, cible = CIBLE_PART_UNITAIRE_S } = {}) {
  if (fichiers.length === 0) return [];
  const poids = Object.fromEntries(fichiers.map((f) => [f, durees[f] ?? DEFAUT_UNITAIRE_S]));
  const total = Object.values(poids).reduce((a, b) => a + b, 0);
  const n = Math.min(nombreDeParts(total, cible, max), fichiers.length);
  return assignParts(fichiers, poids, n).map((p, i) => ({ part: `${i + 1}/${n}`, fichiers: p.files, secondes: Math.round(p.load) }));
}

/** Parts e2e : au plus `max` parts, chacune peut porter des specs des DEUX jeux (étapes successives du même job). */
export function partsE2e(choix, racine = ROOT, { max = PARTS_E2E_MAX, cible = CIBLE_PART_E2E_S } = {}) {
  const duree = (jeu, spec) => dureeE2e(racine, jeu, spec);
  const items = [
    ...choix.web.map((s) => `web/${s}`),
    ...choix.jump.map((s) => `jump/${s}`),
  ];
  if (items.length === 0) return [];
  const poids = Object.fromEntries(items.map((i) => { const [j, s] = i.split("/"); return [i, Math.max(1, duree(j, s))]; }));
  const total = Object.values(poids).reduce((a, b) => a + b, 0);
  const n = Math.min(nombreDeParts(total, cible, max), items.length);
  return assignParts(items, poids, n).map((p, i) => ({
    part: `${i + 1}/${n}`,
    web: p.files.filter((x) => x.startsWith("web/")).map((x) => x.slice(4)),
    jump: p.files.filter((x) => x.startsWith("jump/")).map((x) => x.slice(5)),
    secondes: Math.round(p.load),
  }));
}

/**
 * Lot R13 (docs/tests.md) — la CI complète. `main` (chaque fusion) : l'Essentiel de tous les specs (sans la famille « Régression ») ; `complet` (« Run
 * workflow ») et `nuit` : tout. Chromium porte tout ; Firefox et WebKit, le petit ensemble `@navigateurs` des deux jeux (un job chacun).
 */
// Lot R12 : `complet` et `nuit` repassent à 8 parts de Track (≈ 560 s de specs chacune au lieu de ≈ 745 s) : objectif ≤ 15 min de mur pour la CI que lance le bouton.
export const PARTS_COMPLETES = { main: { web: 3, jump: 1 }, complet: { web: 8, jump: 1 }, nuit: { web: 8, jump: 1 } };

/** La matrice des jobs `e2e-parts` d'un mode complet (une PR reçoit celle de `main` : le job y est sauté). */
export function matriceComplete(mode) {
  const parts = PARTS_COMPLETES[mode] ?? PARTS_COMPLETES.main;
  const essentiel = !(mode in PARTS_COMPLETES) || mode === "main";
  const include = [];
  for (let i = 1; i <= parts.web; i++) include.push({ suite: "web", browser: "chromium", shard: `${i}/${parts.web}`, essentiel });
  for (let i = 1; i <= parts.jump; i++) include.push({ suite: "jump", browser: "chromium", shard: `${i}/${parts.jump}`, essentiel });
  for (const browser of ["firefox", "webkit"]) include.push({ suite: "navigateurs", browser, shard: "1/1", essentiel: false });
  return { include };
}

/** L'ensemble de la décision d'une PR, pour le workflow et pour `npm run verifier`. */
export function decider(files, { mode = "pr", racine = ROOT } = {}) {
  const table = chargerTable(racine);
  const g = graphe(racine);
  const complet = mode !== "pr";
  const unit = testsPour(files, g, { complet, regression: table.regressionUnitaires ?? [] });
  const durees = dureesUnitaires(racine);
  const unitParts = partsUnitaires(unit.fichiers, durees, complet ? { max: 3, cible: 270 } : {});
  const docsSeuls = !complet && unit.docsSeuls;
  const e2e = complet ? { web: [], jump: [], raisons: ["CI complète : matrice complète"] } : docsSeuls ? { web: [], jump: [], raisons: ["docs seuls"] } : specsPour(files, table, racine);
  const e2eParts = complet ? [] : partsE2e(e2e, racine);
  // Hors docs seuls, une première part vérifie toujours (typecheck, portail, construction), même sans test unitaire à lancer.
  if (!docsSeuls && unitParts.length === 0) unitParts.push({ part: "1/1", fichiers: [], secondes: 0 });
  return { mode, docsSeuls, unit, unitParts, e2e, e2eParts };
}

/** Lignes `clé=valeur` pour $GITHUB_OUTPUT. */
export function sorties(d) {
  const unitMatrice = { include: d.unitParts.map((p, i) => ({ part: p.part, fichiers: p.fichiers.join(" "), api: p.fichiers.some((f) => f.startsWith("apps/api/test/")), verif: !d.docsSeuls && i === 0 })) };
  const e2eMatrice = { include: d.e2eParts.map((p) => ({ part: p.part, web: p.web.join(" "), jump: p.jump.join(" ") })) };
  return [
    `docs_seuls=${d.docsSeuls}`,
    `unit_actif=${d.unitParts.length > 0}`,
    `unit_matrice=${JSON.stringify(unitMatrice)}`,
    `e2e_pr_actif=${d.e2eParts.length > 0}`,
    `e2e_pr_matrice=${JSON.stringify(e2eMatrice)}`,
    `e2e_complet_matrice=${JSON.stringify(matriceComplete(d.mode))}`,
  ].join("\n") + "\n";
}

/** Le résumé lisible (étape « Portée » du run). */
export function resume(d) {
  const l = [`Mode ${d.mode}${d.docsSeuls ? " — docs seuls : aucun test (sauf ceux qui lisent ces documents)" : ""}`];
  l.push(`Tests unitaires : ${d.unit.fichiers.length} fichier(s)${d.unit.tous ? " (tous)" : ""}, ${d.unitParts.length} part(s) ${d.unitParts.map((p) => `${p.secondes} s`).join(" / ")}`);
  for (const r of d.unit.raisons.slice(0, 12)) l.push(`  · ${r}`);
  if (d.mode === "pr") {
    l.push(`e2e (Chromium) : ${d.e2e.web.length} spec(s) DailyTrack, ${d.e2e.jump.length} spec(s) DailyJump, ${d.e2eParts.length} part(s) ${d.e2eParts.map((p) => `${p.secondes} s`).join(" / ")}`);
    for (const s of d.e2e.web) l.push(`  · web/${s}`);
    for (const s of d.e2e.jump) l.push(`  · jump/${s}`);
    for (const r of d.e2e.raisons.slice(0, 12)) l.push(`  ↳ ${r}`);
    if (d.e2e.reportes?.length) l.push(`Reportés à la CI complète de main (budget de ${BUDGET_E2E_S} s de specs atteint) : ${d.e2e.reportes.join(", ")}`);
    if (d.e2e.regression?.length) l.push(`Régression (CI complète de main et nuit seulement, docs/tests.md) : ${d.e2e.regression.join(", ")}`);
  }
  return l.join("\n");
}

// ---------------------------------------------------------------------------------------------------------------------------------------

/** Lot R13 : les tests d'API qui ne tournent que sur SQLite (`exclude` du projet libsql de vitest.config.ts : les jeux de données fictives de la recette). */
export const SQLITE_SEULEMENT = /^apps\/api\/test\/(portailDemo|jumpHistory|classementDemo)\.test\.ts$/;

/** Réécrit `scripts/unit-durees.json` depuis un rapport JSON de Vitest (durées locales × 0,5 ; apps/api/test ×2 : SQLite puis libSQL). */
export function dureesDepuisVitest(rapport, racine = ROOT) {
  const out = {};
  for (const t of rapport.testResults) {
    const f = norm(t.name).replace(norm(racine) + "/", "");
    let s = ((t.endTime - t.startTime) / 1000) * 0.5;
    if (f.startsWith("apps/api/test/") && !SQLITE_SEULEMENT.test(f)) s *= 2;
    out[f] = Math.max(1, Math.round(s));
  }
  return Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
}

function main(argv) {
  if (argv.includes("--durees-unitaires")) {
    const rapport = JSON.parse(readFileSync(argv[argv.indexOf("--durees-unitaires") + 1], "utf8"));
    const f = join(ROOT, "scripts/unit-durees.json");
    const ancien = JSON.parse(readFileSync(f, "utf8"));
    writeFileSync(f, JSON.stringify({ _: ancien._, secondes: dureesDepuisVitest(rapport) }, null, 1) + "\n");
    console.error("scripts/unit-durees.json réécrit");
    return;
  }
  const mode = argv.includes("--mode") ? argv[argv.indexOf("--mode") + 1] : "pr";
  const files = readFileSync(0, "utf8").split("\n").map(norm).filter(Boolean);
  const d = decider(files, { mode });
  process.stderr.write(resume(d) + "\n");
  process.stdout.write(sorties(d));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
