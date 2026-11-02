// Lot R16 (plateforme) — les durées des specs e2e MESURÉES LA NUIT composent les parts de la CI complète et de main.
// Les parts Chromium sont équilibrées d'après `apps/<jeu>/e2e/durees.json` (scripts/e2e-parts.mjs) ; ces fichiers vieillissent (02/11/2026 : parts
// estimées à 660 s chacune, mesurées de 492 à 1 121 s, run 41358599711) et la part la plus longue fait la durée de la CI. Désormais :
//   - le run de NUIT (ci.yml, job `e2e`) mesure chaque spec dans son rapport fusionné et publie l'artefact `durees-e2e` (30 jours) :
//       node scripts/durees-e2e.mjs mesurer apps/web/merged/report.json <sortie.json>     → Markdown (les écarts au dépôt) sur la sortie
//   - le job `scope` des runs suivants (main, complet, le bouton) retrouve le dernier run de nuit de main qui l'a publié, le valide et le passe à chaque
//     part (`E2E_DUREES`) : toutes les parts lisent LA MÊME chaîne, donc composent les mêmes parts (aucun spec oublié ni lancé deux fois) :
//       node scripts/durees-e2e.mjs source --sortie "$GITHUB_OUTPUT"                       → run=<id> (vide : aucun)
//       node scripts/durees-e2e.mjs lire <fichier.json> --run <id> --sortie "$GITHUB_OUTPUT" → durees=<JSON compact> (rien si illisible)
// Seuls les runs `schedule` de ci.yml sur main sont lus (le workflow de main, jamais celui d'une PR). Sans eux : les fichiers du dépôt, comme avant.
// Une durée n'est qu'un poids : elle ne peut ni retirer ni ajouter un spec (la liste vient des fichiers du dépôt, `specFiles`). Testé : apps/web/test/dureesE2e.test.ts.

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { api, depotPar, jeton } from "./github-api.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Le projet Playwright de la CI → le jeu (le dossier `apps/<jeu>` ; Track est `web`). */
export const JEU_DU_PROJET = { chromium: "web", "jump-chromium": "jump", "tower-chromium": "tower" };
export const JEUX = ["web", "jump", "tower"];
/** Un nom de spec tel que durees.json l'écrit ; une durée plus longue qu'une heure est une donnée abîmée. */
const NOM_DE_SPEC = /^[a-z0-9][a-z0-9.-]{0,80}\.spec\.ts$/;
export const DUREE_MAX_S = 3600;
export const ARTEFACT = "durees-e2e";

const estRegression = (tags) => tags.includes("regression") || tags.includes("@regression");

/**
 * Les durées d'un rapport JSON fusionné de Playwright, par jeu : `{ web: { secondes, essentiel }, jump: …, tower: … }` (secondes entières, triées).
 * - le DERNIER essai de chaque test seulement : une relance (`retries: 1`) n'est pas comptée deux fois ;
 * - `essentiel` = les tests sans l'étiquette `@regression` (comme durees.json) ;
 * - un fichier dont un test a échoué (`unexpected`) est laissé de côté : un délai dépassé gonflerait sa durée ; il garde celle du dépôt.
 */
export function mesurerDurees(report) {
  const acc = {};
  const walk = (suite, file) => {
    const ici = suite.file ?? file;
    for (const spec of suite.specs ?? []) {
      const nom = String(spec.file ?? ici ?? "").split("/").pop();
      const regression = estRegression(spec.tags ?? []);
      for (const t of spec.tests ?? []) {
        const jeu = JEU_DU_PROJET[t.projectName];
        if (!jeu) continue;
        const ms = (t.results ?? []).at(-1)?.duration ?? 0;
        const f = ((acc[jeu] ??= {})[nom] ??= { s: 0, e: 0, ko: false });
        f.s += ms;
        if (!regression) f.e += ms;
        if (t.status === "unexpected") f.ko = true;
      }
    }
    for (const s of suite.suites ?? []) walk(s, ici);
  };
  for (const s of report.suites ?? []) walk(s, s.file);
  const out = {};
  for (const jeu of JEUX) {
    const fichiers = acc[jeu];
    if (!fichiers) continue;
    const secondes = {};
    const essentiel = {};
    for (const nom of Object.keys(fichiers).sort()) {
      const f = fichiers[nom];
      const total = Math.max(1, Math.round(f.s / 1000));
      if (f.ko || !NOM_DE_SPEC.test(nom) || total > DUREE_MAX_S) continue;
      secondes[nom] = total;
      essentiel[nom] = Math.round(f.e / 1000);
    }
    out[jeu] = { secondes, essentiel };
  }
  return out;
}

