// Lot T1 (plateforme) — `npm run mesure-jetons` : ce qu'une session neuve charge toute seule (CLAUDE.md et leurs imports `@…`), et les fichiers texte les
// plus gros du dépôt. Outil de lecture : il n'écrit rien. Estimation : 1 jeton ≈ 4 caractères.
//
//   npm run mesure-jetons                 → le tableau par type de session, puis le top 20 des fichiers texte
//   npm run mesure-jetons -- --detail     → aussi la liste des fichiers chargés par session
//   npm run mesure-jetons -- --json       → la même chose en JSON (pour comparer avant / après)
//   npm run mesure-jetons -- --id essai   → la session « jeu neuf » avec cet identifiant (défaut : cibles, le modèle du générateur)
//   npm run mesure-jetons -- --rev <commit> → la même mesure sur un commit (l'« avant » d'un lot : f5c68e9 est le dernier commit d'avant le lot T1)
//
// Règle de Claude Code (documentation « How Claude remembers your project ») : le CLAUDE.md racine et ses `@imports` sont chargés au lancement ;
// le CLAUDE.md d'un sous-dossier est chargé à la demande, dès qu'on lit ou modifie un fichier de ce dossier (ou d'un dossier dessous).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const detail = args.includes("--detail");
const json = args.includes("--json");
const idNeuf = args.includes("--id") ? args[args.indexOf("--id") + 1] : "cibles";
const rev = args.includes("--rev") ? args[args.indexOf("--rev") + 1] : null;
const git = (...a) => execFileSync("git", a, { cwd: racine, encoding: "utf8", maxBuffer: 1 << 28, stdio: ["ignore", "pipe", "ignore"] });
const existe = (c) => {
  if (!rev) return existsSync(join(racine, c));
  try {
    git("cat-file", "-e", `${rev}:${c}`);
    return true;
  } catch {
    return false;
  }
};

/** Dossiers dans lesquels une session « typique » lit ou modifie des fichiers (chacun charge le CLAUDE.md le plus proche, et ceux au-dessus). */
export const SESSIONS = {
  portail: ["apps/portail", "packages/ui", "packages/profile", "packages/core"],
  track: ["apps/web", "packages/sim", "apps/api", "packages/core", "packages/profile", "packages/ui", "packages/kit"],
  "jeu neuf": [`apps/${idNeuf}`, `packages/${idNeuf}-sim`, "apps/api", "packages/kit", "packages/ui", "packages/profile", "packages/core"],
  api: ["apps/api", "packages/core"],
};

const jetons = (texte) => Math.ceil([...texte].length / 4);

function lire(chemin) {
  return rev ? git("show", `${rev}:${chemin}`) : readFileSync(join(racine, chemin), "utf8");
}

/** Les `@fichier` d'un CLAUDE.md (hors blocs de code et extraits en `code`), qui existent. */
export function importsDe(chemin) {
  const texte = lire(chemin)
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`[^`\n]*`/g, "");
  const trouves = [];
  for (const m of texte.matchAll(/(?:^|\s)@([\w./-]+\.[a-z]+)/g)) {
    const cible = join(dirname(chemin), m[1]).replace(/\\/g, "/");
    if (existe(cible)) trouves.push(cible);
  }
  return trouves;
}

/** Un fichier chargé et tout ce qu'il importe (quatre niveaux au plus, comme Claude Code). */
function avecImports(chemin, vus = new Set(), profondeur = 0) {
  if (vus.has(chemin) || profondeur > 4) return [];
  vus.add(chemin);
  const sortie = [chemin];
  for (const i of importsDe(chemin)) sortie.push(...avecImports(i, vus, profondeur + 1));
  return sortie;
}

/** Les CLAUDE.md chargés quand on travaille dans ces dossiers : la racine (et ses imports), puis le plus proche de chaque dossier et ceux au-dessus. */
export function fichiersCharges(dossiers) {
  const charges = new Set();
  const ajouter = (c) => {
    for (const f of avecImports(c)) charges.add(f);
  };
  ajouter("CLAUDE.md");
  for (const d of dossiers) {
    for (let cur = d; cur && cur !== "."; cur = dirname(cur)) {
      const c = `${cur}/CLAUDE.md`;
      if (existe(c)) ajouter(c);
    }
  }
  return [...charges];
}

function mesureSession(dossiers) {
  const fichiers = fichiersCharges(dossiers).map((f) => {
    const t = lire(f);
    return { fichier: f, lignes: t.split("\n").length, jetons: jetons(t) };
  });
  return {
    fichiers,
    lignes: fichiers.reduce((s, f) => s + f.lignes, 0),
    jetons: fichiers.reduce((s, f) => s + f.jetons, 0),
  };
}

const GENERES = [/\.generated\./, /^config\/jeux\/projections\//, /package-lock\.json$/, /traductions\.md$/, /\/passation\.md$/, /\/fixtures\//, /golden/, /banc-/];
const BINAIRES = /\.(png|jpe?g|gif|webp|woff2?|ogg|m4a|mp3|wav|ico|wasm|glb|pdf|zip)$/i;

/** Les fichiers suivis par git les plus gros en texte, avec ce qu'ils sont (généré, référence de test, document, code…). */
export function plusGros(n = 20) {
  const lignes = [];
  if (rev) {
    for (const l of git("ls-tree", "-r", "-l", rev).split("\n").filter(Boolean)) {
      const m = /^\d+ blob \w+\s+(\d+)\t(.+)$/.exec(l);
      if (m && !BINAIRES.test(m[2])) lignes.push({ fichier: m[2], octets: Number(m[1]) });
    }
  } else {
    for (const f of git("ls-files", "-z").split("\0").filter(Boolean)) {
      if (BINAIRES.test(f) || !existsSync(join(racine, f))) continue;
      lignes.push({ fichier: f, octets: readFileSync(join(racine, f)).length });
    }
  }
  return lignes
    .sort((a, b) => b.octets - a.octets)
    .slice(0, n)
    .map((l) => ({
      ...l,
      jetons: Math.ceil(l.octets / 4),
      genre: GENERES.some((r) => r.test(l.fichier)) ? "généré / référence" : l.fichier.endsWith(".md") || l.fichier.endsWith(".html") ? "document" : /\.(json)$/.test(l.fichier) ? "données" : "code",
    }));
}

function principal() {
  const sessions = Object.fromEntries(Object.entries(SESSIONS).map(([nom, dossiers]) => [nom, mesureSession(dossiers)]));
  const gros = plusGros(20);

  if (json) {
    console.log(JSON.stringify({ sessions, gros }, null, 2));
  } else {
    const fmt = (n) => n.toLocaleString("fr-FR");
    console.log("| session | fichiers chargés | lignes | jetons estimés |\n|---|---:|---:|---:|");
    for (const [nom, s] of Object.entries(sessions)) console.log(`| ${nom} | ${s.fichiers.length} | ${fmt(s.lignes)} | ${fmt(s.jetons)} |`);
    if (detail) {
      for (const [nom, s] of Object.entries(sessions)) {
        console.log(`\n${nom} :`);
        for (const f of s.fichiers) console.log(`  ${f.fichier} — ${f.lignes} lignes, ${fmt(f.jetons)} jetons`);
      }
    }
    console.log("\nTop 20 des fichiers texte (git ls-files, hors binaires) :\n| fichier | Ko | jetons | genre |\n|---|---:|---:|---|");
    for (const g of gros) console.log(`| ${g.fichier} | ${fmt(Math.round(g.octets / 1000))} | ${fmt(g.jetons)} | ${g.genre} |`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) principal();
