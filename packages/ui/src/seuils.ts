import type { TypeMedaille } from "./composants";
import { el } from "./dom";

// Lot U6 — les lignes de seuil des médailles (« Or · 32,000 s ») entre deux listes numérotées. **Un module à part de `classement.ts`, chargé à la demande** : seules les vues par jeu ont des seuils (`classementSeuils.ts` du portail ne le demande
// qu'à ce moment) ; sa feuille est `seuils.css`. La logique pure (où poser chaque ligne) est dans `classementLogique.ts`.

/** La ligne d'un seuil de médaille (« Or · 32,000 s ») : un point de la couleur de la médaille entre deux traits en pointillés. Entre deux listes, jamais dans une liste. */
export function seuil(type: TypeMedaille, texte: string): HTMLElement {
  return el("p", { classe: "classement-seuil", attrs: { "data-medaille": type } }, el("i", { classe: `classement-seuil__point classement-seuil__point--${type}`, attrs: { "aria-hidden": "true" } }), texte);
}

/**
 * Pose les lignes d'une liste en **plusieurs listes numérotées** (`ol start`), séparées par les lignes de seuil : `avant` donne, par position dans `lignes`, les éléments à poser juste avant cette ligne.
 * Sans rien à poser : une seule liste. Les lignes de seuil ne sont pas des éléments de liste : le nombre d'éléments reste celui des classés.
 */
export function listeAvecSeuils(lignes: readonly HTMLElement[], avant: ReadonlyMap<number, readonly HTMLElement[]>): HTMLElement[] {
  const sorties: HTMLElement[] = [];
  let courante: HTMLElement[] = [];
  const vider = (): void => {
    if (courante.length === 0) return;
    const debut = Number(courante[0]!.getAttribute("data-rang"));
    sorties.push(el("ol", { classe: "classement-liste", attrs: Number.isInteger(debut) && debut > 1 ? { start: debut } : {} }, ...courante));
    courante = [];
  };
  lignes.forEach((l, i) => {
    const a = avant.get(i);
    if (a && a.length > 0) {
      vider();
      sorties.push(...a);
    }
    courante.push(l);
  });
  vider();
  return sorties;
}
