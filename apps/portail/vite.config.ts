import { resolve } from "node:path";
import { defineConfig } from "vite";

// Lot R4 (plateforme) : le portail, construit sans `package.json` (le dossier n'est pas un espace de travail npm : le verrou racine ne change
// pas) par `vite build -c apps/portail/vite.config.ts` → `dist/` : la page d'accueil (racine de playdujour.com) et, depuis le lot R5, la page
// « Mentions légales et confidentialité » (`/mentions-legales/`). `scripts/site.mjs` le lance et assemble le site (portail, /track/, /jump/).
// Lot R5 : plus de pages de redirection de l'ancienne adresse (GitHub Pages).
export default defineConfig({
  root: import.meta.dirname,
  base: "./",
  build: {
    target: "es2022",
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, "index.html"),
        mentions: resolve(import.meta.dirname, "mentions-legales/index.html"),
      },
    },
  },
});
