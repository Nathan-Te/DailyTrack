import { formatDay, parseDay } from "@cdj/core";
import { GRAVITY_BOT_VERSION, GRAVITY_GENERATOR_VERSION, GRAVITY_SIM_VERSION } from "./constantes";
import { dailyGravity, empreinteContenu, type Contenu } from "./generateur";
import { versionsSimJouables } from "./regles";
import { seuilsDuRobot, seuilsValides } from "./seuils";
import { THEMES_GRAVITY } from "./themes";
import type { Seuils } from "./types";

// Un jour figé : `apps/gravity/public/jours/AAAA-MM-JJ.json`, le contenu tel qu'il a été servi, avec les versions qui l'ont produit. Un jour figé ne change plus (règle R11) ; le jeu et le serveur lisent le fichier
// d'abord, sinon génèrent avec la version courante. **Le fichier porte aussi les SEUILS des médailles** (règle « un jour figé fige aussi ses seuils ») et la version du calcul qui les a produits : changer le calcul (le
// robot) ne change jamais un jour figé, et change l'empreinte d'un jour protégé sans fichier. Pas de preuve : rien de secret dans ce fichier.
// **Lot GR5 : un jour figé se relit et se rejoue avec la version du générateur (`g`, `GENERATEURS`) et de la simulation (`sim`, `SIMS`) qui l'ont créé**, même après un passage à la version suivante : `lireJourFige` accepte
// toute version que ce code sait encore jouer (`versionsGenerateur`, `versionsSimJouables`), et le contenu rendu porte sa `sim` : le terrain, la partie, le robot et le rejeu la lisent. Ce qu'on garde et ce qu'on retire :
// `packages/gravity-sim/CLAUDE.md`, « Les anciennes versions ».

export const FORMAT_JOUR_FIGE = 1;

export interface JourFige {
  format: 1;
  jeu: "gravity";
  date: string;
  /** La version du générateur et celle de la simulation. */
  g: number;
  sim: number;
  /** La version du calcul des seuils qui a produit `seuils`. */
  bot: number;
  seuils: Seuils;
  /** L'ordre des thèmes et l'empreinte de ce que le générateur donne (`empreinteContenu`). */
  contenu: { ordre: string[]; empreinte: string };
}

/** Le fichier d'un jour, avec les seuils qu'on lui donne (par défaut ceux du robot, `seuilsDuRobot`), sous le générateur `version` et la simulation `sim` (les courants par défaut). */
export function figerJour(jour: number, seuils?: Seuils, version: number = GRAVITY_GENERATOR_VERSION, sim: number = GRAVITY_SIM_VERSION): JourFige {
  const c = dailyGravity(jour, version, sim);
  const s = seuils ?? seuilsDuRobot(c);
  if (!seuilsValides(s)) throw new Error("seuils invalides : quatre entiers strictement croissants attendus");
  return { format: FORMAT_JOUR_FIGE, jeu: "gravity", date: formatDay(jour), g: c.g, sim, bot: GRAVITY_BOT_VERSION, seuils: { bronze: s.bronze, silver: s.silver, gold: s.gold, author: s.author }, contenu: { ordre: [...c.ordre], empreinte: empreinteContenu(c) } };
}

/** Lit un fichier de jour : rend le contenu (avec `seuilsFiges`), ou null si le fichier ne se relit pas (forme, seuils) ou n'est plus ce que sa version génère. */
export function lireJourFige(brut: unknown): Contenu | null {
  if (typeof brut !== "object" || brut === null) return null;
  const f = brut as Partial<JourFige>;
  if (f.format !== FORMAT_JOUR_FIGE || f.jeu !== "gravity" || typeof f.date !== "string" || typeof f.g !== "number" || typeof f.sim !== "number" || typeof f.bot !== "number") return null;
  const jour = parseDay(f.date);
  if (jour === null || !versionsSimJouables().includes(f.sim) || !seuilsValides(f.seuils)) return null;
  const c = f.contenu as Partial<JourFige["contenu"]> | undefined;
  if (!c || !Array.isArray(c.ordre) || c.ordre.length !== THEMES_GRAVITY.length || typeof c.empreinte !== "string") return null;
  let attendu: Contenu;
  try {
    attendu = dailyGravity(jour, f.g, f.sim);
  } catch {
    return null;
  }
  if (c.ordre.join(",") !== attendu.ordre.join(",") || c.empreinte !== empreinteContenu(attendu)) return null;
  const { bronze, silver, gold, author } = f.seuils;
  return { ...attendu, seuilsFiges: { bronze, silver, gold, author } };
}
