import { formatDay, parseDay } from "@cdj/core";
import { PINBALL_BOT_VERSION, PINBALL_GENERATOR_VERSION, PINBALL_SIM_VERSION } from "./constantes";
import { dailyPinball, empreinteContenu, type Contenu } from "./generateur";
import { seuilsDuRobot, seuilsValides } from "./seuils";
import { THEMES_PINBALL } from "./themes";
import type { Seuils } from "./types";

// Un jour figé : `apps/pinball/public/jours/AAAA-MM-JJ.json`, la table telle qu'elle a été servie, avec les versions qui l'ont produite. Un jour figé ne change plus (règle R11) ; le jeu et le serveur lisent le fichier
// d'abord, sinon génèrent avec la version courante. **Le fichier porte aussi les SEUILS des médailles** (règle « un jour figé fige aussi ses seuils ») et la version du calcul qui les a produits : changer le calcul (le
// robot du lot PB4) ne change jamais un jour figé, et change l'empreinte d'un jour protégé sans fichier. Pas de preuve : rien de secret dans ce fichier. Le robot du lot PB4 donne les seuils (`seuils.ts`).

export const FORMAT_JOUR_FIGE = 1;

export interface JourFige {
  format: 1;
  jeu: "pinball";
  date: string;
  /** La version du générateur et celle de la simulation. */
  g: number;
  sim: number;
  /** La version du calcul des seuils qui a produit `seuils`. */
  bot: number;
  seuils: Seuils;
  /** Le thème, le module de chaque emplacement et l'empreinte de ce que le générateur donne (`empreinteContenu`). */
  contenu: { theme: string; modules: string[]; empreinte: string };
}

/** Le fichier d'un jour, avec les seuils qu'on lui donne (par défaut ceux du robot : quelques secondes la première fois pour une table). */
export function figerJour(jour: number, seuils?: Seuils, version: number = PINBALL_GENERATOR_VERSION): JourFige {
  const c = dailyPinball(jour, version);
  const s = seuils ?? seuilsDuRobot(c);
  if (!seuilsValides(s)) throw new Error("seuils invalides : quatre entiers strictement croissants attendus");
  return {
    format: FORMAT_JOUR_FIGE,
    jeu: "pinball",
    date: formatDay(jour),
    g: c.g,
    sim: PINBALL_SIM_VERSION,
    bot: PINBALL_BOT_VERSION,
    seuils: { bronze: s.bronze, silver: s.silver, gold: s.gold, author: s.author },
    contenu: { theme: c.theme, modules: [...c.modules], empreinte: empreinteContenu(c) },
  };
}

/** Lit un fichier de jour : rend le contenu (avec `seuilsFiges`), ou null si le fichier ne se relit pas (forme, seuils) ou n'est plus ce que sa version génère. */
export function lireJourFige(brut: unknown): Contenu | null {
  if (typeof brut !== "object" || brut === null) return null;
  const f = brut as Partial<JourFige>;
  if (f.format !== FORMAT_JOUR_FIGE || f.jeu !== "pinball" || typeof f.date !== "string" || typeof f.g !== "number" || typeof f.sim !== "number" || typeof f.bot !== "number") return null;
  const jour = parseDay(f.date);
  if (jour === null || f.sim !== PINBALL_SIM_VERSION || !seuilsValides(f.seuils)) return null;
  const c = f.contenu as Partial<JourFige["contenu"]> | undefined;
  if (!c || typeof c.theme !== "string" || !(THEMES_PINBALL as readonly string[]).includes(c.theme) || !Array.isArray(c.modules) || typeof c.empreinte !== "string") return null;
  let attendu: Contenu;
  try {
    attendu = dailyPinball(jour, f.g);
  } catch {
    return null;
  }
  if (c.theme !== attendu.theme || c.modules.join(",") !== attendu.modules.join(",") || c.empreinte !== empreinteContenu(attendu)) return null;
  const { bronze, silver, gold, author } = f.seuils;
  return { ...attendu, seuilsFiges: { bronze, silver, gold, author } };
}
