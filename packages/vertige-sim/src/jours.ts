import { formatDay, parseDay } from "@cdj/core";
import { VERTIGE_BOT_VERSION, VERTIGE_GENERATOR_VERSION, VERTIGE_SIM_VERSION } from "./constantes";
import { ErreurGenerateur, type Contenu } from "./generateur";
import { dailyVertige } from "./niveauDuJour";
import { seuilsValides, type Seuils } from "./medailles";
import { VARIANTE } from "./variante";

// Un jour figé : `apps/vertige/public/jours/AAAA-MM-JJ.json`, le contenu tel qu'il a été servi, avec les versions qui l'ont produit. Un jour figé ne change plus (règle R11) ; le jeu et le serveur lisent le fichier d'abord, sinon génèrent
// avec la version courante. **Le générateur n'écrit jamais une date** : le fichier porte la date du jour qu'on lui demande de figer, et la version du générateur qui l'a produit.
// **Format 2 (lot V3) : le fichier porte aussi les SEUILS des médailles** (le temps du robot, puis l'or, l'argent et le bronze qui s'en déduisent par le barème de la fiche) et la version du robot (`VERTIGE_BOT_VERSION`) : règle de la racine
// « un jour figé fige aussi ses seuils ». Si le barème de la fiche ou le robot change, les jours déjà figés gardent ceux qu'on a servis ; les autres se recalculent d'eux-mêmes. Le format 1 (version 1 du générateur : le parcours seul, sans robot donc sans médaille) ne se lit plus : aucun jour n'a jamais été figé ainsi, et le jour est alors généré.
export const FORMAT_JOUR_FIGE = 2;

export interface JourFige {
  format: 2;
  jeu: "vertige";
  date: string;
  g: number;
  sim: number;
  /** La version du robot et du barème qui ont calculé `seuils`. */
  bot: number;
  /** Les seuils de ce jour : `author` est le Diamant (le temps du robot, en pas) ; Diamant < or < argent < bronze. */
  seuils: Seuils;
  contenu: { modules: readonly string[]; ticksRobot: number };
}

/** Le fichier d'un jour, avec les seuils qu'on lui donne (par défaut, ceux du barème de la fiche). */
export function figerJour(jour: number, version: number = VERTIGE_GENERATOR_VERSION, seuils?: Seuils, bot: number = VERTIGE_BOT_VERSION): JourFige {
  const c = dailyVertige(jour, version);
  if (!c.modules || c.ticksRobot === undefined) throw new ErreurGenerateur(`la version ${version} du générateur ne fige pas de jour de ce format`);
  const s = seuils ?? VARIANTE.seuils(c.ticksRobot);
  if (!seuilsValides(s)) throw new Error("seuils invalides : quatre entiers, Diamant < or < argent < bronze");
  return { format: FORMAT_JOUR_FIGE, jeu: "vertige", date: formatDay(jour), g: c.g, sim: VERTIGE_SIM_VERSION, bot, seuils: { author: s.author, gold: s.gold, silver: s.silver, bronze: s.bronze }, contenu: { modules: c.modules, ticksRobot: c.ticksRobot } };
}

/** Lit un fichier de jour : rend le contenu (avec `seuilsFiges`), ou null si le fichier ne se relit pas (forme, seuils) ou n'est plus ce que sa version génère. */
export function lireJourFige(brut: unknown): Contenu | null {
  if (typeof brut !== "object" || brut === null) return null;
  const f = brut as Omit<Partial<JourFige>, "format" | "contenu"> & { format?: number; contenu?: Partial<JourFige["contenu"]> & { niveau?: string } };
  if (f.jeu !== "vertige" || typeof f.date !== "string" || typeof f.g !== "number" || typeof f.sim !== "number") return null;
  const jour = parseDay(f.date);
  if (jour === null || f.sim !== VERTIGE_SIM_VERSION) return null;
  let attendu: Contenu;
  try {
    attendu = dailyVertige(jour, f.g);
  } catch {
    return null;
  }
  if (f.format !== FORMAT_JOUR_FIGE || typeof f.bot !== "number" || !seuilsValides(f.seuils)) return null;
  if (JSON.stringify(f.contenu?.modules) !== JSON.stringify(attendu.modules) || f.contenu?.ticksRobot !== attendu.ticksRobot) return null;
  const { author, gold, silver, bronze } = f.seuils;
  return { ...attendu, seuilsFiges: { author, gold, silver, bronze } };
}
