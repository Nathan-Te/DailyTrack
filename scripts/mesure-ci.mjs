// Mesure de la CI (lot R10) : l'outil de l'audit R7 (§ 7.1), devenu un outil du dépôt. Il lit les runs et les jobs de GitHub Actions (API REST,
// sans `gh`) et rend, par semaine : le nombre de runs, de PR et de runs par PR, les minutes de jobs (arrondies à la minute supérieure par job,
// comme la facturation), la durée murale (médiane, p90) et le temps d'attente dans la file (début du job − création du run) ; puis, à part, les
// 20 specs e2e les plus longs.
//   GITHUB_TOKEN=… node scripts/mesure-ci.mjs [--depot owner/dépôt] [--depuis AAAA-MM-JJ] [--jusqua AAAA-MM-JJ]
//        [--workflow ci.yml|tous] [--evenement pull_request|push|schedule] [--cache fichier.json] [--json]
//   node scripts/mesure-ci.mjs --specs [--rapport rapport.json]        les 20 specs les plus longs (sans réseau)
//   node scripts/mesure-ci.mjs --run 123456 --run 123457 …              le détail de quelques runs (jobs, minutes, attente)
// `--cache` garde les runs et leurs jobs déjà lus (un run terminé ne change plus) : la relance d'une mesure ne relit que le neuf.
// Relancer dans une semaine : `node scripts/mesure-ci.mjs --depuis <jour du lot> --evenement pull_request` (voir le README du lot R10).
// Les calculs (`analyser`, `minutesDuJob`, `specsLesPlusLongs`…) sont purs et testés par apps/web/test/mesureCi.test.ts.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromiumSeconds, collectTests } from "./e2e-summary.mjs";
import { api, depotPar, jeton, relancerAvecProxy } from "./github-api.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
/** Un job annulé dont la « durée » dépasse 2 h n'a fait qu'attendre dans la file (horodatage de file d'attente) : compté 0 (audit R7). */
export const ANNULE_MAX_MS = 2 * 3_600_000;

const ms = (iso) => (iso ? Date.parse(iso) : NaN);

/** Minutes facturées d'un job : durée arrondie à la minute supérieure ; 0 pour un job sauté, jamais démarré ou annulé après plus de 2 h. */
export function minutesDuJob(job) {
  const d = ms(job.completed_at) - ms(job.started_at);
  if (!Number.isFinite(d) || d <= 0 || job.conclusion === "skipped") return 0;
  if (job.conclusion === "cancelled" && d > ANNULE_MAX_MS) return 0;
  return Math.ceil(d / 60_000);
}

/** Percentile (méthode du rang le plus proche) d'une liste de nombres ; NaN si elle est vide. */
export function percentile(values, p) {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (v.length === 0) return NaN;
  return v[Math.min(v.length - 1, Math.max(0, Math.ceil((p / 100) * v.length) - 1))];
}
export const mediane = (values) => percentile(values, 50);

/** Lundi (UTC) de la semaine d'un horodatage, au format AAAA-MM-JJ. */
export function lundiDe(iso) {
  const d = new Date(ms(iso));
  const jour = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - jour);
  return d.toISOString().slice(0, 10);
}

/** La PR (ou la branche) d'un run : un run `pull_request` se rattache à sa branche ; `push`, `schedule` et manuel n'ont pas de PR. */
export function cleDePr(run) {
  if (run.event !== "pull_request") return null;
  return run.pull_requests?.[0]?.number ?? run.head_branch ?? null;
}

/** Mesures d'un run : `{ minutes, murMin, files }` (`files` : attente de chaque job, en secondes, depuis la création du run). */
export function mesureDuRun(run, jobs) {
  const debut = ms(run.run_started_at ?? run.created_at);
  const fins = jobs.map((j) => ms(j.completed_at)).filter(Number.isFinite);
  const fin = fins.length ? Math.max(...fins) : ms(run.updated_at);
  const files = jobs
    .filter((j) => j.conclusion !== "skipped" && Number.isFinite(ms(j.started_at)))
    .map((j) => Math.max(0, (ms(j.started_at) - ms(run.created_at)) / 1000));
  return {
    minutes: jobs.reduce((s, j) => s + minutesDuJob(j), 0),
    murMin: Number.isFinite(fin - debut) ? Math.max(0, (fin - debut) / 60_000) : NaN,
    files,
  };
}

const arrondi = (x, n = 1) => (Number.isFinite(x) ? Math.round(x * 10 ** n) / 10 ** n : null);

