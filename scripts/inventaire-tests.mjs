// Inventaire des tests (lot R13, docs/tests.md) : les chiffres de chaque famille — Essentiel, Régression, Outil — pour les specs e2e et les fichiers de tests
// unitaires, à recopier dans docs/tests.md après un changement de famille ou de durée. Sans réseau ; lance `playwright test --list` dans chaque jeu (≈ 5 s)
// et lit `vitest list`.
//   node scripts/inventaire-tests.mjs            le résumé (Markdown) : familles, nombre de tests, durées
//   node scripts/inventaire-tests.mjs --specs    plus une ligne par spec (famille, tests, durée entière, durée « Essentiel »)
// Les familles : un spec de `regression` (e2e/zones.json) est tout entier « Régression » ; ailleurs, un test étiqueté `@regression` aussi ; le reste est
// « Essentiel ». Les outils (captures-*, mesure-*) ne sont listés qu'avec leur variable (CAPTURES=1…) : on les compte par leur nom de fichier.
// Unitaires : `regressionUnitaires` (e2e/zones.json) = « Régression », le reste « Essentiel » ; durées de scripts/unit-durees.json.

import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const zones = JSON.parse(readFileSync(join(ROOT, "e2e/zones.json"), "utf8"));
const estOutil = (f) => /^(captures|mesure)[-.]/.test(f);

/** Les tests e2e d'un jeu : `[{ fichier, titre, regression, navigateurs }]` (projet Chromium), lus par `playwright test --list`. */
export function testsE2e(jeu) {
  const r = spawnSync("npx", ["playwright", "test", "--list", "--reporter=json", "--project", "chromium"], { cwd: join(ROOT, "apps", jeu), encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`playwright --list (${jeu}) : ${r.stderr.slice(-400)}`);
  const out = [];
  const marcher = (s, fichier, titres) => {
    for (const c of s.suites ?? []) marcher(c, c.file ?? fichier, c.title && c.title !== (c.file ?? fichier) ? [...titres, c.title] : titres);
    for (const sp of s.specs ?? []) out.push({ fichier: sp.file ?? fichier, titre: [...titres, sp.title].join(" › "), regression: sp.tags.includes("regression"), navigateurs: sp.tags.includes("navigateurs") });
  };
  for (const s of JSON.parse(r.stdout).suites) marcher(s, s.file, []);
  return out;
}

/** Les familles des specs d'un jeu : `{ spec: { essentiel: n, regression: n, navigateurs: n, secondes, secondesEssentiel } }`. */
export function specsParFamille(jeu, tests = testsE2e(jeu)) {
  const nom = jeu === "web" ? "web" : "jump";
  const regression = new Set((zones.regression ?? []).filter((s) => s.startsWith(`${nom}/`)).map((s) => s.slice(nom.length + 1)));
  const durees = JSON.parse(readFileSync(join(ROOT, "apps", jeu, "e2e/durees.json"), "utf8"));
  const par = {};
  for (const t of tests) {
    const p = (par[t.fichier] ??= { essentiel: 0, regression: 0, navigateurs: 0, entier: regression.has(t.fichier), secondes: durees.secondes[t.fichier] ?? 0, secondesEssentiel: durees.essentiel?.[t.fichier] ?? 0 });
    if (p.entier || t.regression) p.regression++;
    else p.essentiel++;
    if (t.navigateurs) p.navigateurs++;
  }
  return par;
}

/** Les fichiers de tests unitaires : `[{ fichier, tests, secondes, famille }]` (`vitest list`, projet SQLite). */
export function unitaires() {
  const lister = (exclus) => spawnSync("npx", ["vitest", "list", "--project", "sqlite", "--json", ...exclus.flatMap((f) => ["--exclude", f])], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  // Un fichier dont les tests sont créés à l'exécution (boucle sur des données calculées) fait échouer `vitest list` : on l'écarte et on compte ses `it(`.
  const dynamiques = [...lister([]).stderr.matchAll(/No test suite found in file (\S+)/g)].map((m) => m[1].replace(`${ROOT}/`, ""));
  const r = lister(dynamiques);
  const debut = r.stdout.indexOf("[");
  if (debut < 0) throw new Error(`vitest list : ${r.stderr.slice(-400)}`);
  const durees = JSON.parse(readFileSync(join(ROOT, "scripts/unit-durees.json"), "utf8")).secondes;
  const regression = new Set(zones.regressionUnitaires ?? []);
  const par = new Map();
  for (const t of JSON.parse(r.stdout.slice(debut))) {
    const f = t.file.replace(`${ROOT}/`, "");
    par.set(f, (par.get(f) ?? 0) + 1);
  }
  for (const f of dynamiques) par.set(f, Math.max(1, (readFileSync(join(ROOT, f), "utf8").match(/\bit(\.each\([^)]*\))?\(/g) ?? []).length));
  return [...par].sort().map(([fichier, tests]) => ({ fichier, tests, secondes: durees[fichier] ?? 5, famille: regression.has(fichier) ? "Régression" : "Essentiel" }));
}

function main(argv) {
  const lignes = ["| Famille | Specs e2e (fichiers) | Tests e2e | Durée Chromium (s) | Fichiers unitaires | Tests unitaires | Durée unitaires (s) |", "|---|---|---|---|---|---|---|"];
  const tot = { Essentiel: [0, 0, 0, 0, 0, 0], Régression: [0, 0, 0, 0, 0, 0], Outil: [0, 0, 0, 0, 0, 0] };
  const detail = [];
  for (const jeu of ["web", "jump"]) {
    const par = specsParFamille(jeu);
    for (const [spec, p] of Object.entries(par).sort()) {
      const famille = p.entier ? "Régression" : p.regression ? `Essentiel (${p.essentiel}) + Régression (${p.regression})` : "Essentiel";
      detail.push(`| ${jeu}/${spec} | ${famille} | ${p.essentiel + p.regression} | ${p.secondes} | ${p.entier ? 0 : p.secondesEssentiel} |${p.navigateurs ? ` ${p.navigateurs} @navigateurs` : ""}`);
      if (p.essentiel) (tot.Essentiel[0]++, (tot.Essentiel[1] += p.essentiel), (tot.Essentiel[2] += p.entier ? 0 : p.secondesEssentiel));
      if (p.regression) (tot.Régression[0]++, (tot.Régression[1] += p.regression), (tot.Régression[2] += p.secondes - (p.entier ? 0 : p.secondesEssentiel)));
    }
    for (const f of readdirSync(join(ROOT, "apps", jeu, "e2e")).filter((f) => f.endsWith(".spec.ts") && estOutil(f))) tot.Outil[0]++;
  }
  for (const u of unitaires()) {
    const t = tot[u.famille];
    t[3]++;
    t[4] += u.tests;
    t[5] += u.secondes;
  }
  for (const [f, t] of Object.entries(tot)) lignes.push(`| ${f} | ${t[0]} | ${f === "Outil" ? "jamais en CI" : t[1]} | ${Math.round(t[2])} | ${t[3]} | ${t[4]} | ${t[5]} |`);
  console.log(lignes.join("\n"));
  if (argv.includes("--specs")) console.log(["", "| Spec | Famille | Tests | Durée entière (s) | Essentiel (s) |", "|---|---|---|---|---|", ...detail].join("\n"));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
