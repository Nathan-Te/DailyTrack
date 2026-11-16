import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { formatDay } from "@cdj/core";
import { PINBALL_GENERATOR_VERSION, dailyPinball, empreinteContenu, lireJourFige, seuilsDe } from "@cdj/pinball-sim";
import { sha, type EmpreinteJour } from "./empreintes";

// L'empreinte de ce que « Pinball » SERT pour un jour (module de sa fiche, `jours.fabrication.empreinte` ; lot K4b) : le fichier du jour s'il se relit et se régénère à l'identique, sinon le générateur courant.
// **L'empreinte ne dit pas d'où vient le jour** (fichier figé ou générateur) : seulement ce qui est servi — l'identifiant, la table, les seuils. Run « Mettre en production » n° 47 (09/11/2026) : l'étiquette
// « fige » / « genere » qu'elle portait faisait toujours différer le code en production (sans fichier : « genere ») de la construction (les fichiers que le code en production vient de figer : « fige ») pour
// les 26 jours d'un jeu devenu `on` — alors que le fichier est exactement ce que le code sert sans lui, ce que la mise en production veut vérifier.
// **Lot PB1 : l'empreinte couvre aussi les SEUILS des médailles** (règle « un jour figé fige aussi ses seuils ») : ceux du fichier de jour s'il y en a un, sinon le calcul courant (**lot PB4 : le robot**, quelques secondes
// par table, une fois par table dans le processus). Changer le calcul (le robot, ses constantes, les pourcentages : `PINBALL_BOT_VERSION`) ne change donc jamais un jour figé, et change l'empreinte d'un jour protégé sans
// fichier : la mise en production s'arrête. `preparer` de la fiche écrit à l'avance les jours à venir avec leurs seuils.
export function empreinteJour(day: number, dossier: string | null): EmpreinteJour {
  const date = formatDay(day);
  const fichier = dossier ? join(dossier, `${date}.json`) : null;
  if (fichier && existsSync(fichier)) {
    try {
      const c = lireJourFige(JSON.parse(readFileSync(fichier, "utf8")) as unknown);
      if (c) {
        const id = `pinball-${date}-g${c.g}`;
        return { id, h: sha([id, empreinteContenu(c), JSON.stringify(seuilsDe(c))]), ok: true };
      }
    } catch {
      /* un fichier illisible n'est pas servi : le jour est généré */
    }
  }
  const c = dailyPinball(day, PINBALL_GENERATOR_VERSION);
  const id = `pinball-${date}-g${c.g}`;
  return { id, h: sha([id, empreinteContenu(c), JSON.stringify(seuilsDe(c))]), ok: true };
}
