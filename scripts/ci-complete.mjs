// La production exige la CI COMPLÈTE du commit (lot R3 ; lot R12 : le bouton la lance lui-même). Utilisé par .github/workflows/production.yml.
// « CI complète » = le mode `complet` de ci.yml (tout : unitaires, Essentiel ET Régression, Firefox et WebKit, quarantaine bloquante), c'est-à-dire :
//   - le job `ci` de « Mettre en production » (ci.yml appelé par `workflow_call`, ses jobs s'appellent « ci / … ») ;
//   - ou un run de ci.yml lancé la nuit (`schedule`) ou par « Run workflow » (`workflow_dispatch`, mode `complet`).
// Un run `push` de `main` (mode `main` : l'Essentiel seulement, lot R13) ou de PR ne compte JAMAIS ; un run `workflow_dispatch` en mode `pr` (le commit des
// jours figés) non plus : sa matrice n'a pas de job `e2e-parts`.
//   GITHUB_TOKEN=… node scripts/ci-complete.mjs reprise <owner/dépôt> <sha> [--sortie <fichier>]
//     → un run complet VERT existe-t-il déjà pour ce commit exact ? `reprise=true|false`, `run`, `url`, `duree` (jamais en échec : sans réponse, on relance).
//   GITHUB_TOKEN=… node scripts/ci-complete.mjs verdict <owner/dépôt> <sha> (--run <id du run courant> | --reprise <id> [--appele]) [--echecs-e2e <json>] [--resume f] [--sortie f]
//     → code 0 si la CI complète (celle du bouton ou celle reprise) est verte ; 1 sinon, avec les jobs et tests rouges et la phrase à suivre.
//   GITHUB_TOKEN=… node scripts/ci-complete.mjs statuts <owner/dépôt> <sha> test,e2e [--attente-max <minutes>]
//     → attend que les statuts nommés du commit soient finis ; code 0 s'ils sont tous verts (le commit des jours figés avant sa fusion).
// Décisions pures (`jugerJobs`, `candidats`, `resumeVerdict`, `jugerStatuts`) testées dans apps/web/test/ciComplete.test.ts.

import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { api, jeton } from "./github-api.mjs";

export const CI_WORKFLOW = "ci.yml";
export const PRODUCTION_WORKFLOW = "production.yml";
/** Le nom du job de production.yml qui appelle ci.yml : ses jobs s'affichent « ci / test », « ci / e2e-parts (…) »… */
export const JOB_APPELANT = "ci";
/** Événements d'un run de ci.yml qui peuvent être complets (la nuit, « Run workflow ») ; `push` (mode `main`) et `pull_request` jamais. */
export const EVENEMENTS_COMPLETS = ["schedule", "workflow_dispatch"];

const PHRASE_ROUGE = "Lance le lot de mise en production avec ce run";

/** Les jobs de CI d'un run, nom court : tous ceux de ci.yml, ou ceux qu'appelle production.yml (« ci / … », préfixe retiré). */
export function jobsDeCi(jobs, appele) {
  const prefixe = `${JOB_APPELANT} / `;
  return (jobs ?? []).filter((j) => !appele || j.name.startsWith(prefixe)).map((j) => ({ ...j, court: appele ? j.name.slice(prefixe.length) : j.name }));
}

/**
 * Où en est une CI d'après ses jobs (noms courts) : `{ state: "attendre" | "vert" | "rouge" | "incomplet", rouges }`.
 * Complète = au moins un job `e2e-parts` (la matrice des CI complètes) ; verte = verdicts `test` et `e2e` réussis et aucun job en échec.
 */
export function jugerJobs(jobs) {
  if (!jobs.length) return { state: "incomplet", rouges: [] };
  if (jobs.some((j) => j.status !== "completed")) return { state: "attendre", rouges: [] };
  const rouges = jobs.filter((j) => !["success", "skipped"].includes(j.conclusion)).map((j) => j.court);
  if (!jobs.some((j) => j.court.startsWith("e2e-parts"))) return { state: rouges.length ? "rouge" : "incomplet", rouges };
  const verdicts = ["test", "e2e"].every((n) => jobs.some((j) => j.court === n && j.conclusion === "success"));
  return rouges.length || !verdicts ? { state: "rouge", rouges: rouges.length ? rouges : ["test / e2e"] } : { state: "vert", rouges: [] };
}

