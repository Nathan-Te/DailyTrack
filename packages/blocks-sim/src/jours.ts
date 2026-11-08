import { formatDay, parseDay } from "@cdj/core";
import { BLOCKS_BOT_VERSION, BLOCKS_GENERATOR_VERSION, PLAFOND_PIECES } from "./constantes";
import { dailyBlocks, empreinteContenu, type Contenu, reglesDe } from "./generateur";
import { type Seuils, seuilsSontValides } from "./medailles";
import { NB_PIECES } from "./pieces";

// Un jour figé : `apps/blocks/public/jours/AAAA-MM-JJ.json`, le contenu tel qu'il a été servi, avec les versions qui l'ont produit. Un jour figé ne change plus (règle R11) ; le jeu et le serveur lisent
// le fichier d'abord, sinon génèrent avec la version courante.
// **Format 2 : le fichier porte aussi les SEUILS des médailles** et la version du bot qui les a calculés. Un jour figé fige ses seuils, comme Jump et Tower figent leurs médailles : si les seuils de la fiche changent, les jours déjà
// figés gardent ceux qu'on a servis. Le fichier du format 2 (règles v1, tirage 3) porte la suite des pièces en un texte (un caractère par pièce : le code `48 + id`, de `0` à `T`), seule façon de relire un jour figé en v1.
// **Format 3 (lot B8c, tirage v6)** : il n'y a plus de suite — les séries dépendent de la grille du joueur —, le contenu du fichier est `{ graine, empreinte }` : la graine du jour et l'empreinte de ce que le tirage donne (`empreinteContenu`,
// qui couvre une marche de référence : `empreinte.ts`). Un fichier dont l'empreinte n'est plus celle du tirage courant ne se relit pas. Pas de preuve.

export const FORMAT_JOUR_FIGE = 3;
/** Le format des fichiers d'avant le lot B8c (suite de pièces en texte) : relu seulement pour les jours figés en v1. */
export const FORMAT_JOUR_FIGE_V1 = 2;

interface JourFigeCommun {
  jeu: "blocks";
  date: string;
  g: number;
  sim: number;
  /** La version du bot (et des références des médailles) qui a calculé `seuils`. */
  bot: number;
  /** Les seuils des médailles de ce jour : `author` est le Diamant. Quatre entiers strictement croissants (bronze < argent < or < Diamant). */
  seuils: Seuils;
}
/** Format 3 (règles v3) : la graine et l'empreinte du tirage. */
export interface JourFigeV3 extends JourFigeCommun {
  format: 3;
  contenu: { graine: number; empreinte: string };
}
/** Format 2 (règles v1, tirage 3) : la suite des pièces, un caractère chacune. */
export interface JourFigeV1 extends JourFigeCommun {
  format: 2;
  contenu: { suite: string };
}
export type JourFige = JourFigeV3 | JourFigeV1;

const versTexte = (suite: readonly number[]): string => suite.map((id) => String.fromCharCode(48 + id)).join("");
const depuisTexte = (t: string): number[] => [...t].map((ch) => ch.charCodeAt(0) - 48);

/** Des seuils sont-ils valides (quatre entiers positifs, strictement croissants) ? */
export const seuilsValides = (s: unknown): s is Seuils => {
  if (typeof s !== "object" || s === null) return false;
  const { bronze, silver, gold, author } = s as Partial<Seuils>;
  const ok = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 1;
  return ok(bronze) && ok(silver) && ok(gold) && ok(author) && seuilsSontValides({ bronze, silver, gold, author });
};

/** Le fichier d'un jour, avec les seuils qu'on lui donne (ceux de la fiche au moment où on fige : `figerJourDuDiamant`, `diamant.ts`). */
export function figerJour(jour: number, seuils: Seuils, version: number = BLOCKS_GENERATOR_VERSION, bot: number = BLOCKS_BOT_VERSION): JourFige {
  if (!seuilsValides(seuils)) throw new Error("seuils invalides : quatre entiers strictement croissants attendus");
  const c = dailyBlocks(jour, version);
  const s = { bronze: seuils.bronze, silver: seuils.silver, gold: seuils.gold, author: seuils.author };
  const commun = { jeu: "blocks" as const, date: formatDay(jour), g: c.g, sim: reglesDe(version), bot, seuils: s };
  if (c.suite) return { format: FORMAT_JOUR_FIGE_V1, ...commun, contenu: { suite: versTexte(c.suite) } };
  return { format: FORMAT_JOUR_FIGE, ...commun, contenu: { graine: c.graine, empreinte: empreinteContenu(c) } };
}

/** Lit un fichier de jour : rend le contenu (avec `seuilsFiges`), ou null si le fichier ne se relit pas (forme, seuils) ou n'est plus ce que sa version génère. */
export function lireJourFige(brut: unknown): Contenu | null {
  if (typeof brut !== "object" || brut === null) return null;
  const f = brut as Partial<JourFige>;
  if ((f.format !== FORMAT_JOUR_FIGE && f.format !== FORMAT_JOUR_FIGE_V1) || f.jeu !== "blocks" || typeof f.date !== "string" || typeof f.g !== "number" || typeof f.sim !== "number" || typeof f.bot !== "number") return null;
  const jour = parseDay(f.date);
  if (jour === null || f.sim !== reglesDe(f.g) || !seuilsValides(f.seuils)) return null;
  let attendu: Contenu;
  try {
    attendu = dailyBlocks(jour, f.g);
  } catch {
    return null;
  }
  const c = f.contenu as Record<string, unknown> | undefined;
  if (attendu.suite) {
    // Règles v1 : le format 2, la suite en texte.
    const texte = c?.suite;
    if (f.format !== FORMAT_JOUR_FIGE_V1 || typeof texte !== "string" || texte.length !== PLAFOND_PIECES || depuisTexte(texte).some((id) => id < 0 || id >= NB_PIECES)) return null;
    if (versTexte(attendu.suite) !== texte) return null;
  } else {
    if (f.format !== FORMAT_JOUR_FIGE || c?.graine !== attendu.graine || typeof c?.empreinte !== "string" || c.empreinte !== empreinteContenu(attendu)) return null;
  }
  const { bronze, silver, gold, author } = f.seuils;
  return { ...attendu, seuilsFiges: { bronze, silver, gold, author } };
}
