import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { SIM_VERSION, formatDay, generatorVersionOf, parseDay } from "@cdj/sim";

// Lot R11 : la version du générateur et de la simulation que ce code SERT pour chaque jour, de `--du` à `--au`. Lancé par « Mettre en production » dans le dépôt du code
// actuellement en production (ce script y est copié, comme `empreintes-jours.ts`) : c'est ce qu'il faut écrire dans le registre des jours de Track
// (`packages/sim/src/jours-track.json`), jusqu'à la veille du jour de bascule. Il ne dépend que de `@cdj/sim` : il marche aussi avec un code d'avant le registre, où
// `generatorVersionOf` choisissait la version par une date (lots 34, 48 et 49). Aucun circuit n'est généré (quelques microsecondes par jour).
//
//   npm run jours:registre -w @cdj/api -- --du 2026-09-01 --au 2026-10-27 --sortie /tmp/registre-prod.json
//
// Sortie : `{ "format": 1, "jours": { "AAAA-MM-JJ": [génération, simulation], … } }` (`scripts/mise-en-production.mjs registre` la met en plages).

const args = process.argv.slice(2);
const val = (nom: string): string | undefined => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined);
const du = parseDay(val("--du") ?? "");
const au = parseDay(val("--au") ?? "");
const sortie = val("--sortie");
if (du === null || au === null || au < du || !sortie) {
  console.error("Usage : npm run jours:registre -w @cdj/api -- --du AAAA-MM-JJ --au AAAA-MM-JJ --sortie <fichier.json>");
  process.exit(2);
}
const jours: Record<string, [number, number]> = {};
for (let day = du; day <= au; day++) jours[formatDay(day)] = [generatorVersionOf(day), SIM_VERSION];
mkdirSync(dirname(resolve(sortie)), { recursive: true });
writeFileSync(resolve(sortie), JSON.stringify({ format: 1, jours }) + "\n");
console.log(`Registre ${formatDay(du)} → ${formatDay(au)} : ${au - du + 1} jour(s), versions ${[...new Set(Object.values(jours).map(([g]) => `v${g}`))].join(", ")} → ${sortie}`);
