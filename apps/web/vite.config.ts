import { defineConfig } from "vite";

export default defineConfig({
  // Chemins relatifs : fonctionne à la racine (Cloudflare Pages) comme sous /DailyTrack/ (GitHub Pages).
  base: "./",
  build: { target: "es2022" },
});
