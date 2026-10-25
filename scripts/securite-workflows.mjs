// Lot R7 (audit de sécurité) — les règles de sécurité des workflows GitHub, vérifiées sur le texte (aucun analyseur YAML : le dépôt n'en a pas).
// Testé par `apps/web/test/securiteWorkflows.test.ts` ; `node scripts/securite-workflows.mjs` les applique à `.github/workflows/` et sort en 1 au premier écart.
//   1. `permissions:` au niveau du workflow, jamais `write-all` : un workflow sans bloc reçoit les droits par défaut du dépôt (écriture possible).
//   2. Aucun `pull_request_target` (il donne les secrets et un jeton en écriture à du code de PR).
//   3. Toute action extérieure est épinglée par l'empreinte complète de son commit (`owner/repo@<40 hexadécimaux>  # vX`) : une étiquette (`@v4`)
//      se déplace, donc une action compromise s'exécuterait avec nos secrets et notre fédération d'identité.
//   4. Un droit d'écriture n'est donné qu'aux jobs qui en ont besoin (liste ci-dessous) ; `id-token: write` (fédération vers Google Cloud) idem.
//   5. Aucune donnée contrôlée par un tiers (nom de branche, titre, entrée d'un déclenchement) n'est écrite dans un `run:` : elle passe par `env:`.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/** Écritures permises, par workflow (le droit, pas le job) ; tout le reste est refusé. `ci.yml` et `stabilite.yml` n'écrivent jamais. */
export const ECRITURES_PERMISES = {
  "apercu.yml": ["pull-requests", "id-token"],
  "deploy-api.yml": ["id-token"],
  "deploy-site.yml": ["id-token"],
  "production.yml": ["contents", "pull-requests", "actions", "id-token"],
  "recette-seed.yml": ["id-token"],
  "recette.yml": ["pull-requests", "id-token"],
  "retour-arriere.yml": ["contents", "id-token"],
};

/** Ce qu'un `run:` ne doit jamais interpoler (contrôlé par l'auteur d'une PR, d'une branche ou d'un déclenchement manuel). */
const CONTEXTES_INTERDITS_DANS_RUN = /\$\{\{\s*(github\.head_ref|github\.ref_name|github\.event\.|inputs\.|github\.actor)/;

/** Une comparaison à des constantes (`inputs.cible == 'production' && '--production' || ''`) ne rend que ces constantes : elle ne transporte rien d'un tiers. */
const COMPARAISON_CONSTANTE = /\$\{\{\s*inputs\.[\w-]+\s*==\s*'[^']*'\s*&&\s*'[^']*'\s*\|\|\s*'[^']*'\s*\}\}/g;

/** Les scripts `run:` d'un workflow : `{ ligne, texte }` (le numéro de la ligne du `run:`). */
export function scriptsRun(text) {
  const lines = text.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = /^(\s*)(?:-\s+)?run:\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    const indent = m[1].length;
    const rest = m[2].trim();
    if (/^[|>][+-]?\d*$/.test(rest)) {
      const body = [];
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j].trim() !== "" && lines[j].search(/\S/) <= indent + (lines[i].trimStart().startsWith("- ") ? 2 : 0)) break;
        body.push(lines[j]);
      }
      out.push({ ligne: i + 1, texte: body.join("\n") });
    } else out.push({ ligne: i + 1, texte: rest });
  }
  return out;
}

/** Les écarts d'un workflow : liste de messages (vide = en règle). */
export function auditerWorkflow(nom, text) {
  const problemes = [];
  const sansCommentaires = text.split("\n").map((l) => l.replace(/(^|\s)#.*$/, "$1"));
  const code = sansCommentaires.join("\n");

  // 1. permissions au niveau du workflow
  if (!/^permissions:/m.test(code)) problemes.push(`${nom} : pas de bloc \`permissions:\` au niveau du workflow (droits par défaut du dépôt)`);
  if (/permissions:\s*write-all/.test(code)) problemes.push(`${nom} : \`permissions: write-all\``);

  // 2. pull_request_target
  if (/pull_request_target/.test(code)) problemes.push(`${nom} : \`pull_request_target\` est interdit`);

  // 3. actions épinglées
  sansCommentaires.forEach((l, i) => {
    const m = /^\s*(?:-\s+)?uses:\s*(\S+)/.exec(l);
    if (!m || m[1].startsWith("./")) return;
    if (!/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/.test(m[1])) problemes.push(`${nom}:${i + 1} : action non épinglée par l'empreinte de son commit : ${m[1]}`);
    else if (!/#\s*v?\d/.test(text.split("\n")[i])) problemes.push(`${nom}:${i + 1} : action épinglée sans commentaire de version (\`# v4.4.0\`)`);
  });

  // 4. droits d'écriture
  const permis = ECRITURES_PERMISES[nom] ?? [];
  sansCommentaires.forEach((l, i) => {
    const m = /^\s*([a-z-]+):\s*write\s*$/.exec(l);
    if (m && !permis.includes(m[1])) problemes.push(`${nom}:${i + 1} : droit d'écriture non prévu pour ce workflow : ${m[1]}: write`);
  });

  // 5. contextes non fiables dans les scripts
  for (const s of scriptsRun(text)) {
    const m = CONTEXTES_INTERDITS_DANS_RUN.exec(s.texte.split("\n").map((l) => l.replace(/(^|\s)#.*$/, "$1")).join("\n").replace(COMPARAISON_CONSTANTE, ""));
    if (m) problemes.push(`${nom}:${s.ligne} : \`${m[1]}\` interpolé dans un \`run:\` (le passer par \`env:\`)`);
  }
  return problemes;
}

/** Tous les workflows d'un dossier. */
export function auditerDossier(dossier) {
  const problemes = [];
  const fichiers = readdirSync(dossier).filter((f) => /\.ya?ml$/.test(f));
  for (const f of fichiers) problemes.push(...auditerWorkflow(f, readFileSync(join(dossier, f), "utf8")));
  return { fichiers, problemes };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const racine = join(fileURLToPath(import.meta.url), "..", "..", ".github", "workflows");
  const { fichiers, problemes } = auditerDossier(racine);
  for (const p of problemes) console.error(`::error::${p}`);
  console.log(`${fichiers.length} workflows, ${problemes.length} écart(s)`);
  process.exit(problemes.length ? 1 : 0);
}
