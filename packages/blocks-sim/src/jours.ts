import { formatDay, parseDay } from "@cdj/core";
import { BLOCKS_BOT_VERSION, BLOCKS_GENERATOR_VERSION, PLAFOND_PIECES } from "./constantes";
import { dailyBlocks, type Contenu, reglesDe } from "./generateur";
import type { Seuils } from "./medailles";
import { NB_PIECES } from "./pieces";

// Un jour figé : `apps/blocks/public/jours/AAAA-MM-JJ.json`, le contenu tel qu'il a été servi, avec les versions qui l'ont produit. Un jour figé ne change plus (règle R11) ; le jeu et le serveur lisent
// le fichier d'abord, sinon génèrent avec la version courante. La suite s'écrit en un texte (un caractère par pièce : le code `48 + id`, de `0` à `T`) : 2 000 caractères, pas 2 000 lignes. Pas de preuve.
// **Format 2 : le fichier porte aussi les SEUILS des médailles** (le Diamant, partie du bot du jeu, et l'or, l'argent et le bronze qui s'en déduisent) et la version du bot qui les a calculés. Un jour figé fige ses
// seuils, comme Jump et Tower figent leurs médailles : si le bot ou ses fractions changent (`BLOCKS_BOT_VERSION`), les jours déjà figés gardent ceux qu'on a servis. Le calcul (le bot) est dans `diamant.ts`,
// hors de ce module (qui est dans le premier chargement) : `figerJourDuDiamant` y fabrique le fichier.
// **Lot B8 (règles v2)** : un fichier dit les règles qui l'ont produit (`sim` 2, tirage `g` 4, bot 2). Un fichier figé AVANT le lot B8 (`sim` 1, `g` 3, bot 1) se relit toujours : le serveur le rejoue en v1 (`v1.ts`) et ses seuils
// sont ceux du fichier ; le jeu v2 ne sait pas le jouer. Les jours figés gardent donc leurs règles, leurs seuils et leurs scores ; les règles v2 valent pour tous les autres jours.

export const FORMAT_JOUR_FIGE = 2;

export interface JourFige {
  format: 2;
  jeu: "blocks";
  date: string;
  g: number;
  sim: number;
  /** La version du bot (et des fractions des médailles) qui a calculé `seuils`. */
  bot: number;
  /** Les seuils des médailles de ce jour : `author` est le Diamant. Quatre entiers strictement croissants (bronze < argent < or < Diamant). */
  seuils: Seuils;
  contenu: { suite: string };
}

const versTexte = (suite: readonly number[]): string => suite.map((id) => String.fromCharCode(48 + id)).join("");
const depuisTexte = (t: string): number[] => [...t].map((ch) => ch.charCodeAt(0) - 48);

/** Des seuils sont-ils valides (quatre entiers positifs, strictement croissants) ? */
export const seuilsValides = (s: unknown): s is Seuils => {
  if (typeof s !== "object" || s === null) return false;
  const { bronze, silver, gold, author } = s as Partial<Seuils>;
  const ok = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 1;
  return ok(bronze) && ok(silver) && ok(gold) && ok(author) && bronze < silver && silver < gold && gold < author;
};

/** Le fichier d'un jour, avec les seuils qu'on lui donne (le bot les calcule : `figerJourDuDiamant`, `diamant.ts`). */
export function figerJour(jour: number, seuils: Seuils, version: number = BLOCKS_GENERATOR_VERSION, bot: number = BLOCKS_BOT_VERSION): JourFige {
  if (!seuilsValides(seuils)) throw new Error("seuils invalides : quatre entiers strictement croissants attendus");
  const c = dailyBlocks(jour, version);
  return { format: FORMAT_JOUR_FIGE, jeu: "blocks", date: formatDay(jour), g: c.g, sim: reglesDe(version), bot, seuils: { bronze: seuils.bronze, silver: seuils.silver, gold: seuils.gold, author: seuils.author }, contenu: { suite: versTexte(c.suite) } };
}

/** Lit un fichier de jour : rend le contenu (avec `seuilsFiges`), ou null si le fichier ne se relit pas (forme, seuils) ou n'est plus ce que sa version génère. */
export function lireJourFige(brut: unknown): Contenu | null {
  if (typeof brut !== "object" || brut === null) return null;
  const f = brut as Partial<JourFige>;
  if (f.format !== FORMAT_JOUR_FIGE || f.jeu !== "blocks" || typeof f.date !== "string" || typeof f.g !== "number" || typeof f.sim !== "number" || typeof f.bot !== "number") return null;
  const jour = parseDay(f.date);
  if (jour === null || f.sim !== reglesDe(f.g) || !seuilsValides(f.seuils)) return null;
  const texte = f.contenu?.suite;
  if (typeof texte !== "string" || texte.length !== PLAFOND_PIECES || depuisTexte(texte).some((id) => id < 0 || id >= NB_PIECES)) return null;
  let attendu: Contenu;
  try {
    attendu = dailyBlocks(jour, f.g);
  } catch {
    return null;
  }
  if (versTexte(attendu.suite) !== texte) return null;
  const { bronze, silver, gold, author } = f.seuils;
  return { ...attendu, seuilsFiges: { bronze, silver, gold, author } };
}
