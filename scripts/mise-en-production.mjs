// « Mettre en production » (lot R4 de la plateforme) : ce que le workflow .github/workflows/production.yml calcule. Fonctions pures, testées
// (apps/portail/test/miseEnProduction.test.ts). Ligne de commande :
//   node scripts/mise-en-production.mjs etiquette [--maintenant <ISO>]              → `prod-AAAA-MM-JJ-HHMM` (heure de Paris)
//   node scripts/mise-en-production.mjs derniere [--avant <étiquette>]              → la dernière étiquette `prod-*` du dépôt (vide s'il n'y en a pas)
//   node scripts/mise-en-production.mjs changements <de> <à> [--resume <fichier>]   → PR et commits de <de> (exclu ; vide : tout) à <à>, en Markdown
//   node scripts/mise-en-production.mjs jours-figes <dossier figé> <dossier cible>  → copie les jours figés absents de la cible ; refuse un
//                                                                                     fichier différent (un jour figé ne change jamais)
// Lot R6 (le garde-fou des jours) :
//   node scripts/mise-en-production.mjs jours-servis <réf> <dossier> [--jusqua <réf>]  → remet dans <dossier> les jours figés que la production sert sans qu'ils soient dans le commit
//                                                                                     de <réf> : ceux des PR « Jours figés de la mise en production » fusionnées depuis
//   node scripts/mise-en-production.mjs bascule [--simulee "<heure>"] [--sortie <fichier>]   → le jour de bascule (le premier jour de Paris qui commence
//                                                                                     après le déploiement), calculé à l'instant du clic ou à l'heure simulée
//   node scripts/mise-en-production.mjs empreintes <dépôt> --du <jour> --au <jour> --niveaux <dossier> --sortie <fichier>
//                                                                                     → les empreintes des jours du code de <dépôt> (le script d'empreintes y est copié)
//   node scripts/mise-en-production.mjs bascule-valide <AAAA-MM-JJ>                  → refuse (code 1) si le jour de bascule a déjà commencé
//   node scripts/mise-en-production.mjs comparer <prod.json> <cible.json> <bascule> [--resume <fichier>]
//                                                                                     → compare les empreintes des jours ; la moindre différence AVANT la bascule arrête
//   node scripts/mise-en-production.mjs empreintes-fusion <existant.json> <nouveau.json> [--jusqua <jour>]  → ajoute les jours nouveaux, refuse un jour qui change
// Lot R11 (Track fige ses circuits comme Jump) :
//   node scripts/mise-en-production.mjs proteges --origine <url> --cible <dépôt> --premier <jour> --veille <jour> --sortie <fichier>  → les jours qui ne changent jamais : d'avant le lancement, déjà
//                                                                                     figés, ou avec au moins un résultat en production (lecture seule du classement du jour) ; les autres sont régénérés
//   node scripts/mise-en-production.mjs proteges-verifier <proteges.json> --origine <url>  → relit (lecture seule) les jours régénérés : aucun ne doit avoir reçu de résultat depuis
//   node scripts/mise-en-production.mjs jours-figes-filtrer <dossier de niveaux> --proteges <fichier>  → retire les niveaux figés de Jump des jours sans résultat
//   node scripts/mise-en-production.mjs registre <dépôt> --du <jour> --au <jour> --sortie <fichier> [--proteges <fichier>]  → le registre des jours de Track tel que le code de <dépôt> les sert (le script y est copié)
//   node scripts/mise-en-production.mjs registre-fusion <registre du dépôt> <registre de la production> [--resume <fichier>]  → ajoute les jours nouveaux au registre du dépôt (écrit en place),
//                                                                                     refuse un jour qui change ou un jour du dépôt au-delà de la veille de la bascule
//   node scripts/mise-en-production.mjs inventaire <de> <à> [--resume <fichier>]     → « Ce qui part » : PR, versions, migrations, routes
import { execFileSync } from "node:child_process";
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
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

