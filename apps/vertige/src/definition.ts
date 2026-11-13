import { VERTIGE_GENERATOR_VERSION, VERTIGE_SIM_VERSION, TICKS_PAR_SECONDE, VARIANTE, numeroVertige, seuilsDuJour, themeDuJour, type Contenu } from "@cdj/vertige-sim";
import { formatDay } from "@cdj/core";
import { dateDemandable, lireFichierDeJour } from "@cdj/kit/jour";
import type { DefinitionJeu } from "@cdj/kit/jeu/types";
import { BUILD_RESTRICTED } from "@cdj/kit/stockage";
import { ACTIONS_VERTIGE } from "./actions";
import { lireEssai } from "./essai";

// La définition de « Vertige » pour `brancherJeu` : sa simulation, son rendu, son aide. Tout le reste est le kit. **Le corps du jeu (Three.js, la scène, les commandes, le décor) est à la demande** (`corps.ts`) :
// `contenuDuJour` le charge pendant que l'accueil s'affiche ; `nouvellePartie` ne vient qu'après.
declare const __JOURS_FIGES__: readonly string[] | undefined;
const JOURS_FIGES: readonly string[] = typeof __JOURS_FIGES__ === "undefined" ? [] : __JOURS_FIGES__;
let corps: typeof import("./corps") | null = null;

/**
 * Le contenu d'un jour : le fichier figé s'il existe (`jours/AAAA-MM-JJ.json`) et se relit, sinon le générateur courant (lot V3 : le niveau du jour assemblé de modules). **Le générateur et la bibliothèque de modules sont à la demande**
 * (`@cdj/vertige-sim/modules`, budget `vertige.jsCss`) : ils se chargent ici, pendant que l'accueil s'affiche ; le contenu rendu porte le temps du robot, donc `seuils` et `medaille` n'ont plus besoin de la bibliothèque.
 */
async function contenuDuJour(jour: number, base: string): Promise<Contenu> {
  const gen = await import("@cdj/vertige-sim/modules");
  gen.enregistrerNiveauDuJour();
  const date = formatDay(jour);
  if (dateDemandable(date, import.meta.env.VITE_PRODUCTION === "1", JOURS_FIGES)) {
    try {
      const lu = gen.lireJourFige(await lireFichierDeJour("jours", date, base, 4000));
      if (lu) return lu;
    } catch {
      /* absent ou abîmé : le générateur */
    }
  }
  return gen.dailyVertige(jour, VERTIGE_GENERATOR_VERSION);
}

export const DEFINITION: DefinitionJeu<Contenu> = {
  ticksParSeconde: TICKS_PAR_SECONDE,
  versions: { simVersion: VERTIGE_SIM_VERSION, generatorVersion: VERTIGE_GENERATOR_VERSION },
  actions: ACTIONS_VERTIGE,
  themeDuJour,
  numero: numeroVertige,
  async contenuDuJour(jour, base) {
    const [contenu, module] = await Promise.all([contenuDuJour(jour, base), corps ? Promise.resolve(corps) : import("./corps")]);
    corps = module;
    return contenu;
  },
  // Lot V3 : le Diamant est le temps du robot (les solutions des modules du jour jouées bout à bout), l'or, l'argent et le bronze en sont des pourcentages (le barème de la fiche) ; un jour figé garde ses seuils.
  seuils: (c) => seuilsDuJour(c),
  medaille: (score, s) => VARIANTE.medaille(score, s),
  nouvellePartie: (c, hote, o) => corps!.nouvellePartieVertige(c, hote, o),
  // Le fantôme « Diamant » : le robot du jour, rejoué sous la forme d'une rediffusion de ce jour.
  rediffusionDiamant: (c) => corps!.rediffusionDiamantVertige(c),
  // Une partie d'essai (scénario, sensations réglées) n'est jamais classée ; en production ces options n'existent pas.
  classable: (adresse) => !lireEssai(adresse, BUILD_RESTRICTED).essai,
  formatScore: (score, langue) => VARIANTE.formatScore(score, langue),
  scorePartage: (score, langue) => VARIANTE.scorePartage(score, langue),
  aide: ["aide.point1", "aide.point2", "aide.point3"],
};
