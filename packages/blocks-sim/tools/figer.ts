import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { formatDay, parseDay } from "@cdj/core";
import { lireJourFige } from "../src/index";
import { figerJourDuDiamant } from "../src/diamant";

// `npm run figer:blocks -w @cdj/blocks-sim -- --du AAAA-MM-JJ --au AAAA-MM-JJ [--dossier=<chemin>]` : écrit `apps/blocks/public/jours/AAAA-MM-JJ.json` (la suite **et les seuils des médailles**, que le bot de ce code calcule : un jour figé fige ses seuils). **Un fichier déjà écrit n'est jamais réécrit** (un jour
// figé ne change plus) ; un fichier qui ne se relit plus est signalé et l'outil s'arrête en erreur. Ne lance aucun workflow, ne lit aucune base. « Mettre en production » (chaîne de la fiche) ne l'appelle
// que pour un jeu qui va en production — un jeu témoin n'y va jamais ; il sert en local et à la recette.
const arg = (nom: string): string | undefined => process.argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3) ?? process.argv[process.argv.indexOf(`--${nom}`) + 1];
const du = parseDay(arg("du") ?? "");
const au = parseDay(arg("au") ?? "");
if (du === null || au === null || au < du) {
  console.error("usage : figer:blocks -- --du AAAA-MM-JJ --au AAAA-MM-JJ [--dossier=<chemin>]");
  process.exit(2);
}
const dossier = arg("dossier") ?? join(dirname(new URL(import.meta.url).pathname), "../../../apps/blocks/public/jours");
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
  writeFileSync(f, JSON.stringify(figerJourDuDiamant(j), null, 2) + "\n");
  ecrits++;
}
console.log(`${ecrits} jour(s) figé(s) dans ${dossier}`);
