import { Rng, mixSeed } from "./rng";

// Lot V1 (plateforme) — **le sac de thèmes**, la règle commune des deux jeux : jamais deux jours de suite le même thème, et une rotation régulière.
// Aucune logique de jeu : des indices de thèmes (0 à n − 1) et des numéros de jour. Chaque jeu donne le nombre de ses thèmes, son sel, l'ancienne règle
// (qui reste celle des jours déjà servis) et la façon de savoir qu'un jour est servi par l'ancienne règle (Track : le registre des versions ; Jump : le
// fichier de niveau figé).
//
// **La règle.** Les jours se découpent en cycles de n jours alignés sur le numéro de jour (cycle k = les jours k·n à k·n + n − 1 : aucune date écrite).
// Dans chaque cycle, chaque thème sort une fois, dans un ordre tiré de la graine (Fisher-Yates sur `mixSeed(k, sel)`). **Jonction de deux cycles** : le
// dernier thème du cycle k − 1 ne revient pas avant le 3ᵉ jour du cycle k, et l'avant-dernier pas le 1ᵉʳ — donc jamais deux jours de suite, ni A B A, à la
// jonction (seules les deux premières places sont réordonnées, les deux dernières sont celles du tirage : un cycle ne dépend que de son voisin d'avant,
// jamais de toute l'histoire). Deux apparitions d'un même thème sont séparées de 2n − 1 jours au plus.
// **Jonction avec les jours déjà servis** : le premier jour du sac (celui dont la veille est encore à l'ancienne règle) et le suivant évitent le thème des deux
// jours d'avant (`resolu`) ; seul ce jour-là (au plus deux) est remplacé par un autre thème, tiré de la date.
// Le calcul d'un jour est direct : trois cycles au plus, sans cache (le code est dans le premier chargement de Track, son budget est serré : quelques microsecondes par jour).

/** Les règles d'un jeu. */
export interface ReglesSac {
  /** Nombre de thèmes du jeu : **au moins 5**, sinon la jonction n'a pas toujours de solution (vérifié par les tests de chaque jeu, pas à l'exécution : le code est dans le premier chargement de Track). */
  n: number;
  /** Sel du tirage : propre à chaque jeu. */
  sel: number;
  /** Le thème (indice) qu'a donné à ce jour l'ancienne règle, pur : celui d'un jour déjà servi, et ce que le sac évite au premier jour. */
  ancien(jour: number): number;
  /** Ce jour est-il servi par l'ancienne règle (un jour figé d'avant le sac) ? Les autres jours suivent le sac. */
  estAncien(jour: number): boolean;
}

/** L'ordre brut d'un cycle : le tirage de sa graine seule. */
function brut(k: number, n: number, sel: number): number[] {
  return new Rng(mixSeed(k, sel)).shuffle([...Array(n).keys()]);
}

/**
 * L'ordre des thèmes d'un cycle : le tirage de sa graine, avec les deux premières places réordonnées pour la jonction (le thème qui finissait le cycle d'avant
 * n'est ni 1ᵉʳ ni 2ᵉ, celui qui le précédait n'est pas 1ᵉʳ) ; les deux dernières places sont celles du tirage.
 */
export function ordreDuCycle(k: number, n: number, sel: number): readonly number[] {
  const tirage = brut(k, n, sel);
  const avant = brut(k - 1, n, sel);
  const a = avant[n - 1]!; // le dernier du cycle d'avant
  const b = avant[n - 2]!; // l'avant-dernier
  const tete = tirage.slice(0, n - 2);
  const queue = tirage.slice(n - 2);
  const premier = tete.find((t) => t !== a && t !== b)!;
  const reste = tete.filter((t) => t !== premier);
  const second = reste.find((t) => t !== a)!;
  return [premier, second, ...reste.filter((t) => t !== second), ...queue];
}

/** Le thème que donne le sac seul à ce jour (sans tenir compte des jours déjà servis). */
export function themeDuSacBrut(jour: number, n: number, sel: number): number {
  const k = Math.floor(jour / n);
  return ordreDuCycle(k, n, sel)[jour - k * n]!;
}

/** Un autre thème que ceux de `interdits` et que les deux suivants du sac, tiré de la date : le remplaçant d'un jour dont le thème aurait touché un jour déjà servi. */
function remplacant(jour: number, r: ReglesSac, interdits: readonly number[]): number {
  const libres = [...Array(r.n).keys()].filter((t) => ![...interdits, themeDuSacBrut(jour + 1, r.n, r.sel), themeDuSacBrut(jour + 2, r.n, r.sel)].includes(t));
  return libres[new Rng(mixSeed(jour, r.sel ^ 0x5ac)).int(libres.length)]!;
}

/** Le thème d'un jour qui suit le sac, en tenant compte des jours déjà servis juste avant. */
function resolu(jour: number, r: ReglesSac): number {
  const c = themeDuSacBrut(jour, r.n, r.sel);
  if (r.estAncien(jour - 1)) {
    // Le premier jour du sac : ni le thème de la veille ni celui de l'avant-veille (A B A).
    const interdits = [r.ancien(jour - 1), r.ancien(jour - 2)];
    return interdits.includes(c) ? remplacant(jour, r, interdits) : c;
  }
  if (r.estAncien(jour - 2)) {
    // Le deuxième jour : pas le thème de l'avant-veille (A B A), pas celui de la veille.
    const interdits = [r.ancien(jour - 2), resolu(jour - 1, r)];
    return interdits.includes(c) ? remplacant(jour, r, interdits) : c;
  }
  return c;
}

/** Le thème (indice) d'un jour : l'ancienne règle pour un jour déjà servi, le sac pour les autres. */
export function themeDuSac(jour: number, r: ReglesSac): number {
  return r.estAncien(jour) ? r.ancien(jour) : resolu(jour, r);
}
