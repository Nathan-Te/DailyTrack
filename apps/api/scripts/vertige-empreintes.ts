import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { formatDay } from "@cdj/core";
import { VERTIGE_GENERATOR_VERSION, empreinteContenu, seuilsDuJour } from "@cdj/vertige-sim";
import { dailyVertige, lireJourFige } from "@cdj/vertige-sim/modules";
import { sha, type EmpreinteJour } from "./empreintes";

// L'empreinte de ce que « Vertige » SERT pour un jour (module de sa fiche, `jours.fabrication.empreinte` ; lot K4b) : le fichier du jour s'il se relit et se régénère à l'identique, sinon le générateur courant.
// **Lot V3 : l'empreinte couvre aussi les SEUILS des médailles** (règle « un jour figé fige aussi ses seuils ») : ceux du fichier s'il est figé, sinon ceux que le barème de la fiche donne au temps du robot. Changer le barème (ou le
// robot) change donc l'empreinte d'un jour protégé qui n'a pas de fichier : la mise en production s'arrête jusqu'à ce que le jour soit figé.
const seuils = (c: Parameters<typeof seuilsDuJour>[0]): string => JSON.stringify(seuilsDuJour(c));

export function empreinteJour(day: number, dossier: string | null): EmpreinteJour {
  const date = formatDay(day);
  const fichier = dossier ? join(dossier, `${date}.json`) : null;
  if (fichier && existsSync(fichier)) {
    try {
      const c = lireJourFige(JSON.parse(readFileSync(fichier, "utf8")) as unknown);
      if (c) {
        const id = `vertige-${date}-g${c.g}`;
        return { id, h: sha([id, empreinteContenu(c), seuils(c), "fige"]), ok: true };
      }
    } catch {
      /* un fichier illisible n'est pas servi : le jour est généré */
    }
  }
  const c = dailyVertige(day, VERTIGE_GENERATOR_VERSION);
  const id = `vertige-${date}-g${c.g}`;
  return { id, h: sha([id, empreinteContenu(c), seuils(c), "genere"]), ok: true };
}
