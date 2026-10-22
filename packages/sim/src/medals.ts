import { daysFromCivil } from "@cdj/core";

// Les médailles (lots 4 et 35) : seuils d'un jour à partir du temps du pilote, et médaille d'un temps. Dans leur propre fichier (lot 36) : le jeu en a besoin
// dès le premier écran, alors que le générateur (`generator.ts`) n'est calculé que dans un fil de travail.

/** Seuils des médailles des jours d'avant la bascule du lot 35, en multiples du temps de l'auteur (= le temps du pilote, lot 4). */
export const MEDAL_FACTORS = { gold: 1.08, silver: 1.2, bronze: 1.4 } as const;

/**
 * Lot 35 — **médailles calibrées sur de vrais joueurs** (export de production du 22/10/2026 : 38 meilleurs temps sur 9 jours, médiane à 0,90
 * du pilote, le plus rapide de chaque jour entre 0,84 et 0,96) : le temps de l'auteur devient `author` × le temps du pilote, puis or, argent
 * et bronze en multiples de ce temps d'auteur. Sur les jours passés : auteur 5 %, or 32 %, argent 61 %, bronze 87 % des joueurs (cibles :
 * 5–10, 25–35, 50–60, 85–90 %). Pas de correction par thème (1 à 3 jours par thème : l'écart d'un jour à l'autre domine). Détail :
 * docs/lots/lot-35-medailles.md.
 */
export const MEDAL_FACTORS_35 = { author: 0.84, gold: 1.045, silver: 1.07, bronze: 1.13 } as const;

/**
 * Lot 35 — **date de bascule des médailles** : les seuils calibrés valent à partir du **28/10/2026** (premier jour ni joué ni en cours à la
 * mise en production du lot, le même que la bascule du lot 34) ; les jours d'avant gardent leurs médailles (classements, points du portail,
 * journées parfaites, profils inchangés). Le Salon (graines au-delà de tous les jours) suit les nouveaux seuils. Déplacer la bascule (mise en
 * production après le 27/10) : cette constante seulement (rien n'est figé : les seuils se recalculent depuis le temps du pilote).
 */
export const BASCULE_LOT_35 = daysFromCivil(2026, 10, 28);

export type Medal = "author" | "gold" | "silver" | "bronze";

export interface Medals {
  author: number;
  gold: number;
  silver: number;
  bronze: number;
}

/**
 * Seuils des médailles d'un jour (ou d'une graine du Salon) à partir du temps du pilote (`authorMs` des circuits, inchangé). **Toujours
 * passer le jour** : sans lui (`day` = 0), ce sont les seuils d'avant le lot 35.
 */
export function medalsFor(pilotMs: number, day = 0): Medals {
  const f = day < BASCULE_LOT_35 ? { author: 1, ...MEDAL_FACTORS } : MEDAL_FACTORS_35;
  const author = Math.round(pilotMs * f.author);
  return {
    author,
    gold: Math.round(author * f.gold),
    silver: Math.round(author * f.silver),
    bronze: Math.round(author * f.bronze),
  };
}

/** Meilleure médaille obtenue avec ce temps, ou `null`. */
export function medalFor(ms: number, medals: Medals): Medal | null {
  if (ms <= medals.author) return "author";
  if (ms <= medals.gold) return "gold";
  if (ms <= medals.silver) return "silver";
  if (ms <= medals.bronze) return "bronze";
  return null;
}
