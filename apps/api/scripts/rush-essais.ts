import { mixSeed, Rng } from "@cdj/core";
import { choixParDefaut, dailyRush, enregistrer, entree, jouer, jouerLePilote, scoreParColonnes, type Changement, type Choix } from "@cdj/rush-sim";
import type { ModuleEssais } from "./essais";

// Le module d'essais de « Rush » (voir `essais.ts`). La variante 0 est la partie du pilote ; une variante n > 0 joue une partie agitée tirée de la graine n (elle court, frappe et esquive sans viser) : un entier quelconque
// donne une partie différente (le smoke tire le sien : la recette garde les parties des passages d'avant). Le score attendu est celui que le serveur doit retrouver en rejouant la rediffusion.
export const ESSAIS_RUSH: ModuleEssais = {
  variantes: 12,
  partie(jour, versions, variante) {
    const contenu = dailyRush(jour, versions.generatorVersion);
    let changements: Changement[];
    let choix: Choix[];
    let competence: number;
    if (variante === 0) {
      const bot = jouerLePilote(contenu);
      changements = bot.changements;
      choix = bot.choix;
      competence = bot.competence;
    } else {
      const rng = new Rng(mixSeed(variante, 0xe55a1));
      changements = [];
      for (let tick = 0; tick < 1200; tick += 6 + rng.int(14)) changements.push({ tick, e: entree(rng.int(33) - 1, rng.chance(35), rng.chance(12)) });
      competence = rng.int(3); // lot BR5 : la compétence se choisit au départ
      choix = choixParDefaut(contenu, changements, 0, undefined, competence); // un niveau gagné demande un choix (la première carte)
    }
    const r = jouer(contenu, changements, undefined, choix, competence);
    return { rediffusion: enregistrer(contenu, changements, choix, competence), attendu: scoreParColonnes(r) };
  },
};
