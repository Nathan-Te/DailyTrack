import { dailyPinball, enregistrer, jouer, piloter, scoreParColonnes, type Contenu, type Evenement } from "@cdj/pinball-sim";
import type { ModuleEssais } from "./essais";

// Le module d'essais de « Pinball » (voir `essais.ts`). Une partie d'essai est celle du **pilote d'essai** de la simulation (le robot de la maquette : il lance, puis frappe quand la bille arrive sur un batteur)
// arrêtée plus ou moins tôt — la variante 0 le laisse jouer 6 000 pas (10 secondes), la variante n le laisse jouer 6 000 + 4 000 n pas, jusqu'à 12 variantes — et qui lance sa première bille un peu plus tard à chaque
// variante : chacune a donc ses propres événements (le serveur refuse une copie : deux joueurs ne peuvent pas envoyer les mêmes). Pur : aucune base, aucun réseau ; le serveur rejoue la rediffusion pour de vrai.
const memoire = new Map<string, Evenement[]>();
function evenementsDe(contenu: Contenu, pas: number, retard: number): Evenement[] {
  const cle = `${contenu.jour}:${contenu.g}:${pas}:${retard}`;
  let e = memoire.get(cle);
  if (!e) {
    e = piloter(contenu, pas, retard).evenements;
    if (memoire.size > 64) memoire.clear();
    memoire.set(cle, e);
  }
  return e;
}

export const ESSAIS_PINBALL: ModuleEssais = {
  variantes: 12,
  partie(jour, versions, variante) {
    const contenu = dailyPinball(jour, versions.generatorVersion);
    // Un entier quelconque est permis (`recette:seed` en tire de grands) : la variante est ramenée à 0-999 ; seules les douze premières allongent la partie.
    const v = ((Math.trunc(variante) % 1000) + 1000) % 1000;
    const evenements = evenementsDe(contenu, 6000 + 4000 * Math.min(v, 11), 3 + v);
    return { rediffusion: enregistrer(contenu, evenements), attendu: scoreParColonnes(jouer(contenu, evenements)) };
  },
};
