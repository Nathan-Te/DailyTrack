// Lot R17 (plateforme, CI) — LE contrôle des budgets de poids : une seule source pour les plafonds (docs/plateforme/budgets.md), une seule mesure (scripts/budgets.mjs, `mesuresParLigne`),
// un seul endroit qui compare (ce fichier). Utilisé par le job « Budgets » de .github/workflows/ci.yml, sur toute PR qui touche ce que charge un joueur (scripts/ci-zones.mjs, `budgetsPour`).
//   npm run build && node scripts/budgets-controle.mjs controler [--main <mesures-de-main.json>] [--mesures <fichier.json>] [--ecrire <fichier.json>] [--resume <fichier>]
//     → mesure toutes les lignes (ou lit `--mesures`), les compare aux plafonds du tableau, écrit le tableau (ligne · plafond · mesure · marge · écart avec main) dans `--resume`
//       (le résumé du job) et sur la sortie, et sort en erreur (code 1) si une ligne dépasse son plafond. `--ecrire` garde les mesures (l'artefact de main).
//   GITHUB_TOKEN=… node scripts/budgets-controle.mjs source --sha <commit de main> [--sortie "$GITHUB_OUTPUT"]
//     → `run=<id>` et `nom=<artefact>` : l'artefact des mesures de main pour ce commit (sinon le plus récent de main) ; vide s'il n'y en a pas.
// **Il ne relève jamais un plafond** : un plafond ne bouge que par une décision de Nathan, avec sa raison dans budgets.md. Les mesures de main ne sont qu'une comparaison (jamais un seuil).
// Décisions pures (`lirePlafonds`, `controler`, `tableau`, `choisirArtefact`) testées dans apps/web/test/budgetsControle.test.ts.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { api, depotPar, jeton } from "./github-api.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Le nom de l'artefact que le run de `main` publie pour un commit. */
export const nomArtefact = (sha) => `budgets-${sha}`;
export const PREFIXE_ARTEFACT = "budgets-";

/**
 * Les lignes du tableau de budgets.md qu'aucune mesure du job ne couvre, et pourquoi. `partage.image` : les images de partage sont dessinées par Chromium (`scripts/images-partage.mjs`,
 * `apps/web/e2e/domaine.spec.ts`, qui la garde toujours) ; le job de budgets, lui, n'a pas de navigateur.
 */
export const HORS_JOB = { "partage.image": "dessinée par Chromium : gardée par scripts/images-partage.mjs et apps/web/e2e/domaine.spec.ts" };

/** Un nombre écrit à la française (« 35 200 », espaces ordinaires, insécables ou fines) → entier. */
const nombre = (s) => Number(String(s).replace(/[\s  ]/g, ""));

/**
 * Les plafonds de budgets.md : `{ clé: octets }`. Une ligne est `| \`clé\` | application | mesure | plafond | … |` : celle du grand tableau (8 colonnes) comme celle des petits
 * tableaux du lot T9 (`tower.decors`, `tower.habits` : 5 colonnes). Le plafond est la quatrième colonne dans les deux.
 */
export function lirePlafonds(texte) {
  const out = {};
  for (const m of texte.matchAll(/^\| `([a-zA-Z0-9.]+)` \| [^|]*\| [^|]*\| ([\d\s  ]+) \|/gm)) out[m[1]] = nombre(m[2]);
  return out;
}

/**
 * Compare les mesures aux plafonds. Une ligne qui dépasse (`mesure > plafond` : « tenir dans le plafond », l'égalité tient) est un dépassement ; une ligne du tableau sans mesure (hors
 * `HORS_JOB`) ou une mesure sans ligne dans le tableau est une erreur de plomberie (jamais un silence : sinon une ligne ajoutée à budgets.md ne serait gardée par personne).
 */
export function controler(plafonds, mesures) {
  const lignes = [];
  for (const [cle, plafond] of Object.entries(plafonds)) {
    if (cle in HORS_JOB) continue;
    const mesure = mesures[cle];
    if (!Number.isFinite(mesure)) continue;
    lignes.push({ cle, plafond, mesure, marge: plafond - mesure, ok: mesure <= plafond });
  }
  return {
    lignes,
    depassements: lignes.filter((l) => !l.ok),
    sansMesure: Object.keys(plafonds).filter((c) => !(c in HORS_JOB) && !Number.isFinite(mesures[c])),
    sansPlafond: Object.keys(mesures).filter((c) => !(c in plafonds)),
  };
}

