// Lot U6 — les places gagnées ou perdues (▲2, ▼2) depuis la dernière visite : la logique pure, sans DOM ni stockage (le stockage est passé : `lireRangs` reçoit le texte, `noterRangs` rend l'état à écrire) ; ne nomme aucun jeu.
// **Un module à part de `classementLogique.ts`, chargé à la demande** (le portail l'importe en parallèle de la lecture du classement : il ne pèse rien dans le premier chargement de la page). Testée dans `test/classementLogique.test.ts`.

/** Une visite dure tant que la page est relue moins de 30 minutes après la précédente : la page se redessine souvent, une visite n'efface pas ses propres changements. */
export const VISITE_MS = 30 * 60 * 1000;
/** Combien de classements (jour × vue × filtre) le navigateur garde : les plus récemment vus. */
export const VUES_GARDEES_MAX = 10;
/** La clé du stockage du navigateur : une donnée de jeu, effacée au « Nouveau départ » (préfixe `cdj:`, jamais dans `CLES_GARDEES`) ; nommée dans les deux pages des mentions légales. */
export const CLE_RANGS = "cdj:classement:rangs";

interface VueGardee {
  /** Le dernier instant où la page a vu ce classement (ms). */
  at: number;
  /** Les rangs de la visite d'avant (référence → rang) ; vide à la première visite. */
  avant: Record<string, number>;
  /** Les rangs vus pendant la visite en cours. */
  courant: Record<string, number>;
}
export interface RangsGardes {
  v: 1;
  vues: Record<string, VueGardee>;
}

export const rangsVides = (): RangsGardes => ({ v: 1, vues: {} });

const lireTable = (v: unknown): Record<string, number> =>
  Object.fromEntries(Object.entries(v && typeof v === "object" ? v : {}).filter(([k, r]) => k.length <= 40 && Number.isInteger(r) && (r as number) > 0 && (r as number) < 1_000_000)) as Record<string, number>;

/** Lit ce que le navigateur garde (le texte du stockage, ou `null`) ; tout ce qui est illisible est ignoré : on repart de rien. Ne lève jamais. */
export function lireRangs(brut: string | null): RangsGardes {
  try {
    const o = JSON.parse(brut ?? "null") as Partial<RangsGardes> | null;
    if (!o || o.v !== 1 || !o.vues || typeof o.vues !== "object") return rangsVides();
    const vues: Record<string, VueGardee> = {};
    for (const [cle, x] of Object.entries(o.vues)) if (x && Number.isFinite(x.at)) vues[cle] = { at: x.at, avant: lireTable(x.avant), courant: lireTable(x.courant) };
    return { v: 1, vues };
  } catch {
    return rangsVides();
  }
}

/**
 * Note les rangs vus pour un classement (`cle` : jour, vue et filtre) et rend le nouvel état. Première visite : rien à comparer. Nouvelle visite (la dernière date de plus de `VISITE_MS`) : ce qui était vu
 * devient « la visite d'avant ». Même visite : la visite d'avant ne change pas, les rangs vus sont mis à jour. Au plus `VUES_GARDEES_MAX` classements gardés (les plus récents).
 */
export function noterRangs(etat: RangsGardes, cle: string, rangs: Readonly<Record<string, number>>, maintenant: number): RangsGardes {
  const vue = etat.vues[cle];
  const courant = lireTable(rangs);
  const suivante: VueGardee = !vue ? { at: maintenant, avant: {}, courant } : maintenant - vue.at > VISITE_MS ? { at: maintenant, avant: vue.courant, courant } : { at: maintenant, avant: vue.avant, courant };
  const vues = { ...etat.vues, [cle]: suivante };
  const recents = Object.entries(vues).sort((a, b) => b[1].at - a[1].at).slice(0, VUES_GARDEES_MAX);
  return { v: 1, vues: Object.fromEntries(recents) };
}

/** Les places gagnées (> 0) ou perdues (< 0) de chaque ligne depuis la visite d'avant ; une ligne sans changement ou qu'on ne voyait pas alors n'y est pas. */
export function mouvementsDe(etat: RangsGardes, cle: string): Map<string, number> {
  const vue = etat.vues[cle];
  const sortie = new Map<string, number>();
  if (!vue) return sortie;
  for (const [ref, rang] of Object.entries(vue.courant)) {
    const avant = vue.avant[ref];
    if (avant !== undefined && avant !== rang) sortie.set(ref, avant - rang);
  }
  return sortie;
}
