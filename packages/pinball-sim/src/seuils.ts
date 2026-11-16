import { mixSeed } from "@cdj/core";
import { TICKS_PAR_SECONDE } from "./constantes";
import { cleDeTable, type Contenu } from "./generateur";
import { Partie } from "./partie";
import { REGLAGES, type Reglages } from "./reglages";
import { jouerRobotEnTranches } from "./robot";
import type { Seuils } from "./types";
import { billesCoincees, SuiviModules, tirsDisperses, type RapportBilles } from "./validation";

// LES SEUILS DES MÉDAILLES (lot PB4, définitifs) — seed : « Le robot joue la table du jour plusieurs parties fixées d'avance. Ses scores donnent les seuils Bronze, Argent, Or et Diamant, en pourcentages réglés par
// Nathan. Les seuils sont figés avec la table. » Le robot (`robot.ts`) joue `PARTIES_DU_ROBOT` parties de `DUREE_PARTIE_ROBOT` pas, chacune avec sa graine d'imprécision fixée d'avance (`graineDuRobot`) :
// **Diamant = le meilleur de ses scores** ; Or, Argent et Bronze en sont des **pourcentages** (`POURCENT_*`), arrondis à la centaine. Ils remplacent les seuils provisoires du lot PB1 (les mêmes tous les jours).
//
// **Un jour figé fige aussi ses seuils** (`jours.ts`) : le fichier de jour porte `seuils` et `bot` ; `seuilsDuJour` lit ceux du fichier avant tout calcul. Changer le robot ou ces constantes
// (`PINBALL_BOT_VERSION`) ne change donc jamais un jour figé, et change l'empreinte d'un jour protégé sans fichier (la mise en production s'arrête).
//
// **Qui calcule, et quand.** Le robot met de 3 à 5 secondes à jouer une table (mesures : README du lot PB4) : il ne tourne **jamais à chaque partie**. (1) `npm run figer:pinball` (job `figer` de « Mettre en production »)
// et `npm run preparer:pinball` (les jours à venir : `preparer` de la fiche) écrivent les seuils dans le fichier de chaque jour : le serveur et le jeu les y lisent, le robot ne tourne pas. (2) Un jour sans fichier
// (un jour d'archive, d'essai, de recette) est calculé **une fois** par table (`cleDeTable` : le résultat ne dépend que d'elle) : par le serveur (le module des jeux garde le niveau d'un jour) et, côté jeu, **en
// arrière-plan** pendant la première partie (`seuilsEnTranches`, `apps/pinball/src/niveau.ts`).

/** Le robot joue 4 parties par table, de 2 minutes chacune au plus (72 000 pas) : le coût d'une table est celui de 8 minutes de jeu (≈ 4 secondes). Mesures et justification : README du lot PB4. */
export const PARTIES_DU_ROBOT = 4;
export const DUREE_PARTIE_ROBOT = 120 * TICKS_PAR_SECONDE;
/**
 * **Les pourcentages du meilleur score du robot** (Diamant) que valent les trois autres médailles. **Nathan les règle** (ils montent `PINBALL_BOT_VERSION`). Valeurs de départ : Bronze 15 % (la partie d'un joueur
 * qui sait à peine viser, sans mission), Argent 35 % (une bonne partie sans mission), Or 60 % (la mission et une partie propre) — justifiées par la répartition des scores du robot dans le README du lot PB4.
 */
export const POURCENT_BRONZE = 15;
export const POURCENT_ARGENT = 35;
export const POURCENT_OR = 60;
/** La graine d'imprécision de la partie `k` du robot (0 à `PARTIES_DU_ROBOT − 1`) : fixée d'avance, la même pour toutes les tables. */
export const graineDuRobot = (k: number): number => mixSeed(0x524f42, k + 1);

/** Le score arrondi à la centaine (au plus proche). */
const centaine = (n: number): number => Math.trunc((n + 50) / 100) * 100;

/**
 * Les seuils d'après les scores des parties du robot : Diamant le meilleur, les autres en pourcentages ; **strictement croissants** même quand les scores sont minuscules (chacun gagne au moins 100 de plus que
 * le précédent), au moins 100.
 */
export function seuilsDesScores(scores: readonly number[]): Seuils {
  const meilleur = Math.max(1, ...scores);
  const author = Math.max(400, centaine(meilleur));
  const part = (pourcent: number): number => centaine(Math.trunc((author * pourcent) / 100));
  const bronze = Math.max(100, part(POURCENT_BRONZE));
  const silver = Math.max(bronze + 100, part(POURCENT_ARGENT));
  const gold = Math.max(silver + 100, part(POURCENT_OR));
  return { bronze, silver, gold, author: Math.max(gold + 100, author) };
}

/** Des seuils valides : quatre entiers positifs, strictement croissants. */
export const seuilsValides = (s: unknown): s is Seuils => {
  if (typeof s !== "object" || s === null) return false;
  const { bronze, silver, gold, author } = s as Partial<Seuils>;
  const ok = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 1;
  return ok(bronze) && ok(silver) && ok(gold) && ok(author) && bronze < silver && silver < gold && gold < author;
};

