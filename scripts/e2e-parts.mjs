// Répartition des specs e2e entre les parts de la CI, par DURÉE (retouche 31b). Utilisé par .github/workflows/ci.yml pour Chromium.
//   node scripts/e2e-parts.mjs 3/8 chromium > liste.txt   → liste de tests pour `playwright test --test-list liste.txt`
//   node scripts/e2e-parts.mjs 1/2 jump-chromium > liste.txt   → idem pour les specs de DailyJump (lot 3c)
//   node scripts/e2e-parts.mjs 1/3 chromium --essentiel > liste.txt   → lot R13 : la CI de main (sans la famille « Régression », docs/tests.md)
//
// Pourquoi : `--shard` de Playwright coupe la liste des tests par NOMBRE, fichier par fichier, dans l'ordre alphabétique. Ajouter un spec
// (le lot 31 en a ajouté onze) déplace toutes les frontières : la part 7 de Chromium s'est retrouvée vide, la part 8 a reçu les miniatures
// ET le spectateur (16 min), la part 5 le planning à côté du profil et du Salon. Ici chaque fichier pèse sa durée mesurée en CI
// (`apps/web/e2e/durees.json`, secondes, un seul worker), et les fichiers sont posés du plus long au plus court sur la part la moins chargée.
// Un fichier absent du tableau pèse `DEFAULT_S` (et le script le signale sur stderr) : aucun spec n'est jamais oublié.
//
// Lot R10 (plateforme) — `node scripts/e2e-parts.mjs liste chromium web/a.spec.ts jump/b.spec.ts` écrit la liste de tests d'une part de la CI de PR courte
// (les specs viennent de scripts/ci-zones.mjs) : chaque spec sur le projet de son jeu (`chromium`, `jump-chromium`). Le sous-ensemble multi-navigateurs du
// lot R3 est retiré : une PR ne lance plus que Chromium, tout tourne sur les trois navigateurs à chaque fusion et la nuit.

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

/** Lot R13 : un outil (captures, mesures) n'est jamais dans la CI (`testIgnore` des configurations de Playwright sans `CAPTURES`, `MESURE`…). */
export const estOutil = (f) => /^(captures|mesure)[-.]/.test(f);

/** Les specs du dossier e2e que la CI lance (noms relatifs au dossier, comme Playwright les écrit dans une liste de tests) : sans les outils. */
export function specFiles(dir = E2E) {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".spec.ts") && !estOutil(f))
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

/** Contenu d'un fichier `--test-list` : une ligne par spec (« [projet] › fichier » = tous les tests du fichier). */
export function testList(files, project) {
  return files.map((f) => `[${project}] › ${f}`).join("\n") + "\n";
}

/**
 * Lot R13 (docs/tests.md) : les durées d'un jeu — `secondes` (le spec entier) ou, pour la CI de PR et de main (`essentiel`), celles de ses tests sans
 * l'étiquette `@regression` ; un spec de la liste `regression` de e2e/zones.json n'a alors aucune durée (il ne tourne pas).
 */
export function durees(dir = E2E, { essentiel = false } = {}) {
  const d = JSON.parse(readFileSync(join(dir, "durees.json"), "utf8"));
  return essentiel ? d.essentiel ?? {} : d.secondes;
}

/** Lot R13 : les specs tout entiers « Régression » d'un jeu (`web` | `jump`), d'après e2e/zones.json. */
export function specsRegression(jeu) {
  const t = JSON.parse(readFileSync(join(ROOT, "e2e/zones.json"), "utf8"));
  return (t.regression ?? []).filter((s) => s.startsWith(`${jeu}/`)).map((s) => s.slice(jeu.length + 1));
}

function main(argv) {
  if (argv[0] === "liste") {
    // liste <projet-web> <jeu/fichier>… : le projet du jeu `jump` est `jump-<navigateur>`.
    const navigateur = argv[1] ?? "chromium";
    const lignes = argv.slice(2).filter(Boolean).map((x) => {
      const [jeu, fichier] = x.split("/");
      return `[${jeu === "jump" ? `jump-${navigateur}` : navigateur}] › ${fichier}`;
    });
    process.stdout.write(lignes.join("\n") + "\n");
    return;
  }
  const essentiel = argv.includes("--essentiel");
  const [spec, project = "chromium"] = argv.filter((a) => !a.startsWith("--"));
  const m = /^(\d+)\/(\d+)$/.exec(spec ?? "");
  if (!m || +m[1] < 1 || +m[1] > +m[2]) {
    console.error("usage : node scripts/e2e-parts.mjs <part>/<total> [projet]");
    process.exit(2);
  }
  const [current, total] = [+m[1], +m[2]];
  const game = gameOf(project);
  const durations = durees(game.dir, { essentiel });
  // `--essentiel` (CI de main, lot R13) : sans les specs tout entiers « Régression » ; les tests `@regression` des autres sont écartés par `--grep-invert`.
  const regression = essentiel ? specsRegression(game.name) : [];
  const files = specFiles(game.dir).filter((f) => !regression.includes(f));
  for (const f of files) if (!(f in durations)) console.error(`e2e-parts : ${f} absent de apps/${game.name}/e2e/durees.json, compté ${DEFAULT_S} s`);
  const parts = assignParts(files, durations, total);
  const part = parts[current - 1];
  console.error(`e2e-parts : part ${current}/${total} ≈ ${Math.round(part.load)} s — ${part.files.join(", ")}`);
  process.stdout.write(testList(part.files, project));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
