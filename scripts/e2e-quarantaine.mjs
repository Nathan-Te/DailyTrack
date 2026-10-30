// Quarantaine des tests e2e (lot R3 de la plateforme) : le FILET pour un test instable futur, pas la règle. Lue par scripts/e2e-summary.mjs
// (verdict `e2e` de .github/workflows/ci.yml) ; pure et testée (apps/web/test/quarantaine.test.ts), le fichier du dépôt aussi.
//   node scripts/e2e-quarantaine.mjs [e2e/quarantaine.json] [--nuit]   → vérifie le fichier ; code 1 s'il est refusé (ou, avec --nuit, une dette expirée)
//
// Effet (docs/plateforme/lots/lot-R3-ci.md) :
//   - sur une PR, un test en quarantaine TOURNE toujours ; son échec (ou son instabilité) est un avertissement du résumé, pas un verdict rouge ;
//   - sur `main`, la nuit et avant la production (le run `push` de main), il reste bloquant ;
//   - garde-fous : une entrée sans dette (lien vers docs/orchestration.md § 8 pour DailyTrack, docs/jump/synthese.md pour DailyJump, où le test
//     est nommé), sans personne ou lot pour la réparer, sans date, d'un navigateur inconnu ou en double est REFUSÉE (le fichier entier : le run
//     échoue) ; au plus MAX_ENTRIES entrées ; une entrée de plus de MAX_DAYS jours fait échouer le run de nuit (« dette expirée »).

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const MAX_ENTRIES = 3;
export const MAX_DAYS = 14;
export const BROWSERS = ["chromium", "firefox", "webkit"];
/** Où vit la dette d'un test, selon son jeu (préfixe du fichier dans le rapport fusionné : `web/e2e/…`, `jump/e2e/…`). */
// Lot R15 : Tower (3ᵉ jeu, `tower/e2e/…`) n'a pas de synthèse : sa dette se note dans `docs/tower/consignes.md`.
export const DEBT_DOCS = { web: "docs/orchestration.md", jump: "docs/jump/synthese.md", tower: "docs/tower/consignes.md" };

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const QUARANTINE_FILE = join(ROOT, "e2e/quarantaine.json");

const TEST_RE = /^(web|jump|tower)\/e2e\/([\w.-]+\.spec\.ts) › \S.*$/;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Jour (nombre de jours depuis 1970, UTC) d'une date AAAA-MM-JJ, ou null si elle n'existe pas. */
export function dayOf(text) {
  const m = DAY_RE.exec(String(text ?? ""));
  if (!m) return null;
  const ms = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const d = new Date(ms);
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? Math.floor(ms / 86_400_000) : null;
}

/**
 * Un test du rapport fusionné est-il celui d'une entrée ? Même projet (le jeu et le navigateur), même fichier, mêmes titres (`describe` compris).
 * Le rapport ne nomme pas les fichiers des deux jeux de la même façon (`salon.spec.ts`, `e2e/smoke.spec.ts`) : on compare le nom du fichier seul,
 * le projet dit le jeu.
 */
export function matches(entry, t) {
  const m = TEST_RE.exec(entry.test);
  if (!m || entry.project !== t.project || String(t.file).split("/").pop() !== m[2]) return false;
  return entry.test === `${m[1]}/e2e/${m[2]} › ${(t.path ?? [t.title]).join(" › ")}`;
}

/** Projet Playwright d'un navigateur pour un jeu : DailyTrack `chromium`, DailyJump `jump-chromium` (lot 3c), Tower `tower-chromium` (lot R15). */
export function projectFor(test, browser) {
  return test.startsWith("jump/") || test.startsWith("tower/") ? `${test.split("/")[0]}-${browser}` : browser;
}

/**
 * Vérifie la quarantaine. `today` : jour (depuis 1970) ; `readDoc(chemin)` : texte d'un document du dépôt, ou null s'il n'existe pas.
 * Rend `{ entries, errors, expired }` : `errors` non vide = fichier refusé ; `expired` = entrées de plus de MAX_DAYS jours.
 */
