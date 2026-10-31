// Lot T2 — fige des jours de Tower : écrit `apps/tower/public/jours/AAAA-MM-JJ.json` pour chaque date de `--du` à `--au` (comprises). Ne lance aucun workflow et ne lit aucune
// base : il ne regarde que le générateur de ce code. **Un fichier déjà écrit n'est jamais réécrit** (un jour figé ne change plus) : s'il ne se relit plus, ou s'il n'est plus ce
// que sa version `g` génère, l'outil le signale et s'arrête en erreur sans y toucher. La mise en production (lot de plateforme, T4) décidera quels jours figer, avec le code alors en production.
//   npm run figer:tower -w @cdj/tower-sim -- --du 2026-11-02 --au 2026-11-04 [--dossier=<chemin>]      (--dossier : ailleurs que dans apps/tower/public/jours, pour essayer)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatDay, parseDay } from "@cdj/core";
import { dailyTower, empreinteContenu, figerJour, jsonJourFige, lireJourFige, TOWER_GENERATOR_VERSION, TOWER_SIM_VERSION } from "../src";

const args = process.argv.slice(2);
const valeur = (nom: string): string | undefined => {
  const i = args.findIndex((a) => a === `--${nom}` || a.startsWith(`--${nom}=`));
  if (i < 0) return undefined;
  return args[i]!.includes("=") ? args[i]!.slice(nom.length + 3) : args[i + 1];
};
const du = parseDay(valeur("du") ?? "");
const au = parseDay(valeur("au") ?? "");
if (du === null || au === null || au < du) {
  console.error("Usage : npm run figer:tower -w @cdj/tower-sim -- --du AAAA-MM-JJ --au AAAA-MM-JJ [--dossier=<chemin>]");
  process.exit(2);
}
// `npm run -w @cdj/tower-sim` lance le script depuis packages/tower-sim.
const dossier = resolve(valeur("dossier") ?? new URL("../../../apps/tower/public/jours", import.meta.url).pathname);
mkdirSync(dossier, { recursive: true });
console.log(`Jours figés dans ${dossier} (sim v${TOWER_SIM_VERSION}, générateur g${TOWER_GENERATOR_VERSION}), du ${formatDay(du)} au ${formatDay(au)}.`);

let ecrits = 0;
let gardes = 0;
const casses: string[] = [];
for (let jour = du; jour <= au; jour++) {
  const date = formatDay(jour);
  const fichier = `${dossier}/${date}.json`;
  if (existsSync(fichier)) {
    const relu = lireJourFige(JSON.parse(readFileSync(fichier, "utf8")) as unknown, jour);
    if (typeof relu === "string") casses.push(`${date} : ${relu}`);
    else if (empreinteContenu(relu) !== empreinteContenu(dailyTower(jour, relu.g, relu.tirage ?? 0))) casses.push(`${date} : ne se régénère pas à l'identique avec g${relu.g}`);
    else gardes++;
    continue;
  }
  const f = figerJour(jour);
  const texte = jsonJourFige(f);
  const relu = lireJourFige(JSON.parse(texte) as unknown, jour);
  if (typeof relu === "string") throw new Error(`${date} : le fichier écrit ne se relit pas (${relu})`);
  writeFileSync(fichier, texte);
  ecrits++;
  console.log(`  ${date}  g${f.g}  ${f.contenu.pieces.length} pièces, plateforme ${f.contenu.plateformeDemi8 / 4} m, ${texte.length} octets`);
}
console.log(`${ecrits} écrit(s), ${gardes} déjà figé(s) et relu(s).`);
if (casses.length > 0) {
  console.error(`${casses.length} fichier(s) figé(s) à examiner (gardés tels quels) :\n  ${casses.join("\n  ")}`);
  process.exit(1);
}
