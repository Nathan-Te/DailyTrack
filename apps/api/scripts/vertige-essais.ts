import { Partie, T_AVANT, enregistrer, niveauDuContenu, rejouer, scoreParColonnes, type Commande } from "@cdj/vertige-sim";
import { dailyVertige, enchainementDuContenu } from "@cdj/vertige-sim/modules";
import type { ModuleEssais } from "./essais";

// Le module d'essais de « Vertige » (voir `essais.ts`). **La partie d'essai est le robot du jour** (les solutions des modules, jouées bout à bout), retardé : la variante v commence par `1 + (v ÷ 12)` pas d'attente (qui ne comptent pas :
// le chrono part au premier mouvement) pour qu'aucune partie ne reprenne les entrées exactes de l'auteur (le serveur refuse cette copie), puis, avec n = v mod 12, se laisse ralentir 3 × n pas après ses 5 premiers pas de course, repart et court jusqu'au
// premier palier, où l'état redevient canonique (l'aimantation), et rejoue enfin la solution du robot. Les temps sont ainsi tous différents, de plus en plus longs ; la variante 0 a le temps du robot, le Diamant. Un entier quelconque
// donne une partie (le smoke tire le sien : la recette garde les parties des passages d'avant). Le score attendu est celui que le serveur doit retrouver en rejouant la rediffusion.
const PAS_AVANT_LA_PAUSE = 5;
/** La pause (en tiers de seconde de 40 pas, 0 à 11) et l'attente du début (1 à 300 pas) d'une variante : `variante` quelconque (le smoke en tire un entier au hasard) donne l'un des 3 600 couples, jamais une partie démesurée. */
const PAUSES = 12;
const ATTENTES = 300;
const neutre: Commande = { k: 0, dl: 0, dt: 0 };
const course: Commande = { k: T_AVANT, dl: 0, dt: 0 };

export const ESSAIS_VERTIGE: ModuleEssais = {
  variantes: 12,
  partie(jour, versions, variante) {
    const contenu = dailyVertige(jour, versions.generatorVersion);
    const e = enchainementDuContenu(contenu);
    const v = Math.abs(Math.trunc(variante));
    const n = v % PAUSES;
    const attente = 1 + (Math.floor(v / PAUSES) % ATTENTES);
    const commandes: Commande[] = Array.from({ length: attente }, () => neutre);
    const p = new Partie(niveauDuContenu(contenu));
    const jouer = (c: Commande): void => {
      commandes.push(c);
      p.avancer(c);
    };
    for (let i = 0; i < attente; i++) p.avancer(neutre);
    for (let i = 0; i < PAS_AVANT_LA_PAUSE; i++) jouer(e.solution[i]!);
    for (let i = 0; i < 3 * n; i++) jouer(neutre);
    while (p.captures === 0 && !p.finie) jouer(course); // la course jusqu'au premier palier : l'état redevient canonique
    for (let i = e.paliersRobot[0]!; i < e.solution.length && !p.finie; i++) jouer(e.solution[i]!);
    const rediffusion = enregistrer(contenu, commandes);
    return { rediffusion, attendu: scoreParColonnes(rejouer(contenu, rediffusion)) };
  },
};