/** Valide des durées venues d'un artefact (une donnée : jamais exécutée) ; rend un objet propre ou lève une erreur qui dit pourquoi. */
export function validerDurees(brut) {
  if (!brut || typeof brut !== "object" || Array.isArray(brut)) throw new Error("un objet { web, jump, tower } attendu");
  const out = {};
  for (const [jeu, v] of Object.entries(brut)) {
    if (!JEUX.includes(jeu)) throw new Error(`jeu inconnu : ${jeu}`);
    out[jeu] = {};
    for (const genre of ["secondes", "essentiel"]) {
      const table = v?.[genre];
      if (!table || typeof table !== "object" || Array.isArray(table)) throw new Error(`${jeu}.${genre} : un objet attendu`);
      const propre = {};
      for (const [nom, s] of Object.entries(table)) {
        if (!NOM_DE_SPEC.test(nom)) throw new Error(`${jeu}.${genre} : nom de spec refusé`);
        if (!Number.isInteger(s) || s < 0 || s > DUREE_MAX_S) throw new Error(`${jeu}.${genre}.${nom} : durée hors bornes`);
        propre[nom] = s;
      }
      out[jeu][genre] = propre;
    }
  }
  return out;
}

/** Les durées du dépôt, remplacées par celles mesurées quand elles existent (les autres gardent la valeur du dépôt). */
export const superposer = (base, mesure) => (mesure ? { ...base, ...mesure } : base);

/**
 * Pour `e2e-parts.mjs` : les durées mesurées d'un jeu passées par `E2E_DUREES` (le JSON validé par `lire`), ou `null` (absentes, illisibles).
 * Toutes les parts lisent la même chaîne : la décision est la même partout.
 */
export function dureesDeLEnvironnement(texte, jeu, { essentiel = false } = {}) {
  if (!texte) return null;
  try {
    return validerDurees(JSON.parse(texte))[jeu]?.[essentiel ? "essentiel" : "secondes"] ?? null;
  } catch {
    return null;
  }
}

/** Les specs dont la durée mesurée s'écarte de celle du dépôt d'au moins 30 s ET 25 % (de quoi remettre durees.json à jour, de temps en temps). */
export function ecarts(base, mesure) {
  const out = [];
  for (const [nom, m] of Object.entries(mesure ?? {})) {
    const b = base[nom];
    if (b === undefined) out.push({ nom, depot: null, mesure: m });
    else if (Math.abs(m - b) >= 30 && Math.abs(m - b) >= 0.25 * b) out.push({ nom, depot: b, mesure: m });
  }
  return out.sort((a, b) => Math.abs(b.mesure - (b.depot ?? 0)) - Math.abs(a.mesure - (a.depot ?? 0)));
}

const dureesDuDepot = (jeu) => JSON.parse(readFileSync(join(ROOT, `apps/${jeu}/e2e/durees.json`), "utf8")).secondes;

