import { defineConfig } from "vite";
import { CATALOGUE_COMMUN } from "../../packages/ui/src/catalogue";
import { pagesDuSocle } from "../../packages/ui/outils/vite";
import { CATALOGUE_FR } from "./src/catalogue.fr";
import { rapierWasmServi } from "./rapierWasm";

// Lot T0 : la page de démonstration de la physique (`/tower/?scenario=banc`) et la page de vérification (`/tower/verify.html`, sans rendu). Lot T1 : la page d'entrée est le jeu
// (`/tower/?scenario=essai`). Chemins relatifs, comme les deux jeux. Rapier (~3,4 Mo de JavaScript avec son WebAssembly en base64 dans le paquet `-compat`) est chargé À LA DEMANDE
// (`import()`), jamais dans le premier chargement ; **à la construction, son `.wasm` est servi comme un fichier** (`rapierWasm.ts`, le même binaire que Node).
export default defineConfig({
  base: "./",
  // Le titre de la page et la couleur de l'onglet sont posés dans le HTML à la construction (texte du catalogue français, jeton `tower-coque`) : `pagesDuSocle` de `@cdj/ui`.
  plugins: [rapierWasmServi(), pagesDuSocle({ catalogue: { ...CATALOGUE_COMMUN.fr, ...CATALOGUE_FR } })],
  build: {
    target: "es2022",
    rollupOptions: { input: { main: "index.html", verify: "verify.html" } },
    chunkSizeWarningLimit: 4000,
  },
});
