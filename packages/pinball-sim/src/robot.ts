import { Rng } from "@cdj/core";
import * as K from "./constantes";
import type { Controle } from "./constantes";
import type { Contenu } from "./generateur";
import { Partie } from "./partie";
import type { Evenement } from "./rediffusion";
import { REGLAGES, type Reglages } from "./reglages";
// Posées dans des locales : sous Vitest chaque import se lit par un accesseur (deux à trois fois plus lent dans les boucles du robot).
const { AXE, DROITE, DUREE_MAX_TICKS, EV_SAUVEE, GAUCHE, LANCEUR, UNITE } = K;

/** Un batteur : 0 le gauche, 1 le droit. */
export type Batteur = 0 | 1;

// LE ROBOT (lot PB4) — il joue la vraie simulation, comme un joueur, et sert à trois choses : **valider la table** (`validation.ts`), **donner les seuils des médailles** (`seuils.ts`) et se laisser regarder (`?robot`).
// Il remplace le pilote d'essai du lot PB1 (le robot de la maquette, qui ne visait pas).
//
// **L'algorithme en cinq lignes.**
//  1. Il ne décide qu'une chose : quand frapper. Quand la bille tombe vers les batteurs, il la joue d'avance sur des copies de l'état (`Partie.copier`), sans rien appuyer, pour savoir quand et de quel côté elle arrive.
//  2. Il essaie alors une frappe à chaque moment d'une fenêtre autour de cette arrivée (un essai tous les `ROBOT_PAS_ESSAI` pas), chacune sur sa propre copie, et regarde la suite sur `ROBOT_HORIZON` pas.
//  3. Il note chaque suite : les points gagnés ; **la mission du jour d'abord** (chaque pas vers elle vaut `ROBOT_VALEUR_MISSION`, bien plus que n'importe quel contact) ; le multiplicateur gagné ; une bille perdue
//     coûte `ROBOT_PERTE`. C'est ce qui lui fait viser : le coup qui garde la bille et rapporte le plus est celui qui passe par le bon module.
//  4. **Il joue comme un humain** : un coup n'est choisi que s'il marche encore `ROBOT_MARGE` pas plus tôt et plus tard (sa note est la plus mauvaise de celles de ses voisins : le robot ne réussit jamais un tir
//     au pas près) ; il ne réagit pas avant `ROBOT_REACTION` pas ; deux appuis du même batteur sont séparés d'au moins `ROBOT_ECART_MIN` pas ; il frappe avec une erreur de `ROBOT_IMPRECISION` pas au plus, tirée de la
//     graine de sa partie (elle reste dans la marge que le coup a éprouvée) ; il lance la bille avec une charge qui varie d'une bille à l'autre.
//  5. Il joue la frappe choisie **sur la vraie partie** (jamais autre chose que des appuis, des relâchements et le lanceur : ce sont les événements d'une rediffusion, que le serveur rejoue) et recommence quand
//     la bille retombe.
//
// **Aucun hasard hors de la graine de la partie, aucun flottant, aucune horloge** : une graine donne une partie, toujours la même (`test/robot.test.ts`). Le robot ne tourne jamais à chaque partie d'un joueur : le
// serveur ne le lance pas, le jeu ne le charge que pour `?robot` et, sans fichier de jour, pour les seuils (à la demande).