/** Résume un ensemble de runs `{ run, jobs }` : une ligne par semaine et un total. */
export function analyser(runs) {
  const mesures = runs.filter((r) => r.run.status === "completed").map(({ run, jobs }) => ({ run, ...mesureDuRun(run, jobs) }));
  const groupe = (liste) => {
    const prs = new Set(liste.map((m) => cleDePr(m.run)).filter((x) => x !== null));
    const prRuns = liste.filter((m) => cleDePr(m.run) !== null).length;
    const files = liste.flatMap((m) => m.files);
    const premieres = liste.map((m) => (m.files.length ? Math.min(...m.files) : NaN));
    return {
      runs: liste.length,
      prs: prs.size,
      runsParPr: prs.size ? arrondi(prRuns / prs.size) : null,
      minutes: liste.reduce((s, m) => s + m.minutes, 0),
      minutesParRun: liste.length ? arrondi(liste.reduce((s, m) => s + m.minutes, 0) / liste.length) : null,
      murMedianMin: arrondi(mediane(liste.map((m) => m.murMin))),
      murP90Min: arrondi(percentile(liste.map((m) => m.murMin), 90)),
      fileJobMedianeS: arrondi(mediane(files), 0),
      fileJobP90S: arrondi(percentile(files, 90), 0),
      filePremierJobMedianeS: arrondi(mediane(premieres), 0),
    };
  };
  const semaines = new Map();
  for (const m of mesures) {
    const k = lundiDe(m.run.created_at);
    if (!semaines.has(k)) semaines.set(k, []);
    semaines.get(k).push(m);
  }
  return {
    semaines: [...semaines.keys()].sort().map((k) => ({ semaine: k, ...groupe(semaines.get(k)) })),
    total: groupe(mesures),
  };
}

/** Les `n` specs les plus longs : `durees` = `{ "jeu/fichier": secondes }` (durees.json ou rapport). */
export function specsLesPlusLongs(durees, n = 20) {
  return Object.entries(durees)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
    .slice(0, n)
    .map(([spec, secondes]) => ({ spec, secondes }));
}

/** Les durées de `durees.json` des deux jeux, préfixées par le jeu (`web/…`, `jump/…`) ; sans les outils (durée 0 : captures et mesures sautés). */
export function dureesDuDepot(racine = ROOT) {
  const out = {};
  for (const [jeu, dossier] of [["web", "apps/web/e2e"], ["jump", "apps/jump/e2e"]]) {
    const f = join(racine, dossier, "durees.json");
    if (!existsSync(f)) continue;
    for (const [spec, s] of Object.entries(JSON.parse(readFileSync(f, "utf8")).secondes)) if (s > 0) out[`${jeu}/${spec}`] = s;
  }
  return out;
}

/** Les durées d'un rapport JSON fusionné de Playwright (artefact du job `e2e`), `jump/…` pour DailyJump. */
export function dureesDuRapport(rapport) {
  const s = chromiumSeconds(collectTests(rapport));
  return Object.fromEntries(Object.entries(s).map(([f, v]) => [f.startsWith("jump/") ? f : `web/${f.split("/").pop()}`, v]));
}

const num = (x, suffixe = "") => (x === null || x === undefined || Number.isNaN(x) ? "—" : `${x}${suffixe}`);

/** Le tableau Markdown de `analyser`. */
export function tableau({ semaines, total }) {
  const l = (nom, g) => `| ${nom} | ${g.runs} | ${g.prs || "—"} | ${num(g.runsParPr)} | ${g.minutes} | ${num(g.minutesParRun)} | ${num(g.murMedianMin)} / ${num(g.murP90Min)} | ${num(g.filePremierJobMedianeS)} / ${num(g.fileJobMedianeS)} / ${num(g.fileJobP90S)} |`;
  return [
    "| Semaine (lundi) | Runs | PR | Runs / PR | Minutes de jobs | Minutes / run | Mur min (médiane / p90) | File s (1er job méd. / job méd. / job p90) |",
    "|---|---|---|---|---|---|---|---|",
    ...semaines.map((s) => l(s.semaine, s)),
    l("**Total**", total),
  ].join("\n");
}

