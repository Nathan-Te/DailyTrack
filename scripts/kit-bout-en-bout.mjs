// Lot K4g (plateforme) — **le test de bout en bout du kit** : dans UNE COPIE du dépôt (jamais dans le dépôt), `npm run nouveau-jeu` génère deux jeux, `essai` (classé au score) et `essaitemps` (classé au temps), puis :
//   1. typage (`tsc -b`), fiches (`npm run fiches`, déjà lancé par le générateur), traductions à jour ;
//   2. les unitaires des deux jeux (simulation, application, serveur) et les tests de la plateforme qui lisent les fiches, sur SQLite puis libSQL (`file:`) ;
//   3. la construction des deux jeux et le contrôle des budgets de leurs lignes ;
//   4. l'Essentiel e2e des deux, en Chromium : partie scriptée, envoi rejoué et classé par le vrai serveur, Amis ; (Mon groupe, aperçu, effacement et jour figé sont des tests du serveur, étape 2) ;
//   5. aucun fichier créé ou modifié hors des zones du jeu, de sa fiche, des fichiers générés et des entrées mécaniques (lignes AJOUTÉES seulement).
// Aucun jeu généré n'est versé au dépôt : tout vit dans le dossier temporaire. Aucune base distante (R14), aucun secret, aucun réseau.
//
//   node scripts/kit-bout-en-bout.mjs                  → tout (la CI : job « Kit de bout en bout »)
//   --garder                  → garde la copie (affiche son chemin) ; --sans-e2e : saute l'étape 4 ; --e2e <id> : l'e2e d'un seul des deux jeux (défaut : les deux) ; --source <dossier> : un autre arbre de sources
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ENTREES_MECANIQUES, FICHIERS_GENERES } from "./nouveau-jeu.mjs";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");
export const JEUX = [
  { id: "essai", classement: "score" },
  { id: "essaitemps", classement: "temps" },
];
/** Les tests de la plateforme qui lisent « les jeux des fiches » : ils parcourent le jeu généré comme les autres. */
export const TESTS_DE_LA_PLATEFORME = [
  "packages/core/test/fiches.test.ts",
  "packages/ui/test/fiches.test.ts",
  "packages/kit/test",
  "apps/portail/test/jeuxFiches.test.ts",
  "apps/portail/test/budgets.test.ts",
  "apps/portail/test/mentions.test.ts",
  "apps/api/test/fiches.test.ts",
  "apps/api/test/dockerfile.test.ts",
  "apps/api/test/remiseAZero.test.ts",
  "apps/api/test/jeuxModule.test.ts",
  "apps/web/test/ciZones.test.ts",
];

const args = process.argv.slice(2);
const option = (nom) => {
  const i = args.indexOf(nom);
  return i >= 0 ? args[i + 1] : undefined;
};
const source = resolve(option("--source") ?? RACINE);
const jeuxE2e = option("--e2e") ? [option("--e2e")] : JEUX.map((j) => j.id); // les deux par défaut (≈ 10 s chacun) ; `--e2e essaitemps` : un seul

const globVersRegExp = (glob) => new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*")}$`);

/** Les chemins (relatifs) de tous les fichiers d'une copie, hors `node_modules`, construits et caches. */
function lister(racine, dossier = "", sortie = []) {
  for (const e of readdirSync(join(racine, dossier), { withFileTypes: true })) {
    if (["node_modules", "test-results", "playwright-report", "blob-report", ".cache", ".git"].includes(e.name) || e.name.startsWith("dist") || (e.name === "site" && dossier === "")) continue; // `dist*` : ce que tsc et vite construisent
    const chemin = dossier ? `${dossier}/${e.name}` : e.name;
    if (e.isDirectory()) lister(racine, chemin, sortie);
    else if (e.isFile() && !e.name.endsWith(".tsbuildinfo")) sortie.push(chemin);
  }
  return sortie;
}
const empreintes = (racine) => new Map(lister(racine).map((c) => [c, createHash("sha1").update(readFileSync(join(racine, c))).digest("hex")]));

/** Le dépôt tel qu'un lot le voit (fichiers suivis et non ignorés), `node_modules` lié à l'original sauf `@cdj` (liens relatifs vers CETTE copie). */
export function copierDepot(src) {
  const copie = mkdtempSync(join(tmpdir(), "cdj-kit-"));
  const liste = spawnSync("git", ["ls-files", "-co", "--exclude-standard", "-z"], { cwd: src, encoding: "utf8", maxBuffer: 1 << 28 }).stdout.split("\0").filter(Boolean);
  for (const f of liste) {
    if (!existsSync(join(src, f))) continue;
    mkdirSync(dirname(join(copie, f)), { recursive: true });
    cpSync(join(src, f), join(copie, f));
  }
  mkdirSync(join(copie, "node_modules"));
  for (const e of readdirSync(join(src, "node_modules"))) {
    if (e === "@cdj" || e === ".cache") continue;
    symlinkSync(join(src, "node_modules", e), join(copie, "node_modules", e));
  }
  mkdirSync(join(copie, "node_modules/@cdj"));
  for (const e of readdirSync(join(src, "node_modules/@cdj"))) symlinkSync(readlinkSync(join(src, "node_modules/@cdj", e)), join(copie, "node_modules/@cdj", e));
  return copie;
}

