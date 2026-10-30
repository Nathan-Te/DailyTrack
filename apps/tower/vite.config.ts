import { defineConfig } from "vite";

// Lot T0 : la page de démonstration de la physique (`/tower/`) et la page de vérification (`/tower/verify.html`, sans rendu). Chemins relatifs, comme les deux jeux.
// Le moteur B (Rapier, ~3,4 Mo de JavaScript avec son WebAssembly en base64) est chargé À LA DEMANDE (`import()` dans src/moteurs.ts) : la page du moteur A ne le télécharge pas.
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    rollupOptions: { input: { main: "index.html", verify: "verify.html" } },
    chunkSizeWarningLimit: 4000,
  },
});
