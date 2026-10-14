import { defineConfig } from "vite";

export default defineConfig({
  // Chemins relatifs, comme DailyTrack : le jeu est publié sous `<site>/jump/` (GitHub Pages : `/DailyTrack/jump/` et, pour une branche,
  // `/DailyTrack/b/<branche>/jump/`) ; une base absolue `/jump/` casserait les aperçus de branche.
  base: "./",
  build: {
    target: "es2022",
    rollupOptions: {
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
