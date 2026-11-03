import { mkdirSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { formatDay, parseDay } from "@cdj/core";
import type { EmpreinteJour } from "./empreintes";

// Lot R6 : les empreintes des jours d'une construction, pour le garde-fou de « Mettre en production » (et sa répétition). Lot K4b : le pilote est le même pour tous les jeux ; la fonction de chaque
// jeu (`empreinteJour` de `<id>-empreintes.ts`) lui est donnée par une entrée que `scripts/mise-en-production.mjs empreintes` écrit puis compile (`executer(empreinteJour, "<id>")`).
//
//   node dist/empreintes-<id>.mjs --du 2026-10-26 --au 2026-11-10 --jours <dossier des fichiers du jeu> --sortie /tmp/prod.json
//
// Lancé deux fois par le workflow, pour chaque jeu : dans le dépôt du code actuellement en production (ces scripts y sont copiés) et dans celui du commit à déployer ; `comparer` compare les deux.
// Rien n'est lu en base ni écrit ailleurs que le fichier de sortie, **auquel la clé du jeu est ajoutée** (`{ version, du, au, <id>: { AAAA-MM-JJ: empreinte } }`).

export function executer(empreinteJour: (jour: number, dossier: string | null) => EmpreinteJour, jeu: string, argv: string[] = process.argv.slice(2)): void {
  const val = (nom: string): string | undefined => (argv.includes(nom) ? argv[argv.indexOf(nom) + 1] : undefined);
  const du = parseDay(val("--du") ?? "");
  const au = parseDay(val("--au") ?? "");
  const sortie = val("--sortie");
  if (du === null || au === null || au < du || !sortie) {
    console.error("Usage : node dist/empreintes-<jeu>.mjs --du AAAA-MM-JJ --au AAAA-MM-JJ --sortie <fichier.json> [--jours <dossier des fichiers du jeu>]");
    process.exit(2);
  }
  const jours = val("--jours") ? resolve(val("--jours") as string) : null;
  const empreintes: Record<string, EmpreinteJour> = {};
  const debut = Date.now();
  for (let day = du; day <= au; day++) empreintes[formatDay(day)] = empreinteJour(day, jours);
  const chemin = resolve(sortie);
  const existant = existsSync(chemin) ? (JSON.parse(readFileSync(chemin, "utf8")) as Record<string, unknown>) : { version: 1, du: formatDay(du), au: formatDay(au) };
  mkdirSync(dirname(chemin), { recursive: true });
  writeFileSync(chemin, JSON.stringify({ ...existant, [jeu]: empreintes }, null, 1) + "\n");
  const invalides = Object.entries(empreintes).filter(([, e]) => !e.ok).map(([d]) => d);
  console.log(`Empreintes ${jeu} ${formatDay(du)} → ${formatDay(au)} : ${au - du + 1} jour(s) en ${((Date.now() - debut) / 1000).toFixed(1)} s${invalides.length ? `, NON VALIDES : ${invalides.join(", ")}` : ""} → ${sortie}`);
}
