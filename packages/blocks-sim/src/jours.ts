import { formatDay, parseDay } from "@cdj/core";
import { BLOCKS_GENERATOR_VERSION, BLOCKS_SIM_VERSION, PLAFOND_PIECES } from "./constantes";
import { dailyBlocks, type Contenu } from "./generateur";
import { NB_PIECES } from "./pieces";

// Un jour figé : `apps/blocks/public/jours/AAAA-MM-JJ.json`, le contenu tel qu'il a été servi, avec les versions qui l'ont produit. Un jour figé ne change plus (règle R11) ; le jeu et le serveur lisent
// le fichier d'abord, sinon génèrent avec la version courante. La suite s'écrit en un texte (un caractère par pièce : le code `48 + id`, de `0` à `T`) : 2 000 caractères, pas 2 000 lignes. Pas de preuve.

export interface JourFige {
  format: 1;
  jeu: "blocks";
  date: string;
  g: number;
  sim: number;
  contenu: { suite: string };
}

const versTexte = (suite: readonly number[]): string => suite.map((id) => String.fromCharCode(48 + id)).join("");
const depuisTexte = (t: string): number[] => [...t].map((ch) => ch.charCodeAt(0) - 48);

export function figerJour(jour: number, version: number = BLOCKS_GENERATOR_VERSION): JourFige {
  const c = dailyBlocks(jour, version);
  return { format: 1, jeu: "blocks", date: formatDay(jour), g: c.g, sim: BLOCKS_SIM_VERSION, contenu: { suite: versTexte(c.suite) } };
}

/** Lit un fichier de jour : rend le contenu, ou null si le fichier ne se relit pas (forme) ou n'est plus ce que sa version génère. */
export function lireJourFige(brut: unknown): Contenu | null {
  if (typeof brut !== "object" || brut === null) return null;
  const f = brut as Partial<JourFige>;
  if (f.format !== 1 || f.jeu !== "blocks" || typeof f.date !== "string" || typeof f.g !== "number" || typeof f.sim !== "number") return null;
  const jour = parseDay(f.date);
  if (jour === null || f.sim !== BLOCKS_SIM_VERSION) return null;
  const texte = f.contenu?.suite;
  if (typeof texte !== "string" || texte.length !== PLAFOND_PIECES || depuisTexte(texte).some((id) => id < 0 || id >= NB_PIECES)) return null;
  let attendu: Contenu;
  try {
    attendu = dailyBlocks(jour, f.g);
  } catch {
    return null;
  }
  return versTexte(attendu.suite) === texte ? attendu : null;
}
