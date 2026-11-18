import { Rng } from "@cdj/core";
import * as K from "./constantes";
import type { Controle } from "./constantes";
import type { Contenu } from "./generateur";
import { Partie, type Bille, type BilleVue } from "./partie";
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
/** Lot PBG2 : ce que vaut une bille verrouillée (le verrou est allumé : deux billes verrouillées lancent la multibille et ses jackpots), et ce que coûte une bille perdue pendant la multibille (elle ne coûte pas de bille de la partie, mais la multibille s'arrête plus tôt). */
export const ROBOT_VALEUR_VERROU = 15000;
export const ROBOT_PERTE_MULTI = 4000;
/** Lot PBG3 : ce que vaut un passage de la porte ouverte (en plus de ses points et du cran de mission qu'il donne : le robot vise la porte quand elle est ouverte). La rampe vers le verrou allumé, elle, vaut ce que vaut une bille verrouillée. */
export const ROBOT_VALEUR_PORTE = 6000;
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
  /** Lot PBR1 : le profil des pas simulés (`tools/profil-robot.ts`) ; sans lui, aucun coût. */
  profil?: ProfilRobot;
}
export interface ResultatRobot {
  partie: Partie;
  evenements: Evenement[];
  /** Combien de fois il a décidé, combien de pas il a simulés pour décider (le coût), et les coups qu'il a joués. */
  decisions: number;
  pasSimules: number;
  coups: CoupJoue[];
}

/**
 * **Le profil d'un robot** (lot PBR1, `npm run profil-robot:pinball`) : où vont les pas qu'il simule pour décider, et le temps que cela prend. Rempli seulement si `OptionsRobot.profil` est donné ; sans lui, aucun coût.
 * Les étapes d'une décision : `arrivee` (la bille jouée d'avance), `chauffe` (les copies de départ), `rien` (ne rien frapper), `essai` (les frappes). Les **pas** sont comptés par situation de la bille suivie à chaque
 * pas simulé : `multibille` (plusieurs billes ou multibille en cours), `rail`, `porte` (la porte est ouverte) ou `batteur` (le reste). Le **temps** (ms) des essais est rangé par la situation qui domine l'essai (celle
 * où il passe le plus de pas) ; `reel` : les pas de la vraie partie et leur temps (la simulation seule, sans recherche). `fins` : comment finissent les essais.
 */
export type Situation = "batteur" | "rail" | "multibille" | "porte";
export const SITUATIONS: readonly Situation[] = ["batteur", "rail", "multibille", "porte"];
export interface ProfilRobot {
  pas: Record<"arrivee" | "chauffe" | "rien" | "essai", Record<Situation, number>>;
  ms: { arrivee: number; chauffe: number; rien: Record<Situation, number>; essai: Record<Situation, number> };
  reel: { pas: number; ms: number };
  /** L'horloge du profil (ms) : donnée par l'outil (`performance.now`), jamais lue par la simulation elle-même. */
  horloge: () => number;
  fins: Record<string, { n: number; pas: number }>;
  decisions: number;
  essais: number;
}
export const nouveauProfil = (horloge: () => number = () => 0): ProfilRobot => {
  const t = (): Record<Situation, number> => ({ batteur: 0, rail: 0, multibille: 0, porte: 0 });
  return { pas: { arrivee: t(), chauffe: t(), rien: t(), essai: t() }, ms: { arrivee: 0, chauffe: 0, rien: t(), essai: t() }, reel: { pas: 0, ms: 0 }, horloge, fins: {}, decisions: 0, essais: 0 };
};
const situationDe = (c: Partie, f: BilleVue): Situation => (c.multibille || c.autres.length > 0 ? "multibille" : f.couche === 1 ? "rail" : c.passageOuvert > 0 ? "porte" : "batteur");

/**
 * **L'atelier du robot** (lot PBR1) : des parties de rechange que ses essais réutilisent (`Partie.recopier`) au lieu d'en allouer une par essai — des centaines de milliers par table, avec leurs tableaux et le
 * ramasse-miettes qui va avec. Une partie prise est comme `modele.copier(true)` ; rendue, elle sert à l'essai suivant. Un atelier ne sert qu'à une partie du robot (même table, mêmes réglages).
 */
