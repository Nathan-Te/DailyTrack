import { BLOCKS_GENERATOR_VERSION, BLOCKS_SIM_VERSION, TICKS_PAR_SECONDE, VARIANTE, dailyBlocks, lireJourFige, medailleDe, numeroBlocks, seuilsDe, themeDuJour, touchesDuBot, enregistrer, type Contenu } from "@cdj/blocks-sim";
import { formatDay } from "@cdj/core";
import { dateDemandable, lireFichierDeJour } from "@cdj/kit/jour";
import type { DefinitionJeu } from "@cdj/kit/jeu/types";
import { nouvellePartieBlocks } from "./scene";

// La définition de « Blocks » pour `brancherJeu` : sa simulation, son rendu, son aide. Tout le reste est le kit. **Moins de 100 lignes de glue** : c'est la mesure du lot K4f.
declare const __JOURS_FIGES__: readonly string[] | undefined;
const JOURS_FIGES: readonly string[] = typeof __JOURS_FIGES__ === "undefined" ? [] : __JOURS_FIGES__;

/** Le contenu d'un jour : le fichier figé s'il existe (`jours/AAAA-MM-JJ.json`) et se relit, sinon le générateur courant. */
async function contenuDuJour(jour: number, base: string): Promise<Contenu> {
  const date = formatDay(jour);
  if (dateDemandable(date, import.meta.env.VITE_PRODUCTION === "1", JOURS_FIGES)) {
    try {
      const lu = lireJourFige(await lireFichierDeJour("jours", date, base, 4000));
      if (lu) return lu;
    } catch {
      /* absent ou abîmé : le générateur */
    }
  }
  return dailyBlocks(jour, BLOCKS_GENERATOR_VERSION);
}

export const DEFINITION: DefinitionJeu<Contenu> = {
  ticksParSeconde: TICKS_PAR_SECONDE,
  versions: { simVersion: BLOCKS_SIM_VERSION, generatorVersion: BLOCKS_GENERATOR_VERSION },
  actions: [
    { id: "gauche", clavier: ["ArrowLeft", "KeyA"], manette: null },
    { id: "droite", clavier: ["ArrowRight", "KeyD"], manette: null },
    { id: "haut", clavier: ["ArrowUp", "KeyW"], manette: null },
    { id: "bas", clavier: ["ArrowDown", "KeyS"], manette: null },
    { id: "toucher", clavier: ["Space", "KeyX"], manette: "b0" },
  ],
  themeDuJour,
  numero: numeroBlocks,
  contenuDuJour,
  seuils: (c) => seuilsDe(c),
  medaille: (score, s) => medailleDe(score, s),
  nouvellePartie: nouvellePartieBlocks,
  rediffusionDiamant: (c) => enregistrer(c, touchesDuBot(c)),
  formatScore: (score, langue) => VARIANTE.formatScore(score, langue),
  scorePartage: (score, langue) => VARIANTE.scorePartage(score, langue),
  aide: ["aide.point1", "aide.point2", "aide.point3"],
};
