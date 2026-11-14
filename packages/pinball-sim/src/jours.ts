import { formatDay, parseDay } from "@cdj/core";
import { PINBALL_GENERATOR_VERSION, PINBALL_SIM_VERSION } from "./constantes";
import { dailyPinball, type Contenu } from "./generateur";

// Un jour figé : `apps/pinball/public/jours/AAAA-MM-JJ.json`, le contenu tel qu'il a été servi, avec les versions qui l'ont produit. Un jour figé ne change plus (règle R11) ; le jeu et le serveur lisent
// le fichier d'abord, sinon génèrent avec la version courante. Pas de preuve : le bot se rejoue en quelques microsecondes.

export interface JourFige {
  format: 1;
  jeu: "pinball";
  date: string;
  g: number;
  sim: number;
  contenu: { pinball: Contenu["pinball"] };
}

export function figerJour(jour: number, version: number = PINBALL_GENERATOR_VERSION): JourFige {
  const c = dailyPinball(jour, version);
  return { format: 1, jeu: "pinball", date: formatDay(jour), g: c.g, sim: PINBALL_SIM_VERSION, contenu: { pinball: c.pinball } };
}

/** Lit un fichier de jour : rend le contenu, ou null si le fichier ne se relit pas (forme) ou n'est plus ce que sa version génère. */
export function lireJourFige(brut: unknown): Contenu | null {
  if (typeof brut !== "object" || brut === null) return null;
  const f = brut as Partial<JourFige>;
  if (f.format !== 1 || f.jeu !== "pinball" || typeof f.date !== "string" || typeof f.g !== "number" || typeof f.sim !== "number") return null;
  const jour = parseDay(f.date);
  if (jour === null || f.sim !== PINBALL_SIM_VERSION) return null;
  let attendu: Contenu;
  try {
    attendu = dailyPinball(jour, f.g);
  } catch {
    return null;
  }
  return JSON.stringify(f.contenu?.pinball) === JSON.stringify(attendu.pinball) ? attendu : null;
}
