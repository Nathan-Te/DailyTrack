// Lot T1 (plateforme) — `node scripts/consignes-controle.mjs` : contrôle des consignes que Claude Code charge.
//
//   node scripts/consignes-controle.mjs                      → les limites (taille, imports, liens) ; sortie 1 si l'une est dépassée
//   node scripts/consignes-controle.mjs --contre <commit>    → AUSSI : aucune règle perdue — chaque phrase des CLAUDE.md d'il y a <commit>
//                                                              se retrouve dans un CLAUDE.md d'aujourd'hui ou dans docs/regles/
//
// Pourquoi : un CLAUDE.md est chargé en entier à chaque session qui touche son dossier (le racine : toujours) ; chaque ligne coûte des jetons à chaque
// fois. Les limites sont un plafond, pas un objectif. Les règles qui ne servent qu'à un sujet vivent dans `docs/regles/<zone>/`, lues à la demande.
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/** Plafonds (lot T1) : en lignes (demande de Nathan) ET en jetons estimés (1 jeton ≈ 4 caractères), car une ligne de CLAUDE.md peut faire 2 000 caractères. */
export const LIMITES = {
  racine: { lignes: 200, jetons: 8_000 },
  zone: { lignes: 300, jetons: 12_000 },
};

/** Les fichiers du dépôt (suivis par git, plus les neufs non ignorés). Dans une copie du dépôt sans `.git` (jobs « Jeu fictif » et « Kit de bout en bout »), on parcourt le dossier. */
export function fichiersDuDepot() {
  try {
    const sortie = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: racine, encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
    return sortie.split("\0").filter(Boolean).filter((f) => existsSync(join(racine, f)));
  } catch {
    const sortie = [];
    const parcourir = (dossier) => {
      for (const e of readdirSync(join(racine, dossier), { withFileTypes: true })) {
        if (["node_modules", ".git", "site"].includes(e.name) || e.name.startsWith("dist")) continue;
        const c = dossier ? `${dossier}/${e.name}` : e.name;
        if (e.isDirectory()) parcourir(c);
        else sortie.push(c);
      }
    };
    parcourir("");
    return sortie;
  }
}

export function claudeMd() {
  return fichiersDuDepot().filter((f) => /(^|\/)CLAUDE\.md$/.test(f));
}

const lire = (f) => readFileSync(join(racine, f), "utf8");
const jetons = (t) => Math.ceil([...t].length / 4);

function dossiersDocs(dossier, sortie = []) {
  for (const e of readdirSync(join(racine, dossier), { withFileTypes: true })) {
    const c = `${dossier}/${e.name}`;
    if (e.isDirectory()) dossiersDocs(c, sortie);
    else if (e.name.endsWith(".md")) sortie.push(c);
  }
  return sortie;
}

