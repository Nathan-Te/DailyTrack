// Lot U6 — la logique pure du composant de classement (`classement.ts`) : où poser les seuils des médailles dans la liste, la médaille suivante. Sans DOM ni stockage ; ne nomme aucun jeu. Testée dans `test/classementLogique.test.ts`.
// (Les places gagnées ou perdues depuis la dernière visite sont dans `classementRangs.ts` : un module à part, chargé à la demande.)

import type { TypeMedaille } from "./composants";

/** Le sens d'un classement : `petit` — la plus petite valeur gagne (un temps) ; `grand` — la plus grande gagne (une hauteur, des points). */
export type SensClassement = "petit" | "grand";

/** Un seuil de médaille : le type et la valeur à atteindre (en ms, en mm… : celle de la vue). */
export interface Seuil {
  type: TypeMedaille;
  valeur: number;
}

/** Les médailles, de la plus belle à la moins belle : l'ordre des seuils. */
export const ORDRE_MEDAILLES: readonly TypeMedaille[] = ["diamant", "or", "argent", "bronze"];

/** Les noms que le serveur donne aux seuils d'un jour (`author` : la donnée du Diamant) et le type d'interface qui leur répond. */
const NOMS_SERVEUR: Readonly<Record<string, TypeMedaille>> = { author: "diamant", gold: "or", silver: "argent", bronze: "bronze" };

/**
 * Les seuils d'un jour tels que le serveur les donne (`{ author, gold, silver, bronze }`), du meilleur au moins bon. `null` quand il n'y en a pas : jeu sans médaille, niveau pas encore prêt, valeur illisible — la
 * liste n'a alors aucune ligne de seuil.
 */
export function seuilsDuServeur(brut: unknown): Seuil[] | null {
  if (!brut || typeof brut !== "object") return null;
  const o = brut as Record<string, unknown>;
  const seuils: Seuil[] = [];
  for (const [nom, type] of Object.entries(NOMS_SERVEUR)) {
    const v = o[nom];
    if (typeof v === "number" && Number.isFinite(v)) seuils.push({ type, valeur: v });
  }
  seuils.sort((a, b) => ORDRE_MEDAILLES.indexOf(a.type) - ORDRE_MEDAILLES.indexOf(b.type));
  return seuils.length > 0 ? seuils : null;
}

/** Cette valeur a-t-elle la médaille de ce seuil ? */
export const atteint = (valeur: number, seuil: Seuil, sens: SensClassement): boolean => (sens === "petit" ? valeur <= seuil.valeur : valeur >= seuil.valeur);

/** Le plus petit écart qui reste à la valeur pour atteindre le seuil (toujours positif ; 0 si elle l'a déjà). */
export const manque = (valeur: number, seuil: Seuil, sens: SensClassement): number => Math.max(0, sens === "petit" ? valeur - seuil.valeur : seuil.valeur - valeur);

/** La prochaine médaille à gagner : le meilleur seuil que la valeur n'atteint pas encore ; `null` s'ils sont tous atteints, ou sans seuils. */
export function prochaineMedaille(valeur: number, seuils: readonly Seuil[] | null, sens: SensClassement): Seuil | null {
  if (!seuils) return null;
  // Du moins beau au plus beau : le dernier seuil non atteint est celui qui vient juste après la médaille que le joueur a.
  for (let i = seuils.length - 1; i >= 0; i--) if (!atteint(valeur, seuils[i]!, sens)) return seuils[i]!;
  return null;
}

/**
 * Les seuils à écrire **avant** chaque ligne de la liste (celle qui suit le podium) : « Or · 32,000 s » sépare ceux qui ont la médaille de ceux qui la visent. `valeurs` : la valeur de chaque ligne de la liste,
 * dans l'ordre (`null` : pas de résultat) ; `troisieme` : la valeur de la 3e place du podium (`null` : pas de podium complet). On part de la médaille de la 3e place : les seuils plus beaux qu'elle sont
 * déjà derrière le podium. Sans seuils, ou si la 3e place n'a aucune médaille : rien.
 * Rend, par position dans `valeurs`, la liste des seuils à poser juste avant cette ligne (un seuil que personne n'a dépassé, tout en bas, n'est jamais écrit).
 */
export function seuilsAvant(valeurs: readonly (number | null)[], seuils: readonly Seuil[] | null, sens: SensClassement, troisieme: number | null): Map<number, Seuil[]> {
  const avant = new Map<number, Seuil[]>();
  if (!seuils || seuils.length === 0 || troisieme === null) return avant;
  let palier = seuils.findIndex((s) => atteint(troisieme, s, sens));
  if (palier < 0) return avant;
  valeurs.forEach((v, i) => {
    if (v === null) return;
    while (palier < seuils.length && !atteint(v, seuils[palier]!, sens)) {
      const a = avant.get(i) ?? [];
      a.push(seuils[palier]!);
      avant.set(i, a);
      palier++;
    }
  });
  return avant;
}
