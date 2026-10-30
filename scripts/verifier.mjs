// `npm run verifier` (lot R10) : lance EN LOCAL ce que la CI de PR lancera pour ces fichiers — les mêmes tests unitaires et les mêmes specs e2e
// (scripts/ci-zones.mjs, la même décision que le job `scope`), sans en lire la sortie complète : chaque étape tient en une ligne, et seule une étape
// en échec montre la fin de son journal (30 lignes). Le journal complet de chaque étape est gardé dans node_modules/.cache/cdj/verifier/.
//   npm run verifier                              fichiers modifiés par rapport à origin/main (commits + modifications en cours + fichiers neufs)
//   npm run verifier -- --zones=track-sim,jump-ui + les specs de ces zones (e2e/zones.json), en plus de ceux des fichiers modifiés
//   npm run verifier -- --liste                   n'affiche que la sélection (aucun test lancé)
//   npm run verifier -- --sans-e2e                typecheck, construction et tests unitaires seulement
//   npm run verifier -- --regression              lot R13 : les tests `@regression` des specs choisis aussi (la CI de PR ne lance que l'Essentiel, docs/tests.md)
//   npm run verifier -- --base=origin/main --fichiers=a.ts,b.ts
// Code de sortie : 0 si tout est vert, 1 au premier échec (le suivant n'est pas lancé : on corrige, on relance).

import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chargerTable, decider, specsDesZones } from "./ci-zones.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOGS = join(ROOT, "node_modules/.cache/cdj/verifier");
export const LIGNES_D_ECHEC = 30;

const opt = (argv, nom) => argv.find((a) => a.startsWith(`${nom}=`))?.slice(nom.length + 1);

/** Les fichiers modifiés : par rapport à la base (commits de la branche), plus l'arbre de travail et les fichiers neufs. */
export function fichiersModifies(base, cwd = ROOT) {
  const git = (...args) => spawnSync("git", args, { cwd, encoding: "utf8" });
  const noms = new Set();
  const ajouter = (r) => r.stdout?.split("\n").map((l) => l.trim()).filter(Boolean).forEach((l) => noms.add(l));
  const merge = git("merge-base", base, "HEAD");
  ajouter(git("diff", "--name-only", `${merge.status === 0 ? merge.stdout.trim() : base}...HEAD`));
  ajouter(git("diff", "--name-only", "HEAD"));
  ajouter(git("ls-files", "--others", "--exclude-standard"));
  return [...noms].sort();
}

/** Les étapes à lancer pour une décision : `[{ nom, cmd, args, env }]`. */
export function etapes(d, { sansE2e = false, extra = null, regression = false } = {}) {
  const out = [];
  if (!d.docsSeuls) {
    out.push({ nom: "typecheck", cmd: "npm", args: ["run", "typecheck"] });
    out.push({ nom: "typecheck du portail", cmd: "npx", args: ["tsc", "-p", "apps/portail"] });
  }
  const fichiers = [...new Set(d.unitParts.flatMap((p) => p.fichiers))];
  if (fichiers.length) {
    out.push({ nom: `tests unitaires (SQLite, ${fichiers.length} fichier(s))`, cmd: "npx", args: ["vitest", "run", "--project", "sqlite", ...fichiers] });
    const api = fichiers.filter((f) => f.startsWith("apps/api/test/"));
    if (api.length) out.push({ nom: `tests unitaires (libSQL, ${api.length} fichier(s))`, cmd: "npx", args: ["vitest", "run", "--project", "libsql", "--passWithNoTests", ...api] });
  }
  const web = extra ? [...new Set([...d.e2e.web, ...extra.web])].sort() : d.e2e.web;
  const jump = extra ? [...new Set([...d.e2e.jump, ...extra.jump])].sort() : d.e2e.jump;
  const tower = extra ? [...new Set([...d.e2e.tower, ...(extra.tower ?? [])])].sort() : d.e2e.tower;
  if (!d.docsSeuls && !sansE2e && (web.length || jump.length || tower.length)) {
    // Lot R8 : comme la CI, les archives des jeux commencent au circuit n° 1 (les e2e tournent le 20/10/2026, avant la date du lancement public).
    out.push({ nom: "construction (jeux et serveur)", cmd: "npm", args: ["run", "build"], env: { VITE_LANCEMENT_PREMIER_JOUR: "2026-10-13" } });
    if (web.length) out.push({ nom: "construction du serveur", cmd: "npm", args: ["run", "build:node", "-w", "@cdj/api"] });
    // Lot R13 : comme la CI de PR, sans les tests `@regression` (famille « Régression », CI complète seulement), sauf `--regression`.
    const filtre = regression ? [] : ["--grep-invert=@regression"];
    if (web.length) out.push({ nom: `e2e DailyTrack (Chromium, ${web.length} spec(s))`, cmd: "npm", args: ["run", "e2e", "-w", "@cdj/web", "--", "--project=chromium", "--workers=1", ...filtre, ...web.map((s) => `e2e/${s}`)] });
    if (jump.length) out.push({ nom: `e2e DailyJump (Chromium, ${jump.length} spec(s))`, cmd: "npm", args: ["run", "e2e", "-w", "@cdj/jump", "--", "--project=chromium", "--workers=1", ...filtre, ...jump.map((s) => `e2e/${s}`)] });
    // Lot R15 : Tower (3ᵉ jeu), mêmes règles.
    if (tower.length) out.push({ nom: `e2e Tower (Chromium, ${tower.length} spec(s))`, cmd: "npm", args: ["run", "e2e", "-w", "@cdj/tower", "--", "--project=chromium", "--workers=1", ...filtre, ...tower.map((s) => `e2e/${s}`)] });
  }
  return out;
}