/** Le plan d'une mise en production faite à l'instant `ms` : bascule, dernier jour conservé, jours régénérés, premier jour du lancement. */
export function planDesJours(ms, premierJour) {
  const bascule = jourDeBascule(ms);
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
    const p = prod[jeu] ?? {};
    const c = cible[jeu] ?? {};
    // Lot R11 : avec la liste des jours protégés, les jours d'avant le lancement comptent aussi (ils « restent tels quels »), et un jour sans aucun résultat n'est pas protégé.
    const dates = [...new Set([...Object.keys(p), ...Object.keys(c)])].filter((d) => proteges || d >= premier).sort();
    const r = { conserves: [], differences: [], regeneres: [], valides: 0, invalides: [], changes: [], sansResultat: [] };
    for (const date of dates) {
      if (date < bascule && (!proteges || estProtege(proteges, date))) {
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

const NOMS_JEUX = { track: "DailyTrack", jump: "DailyJump" };
const plage = (l) => (l.length ? `${l[0]} → ${l.at(-1)}` : "aucun");

/** Le résumé du run : jour de bascule, jours conservés (sans différence), jours régénérés et validés, et — s'il y en a — la liste des jours en cause. */
export function resumeBascule({ plan, comparaison, simulee = false }) {
  const l = [`### Jours : ce qui est conservé, ce qui est rechargé${simulee ? " — **répétition** (heure simulée)" : ""}`, ""];
  l.push(`- Déploiement : \`${plan.jourDeParis}\` (heure de Paris${simulee ? ", simulée" : ""}) → **jour de bascule : ${nomDuJour(plan.bascule)}** (le premier jour de Paris qui commence après le déploiement).`);
  l.push(`- Avant la bascule (${plan.premier} → ${plan.veille}) : **la carte de chaque jour protégé (d'avant le lancement, déjà figé ou avec un résultat) est exactement celle que la production sert** ; un jour sans aucun résultat et, à partir du ${plan.bascule}, tous les jours, ont le nouveau code.`, "");
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
  for (const jeu of ["track", "jump"]) {
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
  for (const date of jours) {
    for (let essai = 1; ; essai++) {
      let res;
      try {
        res = await fetchImpl(`${base}/api/portail/classement?date=${date}`, { method: "GET", headers: { Accept: "application/json" } });
      } catch (e) {
        if (essai >= essais) throw new Error(`lecture des résultats du ${date} impossible (${e instanceof Error ? e.message : e})`);
        await attendre(2000 * essai);
        continue;
      }
      if (res.status === 200) {
        const corps = await res.json();
        if (!Number.isInteger(corps?.classes)) throw new Error(`lecture des résultats du ${date} : réponse inattendue (pas de nombre de classés)`);
        resultats[date] = corps.classes;
        break;
      }
      if (res.status === 404 && (await res.json().catch(() => null))?.error === "unknown_day") {
        resultats[date] = 0;
        break;
      }
      if ((res.status === 429 || res.status >= 500) && essai < essais) {
        const apres = Number(res.headers?.get?.("Retry-After"));
        await attendre(res.status === 429 && Number.isFinite(apres) && apres > 0 ? apres * 1000 : 2000 * essai);
        continue;
      }
      throw new Error(`lecture des résultats du ${date} : le serveur répond ${res.status}`);
    }
  }
  return resultats;
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

// ——— L'inventaire : « Ce qui part » ————————————————————————————————————————————————————————————————————————————————————————

const VERSIONS = [
  { nom: "JUMP_SIM_VERSION", fichier: "packages/jump-sim/src/constants.ts", jeu: "Jump" },
  { nom: "JUMP_GENERATOR_VERSION", fichier: "packages/jump-sim/src/constants.ts", jeu: "Jump" },
  { nom: "SIM_VERSION", fichier: "packages/sim/src/constants.ts", jeu: "Track" },
  { nom: "GENERATOR_VERSION", fichier: "packages/sim/src/constants.ts", jeu: "Track" },
];

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

/** Les fichiers partagés qu'un lot de jeu a le droit de toucher (CLAUDE.md racine, « Lots en parallèle ») : ils ne font pas d'une PR de jeu une PR de la plateforme. */
const TOLERES_POUR_UN_JEU = /^(docs\/plateforme\/(budgets|traductions)\.md|package-lock\.json|e2e\/zones\.json|packages\/ui\/(src\/catalogue[^/]*|test\/applications)\.ts|apps\/(web|jump)\/e2e\/durees\.json|apps\/api\/test\/[^/]+)$/;

/** La zone d'une PR d'après les fichiers qu'elle touche. */
export function zoneDes(fichiers) {
  const track = fichiers.some((f) => /^(apps\/web|packages\/sim|docs\/lots)\//.test(f) || /^apps\/api\/src\/(cdj|salon|garage[^/]*)\.ts$/.test(f));
  const jump = fichiers.some((f) => /^(apps\/jump|packages\/jump-sim|docs\/jump)\//.test(f) || /^apps\/api\/src\/jump[^/]*\.ts$/.test(f));
  const plateforme = fichiers.some((f) => !/^(apps\/web|packages\/sim|docs\/lots|apps\/jump|packages\/jump-sim|docs\/jump)\//.test(f) && !/^apps\/api\/src\/(cdj|salon|garage[^/]*|jump[^/]*)\.ts$/.test(f) && !TOLERES_POUR_UN_JEU.test(f));
  const z = [];
  if (track) z.push("Track");
  if (jump) z.push("Jump");
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
    } else if (cmd === "bascule") {
      // L'instant du déploiement : l'heure simulée (répétition) ou maintenant. Le jour de bascule est calculé ICI, au moment du clic.
      const premier = JSON.parse(readFileSync(new URL("../config/lancement.json", import.meta.url), "utf8")).premierJour;
      const simulee = opt("--simulee");
      const ms = simulee ? instantDeParis(simulee) : opt("--maintenant") ? Date.parse(opt("--maintenant")) : Date.now();
      const plan = planDesJours(ms, premier);
      const lignes = [`bascule=${plan.bascule}`, `veille=${plan.veille}`, `premier=${plan.premier}`, `dernier_regenere=${plan.dernierRegenere}`, `instant=${plan.instant}`, `jour_de_paris=${plan.jourDeParis}`];
      if (opt("--sortie")) appendFileSync(opt("--sortie"), lignes.join("\n") + "\n");
      console.log(lignes.join("\n"));
    } else if (cmd === "jours-servis") {
      // La production sert les jours figés de son IMAGE : le commit de son étiquette, plus ceux que « Mettre en production » y a ajoutés (artefact `jours-figes`) et qui n'entrent
      // dans le dépôt que par la PR « robot » qui suit (commit « Jours figés de la mise en production … »). Sans eux, le code en production régénérerait ces jours avec son code d'aujourd'hui,
      // autre que celui qui les a figés (le code d'avant) : un faux conflit. On les relit donc dans l'historique.
      const jusqua = opt("--jusqua") ?? "origin/main";
      const commits = git("log", "--reverse", "--format=%H", "-E", "--grep=^Jours figés de la mise en production", `${a}..${jusqua}`).split("\n").filter(Boolean);
      mkdirSync(b, { recursive: true });
      const remis = [];
      for (const sha of commits) {
        for (const chemin of git("diff-tree", "--no-commit-id", "--name-only", "-r", sha, "--", "apps/jump/public/levels").split("\n").filter((f) => /\/\d{4}-\d{2}-\d{2}\.json$/.test(f))) {
          const cible = join(b, chemin.split("/").at(-1));
          if (existsSync(cible)) continue;
          writeFileSync(cible, git("show", `${sha}:${chemin}`));
          remis.push(chemin.split("/").at(-1));
        }
      }
      console.log(remis.length ? `jours servis par la production, remis : ${remis.join(" ")}` : "aucun jour servi hors du commit de l'étiquette");
      // Lot R11 : le registre des jours de Track que la production sert est celui de son image : le fichier du commit de l'étiquette, plus ce que les PR « Jours figés » y ont ajouté depuis
      // (même raison que les niveaux de Jump). Un code en production d'avant le registre n'a pas le fichier : rien à remettre (il choisit la version par une date).
      const registre = opt("--registre");
      if (registre && existsSync(dirname(registre))) {
        const chemin = "packages/sim/src/jours-track.json";
        const dernier = git("log", "--format=%H", "-1", "-E", "--grep=^Jours figés de la mise en production", `${a}..${jusqua}`, "--", chemin).trim();
        if (dernier) {
          writeFileSync(registre, git("show", `${dernier}:${chemin}`));
          console.log(`registre des jours de Track servi par la production : celui de ${dernier.slice(0, 7)}`);
        } else console.log("registre des jours de Track : celui du commit de l'étiquette");
      }
    } else if (cmd === "empreintes") {
      // Le script d'empreintes est celui de CE dépôt, copié dans le dépôt visé (le code en production ne l'a pas) : il ne dépend que des paquets @cdj/*.
      const depot = resolve(a);
      const ici = fileURLToPath(new URL("../apps/api/scripts/", import.meta.url));
      const dossier = join(depot, "apps/api/scripts");
      mkdirSync(dossier, { recursive: true });
      for (const f of ["empreintes.ts", "empreintes-jours.ts"]) copyFileSync(join(ici, f), join(dossier, f));
      const api = join(depot, "apps/api");
      execFileSync(join(depot, "node_modules/.bin/esbuild"), ["scripts/empreintes-jours.ts", "--bundle", "--platform=node", "--format=esm", "--target=node22", "--outfile=dist/empreintes-jours.mjs", "--log-level=warning"], { cwd: api, stdio: "inherit" });
      const donnees = ["--du", "--au", "--niveaux", "--sortie", "--jeux"].flatMap((o) => (opt(o) ? [o, o === "--niveaux" || o === "--sortie" ? resolve(opt(o)) : opt(o)] : []));
      execFileSync(process.execPath, ["dist/empreintes-jours.mjs", ...donnees], { cwd: api, stdio: "inherit", env: { ...process.env, NODE_NO_WARNINGS: "1" } });
    } else if (cmd === "proteges") {
      // Les jours à partir du lancement (`--premier`) jusqu'à la veille de la bascule : déjà figés (registre de Track, niveaux de Jump du dépôt visé) ou avec un résultat en production.
      const cible = resolve(opt("--cible"));
      const figes = new Set();
      const regFichier = join(cible, "packages/sim/src/jours-track.json");
      if (existsSync(regFichier)) for (const d of Object.keys(joursDuRegistre(JSON.parse(readFileSync(regFichier, "utf8"))))) figes.add(d);
      const niveaux = join(cible, "apps/jump/public/levels");
      const datesJump = existsSync(niveaux) ? readdirSync(niveaux).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 10)) : [];
      for (const d of datesJump) figes.add(d);
      const premier = opt("--premier");
      const veille = opt("--veille");
      const alire = [];
      for (let d = premier; d <= veille; d = ajouterJours(d, 1)) if (!figes.has(d)) alire.push(d);
      const resultats = await lireResultats(opt("--origine"), alire);
      const proteges = joursProteges({ premier, veille, figes: [...figes], resultats });
      // Le premier jour comparé : le plus ancien niveau figé de Jump (les jours d'avant le lancement « restent tels quels »).
      proteges.debut = datesJump.filter((d) => d < premier).sort()[0] ?? premier;
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
    } else if (cmd === "jours-figes-filtrer") {
      const proteges = JSON.parse(readFileSync(opt("--proteges"), "utf8"));
      const retires = niveauxAEffacer(existsSync(a) ? readdirSync(a) : [], proteges);
      for (const f of retires) rmSync(join(a, f));
      console.log(retires.length ? `niveaux de Jump retirés (jours sans résultat, régénérés par le nouveau code) : ${retires.join(" ")}` : "aucun niveau de Jump à retirer");
    } else if (cmd === "registre") {
      // Le script est celui de CE dépôt, copié dans le dépôt visé (le code en production ne l'a pas) ; il ne dépend que de `@cdj/sim`.
      const depot = resolve(a);
      const ici = fileURLToPath(new URL("../apps/api/scripts/", import.meta.url));
      const dossier = join(depot, "apps/api/scripts");
      mkdirSync(dossier, { recursive: true });
      copyFileSync(join(ici, "registre-jours.ts"), join(dossier, "registre-jours.ts"));
      const api = join(depot, "apps/api");
      execFileSync(join(depot, "node_modules/.bin/esbuild"), ["scripts/registre-jours.ts", "--bundle", "--platform=node", "--format=esm", "--target=node22", "--outfile=dist/registre-jours.mjs", "--log-level=warning"], { cwd: api, stdio: "inherit" });
      const brut = resolve(opt("--sortie") + ".jours");
      execFileSync(process.execPath, ["dist/registre-jours.mjs", "--du", opt("--du"), "--au", opt("--au"), "--sortie", brut], { cwd: api, stdio: "inherit", env: { ...process.env, NODE_NO_WARNINGS: "1" } });
      const { jours } = JSON.parse(readFileSync(brut, "utf8"));
      // Seuls les jours protégés entrent au registre (lot R11) : un jour sans résultat prend la version du code déployé.
      const proteges = opt("--proteges") ? JSON.parse(readFileSync(opt("--proteges"), "utf8")) : null;
      const gardes = Object.entries(jours).filter(([d]) => !proteges || estProtege(proteges, d)).map(([d, [g, sim]]) => [d, `${g}/${sim}`]);
      writeFileSync(resolve(opt("--sortie")), JSON.stringify(registreDesJours(Object.fromEntries(gardes), opt("--au")), null, 1) + "\n");
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
      process.stdout.write(text);
      if (!comparaison.ok) process.exit(1);
    } else if (cmd === "empreintes-fusion") {
      const { fusion, ajoutes, conflits } = fusionnerEmpreintes(existsSync(a) ? JSON.parse(readFileSync(a, "utf8")) : { track: {}, jump: {} }, JSON.parse(readFileSync(b, "utf8")), opt("--jusqua"), opt("--proteges") ? JSON.parse(readFileSync(opt("--proteges"), "utf8")) : null);
      if (conflits.length) throw new Error(`jour(s) passé(s) dont l'empreinte change : ${conflits.join(", ")} (un jour passé ne change jamais)`);
      writeFileSync(a, JSON.stringify(fusion, null, 1) + "\n");
      console.log(ajoutes.length ? `empreintes ajoutées : ${ajoutes.length} (${ajoutes[0]} … ${ajoutes.at(-1)})` : "aucune empreinte à ajouter");
    } else if (cmd === "inventaire") {
      const lire = (ref) => {
        const fichiers = git("ls-tree", "-r", "--name-only", ref, "--", "apps/api/src", "packages/sim/src", "packages/jump-sim/src").split("\n").filter(Boolean);
        const voulus = ["packages/jump-sim/src/constants.ts", "packages/sim/src/constants.ts", "packages/sim/src/dailyId.ts", "packages/sim/src/medals.ts", ...fichiers.filter((f) => f.startsWith("apps/api/src/"))];
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
      console.error("usage : node scripts/mise-en-production.mjs etiquette | derniere | changements <de> <à> | jours-figes <figés> <cible> | bascule | bascule-valide <jour> | comparer <prod> <cible> <bascule> | empreintes-fusion <fichier> <nouveau> | proteges | proteges-verifier <fichier> | jours-figes-filtrer <dossier> | registre <dépôt> | registre-fusion <registre> <production> | inventaire <de> <à>");
      process.exit(2);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
