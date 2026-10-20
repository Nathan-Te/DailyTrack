import { resolve } from "node:path";
import { defineConfig } from "vite";
import { CATALOGUE_COMMUN } from "../../packages/ui/src/catalogue";
import { pagesDuSocle } from "../../packages/ui/outils/vite";
import { CATALOGUE_PORTAIL } from "./src/catalogue";
import { CATALOGUE_VITRINE } from "./src/catalogueVitrine";

// Lot R4 (plateforme) : le portail, construit sans `package.json` (le dossier n'est pas un espace de travail npm) par
// `vite build -c apps/portail/vite.config.ts` → `dist/` : la page d'accueil (racine de playdujour.com) et, depuis le lot R5, la page
// « Mentions légales et confidentialité » (`/mentions-legales/`). `scripts/site.mjs` le lance et assemble le site (portail, /track/, /jump/).
// Lot I1 : le portail passe au socle `@cdj/ui` (résolu par l'espace de travail npm de packages/ui, comme @cdj/core) ; textes du HTML
// pré-remplis depuis le catalogue français, Archivo Black et Archivo 400 préchargées ; la vitrine des composants (`/ui/`) est construite
// sauf quand `PORTAIL_VITRINE=0` (la production : `node scripts/site.mjs site --production`).
const vitrine = process.env.PORTAIL_VITRINE !== "0";

export default defineConfig({
  root: import.meta.dirname,
  base: "./",
  // Lot I2 : le lien de démonstration `/?demo=joueur` n'existe que là où la vitrine existe (recette et aperçus) : la construction de production
  // ne contient ni le chemin, ni l'identifiant, ni ses textes (code mort retiré par la construction ; test construction.test.ts).
  define: { __PORTAIL_DEMO__: JSON.stringify(vitrine) },
  plugins: [
    pagesDuSocle({
      catalogue: { ...CATALOGUE_COMMUN.fr, ...CATALOGUE_PORTAIL.fr, ...CATALOGUE_VITRINE.fr },
      prechargees: ["archivo-black-latin-400-normal", "archivo-latin-400-normal"],
    }),
  ],
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        mentions: resolve(import.meta.dirname, "mentions-legales/index.html"),
        profil: resolve(import.meta.dirname, "profil/index.html"),
        ...(vitrine ? { vitrine: resolve(import.meta.dirname, "ui/index.html") } : {}),
      },
    },
  },
});