/** Ce que le robot a fait sur une table : ses parties, et — pour la validation — ce que la table a montré. */
export interface AnalyseTable {
  /** Les scores, les durées (pas) et la mission des parties du robot. */
  scores: number[];
  ticks: number[];
  missions: boolean[];
  seuils: Seuils;
  /** Les pas simulés par le robot pour décider (le coût), toutes parties. */
  pasSimules: number;
  /** La validation (`analyserTable` seulement) : les billes lâchées, les modules jamais touchés, la mission réussie par une partie du robot, par une partie quelconque. */
  billes?: RapportBilles;
  manquants?: string[];
  missionRobot?: boolean;
  mission?: boolean;
  ok?: boolean;
  raisons?: string[];
}

const MEMOIRE = new Map<string, Seuils>();
const MEMOIRE_MAX = 16;

/** Les parties du robot (en tranches), avec le suivi des modules si on le donne. */
function* partiesDuRobot(contenu: Contenu, suivi?: SuiviModules, reglages: Reglages = REGLAGES): Generator<void, AnalyseTable, undefined> {
  const scores: number[] = [];
  const ticks: number[] = [];
  const missions: boolean[] = [];
  let pasSimules = 0;
  for (let k = 0; k < PARTIES_DU_ROBOT; k++) {
    const r = yield* jouerRobotEnTranches(contenu, graineDuRobot(k), { maxTicks: DUREE_PARTIE_ROBOT, reglages, ...(suivi ? { surPas: (p) => suivi.pas(p) } : {}) });
    scores.push(r.partie.score);
    ticks.push(r.partie.tick);
    missions.push(r.partie.missionFaite);
    pasSimules += r.pasSimules;
  }
  return { scores, ticks, missions, seuils: seuilsDesScores(scores), pasSimules };
}

/**
 * Les seuils d'un jour d'après le robot, **en tranches** (le générateur rend la main après chaque frappe essayée : un navigateur le fait tourner en arrière-plan). Gardés en mémoire par table (`cleDeTable` : seize
 * tables) : une table n'est jouée qu'une fois par processus, quel que soit le jour où elle tombe.
 */
export function* seuilsEnTranches(contenu: Contenu): Generator<void, Seuils, undefined> {
  const cle = cleDeTable(contenu);
  const connu = MEMOIRE.get(cle);
  if (connu) return { ...connu };
  const a = yield* partiesDuRobot(contenu);
  if (MEMOIRE.size >= MEMOIRE_MAX) MEMOIRE.delete(MEMOIRE.keys().next().value!);
  MEMOIRE.set(cle, a.seuils);
  return { ...a.seuils };
}

/** Les seuils d'un jour d'après le robot, d'un trait (quelques secondes la première fois pour une table). */
export function seuilsDuRobot(contenu: Contenu): Seuils {
  const g = seuilsEnTranches(contenu);
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}

/**
 * **L'analyse complète d'une table** (la validation, `validation.ts`, et les seuils) : la grille des billes lâchées, les parties du robot (avec le suivi des modules touchés) et 119 lancers dispersés. Une table est
 * valide quand aucune bille n'est coincée, que chaque module est touché au moins une fois (par le robot ou un lancer) et que la mission est réussie au moins une fois (par le robot). En tranches comme le reste (l'outil et les tests la lancent d'un trait).
 */
export function* analyserTableEnTranches(contenu: Contenu, reglages: Reglages = REGLAGES): Generator<void, AnalyseTable, undefined> {
  const billes = billesCoincees(contenu, reglages);
  yield;
  const suivi = new SuiviModules(new Partie(contenu, reglages).table);
  const a = yield* partiesDuRobot(contenu, suivi, reglages);
  const missionRobot = suivi.mission;
  tirsDisperses(contenu, suivi, reglages);
  const manquants = suivi.manquants();
  const raisons: string[] = [];
  if (billes.coincee) raisons.push(`bille coincée : lâchée en (${billes.coincee.x}, ${billes.coincee.y}) à (${billes.coincee.vx}, ${billes.coincee.vy}) px/s`);
  for (const m of manquants) raisons.push(`module jamais touché : ${m}`);
  if (!suivi.mission) raisons.push("mission jamais réussie");
  return { ...a, billes, manquants, missionRobot, mission: suivi.mission, ok: raisons.length === 0, raisons };
}

/** `analyserTableEnTranches` d'un trait. */
export function analyserTable(contenu: Contenu, reglages: Reglages = REGLAGES): AnalyseTable {
  const g = analyserTableEnTranches(contenu, reglages);
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}

/**
 * **Les seuils d'un jour tel qu'on le sert** : ceux figés avec le jour s'il vient d'un fichier de jour (`Contenu.seuilsFiges`), sinon ceux du robot. Le serveur et le jeu passent par cette seule fonction : changer le
 * calcul ne change jamais un jour déjà figé.
 */
export const seuilsDuJour = (contenu: Contenu): Seuils => contenu.seuilsFiges ?? seuilsDuRobot(contenu);
