// `npm run attendre-ci` (lot R10) : UNE commande bloquante et silencieuse pour attendre la CI de la branche. Elle attend la fin du run du dernier
// commit poussé (sans rien écrire en attendant : l'agent ne lit rien, ne sonde rien), puis n'écrit que le verdict, job par job ; pour un échec, le
// nom des tests rouges et 20 lignes d'erreur au plus. Jamais le journal complet d'un job.
//   GITHUB_TOKEN=… npm run attendre-ci [-- --branche <nom>] [--sha <commit>] [--attente-max <minutes>] [--pr]
//   code de sortie : 0 vert · 1 rouge · 2 usage, aucun run ou délai dépassé.
// Pour l'événement du run, `pull_request` d'abord (la CI d'une PR), sinon `push`.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { api, depotPar, jeton, relancerAvecProxy } from "./github-api.mjs";

export const LIGNES_D_ERREUR = 20;
export const ATTENTE_MAX_MIN = 45;
export const PAS_S = 20;

const git = (...args) => spawnSync("git", args, { encoding: "utf8" }).stdout.trim();
const sansCouleur = (t) => t.replace(/\u001b\[[0-9;]*m/g, "");
/** Un horodatage de journal GitHub (`2026-10-26T00:12:03.1234567Z `) en tête de ligne. */
const sansHorodatage = (l) => l.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z\s?/, "");

/** Le run à suivre parmi ceux d'un commit : le plus récent (un essai relancé garde l'id), de préférence celui d'une PR. */
export function choisirRun(runs, sha) {
  const miens = (runs ?? []).filter((r) => r.head_sha === sha);
  const pr = miens.filter((r) => r.event === "pull_request");
  const liste = pr.length ? pr : miens;
  return [...liste].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id)[0] ?? null;
}

const SYMBOLE = { success: "✔", failure: "✘", cancelled: "⊘", skipped: "–", timed_out: "✘" };

/** Les lignes de verdict par job (sans les jobs sautés, résumés en un nombre). */
export function verdictParJob(jobs) {
  const faits = jobs.filter((j) => j.conclusion !== "skipped");
  const sautes = jobs.length - faits.length;
  const s = (j) => (j.started_at && j.completed_at ? Math.round((Date.parse(j.completed_at) - Date.parse(j.started_at)) / 1000) : 0);
  const lignes = faits.map((j) => `${SYMBOLE[j.conclusion] ?? "?"} ${j.name} (${s(j)} s)${j.conclusion === "success" ? "" : ` — ${j.conclusion}`}`);
  if (sautes) lignes.push(`– ${sautes} job(s) sauté(s) (rien à lancer pour ces fichiers)`);
  return lignes;
}

/**
 * Les échecs d'un journal de job : les tests rouges (Playwright `1) [chromium] › fichier:ligne › titre`, Vitest `FAIL fichier > titre`) et au plus
 * `n` lignes d'erreur au total, la première erreur de chaque test d'abord.
 */
export function extraireEchecs(journal, n = LIGNES_D_ERREUR) {
  const lignes = sansCouleur(journal).split("\n").map(sansHorodatage);
  const noms = [];
  const erreurs = [];
  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i];
    const pw = /^\s+(\d+\) \[[\w-]+\] › .+?)(?: ─+)?$/.exec(l);
    const vt = /^\s*FAIL\s+(?:\|?(?:sqlite|libsql)\|?\s+)?(\S.*)$/.exec(l);
    if (pw || vt) {
      const nom = (pw ? pw[1] : vt[1]).trim();
      if (!noms.includes(nom)) {
        noms.push(nom);
        // Les lignes qui suivent jusqu'au prochain échec ou à la prochaine ligne vide double : l'erreur.
        const bloc = [];
        for (let j = i + 1; j < lignes.length && bloc.length < 6; j++) {
          const m = lignes[j];
          if (/^\s+\d+\) \[/.test(m) || /^\s*FAIL\s/.test(m) || /^##\[/.test(m)) break;
          if (m.trim()) bloc.push(m.trimEnd());
        }
        erreurs.push(...bloc);
      }
    }
    const ga = /^##\[error\](.+)$/.exec(l);
    if (ga && !/^Process completed with exit code/.test(ga[1].trim()) && !noms.includes(`erreur : ${ga[1].trim()}`)) {
      noms.push(`erreur : ${ga[1].trim()}`);
    }
  }
  const nomsCourts = noms.slice(0, 30);
  return { tests: nomsCourts, erreur: erreurs.slice(0, n), autres: Math.max(0, noms.length - nomsCourts.length) };
}