class Atelier {
  private libres: Partie[] = [];
  prendre(modele: Partie): Partie {
    const q = this.libres.pop();
    if (q === undefined) return modele.copier(true);
    q.recopier(modele, true);
    return q;
  }
  rendre(parties: readonly Partie[]): void {
    for (const q of parties) this.libres.push(q);
  }
}

/** L'état d'une copie : ce qu'on compare avant et après. */
interface Depart {
  score: number;
  mult: number;
  billes: number;
  progres: number;
  faite: boolean;
  verrous: number;
  perdues: number;
  passages: number;
}
const progresDe = (p: Partie): number => {
  let m = p.compteur * 8;
  if (p.mission === "manege") for (const a of p.manegeAvance) m += a;
  return m;
};
const departDe = (p: Partie): Depart => ({ score: p.score, mult: p.mult, billes: p.billes, progres: progresDe(p), faite: p.missionFaite, verrous: p.verrouTotal, perdues: p.perduesMulti, passages: p.passages });

const nouvelleVue = (): BilleVue => ({ id: -1, x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0, couche: 0, captif: 0, dansLanceur: false, charge: 0 });

/** Une bille est-elle dans la zone des batteurs (sur le plateau, sous `ROBOT_Y_LACHE`, ni captive ni au lanceur) ? Lot PBG2 : une bille quelconque de la table. */
function dansLaZone(p: Partie): boolean {
  const lim = ROBOT_Y_LACHE * UNITE;
  if (!p.vide && p.y >= lim && p.captif === 0 && !p.dansLanceur) return true;
  for (const b of p.autres) if (b.y >= lim && b.captif === 0 && !b.dansLanceur) return true;
  return false;
}

/** Le robot lâche un batteur quand : il est tenu depuis `ROBOT_MAINTIEN_MIN` pas et plus aucune bille n'est dans la zone des batteurs (elle a quitté la zone, ou est captive, ou revenue au lanceur) ; il le lâche de toute façon à `ROBOT_MAINTIEN_MAX`. */
const doitLacher = (p: Partie, depuis: number): boolean => depuis >= ROBOT_MAINTIEN_MAX || (depuis >= ROBOT_MAINTIEN_MIN && !dansLaZone(p));

/**
 * **La bille qu'il joue** (lot PBG2). Une seule bille : la bille de la partie. En multibille : **la plus menacée**, la plus basse de celles qui descendent vers les batteurs sur le plateau (ni captive, ni sur un rail, ni
 * au lanceur) ; l'égalité va à la première entrée en jeu. Rend faux s'il n'y en a aucune.
 */
function plusMenacee(p: Partie, sortie: BilleVue): boolean {
  if (p.autres.length === 0) return !p.vide && p.lire(p.id, sortie);
  // la principale d'abord, puis les autres dans l'ordre (comme `billesDeLaTable`, sans rien allouer)
  let y = -1;
  const limite = ROBOT_Y_DECISION * UNITE;
  const bord = 340 * UNITE;
  if (!p.vide && p.couche === 0 && p.captif <= 0 && !p.dansLanceur && p.vy > 0 && p.y > limite && p.x < bord) {
    y = p.y;
    copierVue(sortie, p);
  }
  for (const b of p.autres) {
    if (b.couche !== 0 || b.captif > 0 || b.dansLanceur || b.vy <= 0 || b.y <= limite || b.x >= bord || b.y <= y) continue;
    y = b.y;
    copierVue(sortie, b);
  }
  return y >= 0;
}
/** Ce que le rendu et le robot lisent d'une bille (la principale de la partie ou une autre), copié dans `sortie`. */
const copierVue = (sortie: BilleVue, b: BilleVue | Bille | Partie): void => {
  sortie.id = b.id;
  sortie.x = b.x;
  sortie.y = b.y;
  sortie.px = b.px;
  sortie.py = b.py;
  sortie.vx = b.vx;
  sortie.vy = b.vy;
  sortie.couche = b.couche;
  sortie.captif = b.captif;
  sortie.dansLanceur = b.dansLanceur;
  sortie.charge = b.charge;
};

