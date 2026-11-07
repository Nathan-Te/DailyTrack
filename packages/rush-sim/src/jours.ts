import { formatDay, parseDay } from "@cdj/core";
import { RUSH_BOT_VERSION, RUSH_GENERATOR_VERSION, RUSH_SIM_VERSION } from "./constantes";
import { dailyRush, type Contenu } from "./generateur";
import { seuilsDe, seuilsValides } from "./medailles";
import type { Seuils } from "./variante";

// Un jour figé : `apps/rush/public/jours/AAAA-MM-JJ.json`, le contenu tel qu'il a été servi, avec les versions qui l'ont produit. Un jour figé ne change plus (règle R11) ; le jeu et le serveur lisent
// le fichier d'abord, sinon génèrent avec la version courante. Pas de preuve : le pilote se rejoue en quelques centaines de millisecondes (mesure du lot BR0).
// **Format 2 (lot BR4) : le fichier porte aussi les SEUILS des médailles** (le Diamant, meilleur des trois stratégies du pilote, et l'or, l'argent et le bronze qui s'en déduisent) et la version du pilote qui les a calculés
// (`RUSH_BOT_VERSION`) : règle de la racine « un jour figé fige aussi ses seuils ». Si le pilote ou le barème change, les jours déjà figés gardent ceux qu'on a servis ; les autres se recalculent d'eux-mêmes.

export const FORMAT_JOUR_FIGE = 2;

export interface JourFige {
  format: 2;
  jeu: "rush";
  date: string;
  g: number;
  sim: number;
  /** La version du pilote (et du barème) qui a calculé `seuils`. */
  bot: number;
  /** Les seuils de ce jour : `author` est le Diamant ; Diamant < or < argent < bronze (des temps en ticks). */
  seuils: Seuils;
  contenu: { graine: number };
}

/** Le fichier d'un jour, avec les seuils qu'on lui donne (le pilote les calcule : par défaut, ceux de `seuilsDe`). */
export function figerJour(jour: number, version: number = RUSH_GENERATOR_VERSION, seuils?: Seuils, bot: number = RUSH_BOT_VERSION): JourFige {
  const c = dailyRush(jour, version);
  const s = seuils ?? seuilsDe(c);
  if (!seuilsValides(s)) throw new Error("seuils invalides : quatre entiers, Diamant < or < argent < bronze");
  return { format: FORMAT_JOUR_FIGE, jeu: "rush", date: formatDay(jour), g: c.g, sim: RUSH_SIM_VERSION, bot, seuils: { author: s.author, gold: s.gold, silver: s.silver, bronze: s.bronze }, contenu: { graine: c.graine } };
}

/** Lit un fichier de jour : rend le contenu (avec `seuilsFiges`), ou null si le fichier ne se relit pas (forme, seuils) ou n'est plus ce que sa version génère. */
export function lireJourFige(brut: unknown): Contenu | null {
  if (typeof brut !== "object" || brut === null) return null;
  const f = brut as Partial<JourFige>;
  if (f.format !== FORMAT_JOUR_FIGE || f.jeu !== "rush" || typeof f.date !== "string" || typeof f.g !== "number" || typeof f.sim !== "number" || typeof f.bot !== "number") return null;
  const jour = parseDay(f.date);
  if (jour === null || f.sim !== RUSH_SIM_VERSION || !seuilsValides(f.seuils)) return null;
  let attendu: Contenu;
  try {
    attendu = dailyRush(jour, f.g);
  } catch {
    return null;
  }
  if (f.contenu?.graine !== attendu.graine) return null;
  const { author, gold, silver, bronze } = f.seuils;
  return { ...attendu, seuilsFiges: { author, gold, silver, bronze } };
}
