import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { formatDay } from "@cdj/core";
import { GRAVITY_GENERATOR_VERSION, dailyGravity, empreinteContenu, lireJourFige, seuilsDe } from "@cdj/gravity-sim";
import { sha, type EmpreinteJour } from "./empreintes";

// L'empreinte de ce que « Gravity » SERT pour un jour (module de sa fiche, `jours.fabrication.empreinte` ; lot K4b) : le fichier du jour s'il se relit et se régénère à l'identique, sinon le générateur courant.
// **L'empreinte ne dit pas d'où vient le jour** (fichier figé ou générateur) : seulement ce qui est servi — l'identifiant, le contenu, les seuils. Run « Mettre en production » n° 47 (09/11/2026) : l'étiquette
// « fige » / « genere » qu'elle portait faisait toujours différer le code en production (sans fichier : « genere ») de la construction (les fichiers que le code en production vient de figer : « fige ») pour
// les 26 jours d'un jeu devenu `on` — alors que le fichier est exactement ce que le code sert sans lui, ce que la mise en production veut vérifier.
// **Lot GR1 : l'empreinte couvre aussi les SEUILS des médailles** (règle « un jour figé fige aussi ses seuils ») : ceux du fichier de jour s'il y en a un, sinon le calcul courant. Changer le calcul (le robot du lot GR2)
// ne change donc jamais un jour figé, et change l'empreinte d'un jour protégé sans fichier : la mise en production s'arrête.
export function empreinteJour(day: number, dossier: string | null): EmpreinteJour {
  const date = formatDay(day);
  const fichier = dossier ? join(dossier, `${date}.json`) : null;
  if (fichier && existsSync(fichier)) {
    try {
      const c = lireJourFige(JSON.parse(readFileSync(fichier, "utf8")) as unknown);
      if (c) {
        const id = `gravity-${date}-g${c.g}`;
        return { id, h: sha([id, empreinteContenu(c), JSON.stringify(seuilsDe(c))]), ok: true };
      }
    } catch {
      /* un fichier illisible n'est pas servi : le jour est généré */
    }
  }
  const c = dailyGravity(day, GRAVITY_GENERATOR_VERSION);
  const id = `gravity-${date}-g${c.g}`;
  return { id, h: sha([id, empreinteContenu(c), JSON.stringify(seuilsDe(c))]), ok: true };
}
