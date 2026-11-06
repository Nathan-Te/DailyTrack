// « Mettre en production » (lot R4 de la plateforme) : ce que le workflow .github/workflows/production.yml calcule. Fonctions pures, testées
// (apps/portail/test/miseEnProduction.test.ts). Ligne de commande :
//   node scripts/mise-en-production.mjs etiquette [--maintenant <ISO>]              → `prod-AAAA-MM-JJ-HHMM` (heure de Paris)
//   node scripts/mise-en-production.mjs derniere [--avant <étiquette>]              → la dernière étiquette `prod-*` du dépôt (vide s'il n'y en a pas)
//   node scripts/mise-en-production.mjs changements <de> <à> [--resume <fichier>] [--sortie <fichier>]   → PR et commits de <de> (exclu ; vide : tout) à <à>, en Markdown
// Lot R6 (le garde-fou des jours) :
//   node scripts/mise-en-production.mjs jours-servis <réf> <cible> --jeu <id> [--jusqua <réf>]  → remet dans <cible> (le dossier des jours d'un jeu à fichiers, ou le fichier du registre d'un jeu à registre) ce
//                                                                                     que la production sert sans que ce soit dans le commit de <réf> : ceux des PR « Jours figés de la mise en production » fusionnées depuis
//   node scripts/mise-en-production.mjs bascule [--simulee "<heure>"] [--sortie <fichier>]   → le jour de bascule (le premier jour de Paris qui commence
//                                                                                     après le déploiement), calculé à l'instant du clic ou à l'heure simulée
//   node scripts/mise-en-production.mjs empreintes <dépôt> --du <jour> --au <jour> --sortie <fichier>
//                                                                                     → les empreintes des jours de CHAQUE jeu pour le code de <dépôt> (modules de jeu et pilote copiés dans <dépôt>) ; ajoute la clé de chaque jeu
//   node scripts/mise-en-production.mjs bascule-valide <AAAA-MM-JJ>                  → refuse (code 1) si le jour de bascule a déjà commencé
//   node scripts/mise-en-production.mjs comparer <prod.json> <cible.json> <bascule> [--resume <fichier>] [--sortie <fichier> : jours={ <jeu>: ligne }]
//                                                                                     → compare les empreintes des jours ; la moindre différence AVANT la bascule arrête
//   node scripts/mise-en-production.mjs empreintes-fusion <existant.json> <nouveau.json> [--jusqua <jour>]  → ajoute les jours nouveaux, refuse un jour qui change
// Lot K4b (la chaîne lit les fiches : `jours.fabrication`, aucun jeu n'est nommé ici) :
//   node scripts/mise-en-production.mjs jeux [--mode registre|fichier-par-jour]      → les identifiants des jeux de la chaîne
//   node scripts/mise-en-production.mjs figer-jeux --prod <dépôt> --cible <dépôt> --proteges <f> --veille <jour> --reference <réf> --sortie <dossier> [--temp <dossier>] [--resume <f>] [--bascule <jour>] [--instant <ms>]
//                                                                                     → pour chaque jeu : registre ou jours figés avec le code en production, superposés à la cible ; écrit l'artefact `jours`
//   node scripts/mise-en-production.mjs servi-verifier --sortie <dossier de l'artefact `jours`> --origine <url> [--instant <ms>] [--resume <f>]   (lot 33)
//                                                                                     → les jours figés à nouveau (jusqu'à aujourd'hui) sont comparés, en lecture seule, au niveau que le serveur de production sert
//   node scripts/mise-en-production.mjs preparer-jeux --cible <dépôt> --proteges <f> --veille <jour> --bascule <jour> --sortie <dossier> [--resume <f>] [--github-sortie <f>]
//                                                                                     → les jours que préparent certains jeux (plan, préparation, garde-fou), avec le code déployé
//   node scripts/mise-en-production.mjs poser-jours <dossier de l'artefact `jours`> [--resume <f>]  → pose dans le dépôt courant ce que la mise en production a produit pour chaque jeu
// Lot R11 (Track fige ses circuits comme Jump) :
//   node scripts/mise-en-production.mjs proteges --origine <url> --cible <dépôt> --premier <jour> --veille <jour> --sortie <fichier>  → les jours qui ne changent jamais : d'avant le lancement, déjà
//                                                                                     figés, ou avec au moins un résultat en production (lecture seule du classement du jour) ; les autres sont régénérés
//   node scripts/mise-en-production.mjs proteges-verifier <proteges.json> --origine <url>  → relit (lecture seule) les jours régénérés : aucun ne doit avoir reçu de résultat depuis
//   node scripts/mise-en-production.mjs registre --jeu <id> <dépôt> --du <jour> --au <jour> --sortie <fichier> [--proteges <fichier>]  → le registre des jours d'un jeu à registre tel que le code de <dépôt> les sert (le module y est copié)
//   node scripts/mise-en-production.mjs registre-fusion <registre du dépôt> <registre de la production> [--resume <fichier>]  → ajoute les jours nouveaux au registre du dépôt (écrit en place),
//                                                                                     refuse un jour qui change ou un jour du dépôt au-delà de la veille de la bascule
//   node scripts/mise-en-production.mjs inventaire <de> <à> [--resume <fichier>]     → « Ce qui part » : PR, versions, migrations, routes
import { execFileSync } from "node:child_process";
import { appendFileSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CHAINE, FICHES_CI, IDS_FICHES, IDS_PRODUCTION, NOMS_DES_JEUX, VERSIONS_DES_JEUX, jeuDeLaChaine } from "./fiches-lecture.mjs";
import { EXCEPTIONS as EXCEPTIONS_DE_ZONES, ZONES as ZONES_DES_JEUX } from "./zones-jeu.mjs";

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

// ——— Lot R6 : le garde-fou des jours ————————————————————————————————————————————————————————————————————————————————————————————

/** Nombre de jours à partir de la bascule régénérés avec le nouveau code, puis validés, pour le résumé (les suivants le sont à la demande des joueurs). */
export const JOURS_REGENERES = 14;

const FORMAT_PARIS = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const partiesDeParis = (ms) => Object.fromEntries(FORMAT_PARIS.formatToParts(new Date(ms)).map((p) => [p.type, p.value]));

/** Le jour de Paris (AAAA-MM-JJ) de l'instant `ms`. */
export function jourDeParis(ms) {
  const p = partiesDeParis(ms);
  return `${p.year}-${p.month}-${p.day}`;
}

/** `date` (AAAA-MM-JJ) décalée de `n` jours du calendrier (jamais d'arithmétique en heures : un jour de Paris dure 23, 24 ou 25 h). */
export function ajouterJours(date, n) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86_400_000).toISOString().slice(0, 10);
}

/**
 * **Le jour de bascule** : le premier jour de Paris qui commence **après** l'instant `ms` du déploiement, c'est-à-dire le lendemain de son jour de Paris.
 * Un mardi à 10 h → le mercredi ; un lundi à 23 h 30 → le mardi ; la nuit d'un changement d'heure aussi (calendrier, pas d'heures). Jamais écrit en dur.
 */
export const jourDeBascule = (ms) => ajouterJours(jourDeParis(ms), 1);

const AVEC_DECALAGE = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

/**
 * L'instant d'une heure donnée « à Paris » : `AAAA-MM-JJ HH:MM` (ou avec `T`), `demain HH:MM` / `aujourdhui HH:MM` (relatifs à `maintenant`), ou un
 * instant complet (`…Z`, `…+02:00`). Une heure qui n'existe pas (la nuit où l'on avance l'heure) est refusée ; une heure qui existe deux fois (la nuit où on
 * la recule) prend la première. Sert à la **répétition** : « un soir à 23 h 30, un matin à 10 h, la nuit du 28 mars 2027 ».
 */
