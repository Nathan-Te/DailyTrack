import "./frozen";
import { dailyLevel, type JumpThemeName } from "@cdj/jump-sim";
import { toPayload, type DailyPayload } from "./dailyWork";

// Lot 21 : la génération d'un niveau (le catalogue des morceaux, le générateur, le solveur de la preuve) vit ici, **seule à importer `dailyLevel`**.
// Ce fichier n'est chargé qu'à la demande : par le worker (`dailyWorker.ts`), par le repli sur le fil principal (`dailyLoader.ts`) et par les
// outils (`?semaine`, `?modules`). Avec un niveau figé, la partie ne le charge jamais. Le calcul est celui de `dailyLevel`.

/** Génère le niveau d'une date (le travail du worker : `dailyLevel`, puis sa charge) ; `forced` : un thème imposé (essai). */
export function generatePayload(day: number, forced: JumpThemeName | null = null): DailyPayload {
  return toPayload(dailyLevel(day, forced));
}
