import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { formatDay, parseDay } from "@cdj/core";
import { figerJour, lireJourFige } from "../src/index";
import { enFil, enParallele, repondre } from "./fils";

// `npm run figer:pinball -w @cdj/pinball-sim -- --du AAAA-MM-JJ --au AAAA-MM-JJ [--dossier=<chemin>] [--fils=N]` : écrit `apps/pinball/public/jours/AAAA-MM-JJ.json`. **Un fichier déjà écrit n'est jamais réécrit** (un jour
// figé ne change plus) ; un fichier qui ne se relit plus est signalé et l'outil s'arrête en erreur. **Lot PB4 : le fichier porte les seuils du robot** (`seuils.ts`) : le robot joue la table (≈ 4 secondes), un jour par fil.
// Ne lance aucun workflow, ne lit aucune base. « Mettre en production » (chaîne de la fiche) ne l'appelle que pour un jeu qui va en production — un jeu témoin n'y va jamais ; il sert en local et à la recette.
const texteDuJour = (jour: number): string => JSON.stringify(figerJour(jour), null, 2) + "\n";

if (enFil) repondre(texteDuJour);
else {
  const arg = (nom: string): string | undefined => process.argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3) ?? process.argv[process.argv.indexOf(`--${nom}`) + 1];
  const du = parseDay(arg("du") ?? "");
  const au = parseDay(arg("au") ?? "");
  if (du === null || au === null || au < du) {
    console.error("usage : figer:pinball -- --du AAAA-MM-JJ --au AAAA-MM-JJ [--dossier=<chemin>] [--fils=N]");
    process.exit(2);
  }
  const dossier = arg("dossier") ?? join(dirname(new URL(import.meta.url).pathname), "../../../apps/pinball/public/jours");
  mkdirSync(dossier, { recursive: true });
  const aFaire: number[] = [];
  for (let j = du; j <= au; j++) {
    const f = join(dossier, `${formatDay(j)}.json`);
    if (existsSync(f)) {
      if (!lireJourFige(JSON.parse(readFileSync(f, "utf8")))) {
        console.error(`${f} : ne se relit plus`);
        process.exit(1);
      }
    } else aFaire.push(j);
  }
  const fils = process.argv.some((a) => a.startsWith("--fils=")) ? Number(arg("fils")) : undefined;
  await enParallele<number, string>(new URL(import.meta.url), aFaire, () => undefined, fils).then((textes) => aFaire.forEach((j, i) => writeFileSync(join(dossier, `${formatDay(j)}.json`), textes[i]!)));
  console.log(`${aFaire.length} jour(s) figé(s) dans ${dossier}`);
  process.exit(0);
}
