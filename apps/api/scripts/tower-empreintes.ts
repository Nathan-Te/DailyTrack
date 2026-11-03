import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { formatDay } from "@cdj/core";
import { dailyTower, empreinteContenu, estimationGeometrique, lireJour, TOWER_GENERATOR_VERSION } from "@cdj/tower-sim";
import { sha, type EmpreinteJour } from "./empreintes";

// Lot TP : l'empreinte de ce que Tower SERT pour un jour. Lot K4b : le module de Tower (`jours.fabrication.empreinte` de sa fiche), lancé seulement si le code visé contient le jeu
// (`packages/tower-sim`) : un jeu absent de la production n'a aucun jour à conserver (`comparerEmpreintes`).
//
// Ce que sert un jour : **le fichier du jour s'il se relit et se régénère à l'identique** (id, contenu, médailles — `prepare` s'il porte les médailles du bot, `genere` sinon), sinon le tirage 0
// du générateur courant et l'estimation géométrique des médailles. La preuve n'est pas rejouée ici (le serveur et `jours.test.ts` le font) ; elle n'entre pas dans l'empreinte : elle ne sort pas du serveur.

/** L'empreinte du jour de Tower que sert le code, avec les fichiers de `dossier`. */
export function empreinteJour(day: number, dossier: string | null): EmpreinteJour {
  const date = formatDay(day);
  const fichier = dossier ? join(dossier, `${date}.json`) : null;
  if (fichier && existsSync(fichier)) {
    try {
      const lu = lireJour(JSON.parse(readFileSync(fichier, "utf8")) as unknown, day);
      if (typeof lu !== "string") {
        const c = lu.contenu;
        const id = `tower-${date}-g${c.g}-t${c.tirage ?? 0}`;
        const m = lu.medailles ?? estimationGeometrique(c);
        const intact = empreinteContenu(dailyTower(day, c.g, c.tirage ?? 0)) === empreinteContenu(c);
        return { id, h: sha([id, empreinteContenu(c), m, lu.medailles ? "prepare" : "genere"]), ok: intact };
      }
    } catch {
      /* un fichier illisible n'est pas servi : le jour est généré */
    }
  }
  const c = dailyTower(day, TOWER_GENERATOR_VERSION, 0);
  const id = `tower-${date}-g${c.g}-t0`;
  return { id, h: sha([id, empreinteContenu(c), estimationGeometrique(c), "genere"]), ok: true };
}
