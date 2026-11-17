import * as K from "./constantes";
import type { Controle } from "./constantes";
import * as E from "./entiers";
import { MISSION_DU_THEME, type Contenu, type Mission } from "./generateur";
import { deriver, REGLAGES, type Derives, type Reglages } from "./reglages";
import { construireTable, type Aiguillage, type Arrivee, type Porte, type Segment, type Table } from "./table";
// Les constantes et les fonctions chaudes sont posées dans des locales : sous Vitest (module runner) chaque import se lit par un accesseur, deux à trois fois plus lent dans une boucle de millions de pas (le robot du
// lot PB4 en joue des dizaines de millions). Rien ne change pour le jeu ni le serveur.
const {
  AXE, DROITE, DUREE_MAX_TICKS, EV_BANQUE, EV_BUMPER, EV_CIBLE, EV_COULEE, EV_FIN, EV_GEYSER, EV_LANCE, EV_MANEGE, EV_MISSION, EV_MULT, EV_PERDUE, EV_PORTAIL, EV_SAUVEE, EV_COMBO, EV_ORBITE, EV_RAIL, EV_RAMPE, EV_RECUL, EV_SLING, EV_SPINNER, EV_TOURBILLON, EV_TROU, EV_VOIE,
  EV_JACKPOT, EV_MULTI, EV_MULTI_FIN, EV_NIVEAU, EV_VERROU_ALLUME, EV_VERROUILLEE, EV2_AIGUILLAGE, EV2_LAMPE, EV2_PORTE_FERME, EV2_PORTE_OUVRE, EV2_PORTE_PASSAGE, EV2_SAUVEUR, EV2_SAUVEUR_ARME, GAUCHE, LANCE_X2, LANCE_Y, LANCEUR, MULT_MAX, NB_BILLES, NORME, PERDUE_Y, POINTS, RAYON, TICKS_PAR_SECONDE, TOUR, UNITE, VERROU_BILLES,
} = K;
const { cosinus, div, racine, sinus, unitaire } = E;

// La partie (lot PB1) : la physique de la maquette portée en entiers, au pas de 1/600 s. **Trois commandes seulement** (`regler`) : le batteur gauche, le batteur droit, le lanceur — tenues ou relâchées ; une partie
// est la suite des instants où l'une change (la rediffusion). Le temps avance d'un pas par `avancer()`, qui lit l'état des commandes à cet instant. Tout est entier : positions en unités (4 096 par pixel), vitesses
// en unités par seconde ; chaque division tronque vers zéro. Une partie finit quand la dernière bille est perdue, ou à `DUREE_MAX_TICKS`.

const RU = RAYON * UNITE;
const RU2 = RU * RU;
const AXE2 = 2 * AXE * UNITE;
const ORIGINE = 112 * UNITE; // le pivot du batteur gauche ; le droit en est l'image dans l'axe de la table
const PIVOT_Y = 640 * UNITE;
const LONGUEUR = 60 * UNITE;
const BATTEUR_GROS = 8 * UNITE; // le rayon du batteur à son pivot, 5 à sa pointe : `8 − 3 u`
const BATTEUR_PERTE = 3 * UNITE;
const CHARGE_MAX = 1000;
/** Au plus 3 600 pas (6 s) sur un rail, après quoi la bille en repart par son entrée (jamais plus de quelques secondes : un rail de 800 px à 400 px/s en demande 2). */
export const RAIL_DUREE_MAX = 3600;
/** Sous cette vitesse d'entrée (120 px/s, en unités par seconde) la bouche d'un rail ne fait rien : ni prise, ni mur. */
const BOUCHE_MIN = 120 * UNITE;
/** Un angle de 2,2 rad : la sortie d'un trou. */
const ANGLE_TROU = div(2200 * TOUR, 6283);
/** Le quotient de la vitesse d'un point d'un batteur : 2π × 600 / `TOUR`, en 23 010 cent-millièmes. */
const K_VITESSE = 23010;

/** Le secteur (0 à 7, un huitième de tour chacun, dans le sens où tourne le manège : à l'écran, contre les aiguilles d'une montre) d'un point `(dx, dy)` autour du centre d'un plateau. Entier, sans angle. */
export function secteur(dx: number, dy: number): number {
  const ay = -dy; // l'axe vertical de l'écran descend : on le retourne
  if (ay >= 0) return dx >= 0 ? (dx >= ay ? 0 : 1) : -dx <= ay ? 2 : 3;
  return dx < 0 ? (-dx >= -ay ? 4 : 5) : dx <= -ay ? 6 : 7;
}
/** L'angle de sortie du tourbillon, en millièmes de radian : 1 900 plus ou moins 600 (la maquette : `1.9 + sin(t) × 0.6`, `t` en secondes). */
const SORTIE_TOURBILLON = 1900;
/** La période du va-et-vient de l'astéroïde : 2 048 pas (3,4 s : la maquette avait 3,2 s), pour que l'angle avance d'un nombre entier d'angles de table par pas (8). */
export const PERIODE_ASTEROIDE = 2048;
/** Le jet du geyser reste visible 300 pas (0,5 s) ; il ne compte pas dans la partie (rendu). */
export const JET_GEYSER = 300;

export interface Resultat {
  score: number;
  /** Les pas joués : la durée de la partie (le départage du classement : le plus rapide passe devant). */
  ticks: number;
  /** Les billes qu'il restait. */
  billes: number;
  multMax: number;
}

/** Un gain de points au pas courant (essais : `?debug` montre le score de chaque contact). */
export interface Gain {
  points: number;
  x: number;
  y: number;
}

/** Le pivot (x, y) et la pointe d'un batteur à l'angle `a` (le batteur droit est l'image du gauche). */
export function pointeDuBatteur(i: number, a: number): { px: number; py: number; tx: number; ty: number } {
  const sens = i === GAUCHE ? 1 : -1;
  const px = i === GAUCHE ? ORIGINE : AXE2 - ORIGINE;
  return { px, py: PIVOT_Y, tx: px + sens * div(cosinus(a) * LONGUEUR, NORME), ty: PIVOT_Y + div(sinus(a) * LONGUEUR, NORME) };
}

/**
 * **Une bille** (lot PBG2) : tout ce qui est propre à une bille. La bille principale vit dans les champs de `Partie` (`x`, `y`, `vx`… : tout ce qui a été écrit avant la multibille les lit) ; **les autres billes de la multibille**
 * sont des `Bille` (`Partie.autres`). Pour jouer une autre bille, la partie **échange** ses champs avec ceux de la `Bille` (`echanger`), joue le pas de la bille, puis les échange de nouveau : une seule physique pour
 * toutes les billes, sans la copier. L'ordre est fixe (la principale, puis `autres` dans l'ordre où elles sont entrées en jeu) : la partie reste déterministe.
 */
export interface Bille {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  px: number;
  py: number;
  captifDe: number;
  captifTb: number;
  captif: number;
  dansLanceur: boolean;
  charge: number;
  entree: number;
  sauvee: boolean;
  /** Lot PBL1 : le poteau sauveur a déjà servi cette bille (il ne la sert plus, et elle n'allume plus ses lampes). */
  servie: boolean;
  geyserJets: number;
  manegeSecteur: number[];
  couleeDedans: boolean[];
  couche: 0 | 1;
  rail: number;
  railS: number;
  railV: number;
  railDepuis: number;
  railBout: 0 | 1;
}
/** Ce que le rendu et le robot lisent d'une bille. */
export interface BilleVue {
  id: number;
  x: number;
  y: number;
  px: number;
  py: number;
  vx: number;
  vy: number;
  couche: 0 | 1;
  captif: number;
  dansLanceur: boolean;
  charge: number;
}

const billeVide = (id: number, nbPlateaux: number, nbCoulees: number): Bille => ({
  id, x: 0, y: 0, vx: 0, vy: 0, px: 0, py: 0, captifDe: -1, captifTb: -1, captif: 0, dansLanceur: false, charge: 0, entree: 0, sauvee: false, servie: false, geyserJets: 0,
  manegeSecteur: new Array<number>(nbPlateaux).fill(-1), couleeDedans: new Array<boolean>(nbCoulees).fill(false), couche: 0, rail: -1, railS: 0, railV: 0, railDepuis: 0, railBout: 0,
});