export function instantDeParis(texte, maintenant = Date.now()) {
  const t = String(texte).trim();
  if (AVEC_DECALAGE.test(t) && /^\d{4}-\d{2}-\d{2}T/.test(t)) {
    const ms = Date.parse(t);
    if (Number.isNaN(ms)) throw new Error(`heure illisible : « ${t} »`);
    return ms;
  }
  let local = t;
  const rel = /^(demain|aujourd'?hui)\s+(\d{1,2}):(\d{2})$/i.exec(t);
  if (rel) {
    const jour = jourDeParis(maintenant);
    local = `${/^demain/i.test(rel[1]) ? ajouterJours(jour, 1) : jour} ${rel[2].padStart(2, "0")}:${rel[3]}`;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/.exec(local);
  if (!m) throw new Error(`heure illisible : « ${t} » (attendu : AAAA-MM-JJ HH:MM à Paris, « demain HH:MM », ou un instant …Z)`);
  const [y, mo, d, h, mi] = m.slice(1).map(Number);
  const voulu = `${m[1]}-${m[2]}-${m[3]} ${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
  for (const decalageMin of [120, 60]) {
    const ms = Date.UTC(y, mo - 1, d, h, mi) - decalageMin * 60_000;
    const p = partiesDeParis(ms);
    if (`${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}` === voulu) return ms;
  }
  throw new Error(`« ${voulu} » n'existe pas à Paris (changement d'heure) : choisir une autre minute`);
}

/**
 * La durée d'une mise en production, au plus, du clic au déploiement du site : le jour de bascule se compte depuis la FIN PRÉVUE (clic + cette marge), pas depuis le clic.
 * Mesuré : 32 min (28/10/2026, CI reprise), 31 min jusqu'au serveur (01/11/2026, CI complète relancée). Le 01/11/2026 le bouton, lancé à 23 h 44 à Paris, a calculé la
 * bascule au 02/11 ; le serveur se déployait à 00 h 15 : `bascule-valide` a tout arrêté (le 02/11 avait commencé). Deux heures couvrent une CI complète et des
 * installations lentes (15 min au plus par étape). Un clic après 22 h à Paris met donc la bascule au surlendemain : le lendemain est alors un jour d'avant la bascule,
 * protégé s'il a un résultat, régénéré sinon (règle R11) — comme n'importe quel jour d'avant.
 */
export const DUREE_MISE_EN_PRODUCTION_MS = 2 * 3_600_000;

/** Le plan d'une mise en production lancée à l'instant `ms` : bascule (après la fin prévue, `marge`), dernier jour conservé, jours régénérés, premier jour du lancement. */
export function planDesJours(ms, premierJour, marge = DUREE_MISE_EN_PRODUCTION_MS) {
  const bascule = jourDeBascule(ms + marge);
  return {
    instant: ms,
    jourDeParis: jourDeParis(ms),
    bascule,
    veille: ajouterJours(bascule, -1),
    premier: premierJour,
    dernierRegenere: ajouterJours(bascule, JOURS_REGENERES - 1),
  };
}

/** Le jour de bascule a-t-il déjà commencé à l'instant `ms` ? Alors le clic est trop ancien : la production ne part pas (les jours conservés ne le seraient plus). */
export const basculeCommencee = (bascule, ms) => jourDeParis(ms) >= bascule;

const JOURS_FR = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
export const nomDuJour = (date) => {
  const [y, m, d] = date.split("-").map(Number);
  return `${JOURS_FR[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${date}`;
};

/**
 * Compare les empreintes de ce que sert la production (`prod`) et de ce que servira la nouvelle construction (`cible`) : `{ track: { AAAA-MM-JJ: { id, h, ok } }, jump: … }`.
 * **Avant la bascule, aucune différence n'est permise** (jour passé ou en cours : temps, fantômes, archives en dépendent) ; à partir de la bascule, les jours sont régénérés avec
 * le nouveau code : on compte les jours validés (`ok`) et ceux qui changent. `premier` : les jours d'avant le lancement ne comptent pas — sauf avec `proteges` (lot R11 : la liste
 * des jours protégés, `joursProteges`) : les jours d'avant le lancement et ceux qui ont un résultat sont comparés, **un jour sans résultat ne l'est pas** (il est régénéré, `sansResultat`).
 */
export function comparerEmpreintes(prod, cible, bascule, premier = "0000-00-00", proteges = null) {
  const jeux = {};
  for (const jeu of new Set([...Object.keys(prod), ...Object.keys(cible)].filter((k) => !["version", "du", "au"].includes(k)))) {
    // Lot TP : un jeu que le code en production ne connaît pas encore (la première mise en production de Tower) n'a rien servi : aucun jour à conserver, tous sont régénérés par la construction.
    const absentEnProd = !(jeu in prod);
    const p = prod[jeu] ?? {};
    const c = cible[jeu] ?? {};
    // Lot R11 : avec la liste des jours protégés, les jours d'avant le lancement comptent aussi (ils « restent tels quels »), et un jour sans aucun résultat n'est pas protégé.
    const dates = [...new Set([...Object.keys(p), ...Object.keys(c)])].filter((d) => proteges || d >= premier).sort();
    const r = { conserves: [], differences: [], regeneres: [], valides: 0, invalides: [], changes: [], sansResultat: [] };
    for (const date of dates) {
      if (date < bascule && !absentEnProd && (!proteges || estProtege(proteges, date))) {
        if (!p[date] || !c[date]) r.differences.push({ date, prod: p[date]?.id ?? null, cible: c[date]?.id ?? null, raison: !p[date] ? "absent de la production" : "absent de la construction" });
        else if (p[date].h !== c[date].h) r.differences.push({ date, prod: p[date].id, cible: c[date].id, raison: p[date].id !== c[date].id ? "autre identifiant" : "autre contenu, même identifiant" });
        else r.conserves.push(date);
      } else if (c[date]) {
        if (date < bascule) r.sansResultat.push(date);
        r.regeneres.push(date);
        if (c[date].ok) r.valides++;
        else r.invalides.push(date);
        if (!p[date] || p[date].h !== c[date].h) r.changes.push(date);
      }
    }
    jeux[jeu] = r;
  }
  return { bascule, jeux, ok: Object.values(jeux).every((j) => j.differences.length === 0 && j.invalides.length === 0) };
}

// Lot K4 : le nom d'un jeu dans un résumé est celui de sa fiche (`Track`, `Jump`, `Tower` : les anciens noms « DailyTrack » et « DailyJump » ne servent plus).
const NOMS_JEUX = NOMS_DES_JEUX;

/** Lot R12 : la ligne courte d'un jeu pour le haut du résumé du bouton (« 12 conservés, 14 régénérés dont 3 changent »). */
export function ligneJours(r) {
  const l = `${r.conserves.length} conservé${r.conserves.length > 1 ? "s" : ""}, ${r.regeneres.length} régénéré${r.regeneres.length > 1 ? "s" : ""} (${r.changes.length} change${r.changes.length > 1 ? "nt" : ""})`;
  const pb = r.differences.length + r.invalides.length;
  return pb ? `${l}, ⛔ ${r.differences.length} en différence, ${r.invalides.length} invalide${r.invalides.length > 1 ? "s" : ""}` : l;
}
const plage = (l) => (l.length ? `${l[0]} → ${l.at(-1)}` : "aucun");

/** Le résumé du run : jour de bascule, jours conservés (sans différence), jours régénérés et validés, et — s'il y en a — la liste des jours en cause. */
export function resumeBascule({ plan, comparaison, simulee = false }) {
  const l = [`### Jours : ce qui est conservé, ce qui est rechargé${simulee ? " — **répétition** (heure simulée)" : ""}`, ""];
  l.push(`- Déploiement : \`${plan.jourDeParis}\` (heure de Paris${simulee ? ", simulée" : ""}) → **jour de bascule : ${nomDuJour(plan.bascule)}** (le premier jour de Paris qui commence après le déploiement).`);
  const avant = plan.veille >= plan.premier ? `${plan.premier} → ${plan.veille}` : `aucune journée du lancement ne précède la bascule (le lancement est le ${plan.premier})`;
  l.push(`- Avant la bascule (${avant}) : **la carte de chaque jour protégé (d'avant le lancement, déjà figé ou avec un résultat) est exactement celle que la production sert** ; un jour sans aucun résultat et, à partir du ${plan.bascule}, tous les jours, ont le nouveau code.`, "");
  l.push("| jeu | jours conservés (identiques) | jours en différence | jours régénérés | validés | qui changent |", "|---|---|---|---|---|---|");
  for (const [jeu, r] of Object.entries(comparaison.jeux)) {
    l.push(`| ${NOMS_JEUX[jeu] ?? jeu} | ${r.conserves.length} (${plage(r.conserves)}) | ${r.differences.length} | ${r.regeneres.length} (${plage(r.regeneres)}) | ${r.valides} | ${r.changes.length} |`);
  }
  l.push("");
  for (const [jeu, r] of Object.entries(comparaison.jeux)) {
    for (const d of r.differences) l.push(`- ❌ **${NOMS_JEUX[jeu] ?? jeu} ${d.date}** : ${d.raison} (production \`${d.prod ?? "—"}\`, construction \`${d.cible ?? "—"}\`)`);
    for (const d of r.invalides) l.push(`- ❌ **${NOMS_JEUX[jeu] ?? jeu} ${d}** : le nouveau code ne produit pas de niveau valide (circuit ou niveau de secours)`);
    if (r.sansResultat?.length) l.push(`- ${NOMS_JEUX[jeu] ?? jeu} : ${r.sansResultat.length} jour(s) d'avant la bascule **sans aucun résultat**, régénérés avec le nouveau code (${r.sansResultat.join(", ")}).`);
  }
  l.push(
    comparaison.ok
      ? "- ✅ Aucun jour protégé ne change ; tous les jours régénérés sont valides."
      : "- ⛔ **La mise en production s'arrête** : un jour protégé changerait (ou un jour régénéré n'est pas valide). Corriger (version du générateur, jour figé) puis relancer ; voir `docs/plateforme/mise-en-production.md`.",
  );
  return l.join("\n") + "\n";
}

/**
 * Fusion des empreintes de jours **passés** gardées dans le dépôt (`apps/api/test/jours-passes.json`) : un jour absent s'ajoute, un jour présent doit être identique
 * (un jour passé ne change jamais). Lot R11 : avec `proteges`, seuls les jours protégés à partir du lancement entrent (un jour sans résultat n'est pas « passé »). `existant`, `nouveau` : `{ track: { date: { id, h } }, jump: … }`.
 */
export function fusionnerEmpreintes(existant, nouveau, jusqua = "9999-12-31", proteges = null) {
  const out = JSON.parse(JSON.stringify(existant));
  const conflits = [];
  const ajoutes = [];
  for (const jeu of IDS_PRODUCTION) {
    out[jeu] ??= {};
    for (const [date, e] of Object.entries(nouveau[jeu] ?? {})) {
      if (proteges && (date < proteges.premier || !estProtege(proteges, date))) continue; // lot R11 : seuls les jours protégés du lancement à la veille de la bascule sont « passés » : un jour sans résultat est régénéré
      if (date > jusqua) continue; // à partir de la bascule, le jour n'est pas encore « passé » : le prochain code peut le changer
      const avant = out[jeu][date];
      if (!avant) {
        out[jeu][date] = { id: e.id, h: e.h };
        ajoutes.push(`${jeu} ${date}`);
      } else if (avant.h !== e.h) conflits.push(`${jeu} ${date}`);
    }
    out[jeu] = Object.fromEntries(Object.entries(out[jeu]).sort(([a], [b]) => (a < b ? -1 : 1)));
  }
  return { fusion: out, ajoutes, conflits };
}

// ——— Les jours protégés et le registre des jours de Track (lot R11) ——————————————————————————————————————————————————————————

/**
 * **Quels jours la mise en production protège** (décision de Nathan) : les jours d'avant le lancement public (`config/lancement.json`), les jours déjà figés (une plage du registre de
 * Track, un fichier de Jump : ils ne changent jamais) et **les jours qui ont au moins un résultat en production** (Track ou Jump). Un jour à partir de la journée n° 1 qui n'a aucun
 * résultat est traité comme non servi : la mise en production le régénère avec le code déployé. `figes` : les jours déjà figés (dates) ; `resultats` : `{ date: nombre de classés }`.
 * Rend `{ premier, veille, jours: { date: raison } }` (les jours à partir de `premier` seulement : ceux d'avant le sont tous).
 */
export function joursProteges({ premier, veille, figes = [], resultats = {} }) {
  const jours = {};
  for (let d = premier; d <= veille; d = ajouterJours(d, 1)) {
    if (figes.includes(d)) jours[d] = "déjà figé";
    else if ((resultats[d] ?? 0) > 0) jours[d] = `${resultats[d]} classé(s)`;
  }
  return { format: 1, premier, veille, jours, resultats };
}

/** Vrai si le jour est protégé : d'avant le lancement, ou nommé par `proteges.jours`. */
export const estProtege = (proteges, date) => date < proteges.premier || date in proteges.jours;

/** Les jours (de `du` à `au`) qui ne sont pas protégés : ceux que la mise en production régénère. */
export const joursRegeneres = (proteges, du, au) => {
  const l = [];
  for (let d = du; d <= au; d = ajouterJours(d, 1)) if (!estProtege(proteges, d)) l.push(d);
  return l;
};

/**
 * Lit, **en lecture seule**, combien de joueurs ont fini au moins un jeu chaque jour (`GET /api/portail/classement?date=` : route publique, des `GET` sans identifiant ni corps,
 * que le serveur répond par le classement prouvé de la journée). Un `429` attend la fenêtre (le serveur compte les lectures par adresse) ; tout ce qui n'est pas la réponse
 * attendue (un serveur injoignable, une route absente) **arrête** : sans cette lecture, la mise en production ne sait pas quels jours protéger. `unknown_day` (jour d'avant
 * le lancement du serveur lu) : aucun résultat. `jours` : les dates à lire ; `fetchImpl`, `attendre` : pour les tests.
 */
export async function lireResultats(origine, jours, { fetchImpl = fetch, attendre = (ms) => new Promise((r) => setTimeout(r, ms)), essais = 6 } = {}) {
  const base = origine.replace(/\/+$/, "");
  const resultats = {};
  /** Une lecture (avec ses nouvelles tentatives) : le corps JSON, ou `null` pour un jour inconnu du serveur. */
  const lire = async (date, vue) => {
    for (let essai = 1; ; essai++) {
      let res;
      try {
        res = await fetchImpl(`${base}/api/portail/classement?date=${date}${vue ? `&vue=${vue}` : ""}`, { method: "GET", headers: { Accept: "application/json" } });
      } catch (e) {
        if (essai >= essais) throw new Error(`lecture des résultats du ${date} impossible (${e instanceof Error ? e.message : e})`);
        await attendre(2000 * essai);
        continue;
      }
      if (res.status === 200) {
        const corps = await res.json();
        if (!Number.isInteger(corps?.classes)) throw new Error(`lecture des résultats du ${date} : réponse inattendue (pas de nombre de classés)`);
        return corps;
      }
      if (res.status === 404 && (await res.json().catch(() => null))?.error === "unknown_day") return null;
      if ((res.status === 429 || res.status >= 500) && essai < essais) {
        const apres = Number(res.headers?.get?.("Retry-After"));
        await attendre(res.status === 429 && Number.isFinite(apres) && apres > 0 ? apres * 1000 : 2000 * essai);
        continue;
      }
      throw new Error(`lecture des résultats du ${date} : le serveur répond ${res.status}`);
    }
  };
  for (const date of jours) {
    const corps = await lire(date);
    if (corps === null) {
      resultats[date] = 0;
      continue;
    }
    let classes = corps.classes;
    // Lot TP : un jeu classé à la hauteur (Tower, `unite` dans `jeux`) n'est jamais dans le cumul au temps : ses classés se lisent dans sa propre vue. Un jour où seul Tower a un
    // résultat est un jour joué, donc protégé.
    for (const jeu of Array.isArray(corps.jeux) ? corps.jeux : []) {
      if (!jeu?.unite || typeof jeu.site !== "string" || !/^[a-z0-9-]+$/.test(jeu.site)) continue;
      const v = await lire(date, jeu.site);
      classes += v?.classes ?? 0;
    }
    resultats[date] = classes;
  }
  return resultats;
}

// ——— Lots TP et K4b : les jours des jeux à fichier par jour, figés et préparés par « Mettre en production » ————————————————————————————————————

/**
 * Les versions d'un état du code (`texts` : `{ chemin: texte }`) d'un jeu, d'après sa fiche (`versions.sim` et `versions.generateur`, « fichier:CONSTANTE »), pour savoir si un jour préparé est à
 * refaire : `{ sim, g }` (`null` : le jeu n'existe pas dans ce code).
 */
export function versionsDuJeu(texts, versions) {
  const lire = (v) => {
    const [fichier, nom] = v.split(":");
    const m = new RegExp(`export const ${nom}\\s*=\\s*(\\d+)`).exec(texts[fichier] ?? "");
    return m ? Number(m[1]) : null;
  };
  return { sim: lire(versions.sim), g: lire(versions.generateur) };
}

/**
 * **Ce que la mise en production fait des jours d'un jeu qui les prépare** (règle R11 appliquée à Tower, décision de Nathan ; `preparer` de sa fiche) — sur la fenêtre de la veille de la bascule
 * à `bascule + joursApres` :
 *   - un jour **protégé** (d'avant le lancement, déjà figé, ou avec un résultat de ce jeu ou d'un autre) ne change jamais : son fichier, s'il existe, reste tel quel ; sans fichier on ne
 *     lui en crée pas (ce qu'il a servi, ce qu'il servira, ne bouge pas) ;
 *   - un jour **sans résultat** dont le fichier est de la version du code déployé (`g`, `sim`) est gardé tel quel ; sans fichier, ou avec un fichier d'une autre version, il est
 *     (re)préparé avec le code déployé (le fichier d'une autre version est supprimé avant : l'outil de préparation refuse toujours d'écraser une autre version).
 * `fichiers` : `{ AAAA-MM-JJ: { g, sim } }` des fichiers du dépôt construit ; `versions` : `{ sim, g }` du code déployé ; `proteges` : `joursProteges`. Rend le plan : les jours (et leur sort),
 * ceux à préparer (regroupés en plages consécutives pour l'outil), ceux à supprimer, et la couverture.
 */
export function planPreparation({ veille, bascule, joursApres, proteges, fichiers = {}, versions }) {
  const au = ajouterJours(bascule, joursApres);
  const jours = [];
  const aPreparer = [];
  const aSupprimer = [];
  for (let d = veille; d <= au; d = ajouterJours(d, 1)) {
    const f = fichiers[d];
    let action;
    if (proteges && estProtege(proteges, d)) action = f ? "garde-protege" : "protege-sans-fichier";
    else if (!f) action = "prepare";
    else if (f.g === versions.g && f.sim === versions.sim) action = "garde";
    else action = "reprepare";
    if (action === "prepare" || action === "reprepare") aPreparer.push(d);
    if (action === "reprepare") aSupprimer.push(d);
    jours.push({ date: d, action });
  }
  const plages = plagesConsecutives(aPreparer);
  return { format: 1, du: veille, au, versions, jours, aPreparer, aSupprimer, plages };
}

/** Les dates (triées) regroupées en plages de jours consécutifs `[du, au]`. */
export function plagesConsecutives(dates) {
  const plages = [];
  for (const d of dates) {
    const derniere = plages.at(-1);
    if (derniere && ajouterJours(derniere[1], 1) === d) derniere[1] = d;
    else plages.push([d, d]);
  }
  return plages;
}

/**
 * **Lot R16 — un jour protégé d'un jeu à fichiers préparés a toujours son fichier** (forme `jours-proteges` de `figer`). Tower fige ses jours comme Jump (un fichier par jour) : sans fichier, le jour
 * prendrait le générateur courant, donc changerait à la prochaine version du générateur alors que des joueurs l'ont vu. Les jours à figer sont les jours **protégés** (d'avant le lancement
 * à partir de `proteges.debut`, déjà figés, ou avec un résultat — `estProtege`) jusqu'à la veille de la bascule qui n'ont pas de fichier dans `fichiers` (`{ date: … }`, le dépôt construit).
 * Ils sont figés **avec le code en production** (le script `figer` de la fiche, dans son dépôt : ce qu'il sert est ce qu'il fige), jamais avec le code déployé. `absentDeProd` : le code en production
 * n'a pas le jeu (la première mise en production du jeu) : il n'a rien servi, rien à figer. Rend `{ dates, plages, absentDeProd }`.
 */
export function joursAFiger({ proteges, fichiers = {}, absentDeProd = false }) {
  const dates = [];
  if (!absentDeProd) {
    for (let d = proteges.debut ?? proteges.premier; d <= proteges.veille; d = ajouterJours(d, 1)) if (estProtege(proteges, d) && !(d in fichiers)) dates.push(d);
  }
  return { format: 1, dates, plages: plagesConsecutives(dates), absentDeProd };
}

/**
 * Pose les jours que le code en production vient de figer (`figes` : `{ nom de fichier: contenu }`) dans le dossier de la construction (`existants`) et **refuse de terminer s'il en
 * manque un** : un jour du plan sans fichier figé, ou figé dans un autre contenu que celui déjà là, est une erreur (un jour figé ne change jamais). Rend les fichiers à écrire.
 */
export function figesAPoser(plan, figes, existants) {
  const manquants = [];
  const conflits = [];
  const ecrire = [];
  for (const d of plan.dates) {
    const nom = `${d}.json`;
    if (!(nom in figes)) manquants.push(d);
    else if (!(nom in existants)) ecrire.push(nom);
    else if (existants[nom] !== figes[nom]) conflits.push(d);
  }
  return { ecrire, manquants, conflits };
}

/**
 * Ce que « poser » les jours d'un jeu d'une construction fait dans un dossier (le dossier de ses jours dans le commit déployé, l'image, le site ou `main`) : `artefact` et `existants` sont
 * `{ nom de fichier: contenu }`. Un fichier absent s'ajoute ; identique, rien ; différent, il n'est remplacé que si le plan le **refait** (jour sans résultat d'une autre version, `aSupprimer`) —
 * sinon c'est un conflit : un jour figé ne change jamais. Sans plan (un jeu qui ne prépare rien : Jump), tout fichier différent est un conflit.
 */
export function joursAPoser(artefact, existants, plan = { aSupprimer: [] }) {
  const ajouts = [];
  const remplaces = [];
  const conflits = [];
  for (const [nom, contenu] of Object.entries(artefact)) {
    if (!/^\d{4}-\d{2}-\d{2}\.json$/.test(nom)) continue;
    if (!(nom in existants)) ajouts.push(nom);
    else if (existants[nom] !== contenu) (plan.aSupprimer.includes(nom.slice(0, 10)) ? remplaces : conflits).push(nom);
  }
  return { ajouts: ajouts.sort(), remplaces: remplaces.sort(), conflits: conflits.sort() };
}

/** Lot R16 : le résumé de l'étape qui fige les jours déjà servis d'un jeu (`nom` : son nom d'après sa fiche). */
export function resumeFiges(nom, plan) {
  const l = [`### ${nom} : les jours servis sont figés`, ""];
  if (plan.absentDeProd) l.push(`- Le code en production n'a pas ${nom} : il n'a servi aucun jour, rien à figer.`);
  else if (plan.dates.length === 0) l.push("- Chaque jour protégé a déjà son fichier : rien à figer.");
  else l.push(`- ${plan.dates.length} jour(s) protégé(s) sans fichier, figés avec **le code en production** : ${plage(plan.dates)} (${plan.dates.length} jour${plan.dates.length > 1 ? "s" : ""}). Un jour servi ne change plus, quelle que soit la version du générateur déployée ensuite.`);
  return l.join("\n") + "\n";
}

/** Le résumé du run : les jours d'un jeu conservés, préparés, refaits, jusqu'où ils sont couverts, et le temps de la préparation mesuré sur le runner. */
export function resumePreparation(nom, plan, joursApres, mesure = null) {
  const n = (a) => plan.jours.filter((j) => j.action === a).map((j) => j.date);
  const protegesGardes = n("garde-protege");
  const gardes = n("garde");
  const prepares = n("prepare");
  const refaits = n("reprepare");
  const sansFichier = n("protege-sans-fichier");
  const l = [`### ${nom} : les jours préparés`, ""];
  l.push(`- Fenêtre : **${plan.du} → ${plan.au}** (la veille de la bascule jusqu'à J+${joursApres}), code déployé : simulation v${plan.versions.sim}, générateur g${plan.versions.g}.`);
  l.push(`- Conservés tels quels : ${protegesGardes.length + gardes.length} (${protegesGardes.length} protégé${protegesGardes.length > 1 ? "s" : ""}, ${gardes.length} sans résultat mais déjà à la version du code)${protegesGardes.length + gardes.length ? ` — ${[...protegesGardes, ...gardes].sort().join(", ")}` : ""}.`);
  l.push(`- Préparés : ${prepares.length}${prepares.length ? ` (${plage(prepares)})` : ""} ; refaits (autre version, sans résultat) : ${refaits.length}${refaits.length ? ` (${refaits.join(", ")})` : ""}.`);
  if (sansFichier.length) l.push(`- Protégés sans fichier préparé : ${sansFichier.join(", ")} — ils gardent ce qu'ils ont servi (rien n'est créé pour eux).`);
  if (mesure) l.push(`- Temps : ${mesure.jours} jour${mesure.jours > 1 ? "s" : ""} préparé${mesure.jours > 1 ? "s" : ""} en **${Math.floor(mesure.secondes / 60)} min ${Math.round(mesure.secondes % 60)} s** sur ${mesure.fils} fil${mesure.fils > 1 ? "s" : ""} (le runner de la mise en production).`);
  l.push(`- **Jours couverts : ${plan.du} → ${plan.au}** (${plan.jours.length} jours). À partir du ${ajouterJours(plan.au, 1)}, un jour n'a pas de fichier préparé tant qu'une autre mise en production n'a pas eu lieu : ${nom} le sert avec l'estimation géométrique de ses médailles (« provisoire »). **Prochaine mise en production au plus tard le ${plan.au}.**`);
  return l.join("\n") + "\n";
}

/** La ligne courte d'un jeu qui prépare ses jours, pour le haut du résumé du bouton (« 3 conservé(s), 14 préparé(s), 0 refait(s), couvert jusqu'au … »). */
export function lignePreparation(plan) {
  const n = (act) => plan.jours.filter((j) => j.action === act).length;
  return `${n("garde") + n("garde-protege")} conservé(s), ${n("prepare")} préparé(s), ${n("reprepare")} refait(s), couvert jusqu'au ${plan.au}`;
}

/**
 * Le registre des jours de Track (`packages/sim/src/jours-track.json`) : `{ format: 1, jusqua, plages: [{ du, au, g, sim }] }` — la version du générateur (`g`) et de la simulation
 * (`sim`) de chaque jour **protégé**, par plages de jours consécutifs de même version ; `jusqua` : le dernier jour que la dernière mise en production a décidé. Jump fige ses
 * niveaux dans `apps/jump/public/levels/` ; Track a ce seul fichier : `generatorVersionOf` (packages/sim/src/dailyId.ts) le lit, un jour absent prend la dernière version.
 * `joursDuRegistre` le déplie en `{ AAAA-MM-JJ: "g/sim" }`.
 */
export function joursDuRegistre(registre) {
  const jours = {};
  for (const p of registre?.plages ?? []) for (let d = p.du; d <= p.au; d = ajouterJours(d, 1)) jours[d] = `${p.g}/${p.sim}`;
  return jours;
}

/** Le contraire : des jours `{ date: "g/sim" }` en registre (jours consécutifs de même version fondus en une plage ; un trou, une nouvelle plage). */
export function registreDesJours(jours, jusqua) {
  const dates = Object.keys(jours).sort();
  const plages = [];
  for (const date of dates) {
    const [g, sim] = jours[date].split("/").map(Number);
    const derniere = plages.at(-1);
    if (derniere && derniere.g === g && derniere.sim === sim && ajouterJours(derniere.au, 1) === date) derniere.au = date;
    else plages.push({ du: date, au: date, g, sim });
  }
  return { format: 1, jusqua: jusqua ?? dates.at(-1), plages };
}

/**
 * Fusion du registre du dépôt (`existant`) avec celui que la production sert pour ses jours protégés (`nouveau`, calculé par le code en production jusqu'à la veille de la bascule) :
 * un jour absent s'ajoute, un jour présent doit avoir **la même version** (un jour protégé ne change jamais), et le dépôt ne doit nommer **aucun jour au-delà de la veille de la
 * bascule** (ces jours-là prennent la dernière version). `conflits` : les jours en cause, avec la raison.
 */
export function fusionnerRegistre(existant, nouveau) {
  const avant = joursDuRegistre(existant);
  const prod = joursDuRegistre(nouveau);
  const conflits = [];
  const ajoutes = [];
  let conserves = 0;
  const v = (x) => x.replace("/", " (sim ") + ")";
  for (const date of Object.keys(avant)) {
    if (date > nouveau.jusqua) conflits.push({ date, raison: `dans le dépôt, au-delà de la veille de la bascule (${nouveau.jusqua}) : ce jour-là prend la dernière version` });
    else if (!prod[date]) conflits.push({ date, raison: "dans le dépôt, absent de ce que la production sert" });
    else if (prod[date] !== avant[date]) conflits.push({ date, raison: `v${v(avant[date])} dans le dépôt, v${v(prod[date])} en production` });
    else conserves++;
  }
  for (const date of Object.keys(prod)) if (!avant[date]) ajoutes.push(date);
  const jours = { ...avant, ...prod };
  return { fusion: registreDesJours(Object.fromEntries(Object.entries(jours).filter(([d]) => d <= nouveau.jusqua)), nouveau.jusqua), conserves, ajoutes: ajoutes.sort(), conflits };
}

/** Le résumé du registre de Track pour le run (comparaison : « même règle que Jump », toute différence d'un jour protégé arrête la mise en production). */
export function resumeRegistre({ conserves, ajoutes, conflits, fusion }) {
  const l = ["### Registre des jours de Track", ""];
  l.push(`- ${conserves} jour(s) du dépôt identiques à ce que la production sert, **${conflits.length} différence(s)**, ${ajoutes.length} jour(s) ajouté(s)${ajoutes.length ? ` (${ajoutes[0]} → ${ajoutes.at(-1)})` : ""} ; le registre décide maintenant jusqu'au ${fusion.jusqua} (${fusion.plages.length} plage(s)).`);
  for (const c of conflits) l.push(`- ❌ **DailyTrack ${c.date}** : ${c.raison}`);
  l.push(conflits.length ? "- ⛔ **La mise en production s'arrête** : un jour du registre ne s'accorde pas avec ce que la production sert." : "- ✅ Aucun jour du registre ne change.");
  return l.join("\n") + "\n";
}

/** Le résumé des jours protégés : combien, pourquoi, et lesquels sont régénérés (aucun résultat). */
export function resumeProteges(proteges, du, au) {
  const raisons = Object.values(proteges.jours);
  const par = (prefixe) => raisons.filter((r) => r.startsWith(prefixe)).length;
  const regeneres = joursRegeneres(proteges, proteges.premier, au);
  const l = ["### Jours protégés et jours sans résultat", ""];
  l.push(`- Protégés (ils ne changent jamais) : tous les jours d'avant le lancement (${proteges.premier}), ${par("déjà figé")} jour(s) déjà figé(s), ${raisons.length - par("déjà figé")} jour(s) avec au moins un résultat en production (lecture seule du classement du jour).`);
  l.push(regeneres.length ? `- **Sans aucun résultat, donc régénérés avec le nouveau code** (${regeneres.length}, du ${proteges.premier} à la veille de la bascule ${proteges.veille}) : ${regeneres.join(", ")}.` : `- Aucun jour d'avant la bascule n'est sans résultat : tous restent tels quels.`);
  void du;
  return l.join("\n") + "\n";
}

/**
 * Les fichiers de niveaux de Jump à garder après `freeze:days` (qui fige tout jusqu'à la veille de la bascule) : les jours protégés seulement. Un jour sans résultat n'est pas
 * figé : le nouveau code le régénère.
 */
export const niveauxAEffacer = (fichiers, proteges) => fichiers.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f) && !estProtege(proteges, f.slice(0, 10)));

// ——— Lot 33 (incident du 06/11/2026) : un jour servi ne change jamais ————————————————————————————————————————————————————————————————————————————
// Le 06/11/2026 la mise en production a figé les jours 03 à 06/11 de Jump avec un outil qui ne déclarait pas les niveaux déjà figés d'un ancien générateur : les fichiers n'étaient pas les niveaux que la
// production avait servis, et le niveau du jour (et trois archives) a changé alors que des temps étaient enregistrés. Le garde-fou ne le voyait pas : il comparait des fichiers à des fichiers. Désormais, pour
// un jeu à fichiers de la forme `jusqu-a-la-veille` (Jump) : (1) tout jour non figé, du dernier jour figé à DEMAIN, est figé avec le code en production (aucun retrait des jours sans résultat) ;
// (2) chaque fichier écrit est comparé à ce que le code en production sert SANS lui (les empreintes de l'image d'avant) ; (3) en production, au niveau que le serveur sert en ce moment (`servi-verifier`) ;
// (4) la mise en production refuse de déployer s'il reste un jour déjà servi sans fichier figé ; (5) le calendrier des bascules du générateur (`bascules.json`) refuse une bascule fixée à aujourd'hui ou avant.

/** Les jours (de `du` à `au`, comprises) qui n'ont pas de fichier : `fichiers` = les dates (AAAA-MM-JJ) qui en ont. Un jour servi sans fichier est un jour qui peut changer au prochain déploiement. */
export function joursSansFichier({ du, au, fichiers }) {
  const ont = new Set(fichiers);
  const manquants = [];
  for (let d = du; d <= au; d = ajouterJours(d, 1)) if (!ont.has(d)) manquants.push(d);
  return manquants;
}

/** Le dernier jour à figer : demain (jour de Paris), la veille de la bascule, ou la veille de la plus lointaine bascule de générateur annoncée (les jours d'avant sont du générateur actuel : le code déployé ne les rend plus). */
export function dernierJourAFiger({ veille, demain, nouvelles = [] }) {
  return [veille, demain, ...nouvelles.map((b) => ajouterJours(b.depuis, -1))].reduce((a, b) => (b > a ? b : a));
}

/** Plus lointaine bascule acceptée : au-delà, trop de jours seraient figés à l'avance par l'ancien code (ceux d'avant la bascule). */
export const BASCULE_MAX_JOURS = JOURS_REGENERES;

/**
 * **Le calendrier des bascules du générateur** (`bascules.json` à côté du fichier de versions du jeu : `{ bascules: [{ depuis, generateur }] }`). `avant` et `apres` : son contenu dans le code en production et dans le
 * code à déployer (`null` : le code n'en a pas — le code en production d'avant le lot 33) ; `generateurAvant` et `generateurApres` : les versions du générateur de chaque code ; `bascule` : le jour de bascule de ce
 * déploiement (le premier jour de Paris qui commence après lui). Rend `{ nouvelles, problemes }` : les entrées que ce déploiement ajoute (un générateur plus récent que celui de la production), et ce qui les refuse :
 *   - **une bascule fixée à aujourd'hui ou avant** (`depuis` avant le jour de bascule) : un jour déjà ouvert serait régénéré ;
 *   - une bascule trop lointaine (plus de `BASCULE_MAX_JOURS` jours après le jour de bascule) ;
 *   - un générateur qui change sans entrée au calendrier, ou une dernière entrée qui n'est pas le générateur du code.
 */
export function verifierBascules({ avant, apres, generateurAvant, generateurApres, bascule }) {
  const problemes = [];
  const entrees = Array.isArray(apres?.bascules) ? apres.bascules : [];
  const connus = Math.max(generateurAvant ?? 0, ...(Array.isArray(avant?.bascules) ? avant.bascules.map((b) => b.generateur) : [0]));
  const nouvelles = entrees.filter((b) => b.generateur > connus);
  if (generateurApres !== null && generateurApres !== undefined) {
    if (entrees.length === 0 && generateurApres !== generateurAvant) problemes.push(`le générateur passe de g${generateurAvant} à g${generateurApres} mais le code déployé n'a pas de calendrier des bascules (bascules.json)`);
    if (entrees.length > 0 && entrees.at(-1).generateur !== generateurApres) problemes.push(`la dernière entrée du calendrier est g${entrees.at(-1).generateur}, le code déployé est g${generateurApres}`);
    if (generateurApres !== generateurAvant && !nouvelles.some((b) => b.generateur === generateurApres)) problemes.push(`le générateur passe de g${generateurAvant} à g${generateurApres} sans entrée de g${generateurApres} au calendrier des bascules`);
  }
  for (const b of nouvelles) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.depuis ?? "")) problemes.push(`g${b.generateur} : date de bascule illisible « ${b.depuis} »`);
    else if (b.depuis < bascule) problemes.push(`g${b.generateur} est fixé au ${b.depuis} : un nouveau générateur ne s'applique qu'à partir de DEMAIN au plus tôt (jour de bascule de ce déploiement : ${bascule}) — fixer la bascule au ${bascule} ou après`);
    else if (b.depuis > ajouterJours(bascule, BASCULE_MAX_JOURS)) problemes.push(`g${b.generateur} est fixé au ${b.depuis}, plus de ${BASCULE_MAX_JOURS} jours après le jour de bascule (${bascule}) : rapprocher la date`);
  }
  return { nouvelles, problemes };
}

