import { availableParallelism } from "node:os";
import { isMainThread, parentPort, Worker } from "node:worker_threads";

// Un petit réservoir de fils pour les outils de Pinball (le robot met quelques secondes par table : on en joue plusieurs à la fois, un travail par fil). Le fil est le fichier de l'outil lui-même (`import.meta.url`) :
// l'outil écrit `if (!enFil) main() else repondre(travail)`. **Aucune graine ne dépend du fil ni de l'ordre** : le résultat d'un travail est toujours le même (le robot et la validation sont déterministes).
export const enFil = !isMainThread;

/** Dans un fil : répond à chaque travail reçu par son résultat, puis s'arrête sur `null`. */
export function repondre<I, O>(travail: (entree: I) => O): void {
  parentPort!.on("message", (m: I | null) => {
    if (m === null) process.exit(0);
    parentPort!.postMessage({ r: travail(m) });
  });
  parentPort!.postMessage("pret");
}

/** Joue chaque travail dans un fil (au plus `fils`, par défaut un par cœur) ; `sortie` reçoit chaque résultat quand il arrive. Les résultats reviennent aussi dans l'ordre des travaux. */
export async function enParallele<I, O>(entree: URL, travaux: readonly I[], sortie: (r: O, i: number) => void, fils = availableParallelism()): Promise<O[]> {
  const resultats: O[] = Array<O>(travaux.length);
  let suivant = 0;
  let actifs = 0;
  const n = Math.max(1, Math.min(fils, travaux.length));
  await new Promise<void>((fin, echec) => {
    if (travaux.length === 0) return fin();
    for (let k = 0; k < n; k++) {
      const w = new Worker(entree);
      actifs++;
      let courant = -1;
      const donner = (): void => {
        if (suivant >= travaux.length) {
          w.postMessage(null);
          if (--actifs === 0) fin();
          return;
        }
        courant = suivant++;
        w.postMessage(travaux[courant]);
      };
      w.on("message", (m: "pret" | { r: O }) => {
        if (m !== "pret") {
          resultats[courant] = m.r;
          sortie(m.r, courant);
        }
        donner();
      });
      w.on("error", echec);
    }
  });
  return resultats;
}