/** Le temps de réaction : le robot n'appuie jamais moins de 90 pas (0,15 s) après avoir décidé. Il décide dès que la bille passe sous `ROBOT_Y_DECISION` en tombant : il ne rattrape donc pas une bille qui arrive trop vite. */
export const ROBOT_REACTION = 90;
/** L'écart minimal entre deux appuis du même batteur : 60 pas (0,1 s), la cadence d'un doigt. */
export const ROBOT_ECART_MIN = 60;
/** Un batteur appuyé le reste au moins 36 pas (60 ms : le temps de monter, 24 pas) et au plus 240 pas (0,4 s) ; il est relâché dès que la bille a quitté la zone des batteurs (`ROBOT_Y_LACHE`). */
export const ROBOT_MAINTIEN_MIN = 36;
export const ROBOT_MAINTIEN_MAX = 240;
/** **La marge d'un coup** : il n'est retenu que s'il marche aussi 12 pas (20 ms) plus tôt et 12 pas plus tard — sa note est la plus mauvaise des cinq essais d'un voisinage (−12, −6, 0, +6, +12 pas). */
export const ROBOT_MARGE = 12;
/** **L'imprécision du robot** : il appuie avec une erreur tirée de la graine de sa partie, de 6 pas (10 ms) au plus de chaque côté — dans la marge éprouvée. */
export const ROBOT_IMPRECISION = 6;
/** Un essai de frappe tous les 6 pas (la moitié de la marge). */
export const ROBOT_PAS_ESSAI = 6;
/** Ce qu'il regarde après sa frappe : 360 pas (0,6 s) — le temps que la bille remonte et touche son module ; la suite s'arrête plus tôt si la bille est perdue ou retombe. */
export const ROBOT_HORIZON = 360;
/** Lot PBG1 : une bille sur un rail est suivie jusqu'à son bout (une rampe dure 1 à 2 secondes : plus que l'horizon), au plus 2 400 pas (4 s). */
export const ROBOT_HORIZON_RAIL = 2400;
/** Le robot décide quand la bille passe sous cette ligne (px) en tombant ; il relâche quand elle remonte au-dessus de `ROBOT_Y_LACHE` ; la bille « arrive » aux batteurs à `ROBOT_Y_BATTEURS`. */
export const ROBOT_Y_DECISION = 420;
export const ROBOT_Y_LACHE = 570;
export const ROBOT_Y_BATTEURS = 600;
/** **La fenêtre des frappes essayées** : elle commence 78 pas avant l'arrivée de la bille aux batteurs et finit 18 pas après — ou, si la bille roule sur un batteur au repos, quand elle passe sous la ligne `ROBOT_Y_BASSE` (px), au plus `ROBOT_APRES_MAX` pas après son arrivée ; elle ne dépasse jamais `ROBOT_FENETRE_MAX` pas. */
const AVANT = 78;
const APRES = 18;
export const ROBOT_Y_BASSE = 690;
export const ROBOT_FENETRE_MAX = 192;
export const ROBOT_APRES_MAX = 240;
/** Ce que vaut un pas vers la mission (un tour de manège, une plongée, un portail, un geyser) : un point de mission vaut bien plus qu'un contact. */
export const ROBOT_VALEUR_MISSION = 12000;
/** Une bille perdue coûte 10 000 points ; une bille sauvée (elle revient au lanceur), le tiers. Un cran de multiplicateur vaut 3 000. */
export const ROBOT_PERTE = 10000;
export const ROBOT_VALEUR_MULT = 3000;
/** Le lanceur : le robot tient la charge entre 800 et 1 000 (‰), après 60 à 180 pas d'attente. */
const CHARGE_MIN = 800;
const ATTENTE_LANCEUR = 60;

/** Un coup choisi : les batteurs frappés, le délai (pas, depuis la décision), la note de son voisinage et la note de ne rien faire. */
export interface Coup {
  batteurs: readonly Batteur[];
  delai: number;
  robuste: number;
  rien: number;
}

export interface OptionsRobot {
  /** Jouer au plus jusqu'à ce pas (défaut : la partie entière). */
  maxTicks?: number;
  reglages?: Reglages;
  /** Appelée après chaque pas de la vraie partie (la validation y relève les modules touchés). */
  surPas?: (p: Partie) => void;
  /** Appelée à chaque coup choisi (le rapport, les tests des contraintes d'humain). */
  surCoup?: (c: Coup, p: Partie) => void;
}
export interface ResultatRobot {
  partie: Partie;
  evenements: Evenement[];
  /** Combien de fois il a décidé, combien de pas il a simulés pour décider (le coût), et les coups qu'il a joués. */
  decisions: number;
  pasSimules: number;
  coups: CoupJoue[];
}

/** L'état d'une copie : ce qu'on compare avant et après. */
interface Depart {
  score: number;
  mult: number;
  billes: number;
  progres: number;
  faite: boolean;
}
const progresDe = (p: Partie): number => {
  let m = p.compteur * 8;
  if (p.mission === "manege") for (const a of p.manegeAvance) m += a;
  return m;
};
const departDe = (p: Partie): Depart => ({ score: p.score, mult: p.mult, billes: p.billes, progres: progresDe(p), faite: p.missionFaite });