/** Compare les niveaux figés (`attendus` : `{ date: { id, hash } }`) à ce que le serveur sert (`servis`, même forme). Rend les différences en phrases (liste vide : tout s'accorde). */
export function comparerAuServi(attendus, servis) {
  const diffs = [];
  for (const [date, a] of Object.entries(attendus)) {
    const s = servis[date];
    if (!s) diffs.push(`${date} : le serveur ne sert aucun niveau`);
    else if (s.id !== a.id || s.hash !== a.hash) diffs.push(`${date} : le fichier figé est ${a.id} (${a.hash}), le serveur sert ${s.id} (${s.hash})`);
  }
  return diffs;
}

/**
 * Lit, **en lecture seule**, le niveau que le serveur de `origine` sert pour chaque date (`GET /api/jump/day/<date>` : identifiant et empreinte, aucune donnée de joueur). Tout ce qui n'est pas la réponse
 * attendue (un serveur injoignable, une route absente) lève une erreur : sans cette lecture, on ne sait pas ce que les joueurs ont vu. `route` : le chemin du jeu (`/api/jump/day`).
 */
export async function lireNiveauxServis(origine, dates, { route = "/api/jump/day", fetchImpl = fetch, attendre = (ms) => new Promise((r) => setTimeout(r, ms)), essais = 5 } = {}) {
  const base = origine.replace(/\/+$/, "");
  const servis = {};
  for (const date of dates) {
    for (let essai = 1; ; essai++) {
      let res;
      try {
        res = await fetchImpl(`${base}${route}/${date}`, { method: "GET", headers: { Accept: "application/json" } });
      } catch (e) {
        if (essai >= essais) throw new Error(`lecture du niveau servi le ${date} impossible (${e instanceof Error ? e.message : e})`);
        await attendre(2000 * essai);
        continue;
      }
      if (res.status === 200) {
        const corps = await res.json();
        if (typeof corps?.id !== "string" || typeof corps?.hash !== "string") throw new Error(`lecture du niveau servi le ${date} : réponse inattendue (ni identifiant ni empreinte)`);
        servis[date] = { id: corps.id, hash: corps.hash };
        break;
      }
      if ((res.status === 429 || res.status >= 500) && essai < essais) {
        const apres = Number(res.headers?.get?.("Retry-After"));
        await attendre(res.status === 429 && Number.isFinite(apres) && apres > 0 ? apres * 1000 : 2000 * essai);
        continue;
      }
      if (res.status === 404) break; // un jour que le serveur ne connaît pas (avant son premier niveau, ou à venir) : rien n'est servi
      throw new Error(`lecture du niveau servi le ${date} : le serveur répond ${res.status}`);
    }
  }
  return servis;
}

