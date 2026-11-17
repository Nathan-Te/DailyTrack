import type { BilanPartie, Traduire } from "./types";

// Lot PG2 — les deux parties **pures** des écrans « Comment jouer » et de fin qui se gardent sans navigateur : les points de l'aide (une clé seule ou une clé avec son dessin) et le bilan d'une partie (écrit par le catalogue).
// Le DOM est dans `aide.ts` et `partie.ts` ; ce fichier n'importe que des types.

/** Le nombre de lignes du bilan qu'un écran de fin montre (le reste est ignoré : l'écran reste lisible en paysage sur un téléphone). */
export const LIGNES_BILAN_MAX = 8;

/** Un pas de « Comment jouer » : la clé de son texte et, s'il en a un, la fonction de son dessin. */
export interface PasDAide {
  cle: string;
  dessin?: () => SVGElement;
}

/** Les pas d'aide, chacun avec son dessin s'il en a un (`DefinitionJeu.dessinsAide`, par clé) ; une entrée de la table qui ne nomme aucun pas est ignorée. */
export function pointsDAide(aide: readonly string[], dessins?: Readonly<Record<string, () => SVGElement>>): PasDAide[] {
  return aide.map((cle) => {
    const dessin = dessins && Object.prototype.hasOwnProperty.call(dessins, cle) ? dessins[cle] : undefined;
    return dessin ? { cle, dessin } : { cle };
  });
}

export interface BilanEcrit {
  cause: string | null;
  lignes: { libelle: string; valeur: string }[];
}

/** Le bilan écrit par le catalogue (`t`) : la cause, puis les lignes à valeur non vide, `LIGNES_BILAN_MAX` au plus. `null` quand il n'y a rien à montrer (le jeu n'a pas de bilan, ou un bilan vide : l'écran de fin est alors celui d'avant). */
export function ecrireBilan(bilan: BilanPartie | null | undefined, t: Traduire): BilanEcrit | null {
  if (!bilan) return null;
  const cause = bilan.cause ? t(bilan.cause.cle, bilan.cause.params) : null;
  const lignes = bilan.lignes
    .filter((l) => l.valeur.trim() !== "")
    .slice(0, LIGNES_BILAN_MAX)
    .map((l) => ({ libelle: t(l.cle), valeur: l.valeur }));
  return cause || lignes.length > 0 ? { cause, lignes } : null;
}
