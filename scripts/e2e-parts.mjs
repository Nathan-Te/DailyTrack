// Répartition des specs e2e entre les parts de la CI, par DURÉE (retouche 31b). Utilisé par .github/workflows/ci.yml pour Chromium.
//   node scripts/e2e-parts.mjs 3/8 chromium > liste.txt   → liste de tests pour `playwright test --test-list liste.txt`
//   node scripts/e2e-parts.mjs 1/2 jump-chromium > liste.txt   → idem pour les specs de DailyJump (lot 3c)
//
// Pourquoi : `--shard` de Playwright coupe la liste des tests par NOMBRE, fichier par fichier, dans l'ordre alphabétique. Ajouter un spec
// (le lot 31 en a ajouté onze) déplace toutes les frontières : la part 7 de Chromium s'est retrouvée vide, la part 8 a reçu les miniatures
// ET le spectateur (16 min), la part 5 le planning à côté du profil et du Salon. Ici chaque fichier pèse sa durée mesurée en CI
// (`apps/web/e2e/durees.json`, secondes, un seul worker), et les fichiers sont posés du plus long au plus court sur la part la moins chargée.
// Un fichier absent du tableau pèse `DEFAULT_S` (et le script le signale sur stderr) : aucun spec n'est jamais oublié.
//
// Lot R3 (plateforme) — sous-ensemble multi-navigateurs : `node scripts/e2e-parts.mjs multi firefox` (ou `jump-webkit`…) rend la liste des specs
// de `e2e/multi-navigateurs.json` du jeu : sur une PR, Firefox et WebKit ne lancent qu'eux (comparaison entre navigateurs : rejeu, déterminisme).

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const E2E = join(ROOT, "apps/web/e2e");
// Lot 3c : DailyJump a ses specs et ses durées à lui (apps/jump/e2e/durees.json). Son projet Playwright de CI s'appelle `jump-<navigateur>`
// (apps/jump/playwright.config.ts) : le préfixe du projet dit de quel jeu il s'agit.
const E2E_JUMP = join(ROOT, "apps/jump/e2e");
export const gameOf = (project) => (project.startsWith("jump-") ? { dir: E2E_JUMP, name: "jump" } : { dir: E2E, name: "web" });
export const DEFAULT_S = 60;

/** Les specs du dossier e2e (noms relatifs au dossier, comme Playwright les écrit dans une liste de tests). */
export function specFiles(dir = E2E) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".spec.ts"))
    .sort();
}

/**
 * Pose chaque fichier, du plus long au plus court, sur la part la moins chargée (à égalité : la première). Déterministe.
 * Rend `total` listes de fichiers et leur charge estimée (s).
 */
export function assignParts(files, durations, total) {
  const weight = (f) => durations[f] ?? DEFAULT_S;
  const order = [...files].sort((a, b) => weight(b) - weight(a) || (a < b ? -1 : 1));
  const parts = Array.from({ length: total }, () => ({ files: [], load: 0 }));
  for (const f of order) {
    let best = 0;
    for (let i = 1; i < total; i++) if (parts[i].load < parts[best].load) best = i;
    parts[best].files.push(f);
    parts[best].load += weight(f);
  }
  for (const p of parts) p.files.sort();
  return parts;
}

/** Sous-ensemble multi-navigateurs d'un jeu (lot R3) : `{ fichier: raison }`, lu dans `e2e/multi-navigateurs.json`. */
export function multiSpecs(dir = E2E) {
  return JSON.parse(readFileSync(join(dir, "multi-navigateurs.json"), "utf8")).specs;
}

/** Contenu d'un fichier `--test-list` : une ligne par spec (« [projet] › fichier » = tous les tests du fichier). */
export function testList(files, project) {
  return files.map((f) => `[${project}] › ${f}`).join("\n") + "\n";
}

function main(argv) {
  if (argv[0] === "multi") {
    const project = argv[1] ?? "firefox";
    const files = Object.keys(multiSpecs(gameOf(project).dir)).sort();
    console.error(`e2e-parts : sous-ensemble multi-navigateurs (${project}) — ${files.join(", ")}`);
    process.stdout.write(testList(files, project));
    return;
  }
  const [spec, project = "chromium"] = argv;
  const m = /^(\d+)\/(\d+)$/.exec(spec ?? "");
  if (!m || +m[1] < 1 || +m[1] > +m[2]) {
    console.error("usage : node scripts/e2e-parts.mjs <part>/<total> [projet]");
    process.exit(2);
  }
  const [current, total] = [+m[1], +m[2]];
  const game = gameOf(project);
  const durations = JSON.parse(readFileSync(join(game.dir, "durees.json"), "utf8")).secondes;
  const files = specFiles(game.dir);
  for (const f of files) if (!(f in durations)) console.error(`e2e-parts : ${f} absent de apps/${game.name}/e2e/durees.json, compté ${DEFAULT_S} s`);
  const parts = assignParts(files, durations, total);
  const part = parts[current - 1];
  console.error(`e2e-parts : part ${current}/${total} ≈ ${Math.round(part.load)} s — ${part.files.join(", ")}`);
  process.stdout.write(testList(part.files, project));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
