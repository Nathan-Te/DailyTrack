// Lot R17 (plateforme, CI) — LE contrôle des budgets de poids : une seule source pour les plafonds (docs/plateforme/budgets.md), une seule mesure (scripts/budgets.mjs, `mesuresParLigne`),
// un seul endroit qui compare (ce fichier). Utilisé par le job « Budgets » de .github/workflows/ci.yml, sur toute PR qui touche ce que charge un joueur (scripts/ci-zones.mjs, `budgetsPour`).
// **Lot B1 — des budgets qui protègent sans gêner** : les plafonds s'écrivent en Ko (1 Ko = 1 000 o), posés une fois avec une marge proportionnelle (`FAMILLES` : premier chargement mesure + 5 %
// et 2 Ko au moins ; à la demande + 10 % et 1 Ko ; polices et images + 10 %). Le job **échoue seulement si une ligne dépasse son plafond** ; il **avertit sans bloquer** quand une PR fait grossir une ligne
// de plus de 3 Ko ou de plus de 1 % par rapport à main ; `recaler` **propose** de nouveaux plafonds quand une mesure a baissé de plus que sa marge (jamais appliqués).
//   npm run build && node scripts/budgets-controle.mjs controler [--main <mesures-de-main.json>] [--mesures <fichier.json>] [--ecrire <fichier.json>] [--resume <fichier>]
//     → mesure toutes les lignes (ou lit `--mesures`), les compare aux plafonds du tableau, écrit le tableau (ligne · plafond · mesure · marge · écart avec main, en Ko) dans `--resume`
//       (le résumé du job) et sur la sortie, et sort en erreur (code 1) si une ligne dépasse son plafond. `--ecrire` garde les mesures (l'artefact de main).
//   npm run budgets -- --recaler   (ou : node scripts/budgets-controle.mjs recaler [--mesures <fichier.json>])
//     → les plafonds que la règle donnerait aujourd'hui, pour les seules lignes dont la mesure a baissé de plus que sa marge. Ne modifie rien : un lot l'applique quand Nathan le veut.
//   GITHUB_TOKEN=… node scripts/budgets-controle.mjs source --sha <commit de main> [--sortie "$GITHUB_OUTPUT"]
//     → `run=<id>` et `nom=<artefact>` : l'artefact des mesures de main pour ce commit (sinon le plus récent de main) ; vide s'il n'y en a pas.
// **Il ne relève jamais un plafond** : un plafond ne bouge que par une décision de Nathan, avec sa raison dans budgets.md (section « Relèvements »). Les mesures de main ne sont qu'une comparaison.
// Décisions pures (`lirePlafonds`, `lireLignes`, `plafondKo`, `controler`, `avertissements`, `tableau`, `proposerRecalage`, `choisirArtefact`) testées dans apps/web/test/budgetsControle.test.ts.
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

/** Un Ko = 1 000 octets (les plafonds, les marges et le résumé). */
export const KO = 1000;

/**
 * La règle des plafonds (lot B1, décision de Nathan) : plafond = mesure + marge, arrondi **au Ko supérieur**. La marge est un pourcentage de la mesure, **avec un plancher** : le premier chargement
 * (portail, accueil et premier chargement de chaque jeu) mesure + 5 % et au moins 2 Ko ; ce qui est chargé à la demande mesure + 10 % et au moins 1 Ko ; les polices et les images mesure + 10 %.
 * La famille s'écrit dans le tableau (colonne « Famille ») : `premier`, `demande`, `police`.
 */
export const FAMILLES = {
  premier: { pct: 5, plancherKo: 2, nom: "premier chargement" },
  demande: { pct: 10, plancherKo: 1, nom: "à la demande" },
  police: { pct: 10, plancherKo: 0, nom: "polices et images" },
};

