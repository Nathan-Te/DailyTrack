import { existsSync, readdirSync } from "node:fs";
import { defineConfig } from "vite";
import { CATALOGUE_COMMUN } from "../../packages/ui/src/catalogue";
import { musiqueServie } from "../../packages/musique/outils/vite";
import { pagesDuSocle } from "../../packages/ui/outils/vite";
import { CATALOGUE_FR } from "./src/catalogue.fr";

// « Gravity » (lot K4f), le jeu témoin du kit. Chemins relatifs, comme les autres jeux. Les jours figés publiés avec le jeu (`public/jours/AAAA-MM-JJ.json`, écrits par `npm run figer:gravity -w @cdj/gravity-sim`) :
// leur liste est écrite dans le JavaScript, pour qu'une date qui n'est pas figée ne fasse aucune requête (`kit/jour`). Le titre de la page et la couleur de l'onglet sont posés dans le HTML à la construction.
const dossierJours = new URL("./public/jours/", import.meta.url).pathname;
const joursFiges = existsSync(dossierJours) ? readdirSync(dossierJours).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f)).map((f) => f.slice(0, 10)).sort() : [];

export default defineConfig({
  base: "./",
  define: { __JOURS_FIGES__: JSON.stringify(joursFiges) },
  plugins: [musiqueServie(), pagesDuSocle({ catalogue: { ...CATALOGUE_COMMUN.fr, ...CATALOGUE_FR } })],
  build: {
    target: "es2022",
    modulePreload: { polyfill: false },
    rollupOptions: { input: { main: "index.html", verify: "verify.html" } },
  },
});