export class Partie {
  readonly table: Table;
  readonly reglages: Reglages;
  private readonly d: Derives;
  /** Les pas joués. */
  tick = 0;
  score = 0;
  mult = 1;
  multMax = 1;
  billes = NB_BILLES;
  /** La bille : position, vitesse, et sa position au pas d'avant (le rendu interpole). */
  x = LANCE_X2 * UNITE / 2;
  y = LANCE_Y * UNITE;
  vx = 0;
  vy = 0;
  px = this.x;
  py = this.y;
  /** Le trou qui garde la bille (rang), ou −1, et les pas qu'il lui reste à la garder. */
  captifDe = -1;
  /** Le tourbillon qui garde la bille (rang), ou −1 (lot PB3). */
  captifTb = -1;
  captif = 0;
  dansLanceur = true;
  /** La charge du lanceur, de 0 à 1 000. */
  charge = 0;
  /** Le pas où la bille courante est entrée en jeu, et si elle a déjà été sauvée. */
  entree = 0;
  sauvee = false;
  /** Lot PBL1 : le poteau sauveur a déjà servi la bille principale (une fois par bille : il ne la sert plus et elle n'allume plus ses lampes). */
  servie = false;
  /** Les batteurs : l'angle (en angles de table), celui du pas d'avant. */
  a: [number, number];
  aAvant: [number, number];
  private readonly appui: [boolean, boolean] = [false, false];
  private appuiLanceur = false;
  /** L'état des éléments : cibles tombées (par rang de segment), les pas avant que chaque banque se relève, les lampes des couloirs du haut, les pas avant leur extinction, les pas avant qu'un trou reprenne. */
  readonly bas: boolean[];
  readonly banqueDans: number[];
  readonly voiesAllumees: boolean[];
  voiesDans = 0;
  readonly trouPause: number[];
  /** Pour le rendu : la vitesse de rotation des spinners (en millièmes de la maquette : 30 000 au plus), et les pas depuis le dernier choc de chaque bumper et de chaque lance-pierre (0 : au repos). */
  readonly spin: number[];
  readonly choc: number[];
  readonly chocSling: [number, number] = [0, 0];
  /** Les événements du pas (bits `EV_*`) et ses gains de points. Lot PBG3 : `ev2` porte ceux de la porte, du poteau sauveur et de l'aiguillage (bits `EV2_*`). */
  ev = 0;
  ev2 = 0;
  readonly gains: Gain[] = [];
  /** Lot PB4 : vrai pour une copie d'essai du robot (`copier(true)`) : les gains de points ne sont pas gardés (le score, lui, compte). Aucun effet sur la partie. */
  sansGains = false;
  /** **Lot PB3 : la mission du thème.** Ce qu'il faut faire (`MISSION_DU_THEME`), le but (un réglage), le compteur, et si elle est réussie (**une seule fois par partie**, d'une bille à l'autre). */
  readonly mission: Mission;
  /** Le but de la mission **du niveau en cours** (lot PBG2 : il monte à chaque niveau, `missionButPas` %). */
  but: number;
  compteur = 0;
  missionFaite = false;
  /**
   * **Lot PBG2 : la boucle mission, verrou, multibille, mission du niveau suivant.** `niveau` : le niveau de la mission (1, puis 2…). La mission réussie allume le verrou (`verrouAllume`, le trou du plan : `Table.verrou`) ;
   * une bille qui y entre y est verrouillée (`verrouillees`, 0 à `VERROU_BILLES`), sans coûter de bille de la partie ; la deuxième lance la multibille (`multibille`) : les billes verrouillées sont lâchées l'une après
   * l'autre par le trou (`aLacher`, `lacherDans`), `sauveeMulti` pas de bille sauvée au départ ; les billes perdues pendant la multibille ne coûtent rien ; elle finit quand il ne reste qu'une bille sur la table, et la
   * mission revient au niveau suivant. `jackpots` : ceux de la multibille en cours (le prochain vaut plus), `dernierJackpot` sa valeur ; `multibilles` : les multibilles lancées dans la partie.
   */
  niveau = 1;
  verrouAllume = false;
  verrouillees = 0;
  /** Les billes verrouillées dans la partie (le robot note chaque verrouillage). */
  verrouTotal = 0;
  multibille = false;
  multibilles = 0;
  aLacher = 0;
  lacherDans = 0;
  sauveeMulti = 0;
  jackpots = 0;
  dernierJackpot = 0;
  /** Les billes perdues pendant une multibille, qui ne coûtent rien (le robot les compte) ; le jackpot cumulé de la partie. */
  perduesMulti = 0;
  jackpotsPartie = 0;
  /** Les points que les jackpots ont rapportés dans la partie (multiplicateur compris : les mesures du README du lot). */
  jackpotPoints = 0;
  /** **La bille principale est absente** (perdue pendant la multibille alors que d'autres attendent de revenir par le trou) : ses champs ne valent rien tant qu'elle ne revient pas. */
  vide = false;
  /** Les autres billes de la multibille (jamais plus de `VERROU_BILLES`), dans l'ordre où elles sont entrées en jeu. */
  autres: Bille[] = [];
  /** L'identifiant de la bille principale (un nouveau à chaque bille : le robot suit « sa » bille), et le prochain à donner. */
  id = 0;
  private suivantId = 1;
  /** Vrai quand la bille qui vient de jouer son pas a quitté la table (multibille) : à retirer. */
  private sortie = false;
  /** Une bille de passage pour les collisions entre billes. */
  private lue: Bille | null = null;
  /** Le manège : le secteur de la bille (−1 : hors du plateau) et l'avance en huitièmes de tour depuis le dernier tour compté (huit font un tour de manège ; elle se garde d'une bille à l'autre), par plateau. */
  manegeSecteur: number[];
  readonly manegeAvance: number[];
  /** Les pas avant que chaque tourbillon, chaque portail et chaque geyser puissent servir de nouveau ; pour le rendu, les pas qu'il reste au jet de chaque geyser ; la bille est-elle dans la coulée ; les jets de la bille courante. */
  readonly tourbillonPause: number[];
  readonly portailPause: number[];
  readonly geyserAttente: number[];
  readonly geyserJet: number[];
  couleeDedans: boolean[];
  geyserJets = 0;
  /** **Lot PBG1 : la couche de la bille.** 0 : le plateau ; 1 : un rail (`rail` : son rang dans `table.rails`), où elle suit le tracé (`railS` : l'abscisse curviligne, en unités ; `railV` : sa vitesse le long du tracé, en unités par seconde, négative quand elle redescend) et ne touche plus rien. `railDepuis` : les pas passés sur ce rail. */
  couche: 0 | 1 = 0;
  rail = -1;
  railS = 0;
  railV = 0;
  railDepuis = 0;
  /** Par quel bout la bille est entrée sur le rail (0 : l'entrée, 1 : la sortie d'une orbite). */
  railBout: 0 | 1 = 0;
  /** Le combo : le rang du rail réussi en cours (0 : aucun), et le pas avant lequel le prochain doit finir pour l'enchaîner. Les rails menés à leur bout, par rail (le suivi de la validation). */
  combo = 0;
  comboFin = 0;
  comboMaxPartie = 0;
  readonly railsFaits: number[];
  /**
   * **Lot PBG3 : la porte, le poteau sauveur et l'aiguillage.** `passageOuvert` : les pas qu'il reste à la porte ouverte (0 : fermée, le battant est un mur) ; `passageServi` : une bille l'a déjà franchie pendant cette
   * ouverture (un seul passage par ouverture) ; `ouvertures` et `passages` : leur nombre dans la partie (la validation les exige, les mesures les comptent). `lampes` : les deux lampes des couloirs de retour (gauche, droite),
   * que la bille allume en y passant ; **les deux allumées, le poteau est armé** (`sauveurArme`) ; `sauveurTick` : le pas où il s'est armé ou a servi (le rendu le fait sortir et rentrer) ; `sauvetages` : les billes qu'il a
   * renvoyées. `aiguillages` : les billes dérivées par l'aiguillage (une bille en transit a `couche` 1 et `rail` −2 vers le verrou, −3 vers l'élément du thème ; `railS` compte ses pas).
   */
  passageOuvert = 0;
  passageServi = false;
  ouvertures = 0;
  passages = 0;
  lampes: [boolean, boolean] = [false, false];
  sauveurTick = -100000;
  sauvetages = 0;
  aiguillages = 0;
  /** Les points que la porte a rapportés dans la partie (multiplicateur compris : les mesures du README du lot). */
  portePoints = 0;
  private fin = false;

  constructor(
    readonly contenu: Contenu,
    reglages: Reglages = REGLAGES,
    /** Lot PB4 : une partie à copier (`copier`) ; sans elle, une partie neuve. */
    modele?: Partie,
    sansGains = false,
  ) {
    this.reglages = reglages;
    this.d = modele ? modele.d : deriver(reglages);
    const m = modele;
    // la table : construite pour une partie neuve ; pour une copie, la même, dont seuls les bumpers mobiles sont recopiés (leur position est un état de la partie)
    this.table = m ? { ...m.table, bumpers: m.table.bumpers.some((b) => b.mobile) ? m.table.bumpers.map((b) => (b.mobile ? { ...b, mobile: b.mobile } : b)) : m.table.bumpers } : construireTable(contenu, reglages);
    this.a = m ? [m.a[0], m.a[1]] : [this.d.repos, this.d.repos];
    this.aAvant = m ? [m.aAvant[0], m.aAvant[1]] : [this.d.repos, this.d.repos];
    const tb = this.table;
    this.bas = m ? m.bas.slice() : tb.murs.map(() => false);
    this.banqueDans = m ? m.banqueDans.slice() : tb.banques.map(() => 0);
    this.voiesAllumees = m ? m.voiesAllumees.slice() : tb.voies.map(() => false);
    this.trouPause = m ? m.trouPause.slice() : tb.trous.map(() => 0);
    this.spin = m ? m.spin.slice() : tb.spinners.map(() => 0);
    this.choc = m ? m.choc.slice() : tb.bumpers.map(() => 0);
    this.mission = MISSION_DU_THEME[contenu.theme];
    this.but = m ? m.but : { manege: reglages.butManege, tourbillon: reglages.butTourbillon, portail: reglages.butPortail, geyser: reglages.butGeyser }[this.mission];
    this.manegeSecteur = m ? m.manegeSecteur.slice() : tb.plateaux.map(() => -1);
    this.manegeAvance = m ? m.manegeAvance.slice() : tb.plateaux.map(() => 0);
    this.tourbillonPause = m ? m.tourbillonPause.slice() : tb.tourbillons.map(() => 0);
    this.portailPause = m ? m.portailPause.slice() : tb.portails.map(() => 0);
    this.geyserAttente = m ? m.geyserAttente.slice() : tb.geysers.map(() => 0);
    this.geyserJet = m ? m.geyserJet.slice() : tb.geysers.map(() => 0);
    this.couleeDedans = m ? m.couleeDedans.slice() : tb.coulees.map(() => false);
    this.railsFaits = m ? m.railsFaits.slice() : tb.rails.map(() => 0);
    this.sansGains = sansGains;
    if (!m) return;
    this.ev2 = m.ev2;
    this.passageOuvert = m.passageOuvert;
    this.passageServi = m.passageServi;
    this.ouvertures = m.ouvertures;
    this.passages = m.passages;
    this.lampes = [m.lampes[0], m.lampes[1]];
    this.sauveurTick = m.sauveurTick;
    this.sauvetages = m.sauvetages;
    this.aiguillages = m.aiguillages;
    this.portePoints = m.portePoints;
    this.tick = m.tick;
    this.score = m.score;
    this.mult = m.mult;
    this.multMax = m.multMax;
    this.billes = m.billes;
    this.x = m.x;
    this.y = m.y;
    this.vx = m.vx;
    this.vy = m.vy;
    this.px = m.px;
    this.py = m.py;
    this.captifDe = m.captifDe;
    this.captifTb = m.captifTb;
    this.captif = m.captif;
    this.dansLanceur = m.dansLanceur;
    this.charge = m.charge;
    this.entree = m.entree;
    this.sauvee = m.sauvee;
    this.servie = m.servie;
    this.appui[0] = m.appui[0];
    this.appui[1] = m.appui[1];
    this.appuiLanceur = m.appuiLanceur;
    this.voiesDans = m.voiesDans;
    this.chocSling[0] = m.chocSling[0];
    this.chocSling[1] = m.chocSling[1];
    this.ev = m.ev;
    this.compteur = m.compteur;
    this.missionFaite = m.missionFaite;
    this.geyserJets = m.geyserJets;
    this.couche = m.couche;
    this.rail = m.rail;
    this.railS = m.railS;
    this.railV = m.railV;
    this.railDepuis = m.railDepuis;
    this.railBout = m.railBout;
    this.combo = m.combo;
    this.comboFin = m.comboFin;
    this.comboMaxPartie = m.comboMaxPartie;
    this.fin = m.fin;
    this.niveau = m.niveau;
    this.verrouAllume = m.verrouAllume;
    this.verrouillees = m.verrouillees;
    this.verrouTotal = m.verrouTotal;
    this.multibille = m.multibille;
    this.multibilles = m.multibilles;
    this.aLacher = m.aLacher;
    this.lacherDans = m.lacherDans;
    this.sauveeMulti = m.sauveeMulti;
    this.jackpots = m.jackpots;
    this.dernierJackpot = m.dernierJackpot;
    this.perduesMulti = m.perduesMulti;
    this.jackpotsPartie = m.jackpotsPartie;
    this.jackpotPoints = m.jackpotPoints;
    this.vide = m.vide;
    this.id = m.id;
    this.suivantId = m.suivantId;
    this.sortie = m.sortie;
    if (m.autres.length > 0) this.autres = m.autres.map((b) => ({ ...b, manegeSecteur: b.manegeSecteur.slice(), couleeDedans: b.couleeDedans.slice() }));
  }