/** Le robot lâche un batteur quand : il est tenu depuis `ROBOT_MAINTIEN_MIN` pas et la bille a quitté la zone des batteurs (ou est captive, ou revenue au lanceur) ; il le lâche de toute façon à `ROBOT_MAINTIEN_MAX`. */
const doitLacher = (p: Partie, depuis: number): boolean => depuis >= ROBOT_MAINTIEN_MAX || (depuis >= ROBOT_MAINTIEN_MIN && (p.y < ROBOT_Y_LACHE * UNITE || p.captif > 0 || p.dansLanceur));

/** La note d'une suite : les points, la mission, le multiplicateur, moins une bille perdue. */
function noter(p: Partie, d: Depart): number {
  let v = p.score - d.score;
  if (!d.faite) v += (progresDe(p) - d.progres) * (ROBOT_VALEUR_MISSION / 8);
  v += (p.mult - d.mult) * ROBOT_VALEUR_MULT;
  if (p.billes < d.billes) v -= ROBOT_PERTE;
  else if (p.ev & EV_SAUVEE) v -= Math.trunc(ROBOT_PERTE / 3);
  return v;
}

/**
 * Joue une copie `c` (la bille vient d'être préparée à son état de départ) : les batteurs de `appuyes` sont pressés tout de suite et tenus selon la règle du robot, puis la copie joue jusqu'à `ROBOT_HORIZON` pas, ou
 * jusqu'à ce que la bille soit perdue, sauvée, revenue au lanceur, ou retombe vers les batteurs après être remontée. Rend la note et le nombre de pas joués.
 */
function essayer(c: Partie, d: Depart, appuyes: readonly Batteur[]): { note: number; pas: number } {
  for (const b of appuyes) c.regler(b, true);
  let tenu = appuyes.length > 0;
  let depuis = 0;
  let monte = false;
  let pas = 0;
  const haut = (ROBOT_Y_DECISION - 100) * UNITE;
  const decision = ROBOT_Y_DECISION * UNITE;
  while ((pas < ROBOT_HORIZON || c.couche === 1) && pas < ROBOT_HORIZON_RAIL && !c.finie) {
    if (tenu && doitLacher(c, depuis)) {
      for (const b of appuyes) c.regler(b, false);
      tenu = false;
    }
    c.avancer();
    pas++;
    depuis++;
    if (c.billes < d.billes || c.dansLanceur || c.ev & EV_SAUVEE) break;
    if (c.y < haut) monte = true;
    else if (monte && depuis > ROBOT_MAINTIEN_MIN && c.vy > 0 && c.y > decision && c.couche === 0) break;
  }
  return { note: noter(c, d), pas };
}

/** **La note d'une frappe**, jouée sur une copie de `p` : les batteurs appuyés `delai` pas plus tard (et rien avant). C'est ce que le robot calcule pour chaque essai ; les tests la relisent pour vérifier qu'un coup choisi marche aussi `ROBOT_MARGE` pas plus tôt et plus tard. */
export function noterFrappe(p: Partie, batteurs: readonly Batteur[], delai: number): number {
  const c = p.copier(true);
  const d = departDe(p);
  for (let i = 0; i < delai && !c.finie; i++) c.avancer();
  return essayer(c, d, batteurs).note;
}

/** Le résultat d'un choix : le coup (ou rien) et, sinon, quand regarder de nouveau. */
interface Choix {
  raison?: string;
  coup: Coup | null;
  revoir: number;
  pas: number;
}

/**
 * **Choisit une frappe** pour la bille qui tombe. `libre` : le pas avant lequel chaque batteur ne peut pas être appuyé de nouveau (écart minimal), relatif à maintenant. Rend le coup dont le voisinage est le meilleur,
 * ou `null` (rien à frapper, ou rien qui vaille mieux que laisser tomber), et le pas où regarder de nouveau.
 */
