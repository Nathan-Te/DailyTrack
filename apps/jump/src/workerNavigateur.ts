import filDuGenerateur from "virtual:jump-fil-generateur";
import type { WorkerLike } from "./dailyLoader";

/**
 * Le worker de module du jeu (lot 7b), créé à partir de l'adresse du fil construit avec la page (lot 21 : `vite.config.ts`, `filDuGenerateur`) ; null s'il
 * n'existe pas dans ce navigateur. Fichier à part de `dailyLoader.ts` : l'adresse est un module virtuel de la construction, que les tests ne connaissent pas.
 */
export function browserWorker(): WorkerLike | null {
  if (typeof Worker === "undefined") return null;
  return new Worker(filDuGenerateur, { type: "module" }) as unknown as WorkerLike;
}