// ——— L'inventaire : « Ce qui part » ————————————————————————————————————————————————————————————————————————————————————————

// Lot K4 : les versions de chaque jeu viennent de sa fiche (`versions.sim` et `versions.generateur`, « fichier:CONSTANTE »).
const VERSIONS = VERSIONS_DES_JEUX;

/** Les versions et les dates de bascule d'un état du code : `texts` = `{ chemin: texte }` (absent : le fichier n'existait pas encore). */
export function versionsDe(texts) {
  const v = {};
  for (const { nom, fichier } of VERSIONS) {
    const m = new RegExp(`export const ${nom}\\s*=\\s*(\\d+)`).exec(texts[fichier] ?? "");
    v[nom] = m ? Number(m[1]) : null;
  }
  const bascules = {};
  for (const f of ["packages/sim/src/dailyId.ts", "packages/sim/src/medals.ts"]) {
    for (const m of (texts[f] ?? "").matchAll(/export const (BASCULE_[A-Z0-9_]+)\s*=\s*daysFromCivil\((\d+),\s*(\d+),\s*(\d+)\)/g)) {
      bascules[m[1]] = `${m[2]}-${m[3].padStart(2, "0")}-${m[4].padStart(2, "0")}`;
    }
  }
  v.bascules = bascules;
  return v;
}

/** Migrations (`MIGRATIONS` de db.ts) et tables (`CREATE TABLE`) d'un état du code. */
export function baseDe(texts) {
  const db = texts["apps/api/src/db.ts"] ?? "";
  const bloc = /export const MIGRATIONS[^=]*=\s*\[([\s\S]*?)\n\];/.exec(db)?.[1] ?? "";
  const migrations = [...bloc.matchAll(/^\s*"((?:[^"\\]|\\.)*)"/gm)].map((m) => m[1]);
  const tables = new Set();
  for (const [chemin, t] of Object.entries(texts)) {
    if (!chemin.startsWith("apps/api/src/")) continue;
    for (const m of t.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)) tables.add(m[1]);
  }
  return { migrations, tables: [...tables].sort() };
}

/** Les routes du serveur (`/api/…`) lues dans les sources de `apps/api/src` : motifs écrits dans les lignes qui lisent `path`. */
export function routesDe(texts) {
  const routes = new Set();
  for (const [chemin, t] of Object.entries(texts)) {
    if (!chemin.startsWith("apps/api/src/")) continue;
    for (const ligne of t.split("\n")) {
      if (!/\bpath\b|\bpm\b|\bsm\b|=\s*\/\^/.test(ligne) || /^\s*(\/\/|\*)/.test(ligne)) continue;
      for (const m of ligne.matchAll(/\\?\/api(?:\\?\/[A-Za-z0-9_\-.:()\[\]|?^*+]+)+/g)) routes.add(m[0].replaceAll("\\/", "/").replace(/[()?^$]+$/g, ""));
    }
  }
  return [...routes].sort();
}

// Lot K4 : la zone d'une PR vient des fiches (`zones.jeu` de chaque jeu, comme scripts/zones-jeu.mjs : `ZONES`) ; les fichiers partagés qu'un lot de jeu a le droit de toucher
// (CLAUDE.md racine, « Lots en parallèle ») sont les exceptions de ce même script, plus les fichiers mécaniques d'un jeu (verrou, zones de CI, catalogues, durées des e2e, tests de l'API).
const motif = (glob) => new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*")}$`);
const TOLERES_POUR_UN_JEU = [
  ...EXCEPTIONS_DE_ZONES.map(motif),
  /^(package-lock\.json|e2e\/zones\.json|packages\/ui\/src\/catalogue[^/]*\.ts|apps\/api\/test\/[^/]+)$/,
  ...FICHES_CI.map((f) => motif(`${f.e2e.dossier}/durees.json`)),
];

/** La zone d'une PR d'après les fichiers qu'elle touche. */
export function zoneDes(fichiers) {
  const zones = IDS_FICHES.map((id) => ({ id, nom: NOMS_DES_JEUX[id], res: ZONES_DES_JEUX[id].map(motif) }));
  const z = zones.filter((jeu) => fichiers.some((f) => jeu.res.some((re) => re.test(f)))).map((jeu) => jeu.nom);
  const plateforme = fichiers.some((f) => !zones.some((jeu) => jeu.res.some((re) => re.test(f))) && !TOLERES_POUR_UN_JEU.some((re) => re.test(f)));
  if (plateforme || z.length === 0) z.push("plateforme");
  return z.join(" + ");
}

/** Le lot d'une PR d'après son titre ou sa branche (« Lot R6 », « lot-23-champignons »…), ou `—`. */
export function lotDe(titre, branche) {
  const m = /\blot[\s-]+([A-Za-z]?\d+[a-z]?)\b/i.exec(`${titre ?? ""} ${branche ?? ""}`);
  return m ? `lot ${m[1].toUpperCase()}` : "—";
}

