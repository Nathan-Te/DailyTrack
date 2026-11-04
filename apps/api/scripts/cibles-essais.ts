import { mixSeed, Rng } from "@cdj/core";
import { dailyCibles, enregistrer, jouer, type Touche } from "@cdj/cibles-sim";
import type { ModuleEssais } from "./essais";

// Le module d'essais de « Cibles » (voir `essais.ts`). La variante 0 touche tout, 13 ticks après l'apparition (le bot, lui, touche à 12 : ce n'est pas sa copie) ; une variante n > 0 réagit au hasard (graine = n) en
// 13 à 13 + min(n, 11) ticks et laisse filer des cibles de plus en plus nombreuses. Un entier quelconque donne une partie différente (le smoke tire le sien : la recette garde les parties des passages d'avant).
export const ESSAIS_CIBLES: ModuleEssais = {
  variantes: 12,
  partie(jour, versions, variante) {
    const contenu = dailyCibles(jour, versions.generatorVersion);
    const rng = new Rng(mixSeed(variante, 0xe55a1));
    const lenteur = Math.min(variante, 11);
    const touches: Touche[] = [];
    for (const x of contenu.cibles) {
      const rate = variante > 0 && rng.chance(Math.min(60, 4 * variante));
      const delai = 13 + (variante > 0 ? rng.int(1 + lenteur) : 0);
      if (!rate) touches.push({ tick: x.d + delai, c: x.c });
    }
    const r = jouer(contenu, touches);
    return { rediffusion: enregistrer(contenu, touches), attendu: { touches: r.touches, dernier: r.dernier } };
  },
};
