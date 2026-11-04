import { BLOCKS_GENERATOR_VERSION, contenuDeScenario, dailyBlocks, lireJourFige, type Contenu } from "@cdj/blocks-sim";
import { parisDay } from "@cdj/clock";
import { formatDay } from "@cdj/core";
import { dateDemandable, lireFichierDeJour } from "@cdj/kit/jour";
import { BUILD_RESTRICTED } from "@cdj/kit/stockage";
import { lireEssai } from "./essai";

// LE CORPS du jeu (chargé à la demande : `definition.ts` l'importe par `import()` au premier appel de `contenuDuJour`, que l'accueil lance dès son premier dessin, donc avant JOUER) : le tirage de la suite, les scénarios,
// la scène et les blocs communs. Il n'est pas dans le premier chargement (ligne de budget `blocks.jsCss`, préfixe `corps-` de `budget.aLaDemande` de la fiche).
export { nouvellePartieBlocks } from "./scene";

declare const __JOURS_FIGES__: readonly string[] | undefined;
const JOURS_FIGES: readonly string[] = typeof __JOURS_FIGES__ === "undefined" ? [] : __JOURS_FIGES__;

/** Le contenu d'un jour : un scénario d'essai ou une rampe réglée si l'adresse le demande (jamais en production), sinon le fichier figé s'il existe (`jours/AAAA-MM-JJ.json`) et se relit, sinon le générateur courant. */
export async function contenuDuJour(jour: number, base: string): Promise<Contenu> {
  const essai = lireEssai(location.search, BUILD_RESTRICTED, parisDay(Date.now()));
  if (essai.scenario) return contenuDeScenario(essai.scenario);
  if (essai.rampe) return dailyBlocks(jour, BLOCKS_GENERATOR_VERSION, essai.rampe);
  const date = formatDay(jour);
  if (dateDemandable(date, import.meta.env.VITE_PRODUCTION === "1", JOURS_FIGES)) {
    try {
      const lu = lireJourFige(await lireFichierDeJour("jours", date, base, 20000));
      if (lu) return lu;
    } catch {
      /* absent ou abîmé : le générateur */
    }
  }
  return dailyBlocks(jour, BLOCKS_GENERATOR_VERSION);
}