/**
 * Les runs qui peuvent porter une CI complète de `sha`, du plus récent au plus ancien : ci.yml lancé la nuit ou à la main et fini en vert,
 * ou un run de « Mettre en production » (son job `ci` peut être vert même si la suite s'est arrêtée).
 */
export function candidats(runsCi, runsProd, sha) {
  const recent = (a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id;
  const ci = (runsCi ?? []).filter((r) => r.head_sha === sha && EVENEMENTS_COMPLETS.includes(r.event) && r.status === "completed" && r.conclusion === "success").map((r) => ({ ...r, appele: false }));
  const prod = (runsProd ?? []).filter((r) => r.head_sha === sha && r.status === "completed").map((r) => ({ ...r, appele: true }));
  return [...ci, ...prod].sort(recent);
}

/** La durée d'une CI (min arrondies) : du premier job lancé au dernier fini. */
export function dureeMin(jobs) {
  const debut = Math.min(...jobs.filter((j) => j.started_at).map((j) => Date.parse(j.started_at)));
  const fin = Math.max(...jobs.filter((j) => j.completed_at).map((j) => Date.parse(j.completed_at)));
  return Number.isFinite(debut) && Number.isFinite(fin) && fin >= debut ? Math.round((fin - debut) / 60_000) : null;
}

/** Le texte du résumé : vert (relancée ou reprise, lien, durée) ou rouge (jobs et tests rouges, et la phrase à suivre). */
export function resumeVerdict({ state, rouges = [], echecsE2e = [], url, duree, reprise, sha }) {
  const qui = reprise ? "reprise (un run complet vert de ce commit existait déjà)" : "relancée par le bouton";
  if (state === "vert") return `### ✅ CI complète : verte — ${qui}\n\nCommit \`${sha.slice(0, 7)}\`${duree != null ? `, ${duree} min` : ""} : ${url}\n`;
  const l = [`### ⛔ CI complète : rouge — rien n'est parti`, "", `**${PHRASE_ROUGE} : ${url}**`, "", `Commit \`${sha.slice(0, 7)}\`. Jobs en échec : ${rouges.length ? rouges.join(", ") : "—"}.`];
  if (echecsE2e.length) l.push("", "Tests e2e rouges :", "", ...echecsE2e.slice(0, 20).map((t) => `- ${t}`), ...(echecsE2e.length > 20 ? [`- … et ${echecsE2e.length - 20} autre(s)`] : []));
  l.push("", "Un test unitaire rouge se lit dans le job « unit » du run (le résumé de Vitest). Ni la répétition, ni la sauvegarde, ni la production n'ont été touchées.");
  return l.join("\n") + "\n";
}

/** Les statuts nommés d'un commit (check runs, le plus récent par nom) : `{ state: "attendre" | "vert" | "rouge", detail }`. */
export function jugerStatuts(checkRuns, noms) {
  const detail = [];
  let attendre = false;
  let rouge = false;
  for (const nom of noms) {
    const c = (checkRuns ?? []).filter((r) => r.name === nom).sort((a, b) => Date.parse(b.started_at ?? 0) - Date.parse(a.started_at ?? 0) || b.id - a.id)[0];
    if (!c || c.status !== "completed") attendre = true;
    else if (c.conclusion !== "success") rouge = true;
    detail.push(`${nom} : ${c ? (c.status === "completed" ? c.conclusion : c.status) : "pas encore"}`);
  }
  return { state: rouge ? "rouge" : attendre ? "attendre" : "vert", detail: detail.join(", ") };
}

// ---------------------------------------------------------------------------------------------------------------------------------------

const runs = async (repo, wf, sha, token) => (await api(`/repos/${repo}/actions/workflows/${wf}/runs?head_sha=${sha}&per_page=30`, token)).workflow_runs;
const jobsDu = async (repo, id, token) => {
  const out = [];
  for (let page = 1; page <= 5; page++) {
    const r = await api(`/repos/${repo}/actions/runs/${id}/jobs?filter=latest&per_page=100&page=${page}`, token);
    out.push(...r.jobs);
    if (out.length >= r.total_count || !r.jobs.length) break;
  }
  return out;
};
const ecrire = (fichier, lignes) => fichier && appendFileSync(fichier, lignes.map((l) => `${l}\n`).join(""));

async function reprise(repo, sha, token, sortie) {
  try {
    for (const run of candidats(await runs(repo, CI_WORKFLOW, sha, token), await runs(repo, PRODUCTION_WORKFLOW, sha, token), sha).slice(0, 8)) {
      const jobs = jobsDeCi(await jobsDu(repo, run.id, token), run.appele);
      if (jugerJobs(jobs).state !== "vert") continue;
      const duree = dureeMin(jobs);
      console.log(`CI complète verte trouvée : run ${run.id} (${run.event}) ${run.html_url}`);
      ecrire(sortie, ["reprise=true", `run=${run.id}`, `appele=${run.appele}`, `url=${run.html_url}`, `duree=${duree ?? ""}`]);
      return;
    }
    console.log(`aucun run complet vert pour ${sha.slice(0, 7)} : le bouton lance la CI complète`);
  } catch (e) {
    console.log(`lecture impossible (${e.message}) : le bouton lance la CI complète`);
  }
  ecrire(sortie, ["reprise=false"]);
}

async function verdict(repo, sha, token, opt) {
  const id = opt("--reprise") || opt("--run");
  // Le run du bouton (courant, ou un run de production.yml repris) : ses jobs de CI s'appellent « ci / … » ; un run de ci.yml repris : sans préfixe.
  const reprise = Boolean(opt("--reprise"));
  const appele = !reprise || argv.includes("--appele");
  const url = `https://github.com/${repo}/actions/runs/${id}`;
  let jobs = [];
  let v;
  try {
    jobs = jobsDeCi(await jobsDu(repo, id, token), appele);
    v = jugerJobs(jobs);
  } catch (e) {
    v = { state: "rouge", rouges: [`lecture impossible (${e.message})`] };
  }
  if (v.state === "incomplet" || v.state === "attendre") v = { state: "rouge", rouges: [v.state === "incomplet" ? "aucune CI complète dans ce run" : "CI pas finie"] };
  let echecsE2e = [];
  try {
    echecsE2e = JSON.parse(opt("--echecs-e2e") || "[]");
  } catch {
    /* sortie illisible : les jobs rouges suffisent */
  }
  const duree = dureeMin(jobs);
  const texte = resumeVerdict({ ...v, echecsE2e, url, duree, reprise, sha });
  if (opt("--resume")) appendFileSync(opt("--resume"), texte);
  ecrire(opt("--sortie"), [`etat=${v.state}`, `url=${url}`, `duree=${duree ?? ""}`, `qui=${reprise ? "reprise" : "relancée"}`]);
  process.stdout.write(texte);
  if (v.state !== "vert") console.log(`::error title=CI complète rouge::${PHRASE_ROUGE} : ${url}`);
  return v.state === "vert" ? 0 : 1;
}

async function statuts(repo, sha, noms, token, attenteMax) {
  const limite = Date.now() + attenteMax * 60_000;
  for (;;) {
    let v;
    try {
      v = jugerStatuts((await api(`/repos/${repo}/commits/${sha}/check-runs?per_page=100`, token)).check_runs, noms);
    } catch (e) {
      v = { state: "attendre", detail: `lecture impossible (${e.message})` };
    }
    if (v.state !== "attendre") {
      console.log(`${sha.slice(0, 7)} — ${v.detail}`);
      return v.state === "vert" ? 0 : 1;
    }
    if (Date.now() > limite) {
      console.log(`${sha.slice(0, 7)} — délai dépassé (${v.detail})`);
      return 1;
    }
    await new Promise((r) => setTimeout(r, 30_000));
  }
}

async function main(argv) {
  const [cmd, repo, sha, ...rest] = argv;
  const opt = (name, def) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : def);
  const token = jeton();
  if (!["reprise", "verdict", "statuts"].includes(cmd) || !repo || !/^[0-9a-f]{40}$/.test(sha ?? "") || !token) {
    console.error("usage : GITHUB_TOKEN=… node scripts/ci-complete.mjs reprise|verdict|statuts <owner/dépôt> <sha 40> … (voir l'en-tête du fichier)");
    process.exit(2);
  }
  if (cmd === "reprise") return reprise(repo, sha, token, opt("--sortie"));
  if (cmd === "verdict") process.exit(await verdict(repo, sha, token, opt));
  process.exit(await statuts(repo, sha, (rest[0] ?? "").split(",").filter(Boolean), token, Number(opt("--attente-max", "45"))));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main(process.argv.slice(2));