/**
 * « Ce qui part » : l'effet pour le joueur, le risque et la vérification de chaque changement, **par règle** (la même pour chaque mise en production : ce que dit
 * `docs/plateforme/mise-en-production.md`). Une ligne par PR (titre, lot, zone), puis par version, migration et route qui change.
 */
export function inventaire({ de, a, prs, versionsAvant, versionsApres, baseAvant, baseApres, routesAvant, routesApres, repo }) {
  const lien = (n) => (repo ? `[#${n}](https://github.com/${repo}/pull/${n})` : `#${n}`);
  const l = [`### Ce qui part — de \`${de ?? "(début)"}\` à \`${a.slice(0, 7)}\``, ""];
  l.push(`**PR fusionnées (${prs.length})**`, "");
  if (prs.length) {
    l.push("| PR | titre | lot | zone |", "|---|---|---|---|");
    for (const p of prs) l.push(`| ${lien(p.number)} | ${String(p.titre ?? p.branche ?? "").replace(/[|<>]/g, " ").slice(0, 90)} | ${p.lot ?? "—"} | ${p.zone ?? "—"} |`);
  } else l.push("aucune");
  l.push("");

  const lignes = [];
  const vers = (nom, jeu, effet, risque, verif) => {
    const x = versionsAvant[nom];
    const y = versionsApres[nom];
    if (x !== y) lignes.push([`${nom} : ${x ?? "—"} → ${y ?? "—"}`, effet, risque, verif]);
  };
  vers("JUMP_GENERATOR_VERSION", "Jump", "Les niveaux de Jump **à partir du jour de bascule** changent (autres morceaux) ; avant, rien.", "Un jour passé qui changerait arrête la mise en production.", "Résumé « Jours » : 0 différence, N jours régénérés et valides.");
  vers("JUMP_SIM_VERSION", "Jump", "La physique de Jump change pour les niveaux d'après la bascule ; les jours figés se rejouent comme avant.", "Un onglet resté ouvert envoie l'ancienne version : accepté pour un jour d'avant la bascule, sinon « recharge la page ».", "Tests `jumpVieuxOnglets` ; les archives se rejouent (liste de contrôle).");
  vers("GENERATOR_VERSION", "Track", "Les circuits de Track **à partir du jour de bascule de la mise en production** changent (le registre des jours garde la version de chaque jour servi) ; les jours d'avant gardent leur circuit au bit près.", "Un jour servi que le registre ne nommerait pas prendrait la nouvelle version : le registre est écrit par ce workflow, avant le déploiement.", "Résumé « Jours » et « Registre des jours de Track » : 0 différence ; `jours-passes.json`.");
  vers("SIM_VERSION", "Track", "La physique de Track change : les anciennes rediffusions ne se rejouent plus.", "Un onglet ouvert reçoit « recharge la page » à l'envoi ; le fantôme d'avant est ignoré.", "Golden régénérés par le lot ; un temps envoyé après le déploiement.");
  // Lot K4 : les versions des autres jeux (Tower, un jeu neuf) : le même texte, par rôle, avec le nom du jeu de la fiche. Track et Jump gardent leur texte ci-dessus.
  const avecTexte = new Set(["JUMP_GENERATOR_VERSION", "JUMP_SIM_VERSION", "GENERATOR_VERSION", "SIM_VERSION"]);
  for (const { nom, jeu, role } of VERSIONS.filter((v) => !avecTexte.has(v.nom))) {
    if (role === "generateur") vers(nom, jeu, `Le contenu de ${jeu} **à partir du jour de bascule** change (un jour servi garde son fichier figé) ; avant, rien.`, "Un jour passé qui changerait arrête la mise en production.", "Résumé « Jours » : 0 différence, N jours régénérés et valides.");
    else vers(nom, jeu, `La simulation de ${jeu} change : les rediffusions d'une autre version sont refusées ou rejouées par leur version.`, "Un onglet ouvert reçoit « recharge la page » à l'envoi ; le fantôme d'avant est ignoré.", "Golden régénérés par le lot ; un résultat envoyé après le déploiement.");
  }
  for (const nom of new Set([...Object.keys(versionsAvant.bascules ?? {}), ...Object.keys(versionsApres.bascules ?? {})])) {
    const x = versionsAvant.bascules?.[nom];
    const y = versionsApres.bascules?.[nom];
    if (x !== y) lignes.push([`${nom} : ${x ?? "—"} → ${y ?? "—"}`, "Date à partir de laquelle une règle de Track vaut (médailles : lot 35 ; le générateur n'a plus de date, lot R11).", "Une date d'avant le jour de bascule de la mise en production changerait un jour déjà joué.", "Le garde-fou des jours (empreintes) le dit avant le déploiement."]);
  }
  const nouvellesMigrations = baseApres.migrations.filter((m) => !baseAvant.migrations.includes(m));
  for (const m of nouvellesMigrations) lignes.push([`migration : \`${m.slice(0, 110)}\``, "Aucun changement visible (la base gagne une colonne ou un index).", "Le retour arrière doit tourner sur la base migrée : colonne vide ou valeur par défaut seulement.", "Test des migrations ; « ancien code sur base migrée » (workflow)."]);
  for (const t of baseApres.tables.filter((x) => !baseAvant.tables.includes(x))) lignes.push([`nouvelle table \`${t}\``, "Aucun changement visible tant qu'aucune route ne la remplit.", "Rejoint la remise à zéro (`TABLES_VIDEES`) et l'effacement d'un joueur.", "Test de `remiseAZero`."]);
  for (const r of routesApres.filter((x) => !routesAvant.includes(x))) lignes.push([`route ajoutée \`${r}\``, "Une nouvelle réponse du serveur ; les jeux d'avant ne l'appellent pas.", "Coût en requêtes ; cache à vérifier.", "`smoke --lecture-seule` ; liste des routes de `docs/plateforme/codes-erreur.md`."]);
  for (const r of routesAvant.filter((x) => !routesApres.includes(x))) lignes.push([`route retirée \`${r}\``, "Un onglet resté ouvert qui l'appelle encore reçoit 404.", "Un vieux client sans repli : message d'erreur au lieu de la donnée.", "Chercher l'appelant dans `apps/web` et `apps/jump`."]);

  l.push("**Versions, base et routes qui changent**", "");
  if (lignes.length) {
    l.push("| changement | effet pour le joueur | risque | comment on le vérifie |", "|---|---|---|---|");
    for (const [c, e, r, v] of lignes) l.push(`| ${c} | ${e} | ${r} | ${v} |`);
  } else l.push("aucune version, migration ni route ne change.");
  l.push("");
  l.push(`Schéma de la base : ${baseApres.migrations.length} migration(s) en tout, ${nouvellesMigrations.length} nouvelle(s) ; ${baseApres.tables.length} table(s).`, "");
  return l.join("\n");
}

const read = (dir) => (existsSync(dir) ? Object.fromEntries(readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => [f, readFileSync(join(dir, f), "utf8")])) : {});
const git = (...args) => execFileSync("git", args, { encoding: "utf8" });

// ——— Lot K4b : la chaîne des jours, jeu par jeu (lue dans les fiches : `jours.fabrication`) ————————————————————————————————————————————————————————

const SCRIPTS_ICI = fileURLToPath(new URL("../apps/api/scripts/", import.meta.url));
const copierSiAutre = (de, vers) => {
  if (resolve(de) !== resolve(vers)) copyFileSync(de, vers);
};
const datesDuDossier = (dossier) => (existsSync(dossier) ? readdirSync(dossier).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 10)) : []);
/** Un script de l'API du dépôt `depot` (`apps/api/scripts/<entree>.ts`), compilé là (esbuild du dépôt) puis lancé avec `args`. */
function compilerEtLancer(depot, entree, args) {
  const api = join(depot, "apps/api");
  execFileSync(join(depot, "node_modules/.bin/esbuild"), [`scripts/${entree}.ts`, "--bundle", "--platform=node", "--format=esm", "--target=node22", `--outfile=dist/${entree}.mjs`, "--log-level=warning"], { cwd: api, stdio: "inherit" });
  execFileSync(process.execPath, [`dist/${entree}.mjs`, ...args], { cwd: api, stdio: "inherit", env: { ...process.env, NODE_NO_WARNINGS: "1" } });
}
const ajouterAuResume = (resume, texte) => {
  if (resume) appendFileSync(resume, texte);
  process.stdout.write(texte);
};

/** Remet dans `cible` ce que la production sert d'un jeu sans que ce soit dans le commit de `ref` : ses fichiers (un jeu à fichier par jour : dans le dossier `cible`) ou son registre (un jeu à registre : le fichier `cible`). */
export function joursServis(jeu, ref, cible, jusqua = "origin/main") {
  const commits = git("log", "--reverse", "--format=%H", "-E", "--grep=^Jours figés de la mise en production", `${ref}..${jusqua}`).split("\n").filter(Boolean);
  if (jeu.mode === "fichier-par-jour") {
    mkdirSync(cible, { recursive: true });
    const remis = [];
    // Un jeu dont les fichiers sont figés une fois pour toutes (Jump) : un fichier déjà là n'est jamais réécrit. Un jeu qui PRÉPARE ses jours (Tower) en refait : ce que la production sert est la dernière version
    // versée depuis l'étiquette, qui remplace celle du commit de l'étiquette (sans cela, le jour de Tower refait par la mise en production du 02/11 se comparait à sa version périmée).
    const remplace = Boolean(jeu.preparer);
    for (const sha of commits) {
      for (const chemin of git("diff-tree", "--no-commit-id", "--name-only", "-r", sha, "--", jeu.dossier).split("\n").filter((f) => /\/\d{4}-\d{2}-\d{2}\.json$/.test(f))) {
        const fichier = join(cible, chemin.split("/").at(-1));
        if (existsSync(fichier) && !remplace) continue;
        writeFileSync(fichier, git("show", `${sha}:${chemin}`));
        if (!remis.includes(chemin.split("/").at(-1))) remis.push(chemin.split("/").at(-1));
      }
    }
    console.log(remis.length ? `jours servis par la production, remis : ${remis.join(" ")}` : "aucun jour servi hors du commit de l'étiquette");
  } else if (existsSync(dirname(cible))) {
    // Le registre des jours que la production sert est celui de son image : le fichier du commit de l'étiquette, plus ce que les PR « Jours figés » y ont ajouté depuis. Un code en production d'avant le
    // registre n'a pas le fichier : rien à remettre (il choisit la version par une date).
    const dernier = git("log", "--format=%H", "-1", "-E", "--grep=^Jours figés de la mise en production", `${ref}..${jusqua}`, "--", jeu.registre).trim();
    if (dernier) {
      writeFileSync(cible, git("show", `${dernier}:${jeu.registre}`));
      console.log(`registre des jours de ${jeu.nom} servi par la production : celui de ${dernier.slice(0, 7)}`);
    } else console.log(`registre des jours de ${jeu.nom} : celui du commit de l'étiquette`);
  }
}

/** Le registre d'un jeu à registre tel que le code de `depot` le sert, de `du` à `au`, restreint aux jours protégés, écrit dans `sortie`. */
export function registreDuDepot(jeu, depot, du, au, proteges, sortie) {
  depot = resolve(depot);
  const dossier = join(depot, "apps/api/scripts");
  mkdirSync(dossier, { recursive: true });
  copierSiAutre(join(SCRIPTS_ICI, basename(jeu.moduleRegistre)), join(dossier, basename(jeu.moduleRegistre)));
  const brut = resolve(sortie + ".jours");
  compilerEtLancer(depot, basename(jeu.moduleRegistre, ".ts"), ["--du", du, "--au", au, "--sortie", brut]);
  const { jours } = JSON.parse(readFileSync(brut, "utf8"));
  // Seuls les jours protégés entrent au registre (lot R11) : un jour sans résultat prend la version du code déployé.
  const gardes = Object.entries(jours).filter(([d]) => !proteges || estProtege(proteges, d)).map(([d, [g, sim]]) => [d, `${g}/${sim}`]);
  writeFileSync(resolve(sortie), JSON.stringify(registreDesJours(Object.fromEntries(gardes), au), null, 1) + "\n");
}

/** Les empreintes des jours de `du` à `au` d'un jeu pour le code de `depot` (module de jeu et pilote copiés dans `depot`, compilés là), ajoutées à `sortie` ; `jours` : le dossier de ses fichiers par jour. */
export function empreintesDuJeu(depot, jeu, { du, au, sortie, jours }) {
  depot = resolve(depot);
  const dossier = join(depot, "apps/api/scripts");
  mkdirSync(dossier, { recursive: true });
  const module_ = basename(jeu.moduleEmpreinte, ".ts");
  for (const f of ["empreintes.ts", "empreintes-jours.ts", `${module_}.ts`]) copierSiAutre(join(SCRIPTS_ICI, f), join(dossier, f));
  writeFileSync(join(dossier, `empreintes-entree-${jeu.id}.ts`), `import { empreinteJour } from "./${module_}";\nimport { executer } from "./empreintes-jours";\n\nexecuter(empreinteJour, ${JSON.stringify(jeu.id)});\n`);
  compilerEtLancer(depot, `empreintes-entree-${jeu.id}`, ["--du", du, "--au", au, "--sortie", resolve(sortie), ...(jours ? ["--jours", resolve(jours)] : [])]);
}

