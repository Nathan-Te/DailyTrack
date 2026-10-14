// Outils d'essai et circuits à venir (lot 31).
//
// En production (le site publié depuis `main`) on ne peut remonter que dans le passé : les touches N (circuit au hasard) et T (thème
// suivant), `?seed=` / `?day=` d'un jour après aujourd'hui (date de Paris), `?variant=` et `?theme=` pour aujourd'hui ou plus tard
// (ils ne servent qu'à l'admin et aux essais), le dé et les thèmes des archives, `?today=` : tout cela est réservé aux aperçus de branche
// et à `?debug`. Ce module ne contient que la décision (pure, testée) ; `main.ts` l'applique.
//
// **Limite assumée** : le générateur tourne dans le navigateur. Quelqu'un de très motivé peut encore calculer le circuit de demain en lisant
// le code ; on supprime l'accès facile, pas la possibilité technique (il faudrait une graine secrète côté serveur : voir le README du lot 31).

/**
 * Mode restreint = production. Le site publié depuis `main` est construit avec `VITE_PRODUCTION=1` (`pages.yml`) ; les aperçus de branche, le
 * serveur de développement et les tests ne l'ont pas. `?prod` force le mode restreint (essais) : il ne peut que **restreindre** — rien dans
 * l'adresse ne peut lever la restriction d'une construction de production, pas même `?debug`.
 */
export function isRestricted(search: string, buildFlag: string | undefined = import.meta.env.VITE_PRODUCTION as string | undefined): boolean {
  return buildFlag === "1" || new URLSearchParams(search).has("prod");
}

export interface AddressRequest {
  /** `?seed=` / `?day=` lu (jour valide) ou `null`. */
  seedDay: number | null;
  /** `?theme=` ou `?variant=` présent et valide : un circuit d'essai. */
  trial: boolean;
  /** Aujourd'hui (date de Paris). */
  today: number;
  restricted: boolean;
}

export interface AddressVerdict {
  seedDay: number | null;
  /** Le thème et la variante demandés sont ignorés. */
  dropTrial: boolean;
  /** Message court à montrer, ou chaîne vide. */
  notice: string;
}

/** Refus décidés par l'adresse en production ; hors production, tout passe. */
export function judgeAddress(a: AddressRequest): AddressVerdict {
  if (!a.restricted) return { seedDay: a.seedDay, dropTrial: false, notice: "" };
  const futureSeed = a.seedDay !== null && a.seedDay > a.today;
  const seedDay = futureSeed ? null : a.seedDay;
  const target = seedDay ?? a.today;
  const dropTrial = a.trial && target >= a.today; // un thème ou une variante forcés ne valent que pour un jour passé
  if (futureSeed) return { seedDay, dropTrial, notice: "Ce circuit n'est pas encore disponible : voici celui du jour" };
  if (dropTrial) return { seedDay, dropTrial, notice: "Thème et variante forcés : réservés aux essais" };
  return { seedDay, dropTrial, notice: "" };
}

/** Une touche d'essai (N, T) agit-elle ? Jamais en production. */
export const trialKeysAllowed = (restricted: boolean): boolean => !restricted;

/** Adresse sans les paramètres refusés (l'adresse ne garde pas un jour à venir que le jeu a écarté). */
export function withoutRefused(search: string, verdict: AddressVerdict, seedWasFuture: boolean): string {
  const params = new URLSearchParams(search);
  if (seedWasFuture) {
    params.delete("seed");
    params.delete("day");
  }
  if (verdict.dropTrial) {
    params.delete("theme");
    params.delete("variant");
  }
  const q = params.toString();
  return q ? `?${q}` : "";
}
