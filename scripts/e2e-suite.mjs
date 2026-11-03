// Lot K4 (partie 1) — les étapes e2e de la CI, **calculées depuis les fiches des jeux** (`config/jeux/<id>.json` : `e2e.suite`, `e2e.dossier`, `e2e.projet`, `app`). Avant ce lot, `ci.yml` avait un
// bloc par jeu (construction, étape de part, étape du petit ensemble, dépôt du rapport) : un jeu neuf ne tournait pas sans qu'on retouche le workflow. Maintenant le workflow appelle ce script, qui
// sait quelles suites existent, comment chacune se construit et quel projet Playwright la lance.
//   node scripts/e2e-suite.mjs construire <suite>            → construit ce que la suite exige (la suite hôte et le petit ensemble : tous les jeux et le serveur ; un autre jeu : lui seul)
//   node scripts/e2e-suite.mjs part <suite> <part>/<total>   → une part de Chromium de la CI complète (composée par durée : scripts/e2e-parts.mjs), un test à la fois
//   node scripts/e2e-suite.mjs petit-ensemble <navigateur>   → le petit ensemble `@navigateurs` de chaque jeu, l'un après l'autre (un rapport chacun) ; tous sont lancés, un échec fait échouer le tout
//   node scripts/e2e-suite.mjs construire-pr                → construit ce qu'exige la part d'une PR (variable MATRICE) : la suite hôte exige tout, sinon chaque jeu qui a des specs se construit seul
//   node scripts/e2e-suite.mjs pr                            → la part d'une PR : les specs de chaque suite (variable MATRICE : la ligne de la matrice `e2e_pr_matrice`)
//   node scripts/e2e-suite.mjs stabilite                      → la matrice de .github/workflows/stabilite.yml (e2e/stabilite.json + les fiches)
//   node scripts/e2e-suite.mjs blobs <dossier>               → rassemble les rapports « blob » de tous les jeux dans <dossier> (un seul dépôt d'artefact)
// Variables lues (jamais d'une donnée de tiers) : PARTS_OPT et PW_OPT (CI de main : `--essentiel`, `--grep-invert=@regression`), E2E_DUREES (e2e-parts.mjs), JOB_INDEX (nom du rapport d'une part de PR).
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SUITES, projetDe, suiteNommee } from "./fiches-lecture.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
/** La date du lancement de test : les e2e tournent le 20/10/2026 (horloge maîtrisée), les archives des jeux commencent au circuit n° 1 (lot R8). */
export const PREMIER_JOUR_DES_E2E = "2026-10-13";

/** Pseudo-suite du petit ensemble Firefox et WebKit (la matrice de `ci-zones.mjs`). */
export const SUITE_DU_PETIT_ENSEMBLE = "navigateurs";
/** La suite hôte : celle dont le projet n'a pas de préfixe (Track, qui héberge les specs du portail et de la plateforme : elle exige tous les jeux et le serveur construits). */
const HOTE = SUITES.find((s) => s.projet === "");

/**
 * La matrice du workflow `stabilite.yml` : chaque test de `e2e/stabilite.json` (`jeu` = le nom d'une suite) reçoit son projet Playwright pour son navigateur, le dossier de son application et son nom.
 * Un test d'un jeu inconnu est refusé.
 */
export function matriceDeStabilite(stabilite) {
  const include = stabilite.tests.map((t) => {
    const s = suiteNommee(t.jeu);
    if (!s) throw new Error(`e2e/stabilite.json : « ${t.jeu} » n'est la suite d'aucun jeu (${SUITES.map((x) => x.suite).join(", ")})`);
    return { ...t, nom: `${t.jeu}/${t.fichier}${t.titre ? " › " + t.titre : ""} (${t.navigateur})`, projet: projetDe(t.jeu, t.navigateur), app: s.app };
  });
  return { matrix: { include }, repetitions: stabilite.repetitions };
}

/** Les commandes de construction d'une suite : `[{ cmd, args }]`. */
export function commandesDeConstruction(suite) {
  if (suite === SUITE_DU_PETIT_ENSEMBLE || suite === HOTE.suite) return [{ cmd: "npm", args: ["run", "build"] }, { cmd: "npm", args: ["run", "build:node", "-w", "@cdj/api"] }];
  const s = suiteNommee(suite);
  if (!s) throw new Error(`suite inconnue : ${suite}`);
  return [{ cmd: "npm", args: ["run", "build", "-w", s.espace] }];
}

/** Les commandes de construction d'une part de PR : les suites qui ont des specs (`matrice[suite]`) ; la suite hôte construit tout, sinon un jeu se construit seul. */
export function commandesDeConstructionDePr(matrice) {
  const avecSpecs = SUITES.filter((s) => String(matrice[s.suite] ?? "").trim() !== "");
  if (avecSpecs.some((s) => s.suite === HOTE.suite)) return commandesDeConstruction(HOTE.suite);
  return avecSpecs.flatMap((s) => commandesDeConstruction(s.suite));
}

/** `npm run e2e -w <espace> -- <args>` pour une suite. */
const e2e = (s, args) => ({ cmd: "npm", args: ["run", "e2e", "-w", s.espace, "--", ...args] });

/** Les commandes du petit ensemble `@navigateurs` : une par jeu, avec le nom de son rapport. */
export function commandesDuPetitEnsemble(navigateur) {
  return SUITES.map((s) => ({ ...e2e(s, [`--project=${projetDe(s.suite, navigateur)}`]), rapport: `report-${navigateur}-${s.suite}.zip` }));
}

