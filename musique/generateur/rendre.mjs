// `npm run musique:generer [-- id…]` : rend les boucles générées dans `musique/pistes/<id>.wav` (les sources ne sont pas dans le dépôt : `npm run musique` les convertit, puis seul le
// fichier préparé est commité). Déterministe : le même code donne les mêmes fichiers. `--court` : quatre mesures seulement (essais).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { MORCEAUX } from "./morceaux.mjs";
import { rendre, versWav } from "./moteur.mjs";

const racine = join(dirname(fileURLToPath(import.meta.url)), "..", "pistes");
const args = process.argv.slice(2);
const court = args.includes("--court");
const voulus = args.filter((a) => !a.startsWith("--"));
const ids = voulus.length > 0 ? voulus : Object.keys(MORCEAUX);
mkdirSync(racine, { recursive: true });
for (const id of ids) {
  const piece = MORCEAUX[id];
  if (!piece) {
    console.error(`morceau inconnu : « ${id} » (connus : ${Object.keys(MORCEAUX).join(", ")})`);
    process.exit(1);
  }
  const debut = Date.now();
  const sortie = rendre(piece, court ? { barres: 4 } : {});
  writeFileSync(join(racine, `${id}.wav`), versWav(sortie));
  console.log(`${id} : ${(sortie.n / 44100).toFixed(1)} s, ${piece.bpm} BPM, rendu en ${((Date.now() - debut) / 1000).toFixed(1)} s → musique/pistes/${id}.wav`);
}