/** Le Markdown du run de nuit : total du dépôt et total mesuré par jeu, et les écarts. */
export function resumeMesure(mesures, depot = dureesDuDepot) {
  const l = ["### Durées des specs e2e mesurées cette nuit (lot R16)", "", "Elles composent les parts des prochains runs (main, CI complète, le bouton) ; durees.json du dépôt reste le repli.", "", "| jeu | specs mesurés | total du dépôt | total mesuré |", "|---|---|---|---|"];
  const lignes = [];
  for (const jeu of JEUX) {
    const m = mesures[jeu]?.secondes;
    if (!m) continue;
    const base = depot(jeu);
    const noms = Object.keys(m);
    const somme = (t) => noms.reduce((s, n) => s + (t[n] ?? 0), 0);
    l.push(`| ${jeu} | ${noms.length} | ${somme(base)} s | ${somme(m)} s |`);
    for (const e of ecarts(base, m)) lignes.push(`| ${jeu} | ${e.nom} | ${e.depot ?? "absent"} s | ${e.mesure} s |`);
  }
  if (lignes.length) l.push("", "Écarts d'au moins 30 s et 25 % (à reporter dans durees.json de temps en temps) :", "", "| jeu | spec | dépôt | mesuré |", "|---|---|---|---|", ...lignes);
  return l.join("\n") + "\n";
}

/** Le dernier run de NUIT de ci.yml sur main qui a publié l'artefact (non expiré) : son numéro, ou "" s'il n'y en a pas. */
export async function sourceDeLaNuit(depot, token, lire = api) {
  const runs = (await lire(`/repos/${depot}/actions/workflows/ci.yml/runs?event=schedule&branch=main&status=completed&per_page=5`, token)).workflow_runs ?? [];
  for (const r of runs) {
    if (r.event !== "schedule" || r.head_branch !== "main" || r.path !== ".github/workflows/ci.yml") continue;
    const arts = (await lire(`/repos/${depot}/actions/runs/${r.id}/artifacts?name=${ARTEFACT}`, token)).artifacts ?? [];
    if (arts.some((a) => a.name === ARTEFACT && !a.expired)) return String(r.id);
  }
  return "";
}

async function main(argv) {
  const opt = (nom) => (argv.includes(nom) ? argv[argv.indexOf(nom) + 1] : undefined);
  const sortie = (lignes) => (opt("--sortie") ? appendFileSync(opt("--sortie"), lignes.join("\n") + "\n") : process.stdout.write(lignes.join("\n") + "\n"));
  const [commande, a, b] = argv;
  if (commande === "mesurer" && a && b) {
    const mesures = mesurerDurees(JSON.parse(readFileSync(a, "utf8")));
    mkdirSync(dirname(b), { recursive: true });
    writeFileSync(b, JSON.stringify(validerDurees(mesures)) + "\n");
    process.stdout.write(resumeMesure(mesures));
    return;
  }
  if (commande === "source") {
    let run = "";
    try {
      run = await sourceDeLaNuit(depotPar(argv), jeton());
    } catch (e) {
      console.log(`::warning::durées de la nuit illisibles (${e.message}) : durees.json du dépôt`);
    }
    sortie([`run=${run}`]);
    if (!run) console.log("aucun run de nuit avec des durées mesurées : durees.json du dépôt");
    return;
  }
  if (commande === "lire" && a) {
    let propre;
    try {
      propre = validerDurees(JSON.parse(readFileSync(a, "utf8")));
    } catch (e) {
      console.log(`::warning::durées de la nuit refusées (${e.message}) : durees.json du dépôt`);
      return;
    }
    sortie([`durees=${JSON.stringify(propre)}`]);
    const ligne = `- Parts e2e composées avec les durées mesurées la nuit (run ${opt("--run") ?? "?"}, lot R16) ; durees.json du dépôt pour le reste.`;
    if (opt("--resume")) appendFileSync(opt("--resume"), ligne + "\n");
    console.log(ligne);
    return;
  }
  console.error("usage : node scripts/durees-e2e.mjs mesurer <rapport.json> <sortie.json> | source [--sortie f] | lire <durees.json> [--run id] [--sortie f] [--resume f]");
  process.exit(2);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main(process.argv.slice(2));
