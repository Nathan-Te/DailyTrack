// Lecture de l'API REST de GitHub, commune aux outils de CI (lot R10) : `mesure-ci.mjs` (mesures) et `attendre-ci.mjs` (attendre le verdict d'une
// branche). Sans `gh`, sans dépendance : `fetch` de Node avec le jeton `GITHUB_TOKEN` (ou `GH_TOKEN`).

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

export const DEPOT_PAR_DEFAUT = "Nathan-Te/DailyTrack";
const CA_DE_L_AGENT = "/root/.ccr/ca-bundle.crt";

/**
 * Dans l'environnement d'un agent (conteneur derrière un proxy sortant), le `fetch` de Node ignore `HTTPS_PROXY` tant que `NODE_USE_ENV_PROXY`
 * n'est pas posé : il atteint GitHub sans le jeton injecté par le proxy et reçoit 401. On relance donc le script une fois avec ces variables.
 * Sans proxy (poste de Nathan, CI), ne fait rien.
 */
export function relancerAvecProxy(argv = process.argv.slice(1), env = process.env) {
  const proxy = env.HTTPS_PROXY || env.https_proxy;
  if (!proxy || env.NODE_USE_ENV_PROXY) return false;
  const vars = { ...env, NODE_USE_ENV_PROXY: "1", NODE_NO_WARNINGS: "1" };
  if (!vars.NODE_EXTRA_CA_CERTS && existsSync(CA_DE_L_AGENT)) vars.NODE_EXTRA_CA_CERTS = CA_DE_L_AGENT;
  const r = spawnSync(process.execPath, argv, { env: vars, stdio: "inherit" });
  process.exit(r.status ?? 1);
}

export const jeton = (env = process.env) => env.GITHUB_TOKEN || env.GH_TOKEN || "";

/** Dépôt « propriétaire/nom » : `--depot`, sinon `GITHUB_REPOSITORY`, sinon le dépôt du projet. */
export const depotPar = (argv = process.argv, env = process.env) => (argv.includes("--depot") ? argv[argv.indexOf("--depot") + 1] : env.GITHUB_REPOSITORY || DEPOT_PAR_DEFAUT);

/** GET JSON (ou texte avec `texte: true`, pour les journaux, qui passent par une redirection) ; une limite de débit courte est attendue. */
export async function api(chemin, token, { texte = false } = {}) {
  for (let essai = 0; ; essai++) {
    const res = await fetch(`https://api.github.com${chemin}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
      redirect: "follow",
    });
    if (res.status === 403 || res.status === 429) {
      const attente = Number(res.headers.get("retry-after") ?? 0) || Math.max(0, Number(res.headers.get("x-ratelimit-reset") ?? 0) - Date.now() / 1000);
      if (essai < 3 && attente > 0 && attente < 120) {
        await new Promise((r) => setTimeout(r, attente * 1000 + 500));
        continue;
      }
    }
    if (!res.ok) throw new Error(`API GitHub ${chemin} : ${res.status} ${(await res.text()).slice(0, 200)}`);
    return texte ? res.text() : res.json();
  }
}