async function attendre({ depot, token, branche, sha, attenteMax }) {
  const fin = Date.now() + attenteMax * 60_000;
  let essaisSansRun = 0;
  for (;;) {
    const r = await api(`/repos/${depot}/actions/workflows/ci.yml/runs?head_sha=${sha}&per_page=20`, token);
    const run = choisirRun(r.workflow_runs, sha);
    if (!run) {
      // Un push n'a pas encore créé le run : deux minutes de patience, pas plus.
      if (++essaisSansRun * PAS_S > 120) return { erreur: `aucun run de CI pour ${sha.slice(0, 7)} (${branche}) : la branche est-elle poussée ?` };
    } else if (run.status === "completed") return { run };
    if (Date.now() > fin) return { erreur: `délai dépassé (${attenteMax} min) : le run ${run?.html_url ?? "?"} n'est pas terminé` };
    await new Promise((res) => setTimeout(res, PAS_S * 1000));
  }
}

async function main(argv) {
  relancerAvecProxy();
  const opt = (nom, def) => (argv.includes(nom) ? argv[argv.indexOf(nom) + 1] : def);
  const token = jeton();
  if (!token) {
    console.error("GITHUB_TOKEN absent (ou GH_TOKEN) : impossible de lire la CI.");
    process.exit(2);
  }
  const depot = depotPar(argv);
  const branche = opt("--branche", git("rev-parse", "--abbrev-ref", "HEAD"));
  const sha = opt("--sha", git("rev-parse", "HEAD"));
  const r = await attendre({ depot, token, branche, sha, attenteMax: Number(opt("--attente-max", ATTENTE_MAX_MIN)) });
  if (r.erreur) {
    console.log(r.erreur);
    process.exit(2);
  }
  const { run } = r;
  const jobs = (await api(`/repos/${depot}/actions/runs/${run.id}/jobs?filter=latest&per_page=100`, token)).jobs;
  const debut = Date.parse(run.run_started_at ?? run.created_at);
  const mur = Math.round((Date.parse(run.updated_at) - debut) / 60_000 * 10) / 10;
  console.log(`CI ${run.conclusion === "success" ? "VERTE" : `ROUGE (${run.conclusion})`} — ${branche} @ ${sha.slice(0, 7)} — ${run.event}, ${mur} min — ${run.html_url}`);
  for (const l of verdictParJob(jobs)) console.log(`  ${l}`);
  // Les jobs `test` et `e2e` ne sont que des verdicts : leur échec répète celui d'un autre job (sauf s'il est seul rouge).
  const rouges = jobs.filter((x) => ["failure", "timed_out"].includes(x.conclusion));
  const detail = rouges.filter((x) => !["test", "e2e"].includes(x.name));
  for (const j of detail.length ? detail : rouges) {
    let journal = "";
    try {
      journal = await api(`/repos/${depot}/actions/jobs/${j.id}/logs`, token, { texte: true });
    } catch (e) {
      console.log(`\n${j.name} : journal illisible (${e.message.slice(0, 80)})`);
      continue;
    }
    const e = extraireEchecs(journal);
    const etape = j.steps?.find((s) => s.conclusion === "failure")?.name;
    console.log(`\n✘ ${j.name}${etape ? ` — étape « ${etape} »` : ""}`);
    for (const t of e.tests) console.log(`  rouge : ${t}`);
    if (e.autres) console.log(`  … et ${e.autres} autre(s)`);
    for (const l of e.erreur) console.log(`    ${l.slice(0, 200)}`);
  }
  process.exit(run.conclusion === "success" ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exit(2);
  });
}
