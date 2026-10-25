// Recette (lot R1 de la plateforme) : ce que les workflows de recette et de Pages calculent de la même façon, à partir du nom de la branche.
// Fonctions pures, testées (apps/api/test/recette.test.ts). Ligne de commande (utilisée par .github/workflows/*.yml) :
//   node scripts/recette.mjs tag <branche>                     → étiquette de la révision Cloud Run (`b-lot-r1-recet-1x2y3z`)
//   node scripts/recette.mjs slug <branche>                    → dossier de l'aperçu Pages (`lot-R1-recette` : /b/<slug>/)
//   node scripts/recette.mjs url <adresse de recette> <branche> → adresse de la révision étiquetée (https://<étiquette>---<hôte>)
//   node scripts/recette.mjs touches-server < fichiers.txt      → « true » si un des fichiers (un par ligne) est du code du serveur

/**
 * Ce qui fait partie du serveur : une PR qui y touche déploie sa révision de recette, une fusion qui y touche déploie l'API.
 * Recopié tel quel dans `on.pull_request.paths` de recette.yml (un test vérifie que les deux listes sont identiques).
 * `packages/profile` : le futur module de profil commun (lot P0) ; le lot qui le crée ajuste ce chemin s'il en prend un autre.
 */
export const SERVER_PATHS = [
  "apps/api/**",
  "packages/sim/**",
  "packages/core/**",
  "packages/clock/**",
  "packages/jump-sim/**",
  "packages/profile/**",
  "apps/jump/public/levels/**",
  "config/**", // lot R8 : la date du lancement (config/lancement.json) est lue par le serveur
  "package.json",
  "package-lock.json",
  "tsconfig.base.json",
  ".github/workflows/deploy-api.yml",
  ".github/workflows/recette.yml",
];

/** Longueur maximale d'une étiquette : Cloud Run borne l'adresse `<étiquette>---<service>-<empreinte>-<région>` à 63 caractères. */
export const TAG_MAX = 24;
const SLUG_MAX = TAG_MAX - "b-".length - "-".length - 6;

/** Empreinte courte et stable d'un texte : FNV-1a 32 bits, en base 36 sur 6 caractères. */
export function shortHash(text) {
  let h = 0x811c9dc5;
  for (const ch of new TextEncoder().encode(text)) h = Math.imul(h ^ ch, 0x01000193) >>> 0;
  return h.toString(36).padStart(6, "0").slice(-6);
}

/** Minuscules sans accents, chiffres et tirets seulement, sans tiret au bord ni double tiret. */
function simplify(text) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Étiquette de la révision de recette d'une branche : `b-` + nom simplifié (coupé) + `-` + empreinte du nom EXACT de la branche.
 * Commence par une lettre, minuscules, chiffres et tirets, 24 caractères au plus ; deux branches différentes n'ont pas la même étiquette
 * (l'empreinte départage `lot-r1` et `Lot-R1`, ou deux noms longs au même début).
 */
export function recetteTag(branch) {
  if (typeof branch !== "string" || !branch.trim()) throw new Error("recetteTag : nom de branche vide");
  const slug = simplify(branch).slice(0, SLUG_MAX).replace(/-+$/, "");
  return `b-${slug ? `${slug}-` : ""}${shortHash(branch)}`;
}

/** Dossier de l'aperçu d'une branche sur GitHub Pages (`/b/<slug>/`) : comme avant le lot R1, les `/` deviennent des `-`. */
export function previewSlug(branch) {
  if (typeof branch !== "string" || !branch.trim()) throw new Error("previewSlug : nom de branche vide");
  return branch.replace(/\//g, "-");
}

/** Adresse d'une révision étiquetée : `https://<étiquette>---<hôte du service>` (règle des adresses de Cloud Run). */
export function taggedUrl(serviceUrl, tag) {
  const m = /^https:\/\/([^/]+?)\/*$/.exec(String(serviceUrl).trim());
  if (!m) throw new Error(`taggedUrl : adresse de service attendue (https://hôte), reçu « ${serviceUrl} »`);
  if (m[1].includes("---")) throw new Error(`taggedUrl : « ${serviceUrl} » est déjà l'adresse d'une révision étiquetée`);
  return `https://${tag}---${m[1]}`;
}

/** Un motif de `paths` (GitHub) → expression régulière : `**` = n'importe quoi, `*` = tout sauf `/`. */
function globToRegExp(glob) {
  const re = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*\*/g, "\u0000").replace(/\*/g, "[^/]*").replace(/\u0000/g, ".*");
  return new RegExp(`^${re}$`);
}

/** Un des fichiers modifiés fait-il partie du serveur (`SERVER_PATHS`) ? */
export function touchesServer(files) {
  const res = SERVER_PATHS.map(globToRegExp);
  return files.some((f) => res.some((re) => re.test(f)));
}

const isMain = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("/scripts/recette.mjs");
if (isMain) {
  const [cmd, a, b] = process.argv.slice(2);
  try {
    if (cmd === "tag") console.log(recetteTag(a));
    else if (cmd === "slug") console.log(previewSlug(a));
    else if (cmd === "url") console.log(taggedUrl(a, recetteTag(b)));
    else if (cmd === "touches-server") {
      const { readFileSync } = await import("node:fs");
      const files = readFileSync(0, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);
      console.log(touchesServer(files) ? "true" : "false");
    } else {
      console.error("usage : node scripts/recette.mjs tag|slug <branche> · url <adresse> <branche> · touches-server < fichiers");
      process.exit(2);
    }
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }
}
