import { formatDay, parseDay } from "@cdj/core";
import { VERTIGE_GENERATOR_VERSION, VERTIGE_SIM_VERSION } from "./constantes";
import { dailyVertige, type Contenu } from "./generateur";

// Un jour figé : `apps/vertige/public/jours/AAAA-MM-JJ.json`, le contenu tel qu'il a été servi, avec les versions qui l'ont produit. Un jour figé ne change plus (règle R11) ; le jeu et le serveur lisent
// le fichier d'abord, sinon génèrent avec la version courante. Au prototype, le contenu est le nom du niveau.

export interface JourFige {
  format: 1;
  jeu: "vertige";
  date: string;
  g: number;
  sim: number;
  contenu: { niveau: Contenu["niveau"] };
}

export function figerJour(jour: number, version: number = VERTIGE_GENERATOR_VERSION): JourFige {
  const c = dailyVertige(jour, version);
  return { format: 1, jeu: "vertige", date: formatDay(jour), g: c.g, sim: VERTIGE_SIM_VERSION, contenu: { niveau: c.niveau } };
}

/** Lit un fichier de jour : rend le contenu, ou null si le fichier ne se relit pas (forme) ou n'est plus ce que sa version génère. */
export function lireJourFige(brut: unknown): Contenu | null {
  if (typeof brut !== "object" || brut === null) return null;
  const f = brut as Partial<JourFige>;
  if (f.format !== 1 || f.jeu !== "vertige" || typeof f.date !== "string" || typeof f.g !== "number" || typeof f.sim !== "number") return null;
  const jour = parseDay(f.date);
  if (jour === null || f.sim !== VERTIGE_SIM_VERSION) return null;
  let attendu: Contenu;
  try {
    attendu = dailyVertige(jour, f.g);
  } catch {
    return null;
  }
  return JSON.stringify(f.contenu) === JSON.stringify({ niveau: attendu.niveau }) ? attendu : null;
}
