import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { formatDay } from "@cdj/core";
import { RUSH_GENERATOR_VERSION, dailyRush, empreinteContenu, lireJourFige, seuilsDuJour, type Contenu } from "@cdj/rush-sim";
import { sha, type EmpreinteJour } from "./empreintes";

// L'empreinte de ce que « Rush » SERT pour un jour (module de sa fiche, `jours.fabrication.empreinte` ; lot K4b) : le fichier du jour s'il se relit et se régénère à l'identique, sinon le générateur courant.
// **Lot BR4 : elle couvre les seuils des médailles** (le Diamant, meilleur des trois stratégies du pilote, et l'or, l'argent, le bronze) : ceux du fichier pour un jour figé, ceux du pilote du code pour un jour généré. Un changement du pilote qui
// changerait les seuils d'un jour protégé sans fichier arrête donc la mise en production (règle « un jour figé fige ses seuils », `CLAUDE.md` racine).
const textesDesSeuils = (c: Contenu): string => {
  const s = seuilsDuJour(c);
  return `${s.author},${s.gold},${s.silver},${s.bronze}`;
};

export function empreinteJour(day: number, dossier: string | null): EmpreinteJour {
  const date = formatDay(day);
  const fichier = dossier ? join(dossier, `${date}.json`) : null;
  if (fichier && existsSync(fichier)) {
    try {
      const c = lireJourFige(JSON.parse(readFileSync(fichier, "utf8")) as unknown);
      if (c) {
        const id = `rush-${date}-g${c.g}`;
        return { id, h: sha([id, empreinteContenu(c), textesDesSeuils(c), "fige"]), ok: true };
      }
    } catch {
      /* un fichier illisible n'est pas servi : le jour est généré */
    }
  }
  const c = dailyRush(day, RUSH_GENERATOR_VERSION);
  const id = `rush-${date}-g${c.g}`;
  return { id, h: sha([id, empreinteContenu(c), textesDesSeuils(c), "genere"]), ok: true };
}
