import { LARGEUR_MORCEAU, MORCEAUX_PAR_THEME, NB_THEMES, POURCENT_DU_ROBOT } from "./constantes";
import { terrainDuJour, type Contenu } from "./generateur";
import { cleDesRegles, type Regles } from "./regles";
import { jouerRobotEnTranches } from "./robot";
import type { Seuils } from "./types";

// Les seuils des médailles (lot GR2, définitifs) : **60 % du score du robot** (`robot.ts`, qui joue le niveau du jour comme un humain en prenant tout ce que le chemin sûr porte) à la fin du 1er thème (bronze), du 2e
// (argent), du 3e (or), puis de la boucle des cinq thèmes (Diamant), arrondis à 10 près. Ils **remplacent** les seuils « sur le papier » du lot GR1 et font partie du niveau : **figés avec lui** (`jours.ts`), puis lus
// par `seuilsDuJour` avant tout calcul — changer le robot (`GRAVITY_BOT_VERSION`) ne change donc jamais un jour figé.
//
// **Qui calcule, et quand.** Le robot met environ une seconde à jouer la boucle des cinq thèmes : il ne tourne **jamais à chaque partie**. (1) `npm run figer:gravity` (le job `figer` de « Mettre en production », avec le
// code alors en production) écrit les seuils dans le fichier de chaque jour protégé : le serveur et le jeu les y lisent. (2) Un jour sans fichier est calculé **une fois** : par le serveur (le module des jeux garde le
// niveau d'un jour en mémoire, `niveauDuJour`) et, côté jeu, **à la fin de la première partie** seulement (`apps/gravity/src/niveau.ts`) — pas en production une fois la fiche munie de `preparer` (voir le README du lot GR2).

// `POURCENT_DU_ROBOT` (60 %, **réglé par Nathan**, lot GR4) est dans `constantes.ts` (lot GR5 : le premier chargement du jeu le lit sans le robot).
/**
 * Les points d'arrêt, en nombre de thèmes parcourus : bronze au bout du 1er thème, argent du 2e, or du 3e, Diamant de la boucle des cinq. **Nathan les règle aussi** (lot GR4) ; la distance de chacun en mètres est
 * `thèmes × MORCEAUX_PAR_THEME × LARGEUR_MORCEAU` (304, 608, 912 et 1 520).
 */
export const THEMES_D_ARRET = { bronze: 1, silver: 2, gold: 3, author: NB_THEMES } as const;
/** Les distances d'arrêt (mètres) : celles de `THEMES_D_ARRET`. */
export const DISTANCES_D_ARRET = {
  bronze: THEMES_D_ARRET.bronze * MORCEAUX_PAR_THEME * LARGEUR_MORCEAU,
  silver: THEMES_D_ARRET.silver * MORCEAUX_PAR_THEME * LARGEUR_MORCEAU,
  gold: THEMES_D_ARRET.gold * MORCEAUX_PAR_THEME * LARGEUR_MORCEAU,
  author: THEMES_D_ARRET.author * MORCEAUX_PAR_THEME * LARGEUR_MORCEAU,
} as const;

/** Lot GR5 : les distances d'arrêt sous des règles données (la longueur d'un thème peut être réglée par un essai) ; celles des règles de la version courante sont `DISTANCES_D_ARRET`. */
export const distancesDArret = (r: Pick<Regles, "morceauxParTheme">): Record<keyof typeof THEMES_D_ARRET, number> => ({
  bronze: THEMES_D_ARRET.bronze * r.morceauxParTheme * LARGEUR_MORCEAU,
  silver: THEMES_D_ARRET.silver * r.morceauxParTheme * LARGEUR_MORCEAU,
  gold: THEMES_D_ARRET.gold * r.morceauxParTheme * LARGEUR_MORCEAU,
  author: THEMES_D_ARRET.author * r.morceauxParTheme * LARGEUR_MORCEAU,
});

const MEMOIRE = new Map<string, Seuils>();

/** Le pourcentage d'un score, arrondi à 10 près (comme au lot GR1) ; `pourcent` : celui de la version, ou celui d'un essai (`ReglagesEssai.pourcent`). */
const pourcentDe = (score: number, pourcent: number): number => Math.trunc((score * pourcent + 500) / 1000) * 10;

/**
 * Les seuils d'un jour d'après le robot, **en tranches** (`yield` après chaque plan du robot : un navigateur le fait tourner en arrière-plan) : il joue jusqu'au dernier point d'arrêt (diagnostic permis : un passage sans
 * fenêtre ne l'arrête pas ; un jour où il meurt avant un point garde le score qu'il avait), on lit son score à chaque point, **60 %** de chacun. Strictement croissants (un score égal à celui d'avant est relevé de 10).
 * Gardé en mémoire (huit jours) : un jour n'est joué qu'une fois par processus.
 */
export function* seuilsEnTranches(contenu: Contenu): Generator<void, Seuils, undefined> {
  const terrain = terrainDuJour(contenu);
  const distances = distancesDArret(terrain.regles!);
  const pourcent = contenu.reglages?.pourcent ?? POURCENT_DU_ROBOT;
  const cle = `${contenu.jour}:${contenu.g}:${cleDesRegles(terrain.regles!)}:${pourcent}:${contenu.ordre.join(",")}`;
  const connu = MEMOIRE.get(cle);
  if (connu) return { ...connu };
  const noms = ["bronze", "silver", "gold", "author"] as const;
  const scores: number[] = [];
  const jeu = jouerRobotEnTranches(terrain, { strict: false, maxDistance: distances.author, arrets: noms.map((n) => distances[n]), surPoint: (_d, p) => void scores.push(p.score) });
  let r = jeu.next();
  while (!r.done) {
    yield;
    r = jeu.next();
  }
  while (scores.length < noms.length) scores.push(r.value.partie.score);
  const valeurs = scores.map((v) => pourcentDe(v, pourcent));
  for (let i = 0; i < valeurs.length; i++) valeurs[i] = Math.max(valeurs[i]!, i === 0 ? 10 : valeurs[i - 1]! + 10);
  const s: Seuils = { bronze: valeurs[0]!, silver: valeurs[1]!, gold: valeurs[2]!, author: valeurs[3]! };
  if (MEMOIRE.size >= 8) MEMOIRE.delete(MEMOIRE.keys().next().value!);
  MEMOIRE.set(cle, s);
  return { ...s };
}

/** Les seuils d'un jour d'après le robot, d'un trait (voir `seuilsEnTranches`). */
export function seuilsDuRobot(contenu: Contenu): Seuils {
  const g = seuilsEnTranches(contenu);
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
  }
}

/** Des seuils valides : quatre entiers positifs, strictement croissants. */
export const seuilsValides = (s: unknown): s is Seuils => {
  if (typeof s !== "object" || s === null) return false;
  const { bronze, silver, gold, author } = s as Partial<Seuils>;
  const ok = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 1;
  return ok(bronze) && ok(silver) && ok(gold) && ok(author) && bronze < silver && silver < gold && gold < author;
};

/**
 * **Les seuils d'un jour tel qu'on le sert** : ceux figés avec le jour s'il vient d'un fichier de jour (`Contenu.seuilsFiges`), sinon le robot. Le serveur et le jeu passent par cette seule fonction : changer le
 * robot ne change jamais un jour déjà figé. `calcul` : ce qui remplace le robot quand rien n'est figé (les tests).
 */
export const seuilsDuJour = (contenu: Contenu, calcul: (c: Contenu) => Seuils = seuilsDuRobot): Seuils => contenu.seuilsFiges ?? calcul(contenu);
