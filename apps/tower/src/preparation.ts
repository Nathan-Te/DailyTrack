import { formatDay } from "@cdj/core";
import { type Contenu, estimationGeometrique, estBonus, type Medailles, medailleObtenue, medailleVisee, type NomMedaille, numeroTower, type Scenario } from "@cdj/tower-sim";
import { chargerJour, type JourDuJeu } from "./jour";
import { type EtatMedailles, SANS_MEDAILLES } from "./medailles";
import { choisirJour, type OptionsUrl, PRODUCTION } from "./urlOptions";

// Ce que l'accueil et le jeu savent du contenu à jouer (lot T4) : calculé UNE fois, par l'accueil (qui affiche les paliers et le thème du jour) puis donné au jeu. Le contenu d'un jour est le
// jour figé s'il existe, sinon `dailyTower` au tirage 0 (ou `?tirage=`), exactement comme avant ; les médailles viennent du fichier du jour préparé, de l'estimation géométrique (production
// sans fichier : PROVISOIRES) ou — hors production seulement — du calcul du bot dans un Web Worker (« en calcul » d'abord, voir `jeu.ts`). Rien ici ne charge three.js, la partie ni Rapier.

export interface Preparation {
  /** Le contenu joué : un jour, la suite d'essai ou les paliers. */
  contenu: Scenario;
  /** Le jour (numéro de jour civil) et sa date AAAA-MM-JJ ; `null` pour un scénario d'essai. */
  jour: number | null;
  date: string | null;
  /** Le numéro de la tour (`numeroTower`), ou `null` (scénario, ou avant le premier jour : on écrit alors la date). */
  numero: number | null;
  /** Une date future refusée sur la production : c'est le jour d'aujourd'hui qui s'ouvre, et le jeu le dit. */
  refuse: boolean;
  jourLu: JourDuJeu | null;
  medailles: EtatMedailles;
  /** Le thème posé sur la scène (`?theme=`, hors production, sinon celui du jour ; le port pour un scénario). */
  theme: NonNullable<Contenu["theme"]>;
  /** Le jour joué est-il celui d'aujourd'hui (le seul qui se classe) ? */
  estAujourdhui: boolean;
}

/** Le contenu d'un jour : lu une fois, médailles comprises. */
export async function preparerJour(options: OptionsUrl, aujourdhui: number): Promise<Preparation> {
  const choix = choisirJour(options.seed, aujourdhui, PRODUCTION);
  const jourLu = await chargerJour(choix.jour, options.tirage);
  let medailles: EtatMedailles = SANS_MEDAILLES;
  if (jourLu.medailles) medailles = { medailles: jourLu.medailles, provisoire: false, enCalcul: false };
  else if (PRODUCTION) medailles = { medailles: estimationGeometrique(jourLu.contenu), provisoire: true, enCalcul: false };
  else medailles = { medailles: null, provisoire: false, enCalcul: true };
  const numero = numeroTower(choix.jour);
  return {
    contenu: jourLu.contenu,
    jour: choix.jour,
    date: formatDay(choix.jour),
    numero: numero >= 1 ? numero : null,
    refuse: choix.refuse,
    jourLu,
    medailles,
    theme: options.theme ?? jourLu.contenu.theme ?? "port",
    estAujourdhui: choix.jour === aujourdhui,
  };
}

/** La suite d'essai ou les paliers (`?scenario=`, hors production) : un outil, sans jour ni médailles. Les scénarios sont à la demande (lot T3b). */
export async function preparerScenario(options: OptionsUrl): Promise<Preparation> {
  const outils = await import("@cdj/tower-sim/scenarios/outils");
  const contenu = options.scenario === "paliers" ? outils.scenarioPaliers(options.effet) : options.scenario === "alignement" ? outils.SCENARIO_ALIGNEMENT : outils.SCENARIO_ESSAI;
  return { contenu, jour: null, date: null, numero: null, refuse: false, jourLu: null, medailles: SANS_MEDAILLES, theme: options.theme ?? "port", estAujourdhui: false };
}

/** Ce que dit la tuile « Ton record » de l'accueil : la médaille que la hauteur a obtenue et la prochaine à viser (`null` : le Diamant est atteint, ou les seuils ne sont pas connus). */
export function etatDuRecord(hauteurMm: number, medailles: Medailles | null): { obtenue: NomMedaille | null; visee: { nom: NomMedaille; seuil: number } | null } {
  if (!medailles) return { obtenue: null, visee: null };
  const visee = medailleVisee(hauteurMm, medailles);
  return { obtenue: medailleObtenue(hauteurMm, medailles), visee: visee ? { nom: visee.nom, seuil: visee.seuil } : null };
}

/** Les paliers du jour pour l'accueil : la hauteur, l'effet, bonus ou malus. */
export function paliersDuJour(contenu: Scenario): { metres: number; effet: string; bonus: boolean }[] {
  return (contenu.paliers ?? []).map((p) => ({ metres: p.metres, effet: p.effet, bonus: estBonus(p.effet) }));
}

/** Largeur de la plateforme du jour en mètres (5 à 8). */
export const largeurPlateforme = (contenu: Scenario): number => contenu.plateformeDemi8 / 4;