  /** La bille est-elle sur un rail ? (Un accesseur : le compilateur ne suit pas le changement de couche d'une méthode.) */
  get surUnRail(): boolean {
    return this.couche === 1;
  }

  get finie(): boolean {
    return this.fin;
  }

  /**
   * **Une copie indépendante de l'état** (lot PB4) : le robot y essaie ses coups sans toucher à la vraie partie ; la copie joue exactement comme l'original (même simulation, même résultat pas à pas). Les tableaux sont
   * recopiés, **la table aussi pour ses bumpers mobiles** (l'astéroïde garde sa position et sa vitesse dans la table : deux copies à des pas différents ne doivent pas se les partager). `sansGains` : la copie ne
   * garde pas la liste des gains du pas (le rendu n'en a pas besoin), ce qui ne change ni le score ni rien d'autre. **Elle passe par le constructeur** (même forme d'objet que l'original : une copie faite autrement
   * se joue six fois plus lentement).
   */
  copier(sansGains = false): Partie {
    return new Partie(this.contenu, this.reglages, this, sansGains);
  }

  /** Une commande tenue (`enfonce`) ou relâchée à ce pas, avant que le pas ne se joue. */
  regler(c: Controle, enfonce: boolean): void {
    if (c === LANCEUR) this.appuiLanceur = enfonce;
    else this.appui[c] = enfonce;
  }
  tenue(c: Controle): boolean {
    return c === LANCEUR ? this.appuiLanceur : this.appui[c];
  }

  resultat(): Resultat {
    return { score: this.score, ticks: this.tick, billes: this.billes, multMax: this.multMax };
  }

  private points(n: number, x = this.x, y = this.y): void {
    const p = n * this.mult;
    this.score += p;
    if (!this.sansGains) this.gains.push({ points: p, x, y });
  }

  /** La récompense de la mission du niveau en cours : la base (10 000), plus `missionPas` % de la base par niveau passé. */
  recompenseMission(niveau = this.niveau): number {
    return div(POINTS.mission * (100 + this.reglages.missionPas * (niveau - 1)), 100);
  }

  /** La valeur (avant le multiplicateur) du jackpot de rang `k` (1, 2, 3…) de la multibille : la base, plus `jackpotPas` % de la base par jackpot déjà pris. */
  valeurJackpot(k: number): number {
    return div(this.reglages.jackpotBase * (100 + this.reglages.jackpotPas * (k - 1)), 100);
  }

  /** Ce que rapportera **le prochain jackpot**, multiplicateur compris s'il s'applique (le HUD l'affiche). */
  get prochainJackpot(): number {
    return this.valeurJackpot(this.jackpots + 1) * (this.reglages.jackpotMultiplie ? this.mult : 1);
  }

  /** Le poteau sauveur est armé : les deux lampes des couloirs de retour sont allumées. */
  get sauveurArme(): boolean {
    return this.lampes[0] && this.lampes[1];
  }

  /** Où l'aiguillage mène la bille de la rampe maintenant : 0 vers le bout de la rampe, 1 vers le verrou (allumé), 2 vers l'élément du thème (pendant la multibille). */
  get aiguillageVers(): 0 | 1 | 2 {
    const a = this.table.aiguillage;
    if (!a || !this.reglages.aiguillageActif) return 0;
    if (this.multibille) return a.versElement ? 2 : 0;
    return this.verrouAllume && a.versVerrou ? 1 : 0;
  }

  /** La porte s'ouvre pour `porteDuree` pas (la banque de cibles complète, ou l'orbite sur une table sans banque) ; rouverte pendant qu'elle l'est déjà, elle repart de zéro. Un nouveau passage est alors possible. */
  private ouvrirPassage(): void {
    if (!this.table.passage) return;
    if (this.passageOuvert === 0 || this.passageServi) {
      this.ouvertures++;
      if (this.passageOuvert === 0) this.ev2 |= EV2_PORTE_OUVRE;
    }
    this.passageOuvert = this.reglages.porteDuree;
    this.passageServi = false;
  }

  /** **Essais** (`?essai=porte`, hors production, jamais classé) : la porte est ouverte pour de bon ; `armerLeSauveur` (`?essai=poteau`) : les deux lampes sont allumées, le poteau est armé. */
  ouvrirLaPorte(): void {
    if (!this.table.passage) return;
    this.passageOuvert = DUREE_MAX_TICKS * 2;
    this.passageServi = false;
  }
  armerLeSauveur(): void {
    this.lampes = [true, true];
    this.sauveurTick = this.tick;
  }

  /** Un jackpot : une prise de l'élément du thème pendant la multibille. */
  private jackpot(): void {
    this.jackpots++;
    this.jackpotsPartie++;
    const v = this.valeurJackpot(this.jackpots);
    if (this.reglages.jackpotMultiplie) this.points(v);
    else {
      this.score += v;
      if (!this.sansGains) this.gains.push({ points: v, x: this.x, y: this.y });
    }
    this.dernierJackpot = this.reglages.jackpotMultiplie ? v * this.mult : v;
    this.jackpotPoints += this.dernierJackpot;
    this.ev |= EV_JACKPOT;
  }

  /**
   * Un pas de plus vers le but de la mission : au but, la récompense du niveau (au multiplicateur d'avant), le multiplicateur monte d'un cran et **le verrou s'allume** (lot PBG2 ; un plan sans verrou — le plan d'essai —
   * ne rejoue pas la mission). **Pendant la multibille, la même prise rapporte un jackpot.** `quoi` : l'élément qui vient de servir.
   */
  private pourLaMission(quoi: Mission): void {
    if (quoi !== this.mission) return;
    if (this.multibille) return this.jackpot();
    if (this.missionFaite) return;
    this.compteur = Math.min(this.but, this.compteur + 1);
    if (this.compteur < this.but) return;
    this.missionFaite = true;
    this.points(this.recompenseMission());
    this.mult = Math.min(MULT_MAX, this.mult + 1);
    this.multMax = Math.max(this.multMax, this.mult);
    this.ev |= EV_MISSION | EV_MULT;
    if (this.table.verrou >= 0) {
      this.verrouAllume = true;
      this.ev |= EV_VERROU_ALLUME;
    }
  }

  /** **Une bille entre dans le verrou allumé** : elle y reste (`verrouillees`), le trou reprendra bientôt, une nouvelle bille arrive au lanceur **sans coûter de bille de la partie** ; la deuxième lance la multibille. */
  private verrouiller(i: number, r: Reglages): void {
    this.trouPause[i] = r.verrouPause;
    this.verrouillees++;
    this.verrouTotal++;
    this.ev |= EV_VERROUILLEE;
    this.points(r.verrouPoints);
    this.nouvelleBille();
    if (this.verrouillees >= VERROU_BILLES) this.demarrerMultibille();
  }

  /** La multibille part : les billes verrouillées seront lâchées l'une après l'autre, la bille du lanceur reste, `sauveeMulti` pas de bille sauvée. */
  private demarrerMultibille(): void {
    const r = this.reglages;
    this.multibille = true;
    this.multibilles++;
    this.verrouAllume = false;
    this.aLacher = this.verrouillees;
    this.lacherDans = r.multibilleDepart;
    this.sauveeMulti = r.multibilleSauvee;
    this.jackpots = 0;
    this.ev |= EV_MULTI;
  }

