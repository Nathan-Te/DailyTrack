import { formatDay, parseDay } from "@cdj/core";
import { GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION } from "./constantes";
import { dailyGravity, type Contenu } from "./generateur";

// Un jour figé : `apps/gravity/public/jours/AAAA-MM-JJ.json`, le contenu tel qu'il a été servi, avec les versions qui l'ont produit. Un jour figé ne change plus (règle R11) ; le jeu et le serveur lisent
// le fichier d'abord, sinon génèrent avec la version courante. Pas de preuve : le bot se rejoue en quelques microsecondes.

export interface JourFige {
  format: 1;
  jeu: "gravity";
  date: string;
  g: number;
  sim: number;
  contenu: { gravity: Contenu["gravity"] };
}

export function figerJour(jour: number, version: number = GRAVITY_GENERATOR_VERSION): JourFige {
  const c = dailyGravity(jour, version);
  return { format: 1, jeu: "gravity", date: formatDay(jour), g: c.g, sim: GRAVITY_SIM_VERSION, contenu: { gravity: c.gravity } };
}

/** Lit un fichier de jour : rend le contenu, ou null si le fichier ne se relit pas (forme) ou n'est plus ce que sa version génère. */
export function lireJourFige(brut: unknown): Contenu | null {
  if (typeof brut !== "object" || brut === null) return null;
  const f = brut as Partial<JourFige>;
  if (f.format !== 1 || f.jeu !== "gravity" || typeof f.date !== "string" || typeof f.g !== "number" || typeof f.sim !== "number") return null;
  const jour = parseDay(f.date);
  if (jour === null || f.sim !== GRAVITY_SIM_VERSION) return null;
  let attendu: Contenu;
  try {
    attendu = dailyGravity(jour, f.g);
  } catch {
    return null;
  }
  return JSON.stringify(f.contenu?.gravity) === JSON.stringify(attendu.gravity) ? attendu : null;
}
