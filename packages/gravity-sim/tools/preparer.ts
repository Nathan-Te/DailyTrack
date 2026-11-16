import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { formatDay, parseDay } from "@cdj/core";
import { ErreurDePreparation, GRAVITY_BOT_VERSION, GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION, lireJourFige, phraseDuDefaut, preparerJour } from "../src/index";

// `npm run preparer:gravity -w @cdj/gravity-sim -- --du AAAA-MM-JJ --au AAAA-MM-JJ [--dossier=<chemin>] [--forcer]` (lot GR5, `jours.fabrication.preparer` de la fiche) : **prépare à l'avance les jours à venir avec leurs
// seuils** — le robot joue chaque jour (≈ 2 à 3 s), prouve qu'un humain le franchit (2 280 m) puis écrit `AAAA-MM-JJ.json` (le contenu, ses versions et ses seuils : `figerJour`). Ainsi aucun navigateur ni serveur ne
// calcule le robot pour un jour servi en production. **Un jour infranchissable fait échouer la préparation** : la sortie dit le jour, le morceau et le motif, aucun fichier n'est écrit pour ce jour, le code de sortie est 1 ;
// on corrige le générateur (et on monte `GRAVITY_GENERATOR_VERSION`), jamais le robot. **Un fichier existant n'est réécrit que par `--forcer`** ; un fichier d'une autre version du générateur ou de la simulation est TOUJOURS
// refusé (un jour servi sous une autre version ne se recalcule pas : la chaîne de production supprime d'abord le fichier d'une autre version, `planPreparation`) ; un fichier qui ne se relit plus est signalé.
// Ne lance aucun workflow, ne lit aucune base.
const args = process.argv.slice(2);
const valeur = (nom: string): string | undefined => {
  const i = args.findIndex((a) => a === `--${nom}` || a.startsWith(`--${nom}=`));
  if (i < 0) return undefined;
  return args[i]!.includes("=") ? args[i]!.slice(nom.length + 3) : args[i + 1];
};
const du = parseDay(valeur("du") ?? "");
const au = parseDay(valeur("au") ?? "");
const forcer = args.includes("--forcer");
if (du === null || au === null || au < du) {
  console.error("Usage : npm run preparer:gravity -w @cdj/gravity-sim -- --du AAAA-MM-JJ --au AAAA-MM-JJ [--dossier=<chemin>] [--forcer]");
  process.exit(2);
}
// `npm run -w @cdj/gravity-sim` lance le script depuis packages/gravity-sim.
const dossier = resolve(valeur("dossier") ?? join(dirname(new URL(import.meta.url).pathname), "../../../apps/gravity/public/jours"));
mkdirSync(dossier, { recursive: true });
console.log(`Jours préparés dans ${dossier} (sim v${GRAVITY_SIM_VERSION}, générateur g${GRAVITY_GENERATOR_VERSION}, seuils v${GRAVITY_BOT_VERSION}), du ${formatDay(du)} au ${formatDay(au)}.`);
const aFaire: number[] = [];
const casses: string[] = [];
let gardes = 0;
for (let j = du; j <= au; j++) {
  const f = join(dossier, `${formatDay(j)}.json`);
  if (!existsSync(f)) {
    aFaire.push(j);
    continue;
  }
  let json: { g?: number; sim?: number };
  try {
    json = JSON.parse(readFileSync(f, "utf8")) as { g?: number; sim?: number };
  } catch {
    casses.push(`${formatDay(j)} : le fichier existant n'est pas du JSON`);
    continue;
  }
  if (json.g !== GRAVITY_GENERATOR_VERSION || json.sim !== GRAVITY_SIM_VERSION) casses.push(`${formatDay(j)} : fichier en g${String(json.g)} / sim ${String(json.sim)}, ce code est en g${GRAVITY_GENERATOR_VERSION} / sim ${GRAVITY_SIM_VERSION} — refusé, même avec --forcer`);
  else if (forcer) aFaire.push(j);
  else if (lireJourFige(json) === null) casses.push(`${formatDay(j)} : le fichier ne se relit plus (contenu ou seuils)`);
  else gardes++;
}
const t0 = performance.now();
let ecrits = 0;
const infranchissables: string[] = [];
for (const j of aFaire) {
  try {
    writeFileSync(join(dossier, `${formatDay(j)}.json`), JSON.stringify(preparerJour(j), null, 2) + "\n");
    ecrits++;
  } catch (e) {
    if (!(e instanceof ErreurDePreparation)) throw e;
    infranchissables.push(`${formatDay(j)} : ${e.verdict.defauts.map(phraseDuDefaut).join(" ; ")}`);
  }
}
console.log(`${ecrits} écrit(s) en ${((performance.now() - t0) / 1000).toFixed(0)} s, ${gardes} déjà préparé(s) et vérifié(s).`);
if (infranchissables.length > 0) console.error(`${infranchissables.length} jour(s) INFRANCHISSABLE(S) avec les contraintes d'humain (aucun fichier écrit ; on corrige le générateur et on monte GRAVITY_GENERATOR_VERSION, jamais le robot) :\n  ${infranchissables.join("\n  ")}`);
if (casses.length > 0) console.error(`${casses.length} fichier(s) à examiner (gardés tels quels) :\n  ${casses.join("\n  ")}`);
process.exit(infranchissables.length > 0 || casses.length > 0 ? 1 : 0);
