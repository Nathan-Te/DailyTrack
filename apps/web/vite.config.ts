import { defineConfig } from "vite";

export default defineConfig({
  // Chemins relatifs : fonctionne à la racine (Cloudflare Pages) comme sous /DailyTrack/ (GitHub Pages).
  base: "./",
  build: {
    target: "es2022",
    // Deux pages : le jeu, et `verify.html` (rejeu de rediffusion sans rendu, pour les tests de navigateur).
    rollupOptions: { input: { main: "index.html", verify: "verify.html" } },
  },
});
