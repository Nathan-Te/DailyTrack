import type { ClasseDuJour, MedaillePortail } from "./games";

// Lot I3 (plateforme, phase 3) : les **points du jour** et le **classement du jour tous jeux confondus**. Calcul pur (testé : `test/classementDuJour.test.ts`) ;
// les routes et le cache sont dans `portail.ts`. Ce fichier ne connaît aucun jeu : il reçoit, pour chaque jeu qui existe ce jour-là, la liste de ses
// classés **dans l'ordre du classement prouvé du jeu** (crochet `portail.classes`), et la médaille de chacun.
//
// **Barème** (une seule constante, facile à recalibrer) : médaille d'auteur 4 · or 3 · argent 2 · bronze 1 · fini sans médaille 0, par jeu ; le total du
// jour est la somme sur les jeux du jour.
// **Qui est classé** : tous les joueurs qui ont fini (été classés dans) au moins un jeu du jour.
// **Ordre** : (1) les points, du plus grand au plus petit ; (2) à égalité, la **somme des rangs** dans chaque jeu, la plus petite d'abord — un jeu non fini
// compte pour le nombre de classés de ce jeu + 1 ; (3) encore à égalité, le **premier à avoir atteint son total** : l'horodatage le plus tardif de ses
// essais classés (celui qui lui a donné son dernier point) ; (4) enfin l'identifiant, pour qu'un ordre toujours le même sorte de deux égalités parfaites.
// Seul le classement prouvé compte : aucun temps annoncé n'entre ici.

/** Le barème des points par médaille (lot I3). Changer une valeur ici change tout (la route le rend aussi : le portail explique le barème avec lui). */
export const BAREME_POINTS: Readonly<Record<MedaillePortail, number>> = { author: 4, gold: 3, silver: 2, bronze: 1 };

/** Les points d'un jeu fini : la médaille, ou 0 sans médaille. */
export const pointsDe = (medaille: MedaillePortail | null): number => (medaille ? BAREME_POINTS[medaille] : 0);

/** Un jeu du jour et ses classés (dans l'ordre de son classement). */
export interface JeuClasses {
  jeu: string;
  classes: readonly ClasseDuJour[];
}

/** Ce qu'un joueur a fait dans un jeu : sa place et sa médaille. */
export interface ResultatJeu {
  rang: number;
  medaille: MedaillePortail | null;
}

/** Un joueur classé du jour. `resultats[i]` : son résultat dans le jeu n° i de `ClassementDuJour.jeux`, `null` s'il ne l'a pas fini. */
export interface LigneDuJour {
  id: string;
  points: number;
  sommeRangs: number;
  /** L'horodatage de l'essai classé qui lui a donné son total (le plus tardif de ses essais classés). */
  at: number;
  resultats: (ResultatJeu | null)[];
}

/** Le classement d'un jour, trié (le premier d'abord). */
export interface ClassementDuJour {
  /** Les codes des jeux du jour, dans l'ordre de `resultats`. */
  jeux: string[];
  /** Le nombre de classés de chaque jeu (même ordre). */
  classesParJeu: number[];
  lignes: LigneDuJour[];
  /** Identifiant → position dans `lignes`. */
  index: Map<string, number>;
}

/** L'ordre du classement du jour : points, somme des rangs, premier arrivé à son total, identifiant. */
export function comparer(a: Pick<LigneDuJour, "id" | "points" | "sommeRangs" | "at">, b: Pick<LigneDuJour, "id" | "points" | "sommeRangs" | "at">): number {
  return b.points - a.points || a.sommeRangs - b.sommeRangs || a.at - b.at || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

/** Le classement du jour à partir des classés de chaque jeu du jour. Pur. */
export function classerLaJournee(jeux: readonly JeuClasses[]): ClassementDuJour {
  const classesParJeu = jeux.map((j) => j.classes.length);
  const parJoueur = new Map<string, LigneDuJour>();
  jeux.forEach((j, g) => {
    j.classes.forEach((c, i) => {
      let ligne = parJoueur.get(c.playerId);
      if (!ligne) {
        ligne = { id: c.playerId, points: 0, sommeRangs: 0, at: 0, resultats: jeux.map(() => null) };
        parJoueur.set(c.playerId, ligne);
      }
      ligne.resultats[g] = { rang: i + 1, medaille: c.medaille };
      ligne.points += pointsDe(c.medaille);
      ligne.at = Math.max(ligne.at, c.at);
    });
  });
  const lignes = [...parJoueur.values()];
  for (const l of lignes) l.sommeRangs = sommeDesRangs(l.resultats, classesParJeu);
  lignes.sort(comparer);
  return { jeux: jeux.map((j) => j.jeu), classesParJeu, lignes, index: new Map(lignes.map((l, i) => [l.id, i])) };
}

/** La somme des rangs : un jeu non fini compte pour le nombre de classés de ce jeu + 1. */
export function sommeDesRangs(resultats: readonly (ResultatJeu | null)[], classesParJeu: readonly number[]): number {
  return resultats.reduce<number>((s, r, g) => s + (r ? r.rang : (classesParJeu[g] ?? 0) + 1), 0);
}

/**
 * Où se place un joueur dont on connaît le résultat **exact** (ses états dans chaque jeu, lus à l'instant) alors que le classement gardé peut dater
 * de quelques dizaines de secondes. Gardé et au même total : sa place gardée. Absent (il vient de finir) ou total changé : on l'insère après tous
 * ceux qui ont autant de points et une somme de rangs au plus égale (il vient de finir : il est le dernier arrivé à son total), en ne se comptant pas
 * deux fois s'il figure dans l'ancien classement. `classes` compte les joueurs du classement gardé, plus lui s'il n'y était pas.
 */
export function placer(c: ClassementDuJour, moi: { id: string; points: number; sommeRangs: number }): { rang: number; classes: number } {
  const gardee = c.index.get(moi.id);
  if (gardee !== undefined && c.lignes[gardee]!.points === moi.points) return { rang: gardee + 1, classes: c.lignes.length };
  let lo = 0;
  let hi = c.lignes.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const l = c.lignes[mid]!;
    if (l.points > moi.points || (l.points === moi.points && l.sommeRangs <= moi.sommeRangs)) lo = mid + 1;
    else hi = mid;
  }
  const devant = gardee !== undefined && gardee < lo ? lo - 1 : lo;
  return { rang: devant + 1, classes: c.lignes.length + (gardee === undefined ? 1 : 0) };
}
