// La production exige la CI complète (lot R3 de la plateforme). Utilisé par le premier job de .github/workflows/production.yml : rien ne part
// (ni la recette, ni la validation de Nathan, ni la production) tant que la CI COMPLÈTE de ce commit n'est pas verte.
// « CI complète » = le run `push` de `main` du workflow `ci.yml` pour ce commit : sur `main`, rien n'est filtré (tous les jeux, les trois
// navigateurs, la quarantaine bloquante). Un run de PR (Chromium et sous-ensemble seulement) ne compte jamais.
//   GITHUB_TOKEN=… node scripts/ci-complete.mjs <owner/dépôt> <sha> [--attente-max <minutes>] [--resume <fichier>]
//   → attend la fin de ce run (il démarre en même temps que la production) ; code 0 s'il est vert, 1 sinon (le résumé dit pourquoi, avec le lien).
// Décision pure (`verdict`) testée dans apps/web/test/ciComplete.test.ts.

import { appendFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const CI_WORKFLOW = "ci.yml";

/** Les runs qui comptent : `push` sur `main`, de ce commit exactement. */
export function fullRuns(runs, sha) {
  return (runs ?? []).filter((r) => r.head_sha === sha && r.event === "push" && r.head_branch === "main");
}

/**
 * Où en est la CI complète de `sha` ? `runs` : les runs du workflow `ci.yml` (API GitHub). Le plus récent compte (une relance de Nathan
 * crée un nouvel essai du même run : `run_attempt`, même id). Rend `{ state: "attendre" | "vert" | "rouge", reason, url }`.
 */
export function verdict(runs, sha) {
  const mine = fullRuns(runs, sha).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at) || b.id - a.id);
  const run = mine[0];
  if (!run) return { state: "attendre", reason: `aucun run \`push\` de main pour ${sha.slice(0, 7)} encore`, url: null };
  const url = run.html_url;
  if (run.status !== "completed") return { state: "attendre", reason: `CI complète en cours (${run.status})`, url };
  if (run.conclusion === "success") return { state: "vert", reason: `CI complète verte (run ${run.id}, essai ${run.run_attempt ?? 1})`, url };
  return { state: "rouge", reason: `CI complète « ${run.conclusion} » (run ${run.id}, essai ${run.run_attempt ?? 1}) : la production refuse ce commit`, url };
}

/** Texte du résumé du run de production. */
export function summary(v, sha) {
  const head = v.state === "vert" ? "### CI complète : verte — la production peut continuer" : "### CI complète : pas verte — la production refuse de déployer";
  const lines = [head, "", `Commit \`${sha.slice(0, 7)}\` : ${v.reason}.`];
  if (v.url) lines.push("", `Run : ${v.url}`);
  if (v.state !== "vert")
    lines.push(
      "",
      "La production exige la CI complète du commit (le run `push` de `main` : tous les jeux, Chromium, Firefox et WebKit, quarantaine bloquante). Une validation ne contourne pas ce refus : réparer, fusionner le correctif, et c'est son run qui ouvrira la production.",
    );
  return lines.join("\n") + "\n";
}

async function listRuns(repo, sha, token) {
  const url = `https://api.github.com/repos/${repo}/actions/workflows/${CI_WORKFLOW}/runs?head_sha=${sha}&event=push&branch=main&per_page=20`;
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" } });
  if (!res.ok) throw new Error(`API GitHub : ${res.status} ${await res.text()}`);
  return (await res.json()).workflow_runs;
}

async function main(argv) {
  const [repo, sha] = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
  const opt = (name, def) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : def);
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !sha || !token) {
    console.error("usage : GITHUB_TOKEN=… node scripts/ci-complete.mjs <owner/dépôt> <sha> [--attente-max <minutes>] [--resume <fichier>]");
    process.exit(2);
  }
  const deadline = Date.now() + Number(opt("--attente-max", "90")) * 60_000;
  let v;
  for (;;) {
    try {
      v = verdict(await listRuns(repo, sha, token), sha);
    } catch (e) {
      v = { state: "attendre", reason: `lecture impossible (${e.message})`, url: null };
    }
    console.log(`${new Date().toISOString()} — ${v.reason}${v.url ? ` ${v.url}` : ""}`);
    if (v.state !== "attendre") break;
    if (Date.now() > deadline) {
      v = { ...v, state: "rouge", reason: `${v.reason} ; délai d'attente dépassé` };
      break;
    }
    await new Promise((r) => setTimeout(r, 30_000));
  }
  const out = opt("--resume");
  if (out) appendFileSync(out, summary(v, sha));
  if (v.state !== "vert") console.log(`::error title=Production refusée::${v.reason}${v.url ? ` — ${v.url}` : ""}`);
  process.exit(v.state === "vert" ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main(process.argv.slice(2));
