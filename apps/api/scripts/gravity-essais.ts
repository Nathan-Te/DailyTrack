import { mixSeed, Rng } from "@cdj/core";
import { dailyGravity, enregistrer, jouer, scoreParColonnes, VARIANTE } from "@cdj/gravity-sim";
import type { ModuleEssais } from "./essais";

// Le module d'essais de « Gravity » (voir `essais.ts`). La variante 0 touche tout, 13 ticks après l'apparition (le bot, lui, touche à 12 : ce n'est pas sa copie) ; une variante n > 0 réagit au hasard (graine = n) en
// 13 à 13 + min(n, 11) ticks et laisse filer des gravity de plus en plus nombreuses. Un entier quelconque donne une partie différente (le smoke tire le sien : la recette garde les parties des passages d'avant).
export const ESSAIS_GRAVITY: ModuleEssais = {
  variantes: 12,
  partie(jour, versions, variante) {
    const contenu = dailyGravity(jour, versions.generatorVersion);
    const rng = new Rng(mixSeed(variante, 0xe55a1));
    const lenteur = Math.min(variante, 11);
    // Le joueur scripté de la variante : il laisse filer (`score`) ou hésite (`temps`) une cible de temps en temps ; le hasard de l'essai décide, dans un ordre fixe (la cible ratée, puis son délai).
    const touches = VARIANTE.joueur(
      contenu,
      () => 13 + (variante > 0 ? rng.int(1 + lenteur) : 0),
      () => variante > 0 && rng.chance(Math.min(60, 4 * variante)),
    );
    const r = jouer(contenu, touches);
    return { rediffusion: enregistrer(contenu, touches), attendu: scoreParColonnes(r) };
  },
};
