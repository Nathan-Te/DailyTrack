import { colonneDe, ligneDe, medailleDe, Partie, seuilsDepuis, type Contenu, type Medaille } from "@cdj/blocks-sim";
import { jouerDiamant } from "@cdj/blocks-sim/diamant";
import type { MedailleExemple } from "./essai";

// Le résultat d'EXEMPLE de `?scenario=partage` (lot B4, essai local, jamais classé) : le début de la partie du bot Diamant sur la suite du jour, arrêté au premier score qui tombe dans la bande de la médaille voulue
// (« aucune » : le dernier score sous le bronze). Le score ne baisse jamais et les seuils croissent : la bande existe presque toujours ; si un saut de score la saute, on prend la première pose qui atteint au moins la médaille.
// Pur et déterministe ; de l'affichage seulement (la rediffusion d'un essai n'est jamais envoyée).
const CODE: Record<Exclude<MedailleExemple, "aucune">, Medaille> = { bronze: "bronze", argent: "silver", or: "gold", diamant: "author" };
const RANG: readonly (Medaille | null)[] = [null, "bronze", "silver", "gold", "author"];

/** Les poses (octets d'action) du résultat d'exemple pour la médaille voulue. */
export function exempleDePartage(contenu: Contenu, voulue: MedailleExemple): number[] {
  const { actions, resultat } = jouerDiamant(contenu);
  if (voulue === "diamant") return actions;
  const seuils = seuilsDepuis(resultat.score);
  const partie = new Partie(contenu);
  const but = voulue === "aucune" ? null : CODE[voulue];
  let dernierSous = 0; // la dernière longueur de préfixe sans médaille (au moins une pose)
  for (let k = 1; k <= actions.length; k++) {
    const a = actions[k - 1]!;
    partie.poser(colonneDe(a), ligneDe(a));
    const m = medailleDe([partie.score], seuils);
    if (but === null) {
      if (m !== null) return actions.slice(0, Math.max(1, dernierSous));
      dernierSous = k;
    } else if (RANG.indexOf(m) >= RANG.indexOf(but)) return actions.slice(0, k);
  }
  return actions;
}
