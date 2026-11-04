// Lot D3 — le script du fil de calcul des niveaux (`worker_threads`), empaqueté à part (`esbuild src/niveauxFilTravail.ts` → `dist/niveaux-fil.mjs`, posé à côté de `server.mjs`) : il calcule le niveau de Jump ou
// le circuit de Track d'un jour pour que le fil principal, qui sert les joueurs, ne se bloque jamais pendant ce calcul. Protocole de `jeux/fil.ts` : il reçoit `{ id, ...demande }`, répond `{ id, resultat }` ou `{ id, panne }`.
import { parentPort } from "node:worker_threads";
import { calculerNiveau, type DemandeNiveau } from "./niveauxFil";

if (!parentPort) throw new Error("niveauxFilTravail.ts se lance dans un fil de calcul (worker_threads)");
const port = parentPort;
port.on("message", (m: { id: number } & DemandeNiveau) => {
  try {
    const { id, ...demande } = m;
    port.postMessage({ id, resultat: calculerNiveau(demande as DemandeNiveau) });
  } catch {
    port.postMessage({ id: m.id, panne: true });
  }
});
