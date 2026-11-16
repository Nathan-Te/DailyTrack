import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { formatDay, parseDay } from "@cdj/core";
import { PINBALL_GENERATOR_VERSION, PINBALL_SIM_VERSION, figerJour, lireJourFige } from "../src/index";
import { enFil, enParallele, repondre } from "./fils";

// `npm run preparer:pinball -w @cdj/pinball-sim -- --du AAAA-MM-JJ --au AAAA-MM-JJ [--dossier=<chemin>] [--forcer] [--fils=N]` (lot PB4, `jours.fabrication.preparer` de la fiche) : **prépare à l'avance les jours à
// venir avec leurs seuils** — le robot joue la table de chaque jour (≈ 4 secondes, un jour par fil) et le fichier `AAAA-MM-JJ.json` porte la table et les seuils (`figerJour`). Ainsi aucun navigateur ni serveur ne
// calcule le robot pour un jour servi en production. **Un fichier existant n'est réécrit que par `--forcer`** ; un fichier d'une autre version du générateur ou de la simulation est TOUJOURS refusé (un jour servi sous
// une autre version ne se recalcule pas : la chaîne de production supprime d'abord le fichier d'une autre version, `planPreparation`) ; un fichier qui ne se relit plus est signalé. Ne lance aucun workflow, ne lit aucune base.
const texteDuJour = (jour: number): string => JSON.stringify(figerJour(jour), null, 2) + "\n";

if (enFil) repondre(texteDuJour);
else {
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
    console.error("Usage : npm run preparer:pinball -w @cdj/pinball-sim -- --du AAAA-MM-JJ --au AAAA-MM-JJ [--dossier=<chemin>] [--forcer] [--fils=N]");
    process.exit(2);
  }
  // `npm run -w @cdj/pinball-sim` lance le script depuis packages/pinball-sim.
  const dossier = resolve(valeur("dossier") ?? join(dirname(new URL(import.meta.url).pathname), "../../../apps/pinball/public/jours"));
  mkdirSync(dossier, { recursive: true });
  console.log(`Jours préparés dans ${dossier} (sim v${PINBALL_SIM_VERSION}, générateur g${PINBALL_GENERATOR_VERSION}), du ${formatDay(du)} au ${formatDay(au)}.`);
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
    if (json.g !== PINBALL_GENERATOR_VERSION || json.sim !== PINBALL_SIM_VERSION) casses.push(`${formatDay(j)} : fichier en g${String(json.g)} / sim ${String(json.sim)}, ce code est en g${PINBALL_GENERATOR_VERSION} / sim ${PINBALL_SIM_VERSION} — refusé, même avec --forcer`);
    else if (forcer) aFaire.push(j);
    else if (lireJourFige(json) === null) casses.push(`${formatDay(j)} : le fichier ne se relit plus (table ou seuils)`);
    else gardes++;
  }
  const t0 = performance.now();
  const fils = valeur("fils") ? Number(valeur("fils")) : undefined;
  const textes = await enParallele<number, string>(new URL(import.meta.url), aFaire, () => undefined, fils);
  aFaire.forEach((j, i) => writeFileSync(join(dossier, `${formatDay(j)}.json`), textes[i]!));
  console.log(`${aFaire.length} écrit(s) en ${((performance.now() - t0) / 1000).toFixed(0)} s, ${gardes} déjà préparé(s) et vérifié(s).`);
  if (casses.length > 0) {
    console.error(`${casses.length} fichier(s) à examiner (gardés tels quels) :\n  ${casses.join("\n  ")}`);
    process.exit(1);
  }
  process.exit(0);
}
