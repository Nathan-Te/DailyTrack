import { mixSeed, Rng } from "@cdj/core";
import { dailyPilepoil, enregistrer, jouer, joueurScripte, scoreParColonnes } from "@cdj/pilepoil-sim";
import type { ModuleEssais } from "./essais";

// Le module d'essais de « Pile poil » (voir `essais.ts`). La variante 0 appuie à 9 000 du centre au plus (que des « pile ») ; une variante n > 0 appuie à un écart tiré au hasard (graine = n), de plus en plus
// large, et laisse filer une jauge de temps en temps. Un entier quelconque donne une partie différente (le smoke tire le sien : la recette garde les parties des passages d'avant).
export const ESSAIS_PILEPOIL: ModuleEssais = {
  variantes: 12,
  partie(jour, versions, variante) {
    const contenu = dailyPilepoil(jour, versions.generatorVersion);
    const rng = new Rng(mixSeed(variante, 0xe55a1));
    const largeur = 9000 + 8000 * Math.min(variante, 11);
    const ecarts = contenu.jauges.map(() => (variante > 0 && rng.chance(Math.min(40, 3 * variante)) ? null : 9000 + (variante > 0 ? rng.int(largeur) : 0)));
    const appuis = joueurScripte(contenu.jauges, (i) => ecarts[i] ?? null);
    return { rediffusion: enregistrer(contenu, appuis), attendu: scoreParColonnes(jouer(contenu.jauges, appuis)) };
  },
};
