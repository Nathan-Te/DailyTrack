import type { KeyValueStore } from "./identity";

// La langue commune de la plateforme (lot I1, phase 3) : `fr` ou `en`, **la même pour le portail et tous les jeux** (même origine, même
// stockage, même clé). Première visite : la langue du navigateur (`navigator.languages`, passée par l'appelant : ce module ne lit jamais
// `navigator`) ; ensuite le choix fait au portail (ou plus tard dans un jeu) est mémorisé. Seul un choix explicite est écrit : tant que le
// joueur n'a rien choisi, la détection suit son navigateur.

/** La clé de la langue choisie (`fr` ou `en`). */
export const LANGUE_KEY = "cdj:langue";
export const LANGUES = ["fr", "en"] as const;
export type Langue = (typeof LANGUES)[number];

export function estLangue(x: unknown): x is Langue {
  return x === "fr" || x === "en";
}

/** Langue détectée d'après les préférences du navigateur : la première ; tout ce qui commence par `fr` → français, sinon anglais. */
export function detecterLangue(langues: readonly string[] | undefined | null): Langue {
  const premiere = langues?.find((l) => typeof l === "string" && l.trim() !== "");
  return premiere?.trim().toLowerCase().startsWith("fr") ? "fr" : "en";
}

/**
 * La langue de la plateforme pour ce navigateur : celle choisie (clé `cdj:langue`) si elle est valide, sinon celle du navigateur. `choisie`
 * dit si elle vient d'un choix mémorisé. Ne lève jamais (stockage absent ou refusé : la détection).
 */
export function lireLangue(stockage: Pick<KeyValueStore, "getItem"> | null, langues: readonly string[] | undefined | null): { langue: Langue; choisie: boolean } {
  try {
    const v = stockage?.getItem(LANGUE_KEY);
    if (estLangue(v)) return { langue: v, choisie: true };
  } catch {
    // stockage refusé (navigation privée stricte…) : on détecte.
  }
  return { langue: detecterLangue(langues), choisie: false };
}

/** Mémorise un choix de langue pour toute la plateforme. Rend `false` si le stockage refuse (le choix vaut alors pour la page seulement). */
export function ecrireLangue(stockage: Pick<KeyValueStore, "setItem"> | null, langue: Langue): boolean {
  if (!estLangue(langue) || !stockage) return false;
  try {
    stockage.setItem(LANGUE_KEY, langue);
    return true;
  } catch {
    return false;
  }
}
