// Lot C1, partie C (plateforme) — le score d'un groupe pour un jour et une vue. Calcul pur (testé : `test/groupesScore.test.ts`) ; la lecture des membres et des résultats est dans `groupes.ts`.
//
// **La règle** : le score d'un groupe est la **moyenne des 3 meilleurs résultats** de ses membres ce jour-là dans la vue (Cumulé, ou un jeu). Un groupe n'est classé que s'il a **au moins 3 membres classés**
// (qui ont un résultat dans la vue) ; sinon il est listé « Moins de 3 classés », sans rang. Le sens dépend de la vue : au temps (Cumulé, Track, Jump) le plus petit est le meilleur, à la hauteur
// (Tower) le plus grand. **Égalité** : la moyenne la plus favorable, puis le **4e meilleur résultat** (un groupe qui en a un devance celui qui n'en a pas ; à valeur égale le 4e le plus favorable), puis
// l'instant où le score a été atteint (le plus tardif des trois essais retenus : le premier arrivé l'emporte), puis l'identifiant (un ordre toujours le même).
// Les entiers restent entiers : on compare des **sommes de trois** (la moyenne × 3), la moyenne affichée est la somme divisée par 3, arrondie au plus proche.

export type Sens = "temps" | "hauteur";

/** Un membre qui a un résultat dans la vue : sa valeur (ms ou mm) et l'instant (ms) de son essai classé. */
export interface ResultatMembre {
  id: string;
  valeur: number;
  at: number;
}

export const CLASSES_MIN = 3;

export interface ScoreGroupe {
  /** Combien de membres ont un résultat dans la vue. */
  classes: number;
  /** Au moins 3 classés. */
  classe: boolean;
  /** La moyenne des 3 meilleurs (arrondie), `null` si moins de 3 classés. */
  score: number | null;
  /** La somme des 3 meilleurs (la moyenne × 3, exacte : sert à comparer), `null` si moins de 3. */
  somme: number | null;
  /** Le 4e meilleur résultat, `null` s'il n'y en a pas. */
  quatrieme: number | null;
  /** Quand le score a été atteint : le plus tardif des trois essais retenus. */
  at: number | null;
  /** Les trois membres retenus (du meilleur au moins bon). */
  retenus: string[];
}

/** Le meilleur d'abord : la plus petite valeur au temps, la plus grande à la hauteur ; à valeur égale le premier arrivé, puis l'identifiant. */
export function meilleurs(resultats: readonly ResultatMembre[], sens: Sens): ResultatMembre[] {
  const signe = sens === "temps" ? 1 : -1;
  return [...resultats].sort((a, b) => signe * (a.valeur - b.valeur) || a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function scoreDuGroupe(resultats: readonly ResultatMembre[], sens: Sens): ScoreGroupe {
  const tries = meilleurs(resultats, sens);
  if (tries.length < CLASSES_MIN) return { classes: tries.length, classe: false, score: null, somme: null, quatrieme: null, at: null, retenus: tries.map((r) => r.id) };
  const trois = tries.slice(0, 3);
  const somme = trois.reduce((s, r) => s + r.valeur, 0);
  return {
    classes: tries.length,
    classe: true,
    score: Math.round(somme / 3),
    somme,
    quatrieme: tries[3]?.valeur ?? null,
    at: Math.max(...trois.map((r) => r.at)),
    retenus: trois.map((r) => r.id),
  };
}

/** L'ordre de deux groupes **classés** dans une vue (le meilleur d'abord). */
export function comparerGroupes(a: { id: string; score: ScoreGroupe }, b: { id: string; score: ScoreGroupe }, sens: Sens): number {
  const signe = sens === "temps" ? 1 : -1;
  const d = signe * (a.score.somme! - b.score.somme!);
  if (d) return d;
  const qa = a.score.quatrieme;
  const qb = b.score.quatrieme;
  if (qa !== qb) {
    if (qa === null) return 1; // un groupe qui a un 4e résultat devance celui qui n'en a pas
    if (qb === null) return -1;
    return signe * (qa - qb);
  }
  if (a.score.at! !== b.score.at!) return a.score.at! < b.score.at! ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Les groupes d'une vue : les classés par rang (1, 2, 3…), puis, sans rang, ceux qui ont moins de 3 classés (le plus de classés d'abord, puis l'identifiant). */
export function classerLesGroupes<T extends { id: string; score: ScoreGroupe }>(groupes: readonly T[], sens: Sens): { classes: (T & { rang: number })[]; moins: T[] } {
  const classes = groupes.filter((g) => g.score.classe).sort((a, b) => comparerGroupes(a, b, sens)).map((g, i) => ({ ...g, rang: i + 1 }));
  const moins = groupes.filter((g) => !g.score.classe).sort((a, b) => b.score.classes - a.score.classes || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return { classes, moins };
}