export function* choisirEnTranches(p: Partie, libre: readonly [number, number]): Generator<void, Choix, undefined> {
  let pas = 0;
  // 1. la bille jouée d'avance sans rien appuyer : quand arrive-t-elle aux batteurs, de quel côté ?
  const base = p.copier(true);
  const ligne = ROBOT_Y_BATTEURS * UNITE;
  const plafond = 900;
  let arrivee = -1;
  let xArrivee = 0;
  let derniere = -1;
  const basse = ROBOT_Y_BASSE * UNITE;
  while (pas < plafond && !base.finie) {
    if (arrivee < 0 && base.y >= ligne && base.vy > 0 && base.captif === 0 && !base.dansLanceur) {
      arrivee = pas;
      xArrivee = base.x;
    }
    if (arrivee >= 0 && (base.y >= basse || pas >= arrivee + ROBOT_APRES_MAX)) {
      derniere = pas;
      break;
    }
    if (base.billes < p.billes || base.dansLanceur || base.captif > 0) {
      if (arrivee >= 0) derniere = pas;
      break;
    }
    base.avancer();
    pas++;
  }
  if (arrivee < 0) return { raison: "jamais", coup: null, revoir: 60, pas };
  if (derniere < 0) derniere = arrivee;
  const premier = ROBOT_REACTION + ROBOT_IMPRECISION;
  // la fenêtre : de 78 pas avant l'arrivée de la bille jusqu'au moment où elle passe sous les batteurs (ou 18 pas après son arrivée, au moins) : un robot sauve aussi la bille qui roule sur un batteur au repos
  const fin = Math.max(arrivee + APRES, derniere - ROBOT_PAS_ESSAI);
  const debut = Math.max(premier, Math.max(arrivee - AVANT, fin - ROBOT_FENETRE_MAX));
  if (fin < premier) return { raison: "tard", coup: null, revoir: 60, pas };
  const x = xArrivee;
  const cotes: Batteur[][] = x < (AXE - 24) * UNITE ? [[GAUCHE]] : x > (AXE + 24) * UNITE ? [[DROITE]] : [[GAUCHE], [DROITE], [GAUCHE, DROITE]];
  // 2. les états de départ de chaque essai : la bille jouée d'avance, copiée tous les `ROBOT_PAS_ESSAI` pas de `debut − ROBOT_MARGE` à `fin + ROBOT_MARGE`
  const depart = departDe(p);
  const delais: number[] = [];
  for (let t = debut - ROBOT_MARGE; t <= fin + ROBOT_MARGE; t += ROBOT_PAS_ESSAI) delais.push(t);
  const etats: Partie[] = [];
  const pre = p.copier(true);
  let k = 0;
  for (const t of delais) {
    while (k < t && !pre.finie) {
      pre.avancer();
      k++;
      pas++;
    }
    etats.push(pre.copier(true));
  }
  // 3. la note de rien faire, puis celle de chaque frappe à chaque moment
  const rien = essayer(p.copier(true), depart, []);
  pas += rien.pas;
  yield;
  let meilleur: Coup | null = null;
  const voisins = ROBOT_MARGE / ROBOT_PAS_ESSAI;
  for (const batteurs of cotes) {
    const notes: number[] = [];
    for (let j = 0; j < delais.length; j++) {
      const r = essayer(etats[j]!.copier(true), depart, batteurs);
      notes.push(r.note);
      pas += r.pas;
      yield;
    }
    for (let j = voisins; j < delais.length - voisins; j++) {
      const t = delais[j]!;
      if (t < premier || batteurs.some((b) => t < libre[b]! + ROBOT_IMPRECISION)) continue;
      let pire = notes[j]!;
      for (let i = j - voisins; i <= j + voisins; i++) pire = Math.min(pire, notes[i]!);
      // à note égale, le moment le plus proche de l'arrivée de la bille (le plus naturel) ; la première frappe vue gagne à égalité
      const mieux = meilleur === null || pire > meilleur.robuste || (pire === meilleur.robuste && Math.abs(t - arrivee) < Math.abs(meilleur.delai - arrivee));
      if (mieux) meilleur = { batteurs, delai: t, robuste: pire, rien: rien.note };
    }
  }
  if (meilleur === null || meilleur.robuste < rien.note) return { raison: meilleur === null ? "aucun" : `moins:${meilleur.robuste}<${rien.note}`, coup: null, revoir: 60, pas };
  return { coup: meilleur, revoir: 0, pas };
}

/** `choisirEnTranches` d'un trait. */
export function choisir(p: Partie, libre: readonly [number, number]): Choix {
  const g = choisirEnTranches(p, libre);
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}

/** Un coup joué, pour le rapport et les tests : le pas de la décision, celui de l'appui (le robot a réagi après `appui − decision` pas), les batteurs, le délai choisi, sa note de voisinage et celle de ne rien faire. */
export interface CoupJoue {
  decision: number;
  appui: number;
  batteurs: readonly Batteur[];
  delai: number;
  robuste: number;
  rien: number;
}