/** La marge que la règle donne à une mesure, en octets. */
export const margeRegle = (famille, mesure) => Math.max(Math.ceil((mesure * FAMILLES[famille].pct) / 100), FAMILLES[famille].plancherKo * KO);
/** Le plafond que la règle donne à une mesure, en Ko entiers (arrondi au Ko supérieur). */
export const plafondKo = (famille, mesure) => Math.ceil((mesure + margeRegle(famille, mesure)) / KO);

/**
 * L'avertissement (lot B1) : une PR qui fait grossir une ligne de plus de 3 Ko, ou de plus de 1 %, par rapport à main. Il ne bloque jamais. **Un plancher de 200 o** écarte le bruit de construction
 * (1 % d'une ligne de 149 o, ce sont deux octets : un nom de fichier qui change).
 */
export const AVERTIR = { ko: 3, pct: 1, plancher: 200 };

/** Un nombre écrit à la française (« 35 200 », espaces ordinaires, insécables ou fines) → entier. */
const nombre = (s) => Number(String(s).replace(/[\s\u00a0\u202f]/g, ""));

/**
 * Les lignes du tableau de budgets.md : `{ clé: { plafond (octets), plafondKo, famille, mesure (à la pose, en octets) } }`. Une ligne est
 * `| \`clé\` | application | ce qui est mesuré | famille | 38 Ko | 35 189 | … |` ; les autres tableaux du fichier ne sont pas lus.
 */
export function lireLignes(texte) {
  const out = {};
  for (const ligne of texte.split("\n")) {
    if (!ligne.startsWith("| `")) continue;
    const c = ligne.split("|").map((x) => x.trim());
    const cle = /^`([a-zA-Z0-9.]+)`$/.exec(c[1] ?? "")?.[1];
    const ko = /^(\d[\d\s\u00a0\u202f]*) Ko$/.exec(c[5] ?? "");
    if (!cle || !ko || !(c[4] in FAMILLES) || !/^[\d\s\u00a0\u202f]+$/.test(c[6] ?? "")) continue;
    out[cle] = { plafond: nombre(ko[1]) * KO, plafondKo: nombre(ko[1]), famille: c[4], mesure: nombre(c[6]) };
  }
  return out;
}

/** Les plafonds de budgets.md : `{ clé: octets }`. */
export const lirePlafonds = (texte) => Object.fromEntries(Object.entries(lireLignes(texte)).map(([c, l]) => [c, l.plafond]));