  /**
   * **Les essais** (`?essai=verrou`, `?essai=multibille`, hors production, jamais classés) : la mission est réussie et le verrou allumé (`allumerLeVerrou`), ou la partie commence en multibille (`lancerLaMultibille` : deux
   * billes verrouillées, lâchées l'une après l'autre, la bille du lanceur reste). Sans verrou sur le plan (le plan d'essai), rien ne se passe.
   */
  allumerLeVerrou(): void {
    if (this.table.verrou < 0 || this.multibille || this.missionFaite) return;
    this.compteur = this.but;
    this.missionFaite = true;
    this.verrouAllume = true;
  }
  lancerLaMultibille(): void {
    if (this.table.verrou < 0 || this.multibille) return;
    this.compteur = this.but;
    this.missionFaite = true;
    this.verrouillees = VERROU_BILLES;
    this.demarrerMultibille();
  }

  /** La multibille finit (il ne reste qu'une bille sur la table) : la mission revient au niveau suivant, son but plus haut (`missionButPas` %, arrondi au-dessus). */
  private finMultibille(): void {
    this.multibille = false;
    this.sauveeMulti = 0;
    this.jackpots = 0;
    this.niveau++;
    this.but = div(this.but * this.reglages.missionButPas + 99, 100);
    this.compteur = 0;
    this.missionFaite = false;
    this.ev |= EV_MULTI_FIN | EV_NIVEAU;
  }

  /** Le nombre de billes sur la table, ou qui y reviennent par le trou (les billes verrouillées et la bille du lanceur comprises). */
  get surLaTable(): number {
    return (this.vide ? 0 : 1) + this.autres.length + this.aLacher;
  }

  /** Une bille quitte la table pendant la multibille : elle revient par le trou si on est encore dans le délai de bille sauvée, sinon elle est perdue — pour rien. */
  private perdueEnMultibille(): void {
    if (this.sauveeMulti > 0) {
      if (this.aLacher === 0) this.lacherDans = this.reglages.multibilleRelance;
      this.aLacher++;
      this.ev |= EV_SAUVEE;
    } else {
      this.perduesMulti++;
      this.ev |= EV_PERDUE;
    }
    this.sortie = true;
  }

  /** Une bille sort du trou du verrou (le départ de la multibille, ou une bille sauvée) : elle est lâchée comme le trou lâche sa bille. */
  private lacher(): void {
    const r = this.reglages;
    const tr = this.table.trous[this.table.verrou]!;
    const co = cosinus(ANGLE_TROU);
    const si = sinus(ANGLE_TROU);
    const sortie = div(tr.r * 2, 5) + 14 * UNITE;
    const b = billeVide(this.suivantId++, this.table.plateaux.length, this.table.coulees.length);
    b.x = tr.x + div(co * sortie, NORME);
    b.y = tr.y + div(si * sortie, NORME);
    b.px = b.x;
    b.py = b.y;
    b.vx = div(co * r.trouVitesse * UNITE, NORME);
    b.vy = div(si * r.trouVitesse * UNITE, NORME);
    b.entree = this.tick;
    b.sauvee = true; // jamais deux fois sauvée : la bille sauvée de la multibille est celle du départ (`sauveeMulti`)
    if (this.vide) {
      this.echanger(b);
      this.vide = false;
    } else this.autres.push(b);
    this.aLacher--;
    if (this.verrouillees > 0) this.verrouillees--;
  }

  /** Échange tous les champs de la bille principale avec ceux de `b` : la partie joue alors la bille `b` avec la même physique que la principale, puis les échange de nouveau. */
  private echanger(b: Bille): void {
    let n: number;
    let o: boolean;
    n = this.id; this.id = b.id; b.id = n;
    n = this.x; this.x = b.x; b.x = n;
    n = this.y; this.y = b.y; b.y = n;
    n = this.vx; this.vx = b.vx; b.vx = n;
    n = this.vy; this.vy = b.vy; b.vy = n;
    n = this.px; this.px = b.px; b.px = n;
    n = this.py; this.py = b.py; b.py = n;
    n = this.captifDe; this.captifDe = b.captifDe; b.captifDe = n;
    n = this.captifTb; this.captifTb = b.captifTb; b.captifTb = n;
    n = this.captif; this.captif = b.captif; b.captif = n;
    n = this.charge; this.charge = b.charge; b.charge = n;
    n = this.entree; this.entree = b.entree; b.entree = n;
    n = this.geyserJets; this.geyserJets = b.geyserJets; b.geyserJets = n;
    n = this.rail; this.rail = b.rail; b.rail = n;
    n = this.railS; this.railS = b.railS; b.railS = n;
    n = this.railV; this.railV = b.railV; b.railV = n;
    n = this.railDepuis; this.railDepuis = b.railDepuis; b.railDepuis = n;
    o = this.dansLanceur; this.dansLanceur = b.dansLanceur; b.dansLanceur = o;
    o = this.sauvee; this.sauvee = b.sauvee; b.sauvee = o;
    o = this.servie; this.servie = b.servie; b.servie = o;
    const c = this.couche; this.couche = b.couche; b.couche = c;
    const bo = this.railBout; this.railBout = b.railBout; b.railBout = bo;
    const ms = this.manegeSecteur; this.manegeSecteur = b.manegeSecteur; b.manegeSecteur = ms;
    const cd = this.couleeDedans; this.couleeDedans = b.couleeDedans; b.couleeDedans = cd;
  }

  /** La bille principale, retirée de la table (perdue pendant la multibille) : la suivante la remplace, ou la table est vide en attendant qu'une bille revienne par le trou. */
  private retirerPrincipale(): void {
    if (this.autres.length > 0) {
      this.echanger(this.autres[0]!);
      this.autres.shift();
    } else this.vide = true;
  }

  /** Les billes sur la table (la principale d'abord), pour le rendu : un instantané. */
  billesDeLaTable(): BilleVue[] {
    const v: BilleVue[] = [];
    if (!this.vide) v.push({ id: this.id, x: this.x, y: this.y, px: this.px, py: this.py, vx: this.vx, vy: this.vy, couche: this.couche, captif: this.captif, dansLanceur: this.dansLanceur, charge: this.charge });
    for (const b of this.autres) v.push({ id: b.id, x: b.x, y: b.y, px: b.px, py: b.py, vx: b.vx, vy: b.vy, couche: b.couche, captif: b.captif, dansLanceur: b.dansLanceur, charge: b.charge });
    return v;
  }

  /** Lit la bille `id` dans `sortie` (le robot suit « sa » bille sans rien allouer). Faux si elle n'est plus sur la table. */
  lire(id: number, sortie: BilleVue): boolean {
    if (!this.vide && this.id === id) {
      sortie.id = id;
      sortie.x = this.x;
      sortie.y = this.y;
      sortie.px = this.px;
      sortie.py = this.py;
      sortie.vx = this.vx;
      sortie.vy = this.vy;
      sortie.couche = this.couche;
      sortie.captif = this.captif;
      sortie.dansLanceur = this.dansLanceur;
      sortie.charge = this.charge;
      return true;
    }
    for (const b of this.autres) {
      if (b.id !== id) continue;
      sortie.id = id;
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
      return true;
    }
    return false;
  }

  private nouvelleBille(): void {
    this.x = LANCE_X2 * UNITE / 2;
    this.y = LANCE_Y * UNITE;
    this.vx = 0;
    this.vy = 0;
    this.px = this.x;
    this.py = this.y;
    this.captif = 0;
    this.captifDe = -1;
    this.captifTb = -1;
    this.dansLanceur = true;
    this.charge = 0;
    this.sauvee = false;
    this.servie = false;
    this.geyserJets = 0;
    this.manegeSecteur.fill(-1);
    this.id = this.suivantId++;
    this.couche = 0;
    this.rail = -1;
    this.railS = 0;
    this.railV = 0;
    this.railDepuis = 0;
    this.combo = 0;
    this.comboFin = 0;
  }

  /** Un pas de 1/600 s. */
  avancer(): void {
    if (this.fin) return;
    this.ev = 0;
    this.ev2 = 0;
    this.gains.length = 0;
    const d = this.d;
    const r = this.reglages;
    const t = this.table;
    for (let i = 0; i < this.banqueDans.length; i++) {
      if (this.banqueDans[i]! > 0) {
        this.banqueDans[i] = this.banqueDans[i]! - 1;
        if (this.banqueDans[i] === 0) for (const k of t.banques[i]!) this.bas[k] = false;
      }
    }
    if (this.voiesDans > 0 && --this.voiesDans === 0) this.voiesAllumees.fill(false);
    // lot PBG3 : la porte se referme quand son temps est écoulé
    if (this.passageOuvert > 0 && --this.passageOuvert === 0) this.ev2 |= EV2_PORTE_FERME;
    for (let i = 0; i < this.choc.length; i++) if (this.choc[i]! > 0) this.choc[i] = this.choc[i]! - 1;
    // lot PB3 : tout ce qui bouge est une fonction du numéro de pas — l'astéroïde, et les pauses des éléments
    for (const b of t.bumpers) {
      if (!b.mobile) continue;
      const x = b.mobile.x0 + div(sinus((this.tick % PERIODE_ASTEROIDE) * (TOUR / PERIODE_ASTEROIDE)) * b.mobile.amp, NORME);
      b.vx = (x - b.x) * TICKS_PAR_SECONDE;
      b.x = x;
    }
    for (let i = 0; i < this.tourbillonPause.length; i++) this.tourbillonPause[i] = this.tourbillonPause[i]! - 1;
    for (let i = 0; i < this.portailPause.length; i++) this.portailPause[i] = this.portailPause[i]! - 1;
    for (let i = 0; i < this.geyserAttente.length; i++) {
      this.geyserAttente[i] = this.geyserAttente[i]! - 1;
      if (this.geyserJet[i]! > 0) this.geyserJet[i] = this.geyserJet[i]! - 1;
    }
    if (this.chocSling[0] > 0) this.chocSling[0] -= 1;
    if (this.chocSling[1] > 0) this.chocSling[1] -= 1;
    for (let i = 0; i < this.spin.length; i++) this.spin[i] = div(this.spin[i]! * 997, 1000);
    for (let i = 0; i < 2; i++) {
      const haut = this.appui[i]!;
      const cible = haut ? d.haut : d.repos;
      const vit = haut ? d.montee : d.descente;
      const diff = cible - this.a[i]!;
      this.aAvant[i] = this.a[i]!;
      this.a[i] = this.a[i]! + Math.sign(diff) * Math.min(Math.abs(diff), vit);
    }
    // lot PBG2 : la bille principale joue son pas, puis chacune des autres (la partie échange ses champs avec elle) ; les billes qui se touchent rebondissent ; la multibille lâche ses billes et s'arrête quand il n'en reste qu'une
    if (!this.vide) {
      this.pasDeBille(true);
      if (this.sortie) {
        this.sortie = false;
        this.retirerPrincipale();
      }
    }
    for (let i = 0; i < this.autres.length; i++) {
      const b = this.autres[i]!;
      this.echanger(b);
      this.pasDeBille(false);
      const sortie = this.sortie;
      this.sortie = false;
      this.echanger(b);
      if (sortie) this.autres.splice(i--, 1);
    }
    if (this.autres.length > 0) this.collisionsDesBilles();
    if (this.aLacher > 0 && --this.lacherDans <= 0) {
      this.lacher();
      if (this.aLacher > 0) this.lacherDans = r.multibilleLacher;
    }
    if (this.multibille) {
      if (this.sauveeMulti > 0) this.sauveeMulti--;
      if (this.surLaTable <= 1) this.finMultibille();
    }
    this.finDuPas();
  }

