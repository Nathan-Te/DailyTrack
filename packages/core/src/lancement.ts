import lancement from "../../../config/lancement.json";
import { parseDay } from "./calendar";

// Lot R8 : la date du lancement public de Du Jour, **écrite une seule fois**, dans `config/lancement.json` (`{ "premierJour": "AAAA-MM-JJ" }`).
// Le serveur (`journee` de `GET /api/portail/jour` et du classement), le portail et les deux jeux (archives, numéro de journée, ligne à
// partager « Du Jour #N ») la lisent d'ici. Pour la déplacer : changer cette seule ligne du fichier JSON.

/** Le jour de la journée n° 1 (« Du Jour #1 »), tel qu'écrit dans `config/lancement.json`. */
export const PREMIER_JOUR_TEXTE: string = lancement.premierJour;

/**
 * Le premier jour de la journée commune, en jours depuis 1970. `surcharge` (AAAA-MM-JJ) le remplace s'il est valide : la **recette** et les aperçus
 * s'en servent pour essayer « Journée n° 1 » un autre jour (`LANCEMENT_PREMIER_JOUR` du serveur, `VITE_LANCEMENT_PREMIER_JOUR` des sites ;
 * jamais en production). Une valeur illisible est ignorée.
 */
export function premierJourDuJour(surcharge?: string | null): number {
  const s = surcharge ? parseDay(surcharge) : null;
  return s ?? parseDay(PREMIER_JOUR_TEXTE)!;
}

/** La journée n° 1 par défaut (la date du fichier). */
export const PREMIER_JOUR_DU_JOUR: number = premierJourDuJour();

/** Le numéro de la journée commune d'un jour de Paris, ou `null` avant le premier jour (aucun numéro n'est affiché). */
export const numeroDeJournee = (day: number, premier: number = PREMIER_JOUR_DU_JOUR): number | null => (day >= premier ? day - premier + 1 : null);
