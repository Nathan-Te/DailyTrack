import { readdirSync } from "node:fs";
import { defineConfig } from "vite";
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

export default defineConfig({
  // Chemins relatifs, comme DailyTrack : le jeu est publié sous `<site>/jump/` (GitHub Pages : `/DailyTrack/jump/` et, pour une branche,
  // `/DailyTrack/b/<branche>/jump/`) ; une base absolue `/jump/` casserait les aperçus de branche.
  base: "./",
  plugins: [pagesDuSocle({ catalogue: { ...CATALOGUE_COMMUN.fr, ...CATALOGUE_FR, ...CATALOGUE_APERCU.fr }, prechargees: FACES_PRECHARGEES, absolues: true })],
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
