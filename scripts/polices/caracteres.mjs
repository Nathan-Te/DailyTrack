// Lot B1 (plateforme) — LE jeu de caractères des polices : une seule définition, lue par l'outil de découpe (scripts/polices/decouper.mjs) et par le test garde-fou
// (packages/ui/test/polices.test.ts). Le jeu est le **français et l'anglais** : la base écrite ci-dessous, plus **tout caractère hors ASCII réellement présent** dans le code, les feuilles
// et les pages fixes du projet (hors commentaires, tests et outils) et dans les fichiers de données affichés (fiches des jeux, musiques). Les catalogues sont des fichiers de code : ils y sont.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * La base, toujours dans les polices (si la police d'origine la porte) : l'ASCII imprimable, les lettres accentuées du latin-1 (les pseudos des joueurs : « lettres, chiffres, espace . _ ' - »),
 * les guillemets français et typographiques, l'apostrophe, les tirets, le point médian, l'ellipse, le degré, l'euro, l'espace insécable.
 */
export const BASE = new Set(
  [
    ...Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCodePoint(0x20 + i)),
    ...Array.from({ length: 0xff - 0xc0 + 1 }, (_, i) => String.fromCodePoint(0xc0 + i)), // À … ÿ (× et ÷ comprises)
    ..." «»‘’“”‹›…–—·°€œŒŸ",
  ],
);

/** Les dossiers qui portent ce qu'un joueur voit (code, feuilles, pages) — jamais les tests, les outils, les captures ni la documentation. */
const DOSSIERS = ["apps", "packages"];
const SERVEUR = "apps/api"; // le serveur n'écrit aucun texte de l'interface (des codes d'erreur, traduits par les catalogues)
const SAUTE = new Set(["node_modules", "dist", "test", "tests", "e2e", "tools", "scripts", "outils", "vitrine", "polices", ".vite", "public"]);
const FICHIERS_DE_DONNEES = ["musique/musiques.json", ...readdirSync(join(ROOT, "config/jeux")).filter((f) => f.endsWith(".json")).map((f) => `config/jeux/${f}`)];

function* parcourir(dir) {
  for (const nom of readdirSync(dir)) {
    if (SAUTE.has(nom)) continue;
    const p = join(dir, nom);
    if (relative(ROOT, p) === SERVEUR) continue;
    const s = statSync(p);
    if (s.isDirectory()) yield* parcourir(p);
    else if (/\.(ts|css|html)$/.test(nom) && !/\.(test|spec)\.ts$/.test(nom) && !nom.endsWith(".d.ts")) yield p;
  }
}

/** Le texte d'un fichier sans ses commentaires (mêmes règles simples pour TypeScript, CSS et HTML ; ce qui reste suffit à lire les caractères écrits). */
export function sansCommentaires(texte, fichier) {
  let t = texte.replace(/\/\*[\s\S]*?\*\//g, "");
  if (fichier.endsWith(".html")) t = t.replace(/<!--[\s\S]*?-->/g, "");
  if (fichier.endsWith(".ts")) t = t.replace(/(?<![:"'`\w\\])\/\/[^\n]*/g, "");
  return t;
}

/** `Map<caractère, fichiers>` : les caractères hors ASCII écrits dans le projet (et la liste des fichiers où on les lit). */
export function caracteresEcrits(root = ROOT) {
  const vus = new Map();
  const lire = (p) => {
    for (const c of new Set(sansCommentaires(readFileSync(p, "utf8"), p))) {
      if (c.codePointAt(0) <= 0x7e || /[\u0000-\u001f]/.test(c)) continue;
      if (!vus.has(c)) vus.set(c, []);
      vus.get(c).push(relative(root, p));
    }
  };
  for (const d of DOSSIERS) for (const p of parcourir(join(root, d))) lire(p);
  // Les pages publiées sont à la racine de apps/portail (mentions, 404, partage) : déjà dans « apps ». Les données affichées :
  for (const f of FICHIERS_DE_DONNEES) lire(join(root, f).replace(/\.json$/, ".json"));
  return vus;
}

/** Le jeu de caractères des polices : la base, plus ce que le projet écrit (hors ASCII). Les emojis et les signes d'aucune police s'y trouvent aussi : la découpe ignore ce qu'une police n'a pas. */
export function jeuDeCaracteres(root = ROOT) {
  const jeu = new Set(BASE);
  for (const c of caracteresEcrits(root).keys()) jeu.add(c);
  return jeu;
}

/** Les points de code du jeu, triés. */
export const pointsDeCode = (jeu) => [...jeu].map((c) => c.codePointAt(0)).sort((a, b) => a - b);
