import { daysFromCivil, mixSeed, Rng } from "@cdj/core";
import { cm } from "./constantes";

// La RÉSERVE DE BOSS de Rush (lot BR3) : cinq boss, un par jour, tirés de la graine du jour. Chacun apprend une compétence au joueur et change la valeur des améliorations. Ce fichier porte l'identité des boss (leur ordre, leur
// nom, leur corps, leurs points de vie relatifs, ce qui les favorise), les états et les types partagés avec la vue, et le TIRAGE du boss du jour. Les règles du combat de chaque boss sont dans `partie.ts` (elles ont besoin de tout le monde).
// **L'ordre de la liste ne change jamais sans monter `RUSH_SIM_VERSION`** (le contenu du jour et l'empreinte en dépendent).

export const BOSS_IDS = ["golem", "reine", "grand-duc", "belier", "chene"] as const;
export type BossId = (typeof BOSS_IDS)[number];
export const NB_BOSS = BOSS_IDS.length;
export const B_GOLEM = 0;
export const B_REINE = 1;
export const B_DUC = 2;
export const B_BELIER = 3;
export const B_CHENE = 4;
/** L'indice d'un boss d'après son identifiant d'adresse (`&boss=grand-duc`), ou −1. */
export const indiceBoss = (id: string): number => BOSS_IDS.indexOf(id as BossId);

// Les états du boss (le golem de BR0 : les quatre premiers) et les types d'attaque et de zone lus par la vue.
export const MARCHE = 0;
export const ANNONCE = 1;
export const RECUPERE = 2;
export const RUGIT = 3;
/** Lot BR3 : le bélier étourdi contre le muret (sans défense, grosse fenêtre). */
export const ETOURDI = 4;
// Les attaques (`Golem.attaque`).
export const POING = 0;
export const ONDE = 1;
export const PIERRES = 2;
/** La reine gelée : un bond écrasant (un cercle comme le poing, plus large). */
export const BOND = 3;
/** Le grand-duc : un ou deux plongeons en ligne (une bande annoncée au sol). */
export const PLONGEON_DUC = 4;
/** Le bélier : une ou deux charges en ligne droite. */
export const CHARGE = 5;
/** Le vieux chêne : des racines en lignes (ou en étoile), en cercles, un nuage de spores, des gelées invoquées. */
export const RACINES_LIGNES = 6;
export const RACINES_CERCLES = 7;
export const SPORES = 8;
export const INVOCATION = 9;
// Les types de zone (`Zone.type`) : 0 à 2 sont ceux du golem (POING, ONDE, PIERRES, des cercles) ; la BANDE est un segment large (plongeon, charge, racines) ; les SPORES éclatent en un nuage qui reste ; l'INVOCATION n'est pas un danger
// (un anneau qui annonce l'endroit où une gelée va naître).
export const Z_BANDE = 3;
export const Z_SPORES = 4;
export const Z_INVOCATION = 5;

export interface DefinitionBoss {
  id: BossId;
  /** Le rayon de son corps (collision), en unités. */
  rayon: number;
  /** Ses points de vie en % de ceux du golem (`reglages.golemVie`) : calibrés pour qu'un combat sans carte dure 40 à 50 s au pilote qui fonce. */
  vie: number;
  /** Les améliorations qu'il favorise (les deux ou trois qui valent le plus contre lui), pour le pilote et pour le joueur. */
  favorise: readonly string[];
  /** Ce que vaut « Brise-pierre » contre lui, en % de son effet (100 : tout). */
  brise: number;
  /** Son repos entre deux attaques en % de celui du golem (`reglages.golemCadence`). */
  repos: number;
  /** Si l'affinité (`reglages.affinite`) joue contre lui : 0 pour le golem, dont Brise-pierre est déjà l'affinité (+90 % par palier, en plus de la Lame lourde). */
  affin: boolean;
}

export const BOSS: readonly DefinitionBoss[] = [
  { id: "golem", rayon: cm(170), vie: 100, favorise: ["brise-pierre", "lame-lourde"], brise: 100, repos: 100, affin: false },
  { id: "reine", rayon: cm(200), vie: 100, favorise: ["tourbillon", "onde-epee"], brise: 35, repos: 150, affin: true },
  { id: "grand-duc", rayon: cm(140), vie: 58, favorise: ["esquive-vive", "cadence"], brise: 35, repos: 100, affin: true },
  { id: "belier", rayon: cm(180), vie: 100, favorise: ["bottes-legeres", "esquive-longue"], brise: 100, repos: 100, affin: true },
  { id: "chene", rayon: cm(200), vie: 70, favorise: ["allonge", "vol-de-vie"], brise: 35, repos: 140, affin: true },
];

// --- Le tirage du boss du jour -------------------------------------------------------------------------------------------------------------------------------------------------------------------
// Règles : le boss est tiré de la graine du jour, **jamais deux jours de suite le même**, et **chaque boss revient au moins une fois tous les 7 jours** (testé sur deux ans). Le tirage a une MÉMOIRE (qui est venu quand), calculée depuis
// le premier jour de Rush : la suite est la même pour tous, en entiers, mise en cache. Un jour d'avant le premier jour vaut le premier.
const PREMIER_JOUR = daysFromCivil(2026, 11, 2);
const SEL_BOSS = 0x5b0551;
/** Un boss absent depuis autant de jours est OBLIGÉ (le plus en retard passe d'abord) ; sinon on tire parmi ceux qui ne sont pas venus ces deux derniers jours. */
const ABSENCE_OBLIGEE = 5;
const ABSENCE_LIBRE = 3;
const suite: number[] = [];
const derniere: number[] = [];

function etendre(n: number): void {
  if (suite.length === 0) {
    // avant le premier jour, chaque boss est « venu » à un rang différent : le premier jour est tiré aussi
    const ordre = new Rng(mixSeed(PREMIER_JOUR, SEL_BOSS)).shuffle(Array.from({ length: NB_BOSS }, (_, i) => i));
    ordre.forEach((b, rang) => {
      derniere[b] = -1 - rang;
    });
  }
  while (suite.length <= n) {
    const t = suite.length;
    const veille = t > 0 ? suite[t - 1]! : -1;
    const absence = (b: number): number => t - derniere[b]!;
    let choix = -1;
    let retard = 0;
    for (let b = 0; b < NB_BOSS; b++) if (b !== veille && absence(b) >= ABSENCE_OBLIGEE && absence(b) > retard) {
      retard = absence(b);
      choix = b;
    }
    if (choix < 0) {
      const libres: number[] = [];
      for (let b = 0; b < NB_BOSS; b++) if (b !== veille && absence(b) >= ABSENCE_LIBRE) libres.push(b);
      choix = new Rng(mixSeed(PREMIER_JOUR + t, SEL_BOSS)).pick(libres);
    }
    suite.push(choix);
    derniere[choix] = t;
  }
}

/** Le boss du jour (indice dans `BOSS`). */
export function bossDuJour(jour: number): number {
  const n = Math.max(0, jour - PREMIER_JOUR);
  etendre(n);
  return suite[n]!;
}
