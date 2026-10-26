import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";
import { CATALOGUE_COMMUN } from "../../packages/ui/src/catalogue";
import { pagesDuSocle } from "../../packages/ui/outils/vite";
import { CATALOGUE_APERCU } from "./src/catalogue.apercu";
import { CATALOGUE_FR } from "./src/catalogue.fr";

// Lot I5 (plateforme) : Jump passe au socle `@cdj/ui`, comme Track au lot I4 — textes du HTML pré-remplis depuis le catalogue français (`pagesDuSocle`), couleur
// de l'onglet et icône tirées des jetons, polices du premier écran préchargées (Lilita One et Archivo 400). Les polices sont servies par un chemin absolu et
// unique (`/assets/<nom>-<empreinte>.woff2`), **les mêmes fichiers que ceux du portail et de Track** : un joueur qui vient du portail les a déjà en cache ;
// l'assemblage du site (scripts/site.mjs) met dans `assets/` du portail celles qu'il n'aurait pas, vérifie qu'elles sont identiques et retire la copie de
// `jump/assets/`.
const FACES_PRECHARGEES = ["lilita-one-latin-400-normal", "archivo-latin-400-normal"];

/**
 * Lot 10 : les dates des niveaux figés (`public/levels/AAAA-MM-JJ.json`), écrites dans le jeu à la construction : le jeu ne demande un
 * fichier figé que pour ces dates (aucune requête inutile pour les autres jours). Vide tant qu'aucun niveau n'est figé.
 */
function frozenDays(): string[] {
  try {
    return readdirSync(new URL("./public/levels", import.meta.url))
      .map((f) => /^(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1])
      .filter((d): d is string => d !== undefined)
      .sort();
  } catch {
    return [];
  }
}

/**
 * Lot 21 : le fil de travail du générateur (`src/dailyWorker.ts`) est une **entrée de la même construction** que le jeu, et non plus un « worker Vite »
 * construit à part. Une construction à part recopiait dans le fil tout ce qu'il partage avec la page (le catalogue des morceaux, le générateur, la
 * simulation : 56 ko compressés en double) ; en entrée de la construction, le fil et le repli sur le fil principal (`import("./dailyGen")`) ne chargent
 * qu'**un seul** fichier du générateur, et le fil partage avec la page les morceaux de simulation qu'elle a déjà. `virtual:jump-fil-generateur` donne
 * l'adresse de ce fil (`workerNavigateur.ts`). Le nom du fichier reste `dailyWorker-<empreinte>.js` (le test de chargement l'intercepte par son nom).
 * En développement, Vite sert la source TypeScript elle-même.
 */
function filDuGenerateur(): Plugin {
  const VIRTUEL = "virtual:jump-fil-generateur";
  let construction = false;
  return {
    name: "jump-fil-generateur",
    configResolved(config) {
      construction = config.command === "build";
    },
    resolveId(id) {
      return id === VIRTUEL ? `\0${VIRTUEL}` : null;
    },
    load(id) {
      if (id !== `\0${VIRTUEL}`) return null;
      if (!construction) return `export default new URL("/src/dailyWorker.ts", location.href).href;`;
      const ref = this.emitFile({ type: "chunk", id: fileURLToPath(new URL("./src/dailyWorker.ts", import.meta.url)), name: "dailyWorker" });
      return `export default import.meta.ROLLUP_FILE_URL_${ref};`;
    },
  };
}

/**
 * Lot R9 : **la construction de production (`VITE_PRODUCTION=1`) ne publie ni la preuve de l'auteur ni les outils.** Chaque fichier figé de `levels/` y perd
 * son champ `preuve` (la rediffusion de l'auteur : la renvoyer au serveur donnerait son temps ; le dépôt et l'image du serveur la gardent, c'est le serveur
 * qui s'en sert) ; `outils/` (`?semaine=` : les sept niveaux suivants, galerie : intentions) et `demo/` (`?api=demo` : la preuve de l'auteur des jours à
 * venir) ne partent pas. Le jeu lit un fichier sans preuve (`thawPublicLevel`). Fait **ici**, à la construction de Jump, pour que toute construction de
 * production soit propre quel que soit l'assemblage du site (`scripts/site.mjs` le revérifie) ; testé sur la vraie construction (`test/productionSite.test.ts`).
 */
function productionSansPreuve(): Plugin {
  let sortie = "";
  let actif = false;
  return {
    name: "jump-production-sans-preuve",
    apply: "build",
    configResolved(config) {
      actif = process.env.VITE_PRODUCTION === "1";
      sortie = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      if (!actif) return;
      const niveaux = join(sortie, "levels");
      if (existsSync(niveaux)) {
        for (const f of readdirSync(niveaux).filter((n) => n.endsWith(".json"))) {
          const fichier = join(niveaux, f);
          const { preuve: _preuve, ...publie } = JSON.parse(readFileSync(fichier, "utf8")) as Record<string, unknown>;
          writeFileSync(fichier, `${JSON.stringify(publie)}\n`);
        }
      }
      for (const dossier of ["outils", "demo"]) rmSync(join(sortie, dossier), { recursive: true, force: true });
    },
  };
}

export default defineConfig({
  // Chemins relatifs, comme DailyTrack : le jeu est publié sous `<site>/jump/` (GitHub Pages : `/DailyTrack/jump/` et, pour une branche,
  // `/DailyTrack/b/<branche>/jump/`) ; une base absolue `/jump/` casserait les aperçus de branche.
  base: "./",
  plugins: [filDuGenerateur(), productionSansPreuve(), pagesDuSocle({ catalogue: { ...CATALOGUE_COMMUN.fr, ...CATALOGUE_FR, ...CATALOGUE_APERCU.fr }, prechargees: FACES_PRECHARGEES, absolues: true })],
  experimental: {
    // Une police est demandée à `/assets/…` (la racine du site, partagée avec le portail et Track), jamais relativement à la page : `/jump/assets/…` ferait un
    // second téléchargement des mêmes octets. Tout le reste reste relatif à la page.
    renderBuiltUrl(fichier) {
      return fichier.endsWith(".woff2") ? `/${fichier}` : undefined;
    },
  },
  define: { __JUMP_FROZEN_DAYS__: JSON.stringify(frozenDays()) },
  build: {
    target: "es2022",
    rollupOptions: {
      // Lot 3 : `verify.html`, rejeu sans rendu pour les tests de déterminisme entre navigateurs.
      input: { main: "index.html", verify: "verify.html" },
      output: {
        // Three.js (l'essentiel du poids) dans son propre fichier : il change rarement, le navigateur le garde en cache.
        manualChunks(id: string) {
          if (id.includes("node_modules/three/")) return "three";
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