/** `nouveau` contient tout `ancien` (objets : toutes les clés ; listes : chaque élément retrouvé). */
export function contient(nouveau, ancien) {
  if (Array.isArray(ancien)) return Array.isArray(nouveau) && ancien.every((a) => nouveau.some((n) => contient(n, a)));
  if (ancien !== null && typeof ancien === "object") return nouveau !== null && typeof nouveau === "object" && Object.entries(ancien).every(([k, v]) => k in nouveau && contient(nouveau[k], v));
  return nouveau === ancien;
}

/** Ce que le générateur a changé, rangé : dans les zones du jeu / fiche / générés / entrées mécaniques (lignes ajoutées seulement) / HORS DES ZONES. */
export function classer(avant, apres, racine, sauve, zonesParJeu) {
  const zones = zonesParJeu.flatMap((z) => z.map(globVersRegExp));
  const rapport = { crees: [], modifies: [], horsDesZones: [], lignesRetirees: [] };
  for (const [chemin, h] of apres) {
    if (avant.get(chemin) === h) continue;
    const cree = !avant.has(chemin);
    (cree ? rapport.crees : rapport.modifies).push(chemin);
    if (zones.some((r) => r.test(chemin)) || /^config\/jeux\/[a-z0-9]+\.json$/.test(chemin) || FICHIERS_GENERES.some((r) => r.test(chemin))) continue;
    if (!cree && ENTREES_MECANIQUES.includes(chemin)) continue; // les lignes retirées sont vérifiées à part
    rapport.horsDesZones.push(chemin);
  }
  for (const chemin of rapport.modifies.filter((c) => ENTREES_MECANIQUES.includes(c))) {
    const ancien = readFileSync(join(sauve, chemin), "utf8");
    const nouveau = readFileSync(join(racine, chemin), "utf8");
    if (chemin.endsWith(".json")) {
      // Un fichier JSON : tout ce qui y était y est encore (clés, éléments de listes), il ne s'y ajoute que du nouveau.
      if (!contient(JSON.parse(nouveau), JSON.parse(ancien))) rapport.lignesRetirees.push(`${chemin} : un élément d'avant a changé ou disparu`);
      continue;
    }
    const lignes = new Set(nouveau.split("\n"));
    const retirees = ancien.split("\n").filter((l) => !lignes.has(l));
    if (retirees.length > 0) rapport.lignesRetirees.push(`${chemin} : ${retirees.length} ligne(s) retirée(s) ou modifiée(s), dont « ${retirees[0].trim().slice(0, 80)} »`);
  }
  return rapport;
}

