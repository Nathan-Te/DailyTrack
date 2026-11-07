import { BLOCKS_GENERATOR_VERSION, contenuDeScenario, dailyBlocks, enregistrer, lireJourFige, rejouer, seuilsDuJour, type Contenu, type Seuils } from "@cdj/blocks-sim";

import { partieDuDiamant } from "@cdj/blocks-sim/diamant";
import { formatDay } from "@cdj/core";
import { dateDemandable, lireFichierDeJour } from "@cdj/kit/jour";
import { BUILD_RESTRICTED } from "@cdj/kit/stockage";
import type { OptionsPartie, PartieDuJeu } from "@cdj/kit/jeu/types";
import type { ThemeBlocks } from "@cdj/blocks-sim";
import { chargerPalette, poserPalette } from "./couleurs";
import { chargerDecorTheme, poserDecor } from "./decors/index";
import { lireEssai } from "./essai";
import { exempleDePartage } from "./exemple";
import { nouvellePartieBlocks as scene } from "./scene";

/** Pour la page de vérification (`verify.ts`) : la simulation du corps du jeu, rien de plus. */
export { contenuDeScenario, dailyBlocks, rejouer };

// LE CORPS du jeu (chargé à la demande : `definition.ts` l'importe par `import()` au premier appel de `contenuDuJour`, que l'accueil lance dès son premier dessin, donc avant JOUER) : le tirage de la suite, les scénarios,
// la scène et les blocs communs. Il n'est pas dans le premier chargement (ligne de budget `blocks.jsCss`, préfixe `corps-` de `budget.aLaDemande` de la fiche).

/**
 * Une partie : la scène, avec le bot Diamant si l'adresse le demande (`&bot`, essai local : jamais en production). Lot B4 — `?scenario=partage` : la
 * partie finit tout de suite sur un résultat d'exemple. Deux essais locaux, jamais classés.
 */
export function nouvellePartieBlocks(contenu: Contenu, hote: HTMLElement, o: OptionsPartie): PartieDuJeu {
  const essai = lireEssai(location.search, BUILD_RESTRICTED);
  return scene(contenu, hote, o, { bot: essai.bot, exemple: essai.mode === "partage" ? exempleDePartage(contenu, essai.exemple ?? "argent") : null });
}

/** La rediffusion de la partie du bot Diamant sur la suite du jour, **arrêtée après `PIECES_DU_DIAMANT` pièces** (lot B8b : la partie n'est pas finie, ce n'est donc pas une rediffusion que le serveur accepte) : la partie qu'on revoit (lot B5 : plus de fantôme). Gardée par suite du jour. */
const diamantsGardes = new WeakMap<Contenu, string>();
export function rediffusionDuDiamant(contenu: Contenu): string {
  let r = diamantsGardes.get(contenu);
  if (r === undefined) {
    r = enregistrer(contenu, partieDuDiamant(contenu).actions);
    diamantsGardes.set(contenu, r);
  }
  return r;
}

declare const __JOURS_FIGES__: readonly string[] | undefined;
const JOURS_FIGES: readonly string[] = typeof __JOURS_FIGES__ === "undefined" ? [] : __JOURS_FIGES__;

/** Le contenu d'un jour : un scénario d'essai ou une rampe réglée si l'adresse le demande (jamais en production), sinon le fichier figé s'il existe (`jours/AAAA-MM-JJ.json`) et se relit, sinon le générateur courant. */
export async function contenuDuJour(jour: number, base: string, theme: string): Promise<Contenu> {
  // La palette et le décor du thème (celui du jour, ou `?theme=` : le kit le donne) sont prêts avant la scène ; un décor qui ne charge pas laisse le ciel en aplat.
  const [palette, decor] = await Promise.all([chargerPalette(theme), chargerDecorTheme(theme as ThemeBlocks).catch(() => null)]);
  poserPalette(palette);
  poserDecor(decor);
  const contenu = await contenuSansPalette(jour, base);
  return contenu;
}

async function contenuSansPalette(jour: number, base: string): Promise<Contenu> {
  const essai = lireEssai(location.search, BUILD_RESTRICTED);
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

/** Les seuils des médailles d'un jour (**ceux du fichier de jour s'il y en a un : un jour figé fige ses seuils**), sinon les constantes de cette version des règles (lot B8b : plus aucun bot à appeler). */
export const seuilsDeBlocks = (contenu: Contenu): Seuils => seuilsDuJour(contenu);
