import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { formatDay, parseDay } from "@cdj/core";
import { figerJour, lireJourFige } from "../src/index";

// `npm run figer:vertige -w @cdj/vertige-sim -- --du AAAA-MM-JJ --au AAAA-MM-JJ [--dossier=<chemin>]` : écrit `apps/vertige/public/jours/AAAA-MM-JJ.json`. **Un fichier déjà écrit n'est jamais réécrit** (un jour
// figé ne change plus) ; un fichier qui ne se relit plus est signalé et l'outil s'arrête en erreur. Ne lance aucun workflow, ne lit aucune base. « Mettre en production » (chaîne de la fiche) ne l'appelle
// que pour un jeu qui va en production — un jeu témoin n'y va jamais ; il sert en local et à la recette.
const arg = (nom: string): string | undefined => process.argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3) ?? process.argv[process.argv.indexOf(`--${nom}`) + 1];
const du = parseDay(arg("du") ?? "");
const au = parseDay(arg("au") ?? "");
if (du === null || au === null || au < du) {
  console.error("usage : figer:vertige -- --du AAAA-MM-JJ --au AAAA-MM-JJ [--dossier=<chemin>]");
  process.exit(2);
}
const dossier = arg("dossier") ?? join(dirname(new URL(import.meta.url).pathname), "../../../apps/vertige/public/jours");
mkdirSync(dossier, { recursive: true });
let ecrits = 0;
for (let j = du; j <= au; j++) {
  const f = join(dossier, `${formatDay(j)}.json`);
  if (existsSync(f)) {
    if (!lireJourFige(JSON.parse(readFileSync(f, "utf8")))) {
      console.error(`${f} : ne se relit plus`);
      process.exit(1);
    }
    continue;
  }
  writeFileSync(f, JSON.stringify(figerJour(j), null, 2) + "\n");
  ecrits++;
}
console.log(`${ecrits} jour(s) figé(s) dans ${dossier}`);
