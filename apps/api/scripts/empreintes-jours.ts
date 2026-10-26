import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { formatDay, parseDay } from "@cdj/core";
import { empreinteJump, empreinteTrack, type EmpreinteJour } from "./empreintes";

// Lot R6 : les empreintes des jours d'une construction, pour le garde-fou de « Mettre en production » (et sa répétition).
//
//   npm run jours:empreintes -w @cdj/api -- --du 2026-10-26 --au 2026-11-10 --niveaux ../jump/public/levels --sortie /tmp/prod.json
//
// Lancé deux fois par le workflow : dans le dépôt du code actuellement en production (ce script y est copié, avec `empreintes.ts`) et dans celui du commit à déployer ;
// `scripts/mise-en-production.mjs comparer` compare les deux. Rien n'est lu en base ni écrit ailleurs que le fichier de sortie. `--jeux track,jump` en choisit un.

const args = process.argv.slice(2);
const val = (nom: string): string | undefined => (args.includes(nom) ? args[args.indexOf(nom) + 1] : undefined);
const du = parseDay(val("--du") ?? "");
const au = parseDay(val("--au") ?? "");
const sortie = val("--sortie");
if (du === null || au === null || au < du || !sortie) {
  console.error("Usage : npm run jours:empreintes -w @cdj/api -- --du AAAA-MM-JJ --au AAAA-MM-JJ --sortie <fichier.json> [--niveaux <dossier des niveaux figés de Jump>] [--jeux track,jump]");
  process.exit(2);
}
const jeux = (val("--jeux") ?? "track,jump").split(",");
// `npm run -w` lance le script depuis apps/api : les niveaux figés sont ceux du dépôt, à côté.
const niveaux = resolve(val("--niveaux") ?? "../jump/public/levels");

const out: { version: number; du: string; au: string; track: Record<string, EmpreinteJour>; jump: Record<string, EmpreinteJour> } = {
  version: 1,
  du: formatDay(du),
  au: formatDay(au),
  track: {},
  jump: {},
};
const debut = Date.now();
for (let day = du; day <= au; day++) {
  const date = formatDay(day);
  if (jeux.includes("track")) out.track[date] = empreinteTrack(day);
  if (jeux.includes("jump")) out.jump[date] = empreinteJump(day, niveaux);
}
mkdirSync(dirname(resolve(sortie)), { recursive: true });
writeFileSync(resolve(sortie), JSON.stringify(out, null, 1) + "\n");
const invalides = Object.entries({ ...Object.fromEntries(Object.entries(out.track).map(([d, e]) => [`track ${d}`, e])), ...Object.fromEntries(Object.entries(out.jump).map(([d, e]) => [`jump ${d}`, e])) }).filter(([, e]) => !e.ok);
console.log(`Empreintes ${formatDay(du)} → ${formatDay(au)} (${jeux.join(", ")}) : ${au - du + 1} jour(s) en ${((Date.now() - debut) / 1000).toFixed(1)} s${invalides.length ? `, NON VALIDES : ${invalides.map(([k]) => k).join(", ")}` : ""} → ${sortie}`);
