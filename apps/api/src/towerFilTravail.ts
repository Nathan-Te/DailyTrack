// Lot T4 — le script du fil de calcul de Tower (`worker_threads`). Il est empaqueté À PART (`esbuild src/towerFilTravail.ts` → `dist/tower-fil.mjs`) : l'image du serveur ne contient qu'un seul
// fichier, et l'emballage de celui-ci est au cahier des charges de la plateforme (docs/tower/lots/lot-T4-serveur-accueil.md). Le test `towerFil.test.ts` l'empaquette pour prouver le chemin.
// Protocole : le fil principal envoie `{ id, contenu, rediffusion }`, le fil répond `{ id, resultat }` ou `{ id, refus }` (le code d'une `ErreurRediffusion`) ou `{ id, panne }`.
import { parentPort } from "node:worker_threads";
import { ErreurRediffusion, rejouer } from "@cdj/tower-sim";
import { chargerRapier } from "@cdj/tower-sim/rapier";

if (!parentPort) throw new Error("towerFilTravail.ts se lance dans un fil de calcul (worker_threads)");
const port = parentPort;
port.on("message", async (m: { id: number; contenu: Parameters<typeof rejouer>[1]; rediffusion: string }) => {
  try {
    const R = await chargerRapier();
    port.postMessage({ id: m.id, resultat: rejouer(R, m.contenu, m.rediffusion) });
  } catch (e) {
    if (e instanceof ErreurRediffusion) port.postMessage({ id: m.id, refus: e.code });
    else port.postMessage({ id: m.id, panne: true });
  }
});
