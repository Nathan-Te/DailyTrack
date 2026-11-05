import { BLOCKS_GENERATOR_VERSION, contenuDeScenario, dailyBlocks, enregistrer, lireJourFige, type Contenu, type Seuils } from "@cdj/blocks-sim";
import { jouerDiamant, seuilsDuJour } from "@cdj/blocks-sim/diamant";
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

/** La rediffusion de la partie du bot Diamant sur la suite du jour (une rediffusion valide, rejouée par `jouer`) : la partie qu'on revoit (lot B5 : plus de fantôme). Gardée par suite du jour. */
const diamantsGardes = new WeakMap<Contenu, string>();
export function rediffusionDuDiamant(contenu: Contenu): string {
  let r = diamantsGardes.get(contenu);
  if (r === undefined) {
    r = enregistrer(contenu, jouerDiamant(contenu).actions);
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
  // Le Diamant (le bot joue la partie entière : quelques dizaines de millisecondes) se calcule pendant que l'accueil attend, jamais en pleine partie ; l'écran de fin le trouve prêt.
  const plusTard: (f: () => void) => void = typeof requestIdleCallback === "function" ? (f) => requestIdleCallback(f, { timeout: 3000 }) : (f) => void setTimeout(f, 300);
  plusTard(() => void seuilsDeBlocks(contenu));
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

/** Les seuils des médailles d'un jour (**ceux du fichier de jour s'il y en a un : un jour figé fige ses seuils**) : le Diamant est la partie du bot (`@cdj/blocks-sim/diamant`), le reste s'en déduit. Gardés par suite du jour ; calculés au premier appel (quelques millisecondes à quelques dizaines). */
const seuilsGardes = new WeakMap<Contenu, Seuils>();
export function seuilsDeBlocks(contenu: Contenu): Seuils {
  let s = seuilsGardes.get(contenu);
  if (!s) {
    s = seuilsDuJour(contenu); // ceux figés avec le jour (fichier de jour), sinon ceux du bot d'aujourd'hui
    seuilsGardes.set(contenu, s);
  }
  return s;
}
