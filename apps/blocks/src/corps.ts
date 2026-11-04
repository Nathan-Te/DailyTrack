import { BLOCKS_GENERATOR_VERSION, contenuDeScenario, dailyBlocks, lireJourFige, type Contenu, type Seuils } from "@cdj/blocks-sim";
import { seuilsDe } from "@cdj/blocks-sim/diamant";
import { parisDay } from "@cdj/clock";
import { formatDay } from "@cdj/core";
import { dateDemandable, lireFichierDeJour } from "@cdj/kit/jour";
import { BUILD_RESTRICTED } from "@cdj/kit/stockage";
import type { OptionsPartie, PartieDuJeu } from "@cdj/kit/jeu/types";
import { chargerPalette, poserPalette } from "./couleurs";
import { lireEssai } from "./essai";
import { nouvellePartieBlocks as scene } from "./scene";
import { themeAffiche } from "./themeAffiche";

// LE CORPS du jeu (chargé à la demande : `definition.ts` l'importe par `import()` au premier appel de `contenuDuJour`, que l'accueil lance dès son premier dessin, donc avant JOUER) : le tirage de la suite, les scénarios,
// la scène et les blocs communs. Il n'est pas dans le premier chargement (ligne de budget `blocks.jsCss`, préfixe `corps-` de `budget.aLaDemande` de la fiche).

/** Une partie : la scène, avec le bot Diamant si l'adresse le demande (`&bot`, essai local : jamais en production). */
export const nouvellePartieBlocks = (contenu: Contenu, hote: HTMLElement, o: OptionsPartie): PartieDuJeu => scene(contenu, hote, o, { bot: lireEssai(location.search, BUILD_RESTRICTED, parisDay(Date.now())).bot });

declare const __JOURS_FIGES__: readonly string[] | undefined;
const JOURS_FIGES: readonly string[] = typeof __JOURS_FIGES__ === "undefined" ? [] : __JOURS_FIGES__;

/** Le contenu d'un jour : un scénario d'essai ou une rampe réglée si l'adresse le demande (jamais en production), sinon le fichier figé s'il existe (`jours/AAAA-MM-JJ.json`) et se relit, sinon le générateur courant. */
export async function contenuDuJour(jour: number, base: string): Promise<Contenu> {
  poserPalette(await chargerPalette(themeAffiche(jour))); // la palette du thème (celui du jour, ou `?theme=`) est prête avant la scène
  const contenu = await contenuSansPalette(jour, base);
  // Le Diamant (le bot joue la partie entière : quelques dizaines de millisecondes) se calcule pendant que l'accueil attend, jamais en pleine partie ; l'écran de fin le trouve prêt.
  const plusTard: (f: () => void) => void = typeof requestIdleCallback === "function" ? (f) => requestIdleCallback(f, { timeout: 3000 }) : (f) => void setTimeout(f, 300);
  plusTard(() => void seuilsDeBlocks(contenu));
  return contenu;
}

async function contenuSansPalette(jour: number, base: string): Promise<Contenu> {
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

/** Les seuils des médailles d'un jour : le Diamant est la partie du bot (`@cdj/blocks-sim/diamant`), le reste s'en déduit. Gardés par suite du jour ; calculés au premier appel (quelques millisecondes à quelques dizaines). */
const seuilsGardes = new WeakMap<Contenu, Seuils>();
export function seuilsDeBlocks(contenu: Contenu): Seuils {
  let s = seuilsGardes.get(contenu);
  if (!s) {
    s = seuilsDe(contenu);
    seuilsGardes.set(contenu, s);
  }
  return s;
}
