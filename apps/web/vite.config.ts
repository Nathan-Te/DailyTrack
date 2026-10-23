import { defineConfig } from "vite";
import { CATALOGUE_COMMUN } from "../../packages/ui/src/catalogue";
import { pagesDuSocle } from "../../packages/ui/outils/vite";
import { CATALOGUE_APERCU } from "./src/catalogue.apercu";
import { CATALOGUE_FR } from "./src/catalogue.fr";
import { glslResserre } from "./outils/glsl";

// Lot I4 (plateforme) : DailyTrack passe au socle `@cdj/ui` — textes du HTML pré-remplis depuis le catalogue français (`pagesDuSocle`), couleur de
// l'onglet et icône tirées des jetons, polices du premier écran préchargées. Les polices sont servies par un chemin absolu et unique
// (`/assets/<nom>-<empreinte>.woff2`), **les mêmes fichiers que ceux du portail** : un joueur qui vient du portail les a déjà en cache ; l'assemblage du
// site (scripts/site.mjs) met dans le dossier `assets/` du portail celles que le portail n'utilise pas lui-même et vérifie qu'elles sont identiques.
const FACES_PRECHARGEES = ["barlow-condensed-latin-800-italic", "archivo-latin-400-normal"];

export default defineConfig({
  // Chemins relatifs : fonctionne à la racine (Cloudflare Pages) comme sous /DailyTrack/ (GitHub Pages).
  base: "./",
  // Lot 46 : les nuanceurs `/* glsl */` resserrés à la construction (outils/glsl.ts).
  plugins: [glslResserre(), pagesDuSocle({ catalogue: { ...CATALOGUE_COMMUN.fr, ...CATALOGUE_FR, ...CATALOGUE_APERCU.fr }, prechargees: FACES_PRECHARGEES, absolues: true })],
  experimental: {
    // Une police est demandée à `/assets/…` (la racine du site, partagée avec le portail), jamais relativement à la page : `/track/assets/…` ferait un second
    // téléchargement des mêmes octets. Tout le reste reste relatif à la page.
    renderBuiltUrl(fichier) {
      return fichier.endsWith(".woff2") ? `/${fichier}` : undefined;
    },
  },
  build: {
    target: "es2022",
    // Trois pages : le jeu, `verify.html` (rejeu de rediffusion sans rendu, pour les tests de navigateur) et `admin/` (menu des outils de test).
    rollupOptions: {
      input: { main: "index.html", verify: "verify.html", admin: "admin/index.html" },
      output: {
        // Three.js (l'essentiel du poids) dans son propre fichier : il ne change presque jamais, donc le navigateur
        // le garde en cache d'un déploiement à l'autre ; seul le petit code du jeu est retéléchargé.
        manualChunks(id: string) {
          if (id.includes("node_modules/three/")) return "three";
          return undefined;
        },
      },
    },
    chunkSizeWarningLimit: 600, // three.js seul pèse ~540 ko (≈ 135 ko compressé) : voulu, et isolé dans son fichier
  },
});
