import { defineConfig } from "vite";
import { CATALOGUE_COMMUN } from "../../packages/ui/src/catalogue";
import { musiqueServie } from "../../packages/musique/outils/vite";
import { pagesDuSocle } from "../../packages/ui/outils/vite";
import { CATALOGUE_FR } from "./src/catalogue.fr";

// « Pile poil » (lot K4f), le jeu témoin du kit. Chemins relatifs, comme les autres jeux. Les jours figés publiés avec le jeu (`public/jours/AAAA-MM-JJ.json`, écrits par `npm run figer:pilepoil -w @cdj/pilepoil-sim`) :
// leur liste est écrite dans le JavaScript, pour qu'une date qui n'est pas figée ne fasse aucune requête (`kit/jour`). Le titre de la page et la couleur de l'onglet sont posés dans le HTML à la construction.

export default defineConfig({
  base: "./",
  plugins: [musiqueServie(), pagesDuSocle({ catalogue: { ...CATALOGUE_COMMUN.fr, ...CATALOGUE_FR } })],
  build: {
    target: "es2022",
    modulePreload: { polyfill: false },
    rollupOptions: { input: { main: "index.html", verify: "verify.html" } },
  },
});