const RACINE_DES_OUTILS = fileURLToPath(new URL("../", import.meta.url));

/** Le dossier d'un paquet de l'espace de travail (`@cdj/jump` → `apps/jump`) dans `depot`, ou `null`. */
function dossierDuPaquet(depot, nom) {
  for (const sous of ["apps", "packages"]) {
    const base = join(depot, sous);
    if (!existsSync(base)) continue;
    for (const d of readdirSync(base)) {
      try {
        if (JSON.parse(readFileSync(join(base, d, "package.json"), "utf8")).name === nom) return join(sous, d);
      } catch {
        /* pas un paquet */
      }
    }
  }
  return null;
}

/**
 * **L'outil de figeage est celui d'AUJOURD'HUI, pas celui du code en production** (lot 33) : le code en production peut avoir un outil qui se trompe (celui du 06/11/2026 ne déclarait pas les niveaux déjà figés).
 * Le fichier d'entrée du script npm de la fiche (`figer.script` de `figer.paquet` : `esbuild tools/freeze-days.ts …`) est copié des outils dans le dépôt du code en production, qui le compile avec ses propres
 * paquets (comme les modules d'empreintes). Rend le chemin copié (relatif au dépôt), ou `null` si le script n'a pas de fichier d'entrée connu.
 */
export function installerOutilDeFigeage(jeu, prod, outils = RACINE_DES_OUTILS) {
  const dir = dossierDuPaquet(outils, jeu.figer.paquet);
  if (!dir) return null;
  const script = JSON.parse(readFileSync(join(outils, dir, "package.json"), "utf8")).scripts?.[jeu.figer.script] ?? "";
  const entree = /esbuild\s+(\S+\.ts)/.exec(script)?.[1];
  if (!entree || !existsSync(join(outils, dir, entree))) return null;
  const dirProd = dossierDuPaquet(prod, jeu.figer.paquet);
  if (!dirProd) return null;
  mkdirSync(dirname(join(prod, dirProd, entree)), { recursive: true });
  copierSiAutre(join(outils, dir, entree), join(prod, dirProd, entree));
  return join(dirProd, entree);
}

/** Le calendrier des bascules du générateur d'un jeu (`bascules.json` à côté de son fichier de versions) dans `depot` : son contenu, ou `null`. */
export function calendrierDesBascules(jeu, depot) {
  const fichier = jeu.versions?.generateur?.split(":")[0];
  if (!fichier) return null;
  const f = join(depot, dirname(fichier), "bascules.json");
  return existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : null;
}

/** La version du générateur d'un jeu dans `depot` (`versions.generateur` de sa fiche : « fichier:CONSTANTE »), ou `null`. */
export function generateurDuDepot(jeu, depot) {
  const [fichier, nom] = (jeu.versions?.generateur ?? "").split(":");
  if (!fichier || !existsSync(join(depot, fichier))) return null;
  const m = new RegExp(`export const ${nom}\\s*=\\s*(\\d+)`).exec(readFileSync(join(depot, fichier), "utf8"));
  return m ? Number(m[1]) : null;
}

/**
 * **Le garde-fou des jours, jeu par jeu** (lots R6, R11 et R16 ; lot K4b : lu dans les fiches). Pour chaque jeu de la chaîne :
 *  - **à registre** (Track) : ce que le code en production sert de la veille du lancement à la veille de la bascule s'ajoute au registre du dépôt visé ; un jour qui diffère arrête ;
 *  - **à fichiers, forme `jusqu-a-la-veille`** (Jump) : les jours que la production sert sont remis, le script `figer` écrit tous les fichiers jusqu'à la veille avec le code en production, les jours sans
 *    résultat sont retirés (le nouveau code les régénère), le reste est superposé au dépôt visé (un fichier différent arrête) ;
 *  - **à fichiers, forme `jours-proteges`** (Tower) : les jours protégés qui n'ont pas de fichier sont figés avec le code en production puis posés dans le dépôt visé ; s'il en manque un, arrêt.
 * Écrit l'artefact `jours` dans `sortie` : `proteges.json` et, pour chaque jeu, `<id>/` (son registre, ou `jours/*.json`).
 */
export function figerJeux({ prod, cible, proteges, veille, reference, jusqua, sortie, temp, resume, bascule, instant }) {
  prod = resolve(prod);
  cible = resolve(cible);
  sortie = resolve(sortie);
  temp = resolve(temp ?? tmpdir());
  const protege = JSON.parse(readFileSync(proteges, "utf8"));
  mkdirSync(sortie, { recursive: true });
  copyFileSync(proteges, join(sortie, "proteges.json"));
  for (const jeu of CHAINE) {
    const sortieJeu = join(sortie, jeu.id);
    mkdirSync(sortieJeu, { recursive: true });
    if (jeu.mode === "registre") {
      // Lot R11 : le registre des jours. Ce que la production sert pour chaque jour jusqu'à la veille de la bascule s'ajoute à celui du dépôt ; un jour qui diffère (ou un jour du dépôt au-delà de la veille)
      // arrête la mise en production. La construction (cible) l'a ensuite : ses empreintes sont celles de la production.
      joursServis(jeu, reference, join(prod, jeu.registre), jusqua);
      const debut = JSON.parse(readFileSync(join(cible, jeu.registre), "utf8")).plages[0].du;
      const donne = join(temp, "registre", `${jeu.id}.json`);
      mkdirSync(dirname(donne), { recursive: true });
      registreDuDepot(jeu, prod, debut, veille, protege, donne);
      const { fusion, conserves, ajoutes, conflits } = fusionnerRegistre(JSON.parse(readFileSync(join(cible, jeu.registre), "utf8")), JSON.parse(readFileSync(donne, "utf8")));
      ajouterAuResume(resume, resumeRegistre({ conserves, ajoutes, conflits, fusion }));
      if (conflits.length) throw new Error(`un jour du registre de ${jeu.nom} ne s'accorde pas avec ce que la production sert : la liste est dans le résumé du run`);
      writeFileSync(join(cible, jeu.registre), JSON.stringify(fusion, null, 1) + "\n");
      copyFileSync(join(cible, jeu.registre), join(sortieJeu, basename(jeu.registre)));
    } else if (jeu.figer.forme === "jusqu-a-la-veille") {
      // Lot 33 (incident du 06/11/2026) : un jour servi ne change jamais. Chaque jour non figé, du dernier jour figé à DEMAIN, est figé avec le code en production (l'outil d'aujourd'hui, installé dans
      // son dépôt) — les jours sans résultat aussi : un jour que personne n'a encore joué a peut-être été ouvert, et demain doit être celui que le code en production sert. Chaque fichier écrit est comparé à
      // ce que ce code sert SANS lui ; la mise en production s'arrête s'il reste un jour déjà servi sans fichier, ou si le calendrier des bascules du générateur est refusé.
      mkdirSync(join(sortieJeu, "jours"), { recursive: true });
      const dossierProd = join(prod, jeu.dossier);
      const dossierCible = join(cible, jeu.dossier);
      joursServis(jeu, reference, dossierProd, jusqua);
      const aujourdhui = jourDeParis(instant ?? Date.now());
      const demain = ajouterJours(aujourdhui, 1);
      const verdict = verifierBascules({
        avant: calendrierDesBascules(jeu, prod),
        apres: calendrierDesBascules(jeu, cible),
        generateurAvant: generateurDuDepot(jeu, prod),
        generateurApres: generateurDuDepot(jeu, cible),
        bascule: bascule ?? ajouterJours(aujourdhui, 1),
      });
      const ligneBascule = verdict.nouvelles.length ? `bascule du générateur de ${jeu.nom} : ${verdict.nouvelles.map((b) => `g${b.generateur} à partir du ${b.depuis}`).join(", ")}` : `aucune bascule du générateur de ${jeu.nom} dans ce déploiement`;
      ajouterAuResume(resume, `- ${ligneBascule}\n`);
      if (verdict.problemes.length) throw new Error(`calendrier des bascules du générateur de ${jeu.nom} refusé : ${verdict.problemes.join(" ; ")}`);
      const dernierJour = dernierJourAFiger({ veille, demain, nouvelles: verdict.nouvelles });
      const avantFigeage = new Set(datesDuDossier(dossierProd));
      const copieAvant = join(temp, `${jeu.id}-image-avant`);
      rmSync(copieAvant, { recursive: true, force: true });
      mkdirSync(copieAvant, { recursive: true });
      if (existsSync(dossierProd)) cpSync(dossierProd, copieAvant, { recursive: true });
      const outil = installerOutilDeFigeage(jeu, prod);
      if (outil) console.log(`outil de figeage d'aujourd'hui installé dans le code en production : ${outil}`);
      execFileSync("npm", ["run", jeu.figer.script, "-w", jeu.figer.paquet, "--", dernierJour], { cwd: prod, stdio: "inherit" });
      const ecrits = datesDuDossier(dossierProd).filter((d) => !avantFigeage.has(d)).sort();
      // Chaque fichier écrit est ce que le code en production servait sans lui (empreintes de l'image d'avant, puis de l'image avec les fichiers).
      if (ecrits.length) {
        const sansFichier = join(temp, `${jeu.id}-empreintes-avant.json`);
        const avecFichier = join(temp, `${jeu.id}-empreintes-apres.json`);
        rmSync(sansFichier, { force: true });
        rmSync(avecFichier, { force: true });
        empreintesDuJeu(prod, jeu, { du: ecrits[0], au: ecrits.at(-1), sortie: sansFichier, jours: copieAvant });
        empreintesDuJeu(prod, jeu, { du: ecrits[0], au: ecrits.at(-1), sortie: avecFichier, jours: dossierProd });
        const lu = (f) => JSON.parse(readFileSync(f, "utf8"))[jeu.id] ?? {};
        const diffs = ecrits.filter((d) => lu(sansFichier)[d]?.id !== lu(avecFichier)[d]?.id || lu(sansFichier)[d]?.h !== lu(avecFichier)[d]?.h);
        if (diffs.length) throw new Error(`jour(s) de ${jeu.nom} dont le fichier figé n'est pas le niveau que le code en production sert sans lui : ${diffs.join(", ")} (un jour servi ne change jamais : corriger l'outil de figeage)`);
        console.log(`jours de ${jeu.nom} figés avec le code en production : ${ecrits.length} (${ecrits.join(", ")}), tous identiques à ce qu'il servait sans fichier`);
      } else console.log(`aucun jour de ${jeu.nom} à figer`);
      writeFileSync(join(sortieJeu, "nouveaux.json"), JSON.stringify({ format: 1, jeu: jeu.id, dates: ecrits }, null, 1) + "\n");
      // Les jours figés s'accordent-ils avec le commit déployé ? Superposés au dépôt visé : c'est ce que le serveur et le site auront, et ce que ses empreintes liront.
      const { add, conflicts } = frozenOverlay(read(dossierProd), read(dossierCible));
      if (conflicts.length) throw new Error(`jour(s) figé(s) de ${jeu.nom} différent(s) entre le code en production et le commit déployé : ${conflicts.join(", ")} (un jour figé ne change jamais : voir docs/plateforme/domaine.md)`);
      mkdirSync(dossierCible, { recursive: true });
      for (const f of add) copyFileSync(join(dossierProd, f), join(dossierCible, f));
      const t = add.length ? `jours figés de ${jeu.nom} ajoutés : ${add.join(" ")}` : `aucun jour figé de ${jeu.nom} à ajouter`;
      console.log(t);
      if (resume) appendFileSync(resume, t + "\n");
      // Plus aucun jour déjà servi sans fichier figé : de la première date figée à demain, la construction a tous ses fichiers.
      const presents = datesDuDossier(dossierCible);
      const manquants = presents.length ? joursSansFichier({ du: presents.slice().sort()[0], au: dernierJour, fichiers: presents }) : [];
      if (manquants.length) throw new Error(`jour(s) de ${jeu.nom} déjà servi(s) ou à servir sans fichier figé : ${manquants.join(", ")} — la mise en production ne part pas (un jour servi ne change jamais ; il serait régénéré par le nouveau code)`);
      if (resume) appendFileSync(resume, `- ${jeu.nom} : tous les jours jusqu'au ${dernierJour} ont leur fichier figé (${ecrits.length} figé(s) par cette mise en production)\n`);
      for (const f of datesDuDossier(dossierProd)) copyFileSync(join(dossierProd, `${f}.json`), join(sortieJeu, "jours", `${f}.json`));
    } else {
      // Lot R16 : les jours protégés sans fichier, figés avec le code en production.
      mkdirSync(join(sortieJeu, "jours"), { recursive: true });
      const dossierCible = join(cible, jeu.dossier);
      // Ce que la production sert de ce jeu n'est pas seulement le commit de son étiquette : les jours que « Mettre en production » a refaits ou figés depuis y sont versés (`Jours figés de la mise en production`).
      joursServis(jeu, reference, join(prod, jeu.dossier), jusqua);
      const fichiers = Object.fromEntries(datesDuDossier(dossierCible).map((d) => [d, true]));
      const plan = joursAFiger({ proteges: protege, fichiers, absentDeProd: !existsSync(join(prod, "packages", jeu.sim)) });
      const figes = join(temp, `${jeu.id}-figes`);
      mkdirSync(join(figes, "jours"), { recursive: true });
      writeFileSync(join(figes, "plan.json"), JSON.stringify(plan, null, 1) + "\n");
      ajouterAuResume(resume, resumeFiges(jeu.nom, plan));
      for (const [du, au] of plan.plages) execFileSync("npm", ["run", jeu.figer.script, "-w", jeu.figer.paquet, "--", "--du", du, "--au", au, `--dossier=${join(figes, "jours")}`], { cwd: prod, stdio: "inherit" });
      const { ecrire, manquants, conflits } = figesAPoser(plan, read(join(figes, "jours")), read(dossierCible));
      if (manquants.length || conflits.length) throw new Error(`jours de ${jeu.nom} protégés sans fichier figé : ${manquants.join(", ") || "aucun"} ; figés dans un autre contenu que celui du dépôt : ${conflits.join(", ") || "aucun"} (un jour servi ne change jamais : corriger puis relancer)`);
      mkdirSync(dossierCible, { recursive: true });
      for (const f of ecrire) writeFileSync(join(dossierCible, f), readFileSync(join(figes, "jours", f)));
      console.log(ecrire.length ? `jours de ${jeu.nom} figés avec le code en production : ${ecrire.length} (${ecrire.map((f) => f.slice(0, 10)).join(", ")})` : `aucun jour de ${jeu.nom} à figer`);
      // Sans préparation, l'artefact est ce que le dépôt visé a maintenant ; avec, `preparer-jeux` le refait.
      for (const d of datesDuDossier(dossierCible)) copyFileSync(join(dossierCible, `${d}.json`), join(sortieJeu, "jours", `${d}.json`));
    }
  }
}