const groupes = (n) => String(Math.abs(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
/** « 12 345 » ; les négatifs avec le vrai signe moins. */
export const fmt = (n) => (n < 0 ? "−" : "") + groupes(n);
/** L'écart avec main : « +120 », « −3 », « 0 », « nouveau » (la ligne n'existait pas) ou « — » (pas de mesure de main). */
export function ecart(mesure, ancien, avecMain = true) {
  if (!avecMain) return "—";
  if (!Number.isFinite(ancien)) return "nouveau";
  const d = mesure - ancien;
  return d === 0 ? "0" : `${d > 0 ? "+" : "−"}${groupes(d)}`;
}

/**
 * Le tableau du résumé du job : ligne · plafond · mesure · marge · écart avec main, un ⛔ devant la ligne qui dépasse (marge négative). `main` : `{ sha, mesures }` ou null ; `exact` : la
 * mesure de main est celle du commit dont part la PR (sinon la plus récente, dite telle).
 */
export function tableau(res, main = null, { exact = true } = {}) {
  const l = [];
  const avecMain = !!main;
  l.push(res.depassements.length ? `### ⛔ Budgets : ${res.depassements.length} ligne(s) dépassent leur plafond` : "### ✅ Budgets : toutes les lignes tiennent dans leur plafond");
  l.push("");
  l.push(avecMain ? `Écart avec \`main\` (${exact ? "le commit dont part la PR" : "la mesure la plus récente de main, pas forcément le commit dont part la PR"}, \`${String(main.sha ?? "?").slice(0, 7)}\`) : octets, + = la PR grossit.` : "Écart avec `main` : aucune mesure de `main` disponible (artefact absent ou expiré).");
  l.push("");
  l.push("| ligne | plafond (o) | mesure (o) | marge (o) | écart avec main (o) |", "|---|---:|---:|---:|---:|");
  for (const x of res.lignes) l.push(`| ${x.ok ? "" : "⛔ "}\`${x.cle}\` | ${fmt(x.plafond)} | ${fmt(x.mesure)} | ${fmt(x.marge)} | ${ecart(x.mesure, main?.mesures?.[x.cle], avecMain)} |`);
  for (const [cle, pourquoi] of Object.entries(HORS_JOB)) l.push(`| \`${cle}\` | — | — | — | non mesurée ici (${pourquoi}) |`);
  l.push("");
  if (res.depassements.length) {
    l.push("**Dépassements** :", "");
    for (const x of res.depassements) l.push(`- \`${x.cle}\` : ${fmt(x.mesure)} o pour ${fmt(x.plafond)} o, **${fmt(-x.marge)} o de trop**`);
    l.push("", "Un dépassement se corrige dans cette PR (charger à la demande, retirer du premier chargement). Le job ne relève jamais un plafond : c'est une décision de Nathan, avec sa raison dans `docs/plateforme/budgets.md`.");
  }
  for (const c of res.sansMesure) l.push(`- ⛔ \`${c}\` est dans budgets.md mais le job ne la mesure pas (\`CLES_MESUREES\` de scripts/budgets.mjs)`);
  for (const c of res.sansPlafond) l.push(`- ⛔ \`${c}\` est mesurée mais n'a pas de ligne dans budgets.md`);
  return l.join("\n") + "\n";
}

/** Des mesures lues dans un fichier (artefact de main : une donnée, jamais exécutée) : `{ sha, mesures }` ou null si ce n'est pas ce format. */
export function validerMesures(brut) {
  if (!brut || typeof brut !== "object" || brut.format !== 1 || !brut.mesures || typeof brut.mesures !== "object") return null;
  const mesures = {};
  for (const [c, v] of Object.entries(brut.mesures)) if (/^[a-zA-Z0-9.]{1,40}$/.test(c) && Number.isFinite(v) && v >= 0 && v < 1e10) mesures[c] = v;
  return { sha: typeof brut.sha === "string" && /^[0-9a-f]{7,40}$/.test(brut.sha) ? brut.sha : "", mesures };
}

/**
 * L'artefact de mesures de `main` à comparer : celui du commit dont part la PR (nom `budgets-<sha>`), sinon le plus récent de `main` (non expiré). `{ run, nom, exact }` ou null.
 * `artefacts` : la liste de l'API (`/actions/artifacts`), du plus récent au plus ancien.
 */
export function choisirArtefact(artefacts, sha) {
  const bons = (artefacts ?? []).filter((a) => a && !a.expired && typeof a.name === "string" && a.name.startsWith(PREFIXE_ARTEFACT) && a.workflow_run?.head_branch === "main" && Number.isFinite(a.workflow_run?.id));
  const exact = sha ? bons.find((a) => a.name === nomArtefact(sha)) : undefined;
  const choisi = exact ?? [...bons].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  return choisi ? { run: String(choisi.workflow_run.id), nom: choisi.name, exact: !!exact } : null;
}

export async function artefactDeMain(depot, sha, token, lire = api) {
  const liste = async (q) => (await lire(`/repos/${depot}/actions/artifacts?per_page=100${q}`, token)).artifacts ?? [];
  const exact = sha ? await liste(`&name=${nomArtefact(sha)}`) : [];
  return choisirArtefact([...exact, ...(await liste(""))], sha);
}

function main(argv) {
  const opt = (nom) => (argv.includes(nom) ? argv[argv.indexOf(nom) + 1] : undefined);
  const [commande] = argv;
  if (commande === "controler") return controlerCli(opt);
  if (commande === "source") return sourceCli(opt, argv);
  console.error("usage : node scripts/budgets-controle.mjs controler [--main f] [--mesures f] [--ecrire f] [--resume f] | source --sha <commit> [--sortie f]");
  process.exit(2);
}

async function controlerCli(opt) {
  const plafonds = lirePlafonds(readFileSync(join(ROOT, "docs/plateforme/budgets.md"), "utf8"));
  let mesures;
  if (opt("--mesures")) mesures = validerMesures(JSON.parse(readFileSync(opt("--mesures"), "utf8")))?.mesures ?? {};
  else mesures = (await import("./budgets.mjs")).mesuresParLigne();
  const res = controler(plafonds, mesures);
  let precedent = null;
  if (opt("--main")) {
    try {
      precedent = validerMesures(JSON.parse(readFileSync(opt("--main"), "utf8")));
    } catch {
      console.log("::warning::les mesures de main sont illisibles : pas de colonne d'écart");
    }
  }
  const exact = process.env.BUDGETS_MAIN_EXACT !== "false";
  const texte = tableau(res, precedent, { exact });
  process.stdout.write(texte);
  if (opt("--resume")) appendFileSync(opt("--resume"), texte);
  if (opt("--ecrire")) writeFileSync(opt("--ecrire"), JSON.stringify({ format: 1, sha: process.env.GITHUB_SHA ?? "", mesures }) + "\n");
  for (const x of res.depassements) console.log(`::error title=Budget dépassé::${x.cle} : ${fmt(x.mesure)} o pour un plafond de ${fmt(x.plafond)} o (${fmt(-x.marge)} o de trop)`);
  for (const c of [...res.sansMesure, ...res.sansPlafond]) console.log(`::error title=Budgets : plomberie::${c} : ligne de budgets.md et mesure ne correspondent pas`);
  if (res.depassements.length || res.sansMesure.length || res.sansPlafond.length) process.exit(1);
}

async function sourceCli(opt, argv) {
  let trouve = null;
  try {
    trouve = await artefactDeMain(depotPar(argv), opt("--sha") ?? "", jeton());
  } catch (e) {
    console.log(`::warning::mesures de main illisibles (${e.message}) : pas de colonne d'écart`);
  }
  const lignes = [`run=${trouve?.run ?? ""}`, `nom=${trouve?.nom ?? ""}`, `exact=${trouve?.exact ?? false}`];
  if (opt("--sortie")) appendFileSync(opt("--sortie"), lignes.join("\n") + "\n");
  else process.stdout.write(lignes.join("\n") + "\n");
  if (!trouve) console.log("aucune mesure de main disponible : le tableau n'aura pas de colonne d'écart");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main(process.argv.slice(2));
