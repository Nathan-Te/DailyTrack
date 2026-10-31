// Lot T3 — prépare des jours de Tower : pour chaque date de `--du` à `--au` (comprises), `dailyTower`, le bot de l'auteur et les médailles, écrits dans
// `apps/tower/public/jours/AAAA-MM-JJ.json` (le format du lot T2 avec `medailles` et `preuve`). Un `worker_threads` par cœur, un jour par fil : les jours sont indépendants.
//   npm run preparer:tower -w @cdj/tower-sim -- --du 2026-11-02 --au 2026-11-04 [--dossier=<chemin>] [--forcer] [--fils=N]
// Ne lance aucun workflow et ne lit aucune base. **Un fichier existant n'est réécrit que par `--forcer`**, et un fichier dont la version `g` n'est pas celle du code est TOUJOURS refusé
// (un jour dont le contenu a été servi sous une autre version ne se recalcule pas) ; un fichier qui ne se relit plus ou dont la preuve ne redonne plus son Diamant est signalé. Le
// branchement à « Mettre en production » (quels jours, avec quel code) est un lot de la plateforme (T4).
import { availableParallelism } from "node:os";
import { resolve } from "node:path";
import { isMainThread, parentPort, Worker } from "node:worker_threads";
import { formatDay, parseDay } from "@cdj/core";
import { jsonJourFige, TOWER_GENERATOR_VERSION, TOWER_SIM_VERSION } from "../src";
import { preparerJour } from "../src/bot";
import { chargerRapier } from "../src/rapier";
import { ecrire, planifier } from "./plan";

interface Resultat {
  jour: number;
  texte: string;
  hauteurMm: number;
  banque: number;
  secondes: number;
}

if (!isMainThread) {
  // Un fil de calcul : il reçoit un numéro de jour, rend le fichier prêt à écrire.
  const R = await chargerRapier();
  parentPort!.on("message", (jour: number | null) => {
    if (jour === null) process.exit(0);
    const t0 = performance.now();
    const p = preparerJour(R, jour);
    const r: Resultat = { jour, texte: jsonJourFige(p.fichier), hauteurMm: p.hauteurMm, banque: p.banque, secondes: (performance.now() - t0) / 1000 };
    parentPort!.postMessage(r);
  });
  parentPort!.postMessage("pret");
} else {
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
    console.error("Usage : npm run preparer:tower -w @cdj/tower-sim -- --du AAAA-MM-JJ --au AAAA-MM-JJ [--dossier=<chemin>] [--forcer] [--fils=N]");
    process.exit(2);
  }
  // `npm run -w @cdj/tower-sim` lance le script depuis packages/tower-sim.
  const dossier = resolve(valeur("dossier") ?? new URL("../../../apps/tower/public/jours", import.meta.url).pathname);
  const R = await chargerRapier();
  console.log(`Jours préparés dans ${dossier} (sim v${TOWER_SIM_VERSION}, générateur g${TOWER_GENERATOR_VERSION}), du ${formatDay(du)} au ${formatDay(au)}.`);

  const decisions = planifier(R, dossier, du, au, forcer);
  const aFaire = decisions.filter((d) => d.action === "calculer").map((d) => d.jour);
  const casses = decisions.filter((d) => d.action === "refuser").map((d) => `${d.date} : ${d.motif}`);
  const gardes = decisions.filter((d) => d.action === "garder").length;

  let ecrits = 0;
  if (aFaire.length > 0) {
    const fils = Math.max(1, Math.min(Number(valeur("fils") ?? availableParallelism()), aFaire.length));
    console.log(`${aFaire.length} jour(s) à calculer sur ${fils} fil(s).`);
    const file = [...aFaire];
    await new Promise<void>((fin, echec) => {
      let actifs = fils;
      for (let i = 0; i < fils; i++) {
        const w = new Worker(new URL(import.meta.url), { workerData: {} });
        const donner = (): void => {
          const jour = file.shift();
          if (jour === undefined) {
            w.postMessage(null);
            if (--actifs === 0) fin();
          } else w.postMessage(jour);
        };
        w.on("message", (m: Resultat | "pret") => {
          if (m !== "pret") {
            ecrire(dossier, m.jour, m.texte);
            ecrits++;
            console.log(`  ${formatDay(m.jour)}  Diamant ${(m.hauteurMm / 1000).toFixed(3)} m${m.banque > 0 ? ` (arrêté après ${m.banque} pièces)` : ""}, ${m.secondes.toFixed(0)} s, ${m.texte.length} octets`);
          }
          donner();
        });
        w.on("error", echec);
      }
    });
  }
  console.log(`${ecrits} écrit(s), ${gardes} déjà préparé(s) et vérifié(s).`);
  if (casses.length > 0) {
    console.error(`${casses.length} fichier(s) à examiner (gardés tels quels) :\n  ${casses.join("\n  ")}`);
    process.exit(1);
  }
  process.exit(0);
}