  /**
   * **Le pas d'une bille** (la principale, ou une autre échangée avec elle) : le trou ou le tourbillon qui la garde, le rail, le lanceur, la pente, les forces des éléments, le déplacement, les collisions, les capteurs, le
   * retour au lanceur, la bille perdue. `principale` : le décompte de la pause des trous ne se fait qu'une fois par pas.
   */
  private pasDeBille(principale: boolean): void {
    const d = this.d;
    const r = this.reglages;
    const t = this.table;
    this.px = this.x;
    this.py = this.y;
    if (this.captif > 0) {
      if (--this.captif === 0) {
        if (this.captifTb >= 0) {
          // le tourbillon recrache la bille vers le bas, à un angle qui dépend du pas (1,9 rad plus ou moins 0,6 : la maquette)
          const tb = t.tourbillons[this.captifTb]!;
          const a = div((SORTIE_TOURBILLON + div(sinus(div(this.tick * TOUR, 3770)) * 600, NORME)) * TOUR, 6283);
          const co = cosinus(a);
          const si = sinus(a);
          this.vx = div(co * r.tourbillonVitesse * UNITE, NORME);
          this.vy = div(si * r.tourbillonVitesse * UNITE, NORME);
          const sortie = div(tb.r * 2, 5) + 14 * UNITE;
          this.x = tb.x + div(co * sortie, NORME);
          this.y = tb.y + div(si * sortie, NORME);
          this.captifTb = -1;
        } else {
          const tr = t.trous[this.captifDe]!;
          const co = cosinus(ANGLE_TROU);
          const si = sinus(ANGLE_TROU);
          this.vx = div(co * r.trouVitesse * UNITE, NORME);
          this.vy = div(si * r.trouVitesse * UNITE, NORME);
          const sortie = div(tr.r * 2, 5) + 14 * UNITE; // le rayon × 0,4 + 14 px
          this.x = tr.x + div(co * sortie, NORME);
          this.y = tr.y + div(si * sortie, NORME);
          this.captifDe = -1;
        }
        this.px = this.x;
        this.py = this.y;
      }
      return;
    }
    if (principale) for (let i = 0; i < this.trouPause.length; i++) this.trouPause[i] = this.trouPause[i]! - 1;
    if (this.couche === 1) {
      if (this.rail >= 0) this.surRail(d, r, t);
      else this.enTransit(r, t);
      return;
    }
    if (this.dansLanceur) {
      if (this.appuiLanceur) this.charge = Math.min(CHARGE_MAX, this.charge + d.chargeParPas);
      else if (this.charge > 0) {
        this.vy = -div((r.lanceurBase * CHARGE_MAX + r.lanceurPlus * this.charge) * UNITE, CHARGE_MAX);
        this.charge = 0;
        this.dansLanceur = false;
        this.entree = this.tick;
        this.ev |= EV_LANCE;
      }
      if (this.dansLanceur) {
        this.vx = 0;
        this.vy = 0;
        this.y = LANCE_Y * UNITE;
        return;
      }
    }
    this.vy += d.graviteParPas;
    this.zones(d, r, t);
    const v2 = this.vx * this.vx + this.vy * this.vy;
    if (v2 > d.vitesseMax2) {
      const v = racine(v2);
      this.vx = div(this.vx * d.vitesseMax, v);
      this.vy = div(this.vy * d.vitesseMax, v);
    }
    const oy = this.y;
    this.x += div(this.vx, TICKS_PAR_SECONDE);
    this.y += div(this.vy, TICKS_PAR_SECONDE);
    // --- les collisions, dans l'ordre de la maquette : murs, poteaux, bumpers, cibles, batteurs
    for (const s of t.murs) if (s.type !== 2 && this.segment(s)) if (s.type === 1) this.choquerSling(s);
    // lot PBG3 : fermée, la porte est un mur ; ouverte, la bille passe
    if (t.passage && this.passageOuvert <= 0) this.segment(t.passage.battant);
    // lot PBG1 : les bouches des rails — assez vite la bille est prise (elle quitte le plateau), sinon la bouche est un mur
    for (const g of t.portes) {
      this.porte(g, d);
      if (this.surUnRail) return;
    }
    for (const p of t.poteaux) this.cercle(p.x, p.y, p.r, r.rebondPoteau, 0);
    for (let i = 0; i < t.bumpers.length; i++) {
      const b = t.bumpers[i]!;
      if (this.cercle(b.x, b.y, b.r, r.rebondBumper, b.kick, b.vx ?? 0)) {
        this.choc[i] = 40;
        this.ev |= EV_BUMPER;
        this.points(POINTS.bumper);
      }
    }
    for (let q = 0; q < t.banques.length; q++) {
      for (const k of t.banques[q]!) {
        if (this.bas[k]) continue;
        if (this.segment(t.murs[k]!)) {
          this.bas[k] = true;
          this.ev |= EV_CIBLE;
          this.points(POINTS.cible);
          if (t.banques[q]!.every((j) => this.bas[j])) {
            this.ev |= EV_BANQUE;
            this.points(POINTS.banque);
            this.banqueDans[q] = r.banqueRelevee;
            this.ouvrirPassage();
          }
        }
      }
    }
    this.batteur(GAUCHE, ORIGINE, PIVOT_Y, LONGUEUR);
    this.batteur(DROITE, ORIGINE, PIVOT_Y, LONGUEUR);
    // lot PBG1 : le mini-batteur suit l'angle du batteur du même côté (le même appui : la rediffusion ne change pas de forme)
    if (t.mini) this.batteur(t.mini.cote, t.mini.x, t.mini.y, t.mini.longueur);
    // lot PBG3 : le poteau sauveur, quand il est armé, renvoie la bille vers le haut une fois
    if (!this.servie && this.lampes[0] && this.lampes[1]) this.sauveur(r, t);
    // --- les capteurs
    for (let i = 0; i < t.voies.length; i++) {
      const v = t.voies[i]!;
      if (this.voiesAllumees[i] || Math.abs(this.x - v.x) >= 14 * UNITE || Math.abs(this.y - v.y) >= 10 * UNITE) continue;
      this.voiesAllumees[i] = true;
      this.ev |= EV_VOIE;
      this.points(POINTS.voie);
      if (this.voiesAllumees.every(Boolean)) {
        this.points(POINTS.trouVoies); // les points d'abord, au multiplicateur d'avant ; le cran monte ensuite
        this.mult = Math.min(MULT_MAX, this.mult + 1);
        this.multMax = Math.max(this.multMax, this.mult);
        this.ev |= EV_MULT;
        this.voiesDans = r.voiesRelevees;
      }
    }
    // lot PBG3 : les lampes des couloirs de retour (la bille y descend), puis le passage de la porte
    for (let i = 0; i < 2; i++) {
      const l = t.sauveur.lampes[i]!;
      // lot PBL1 : une bille que le poteau a déjà servie n'allume plus les lampes (une fois par bille)
      if (!this.servie && !this.lampes[i] && oy < l.y && this.y >= l.y && Math.abs(this.x - l.x) < l.l) {
        this.lampes[i] = true;
        this.ev2 |= EV2_LAMPE;
        if (this.lampes[0] && this.lampes[1]) {
          this.ev2 |= EV2_SAUVEUR_ARME;
          this.sauveurTick = this.tick;
        }
      }
    }
    if (t.passage && this.passageOuvert > 0 && !this.passageServi) this.franchirPassage(r, t);
    for (let i = 0; i < t.spinners.length; i++) {
      const c = t.spinners[i]!;
      if (Math.abs(this.x - c.x) < c.l && ((oy < c.y && this.y >= c.y) || (oy > c.y && this.y <= c.y))) {
        this.spin[i] = this.spin[i]! + 1000 * Math.min(30, div(Math.abs(this.vy), 40 * UNITE));
        this.ev |= EV_SPINNER;
        this.points(POINTS.spinner);
      }
    }
    for (let i = 0; i < t.trous.length; i++) {
      const tr = t.trous[i]!;
      const dx = this.x - tr.x;
      const dy = this.y - tr.y;
      if (this.trouPause[i]! <= 0 && dx * dx + dy * dy < 121 * UNITE * UNITE && this.vx * this.vx + this.vy * this.vy < d.trouVitesseMax2) {
        // lot PBG2 : le verrou allumé garde la bille pour de bon
        if (this.verrouAllume && i === t.verrou) return this.verrouiller(i, r);
        this.captif = r.trouGarde;
        this.captifDe = i;
        this.x = tr.x;
        this.y = tr.y;
        this.vx = 0;
        this.vy = 0;
        this.trouPause[i] = r.trouPause;
        this.ev |= EV_TROU;
        this.points(POINTS.trou);
      }
    }
    this.elements(r);
    // --- le retour dans le couloir du lanceur, puis la bille perdue
    if (this.x > 350 * UNITE && this.y > 690 * UNITE && Math.abs(this.vy) < 60 * UNITE && !this.couloirPris()) {
      this.dansLanceur = true;
      this.x = LANCE_X2 * UNITE / 2;
    }
    if (this.y > PERDUE_Y * UNITE) {
      if (this.multibille) this.perdueEnMultibille();
      else if (r.sauvee > 0 && !this.sauvee && this.tick - this.entree <= r.sauvee) {
        const servie = this.servie; // la même bille revient au lanceur : le poteau l'a déjà servie, ou pas
        this.nouvelleBille();
        this.sauvee = true;
        this.servie = servie;
        this.ev |= EV_SAUVEE;
      } else {
        this.ev |= EV_PERDUE;
        if (--this.billes <= 0) {
          this.fin = true;
          this.ev |= EV_FIN;
        } else this.nouvelleBille();
      }
    }
  }

