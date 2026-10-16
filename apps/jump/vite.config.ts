import { readdirSync } from "node:fs";
import { defineConfig } from "vite";

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