/** Une bille attend-elle dans le couloir du lanceur ? Laquelle (sa charge compte) : la première. */
function auLanceur(p: Partie, sortie: BilleVue): boolean {
  if (!p.vide && p.dansLanceur) return p.lire(p.id, sortie);
  for (const b of p.autres) if (b.dansLanceur) return p.lire(b.id, sortie);
  return false;
}

/** La note d'une suite : les points, la mission, le multiplicateur, moins une bille perdue. */
function noter(p: Partie, d: Depart): number {
  let v = p.score - d.score;
  if (!d.faite) v += (progresDe(p) - d.progres) * (ROBOT_VALEUR_MISSION / 8);
  v += (p.mult - d.mult) * ROBOT_VALEUR_MULT;
  v += (p.verrouTotal - d.verrous) * ROBOT_VALEUR_VERROU;
  v += (p.passages - d.passages) * ROBOT_VALEUR_PORTE;
  if (p.billes < d.billes) v -= ROBOT_PERTE;
  else if (p.ev & EV_SAUVEE) v -= Math.trunc(ROBOT_PERTE / 3);
  v -= (p.perduesMulti - d.perdues) * ROBOT_PERTE_MULTI;
  return v;
}

/**
 * Joue une copie `c` (la bille vient d'être préparée à son état de départ) : les batteurs de `appuyes` sont pressés tout de suite et tenus selon la règle du robot, puis la copie joue jusqu'à `ROBOT_HORIZON` pas, ou
 * jusqu'à ce que la bille soit perdue, sauvée, revenue au lanceur, ou retombe vers les batteurs après être remontée. Rend la note et le nombre de pas joués.
 */
function essayer(c: Partie, d: Depart, appuyes: readonly Batteur[], id: number, profil?: ProfilRobot, etape: "rien" | "essai" = "essai"): { note: number; pas: number } {
  for (const b of appuyes) c.regler(b, true);
  let tenu = appuyes.length > 0;
  let depuis = 0;
  let monte = false;
  let pas = 0;
  const haut = (ROBOT_Y_DECISION - 100) * UNITE;
  const decision = ROBOT_Y_DECISION * UNITE;
  // lot PBG2 : on suit « sa » bille (par son identifiant) ; les autres billes de la multibille jouent leur partie sans qu'on les suive
  const f = nouvelleVue();
  if (!c.lire(id, f)) f.couche = 0;
  let fin = "horizon";
  const comptes = profil ? { batteur: 0, rail: 0, multibille: 0, porte: 0 } : null;
  const t0 = profil ? profil.horloge() : 0;
  if (profil) profil.essais++;
  while ((pas < ROBOT_HORIZON || f.couche === 1) && pas < ROBOT_HORIZON_RAIL && !c.finie) {
    if (tenu && doitLacher(c, depuis)) {
      for (const b of appuyes) c.regler(b, false);
      tenu = false;
    }
    if (profil) {
      const q = situationDe(c, f);
      profil.pas[etape][q]++;
      comptes![q]++;
    }
    c.avancer();
    pas++;
    depuis++;
    if (c.billes < d.billes || c.ev & EV_SAUVEE) {
      fin = c.billes < d.billes ? "perdue" : "sauvee";
      break;
    }
    if (!c.lire(id, f) || f.dansLanceur) {
      fin = "lanceur-ou-captive";
      break; // perdue, verrouillée ou revenue au lanceur
    }
    if (f.y < haut) monte = true;
    else if (monte && depuis > ROBOT_MAINTIEN_MIN && f.vy > 0 && f.y > decision && f.couche === 0) {
      fin = "retombe";
      break;
    }
  }
  if (profil) {
    if (c.finie) fin = "partie-finie";
    else if (fin === "horizon" && f.couche === 1) fin = "rail-plafond";
    const e = (profil.fins[etape + ":" + fin] ??= { n: 0, pas: 0 });
    e.n++;
    e.pas += pas;
    let dominante: Situation = "batteur";
    for (const q of SITUATIONS) if (comptes![q] > comptes![dominante]) dominante = q;
    profil.ms[etape][dominante] += profil.horloge() - t0;
  }
  return { note: noter(c, d), pas };
}

