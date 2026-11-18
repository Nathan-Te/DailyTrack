import "@cdj/ui/src/mouvement.css";
import { CLE_RANGS, lireRangs, mouvementsDe, noterRangs } from "@cdj/ui/src/classementRangs";

export { mouvement } from "@cdj/ui/src/mouvement"; // le dessin (▲2, ▼2) arrive avec le suivi des rangs : un seul morceau à la demande, sa feuille avec lui

// Lot U6 — les places gagnées ou perdues depuis la dernière visite, pour les joueurs (`classement.ts`) et pour les groupes (`classementGroupes.ts`). Le navigateur garde, par jour, par vue et par filtre, les rangs vus
// (`cdj:classement:rangs`, au plus 10 classements : la logique pure est dans `@cdj/ui/src/classementLogique`) ; une visite dure tant que la page est relue moins de 30 min après la précédente. **Une donnée de jeu** :
// effacée au « Nouveau départ » (préfixe `cdj:`, jamais dans `CLES_GARDEES`) et nommée dans les deux pages des mentions légales. Testé dans `test/classementRangs.test.ts`.

type Stockage = Pick<Storage, "getItem" | "setItem">;

/**
 * Note les rangs qu'on voit (`rangs` : référence ou identifiant → rang) pour un classement (`cle` : jour, vue, filtre) et rend les places gagnées (> 0) ou perdues (< 0) depuis la visite d'avant. Seulement sur un jour
 * encore ouvert (`ouvert` : un classement fermé ne bouge plus : rien n'est gardé, rien n'est montré). Sans stockage, ou si le stockage refuse : aucun mouvement ; ne lève jamais.
 */
export function suivreLesRangs(stockage: Stockage | null, cle: string, rangs: Readonly<Record<string, number>>, ouvert: boolean, maintenant: number = Date.now()): Map<string, number> {
  if (!ouvert || !stockage || Object.keys(rangs).length === 0) return new Map();
  try {
    const etat = noterRangs(lireRangs(stockage.getItem(CLE_RANGS)), cle, rangs, maintenant);
    stockage.setItem(CLE_RANGS, JSON.stringify(etat));
    return mouvementsDe(etat, cle);
  } catch {
    return new Map();
  }
}
