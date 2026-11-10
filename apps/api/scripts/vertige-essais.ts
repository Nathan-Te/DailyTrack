import { dailyVertige, decoderRediffusion, enregistrer, rejouer, scoreParColonnes } from "@cdj/vertige-sim";
import { PARTIES_ESSAIS } from "@cdj/vertige-sim/essais";
import type { ModuleEssais } from "./essais";

// Le module d'essais de « Vertige » (voir `essais.ts`). La variante n joue l'une des douze parties d'essai du parcours (`PARTIES_ESSAIS`, produites avec le golden : le même joueur scripté, un regard de plus en plus
// tremblant) ; un entier quelconque donne une partie (le smoke tire le sien : la recette garde les parties des passages d'avant). La partie est réécrite pour le jour joué : ses commandes ne dépendent pas du jour.
export const ESSAIS_VERTIGE: ModuleEssais = {
  variantes: PARTIES_ESSAIS.length,
  partie(jour, versions, variante) {
    const contenu = dailyVertige(jour, versions.generatorVersion);
    const modele = PARTIES_ESSAIS[Math.abs(variante) % PARTIES_ESSAIS.length]!;
    const commandes = decoderRediffusion(modele.code).commandes;
    return { rediffusion: enregistrer(contenu, commandes), attendu: scoreParColonnes(rejouer(contenu, enregistrer(contenu, commandes))) };
  },
};