export function checkQuarantine(data, { today, readDoc }) {
  const errors = [];
  const list = data?.entrees;
  if (!Array.isArray(list)) return { entries: [], errors: ["quarantaine : le fichier doit avoir une liste « entrees » (vide si aucun test n'est en quarantaine)"], expired: [] };
  if (list.length > MAX_ENTRIES) errors.push(`quarantaine : ${list.length} entrées, au plus ${MAX_ENTRIES} — un instable de plus se répare, il n'entre pas`);
  const seen = new Set();
  const entries = [];
  const expired = [];
  list.forEach((e, i) => {
    const where = `quarantaine, entrée ${i + 1}${e?.test ? ` (${e.test})` : ""}`;
    const problems = [];
    const m = TEST_RE.exec(String(e?.test ?? ""));
    if (!m) problems.push("« test » doit nommer le test du rapport : « web/e2e/<fichier>.spec.ts › <titre> », « jump/e2e/… » ou « tower/e2e/… »");
    if (!BROWSERS.includes(e?.navigateur)) problems.push(`« navigateur » : ${BROWSERS.join(", ")}`);
    const since = dayOf(e?.depuis);
    if (since === null) problems.push("« depuis » : la date d'entrée, AAAA-MM-JJ");
    else if (since > today) problems.push("« depuis » est dans le futur");
    if (typeof e?.responsable !== "string" || !e.responsable.trim()) problems.push("« responsable » : la personne ou le lot qui doit le réparer");
    // La dette : un lien vers le document de suivi du jeu (avec son ancre), qui nomme le fichier du test.
    const dette = String(e?.dette ?? "");
    if (m) {
      const doc = DEBT_DOCS[m[1]];
      const [path, anchor] = dette.split("#");
      if (path !== doc || !anchor) problems.push(`« dette » : un lien vers la dette dans ${doc} (avec son ancre, ex. ${doc}#8-pièges-rencontrés-à-éviter)`);
      else {
        const text = readDoc(path);
        if (text === null) problems.push(`« dette » : ${path} introuvable`);
        else if (!text.includes(m[2])) problems.push(`« dette » : ${path} ne nomme pas ${m[2]} — la dette doit y être écrite avant la quarantaine`);
      }
    }
    const key = `${e?.test}|${e?.navigateur}`;
    if (seen.has(key)) problems.push("en double");
    seen.add(key);
    if (problems.length) errors.push(`${where} refusée : ${problems.join(" ; ")}`);
    else {
      const entry = { test: e.test, navigateur: e.navigateur, depuis: e.depuis, dette: e.dette, responsable: e.responsable, project: projectFor(e.test, e.navigateur), age: today - since };
      entries.push(entry);
      if (entry.age > MAX_DAYS) expired.push(entry);
    }
  });
  return { entries, errors, expired };
}

/** Lit un document du dépôt (relatif à la racine), ou null. */
export function repoDoc(path) {
  const full = join(ROOT, path);
  return existsSync(full) ? readFileSync(full, "utf8") : null;
}

export const todayUtc = (now = Date.now()) => Math.floor(now / 86_400_000);

/** Charge et vérifie le fichier du dépôt (ou un autre). */
export function loadQuarantine(file = QUARANTINE_FILE, { today = todayUtc(), readDoc = repoDoc } = {}) {
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch (e) {
    return { entries: [], errors: [`quarantaine : ${file} illisible (${e.message})`], expired: [] };
  }
  return checkQuarantine(data, { today, readDoc });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--")) ?? QUARANTINE_FILE;
  const q = loadQuarantine(file);
  for (const e of q.errors) console.error(`::error title=Quarantaine refusée::${e}`);
  if (args.includes("--nuit")) for (const e of q.expired) console.error(`::error title=Dette expirée::${e.test} (${e.navigateur}) en quarantaine depuis ${e.age} jours (plus de ${MAX_DAYS}) : ${e.dette}, à réparer par ${e.responsable}`);
  console.log(`quarantaine : ${q.entries.length} entrée(s) valide(s), ${q.errors.length} refus, ${q.expired.length} expirée(s)`);
  process.exit(q.errors.length || (args.includes("--nuit") && q.expired.length) ? 1 : 0);
}
