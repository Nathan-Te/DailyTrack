import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { formatDay } from "@cdj/core";
import { BLOCKS_GENERATOR_VERSION, dailyBlocks, empreinteContenu, lireJourFige, seuilsDuJour, type Contenu } from "@cdj/blocks-sim";
import { sha, type EmpreinteJour } from "./empreintes";

// L'empreinte de ce que « Blocks » SERT pour un jour (module de sa fiche, `jours.fabrication.empreinte` ; lot K4b) : le fichier du jour s'il se relit et se régénère à l'identique, sinon le générateur courant.
// **Elle couvre les seuils des médailles** (le Diamant, l'or, l'argent, le bronze) : ceux du fichier pour un jour figé, les constantes du code pour un jour généré. Un changement des seuils qui
// changerait les seuils d'un jour protégé sans fichier arrête donc la mise en production (règle « un jour figé fige ses seuils », `CLAUDE.md` racine).
const textesDesSeuils = (c: Contenu): string => {
  const s = seuilsDuJour(c);
  return `${s.bronze},${s.silver},${s.gold},${s.author}`;
};

export function empreinteJour(day: number, dossier: string | null): EmpreinteJour {
  const date = formatDay(day);
  const fichier = dossier ? join(dossier, `${date}.json`) : null;
  if (fichier && existsSync(fichier)) {
    try {
      const c = lireJourFige(JSON.parse(readFileSync(fichier, "utf8")) as unknown);
      if (c) {
        const id = `blocks-${date}-g${c.g}`;
        return { id, h: sha([id, empreinteContenu(c), textesDesSeuils(c), "fige"]), ok: true };
      }
    } catch {
      /* un fichier illisible n'est pas servi : le jour est généré */
    }
  }
  const c = dailyBlocks(day, BLOCKS_GENERATOR_VERSION);
  const id = `blocks-${date}-g${c.g}`;
  return { id, h: sha([id, empreinteContenu(c), textesDesSeuils(c), "genere"]), ok: true };
}
