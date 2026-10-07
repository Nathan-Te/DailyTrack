import { defineConfig } from "vite";

export default defineConfig({
  // Chemins relatifs : fonctionne à la racine (Cloudflare Pages) comme sous /DailyTrack/ (GitHub Pages).
  base: "./",
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
