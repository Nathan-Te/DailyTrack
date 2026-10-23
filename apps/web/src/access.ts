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
 * Mode restreint = production. Le site de production (playdujour.com) est construit avec `VITE_PRODUCTION=1` (`deploy-site.yml`, lot R4) ; la
 * recette, les aperçus de PR, le serveur de développement et les tests ne l'ont pas. `?prod` force le mode restreint (essais) : il ne peut que **restreindre** — rien dans
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
  /** Clé du catalogue du message à montrer au joueur (`course.notice.*`), ou `""`. */
  notice: string;
}

/** Refus décidés par l'adresse en production ; hors production, tout passe. */
export function judgeAddress(a: AddressRequest): AddressVerdict {
  if (!a.restricted) return { seedDay: a.seedDay, dropTrial: false, notice: "" };
  const futureSeed = a.seedDay !== null && a.seedDay > a.today;
  const seedDay = futureSeed ? null : a.seedDay;
  const target = seedDay ?? a.today;
  const dropTrial = a.trial && target >= a.today; // un thème ou une variante forcés ne valent que pour un jour passé
  if (futureSeed) return { seedDay, dropTrial, notice: "course.notice.pasDisponible" };
  if (dropTrial) return { seedDay, dropTrial, notice: "course.notice.essaisReserves" };
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

/** Lot 46 : la scène demandée par l'adresse — un palier, des pas en plus (`+vie`, `+ciel`, `+ombres`), des pas ou des parties coupés (`-ombres`, `-particules`…). */
export interface SceneDemandee {
  palier: "existant" | "P1" | "P2" | "P3";
  plus: string[];
  coupes: string[];
}

/**
 * Lot 46 : `?palier=1|2|3|existant` impose le palier de la scène, `?reglages=` le palier et ses pas un à un (`2+vie+ciel` : le palier 2 et le groupe « vie
 * et ciel » des téléphones récents ; `3-particules`) — **en recette et dans les aperçus seulement**, sans rien enregistrer ; jamais en production. Illisible : `null`.
 */
export function sceneDemandee(search: string, restricted: boolean): SceneDemandee | null {
  if (restricted) return null;
  const q = new URLSearchParams(search);
  // Un `+` écrit tel quel dans une adresse se lit comme une espace (`?reglages=2+vie+ciel`) : on le rétablit.
  const r = (q.get("reglages") ?? q.get("palier"))?.replace(/ /g, "+");
  if (r === "existant") return { palier: "existant", plus: [], coupes: [] };
  const m = /^([123])((?:[+-][a-z]+)*)$/.exec(r ?? "");
  if (!m) return null;
  const d: SceneDemandee = { palier: `P${m[1]}` as SceneDemandee["palier"], plus: [], coupes: [] };
  for (const [, signe, id] of m[2]!.matchAll(/([+-])([a-z]+)/g)) (signe === "+" ? d.plus : d.coupes).push(id!);
  return d;
}