/** La fin utile d'un journal : les `n` dernières lignes non vides, sans les codes de couleur. */
export function finDuJournal(texte, n = LIGNES_D_ECHEC) {
  return texte.replace(/\u001b\[[0-9;]*m/g, "").split("\n").filter((l) => l.trim()).slice(-n).join("\n");
}

function main(argv) {
  const base = opt(argv, "--base") ?? "origin/main";
  const fichiers = opt(argv, "--fichiers")?.split(",").filter(Boolean) ?? fichiersModifies(base);
  const d = decider(fichiers, { racine: ROOT });
  const table = chargerTable(ROOT);
  const zones = opt(argv, "--zones")?.split(",").filter(Boolean) ?? [];
  const extra = zones.length ? specsDesZones(zones, table) : null;
  if (extra?.inconnues.length) {
    console.error(`zone(s) inconnue(s) : ${extra.inconnues.join(", ")} (zones de e2e/zones.json : ${Object.keys(table.zones).join(", ")})`);
    process.exit(2);
  }
  const plan = etapes(d, { sansE2e: argv.includes("--sans-e2e"), extra, regression: argv.includes("--regression") });
  console.log(`verifier : ${fichiers.length} fichier(s) modifié(s) depuis ${base}${d.docsSeuls ? " (documents seuls)" : ""}`);
  if (argv.includes("--liste")) {
    for (const e of plan) console.log(`  · ${e.nom}\n      ${e.cmd} ${e.args.join(" ").slice(0, 400)}`);
    return;
  }
  if (plan.length === 0) {
    console.log("rien à vérifier (aucun test ne dépend de ces fichiers).");
    return;
  }
  mkdirSync(LOGS, { recursive: true });
  const debut = Date.now();
  for (const [i, e] of plan.entries()) {
    const t0 = Date.now();
    const r = spawnSync(e.cmd, e.args, { cwd: ROOT, encoding: "utf8", maxBuffer: 512 * 1024 * 1024, env: { ...process.env, FORCE_COLOR: "0", ...e.env } });
    const sortie = `${r.stdout ?? ""}${r.stderr ?? ""}`;
    const log = join(LOGS, `${String(i + 1).padStart(2, "0")}.log`);
    writeFileSync(log, sortie);
    const s = Math.round((Date.now() - t0) / 1000);
    if (r.status === 0) console.log(`  ✔ ${e.nom} (${s} s)`);
    else {
      console.log(`  ✘ ${e.nom} (${s} s) — journal complet : ${log.replace(`${ROOT}/`, "")}\n${finDuJournal(sortie).replace(/^/gm, "    ")}`);
      process.exit(1);
    }
  }
  console.log(`verifier : tout est vert (${Math.round((Date.now() - debut) / 1000)} s). La CI de la PR lancera les mêmes tests.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
