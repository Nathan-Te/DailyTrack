import { mixSeed, Rng } from "@cdj/core";
import { actionDe, COLONNES, dailyBlocks, enregistrer, LIGNES, Partie, scoreParColonnes, TAILLE_SERIE } from "@cdj/blocks-sim";
import { coupGlouton } from "@cdj/blocks-sim/glouton";
import type { ModuleEssais } from "./essais";

// Le module d'essais de « Blocks » (voir `essais.ts`). La variante 0 est le bot moyen du paquet (`@cdj/blocks-sim/glouton`, règles v2 : trois pièces, un emplacement par pose) ; une variante n > 0 joue au hasard (graine = n) : la première pose est une position légale
// autre que la meilleure, puis, avec une probabilité de min(60, 4 × n) %, une position légale quelconque (n'importe quel emplacement) au lieu de la meilleure. Un entier quelconque donne une partie différente (le smoke tire le sien : la recette garde les
// parties des passages d'avant). Toute partie est jouée jusqu'à sa fin (le serveur refuse une partie inachevée).
export const ESSAIS_BLOCKS: ModuleEssais = {
  variantes: 12,
  partie(jour, versions, variante) {
    const contenu = dailyBlocks(jour, versions.generatorVersion);
    const rng = new Rng(mixSeed(variante, 0xe55a1));
    const partie = new Partie(contenu);
    const actions: number[] = [];
    while (!partie.finie) {
      let choix = coupGlouton(partie)!;
      // Une variante > 0 s'écarte du bot dès la première pose (sinon deux variantes pourraient donner la même partie, que le serveur refuse comme copie), puis de temps en temps.
      if (variante > 0 && (actions.length === 0 || rng.chance(Math.min(60, 4 * variante)))) {
        const legales: { emplacement: number; col: number; ligne: number }[] = [];
        for (let emplacement = 0; emplacement < TAILLE_SERIE; emplacement++) for (let ligne = 0; ligne < LIGNES; ligne++) for (let col = 0; col < COLONNES; col++) if (partie.legale(emplacement, col, ligne) && !(actions.length === 0 && emplacement === choix.emplacement && col === choix.col && ligne === choix.ligne)) legales.push({ emplacement, col, ligne });
        if (legales.length > 0) choix = rng.pick(legales);
      }
      partie.poser(choix.emplacement, choix.col, choix.ligne);
      actions.push(actionDe(choix.emplacement, choix.col, choix.ligne));
    }
    return { rediffusion: enregistrer(contenu, actions), attendu: scoreParColonnes(partie.resultat()!) };
  },
};
