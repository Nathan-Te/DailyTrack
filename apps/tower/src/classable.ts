import { peutClasser } from "./envoi";
import { type ReglagesTune, reglagesEssai } from "./reglagesEssai";

/**
 * Cette partie peut-elle partir au classement ? `peutClasser` (le jour d'aujourd'hui, ni scénario, ni bot, ni tirage forcé) **et** aucun réglage d'essai : une partie jouée avec une valeur de `?debug&tune`
 * qui diffère de la valeur du jour n'est jamais envoyée (testé : `test/reglagesEssai.test.ts`). Le jeu l'appelle au début de chaque partie.
 */
export function classablePourReglages(o: Omit<Parameters<typeof peutClasser>[0], "reglagesModifies">, r: ReglagesTune): boolean {
  return peutClasser({ ...o, reglagesModifies: reglagesEssai(r) });
}
