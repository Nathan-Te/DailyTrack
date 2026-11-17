import { dailyGravity, enregistrer, jouer, jouerRobot, scoreParColonnes, terrainDuJour, type Contenu } from "@cdj/gravity-sim";
import type { ModuleEssais } from "./essais";

// Le module d'essais de « Gravity » (voir `essais.ts`). Une partie d'essai est celle du **robot** de la simulation (lot GR2 : il joue comme un humain, sans bouclier) arrêtée plus ou moins tôt : la variante 0 le laisse
// jouer 14 000 pas (près de 2 minutes), la variante n le coupe à 14 000 − 1 100 n pas — de plus en plus brève, donc de moins en moins bonne. Chaque variante ajoute un dernier changement du bouton à elle (le serveur refuse une copie :
// deux joueurs ne peuvent pas envoyer les mêmes changements). Pur : aucune base, aucun réseau ; le serveur rejoue la rediffusion pour de vrai.
const PAS_DU_PILOTE = 14000;
const memoire = new Map<string, number[]>();
function changementsDuPilote(contenu: Contenu): number[] {
  const cle = `${contenu.jour}:${contenu.g}`;
  let a = memoire.get(cle);
  if (!a) {
    a = jouerRobot(terrainDuJour(contenu), { maxTicks: PAS_DU_PILOTE }).changements;
    if (memoire.size > 16) memoire.clear();
    memoire.set(cle, a);
  }
  return a;
}

export const ESSAIS_GRAVITY: ModuleEssais = {
  variantes: 12,
  partie(jour, versions, variante) {
    const contenu = dailyGravity(jour, versions.generatorVersion);
    // Un entier quelconque est permis (`recette:seed` en tire de grands) : la variante est ramenée à 0-999, et seules les douze premières raccourcissent la partie.
    const v = ((Math.trunc(variante) % 1000) + 1000) % 1000;
    const limite = Math.max(1200, PAS_DU_PILOTE - Math.min(v, 12) * 1100);
    const changements = changementsDuPilote(contenu).filter((t) => t < limite);
    changements.push((changements[changements.length - 1] ?? 0) + 40 + v);
    return { rediffusion: enregistrer(contenu, changements), attendu: scoreParColonnes(jouer(terrainDuJour(contenu), changements)) };
  },
};
