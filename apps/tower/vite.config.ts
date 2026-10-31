import { existsSync, readdirSync } from "node:fs";
import { defineConfig } from "vite";
import { CATALOGUE_COMMUN } from "../../packages/ui/src/catalogue";
import { pagesDuSocle } from "../../packages/ui/outils/vite";
import { CATALOGUE_FR } from "./src/catalogue.fr";
import { sansPreuveEnProduction } from "./preuves";
import { rapierWasmServi } from "./rapierWasm";

// Lot T0 : la page de démonstration de la physique (`/tower/?scenario=banc`) et la page de vérification (`/tower/verify.html`, sans rendu). Lot T1 : la page d'entrée est le jeu
// (`/tower/?scenario=essai`). Chemins relatifs, comme les deux jeux. Rapier (~3,4 Mo de JavaScript avec son WebAssembly en base64 dans le paquet `-compat`) est chargé À LA DEMANDE
// (`import()`), jamais dans le premier chargement ; **à la construction, son `.wasm` est servi comme un fichier** (`rapierWasm.ts`, le même binaire que Node).
// Lot T2 : les jours figés publiés avec le jeu (`public/jours/AAAA-MM-JJ.json`, écrits par `npm run figer:tower -w @cdj/tower-sim`) : leur liste est écrite dans le JavaScript, pour qu'une
// date qui n'est pas figée ne fasse aucune requête (`src/jour.ts`).
const dossierJours = new URL("./public/jours/", import.meta.url).pathname;
const joursFiges = existsSync(dossierJours) ? readdirSync(dossierJours).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 10)).sort() : [];

export default defineConfig({
  base: "./",
  define: { __JOURS_FIGES__: JSON.stringify(joursFiges) },
  // Le titre de la page et la couleur de l'onglet sont posés dans le HTML à la construction (texte du catalogue français, jeton `tower-coque`) : `pagesDuSocle` de `@cdj/ui`.
  plugins: [rapierWasmServi(), sansPreuveEnProduction(), pagesDuSocle({ catalogue: { ...CATALOGUE_COMMUN.fr, ...CATALOGUE_FR } })],
  // Lot T3 : le Web Worker du bot (hors production seulement) a sa propre construction : il lit Rapier lui aussi, `.wasm` servi comme un fichier.
  worker: { format: "es", plugins: () => [rapierWasmServi()] },
  build: {
    target: "es2022",
    rollupOptions: { input: { main: "index.html", verify: "verify.html" } },
    chunkSizeWarningLimit: 4000,
  },
});