  /**
   * **Le poteau sauveur** (lot PBG3). Armé (les deux lampes allumées), il sort entre les batteurs ; la première bille qui le touche est renvoyée vers le haut (`sauveurForce` px/s) et un peu de côté (`sauveurDevie` px/s, du côté où elle l'a touché : jamais droit au milieu de la table),
   * **une seule fois par bille** (lot PBL1) : il redescend, les lampes s'éteignent, et la bille servie (`servie`) n'allume plus rien ni n'est servie de nouveau avant la bille suivante. Pendant la multibille il sert la première bille qui le touche et que lui n'a pas encore servie.
   */
  private sauveur(r: Reglages, t: Table): void {
    const z = t.sauveur;
    const m = z.r + RU;
    const dx = this.x - z.x;
    const dy = this.y - z.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= m * m) return;
    // la bille est posée sur le poteau, puis lancée : vers le haut, de côté selon l'endroit du contact (6 px/s par pixel d'écart au centre)
    if (d2 === 0) this.y = z.y - m;
    else {
      const dd = racine(d2);
      this.x = z.x + div(unitaire(dx, dd) * m, NORME);
      this.y = z.y + div(unitaire(dy, dd) * m, NORME);
    }
    // de côté : du côté où la bille a touché le poteau (sur l'axe exact : tantôt à gauche, tantôt à droite, selon les sauvetages déjà faits) — jamais droit au milieu de la table
    const cote = dx > 0 ? 1 : dx < 0 ? -1 : this.sauvetages % 2 === 0 ? -1 : 1;
    this.vy = -r.sauveurForce * UNITE;
    this.vx = cote * r.sauveurDevie * UNITE + (this.x - z.x) * 3;
    this.px = this.x;
    this.py = this.y;
    this.lampes = [false, false];
    this.servie = true;
    this.sauvetages++;
    this.sauveurTick = this.tick;
    this.ev2 |= EV2_SAUVEUR;
  }

  /** **Le passage de la porte** (lot PBG3) : la bille franchit la ligne du battant (dans un sens ou dans l'autre) pendant que la porte est ouverte. Rapporte `portePoints`, fait avancer la mission d'un cran (pendant la multibille : un jackpot de plus) ; la porte se referme `porteApres` pas plus tard. */
  private franchirPassage(r: Reglages, t: Table): void {
    const g = t.passage!;
    const avant = div((this.px - g.x) * g.ux + (this.py - g.y) * g.uy, NORME);
    const apres = div((this.x - g.x) * g.ux + (this.y - g.y) * g.uy, NORME);
    if (avant < 0 === apres < 0) return;
    const lat = div((this.x - g.x) * g.nx + (this.y - g.y) * g.ny, NORME);
    if (Math.abs(lat) >= g.l) return;
    this.passageServi = true;
    this.passages++;
    this.passageOuvert = Math.min(this.passageOuvert, r.porteApres);
    const avantScore = this.score;
    this.points(r.portePoints);
    this.portePoints += this.score - avantScore;
    this.ev2 |= EV2_PORTE_PASSAGE;
    this.pourLaMission(this.mission);
  }

  /** **La bille quitte la rampe par l'aiguillage** (lot PBG3) : la rampe est réussie (points, combo), la bille traverse la table en ligne droite, au-dessus de tout, jusqu'au verrou ou à l'élément du thème. */
  private aiguiller(a: Aiguillage, vers: 1 | 2, r: Reglages): void {
    const rang = this.rail;
    this.railReussi(rang, r);
    const arrivee = (vers === 1 ? a.versVerrou : a.versElement)!;
    this.rail = vers === 1 ? -2 : -3;
    this.railS = 0;
    this.railV = 0;
    this.railDepuis = 0;
    this.x = a.x;
    this.y = a.y;
    this.vx = div((arrivee.x - a.x) * TICKS_PAR_SECONDE, arrivee.pas);
    this.vy = div((arrivee.y - a.y) * TICKS_PAR_SECONDE, arrivee.pas);
    this.aiguillages++;
    this.ev2 |= EV2_AIGUILLAGE;
  }

  /** Un pas d'une bille dérivée par l'aiguillage : elle avance en ligne droite et ne touche rien ; à l'arrivée elle est verrouillée, ou prend l'élément du thème (jackpot) et en ressort par le bas. */
  private enTransit(r: Reglages, t: Table): void {
    const a = t.aiguillage!;
    const vers = this.rail === -2 ? a.versVerrou! : a.versElement!;
    this.railS++;
    this.railDepuis++;
    if (this.railS < vers.pas) {
      this.x = a.x + div((vers.x - a.x) * this.railS, vers.pas);
      this.y = a.y + div((vers.y - a.y) * this.railS, vers.pas);
      return;
    }
    const verrou = this.rail === -2;
    this.couche = 0;
    this.rail = -1;
    this.railS = 0;
    this.railV = 0;
    this.railDepuis = 0;
    this.x = vers.x;
    this.y = vers.y;
    this.px = this.x;
    this.py = this.y;
    if (verrou) {
      // la bille tombe dans le verrou ; s'il n'est plus allumé (essai, réglage) le trou la garde comme à l'ordinaire
      if (this.verrouAllume) return this.verrouiller(t.verrou, r);
      this.captif = r.trouGarde;
      this.captifDe = t.verrou;
      this.vx = 0;
      this.vy = 0;
      this.trouPause[t.verrou] = r.trouPause;
      this.ev |= EV_TROU;
      this.points(POINTS.trou);
      return;
    }
    // l'élément du thème : le jackpot est pour la bille qui arrive, elle ressort par le bas ; l'élément se repose un moment
    const e = a.versElement!;
    if (this.multibille) this.jackpot();
    this.y = e.y + e.r + 12 * UNITE;
    this.px = this.x;
    this.py = this.y;
    this.vx = 0;
    this.vy = 150 * UNITE;
    this.tourbillonPause.fill(r.tourbillonPause);
    this.portailPause.fill(r.portailPause);
    this.geyserAttente.fill(r.geyserPause);
  }

  /** Une autre bille attend-elle déjà dans le couloir du lanceur ? (Une seule y tient : la suivante reste posée sur elle jusqu'à son départ.) */
  private couloirPris(): boolean {
    for (const b of this.autres) if (b.dansLanceur) return true;
    return false;
  }

  /**
   * **Les billes se touchent** (lot PBG2) : deux billes qui se recouvrent sont écartées chacune d'une moitié du recouvrement, et si elles se rapprochent elles se renvoient leur vitesse selon la normale (`rebondBille` ‰ :
   * 1 000, élastique, à masses égales : elles échangent leurs vitesses normales). **L'ordre est fixe** (la principale, puis `autres`, les paires dans l'ordre) : la partie reste déterministe. Une bille captive, sur un rail
   * ou dans le couloir du lanceur ne touche à rien. Au plus 5 px de recouvrement par pas (2,5 px chacune) : **aucune bille ne passe à travers une autre** (`test/billes.test.ts`).
   */
  private collisionsDesBilles(): void {
    const lue = (this.lue ??= billeVide(-1, 0, 0));
    const tous: Bille[] = [];
    if (!this.vide) {
      lue.x = this.x;
      lue.y = this.y;
      lue.vx = this.vx;
      lue.vy = this.vy;
      lue.captif = this.captif;
      lue.couche = this.couche;
      lue.dansLanceur = this.dansLanceur;
      tous.push(lue);
    }
    for (const b of this.autres) tous.push(b);
    const e = this.reglages.rebondBille;
    const mur = 2 * RU;
    for (let i = 0; i < tous.length; i++) {
      const a = tous[i]!;
      if (a.captif > 0 || a.couche === 1 || a.dansLanceur) continue;
      for (let j = i + 1; j < tous.length; j++) {
        const b = tous[j]!;
        if (b.captif > 0 || b.couche === 1 || b.dansLanceur) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= mur * mur) continue;
        let nx = NORME;
        let ny = 0;
        let dd = 0;
        if (d2 > 0) {
          dd = racine(d2);
          nx = unitaire(dx, dd);
          ny = unitaire(dy, dd);
        }
        const rec = mur - dd;
        const ma = div(rec, 2);
        const mb = rec - ma;
        a.x -= div(nx * ma, NORME);
        a.y -= div(ny * ma, NORME);
        b.x += div(nx * mb, NORME);
        b.y += div(ny * mb, NORME);
        const vn = div((a.vx - b.vx) * nx + (a.vy - b.vy) * ny, NORME);
        if (vn > 0) {
          const j2 = div((1000 + e) * vn, 2000);
          a.vx -= div(j2 * nx, NORME);
          a.vy -= div(j2 * ny, NORME);
          b.vx += div(j2 * nx, NORME);
          b.vy += div(j2 * ny, NORME);
        }
      }
    }
    if (!this.vide) {
      this.x = lue.x;
      this.y = lue.y;
      this.vx = lue.vx;
      this.vy = lue.vy;
    }
  }

  /**
   * **Les forces des éléments des thèmes** (lot PB3), après la pente et avant le plafond de vitesse : elles ne font qu'ajouter de la vitesse, que le plafond borne (la bille ne fait jamais plus de 2,5 px par pas, donc ne
   * traverse rien). Le manège entraîne la bille, le tourbillon l'attire et la fait tourner, le trou noir l'attire, la coulée pousse vers le haut la bille qui y monte (jamais celle qui y tombe : un élément qui pousse
   * dans les deux sens garderait la bille à son bord pour toujours).
   */
  private zones(d: Derives, r: Reglages, t: Table): void {
    for (let i = 0; i < t.plateaux.length; i++) {
      const z = t.plateaux[i]!;
      const dx = this.x - z.x;
      const dy = this.y - z.y;
      if (dx * dx + dy * dy >= z.r * z.r) {
        this.manegeSecteur[i] = -1;
        continue;
      }
      // la poussée tangentielle, proportionnelle à la distance au centre : la bille tourne autour du plateau
      this.vx += div(div(dy * d.manegeAcc, z.r), TICKS_PAR_SECONDE);
      this.vy -= div(div(dx * d.manegeAcc, z.r), TICKS_PAR_SECONDE);
      // les tours (la maquette : la somme des angles parcourus autour du centre, dans un sens ou dans l'autre) : le secteur d'où l'on vient, celui où l'on est ; l'écart le plus court compte en huitièmes de tour, huit font un tour
      const sect = secteur(dx, dy);
      const avant = this.manegeSecteur[i]!;
      this.manegeSecteur[i] = sect;
      if (avant < 0) continue;
      const ecart = (sect - avant + 8) % 8;
      this.manegeAvance[i] = this.manegeAvance[i]! + (ecart > 4 ? 8 - ecart : ecart);
      if (this.manegeAvance[i]! >= 8) {
        this.manegeAvance[i] = this.manegeAvance[i]! - 8;
        this.ev |= EV_MANEGE;
        this.points(POINTS.manege);
        this.pourLaMission("manege");
      }
    }
    for (const z of t.tourbillons) {
      const dx = z.x - this.x;
      const dy = z.y - this.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= z.r * z.r || d2 === 0) continue;
      const dd = racine(d2);
      const nx = unitaire(dx, dd);
      const ny = unitaire(dy, dd);
      const radial = div(div(d.tourbillonRadial * (z.r - dd), z.r), TICKS_PAR_SECONDE);
      const tangent = div(d.tourbillonTangent, TICKS_PAR_SECONDE);
      this.vx += div(nx * radial - ny * tangent, NORME);
      this.vy += div(ny * radial + nx * tangent, NORME);
    }
    for (const z of t.trousNoirs) {
      const dx = z.x - this.x;
      const dy = z.y - this.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= z.r * z.r || d2 <= 36 * UNITE * UNITE) continue;
      // l'attraction vaut `force / distance²` px/s² (au plus 1 400), comptée avec une distance d'au moins 30 px : la bille la sent de loin, et ne s'y colle jamais
      const f = Math.min(1400 * UNITE, div(r.trouNoirForce * UNITE * UNITE, div(Math.max(d2, 900 * UNITE * UNITE), UNITE)));
      const dd = racine(d2);
      const a = div(f, TICKS_PAR_SECONDE);
      this.vx += div(unitaire(dx, dd) * a, NORME);
      this.vy += div(unitaire(dy, dd) * a, NORME);
    }
    for (let i = 0; i < t.coulees.length; i++) {
      const z = t.coulees[i]!;
      const dedans = Math.abs(this.x - z.x) < z.l && Math.abs(this.y - z.y) < z.h;
      if (dedans && this.vy <= 0) {
        this.vy -= d.couleeParPas;
        if (!this.couleeDedans[i]) {
          this.ev |= EV_COULEE;
          this.points(POINTS.coulee);
        }
      }
      this.couleeDedans[i] = dedans;
    }
  }

  /** **Les capteurs des éléments des thèmes** (lot PB3), après le déplacement : le tourbillon qui garde la bille, les portails, le geyser. */
  private elements(r: Reglages): void {
    const t = this.table;
    for (let i = 0; i < t.tourbillons.length; i++) {
      const z = t.tourbillons[i]!;
      const dx = this.x - z.x;
      const dy = this.y - z.y;
      if (this.tourbillonPause[i]! > 0 || dx * dx + dy * dy >= 100 * UNITE * UNITE) continue;
      this.captif = r.tourbillonGarde;
      this.captifTb = i;
      this.x = z.x;
      this.y = z.y;
      this.vx = 0;
      this.vy = 0;
      this.tourbillonPause[i] = r.tourbillonPause;
      this.ev |= EV_TOURBILLON;
      this.points(POINTS.tourbillon);
      this.pourLaMission("tourbillon");
      return;
    }
    for (let i = 0; i < t.portails.length; i++) {
      const p = t.portails[i]!;
      const dx = this.x - p.x;
      const dy = this.y - p.y;
      if (this.portailPause[i]! > 0 || dx * dx + dy * dy >= 169 * UNITE * UNITE) continue;
      const j = t.portails.findIndex((q) => q.id !== p.id);
      if (j < 0) continue;
      const autre = t.portails[j]!;
      // on sort de l'autre portail, 20 px plus bas, vers le bas
      this.x = autre.x;
      this.y = autre.y + 20 * UNITE;
      this.px = this.x;
      this.py = this.y;
      this.vy = div(Math.abs(this.vy) * 4, 5) + 120 * UNITE;
      this.portailPause[i] = r.portailPause;
      this.portailPause[j] = r.portailPause;
      this.ev |= EV_PORTAIL;
      this.points(POINTS.portail);
      this.pourLaMission("portail");
      break;
    }
    for (let i = 0; i < t.geysers.length; i++) {
      const z = t.geysers[i]!;
      const dx = this.x - z.x;
      const dy = this.y - z.y;
      if (this.geyserAttente[i]! > 0 || this.geyserJets >= r.geyserParBille || dx * dx + dy * dy >= z.r * z.r) continue;
      // le jet : la bille part vers le haut, et de côté, loin du geyser (jamais deux fois de suite au même endroit : un geyser qui renverrait la bille sur lui-même la garderait pour toujours)
      const sens = dx > 0 ? 1 : dx < 0 ? -1 : z.x < AXE * UNITE ? 1 : -1;
      this.vy = Math.min(this.vy, -r.geyserVitesse * UNITE);
      this.vx = div(this.vx, 2) + sens * r.geyserDevie * UNITE;
      this.geyserAttente[i] = r.geyserPause;
      this.geyserJet[i] = JET_GEYSER;
      this.geyserJets++;
      this.ev |= EV_GEYSER;
      this.points(POINTS.geyser);
      this.pourLaMission("geyser");
      break;
    }
  }

  /**
   * **La bouche d'un rail** (lot PBG1). La bille la franchit dans le sens de la bouche : à `rampeVitesseMin` (px/s, composante dans ce sens) ou plus elle est **prise** — elle change de couche, au bout du rail qui est
   * celui de la bouche ; plus lente, la bouche est un mur (la bille « redescend par l'entrée »). Dans l'autre sens, ou de côté, la bouche ne fait rien : une bille qui descend passe sous le rail.
   */
  private porte(g: Porte, d: Derives): void {
    const dx = this.x - g.x;
    const dy = this.y - g.y;
    const sd = div(dx * g.ux + dy * g.uy, NORME);
    if (sd <= -RU || sd >= RU) return;
    const vn = div(this.vx * g.ux + this.vy * g.uy, NORME);
    // une bille qui longe la bouche (vitesse d'entrée presque nulle) passe : la bouche n'est un mur que pour celle qui s'y jette
    if (vn <= BOUCHE_MIN) return;
    if (vn >= d.rampeMin) {
      const lat = div(-dx * g.uy + dy * g.ux, NORME);
      if (Math.abs(lat) > g.l) {
        if (sd < 0) this.segment(g.seg);
        return;
      }
      const rail = this.table.rails[g.rail]!;
      this.couche = 1;
      this.rail = g.rail;
      this.railS = g.bout === 0 ? 0 : rail.len;
      this.railV = g.bout === 0 ? vn : -vn;
      this.railDepuis = 0;
      this.railBout = g.bout;
      this.x = g.x;
      this.y = g.y;
      this.vx = 0;
      this.vy = 0;
      this.ev |= EV_RAIL;
    } else if (sd < 0) this.segment(g.seg);
  }

  /**
   * **Un pas sur un rail** (lot PBG1) : la bille suit le tracé, sans rien toucher d'autre. Elle ralentit en montant et accélère en descendant (`rampePente` multipliée par la pente du tracé), perd un peu de vitesse
   * par le frottement, et avance de `railV / 600`. **Au bout du rail** (la sortie) elle repart sur le plateau dans le sens du tracé, et le rail est réussi (points, combo) ; **si elle recule jusqu'à son entrée** (trop lente)
   * elle en ressort vers l'arrière, sans rien rapporter. Au plus `RAIL_DUREE_MAX` pas sur un rail : un tracé plat ne garde jamais la bille.
   */
  private surRail(d: Derives, r: Reglages, t: Table): void {
    const rl = t.rails[this.rail]!;
    const n = rl.ux.length;
    let k = 0;
    while (k < n - 1 && rl.cum[k + 1]! <= this.railS) k++;
    this.railV += div(rl.uy[k]! * d.railParPas, NORME);
    this.railV -= div(this.railV * d.railFrein, 1000000);
    if (this.railV > d.vitesseMax) this.railV = d.vitesseMax;
    else if (this.railV < -d.vitesseMax) this.railV = -d.vitesseMax;
    const avant = this.railS;
    this.railS += div(this.railV, TICKS_PAR_SECONDE);
    this.railDepuis++;
    // lot PBG3 : l'aiguillage — la bille qui monte la rampe et franchit son point est dérivée (vers le verrou allumé, vers l'élément du thème en multibille)
    const ag = t.aiguillage;
    if (ag && this.rail === ag.rail && this.railBout === 0 && this.railV > 0 && avant < ag.s && this.railS >= ag.s) {
      const vers = this.aiguillageVers;
      if (vers === 1 || vers === 2) return this.aiguiller(ag, vers, r);
    }
    if (this.railDepuis > RAIL_DUREE_MAX && this.railV > 0 && this.railS < rl.len) this.railV = -this.railV; // un tracé plat ne garde jamais la bille : elle repart par où elle est venue
    if (this.railS >= rl.len || this.railS <= 0) {
      const sortie = this.railS >= rl.len;
      const fin = n - 1;
      // la direction de sortie : celle du dernier segment (en avant) ou le contraire de celle du premier (en arrière)
      const ux = sortie ? rl.ux[fin]! : -rl.ux[0]!;
      const uy = sortie ? rl.uy[fin]! : -rl.uy[0]!;
      const v = Math.abs(this.railV);
      const bx = sortie ? rl.x[fin + 1]! : rl.x[0]!;
      const by = sortie ? rl.y[fin + 1]! : rl.y[0]!;
      // la bille ressort un peu en avant de la bouche (la bouche ne la reprend pas) : 16 px
      this.x = bx + div(ux * 16 * UNITE, NORME);
      this.y = by + div(uy * 16 * UNITE, NORME);
      this.vx = div(ux * v, NORME);
      this.vy = div(uy * v, NORME);
      this.couche = 0;
      const faite = this.rail;
      this.rail = -1;
      this.railV = 0;
      this.px = this.x;
      this.py = this.y;
      // bouche d'une orbite : la bille y ressort par le bout opposé à son entrée ; seule la traversée (de l'entrée à l'autre bout) est réussie. Une rampe reculée ou une orbite ressortie par son entrée ne rapporte rien.
      const traversee = sortie ? this.railBout === 0 : this.railBout === 1;
      if (traversee) this.railReussi(faite, r);
      else this.ev |= EV_RECUL;
    }
    if (this.couche === 1) {
      let j = 0;
      while (j < n - 1 && rl.cum[j + 1]! <= this.railS) j++;
      this.x = rl.x[j]! + div(rl.ux[j]! * (this.railS - rl.cum[j]!), NORME);
      this.y = rl.y[j]! + div(rl.uy[j]! * (this.railS - rl.cum[j]!), NORME);
      // la vitesse du tracé (pour le rendu et le robot : une bille sur un rail a une vitesse, pas un arrêt)
      this.vx = div(rl.ux[j]! * this.railV, NORME);
      this.vy = div(rl.uy[j]! * this.railV, NORME);
    }
  }

  /** Un rail mené à son bout : ses points, augmentés de `comboPas` % par rang de combo (`comboMax` au plus) puis multipliés par le multiplicateur ; un deuxième rail réussi dans les `comboDelai` pas qui suivent le précédent fait monter le combo. */
  private railReussi(rang: number, r: Reglages): void {
    const rl = this.table.rails[rang]!;
    this.combo = this.tick <= this.comboFin ? this.combo + 1 : 1;
    this.comboFin = this.tick + r.comboDelai;
    this.comboMaxPartie = Math.max(this.comboMaxPartie, this.combo);
    this.railsFaits[rang] = this.railsFaits[rang]! + 1;
    this.ev |= rl.genre === "rampe" ? EV_RAMPE : EV_ORBITE;
    if (rl.genre === "orbite" && this.table.passage && !this.table.passage.parBanque) this.ouvrirPassage();
    if (this.combo >= 2) this.ev |= EV_COMBO;
    this.points(div((rl.genre === "rampe" ? r.rampePoints : r.orbitePoints) * (100 + r.comboPas * (Math.min(this.combo, r.comboMax) - 1)), 100));
  }

  private finDuPas(): void {
    this.tick++;
    if (!this.fin && this.tick >= DUREE_MAX_TICKS) {
      this.fin = true;
      this.ev |= EV_FIN;
    }
  }

  private choquerSling(s: Segment): void {
    this.chocSling[s.ax < AXE * UNITE ? 0 : 1] = 40;
  }

  /** La bille contre un cercle : elle en sort, rebondit (`e` en ‰, relativement à la vitesse du cercle) et reçoit son coup. Vrai en cas de contact. */
  private cercle(cx: number, cy: number, cr: number, e: number, kick: number, vxo = 0): boolean {
    const m = cr + RU;
    const dx = this.x - cx;
    const dy = this.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= m * m || d2 === 0) return false;
    const dd = racine(d2);
    const nx = unitaire(dx, dd);
    const ny = unitaire(dy, dd);
    this.x = cx + div(nx * m, NORME);
    this.y = cy + div(ny * m, NORME);
    const vn = div((this.vx - vxo) * nx + this.vy * ny, NORME);
    if (vn < 0) {
      this.vx -= div((1000 + e) * vn * nx, 1000 * NORME);
      this.vy -= div((1000 + e) * vn * ny, 1000 * NORME);
    }
    if (kick) {
      this.vx += div(nx * kick, NORME);
      this.vy += div(ny * kick, NORME);
    }
    return true;
  }

  /** La bille contre un mur (segment de rayon `RAYON`). Vrai en cas de contact. */
  private segment(s: Segment): boolean {
    const x = this.x;
    const y = this.y;
    if (x < s.x0 - RU || x > s.x1 + RU || y < s.y0 - RU || y > s.y1 + RU) return false;
    let p = div((x - s.ax) * s.ux + (y - s.ay) * s.uy, NORME);
    p = p < 0 ? 0 : p > s.len ? s.len : p;
    const qx = s.ax + div(s.ux * p, NORME);
    const qy = s.ay + div(s.uy * p, NORME);
    const dx = x - qx;
    const dy = y - qy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= RU2) return false;
    let nx: number;
    let ny: number;
    if (d2 === 0) {
      // le centre exactement sur le mur : on sort du côté d'où la bille vient
      nx = -s.uy;
      ny = s.ux;
      if (this.vx * nx + this.vy * ny > 0) {
        nx = -nx;
        ny = -ny;
      }
    } else {
      const dd = racine(d2);
      nx = unitaire(dx, dd);
      ny = unitaire(dy, dd);
    }
    this.x = qx + div(nx * RU, NORME);
    this.y = qy + div(ny * RU, NORME);
    const vn = div(this.vx * nx + this.vy * ny, NORME);
    if (vn < 0) {
      this.vx -= div((1000 + s.e) * vn * nx, 1000 * NORME);
      this.vy -= div((1000 + s.e) * vn * ny, 1000 * NORME);
      this.vx = div(this.vx * this.reglages.frottementMur, 1000);
      this.vy = div(this.vy * this.reglages.frottementMur, 1000);
    }
    if (s.kick && vn < -this.d.seuilSling) {
      this.vx += div(nx * s.kick, NORME);
      this.vy += div(ny * s.kick, NORME);
      this.ev |= EV_SLING;
      this.points(POINTS.sling);
    }
    return true;
  }

  /** La bille contre un batteur : une capsule du pivot à la pointe (rayon 8 à 5 px), dont la surface en mouvement la pousse. Calculé pour le batteur gauche ; le droit est son image. */
  private batteur(i: number, ox: number, oy: number, longueur: number): void {
    const sens = i === GAUCHE ? 1 : -1;
    const a = this.a[i]!;
    const bx = sens > 0 ? this.x : AXE2 - this.x;
    const by = this.y;
    const co = cosinus(a);
    const si = sinus(a);
    let p = div((bx - ox) * co + (by - oy) * si, NORME);
    p = p < 0 ? 0 : p > longueur ? longueur : p;
    const qx = ox + div(co * p, NORME);
    const qy = oy + div(si * p, NORME);
    const m = RU + BATTEUR_GROS - div(BATTEUR_PERTE * p, longueur);
    const dx = bx - qx;
    const dy = by - qy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= m * m) return;
    let nx: number;
    let ny: number;
    if (d2 === 0) {
      nx = si;
      ny = -co;
    } else {
      const dd = racine(d2);
      nx = unitaire(dx, dd);
      ny = unitaire(dy, dd);
    }
    const nbx = qx + div(nx * m, NORME);
    const nby = qy + div(ny * m, NORME);
    const da = a - this.aAvant[i]!;
    const vqx = -div(da * (qy - oy) * K_VITESSE, 100000);
    const vqy = div(da * (qx - ox) * K_VITESSE, 100000);
    const bvx = sens * this.vx;
    const bvy = this.vy;
    const vn = div((bvx - vqx) * nx + (bvy - vqy) * ny, NORME);
    let nvx = bvx;
    let nvy = bvy;
    if (vn < 0) {
      nvx -= div((1000 + this.reglages.rebondBatteur) * vn * nx, 1000 * NORME);
      nvy -= div((1000 + this.reglages.rebondBatteur) * vn * ny, 1000 * NORME);
    }
    this.x = sens > 0 ? nbx : AXE2 - nbx;
    this.y = nby;
    this.vx = sens * nvx;
    this.vy = nvy;
  }
}