export function tableauSpecs(liste) {
  return ["| # | Spec | Durée (s) |", "|---|---|---|", ...liste.map((x, i) => `| ${i + 1} | \`${x.spec}\` | ${x.secondes} |`)].join("\n");
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// Lecture de l'API GitHub (le seul morceau qui touche le réseau).

/** Les runs créés entre deux jours (inclus), jour par jour : l'API ne rend jamais plus de 1 000 résultats par requête. */
async function lireRuns({ depot, depuis, jusqua, workflow, evenement, token }) {
  const base = workflow === "tous" ? `/repos/${depot}/actions/runs` : `/repos/${depot}/actions/workflows/${workflow}/runs`;
  const out = [];
  for (let t = Date.parse(depuis); t <= Date.parse(jusqua); t += 86_400_000) {
    const jour = new Date(t).toISOString().slice(0, 10);
    for (let page = 1; ; page++) {
      const r = await api(`${base}?created=${jour}&per_page=100&page=${page}${evenement ? `&event=${evenement}` : ""}`, token);
      out.push(...r.workflow_runs);
      if (r.workflow_runs.length < 100) break;
    }
  }
  return out;
}

async function lireJobs(depot, runId, token) {
  const jobs = [];
  for (let page = 1; ; page++) {
    const r = await api(`/repos/${depot}/actions/runs/${runId}/jobs?filter=all&per_page=100&page=${page}`, token);
    jobs.push(...r.jobs);
    if (r.jobs.length < 100) break;
  }
  return jobs;
}

/** Exécute `fn` sur chaque élément, `n` à la fois. */
async function enParallele(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => { for (let k = i++; k < items.length; k = i++) out[k] = await fn(items[k], k); }));
  return out;
}

const JOURS_DEFAUT = 7;
const jourIl = (decalage) => new Date(Date.now() - decalage * 86_400_000).toISOString().slice(0, 10);

async function main(argv) {
  const opt = (nom, def) => (argv.includes(nom) ? argv[argv.indexOf(nom) + 1] : def);
  const tous = (nom) => argv.flatMap((a, i) => (a === nom ? [argv[i + 1]] : []));
  if (argv.includes("--specs")) {
    const rapport = opt("--rapport");
    const durees = rapport ? dureesDuRapport(JSON.parse(readFileSync(rapport, "utf8"))) : dureesDuDepot();
    console.log(`Les 20 specs e2e les plus longs (${rapport ? `rapport ${rapport}` : "durees.json, Chromium, un test à la fois"}) :\n\n${tableauSpecs(specsLesPlusLongs(durees))}`);
    return;
  }
  relancerAvecProxy();
  const token = jeton();
  if (!token) {
    console.error("usage : GITHUB_TOKEN=… node scripts/mesure-ci.mjs [--depuis AAAA-MM-JJ] [--jusqua AAAA-MM-JJ] [--workflow ci.yml|tous] [--evenement pull_request] [--cache f.json] [--json]\n        node scripts/mesure-ci.mjs --specs [--rapport rapport.json]");
    process.exit(2);
  }
  const depot = depotPar(argv);
  const cacheFichier = opt("--cache");
  const cache = cacheFichier && existsSync(cacheFichier) ? JSON.parse(readFileSync(cacheFichier, "utf8")) : {};
  let runs;
  const ids = tous("--run");
  if (ids.length) {
    runs = await enParallele(ids, 4, (id) => api(`/repos/${depot}/actions/runs/${id}`, token));
  } else {
    runs = await lireRuns({
      depot, token,
      depuis: opt("--depuis", jourIl(JOURS_DEFAUT)),
      jusqua: opt("--jusqua", jourIl(0)),
      workflow: opt("--workflow", "ci.yml"),
      evenement: opt("--evenement"),
    });
  }
  console.error(`${runs.length} run(s) à mesurer (${depot})`);
  const fait = await enParallele(runs, 6, async (run) => {
    const cle = `${run.id}-${run.run_attempt ?? 1}`;
    if (run.status === "completed" && cache[cle]) return { run, jobs: cache[cle] };
    const jobs = await lireJobs(depot, run.id, token);
    if (run.status === "completed") cache[cle] = jobs.map(({ id, name, status, conclusion, created_at, started_at, completed_at, run_attempt }) => ({ id, name, status, conclusion, created_at, started_at, completed_at, run_attempt }));
    return { run, jobs };
  });
  if (cacheFichier) writeFileSync(cacheFichier, JSON.stringify(cache));
  const resultat = analyser(fait);
  if (ids.length) {
    for (const { run, jobs } of fait) {
      const m = mesureDuRun(run, jobs);
      console.log(`run ${run.id} (${run.event}, ${run.head_branch}) : ${m.minutes} min de jobs, ${arrondi(m.murMin)} min de mur, 1er job après ${arrondi(Math.min(...m.files), 0)} s`);
    }
  }
  console.log(argv.includes("--json") ? JSON.stringify(resultat, null, 2) : tableau(resultat));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