const duree = (t0) => `${((Date.now() - t0) / 1000).toFixed(0)} s`;
const resume = process.env.GITHUB_STEP_SUMMARY;
const etapes = [];
function lancer(nom, cmd, argv, cwd, env = {}) {
  const t0 = Date.now();
  console.log(`\n▶ ${nom} : ${cmd} ${argv.join(" ")}`);
  const r = spawnSync(cmd, argv, { cwd, env: { ...process.env, ...env }, encoding: "utf8", maxBuffer: 1 << 29, stdio: ["ignore", "pipe", "pipe"] });
  const sortie = (r.stdout ?? "") + (r.stderr ?? "");
  const ok = r.status === 0;
  etapes.push({ nom, ok, duree: duree(t0) });
  console.log(ok ? `  ✓ ${nom} (${duree(t0)})` : `  ✗ ${nom} (${duree(t0)})\n${sortie.split("\n").slice(-40).join("\n")}`);
  return ok;
}
function finir(copie, ok, garder) {
  const lignes = ["### Kit de bout en bout", "", "| étape | résultat | durée |", "|---|---|---|", ...etapes.map((e) => `| ${e.nom} | ${e.ok ? "✅" : "❌"} | ${e.duree} |`), "", ok ? "Les deux jeux générés (`essai` au score, `essaitemps` au temps) passent : typage, fiches, unitaires, construction, budgets, e2e, aucun fichier hors zones." : "**Rouge** : voir l'étape en échec ci-dessus (scripts/kit-bout-en-bout.mjs, docs/plateforme/lots/lot-K4g-generateur-et-bout-en-bout.md)."];
  console.log("\n" + lignes.join("\n"));
  if (resume) appendFileSync(resume, lignes.join("\n") + "\n");
  if (garder) console.log(`copie gardée : ${copie}`);
  else rmSync(copie, { recursive: true, force: true });
  process.exit(ok ? 0 : 1);
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const garder = args.includes("--garder");
  const copie = copierDepot(source);
  const t0 = Date.now();
  const avant = empreintes(copie);
  // Les fichiers « avant » des entrées mécaniques, pour vérifier qu'aucune ligne n'est retirée.
  const sauve = mkdtempSync(join(tmpdir(), "cdj-avant-"));
  for (const c of ENTREES_MECANIQUES) {
    mkdirSync(dirname(join(sauve, c)), { recursive: true });
    writeFileSync(join(sauve, c), readFileSync(join(copie, c)));
  }
  console.log(`copie : ${copie} (${duree(t0)})`);
  let ok = true;
  const etape = (cond) => {
    ok = ok && cond;
    return ok;
  };

  for (const j of JEUX) if (ok) etape(lancer(`génération de ${j.id}`, "node", ["scripts/nouveau-jeu.mjs", "--id", j.id, "--classement", j.classement], copie));
  if (ok) {
    // Prudent : le générateur ne réécrit jamais un jeu qui existe ; la passation, elle, se remet à jour à la demande.
    const t1 = Date.now();
    const encore = spawnSync("node", ["scripts/nouveau-jeu.mjs", "--id", JEUX[0].id, "--classement", JEUX[0].classement], { cwd: copie, encoding: "utf8" });
    const refuse = encore.status !== 0 && /existe déjà/.test(encore.stderr);
    etapes.push({ nom: "le générateur refuse un jeu qui existe", ok: refuse, duree: duree(t1) });
    console.log(refuse ? "  ✓ le générateur refuse un jeu qui existe" : `  ✗ le générateur aurait réécrit un jeu : ${encore.stderr}`);
    etape(refuse);
  }
  if (ok) etape(lancer("passation remise à jour", "node", ["scripts/nouveau-jeu.mjs", "--id", JEUX[0].id, "--passation"], copie));
  if (ok) etape(lancer("typage", "npx", ["tsc", "-b"], copie));
  if (ok) etape(lancer("traductions à jour", "npm", ["run", "traductions", "--", "--verifier"], copie));

  if (ok) {
    const unitaires = ["apps", "packages"].flatMap((d) => JEUX.map((j) => (d === "apps" ? `apps/${j.id}` : `packages/${j.id}-sim`))).concat(JEUX.map((j) => `apps/api/test/${j.id}.test.ts`), TESTS_DE_LA_PLATEFORME);
    for (const projet of ["sqlite", "libsql"]) if (ok) etape(lancer(`unitaires (${projet})`, "npx", ["vitest", "run", "--project", projet, ...unitaires], copie, { CDJ_MODE_ESSAI: "1" }));
  }
  if (ok) etape(lancer("construction de tout (dont les deux jeux générés)", "npm", ["run", "build"], copie, { VITE_LANCEMENT_PREMIER_JOUR: "2026-10-13" }));
  if (ok) etape(lancer("budgets (toutes les lignes, dont celles des deux jeux)", "node", ["scripts/budgets-controle.mjs", "controler"], copie));
  if (ok && !args.includes("--sans-e2e")) {
    const chromium = process.env.CHROMIUM_PATH ?? (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
    for (const jeu of jeuxE2e) if (ok) etape(lancer(`e2e Essentiel de ${jeu} (Chromium)`, "npx", ["playwright", "test", "--project", "chromium", "--grep-invert", "@regression"], join(copie, "apps", jeu), { ...(chromium ? { CHROMIUM_PATH: chromium } : {}) }));
  }
  {
    const apres = empreintes(copie);
    const zones = JEUX.map((j) => [`apps/${j.id}/**`, `packages/${j.id}-sim/**`, `apps/api/src/${j.id}*.ts`, `apps/api/test/${j.id}*.test.ts`, `apps/api/scripts/${j.id}-*.ts`, `docs/${j.id}/**`]);
    const rapport = classer(avant, apres, copie, sauve, zones);
    const propre = rapport.horsDesZones.length === 0 && rapport.lignesRetirees.length === 0;
    etapes.push({ nom: `fichiers hors zones (${rapport.crees.length} créés, ${rapport.modifies.length} modifiés)`, ok: propre, duree: "0 s" });
    console.log(`\nfichiers créés : ${rapport.crees.length} · modifiés : ${rapport.modifies.length}\n  modifiés : ${rapport.modifies.join(", ")}`);
    if (!propre) console.log(`  ✗ HORS DES ZONES : ${rapport.horsDesZones.slice(0, 12).join(", ") || "—"}\n  ✗ LIGNES RETIRÉES : ${rapport.lignesRetirees.join(" ; ") || "—"}`);
    etape(propre);
    rmSync(sauve, { recursive: true, force: true });
  }
  finir(copie, ok, garder);
}