/** **La note d'une frappe**, jouée sur une copie de `p` : les batteurs appuyés `delai` pas plus tard (et rien avant). C'est ce que le robot calcule pour chaque essai ; les tests la relisent pour vérifier qu'un coup choisi marche aussi `ROBOT_MARGE` pas plus tôt et plus tard. */
export function noterFrappe(p: Partie, batteurs: readonly Batteur[], delai: number): number {
  const c = p.copier(true);
  const d = departDe(p);
  // lot PBG3 : la bille suivie est celle que le robot joue (la plus menacée en multibille), comme dans `choisirEnTranches` — pas toujours la principale
  const cible = nouvelleVue();
  const id = plusMenacee(p, cible) ? cible.id : p.id;
  for (let i = 0; i < delai && !c.finie; i++) c.avancer();
  return essayer(c, d, batteurs, id).note;
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
export function* choisirEnTranches(p: Partie, libre: readonly [number, number], profil?: ProfilRobot, atelier: Atelier = new Atelier(), exhaustif = false): Generator<void, Choix, undefined> {
  let pas = 0;
  if (profil) profil.decisions++;
  // la bille qu'il joue : la bille de la partie, ou la plus menacée en multibille
  const cible = nouvelleVue();
  if (!plusMenacee(p, cible)) return { raison: "jamais", coup: null, revoir: 60, pas };
  const id = cible.id;
  const f = nouvelleVue();
  // 1. la bille jouée d'avance sans rien appuyer : quand arrive-t-elle aux batteurs, de quel côté ?
  const base = atelier.prendre(p);
  const ligne = ROBOT_Y_BATTEURS * UNITE;
  const plafond = 900;
  let arrivee = -1;
  let xArrivee = 0;
  let derniere = -1;
  const basse = ROBOT_Y_BASSE * UNITE;
  const tArrivee = profil ? profil.horloge() : 0;
  while (pas < plafond && !base.finie) {
    if (!base.lire(id, f)) {
      if (arrivee >= 0) derniere = pas;
      break; // la bille est perdue ou verrouillée
    }
    if (profil) profil.pas.arrivee[situationDe(base, f)]++;
    if (arrivee < 0 && f.y >= ligne && f.vy > 0 && f.captif === 0 && !f.dansLanceur) {
      arrivee = pas;
      xArrivee = f.x;
    }
    if (arrivee >= 0 && (f.y >= basse || pas >= arrivee + ROBOT_APRES_MAX)) {
      derniere = pas;
      break;
    }
    if (base.billes < p.billes || f.dansLanceur || f.captif > 0) {
      if (arrivee >= 0) derniere = pas;
      break;
    }
    base.avancer();
    pas++;
  }
  if (profil) profil.ms.arrivee += profil.horloge() - tArrivee;
  atelier.rendre([base]);
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
  const pre = atelier.prendre(p);
  const tChauffe = profil ? profil.horloge() : 0;
  let k = 0;
  for (const t of delais) {
    while (k < t && !pre.finie) {
      if (profil) {
        pre.lire(id, f);
        profil.pas.chauffe[situationDe(pre, f)]++;
      }
      pre.avancer();
      k++;
      pas++;
    }
    etats.push(atelier.prendre(pre));
  }
  atelier.rendre([pre]);
  if (profil) profil.ms.chauffe += profil.horloge() - tChauffe;
  // 3. la note de rien faire, puis celle de chaque frappe à chaque moment
  const travail = atelier.prendre(p);
  const rien = essayer(travail, depart, [], id, profil, "rien");
  pas += rien.pas;
  yield;
  // 4. **grossier puis fin, sans rien changer au choix** (lot PBR1) : le coup choisi est celui dont la plus mauvaise note de voisinage est la meilleure ; on n'essaie donc que les frappes qui peuvent encore le devenir.
  // Une note par cinq moments (la grille grossière) borne par le haut la note de voisinage de chacun des moments de la fenêtre ; on les prend du plus prometteur au moins prometteur, on complète leurs voisins un à un,
  // et on s'arrête quand la borne ne peut plus battre la meilleure (ou l'égaler en étant plus près de l'arrivée de la bille). Même coup que d'essayer toutes les frappes, avec la moitié des essais (`test/robot.test.ts`).
  const voisins = ROBOT_MARGE / ROBOT_PAS_ESSAI;
  const m = delais.length;
  const notes: (number | undefined)[][] = cotes.map(() => Array<number | undefined>(m).fill(undefined));
  // la note de la frappe `c` au moment `j` (jouée une fois) ; `neuf` dit qu'un essai vient d'être joué : la tranche rend alors la main
  let neuf = false;
  const essaiDe = (c: number, j: number): number => {
    let v = notes[c]![j];
    if (v === undefined) {
      travail.recopier(etats[j]!, true);
      const r = essayer(travail, depart, cotes[c]!, id, profil);
      v = r.note;
      notes[c]![j] = v;
      pas += r.pas;
      neuf = true;
    }
    return v;
  };
  let meilleur: Coup | null = null;
  if (exhaustif) {
    // **la référence** : toutes les frappes essayées, puis le meilleur voisinage (le choix d'avant le lot PBR1) ; `test/robot.test.ts` vérifie que la recherche ci-dessous fait le même
    for (let c = 0; c < cotes.length; c++) {
      for (let j = 0; j < m; j++) {
        essaiDe(c, j);
        yield;
      }
    }
    for (let c = 0; c < cotes.length; c++) {
      for (let j = voisins; j < m - voisins; j++) {
        const t = delais[j]!;
        if (t < premier || cotes[c]!.some((b) => t < libre[b]! + ROBOT_IMPRECISION)) continue;
        let pire = notes[c]![j]!;
        for (let i = j - voisins; i <= j + voisins; i++) pire = Math.min(pire, notes[c]![i]!);
        // à note égale, le moment le plus proche de l'arrivée de la bille (le plus naturel) ; la première frappe vue gagne à égalité
        const mieux = meilleur === null || pire > meilleur.robuste || (pire === meilleur.robuste && Math.abs(t - arrivee) < Math.abs(meilleur.delai - arrivee));
        if (mieux) meilleur = { batteurs: cotes[c]!, delai: t, robuste: pire, rien: rien.note };
      }
    }
  } else {
    const candidats: { c: number; j: number; ub: number; ecart: number; ordre: number }[] = [];
    for (let c = 0; c < cotes.length; c++) {
      for (let j = voisins; j < m - voisins; j++) {
        const t = delais[j]!;
        if (t < premier || cotes[c]!.some((b) => t < libre[b]! + ROBOT_IMPRECISION)) continue;
        // la note du seul moment de la grille grossière (un sur cinq) que contient son voisinage
        const g = j - voisins + ((5 - ((j - voisins) % 5)) % 5);
        const ub = essaiDe(c, g);
        if (neuf) {
          neuf = false;
          yield;
        }
        candidats.push({ c, j, ub, ecart: Math.abs(t - arrivee), ordre: c * m + j });
      }
    }
    candidats.sort((x, y) => y.ub - x.ub || x.ecart - y.ecart || x.ordre - y.ordre);
    let ecartMeilleur = 0;
    let ordreMeilleur = 0;
    for (const k of candidats) {
      // moins bon que le meilleur, ou à égalité mais plus loin de l'arrivée de la bille (ou, à égalité encore, vu plus tard) : il ne peut plus gagner
      const perd = (v: number): boolean => meilleur !== null && (v < meilleur.robuste || (v === meilleur.robuste && (k.ecart > ecartMeilleur || (k.ecart === ecartMeilleur && k.ordre > ordreMeilleur))));
      if (meilleur !== null && k.ub < meilleur.robuste) break; // trié : tous les suivants ont une borne plus basse
      // d'abord ce que les essais déjà faits (par d'autres frappes voisines) en disent, puis les notes qui manquent, une à une
      let pire = k.ub;
      for (let i = k.j - voisins; i <= k.j + voisins; i++) {
        const v = notes[k.c]![i];
        if (v !== undefined && v < pire) pire = v;
      }
      for (let i = k.j - voisins; i <= k.j + voisins && !perd(pire); i++) {
        pire = Math.min(pire, essaiDe(k.c, i));
        if (neuf) {
          neuf = false;
          yield;
        }
      }
      if (perd(pire)) continue;
      meilleur = { batteurs: cotes[k.c]!, delai: delais[k.j]!, robuste: pire, rien: rien.note };
      ecartMeilleur = k.ecart;
      ordreMeilleur = k.ordre;
    }
  }
  atelier.rendre(etats);
  atelier.rendre([travail]);
  if (meilleur === null || meilleur.robuste < rien.note) return { raison: meilleur === null ? "aucun" : `moins:${meilleur.robuste}<${rien.note}`, coup: null, revoir: 60, pas };
  return { coup: meilleur, revoir: 0, pas };
}

/** `choisirEnTranches` d'un trait. `exhaustif` : la référence, toutes les frappes essayées (les tests la comparent à la recherche rapide ; trois à cinq fois plus lente). */
export function choisir(p: Partie, libre: readonly [number, number], profil?: ProfilRobot, exhaustif = false): Choix {
  const g = choisirEnTranches(p, libre, profil, undefined, exhaustif);
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
  const lanceur = nouvelleVue();
  const cible = nouvelleVue();
  const atelier = new Atelier();
  while (!partie.finie && partie.tick < max) {
    const t = partie.tick;
    // les batteurs tenus : relâchés selon la règle du robot (aussi quand la bille est revenue au lanceur)
    for (const b of [GAUCHE, DROITE] as const) {
      if (partie.tenue(b)) {
        depuis[b]++;
        if (doitLacher(partie, depuis[b])) regler(b, false);
      }
    }
    // lot PBG2 : en multibille une bille peut attendre au lanceur pendant que d'autres jouent : le lanceur et les batteurs se jouent alors ensemble
    const aLanceur = auLanceur(partie, lanceur);
    const multi = partie.autres.length > 0;
    if (aLanceur) {
      if (!dansLanceur) {
        dansLanceur = true;
        attente = t + ATTENTE_LANCEUR + rng.int(121);
        charge = CHARGE_MIN + rng.int(201);
      }
      if (partie.tenue(LANCEUR)) {
        if (lanceur.charge >= charge) regler(LANCEUR, false);
      } else if (t >= attente) regler(LANCEUR, true);
      if (!multi) prevu = null;
    } else {
      dansLanceur = false;
      regler(LANCEUR, false);
    }
    if (!aLanceur || multi) {
      if (prevu !== null && t >= prevu.tick) {
        prevu.coup.appui = t;
        for (const b of prevu.batteurs) {
          regler(b, true);
          depuis[b] = 0;
          dernier[b] = t;
        }
        prevu = null;
      } else if (prevu === null && t >= revoir && !partie.tenue(GAUCHE) && !partie.tenue(DROITE) && plusMenacee(partie, cible) && cible.captif === 0 && cible.couche === 0 && cible.vy > 0 && cible.y > ROBOT_Y_DECISION * UNITE && cible.x < 340 * UNITE) {
        decisions++;
        const c = yield* choisirEnTranches(partie, [dernier[0] + ROBOT_ECART_MIN - t, dernier[1] + ROBOT_ECART_MIN - t], options.profil, atelier);
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
    if (options.profil) {
      const t0 = options.profil.horloge();
      partie.avancer();
      options.profil.reel.ms += options.profil.horloge() - t0;
      options.profil.reel.pas++;
    } else partie.avancer();
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
