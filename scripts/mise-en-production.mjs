// « Mettre en production » (lot R4 de la plateforme) : ce que le workflow .github/workflows/production.yml calcule. Fonctions pures, testées
// (apps/portail/test/miseEnProduction.test.ts). Ligne de commande :
//   node scripts/mise-en-production.mjs etiquette [--maintenant <ISO>]              → `prod-AAAA-MM-JJ-HHMM` (heure de Paris)
//   node scripts/mise-en-production.mjs derniere [--avant <étiquette>]              → la dernière étiquette `prod-*` du dépôt (vide s'il n'y en a pas)
//   node scripts/mise-en-production.mjs changements <de> <à> [--resume <fichier>]   → PR et commits de <de> (exclu ; vide : tout) à <à>, en Markdown
//   node scripts/mise-en-production.mjs jours-figes <dossier figé> <dossier cible>  → copie les jours figés absents de la cible ; refuse un
//                                                                                     fichier différent (un jour figé ne change jamais)
import { execFileSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const TAG_PREFIX = "prod-";
const TAG = /^prod-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})$/;

/** L'étiquette d'une mise en production faite à l'instant `ms` : `prod-AAAA-MM-JJ-HHMM`, à l'heure de Paris (celle du jour des jeux). */
export function prodTag(ms) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value]),
  );
  return `${TAG_PREFIX}${parts.year}-${parts.month}-${parts.day}-${parts.hour}${parts.minute}`;
}

/** Vrai pour une étiquette de mise en production bien formée. */
export const isProdTag = (t) => TAG.test(t);

/** La plus récente des étiquettes `prod-*` (le nom se trie comme la date) ; `avant` : la plus récente strictement avant celle-ci. */
export function latestProdTag(tags, avant) {
  const ok = tags.map((t) => t.trim()).filter(isProdTag).filter((t) => !avant || t < avant).sort();
  return ok.at(-1) ?? null;
}

/**
 * Les changements depuis la dernière mise en production, à partir de `git log --format=%H%x09%P%x09%s` (le plus récent d'abord) : les PR
 * (commit de fusion « Merge pull request #N from … », ou titre « … (#N) » d'une fusion écrasée) et les commits ordinaires (hors fusions).
 */
export function changesFromLog(lines) {
  const prs = [];
  const commits = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const [sha, parents = "", ...rest] = line.split("\t");
    const subject = rest.join("\t");
    const merge = parents.trim().split(/\s+/).filter(Boolean).length > 1;
    const m = /^Merge pull request #(\d+) from (\S+)/.exec(subject) ?? (/\(#(\d+)\)\s*$/.exec(subject) ? [null, /\(#(\d+)\)\s*$/.exec(subject)[1], null] : null);
    if (m && !prs.some((p) => p.number === Number(m[1]))) prs.push({ number: Number(m[1]), branch: m[2] ?? null, sha });
    if (!merge) commits.push({ sha, subject });
  }
  return { prs, commits };
}

/** Le résumé Markdown des changements (le workflow l'ajoute au résumé du run). */
export function changesSummary({ from, to, repo, prs, commits }) {
  const link = (n) => (repo ? `[#${n}](https://github.com/${repo}/pull/${n})` : `#${n}`);
  const lines = [`### Changements ${from ? `depuis \`${from}\`` : "(première mise en production étiquetée : tout l'historique)"} jusqu'à \`${to.slice(0, 7)}\``, ""];
  lines.push(`**PR (${prs.length})** : ${prs.length ? prs.map((p) => `${link(p.number)}${p.branch ? ` (${p.branch})` : ""}`).join(", ") : "aucune"}`, "");
  lines.push(`**Commits (${commits.length})**${commits.length > 50 ? " — les 50 plus récents" : ""} :`);
  for (const c of commits.slice(0, 50)) lines.push(`- \`${c.sha.slice(0, 7)}\` ${c.subject.replace(/[<>]/g, "")}`);
  if (!commits.length) lines.push("- aucun");
  return lines.join("\n") + "\n";
}

/**
 * Les jours figés à ajouter au déploiement : ceux de `frozen` (figés avec le code en production) absents de `target` (le commit déployé).
 * Un jour présent des deux côtés doit être identique (un jour figé ne change jamais) : sinon `conflicts` le nomme et le workflow refuse.
 * `frozen`, `target` : nom de fichier → contenu.
 */
export function frozenOverlay(frozen, target) {
  const add = [];
  const conflicts = [];
  for (const [name, content] of Object.entries(frozen)) {
    if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(name)) continue;
    if (!(name in target)) add.push(name);
    else if (target[name] !== content) conflicts.push(name);
  }
  return { add: add.sort(), conflicts: conflicts.sort() };
}

const read = (dir) => (existsSync(dir) ? Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => [f, readFileSync(join(dir, f), "utf8")])) : {});
const git = (...args) => execFileSync("git", args, { encoding: "utf8" });

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const [cmd, a, b, ...rest] = process.argv.slice(2);
  const all = process.argv.slice(2);
  const opt = (name) => (all.includes(name) ? all[all.indexOf(name) + 1] : undefined);
  try {
    if (cmd === "etiquette") console.log(prodTag(opt("--maintenant") ? Date.parse(opt("--maintenant")) : Date.now()));
    else if (cmd === "derniere") console.log(latestProdTag(git("tag", "-l", `${TAG_PREFIX}*`).split("\n"), opt("--avant")) ?? "");
    else if (cmd === "changements") {
      const range = a ? `${a}..${b}` : b;
      const log = git("log", "--format=%H%x09%P%x09%s", range).split("\n");
      const text = changesSummary({ from: a || null, to: git("rev-parse", b).trim(), repo: process.env.GITHUB_REPOSITORY, ...changesFromLog(log) });
      const out = opt("--resume");
      if (out) appendFileSync(out, text);
      process.stdout.write(text);
    } else if (cmd === "jours-figes") {
      const { add, conflicts } = frozenOverlay(read(a), read(b));
      if (conflicts.length) throw new Error(`jour(s) figé(s) différent(s) entre le code en production et le commit déployé : ${conflicts.join(", ")} (un jour figé ne change jamais : voir docs/plateforme/domaine.md)`);
      for (const f of add) copyFileSync(join(a, f), join(b, f));
      console.log(add.length ? `jours figés ajoutés : ${add.join(" ")}` : "aucun jour figé à ajouter");
    } else {
      void rest;
      console.error("usage : node scripts/mise-en-production.mjs etiquette | derniere | changements <de> <à> | jours-figes <figés> <cible>");
      process.exit(2);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