/**
 * **Joue une partie** de la table `contenu` avec la graine `graine` (l'imprécision et le lanceur de cette partie), jusqu'à sa fin ou `options.maxTicks`, **en tranches** : le générateur rend la main après chaque
 * frappe essayée (un navigateur le fait tourner en arrière-plan : `seuilsEnTranches`). Les événements rendus sont ceux d'une rediffusion : le serveur les rejoue et retrouve le score du robot (`test/robot.test.ts`).
 */
export function* jouerRobotEnTranches(contenu: Contenu, graine: number, options: OptionsRobot = {}): Generator<void, ResultatRobot, undefined> {
  const max = Math.min(options.maxTicks ?? DUREE_MAX_TICKS, DUREE_MAX_TICKS);
  const partie = new Partie(contenu, options.reglages ?? REGLAGES);
  const rng = new Rng(graine >>> 0);
  const evenements: Evenement[] = [];
  const journal: CoupJoue[] = [];
  const regler = (c: Controle, enfonce: boolean): void => {
    if (partie.tenue(c) === enfonce) return;
    partie.regler(c, enfonce);
    evenements.push({ tick: partie.tick, c, enfonce });
  };
  const depuis: [number, number] = [0, 0];
  const dernier: [number, number] = [-1000000, -1000000];
  let prevu: { tick: number; batteurs: readonly Batteur[]; coup: CoupJoue } | null = null;
  let revoir = 0;
  let decisions = 0;
  let pasSimules = 0;
  let dansLanceur = partie.dansLanceur;
  let attente = ATTENTE_LANCEUR + rng.int(121);
  let charge = CHARGE_MIN + rng.int(201);
  while (!partie.finie && partie.tick < max) {
    const t = partie.tick;
    // les batteurs tenus : relâchés selon la règle du robot (aussi quand la bille est revenue au lanceur)
    for (const b of [GAUCHE, DROITE] as const) {
      if (partie.tenue(b)) {
        depuis[b]++;
        if (doitLacher(partie, depuis[b])) regler(b, false);
      }
    }
    if (partie.dansLanceur) {
      if (!dansLanceur) {
        dansLanceur = true;
        attente = t + ATTENTE_LANCEUR + rng.int(121);
        charge = CHARGE_MIN + rng.int(201);
      }
      if (partie.tenue(LANCEUR)) {
        if (partie.charge >= charge) regler(LANCEUR, false);
      } else if (t >= attente) regler(LANCEUR, true);
      prevu = null;
    } else {
      dansLanceur = false;
      regler(LANCEUR, false);
      if (prevu !== null && t >= prevu.tick) {
        prevu.coup.appui = t;
        for (const b of prevu.batteurs) {
          regler(b, true);
          depuis[b] = 0;
          dernier[b] = t;
        }
        prevu = null;
      } else if (prevu === null && t >= revoir && !partie.tenue(GAUCHE) && !partie.tenue(DROITE) && partie.captif === 0 && partie.couche === 0 && partie.vy > 0 && partie.y > ROBOT_Y_DECISION * UNITE && partie.x < 340 * UNITE) {
        decisions++;
        const c = yield* choisirEnTranches(partie, [dernier[0] + ROBOT_ECART_MIN - t, dernier[1] + ROBOT_ECART_MIN - t]);
        pasSimules += c.pas;
        if (c.coup === null) revoir = t + c.revoir;
        else {
          const erreur = rng.int(2 * ROBOT_IMPRECISION + 1) - ROBOT_IMPRECISION;
          const coup: CoupJoue = { decision: t, appui: -1, batteurs: c.coup.batteurs, delai: c.coup.delai, robuste: c.coup.robuste, rien: c.coup.rien };
          journal.push(coup);
          prevu = { tick: t + Math.max(ROBOT_REACTION, c.coup.delai + erreur), batteurs: c.coup.batteurs, coup };
          revoir = prevu.tick + 1;
          options.surCoup?.(c.coup, partie);
        }
      }
    }
    partie.avancer();
    options.surPas?.(partie);
  }
  return { partie, evenements, decisions, pasSimules, coups: journal };
}

/** `jouerRobotEnTranches` d'un trait. */
export function jouerRobot(contenu: Contenu, graine: number, options: OptionsRobot = {}): ResultatRobot {
  const g = jouerRobotEnTranches(contenu, graine, options);
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}