/** Les problèmes des limites : taille, import `@`, renvoi vers un README de lot, lien mort. */
export function problemesDeLimites() {
  const problemes = [];
  for (const f of claudeMd()) {
    const t = lire(f);
    const lim = f === "CLAUDE.md" ? LIMITES.racine : LIMITES.zone;
    const lignes = t.split("\n").length;
    if (lignes > lim.lignes) problemes.push(`${f} : ${lignes} lignes (plafond ${lim.lignes})`);
    if (jetons(t) > lim.jetons) problemes.push(`${f} : ${jetons(t)} jetons estimés (plafond ${lim.jetons})`);
    const sansCode = t.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
    for (const m of sansCode.matchAll(/(?:^|\s)@([\w./-]+\.[a-z]+)/g)) {
      if (existsSync(join(racine, dirname(f), m[1]))) problemes.push(`${f} : import automatique « @${m[1]} » (un import est chargé au lancement : il ne réduit rien)`);
    }
    for (const m of t.matchAll(/docs\/(?:plateforme\/|jump\/|tower\/)?lots\/[\w./-]+/g)) problemes.push(`${f} : renvoie à un README de lot (${m[0]}) — renvoyer à la règle`);
    for (const m of t.matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
      if (/^(https?:|mailto:)/.test(m[1])) continue;
      if (!existsSync(join(racine, dirname(f), m[1]))) problemes.push(`${f} : lien mort (${m[1]})`);
    }
  }
  // Les documents déplacés : liens internes vivants, et chacun est cité par un CLAUDE.md ou par l'index des déplacements.
  const index = existsSync(join(racine, "docs/regles/deplacements.md")) ? lire("docs/regles/deplacements.md") : "";
  const citeurs = claudeMd().map((f) => lire(f)).join("\n") + index;
  if (existsSync(join(racine, "docs/regles"))) {
    for (const d of dossiersDocs("docs/regles")) {
      if (d === "docs/regles/deplacements.md") continue;
      if (!citeurs.includes(d)) problemes.push(`${d} : ne figure ni dans un CLAUDE.md ni dans docs/regles/deplacements.md`);
      for (const m of lire(d).matchAll(/\]\(([^)#\s]+)(?:#[^)]*)?\)/g)) {
        if (/^(https?:|mailto:)/.test(m[1])) continue;
        if (!existsSync(join(racine, dirname(d), m[1]))) problemes.push(`${d} : lien mort (${m[1]})`);
      }
    }
  }
  return problemes;
}


/** Les renvois à l'historique des lots (README, rapports, maquettes) retirés des CLAUDE.md : le contrôle les retire aussi des textes d'avant, pour ne comparer que les règles. */
const LOT = "`[^`]*(?:docs/(?:plateforme/|jump/|tower/)?lots/|lot-)[^`]*`";
export const RETRAITS = [
  [new RegExp(`README\\s*:\\s*(?:${LOT}(?:\\s*\\([^)]*\\))?(?:[ \\t]*(?:,|et)[ \\t]*)?)+[ \\t]*[;.]?[ \\t]*`, "g"), ""],
  [new RegExp(`Contrat\\s*:\\s*${LOT}\\s*;\\s*`, "g"), ""],
  [new RegExp(`\\s*[;,]\\s*(?:rapport|Rapport)\\s*:\\s*${LOT}`, "g"), ""],
  [new RegExp(`\\s*[;,]\\s*voir\\s*${LOT}`, "g"), ""],
  [/\s+et\s+`docs\/lots\/lot-31[^`]*`/g, ""],
  [/\s*;\s*`docs\/lots\/lot-36[^`]*`/g, ""],
  [/\s*\(`docs\/plateforme\/lots\/lot-P0-socle.md`\)/g, ""],
  [/\s*\(seuils dans `[^`]*`\)/g, ""],
  [/,\s*résultats de référence dans `docs\/lots\/[^`]*`/g, ""],
  [/ ; résultats de référence dans `docs\/lots\/[^`]*`\./g, "."],
  [/ maquettes validées par Nathan : `docs\/lots\/lot-52-commandes\/maquettes.html`\)\. /g, ". "],
  [/, tableau en unités humaines dans `docs\/jump\/lots\/[^`]*`\)/g, ")"],
  [/\]\(\.\.\/\.\.\/docs\/lots\//g, "](../../lots/"],
  [/- Ce que le kit n'extrait pas, et pourquoi : `docs\/plateforme\/lots\/[^`]*`\.\n/g, ""],
];
export const sansRenvoisDeLots = (t) => RETRAITS.reduce((acc, [re, par]) => acc.replace(re, par), t);

const normalise = (s) => s.replace(/[*`_>]/g, "").replace(/\s+/g, " ").trim();

/** Les phrases d'un texte (au moins 30 caractères), normalisées : de quoi vérifier qu'on les retrouve ailleurs. */
export function phrases(texte) {
  const sortie = [];
  for (const ligne of texte.split("\n")) {
    for (const p of ligne.split(/(?<=[.;:!?)])\s+/)) {
      const n = normalise(p.replace(/^\s*(?:[-•]\s+|\d+\.\s+|\|)/, ""));
      if (n.length >= 30) sortie.push(n);
    }
  }
  return sortie;
}

/** Les phrases d'avant (au commit donné) qu'on ne retrouve pas aujourd'hui dans un CLAUDE.md ou un document de docs/regles/. */
export function phrasesPerdues(commit) {
  const avant = execFileSync("git", ["ls-tree", "-r", "--name-only", commit], { cwd: racine, encoding: "utf8", maxBuffer: 1 << 26 }).split("\n").filter((f) => /(^|\/)CLAUDE\.md$/.test(f) || f === "docs/tower/consignes.md");
  const corpus = normalise(sansRenvoisDeLots([...claudeMd().map(lire), ...(existsSync(join(racine, "docs/regles")) ? dossiersDocs("docs/regles").map(lire) : [])].join("\n")));
  const perdues = [];
  for (const f of avant) {
    const t = execFileSync("git", ["show", `${commit}:${f}`], { cwd: racine, encoding: "utf8", maxBuffer: 1 << 26 });
    for (const p of new Set(phrases(sansRenvoisDeLots(t)))) if (!corpus.includes(p)) perdues.push({ fichier: f, phrase: p });
  }
  return perdues;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let echec = false;
  const problemes = problemesDeLimites();
  for (const f of claudeMd()) {
    const t = lire(f);
    console.log(`${String(t.split("\n").length).padStart(4)} lignes ${String(jetons(t)).padStart(6)} jetons  ${f}`);
  }
  if (problemes.length) {
    echec = true;
    console.log(`\n${problemes.length} problème(s) :\n- ${problemes.join("\n- ")}`);
  }
  const i = args.indexOf("--contre");
  if (i >= 0) {
    const perdues = phrasesPerdues(args[i + 1]);
    console.log(`\nRègles perdues depuis ${args[i + 1]} : ${perdues.length}`);
    for (const p of perdues.slice(0, 60)) console.log(`- ${p.fichier} : ${p.phrase.slice(0, 160)}`);
    if (perdues.length) echec = true;
  }
  process.exit(echec ? 1 : 0);
}