/** Les commandes d'une part de la CI complète (Chromium) : la liste de tests est écrite par `e2e-parts.mjs`. */
export function commandesDUnePart(suite, part, { partsOpt = [], pwOpt = [] } = {}) {
  const s = suiteNommee(suite);
  if (!s) throw new Error(`suite inconnue : ${suite}`);
  const projet = projetDe(suite, "chromium");
  return { liste: { cmd: "node", args: ["scripts/e2e-parts.mjs", part, projet, ...partsOpt] }, test: (fichier) => e2e(s, [`--project=${projet}`, "--workers=1", "--test-list", fichier, ...pwOpt]) };
}

/** Les commandes d'une part de PR : pour chaque suite qui a des specs (`matrice[suite]`, des noms séparés par des espaces), sa liste de tests puis son lancement, sans les tests `@regression`. */
export function commandesDeLaPartDePr(matrice, indice = "0") {
  return SUITES.filter((s) => String(matrice[s.suite] ?? "").trim() !== "").map((s) => ({
    suite: s.suite,
    rapport: `report-pr-${s.suite}-${indice}.zip`,
    specs: String(matrice[s.suite]).trim().split(/\s+/).map((f) => `${s.suite}/${f}`),
    ...e2e(s, [`--project=${projetDe(s.suite, "chromium")}`, "--workers=1", "--test-list", "<liste>", "--grep-invert=@regression"]),
  }));
}

function lancer({ cmd, args }, env = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: "inherit", env: { ...process.env, ...env } });
  return r.status ?? 1;
}

/** Les rapports « blob » de tous les jeux (`<dossier du jeu>/blob-report/*.zip`), copiés à plat dans `dest`. Rend le nombre de fichiers. */
export function rassemblerRapports(dest, racine = ROOT) {
  mkdirSync(dest, { recursive: true });
  let n = 0;
  const apps = existsSync(join(racine, "apps")) ? readdirSync(join(racine, "apps")) : [];
  for (const app of apps) {
    const dossier = join(racine, "apps", app, "blob-report");
    if (!existsSync(dossier)) continue;
    for (const f of readdirSync(dossier).filter((x) => x.endsWith(".zip"))) {
      copyFileSync(join(dossier, f), join(dest, f));
      n++;
    }
  }
  return n;
}

const opts = (variable) => (process.env[variable] ?? "").split(/\s+/).filter(Boolean);

function main(argv) {
  const [cmd, a, b] = argv;
  const env = { VITE_LANCEMENT_PREMIER_JOUR: PREMIER_JOUR_DES_E2E };
  if (cmd === "construire") {
    for (const c of commandesDeConstruction(a)) if (lancer(c, env) !== 0) process.exit(1);
  } else if (cmd === "construire-pr") {
    for (const c of commandesDeConstructionDePr(JSON.parse(process.env.MATRICE ?? "{}"))) if (lancer(c, env) !== 0) process.exit(1);
  } else if (cmd === "part") {
    const { liste, test } = commandesDUnePart(a, b, { partsOpt: opts("PARTS_OPT"), pwOpt: opts("PW_OPT") });
    const fichier = join(process.env.RUNNER_TEMP ?? "/tmp", "part.txt");
    const r = spawnSync(liste.cmd, liste.args, { cwd: ROOT, encoding: "utf8", env: process.env });
    if (r.status !== 0) process.exit(r.status ?? 1);
    process.stderr.write(r.stderr ?? "");
    writeFileSync(fichier, r.stdout);
    process.exit(lancer(test(fichier)));
  } else if (cmd === "petit-ensemble") {
    let code = 0;
    for (const c of commandesDuPetitEnsemble(a)) if (lancer(c, { E2E_BLOB_NAME: c.rapport }) !== 0) code = 1;
    process.exit(code);
  } else if (cmd === "pr") {
    const matrice = JSON.parse(process.env.MATRICE ?? "{}");
    let code = 0;
    for (const c of commandesDeLaPartDePr(matrice, process.env.JOB_INDEX ?? "0")) {
      const liste = join(process.env.RUNNER_TEMP ?? "/tmp", `part-${c.suite}.txt`);
      const r = spawnSync("node", ["scripts/e2e-parts.mjs", "liste", "chromium", ...c.specs], { cwd: ROOT, encoding: "utf8" });
      if (r.status !== 0) {
        code = 1;
        continue;
      }
      writeFileSync(liste, r.stdout);
      if (lancer({ cmd: c.cmd, args: c.args.map((x) => (x === "<liste>" ? liste : x)) }, { E2E_BLOB_NAME: c.rapport }) !== 0) code = 1;
    }
    process.exit(code);
  } else if (cmd === "stabilite") {
    const m = matriceDeStabilite(JSON.parse(readFileSync(join(ROOT, "e2e/stabilite.json"), "utf8")));
    console.log(`matrix=${JSON.stringify(m.matrix)}\nrepetitions=${m.repetitions}`);
  } else if (cmd === "blobs") {
    console.log(`${rassemblerRapports(a)} rapport(s) rassemblé(s) dans ${a}`);
  } else {
    console.error("usage : node scripts/e2e-suite.mjs construire <suite> | construire-pr | part <suite> <part>/<total> | petit-ensemble <navigateur> | pr | blobs <dossier>");
    process.exit(2);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
