import { readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { expect, test } from "@playwright/test";

// **Lot R17 : les plafonds de poids ne sont plus ici.** Ils sont dans `docs/plateforme/budgets.md` (la seule source : lignes `jump.jsCss`, `jump.anglais`, `jump.polices`) et contrôlés par le job
// « Budgets » de la CI (`scripts/budgets-controle.mjs`) sur toute PR qui touche ce que charge un joueur, qu'un spec de Jump tourne ou non (son histoire — « avant + 20 ko », les relèvements des
// lots 30 à 32 — est dans la ligne `jump.jsCss` du tableau). Ce fichier ne garde que la **composition** du chargement : ce qui est ou n'est pas dans le premier chargement, les polices et leur
// préchargement. Déterministe (la construction), sans navigateur.
const dist = new URL("../dist/assets/", import.meta.url);
const gz = (f: string) => gzipSync(readFileSync(new URL(f, dist))).length;

test("le catalogue anglais est à part (à la demande) et three.js reste dans son propre fichier", () => {
  const poids = Object.fromEntries(readdirSync(dist).filter((f) => f.endsWith(".js")).map((f) => [f, gz(f)]));
  const anglais = Object.entries(poids).find(([f]) => f.startsWith("catalogue.en-"))?.[1] ?? 0;
  expect(anglais, "le catalogue anglais existe, à part").toBeGreaterThan(1_000);
  const three = Object.entries(poids).find(([f]) => f.startsWith("three-"))?.[1] ?? 0;
  expect(three, "three.js reste dans son propre fichier (cache entre déploiements)").toBeGreaterThan(100_000);
});

test("les polices : chemin du site partagé avec le portail et Track, Lilita One et Archivo 400 préchargées", () => {
  const css = readdirSync(dist).filter((f) => f.endsWith(".css"));
  const faces = new Set<string>();
  for (const f of css) for (const m of readFileSync(new URL(f, dist), "utf8").matchAll(/url\(["']?([^)"']+\.woff2)["']?\)/g)) faces.add(m[1]!);
  expect([...faces].map((f) => f.replace(/^\/assets\//, "").replace(/-[\w-]{8}\.woff2$/, "")).sort(), "Lilita One, Archivo Black, Archivo 400, 600 et 700, JetBrains Mono 700").toEqual([
    "archivo-black-latin-400-normal",
    "archivo-latin-400-normal",
    "archivo-latin-600-normal",
    "archivo-latin-700-normal",
    "jetbrains-mono-latin-700-normal",
    "lilita-one-latin-400-normal",
  ]);
  for (const face of faces) {
    expect(face, "les polices sont servies par /assets/ (la racine du site, comme le portail et Track), pas relativement à la page").toMatch(/^\/assets\/[a-z-]+-latin-\d+-normal-[\w-]+\.woff2$/);
  }
  const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  const precharges = [...html.matchAll(/<link rel="preload" as="font" type="font\/woff2" crossorigin href="([^"]+)"/g)].map((m) => m[1]!);
  expect(precharges.map((p) => p.replace(/^\/assets\//, "").replace(/-[\w-]{8}\.woff2$/, "")).sort()).toEqual(["archivo-latin-400-normal", "lilita-one-latin-400-normal"]);
  for (const p of precharges) expect(faces.has(p), `${p} : le préchargement vise le même chemin que la feuille`).toBe(true);
  // Le HTML ne porte aucun texte en dur : il est pré-rempli en français à la construction (data-t), titre « Jump — Du Jour ».
  expect(html).toContain("<title data-t=\"page.titre\">Jump — Du Jour</title>");
});

// Lot 21 : le catalogue des morceaux et le générateur ne sont pas dans le premier chargement (celui du niveau du jour, avec un fichier figé) : ils sont chargés à
// la demande, par le fil de travail ou par le repli sur le fil principal — **un seul exemplaire** pour les deux (le fil de travail est une entrée de la même
// construction, `vite.config.ts` `filDuGenerateur`, et partage ses fichiers avec la page). Lu dans la construction, comme le poids : sans navigateur.
test("le premier chargement ne contient ni le catalogue ni le générateur ; ils n'existent qu'une fois, le fil de travail les partage avec le repli", () => {
  const CATALOGUE = "etiquettes: scie"; // le texte d'un morceau du catalogue embarqué
  const GENERATEUR = "un tirage mieux estimé est valide"; // un message du générateur
  const fichiers = readdirSync(dist).filter((f) => f.endsWith(".js"));
  const texte = Object.fromEntries(fichiers.map((f) => [f, readFileSync(new URL(f, dist), "utf8")]));
  const statiques = (f: string) => [...texte[f]!.matchAll(/\bfrom\s*"\.\/([^"]+\.js)"|\bimport\s*"\.\/([^"]+\.js)"/g)].map((m) => (m[1] ?? m[2])!);
  const dynamiques = (f: string) => [...texte[f]!.matchAll(/import\(\s*["`]\.\/([^"`]+\.js)["`]/g)].map((m) => m[1]!);
  const fermeture = (racines: string[]) => {
    const vus = new Set<string>();
    const file = [...racines];
    while (file.length) {
      const f = file.shift()!;
      if (vus.has(f) || !texte[f]) continue;
      vus.add(f);
      file.push(...statiques(f));
    }
    return vus;
  };
  const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  const entree = [...html.matchAll(/(?:src|href)="\.\/assets\/([^"]+\.js)"/g)].map((m) => m[1]!);
  // La page + le jeu (le fichier `main-*.js` que l'entrée charge à la demande : le plus gros) = tout ce que charge un joueur dont le niveau est figé.
  const debut = fermeture(entree);
  const jeu = [...debut].flatMap(dynamiques).filter((f) => f.startsWith("main-")).sort((a, b) => texte[b]!.length - texte[a]!.length)[0]!;
  const premier = fermeture([...entree, jeu]);
  expect(premier.size, "le jeu et sa page sont lus").toBeGreaterThan(5);
  for (const f of premier) {
    expect(texte[f]!.includes(CATALOGUE), `${f} : le catalogue des morceaux n'est pas dans le premier chargement`).toBe(false);
    expect(texte[f]!.includes(GENERATEUR), `${f} : le générateur n'est pas dans le premier chargement`).toBe(false);
  }
  // Un seul exemplaire de chacun dans la construction, et le fil de travail (`dailyWorker-*.js`) y mène par ses imports statiques, comme le repli.
  expect(fichiers.filter((f) => texte[f]!.includes(CATALOGUE)).length, "le catalogue n'existe qu'une fois").toBe(1);
  expect(fichiers.filter((f) => texte[f]!.includes(GENERATEUR)).length, "le générateur n'existe qu'une fois").toBe(1);
  const fil = fichiers.find((f) => f.startsWith("dailyWorker-"))!;
  expect(texte[fil]!.length, "le fil de travail est un petit fichier qui importe le reste").toBeLessThan(2_000);
  const duFil = fermeture([fil]);
  expect([...duFil].some((f) => texte[f]!.includes(CATALOGUE)), "le fil de travail charge le catalogue").toBe(true);
  expect([...duFil].some((f) => texte[f]!.includes(GENERATEUR)), "le fil de travail charge le générateur").toBe(true);
  expect([...duFil].some((f) => f.startsWith("three-") || f.startsWith("main-")), "le fil de travail n'importe ni Three.js ni le jeu").toBe(false);
});