/**
 * **Les jours que préparent certains jeux** (le bot de Tower : `preparer` de la fiche), avec le code déployé : le plan (règle R11), le nettoyage des fichiers d'une autre version, la préparation par plages,
 * le garde-fou de chaque fichier, l'artefact (`<id>/plan.json` et `<id>/jours/*.json`) et le résumé. Écrit pour le haut du résumé du bouton `preparation` : `{ <id>: ligne }`.
 */
export function preparerJeux({ cible, proteges, veille, bascule, sortie, resume, githubSortie }) {
  cible = resolve(cible);
  sortie = resolve(sortie);
  const protege = JSON.parse(readFileSync(proteges, "utf8"));
  const lignes = {};
  for (const jeu of CHAINE.filter((j) => j.preparer)) {
    const dossier = join(cible, jeu.dossier);
    const fichiers = {};
    for (const d of datesDuDossier(dossier)) {
      try {
        const j = JSON.parse(readFileSync(join(dossier, `${d}.json`), "utf8"));
        fichiers[d] = { g: j.g, sim: j.sim };
      } catch {
        fichiers[d] = { g: null, sim: null }; // illisible : à refaire s'il n'est pas protégé
      }
    }
    const texts = {};
    for (const v of [jeu.versions.sim, jeu.versions.generateur]) {
      const f = v.split(":")[0];
      texts[f] = existsSync(join(cible, f)) ? readFileSync(join(cible, f), "utf8") : "";
    }
    const versions = versionsDuJeu(texts, jeu.versions);
    if (versions.sim === null || versions.g === null) throw new Error(`le commit déployé n'a pas les versions de ${jeu.nom} (${jeu.versions.sim}, ${jeu.versions.generateur})`);
    const plan = planPreparation({ veille, bascule, joursApres: jeu.preparer.joursApresBascule, proteges: protege, fichiers, versions });
    const sortieJeu = join(sortie, jeu.id);
    mkdirSync(join(sortieJeu, "jours"), { recursive: true });
    writeFileSync(join(sortieJeu, "plan.json"), JSON.stringify(plan, null, 1) + "\n");
    ajouterAuResume(resume, resumePreparation(jeu.nom, plan, jeu.preparer.joursApresBascule));
    // L'outil de préparation n'écrase jamais un fichier d'une autre version : ceux que le plan refait sont retirés avant.
    for (const d of plan.aSupprimer) rmSync(join(dossier, `${d}.json`), { force: true });
    console.log(plan.aSupprimer.length ? `fichiers de ${jeu.nom} d'une autre version retirés : ${plan.aSupprimer.join(" ")}` : `aucun fichier de ${jeu.nom} à retirer`);
    mkdirSync(dossier, { recursive: true });
    const debut = Date.now();
    for (const [du, au] of plan.plages) execFileSync("npm", ["run", jeu.preparer.script, "-w", jeu.preparer.paquet, "--", "--du", du, "--au", au, `--dossier=${dossier}`], { cwd: cible, stdio: "inherit" });
    const secondes = (Date.now() - debut) / 1000;
    // Chaque fichier (ceux de la fenêtre comme ceux du dépôt) se relit, se régénère à l'identique et sa preuve rejouée redonne son Diamant (garde-fou du lot T3).
    execFileSync("npx", ["vitest", "run", "--project", "sqlite", jeu.preparer.garde], { cwd: cible, stdio: "inherit" });
    for (const d of datesDuDossier(dossier)) copyFileSync(join(dossier, `${d}.json`), join(sortieJeu, "jours", `${d}.json`));
    if (resume) appendFileSync(resume, resumePreparation(jeu.nom, plan, jeu.preparer.joursApresBascule, { jours: plan.aPreparer.length, secondes, fils: availableParallelism() }));
    lignes[jeu.id] = lignePreparation(plan);
  }
  if (githubSortie) appendFileSync(githubSortie, `preparation=${JSON.stringify(lignes)}\n`);
}

/** Les chemins que le versement des jours figés ajoute au dépôt : pour chaque jeu ses jours (dossier ou registre) et ce que refait son `apresPose`, plus les empreintes des jours passés. */
export const cheminsDuVersement = () => [...CHAINE.flatMap((j) => [j.dossier ?? j.registre, ...(j.apresPose?.sorties ?? [])]), "apps/api/test/jours-passes.json"];