/** Les relèvements décidés par Nathan (section « Relèvements » de budgets.md) : `{ clé: [{ date, de, a, raison }] }` ; une ligne est `| AAAA-MM-JJ | \`clé\` | 38 Ko | 41 Ko | la raison |`. */
export function lireReleves(texte) {
  const out = {};
  for (const ligne of texte.split("\n")) {
    const m = /^\|\s*(\d{4}-\d{2}-\d{2})\s*\|\s*`([a-zA-Z0-9.]+)`\s*\|\s*(\d[\d\s\u00a0\u202f]*) Ko\s*\|\s*(\d[\d\s\u00a0\u202f]*) Ko\s*\|\s*(.+?)\s*\|\s*$/.exec(ligne);
    if (m) (out[m[2]] ??= []).push({ date: m[1], de: nombre(m[3]), a: nombre(m[4]), raison: m[5] });
  }
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
/** Octets : « 12 345 » ; les négatifs avec le vrai signe moins. */
export const fmt = (n) => (n < 0 ? "−" : "") + groupes(n);
/** Ko à la française avec deux décimales (« 296,96 »), négatifs avec le vrai signe moins. */
export const fmtKo = (octets) => {
  const v = Math.abs(octets) / KO;
  const [e, d] = v.toFixed(2).split(".");
  return (octets < 0 && v >= 0.005 ? "−" : "") + groupes(Number(e)) + "," + d;
};
/** L'écart avec main, en Ko : « +0,09 », « −0,01 », « 0 », « nouveau » (la ligne n'existait pas) ou « — » (pas de mesure de main). */
export function ecart(mesure, ancien, avecMain = true) {
  if (!avecMain) return "—";
  if (!Number.isFinite(ancien)) return "nouveau";
  const d = mesure - ancien;
  if (d === 0) return "0";
  const t = fmtKo(Math.abs(d));
  return `${d > 0 ? "+" : "−"}${t}`;
}

/**
 * Les lignes que la PR fait grossir plus que `AVERTIR` (3 Ko ou 1 %) par rapport à main : `[{ cle, mesure, ancien, ecart, pct }]`. Sans mesure de main, rien. Ne bloque jamais.
 */
export function avertissements(res, main) {
  const out = [];
  for (const x of res.lignes) {
    const ancien = main?.mesures?.[x.cle];
    if (!Number.isFinite(ancien) || ancien <= 0) continue;
    const e = x.mesure - ancien;
    if (e < AVERTIR.plancher) continue;
    const pct = (e / ancien) * 100;
    if (e > AVERTIR.ko * KO || pct > AVERTIR.pct) out.push({ cle: x.cle, mesure: x.mesure, ancien, ecart: e, pct });
  }
  return out;
}

/**
 * Le tableau du résumé du job (en Ko) : ligne · plafond · mesure · marge · écart avec main, un ⛔ devant la ligne qui dépasse (marge négative), puis les avertissements de croissance (⚠️, jamais
 * bloquants). `main` : `{ sha, mesures }` ou null ; `exact` : la mesure de main est celle du commit dont part la PR (sinon la plus récente, dite telle).
 */
export function tableau(res, main = null, { exact = true } = {}) {
  const l = [];
  const avecMain = !!main;
  l.push(res.depassements.length ? `### ⛔ Budgets : ${res.depassements.length} ligne(s) dépassent leur plafond` : "### ✅ Budgets : toutes les lignes tiennent dans leur plafond");
  l.push("");
  l.push(avecMain ? `Tailles en Ko (1 Ko = 1 000 o). Écart avec \`main\` (${exact ? "le commit dont part la PR" : "la mesure la plus récente de main, pas forcément le commit dont part la PR"}, \`${String(main.sha ?? "?").slice(0, 7)}\`) : + = la PR grossit.` : "Tailles en Ko (1 Ko = 1 000 o). Écart avec `main` : aucune mesure de `main` disponible (artefact absent ou expiré).");
  l.push("");
  l.push("| ligne | plafond (Ko) | mesure (Ko) | marge (Ko) | écart avec main (Ko) |", "|---|---:|---:|---:|---:|");
  for (const x of res.lignes) l.push(`| ${x.ok ? "" : "⛔ "}\`${x.cle}\` | ${fmtKo(x.plafond)} | ${fmtKo(x.mesure)} | ${fmtKo(x.marge)} | ${ecart(x.mesure, main?.mesures?.[x.cle], avecMain)} |`);
  for (const [cle, pourquoi] of Object.entries(HORS_JOB)) l.push(`| \`${cle}\` | — | — | — | non mesurée ici (${pourquoi}) |`);
  l.push("");
  if (res.depassements.length) {
    l.push("**Dépassements** :", "");
    for (const x of res.depassements) l.push(`- \`${x.cle}\` : ${fmtKo(x.mesure)} Ko pour ${fmtKo(x.plafond)} Ko, **${fmtKo(-x.marge)} Ko de trop** (${fmt(-x.marge)} o)`);
    l.push("", "Un dépassement se corrige dans cette PR (charger à la demande, retirer du premier chargement). Le job ne relève jamais un plafond : c'est une décision de Nathan, avec sa raison dans `docs/plateforme/budgets.md`.");
  }
  const av = avertissements(res, main);
  if (av.length) {
    l.push("", `**⚠️ Croissance par rapport à \`main\`** (avertissement, ne bloque pas : plus de ${AVERTIR.ko} Ko ou plus de ${AVERTIR.pct} %) :`, "");
    for (const a of av) l.push(`- ⚠️ \`${a.cle}\` grossit de **+${fmtKo(a.ecart)} Ko** (+${a.pct.toFixed(1).replace(".", ",")} %) : ${fmtKo(a.ancien)} → ${fmtKo(a.mesure)} Ko`);
    l.push("", "Si la croissance est voulue, rien à faire tant que la ligne tient dans son plafond ; sinon, charger à la demande ou retirer.");
  }
  for (const c of res.sansMesure) l.push(`- ⛔ \`${c}\` est dans budgets.md mais le job ne la mesure pas (\`CLES_MESUREES\` de scripts/budgets.mjs)`);
  for (const c of res.sansPlafond) l.push(`- ⛔ \`${c}\` est mesurée mais n'a pas de ligne dans budgets.md`);
  return l.join("\n") + "\n";
}

/**
 * Le recalage proposé (lot B1) : pour chaque ligne dont la mesure a **baissé de plus que sa marge** (le plafond actuel dépasse de plus d'une marge ce que la règle donne aujourd'hui), le plafond
 * que la règle donnerait. `[{ cle, famille, mesure, plafondKo, propose }]`. **Ne fait que proposer** : aucun fichier n'est écrit ; un lot l'applique quand Nathan le veut.
 */
export function proposerRecalage(lignes, mesures) {
  const out = [];
  for (const [cle, l] of Object.entries(lignes)) {
    const mesure = mesures[cle];
    if (cle in HORS_JOB || !Number.isFinite(mesure)) continue;
    const propose = plafondKo(l.famille, mesure);
    if (l.plafond - propose * KO > margeRegle(l.famille, mesure)) out.push({ cle, famille: l.famille, mesure, plafondKo: l.plafondKo, propose });
  }
  return out;
}

/** Le texte de la proposition (jamais appliquée). */
export function texteRecalage(propositions) {
  if (!propositions.length) return "Aucun recalage à proposer : aucune mesure n'a baissé de plus que sa marge.\n";
  const l = ["Recalage proposé (rien n'est modifié : un lot l'applique quand Nathan le veut, avec sa raison dans budgets.md) :", "", "| ligne | famille | mesure (Ko) | plafond actuel (Ko) | plafond proposé (Ko) |", "|---|---|---:|---:|---:|"];
  for (const p of propositions) l.push(`| \`${p.cle}\` | ${FAMILLES[p.famille].nom} | ${fmtKo(p.mesure)} | ${p.plafondKo} | ${p.propose} |`);
  return l.join("\n") + "\n";
}

/** Le recalage en ligne de commande : lit les plafonds de budgets.md, mesure (ou lit `--mesures`) et écrit la proposition sur la sortie. */
export async function recalerCli(mesures) {
  const lignes = lireLignes(readFileSync(join(ROOT, "docs/plateforme/budgets.md"), "utf8"));
  process.stdout.write(texteRecalage(proposerRecalage(lignes, mesures ?? (await import("./budgets.mjs")).mesuresParLigne())));
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
  if (commande === "recaler") return recalerCli(opt("--mesures") ? (validerMesures(JSON.parse(readFileSync(opt("--mesures"), "utf8")))?.mesures ?? {}) : undefined);
  console.error("usage : node scripts/budgets-controle.mjs controler [--main f] [--mesures f] [--ecrire f] [--resume f] | recaler [--mesures f] | source --sha <commit> [--sortie f]");
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
  for (const x of res.depassements) console.log(`::error title=Budget dépassé::${x.cle} : ${fmtKo(x.mesure)} Ko pour un plafond de ${fmtKo(x.plafond)} Ko (${fmtKo(-x.marge)} Ko de trop)`);
  for (const a of avertissements(res, precedent)) console.log(`::warning title=Budget : la ligne grossit::${a.cle} grossit de +${fmtKo(a.ecart)} Ko (+${a.pct.toFixed(1).replace(".", ",")} %) par rapport à main : ${fmtKo(a.ancien)} → ${fmtKo(a.mesure)} Ko`);
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
