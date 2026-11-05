import { formatDay, parseDay } from "@cdj/core";
import { RUSH_GENERATOR_VERSION, RUSH_SIM_VERSION } from "./constantes";
import { dailyRush, type Contenu } from "./generateur";

// Un jour figé : `apps/rush/public/jours/AAAA-MM-JJ.json`, le contenu tel qu'il a été servi, avec les versions qui l'ont produit. Un jour figé ne change plus (règle R11) ; le jeu et le serveur lisent
// le fichier d'abord, sinon génèrent avec la version courante. Pas de preuve : le pilote se rejoue en quelques centaines de millisecondes (mesure du lot BR0).

export interface JourFige {
  format: 1;
  jeu: "rush";
  date: string;
  g: number;
  sim: number;
  contenu: { graine: number };
}

export function figerJour(jour: number, version: number = RUSH_GENERATOR_VERSION): JourFige {
  const c = dailyRush(jour, version);
  return { format: 1, jeu: "rush", date: formatDay(jour), g: c.g, sim: RUSH_SIM_VERSION, contenu: { graine: c.graine } };
}

/** Lit un fichier de jour : rend le contenu, ou null si le fichier ne se relit pas (forme) ou n'est plus ce que sa version génère. */
export function lireJourFige(brut: unknown): Contenu | null {
  if (typeof brut !== "object" || brut === null) return null;
  const f = brut as Partial<JourFige>;
  if (f.format !== 1 || f.jeu !== "rush" || typeof f.date !== "string" || typeof f.g !== "number" || typeof f.sim !== "number") return null;
  const jour = parseDay(f.date);
  if (jour === null || f.sim !== RUSH_SIM_VERSION) return null;
  let attendu: Contenu;
  try {
    attendu = dailyRush(jour, f.g);
  } catch {
    return null;
  }
  return f.contenu?.graine === attendu.graine ? attendu : null;
}