/** Refait, pour chaque jeu qui le demande (`apresPose`), ce qui dépend de ses jours dès qu'un de ses fichiers a changé dans le dépôt courant (la démonstration de Jump, ≈ 1 min). */
export function apresPose() {
  let installe = false;
  for (const jeu of CHAINE) {
    if (!jeu.apresPose || !jeu.dossier || !git("status", "--porcelain", "--", jeu.dossier).trim()) continue;
    if (!installe) {
      execFileSync("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], { stdio: "ignore" });
      installe = true;
    }
    execFileSync("npm", ["run", jeu.apresPose.script, "-w", jeu.apresPose.paquet], { stdio: "ignore" });
    console.log(`${jeu.nom} : ${jeu.apresPose.sorties.join(", ")} refait (${jeu.apresPose.script})`);
  }
}

/**
 * Pose, dans le dépôt courant, ce que « Mettre en production » a produit pour chaque jeu (`dossier` : l'artefact `jours`, un dossier par jeu — son registre, ou `jours/*.json` et un `plan.json` éventuel).
 * Un registre est fusionné (un jour qui diffère arrête), des jours sont posés (un fichier différent arrête, sauf ceux que le plan refait). Un jeu absent de l'artefact est sauté.
 */
export function poserJours(dossier, { resume } = {}) {
  const dit = (texte) => {
    console.log(texte);
    if (resume) appendFileSync(resume, texte + "\n");
  };
  for (const jeu of CHAINE) {
    const d = join(resolve(dossier), jeu.id);
    if (!existsSync(d)) continue;
    if (jeu.mode === "registre") {
      const { fusion, conserves, ajoutes, conflits } = fusionnerRegistre(JSON.parse(readFileSync(jeu.registre, "utf8")), JSON.parse(readFileSync(join(d, basename(jeu.registre)), "utf8")));
      ajouterAuResume(resume, resumeRegistre({ conserves, ajoutes, conflits, fusion }));
      if (conflits.length) throw new Error(`un jour du registre de ${jeu.nom} ne s'accorde pas avec ce que la production sert`);
      writeFileSync(jeu.registre, JSON.stringify(fusion, null, 1) + "\n");
      continue;
    }
    const plan = existsSync(join(d, "plan.json")) ? JSON.parse(readFileSync(join(d, "plan.json"), "utf8")) : undefined;
    const artefact = read(join(d, "jours"));
    const { ajouts, remplaces, conflits } = joursAPoser(artefact, read(jeu.dossier), plan);
    if (conflits.length) throw new Error(`jour(s) de ${jeu.nom} différent(s) entre la préparation et le commit déployé : ${conflits.join(", ")} (un jour figé ne change jamais : voir docs/plateforme/domaine.md)`);
    mkdirSync(jeu.dossier, { recursive: true });
    for (const f of [...ajouts, ...remplaces]) writeFileSync(join(jeu.dossier, f), artefact[f]);
    dit(ajouts.length || remplaces.length ? `jours de ${jeu.nom} posés : ${ajouts.length} ajouté(s), ${remplaces.length} refait(s)` : `aucun jour de ${jeu.nom} à poser`);
  }
}

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
      const changements = changesFromLog(log);
      const text = changesSummary({ from: a || null, to: git("rev-parse", b).trim(), repo: process.env.GITHUB_REPOSITORY, ...changements });
      // Lot R12 : l'inventaire court du haut du résumé du bouton (nombre de PR et leurs numéros).
      if (opt("--sortie")) appendFileSync(opt("--sortie"), `nb_pr=${changements.prs.length}\nprs=${changements.prs.map((p) => `#${p.number}`).join(" ")}\nnb_commits=${changements.commits.length}\n`);
      const out = opt("--resume");
      if (out) appendFileSync(out, text);
      process.stdout.write(text);
    } else if (cmd === "bascule") {
      // L'instant du déploiement : l'heure simulée (répétition) ou maintenant. Le jour de bascule est calculé ICI, au moment du clic.
      const premier = JSON.parse(readFileSync(new URL("../config/lancement.json", import.meta.url), "utf8")).premierJour;
      const simulee = opt("--simulee");
      const ms = simulee ? instantDeParis(simulee) : opt("--maintenant") ? Date.parse(opt("--maintenant")) : Date.now();
      const plan = planDesJours(ms, premier);
      const lignes = [`bascule=${plan.bascule}`, `veille=${plan.veille}`, `premier=${plan.premier}`, `dernier_regenere=${plan.dernierRegenere}`, `instant=${plan.instant}`, `jour_de_paris=${plan.jourDeParis}`];
      if (opt("--sortie")) appendFileSync(opt("--sortie"), lignes.join("\n") + "\n");
      console.log(lignes.join("\n"));
    } else if (cmd === "proteges") {
      // Les jours à partir du lancement (`--premier`) jusqu'à la veille de la bascule : déjà figés (registre des jeux à registre, fichiers des jeux dont les fichiers SONT des jours figés — forme
      // `jusqu-a-la-veille` de `figer` — du dépôt visé) ou avec un résultat en production. Les fichiers préparés d'un jeu (forme `jours-proteges`) ne sont pas des jours figés : ils sont refaits.
      const cible = resolve(opt("--cible"));
      const figes = new Set();
      const datesFichiers = [];
      for (const jeu of CHAINE) {
        if (jeu.mode === "registre") {
          const f = join(cible, jeu.registre);
          if (existsSync(f)) for (const d of Object.keys(joursDuRegistre(JSON.parse(readFileSync(f, "utf8"))))) figes.add(d);
        } else if (jeu.figer?.forme === "jusqu-a-la-veille") {
          const dossier = join(cible, jeu.dossier);
          for (const f of existsSync(dossier) ? readdirSync(dossier) : []) if (/^\d{4}-\d{2}-\d{2}\.json$/.test(f)) { figes.add(f.slice(0, 10)); datesFichiers.push(f.slice(0, 10)); }
        }
      }
      const premier = opt("--premier");
      const veille = opt("--veille");
      const alire = [];
      for (let d = premier; d <= veille; d = ajouterJours(d, 1)) if (!figes.has(d)) alire.push(d);
      const resultats = await lireResultats(opt("--origine"), alire);
      const proteges = joursProteges({ premier, veille, figes: [...figes], resultats });
      // Le premier jour comparé : le plus ancien fichier figé (les jours d'avant le lancement « restent tels quels »).
      proteges.debut = datesFichiers.filter((d) => d < premier).sort()[0] ?? premier;
      proteges.origine = opt("--origine");
      writeFileSync(resolve(opt("--sortie")), JSON.stringify(proteges, null, 1) + "\n");
      const text = resumeProteges(proteges, premier, veille);
      if (opt("--resume")) appendFileSync(opt("--resume"), text);
      process.stdout.write(text);
    } else if (cmd === "proteges-verifier") {
      // Après la validation de Nathan (qui peut durer), un jour que la mise en production régénère ne doit pas avoir reçu de résultat entre-temps : ce serait un jour joué qui change.
      const proteges = JSON.parse(readFileSync(a, "utf8"));
      const regeneres = joursRegeneres(proteges, proteges.premier, proteges.veille);
      const maintenant = await lireResultats(opt("--origine") ?? proteges.origine, regeneres);
      const nouveaux = Object.entries(maintenant).filter(([, n]) => n > 0).map(([d, n]) => `${d} (${n} classé(s))`);
      if (nouveaux.length) throw new Error(`un jour que cette mise en production régénère a reçu des résultats depuis la vérification : ${nouveaux.join(", ")}. Relancer « Mettre en production » (les jours protégés se relisent au clic).`);
      console.log(regeneres.length ? `les ${regeneres.length} jour(s) régénérés (${regeneres.join(", ")}) n'ont toujours aucun résultat` : "aucun jour sans résultat à régénérer avant la bascule");
    } else if (cmd === "jeux") {
      // Les jeux de la chaîne (identifiants, dans l'ordre des fiches), éventuellement ceux d'un mode : `--mode registre|fichier-par-jour`.
      console.log(CHAINE.filter((j) => !opt("--mode") || j.mode === opt("--mode")).map((j) => j.id).join(" "));
    } else if (cmd === "jours-servis") {
      // La production sert les jours figés de son IMAGE : le commit de son étiquette, plus ceux que « Mettre en production » y a ajoutés (artefact `jours`) et qui n'entrent dans le dépôt que par la PR
      // « robot » qui suit (commit « Jours figés de la mise en production … »). Sans eux, le code en production régénérerait ces jours avec son code d'aujourd'hui, autre que celui qui les a figés (le code
      // d'avant) : un faux conflit. On les relit donc dans l'historique. `--jeu` : un jeu de la chaîne ; `a` : la référence du code en production ; `b` : où remettre (le dossier de ses jours, ou le fichier de son registre).
      joursServis(jeuDeLaChaine(opt("--jeu")), a, b, opt("--jusqua") ?? "origin/main");
    } else if (cmd === "figer-jeux") {
      // Lot K4b : le garde-fou des jours, pour chaque jeu de la chaîne (lots R6, R11, R16). Se lance dans le dépôt des outils (tout l'historique : `jours-servis` le lit).
      figerJeux({ prod: opt("--prod"), cible: opt("--cible"), proteges: opt("--proteges"), veille: opt("--veille"), reference: opt("--reference"), jusqua: opt("--jusqua") ?? "origin/main", sortie: opt("--sortie"), temp: opt("--temp"), resume: opt("--resume"), bascule: opt("--bascule"), instant: opt("--instant") ? Number(opt("--instant")) : undefined });
    } else if (cmd === "servi-verifier") {
      // Lot 33 : les jours qu'on vient de figer avec le code en production sont comparés, en lecture seule, à ce que le serveur de production sert EN CE MOMENT (jusqu'à aujourd'hui compris : demain n'est pas servi).
      // `--sortie` : l'artefact `jours` de `figer-jeux` (`<jeu>/nouveaux.json`, `<jeu>/jours/AAAA-MM-JJ.json`). Une différence arrête : le fichier n'est pas le niveau que les joueurs ont vu.
      const aujourdhui = jourDeParis(opt("--instant") ? Number(opt("--instant")) : Date.now());
      const lignes = [];
      const diffs = [];
      for (const jeu of CHAINE.filter((j) => j.figer?.forme === "jusqu-a-la-veille")) {
        const f = join(resolve(opt("--sortie")), jeu.id, "nouveaux.json");
        if (!existsSync(f)) continue;
        const dates = JSON.parse(readFileSync(f, "utf8")).dates.filter((d) => d <= aujourdhui);
        const attendus = Object.fromEntries(dates.map((d) => {
          const fichier = JSON.parse(readFileSync(join(resolve(opt("--sortie")), jeu.id, "jours", `${d}.json`), "utf8"));
          return [d, { id: fichier.id, hash: fichier.hash }];
        }));
        const servis = await lireNiveauxServis(opt("--origine"), dates, { route: `/api/${jeu.id}/day` });
        const d = comparerAuServi(attendus, servis);
        diffs.push(...d.map((x) => `${jeu.nom} ${x}`));
        lignes.push(`- ${jeu.nom} : ${dates.length} jour(s) figé(s) à nouveau, comparés au niveau que ${opt("--origine")} sert : ${d.length ? `⛔ ${d.length} différence(s)` : "✅ identiques"}`);
      }
      const text = (lignes.length ? lignes.join("\n") : "- aucun jour figé à comparer au niveau servi") + "\n" + diffs.map((x) => `  - ${x}`).join("\n") + (diffs.length ? "\n" : "");
      if (opt("--resume")) appendFileSync(opt("--resume"), text);
      process.stdout.write(text);
      if (diffs.length) throw new Error("un jour figé n'est pas le niveau que la production sert en ce moment : la mise en production ne part pas. Si la production sert encore le niveau de l'incident du 06/11/2026 (retour arrière pas encore fait), faire d'abord le retour arrière (workflow « Retour arrière »), puis relancer le bouton.");
    } else if (cmd === "preparer-jeux") {
      // Lot K4b : les jours que préparent certains jeux (le bot de Tower), avec le code DÉPLOYÉ (`--cible`), après la comparaison des empreintes.
      preparerJeux({ cible: opt("--cible"), proteges: opt("--proteges"), veille: opt("--veille"), bascule: opt("--bascule"), sortie: opt("--sortie"), resume: opt("--resume"), githubSortie: opt("--github-sortie") });
    } else if (cmd === "registres") {
      // Les fichiers de registre des jeux à registre (un par jeu : `jours.registre` de sa fiche).
      console.log(CHAINE.filter((j) => j.mode === "registre").map((j) => j.registre).join(" "));
    } else if (cmd === "chemins-du-versement") {
      console.log(cheminsDuVersement().join(" "));
    } else if (cmd === "apres-pose") {
      apresPose();
    } else if (cmd === "poser-jours") {
      // Lot K4b : pose, dans le dépôt courant (le commit déployé, l'image, le site ou `main`), ce que « Mettre en production » a produit pour chaque jeu (artefact `jours`, dossier `a`).
      poserJours(a, { resume: opt("--resume") });
    } else if (cmd === "empreintes") {
      // Les empreintes des jours de chaque jeu pour le code du dépôt `a`. Les modules de jeu (`jours.fabrication.empreinte`) et le pilote sont ceux de CE dépôt, copiés dans le dépôt visé (le code en
      // production ne les a pas) : ils ne dépendent que des paquets @cdj/*. Un jeu que ce code ne contient pas n'a rien servi : aucune empreinte, rien à conserver pour lui.
      const depot = resolve(a);
      for (const jeu of CHAINE) {
        if (!existsSync(join(depot, "packages", jeu.sim))) {
          console.log(`${jeu.nom} : absent de ce code, aucune empreinte (rien à conserver pour lui)`);
          continue;
        }
        empreintesDuJeu(depot, jeu, { du: opt("--du"), au: opt("--au"), sortie: opt("--sortie"), jours: jeu.dossier ? join(depot, jeu.dossier) : null });
      }
    } else if (cmd === "registre") {
      // Le registre des jours d'un jeu à registre (`--jeu`) tel que le code du dépôt `a` les sert (`jours.fabrication.registre`, copié dans ce dépôt : le code en production ne l'a pas).
      registreDuDepot(jeuDeLaChaine(opt("--jeu")), a, opt("--du"), opt("--au"), opt("--proteges") ? JSON.parse(readFileSync(opt("--proteges"), "utf8")) : null, opt("--sortie"));
    } else if (cmd === "registre-fusion") {
      const { fusion, conserves, ajoutes, conflits } = fusionnerRegistre(JSON.parse(readFileSync(a, "utf8")), JSON.parse(readFileSync(b, "utf8")));
      const text = resumeRegistre({ conserves, ajoutes, conflits, fusion });
      if (opt("--resume")) appendFileSync(opt("--resume"), text);
      process.stdout.write(text);
      if (conflits.length) process.exit(1);
      writeFileSync(a, JSON.stringify(fusion, null, 1) + "\n");
    } else if (cmd === "bascule-valide") {
      const ms = opt("--maintenant") ? Date.parse(opt("--maintenant")) : Date.now();
      if (basculeCommencee(a, ms)) throw new Error(`le jour de bascule (${a}) a déjà commencé à Paris (nous sommes le ${jourDeParis(ms)}) : la mise en production aurait changé un jour que les joueurs ont ouvert. Relancer « Mettre en production » (le jour de bascule se recalcule au clic).`);
      console.log(`le jour de bascule (${a}) n'a pas encore commencé (aujourd'hui : ${jourDeParis(ms)})`);
    } else if (cmd === "comparer") {
      const prod = JSON.parse(readFileSync(a, "utf8"));
      const cible = JSON.parse(readFileSync(b, "utf8"));
      const bascule = rest[0];
      const premier = JSON.parse(readFileSync(new URL("../config/lancement.json", import.meta.url), "utf8")).premierJour;
      const proteges = opt("--proteges") ? JSON.parse(readFileSync(opt("--proteges"), "utf8")) : null;
      const comparaison = comparerEmpreintes(prod, cible, bascule, premier, proteges);
      const plan = planDesJours(opt("--instant") ? Number(opt("--instant")) : Date.now(), premier);
      const text = resumeBascule({ plan: { ...plan, bascule, veille: ajouterJours(bascule, -1) }, comparaison, simulee: all.includes("--simulee") });
      if (opt("--resume")) appendFileSync(opt("--resume"), text);
      // Lot R12 : une ligne par jeu pour le haut du résumé de « Mettre en production » (`jours` : { <jeu>: ligne }).
      if (opt("--sortie")) appendFileSync(opt("--sortie"), `jours=${JSON.stringify(Object.fromEntries(Object.entries(comparaison.jeux).map(([jeu, r]) => [jeu, ligneJours(r)])))}\n`);
      process.stdout.write(text);
      if (!comparaison.ok) process.exit(1);
    } else if (cmd === "empreintes-fusion") {
      const { fusion, ajoutes, conflits } = fusionnerEmpreintes(existsSync(a) ? JSON.parse(readFileSync(a, "utf8")) : {}, JSON.parse(readFileSync(b, "utf8")), opt("--jusqua"), opt("--proteges") ? JSON.parse(readFileSync(opt("--proteges"), "utf8")) : null);
      if (conflits.length) throw new Error(`jour(s) passé(s) dont l'empreinte change : ${conflits.join(", ")} (un jour passé ne change jamais)`);
      writeFileSync(a, JSON.stringify(fusion, null, 1) + "\n");
      console.log(ajoutes.length ? `empreintes ajoutées : ${ajoutes.length} (${ajoutes[0]} … ${ajoutes.at(-1)})` : "aucune empreinte à ajouter");
    } else if (cmd === "inventaire") {
      const lire = (ref) => {
        // Les fichiers de versions de chaque jeu (fiches), ceux des dates de bascule de Track, et les sources de l'API (migrations, tables, routes).
        const fichiers = git("ls-tree", "-r", "--name-only", ref, "--", "apps/api/src").split("\n").filter(Boolean);
        const voulus = [...VERSIONS_DES_JEUX.map((v) => v.fichier), "packages/sim/src/dailyId.ts", "packages/sim/src/medals.ts", ...fichiers];
        const texts = {};
        for (const f of new Set(voulus)) {
          try {
            texts[f] = git("show", `${ref}:${f}`);
          } catch {
            /* le fichier n'existait pas à cette date */
          }
        }
        return texts;
      };
      const avant = a ? lire(a) : {};
      const apres = lire(b);
      const range = a ? `${a}..${b}` : b;
      const brut = git("log", "--format=%H%x1f%P%x1f%s%x1f%b%x1e", range).split("\x1e").map((x) => x.trim()).filter(Boolean);
      const prs = [];
      for (const entree of brut) {
        const [sha, parents = "", sujet = "", corps = ""] = entree.split("\x1f");
        const m = /^Merge pull request #(\d+) from (\S+)/.exec(sujet) ?? (/\(#(\d+)\)\s*$/.exec(sujet) ? [null, /\(#(\d+)\)\s*$/.exec(sujet)[1], null] : null);
        if (!m || prs.some((p) => p.number === Number(m[1]))) continue;
        const fusion = parents.trim().split(/\s+/).length > 1;
        const titre = fusion ? (corps.split("\n").find((x) => x.trim()) ?? m[2]) : sujet.replace(/\s*\(#\d+\)\s*$/, "");
        const fichiers = (fusion ? git("diff", "--name-only", `${sha}^1`, sha) : git("show", "--name-only", "--format=", sha)).split("\n").filter(Boolean);
        prs.push({ number: Number(m[1]), titre, branche: m[2], lot: lotDe(titre, m[2]), zone: zoneDes(fichiers) });
      }
      const text = inventaire({
        de: a || null,
        a: git("rev-parse", b).trim(),
        prs,
        versionsAvant: versionsDe(avant),
        versionsApres: versionsDe(apres),
        baseAvant: baseDe(avant),
        baseApres: baseDe(apres),
        routesAvant: routesDe(avant),
        routesApres: routesDe(apres),
        repo: process.env.GITHUB_REPOSITORY,
      });
      if (opt("--resume")) appendFileSync(opt("--resume"), text);
      process.stdout.write(text);
    } else {
      void rest;
      console.error("usage : node scripts/mise-en-production.mjs etiquette | derniere | changements <de> <à> | jeux | registres | bascule | bascule-valide <jour> | comparer <prod> <cible> <bascule> | empreintes-fusion <fichier> <nouveau> | proteges | proteges-verifier <fichier> | jours-servis <réf> <cible> --jeu <id> | figer-jeux | servi-verifier | preparer-jeux | poser-jours <dossier> | empreintes <dépôt> | registre --jeu <id> <dépôt> | registre-fusion <dépôt> <servi> | inventaire <de> <à>");
      process.exit(2);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
