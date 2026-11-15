// Les constantes de la recherche sont posées dans des locales : sous Vitest (module runner) chaque import se lit par un accesseur, 3 fois plus lent dans une boucle de millions de pas.
import * as K from "./constantes";
import * as M from "./monde";
import type { Terrain } from "./monde";
import { Partie, type Resultat } from "./partie";
const { BONUS_PORTEE, CASE, DUREE_MAX_TICKS, GEMME_PORTEE, LARGEUR_MORCEAU, PIECE_PORTEE, POINTS_GEMME, POINTS_PIECE, TAILLE, TAMPON } = K;
const { BLOC, GLACE, TAPIS } = M;

// LE ROBOT (lot GR2) — il joue la vraie simulation, comme un humain, et sert à deux choses : **prouver que chaque morceau se passe** (`test/franchissabilite.test.ts`) et **donner les seuils des médailles**
// (`seuils.ts`). Il remplace le pilote d'essai du lot GR1.
//
// **L'algorithme en cinq lignes.**
//  1. Il ne décide qu'une chose : appuyer, ou non, à un pas donné. Il essaie ses coups sur des copies de la partie (`Partie.copier(true)` : la même physique, sans ramassage, donc sans bouclier), puis rejoue son choix sur la vraie partie.
//  2. Il cherche, **avec retour en arrière**, les suites d'appuis qui laissent la partie jouable jusqu'à la fin du morceau `k + ROBOT_HORIZON` (`k` : celui où il est) : un choix au morceau `m` qui condamne `m + 1` est vu
//     et refusé. Les états du monde sans appui sont mémorisés une fois pour toutes (graphe partagé), le jugement d'un état aussi : la recherche ne refait jamais deux fois le même calcul.
//  3. **Il joue comme un humain** : deux appuis sont séparés d'au moins `ROBOT_ECART_MIN` pas ; un appui n'est retenu que si la partie reste jouable quand il arrive `ROBOT_MARGE` pas plus tôt ou plus tard (une fenêtre d'au
//     moins `ROBOT_FENETRE_MIN` pas), et chaque appui de la suite a sa propre fenêtre ; il ne passe jamais par le bouclier (la copie qu'il essaie n'en a pas : un danger la tue). **Précision** : l'appui qu'il joue est
//     toujours éprouvé pas à pas (ses 9 pas) ; ceux de la suite, que la recherche juge d'avance, le sont sur des échantillons tous les 4 pas (`PAS_ECHANTILLON`) — chacun est éprouvé pas à pas à son tour quand il arrive.
//  4. Parmi les suites permises il prend celle qui ramasse le plus (pièces, gemmes, bonus) sur les `ROBOT_VUE_PAS` pas qui viennent — « tout ce que le chemin sûr porte » : les pièces y sont posées —, au milieu de la
//     plage des ex æquo. Le chemin sûr du générateur ne le guide donc que par ses pièces : jamais un rail, et s'il faut lâcher une pièce pour survivre il la lâche.
//  5. Le rapport (`RapportRobot`) compte les pièces prises et laissées et note chaque appui avec le morceau, le motif et la fenêtre mesurée : les passages les plus serrés du jour.
//
// **Aucun hasard, aucun flottant, aucune horloge** : deux appels donnent la même partie (`test/robot.test.ts`). Le jeu ne charge le robot que pour `?robot` et `?morceau=` (hors production) ou pour les seuils d'un jour
// qui n'est pas figé ; le serveur ne le lance pas à chaque partie (`seuils.ts`).

/** L'écart minimal entre deux appuis du robot : 12 pas = 100 ms, la cadence d'un doigt. */
export const ROBOT_ECART_MIN = 12;
/** La fenêtre de réussite minimale d'un appui nécessaire : 8 pas ≈ 67 ms — le passage reste franchissable si l'appui arrive jusqu'à `ROBOT_MARGE` pas plus tôt ou plus tard. */
export const ROBOT_FENETRE_MIN = 8;
/** La marge de chaque côté de l'appui choisi : la moitié de la fenêtre minimale (4 pas ≈ 33 ms) ; le robot éprouve les deux côtés et l'appui lui-même, donc une fenêtre de `ROBOT_FENETRE_MIN + 1` pas au moins. */
export const ROBOT_MARGE = ROBOT_FENETRE_MIN / 2;
/** Combien de morceaux au-delà de celui où il se trouve le robot garantit : jusqu'à la fin du morceau `k + 2`. */
export const ROBOT_HORIZON = 2;
/** La vue du robot quand il compare deux suites d'appuis : ce qu'elles ramassent pendant les 120 à 160 pas qui viennent (la fin de la vue avance par paquets de `PAQUET_VUE` pas, pour que les plans se partagent). */
export const ROBOT_VUE_PAS = 160;
/** Le robot ne passe jamais par le bouclier : toute copie qu'il essaie ignore les bonus (`Partie.ramasse` faux), donc un danger la tue. Vérifié par `test/robot.test.ts`. */
export const ROBOT_SANS_BOUCLIER = true;
/** Ce que vaut un bonus dans la comparaison des suites (une pièce vaut 10, une gemme 100, au multiplicateur ×1). */
const VALEUR_BONUS = 30;
const PAQUET_VUE = 40;
/** Les appuis comparés tombent sur les pas multiples de 4 (le milieu d'une plage n'a pas besoin de plus : la fenêtre, elle, est éprouvée pas à pas) : un quart des coups à juger. */
const PAS_COUP = 4;
/** La recherche n'essaie un appui que tous les 4 pas (les multiples de 4) et suppose que les pas entre deux appuis qui passent passent aussi ; **l'appui que le robot joue est toujours éprouvé pas à pas** (ses 9 pas, `verifier`) : l'hypothèse ne sert qu'à explorer. */
const PAS_ECHANTILLON = 4;
/** Au-delà de ce nombre d'états gardés (quelques dizaines de Mo), le robot repart d'un graphe vide (rien n'est faux : il recalcule). */
const LIMITE_GRAPHE = 100000;
/** La plus large fenêtre qu'on mesure autour d'un appui (de chaque côté) : au-delà elle est « large ». */
const MESURE_MAX = 20;
const DEMI_JOUEUR = TAILLE >> 1;

/** Un appui du robot, avec ce que le rapport en dit. */
export interface AppuiRobot {
  tick: number;
  /** Le morceau où il a lieu et son motif (`special-<thème>` pour la case spéciale d'un thème). */
  morceau: number;
  motif: string;
  /** La fenêtre de réussite : les pas consécutifs autour de l'appui (lui compris) qui réussissent aussi, mesurée jusqu'à `2 × MESURE_MAX + 1`. */
  fenetre: number;
  /** Faux : aucune fenêtre ≥ `ROBOT_FENETRE_MIN` n'existait (mode de diagnostic seulement) — un passage que le générateur doit corriger. */
  respecte: boolean;
}
export interface RapportRobot {
  appuis: AppuiRobot[];
  /** Pièces prises, et pièces sorties de l'écran sans être prises (celles du chemin sûr que le robot a lâchées). */
  piecesPrises: number;
  piecesLachees: number;
  /** Les passages sans fenêtre (mode de diagnostic) : `{ morceau, motif, tick }`. */
  entorses: { morceau: number; motif: string; tick: number }[];
}
export interface OptionsRobot {
  /** Jouer au plus jusqu'à ce pas (défaut : la partie entière, `DUREE_MAX_TICKS`). */
  maxTicks?: number;
  /** S'arrêter dès que le joueur a parcouru cette distance (mètres). */
  maxDistance?: number;
  /** Strict (défaut) : aucun appui sans sa fenêtre — c'est la preuve de franchissabilité. Faux : si un passage n'a pas de fenêtre, des fenêtres plus étroites (jusqu'à 0) puis des horizons plus courts sont essayés, et le passage est noté dans `entorses` — le diagnostic. */
  strict?: boolean;
  /** Des distances (mètres) où `surPoint` est appelée quand la partie les atteint. */
  arrets?: readonly number[];
  surPoint?: (distance: number, p: Partie) => void;
}

/** Un état du monde sans appui : un indice dans les tableaux du graphe. */
type Noeud = number;
const NON_CALCULE = -2;
const AUCUN = -1;

/** La surface compte seulement au sol ou dans la grâce, et seulement par ses deux effets : le tapis (vitesse) et la glace (pas d'appui) : 0 autre, 1 tapis, 2 glace. */
const surfaceDe = (p: Partie): number => (p.sol || p.grace > 0 ? (p.surface === TAPIS ? 1 : p.surface === GLACE ? 2 : 0) : 0);
/** Les drapeaux d'un état : gravité (bit 0 : 1 = vers le bas), sol (bit 1), surface (bits 2-3), grâce (bits 4-7), tampon (bits 8-11). */
const drapeaux = (p: Partie): number => (p.g === 1 ? 1 : 0) | (p.sol ? 2 : 0) | (surfaceDe(p) << 2) | (p.grace << 4) | (p.tampon << 8);
const empreinte = (tick: number, x: number, y: number, vy: number, f: number): number => {
  const h = Math.imul(tick, 0x7f4a7c15) ^ Math.imul(x, 0x85ebca6b) ^ Math.imul(y, 0xc2b2ae35) ^ Math.imul(vy, 0x27d4eb2f) ^ f;
  return Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
};

/**
 * Le graphe des états du monde sans appui, **partagé par toutes les recherches** : deux recherches, deux appuis qui arrivent au même état ne le calculent qu'une fois. Un état tient dans des tableaux d'entiers (une seule
 * `Partie` de travail les lit et les écrit : pas d'allocation par pas, le coût du robot en dépend). Pour chaque état : son pas suivant, l'état qu'un appui y déclenche, ce qu'il ramasse, jusqu'où le monde sans appui y
 * est vivant, et la réussite d'un appui à ce pas pour une recherche donnée.
 */
class Graphe {
  private cap = 1 << 15;
  private tick = new Int32Array(this.cap);
  private xs = new Int32Array(this.cap);
  private ys = new Int32Array(this.cap);
  private vys = new Int32Array(this.cap);
  private cams = new Int32Array(this.cap);
  private flags = new Int32Array(this.cap);
  private suiv = new Int32Array(this.cap).fill(NON_CALCULE);
  private jinvA = new Int32Array(this.cap).fill(NON_CALCULE);
  private invA = new Int32Array(this.cap).fill(NON_CALCULE);
  private gs = new Int32Array(this.cap).fill(-1);
  private gi = new Int32Array(this.cap).fill(-1);
  /** Le monde sans appui depuis un état est vivant jusqu'à `x` unités (`Infinity` : jusqu'à la fin de la partie) ; `mort` : il s'arrête là. */
  private vivantX = new Float64Array(this.cap).fill(-1);
  private mortA = new Uint8Array(this.cap);
  private okRech = new Int32Array(this.cap).fill(-1);
  private okVal = new Uint8Array(this.cap);
  private autre = new Int32Array(this.cap).fill(AUCUN);
  private compte = 0;
  private readonly table = new Map<number, number>();
  private readonly travail: Partie;
  constructor(private readonly terrain: Terrain) {
    this.travail = new Partie(terrain);
    this.travail.ramasse = false;
  }
  get taille(): number {
    return this.compte;
  }
  tickDe = (n: Noeud): number => this.tick[n]!;
  xDe = (n: Noeud): number => this.xs[n]!;

  private grandir(): void {
    const cap = this.cap * 2;
    const g = <T extends Int32Array | Float64Array | Uint8Array>(a: T, rempli: number | null): T => {
      const b = new (a.constructor as new (n: number) => T)(cap);
      b.set(a);
      if (rempli !== null) (b as Int32Array).fill(rempli, this.cap);
      return b;
    };
    this.tick = g(this.tick, null);
    this.xs = g(this.xs, null);
    this.ys = g(this.ys, null);
    this.vys = g(this.vys, null);
    this.cams = g(this.cams, null);
    this.flags = g(this.flags, null);
    this.suiv = g(this.suiv, NON_CALCULE);
    this.jinvA = g(this.jinvA, NON_CALCULE);
    this.invA = g(this.invA, NON_CALCULE);
    this.gs = g(this.gs, -1);
    this.gi = g(this.gi, -1);
    this.vivantX = g(this.vivantX, -1);
    this.mortA = g(this.mortA, null);
    this.okRech = g(this.okRech, -1);
    this.okVal = g(this.okVal, null);
    this.autre = g(this.autre, AUCUN);
    this.cap = cap;
  }

  /** Le noeud de l'état de `p` (une partie quelconque : seul ce qui décide de la suite sans ramassage est gardé). */
  interner(p: Partie): Noeud {
    const f = drapeaux(p);
    // Un état en l'air ne se retrouve jamais par un autre chemin (chaque vol a son pas de départ) : on ne le range pas dans la table.
    const enLAir = !p.sol && p.grace === 0;
    let h = 0;
    if (!enLAir) {
      h = empreinte(p.tick, p.x, p.y, p.vy, f);
      const tete = this.table.get(h);
      for (let n = tete ?? AUCUN; n !== AUCUN; n = this.autre[n]!) {
        if (this.tick[n] === p.tick && this.xs[n] === p.x && this.ys[n] === p.y && this.vys[n] === p.vy && this.flags[n] === f && this.cams[n] === p.cam) return n;
      }
    }
    if (this.compte === this.cap) this.grandir();
    const n = this.compte++;
    this.tick[n] = p.tick;
    this.xs[n] = p.x;
    this.ys[n] = p.y;
    this.vys[n] = p.vy;
    this.cams[n] = p.cam;
    this.flags[n] = f;
    if (!enLAir) {
      this.autre[n] = this.table.get(h) ?? AUCUN;
      this.table.set(h, n);
    }
    return n;
  }

  /** Charge l'état `n` dans la partie de travail. */
  private charger(n: Noeud): Partie {
    const t = this.travail;
    const f = this.flags[n]!;
    t.tick = this.tick[n]!;
    t.cam = this.cams[n]!;
    t.x = this.xs[n]!;
    t.y = this.ys[n]!;
    t.vy = this.vys[n]!;
    t.g = f & 1 ? 1 : -1;
    t.sol = (f & 2) !== 0;
    const s = (f >> 2) & 3;
    t.surface = s === 1 ? TAPIS : s === 2 ? GLACE : BLOC;
    t.grace = (f >> 4) & 15;
    t.tampon = (f >> 8) & 15;
    t.mort = 0;
    t.ev = 0;
    t.invuln = 0;
    t.aimant = 0;
    t.bouclier = false;
    return t;
  }

  /** Un appui donné au pas de `n` est-il pris maintenant (sur une surface, ou dans la grâce, et pas sur la glace) ? */
  peutInverser(n: Noeud): boolean {
    const f = this.flags[n]!;
    return ((f & 2) !== 0 || (f >> 4) & 15) !== 0 && ((f >> 2) & 3) !== 2;
  }

  suivant(n: Noeud): Noeud {
    const s = this.suiv[n]!;
    if (s !== NON_CALCULE) return s;
    const t = this.charger(n);
    t.avancer();
    return (this.suiv[n] = t.finie ? AUCUN : this.interner(t));
  }

  /** Le noeud où un appui donné à `n` inverse (le premier des `TAMPON` pas qui le permet), ou AUCUN. */
  jinv(n: Noeud): Noeud {
    const r0 = this.jinvA[n]!;
    if (r0 !== NON_CALCULE) return r0;
    let r = AUCUN;
    let c = n;
    for (let k = 0; k < TAMPON && c !== AUCUN; k++) {
      if (this.peutInverser(c)) {
        r = c;
        break;
      }
      c = this.suivant(c);
    }
    return (this.jinvA[n] = r);
  }

  /** L'état après l'inversion déclenchée au pas de `n` (l'appui attendait dans le tampon), ou AUCUN si la partie finit dans ce pas. */
  apresInversion(n: Noeud): Noeud {
    const r0 = this.invA[n]!;
    if (r0 !== NON_CALCULE) return r0;
    const t = this.charger(n);
    t.tampon = 1;
    t.avancer();
    return (this.invA[n] = t.finie ? AUCUN : this.interner(t));
  }

  /** Ce que ramasse le pas de `n` à son suivant (les objets à portée du suivant et pas de `n`). */
  gainPas(n: Noeud): number {
    const v = this.gs[n]!;
    if (v >= 0) return v;
    const s = this.suivant(n);
    return (this.gs[n] = s === AUCUN ? 0 : this.objetsEntre(n, s));
  }
  /** Ce que ramasse l'inversion déclenchée au pas de `n`. */
  gainInversion(n: Noeud): number {
    const v = this.gi[n]!;
    if (v >= 0) return v;
    const q = this.apresInversion(n);
    return (this.gi[n] = q === AUCUN ? 0 : this.objetsEntre(n, q));
  }

  /** La valeur des objets que `b` touche et que `a` ne touchait pas (une pièce n'est prise qu'une fois : au pas où elle entre à portée). */
  private objetsEntre(a: Noeud, b: Noeud): number {
    const k = Math.trunc(this.xs[b]! / (LARGEUR_MORCEAU * CASE));
    const ax = this.xs[a]! + DEMI_JOUEUR;
    const ay = this.ys[a]! + DEMI_JOUEUR;
    const bx = this.xs[b]! + DEMI_JOUEUR;
    const by = this.ys[b]! + DEMI_JOUEUR;
    let v = 0;
    for (let m = Math.max(0, k - 1); m <= k + 1; m++) {
      const morceau = this.terrain.morceau(m);
      for (const o of morceau.pieces) if (Math.abs(o.x - bx) < PIECE_PORTEE && Math.abs(o.y - by) < PIECE_PORTEE && !(Math.abs(o.x - ax) < PIECE_PORTEE && Math.abs(o.y - ay) < PIECE_PORTEE)) v += POINTS_PIECE;
      for (const o of morceau.gemmes) if (Math.abs(o.x - bx) < GEMME_PORTEE && Math.abs(o.y - by) < GEMME_PORTEE && !(Math.abs(o.x - ax) < GEMME_PORTEE && Math.abs(o.y - ay) < GEMME_PORTEE)) v += POINTS_GEMME;
      for (const o of morceau.bonus) if (Math.abs(o.x - bx) < BONUS_PORTEE && Math.abs(o.y - by) < BONUS_PORTEE && !(Math.abs(o.x - ax) < BONUS_PORTEE && Math.abs(o.y - ay) < BONUS_PORTEE)) v += VALEUR_BONUS;
    }
    return v;
  }

  /** Le monde sans appui depuis `n` arrive-t-il à `but` (en unités) vivant ? */
  libre(n: Noeud, but: number): boolean {
    if (this.vivantX[n]! >= but) return true;
    if (this.mortA[n]) return false;
    let c = n;
    for (;;) {
      if (this.xs[c]! >= but || this.tick[c]! >= DUREE_MAX_TICKS) {
        this.vivantX[n] = this.tick[c]! >= DUREE_MAX_TICKS ? Infinity : Math.max(this.vivantX[n]!, this.xs[c]!);
        return true;
      }
      if (c !== n) {
        if (this.vivantX[c]! >= but) {
          this.vivantX[n] = this.vivantX[c]!;
          return true;
        }
        if (this.mortA[c]) {
          this.vivantX[n] = this.vivantX[c]!;
          this.mortA[n] = 1;
          return false;
        }
      }
      const s = this.suivant(c);
      if (s === AUCUN) {
        this.vivantX[n] = this.xs[c]!;
        this.mortA[n] = 1;
        return false;
      }
      c = s;
    }
  }

  /** Les noeuds du monde sans appui depuis `n`, au plus `max`, jusqu'à la mort ou au but : `complet` si la liste s'arrête à la mort ou au but (et non faute de place). */
  chaine(n: Noeud, but: number, max: number): { noeuds: Noeud[]; complet: boolean } {
    const noeuds: Noeud[] = [];
    let c = n;
    while (c !== AUCUN) {
      if (this.xs[c]! >= but || this.tick[c]! >= DUREE_MAX_TICKS) return { noeuds, complet: true };
      if (noeuds.length >= max) return { noeuds, complet: false };
      noeuds.push(c);
      c = this.suivant(c);
    }
    return { noeuds, complet: true };
  }

  /** Pour `Recherche` : la réussite mémorisée d'un appui à ce pas. */
  lireOk(n: Noeud, rech: number): boolean | undefined {
    return this.okRech[n] === rech ? this.okVal[n] === 1 : undefined;
  }
  ecrireOk(n: Noeud, rech: number, ok: boolean): boolean {
    this.okRech[n] = rech;
    this.okVal[n] = ok ? 1 : 0;
    return ok;
  }
}

/** Une plage d'appuis qui passent : les indices `a` à `b` (de la chaîne du monde sans appui), tous réussis. */
interface Plage {
  a: number;
  b: number;
}
/** Un coup possible : ne pas appuyer avant la fin de la vue (`t` null) ou appuyer au pas `t`, avec ce que la meilleure suite ramasse. */
interface Coup {
  t: number | null;
  valeur: number;
}

let prochaineRecherche = 0;

/** Ce que sait la recherche d'un horizon : la mémoire des états jugés. Un `but` (une colonne en unités) et une `marge` de pas. */
class Recherche {
  private readonly id = prochaineRecherche++;
  private readonly memo = new Map<number, boolean>();
  private readonly valeurs = new Map<number, Map<number, number>>();
  constructor(
    readonly g: Graphe,
    readonly but: number,
    readonly marge: number,
  ) {}

  /** La plus petite plage qui donne un appui nominal. */
  get largeur(): number {
    return this.marge * 2 + 1;
  }

  /** L'état `q` est-il jouable jusqu'au but, le prochain appui nominal ne pouvant avoir lieu avant `tMin` ? */
  jouable(q: Noeud, tMin: number): boolean {
    if (this.g.libre(q, this.but)) return true;
    const tq = this.g.tickDe(q);
    const k = q * 256 + Math.min(255, Math.max(0, tMin - tq));
    const connu = this.memo.get(k);
    if (connu !== undefined) return connu;
    const { noeuds } = this.g.chaine(q, this.but, DUREE_MAX_TICKS);
    const r = this.plages(noeuds, 0, noeuds.length, tMin - tq, true).length > 0;
    this.memo.set(k, r);
    return r;
  }

  /** Un appui à ce pas passe-t-il, **jugé pour de bon** ? Il inverse au premier pas qui le permet (sinon il est perdu) ; il passe si l'état d'après est jouable (l'appui suivant `ROBOT_ECART_MIN` pas plus tard au plus tôt). */
  exact(e: Noeud): boolean {
    const connu = this.g.lireOk(e, this.id);
    if (connu !== undefined) return connu;
    const j = this.g.jinv(e);
    const q = j === AUCUN ? AUCUN : this.g.apresInversion(j);
    return this.g.ecrireOk(e, this.id, q !== AUCUN && this.jouable(q, this.g.tickDe(e) + ROBOT_ECART_MIN));
  }

  /** Un appui au pas `chaine[i]` passe-t-il, **d'après les pas échantillonnés** ? Un pas qui n'est pas un multiple de `PAS_ECHANTILLON` passe si les deux échantillons qui l'encadrent passent. */
  echantillon(chaine: readonly Noeud[], i: number): boolean {
    const r = this.g.tickDe(chaine[i]!) % PAS_ECHANTILLON;
    if (r === 0) return this.exact(chaine[i]!);
    const bas = i - r;
    const haut = bas + PAS_ECHANTILLON;
    if (bas < 0 || haut >= chaine.length) return this.exact(chaine[i]!);
    return this.exact(chaine[bas]!) && this.exact(chaine[haut]!);
  }

  /** L'appui nominal au pas `chaine[i]` : ses `2 × marge + 1` pas passent tous, **un par un** (la fenêtre exigée du robot). */
  verifier(chaine: readonly Noeud[], i: number): boolean {
    for (let k = i - this.marge; k <= i + this.marge; k++) if (k < 0 || k >= chaine.length || !this.exact(chaine[k]!)) return false;
    return true;
  }

  /**
   * Les plages d'appuis qui passent, dans les indices `[debut, fin)` de la chaîne : **un sondage tous les `marge` pas** (une plage d'au moins `2 × marge + 1` pas en contient toujours un), puis la plage est étendue des deux
   * côtés. Une plage compte si elle donne un appui nominal (`largeur` pas, centre à `minCentre` ou après). `premiere` : s'arrête à la première qui compte.
   */
  plages(chaine: readonly Noeud[], debut: number, fin: number, minCentre: number, premiere: boolean): Plage[] {
    const sortie: Plage[] = [];
    if (chaine.length === 0) return sortie;
    const pas = Math.max(1, this.marge);
    const compte = (a: number, b: number): boolean => b - a + 1 >= this.largeur && Math.max(a + this.marge, minCentre) <= b - this.marge;
    const tick0 = this.g.tickDe(chaine[0]!);
    for (let i = debut + ((PAS_ECHANTILLON - ((tick0 + debut) % PAS_ECHANTILLON)) % PAS_ECHANTILLON); i < fin; ) {
      if (!this.echantillon(chaine, i)) {
        i += pas;
        continue;
      }
      let a = i;
      while (a > 0 && this.echantillon(chaine, a - 1)) a--;
      let b = i;
      while (b + 1 < chaine.length && (b + 1 < fin || (premiere && !compte(a, b))) && this.echantillon(chaine, b + 1)) {
        b++;
        if (premiere && compte(a, b)) break;
      }
      if (compte(a, b)) {
        sortie.push({ a, b });
        if (premiere) return sortie;
      }
      i = b + 2;
    }
    return sortie;
  }

  /**
   * **Tous les coups permis depuis `q`** (un état juste après une inversion, ou la racine) jusqu'au pas `fin` : ne rien faire avant `fin` (si le monde sans appui y arrive vivant et reste jouable après) ou appuyer à un pas
   * nominal (une plage d'appuis qui passent), chacun avec ce que la meilleure suite ramasse jusqu'à `fin` (`valeur`). L'appui suivant n'a pas lieu avant `tMin`.
   */
  coups(q: Noeud, tMin: number, fin: number): Coup[] {
    const tq = this.g.tickDe(q);
    const n = fin - tq;
    const sortie: Coup[] = [];
    if (n <= 0) return this.jouable(q, tMin) ? [{ t: null, valeur: 0 }] : [];
    const { noeuds } = this.g.chaine(q, this.but, n + TAMPON + 1);
    const cumul = new Array<number>(noeuds.length + 1);
    cumul[0] = 0;
    for (let i = 0; i < noeuds.length; i++) cumul[i + 1] = cumul[i]! + this.g.gainPas(noeuds[i]!);
    const vivantAFin = noeuds.length > n || this.g.libre(q, this.but);
    if (vivantAFin && this.jouable(q, Math.max(tMin, fin))) sortie.push({ t: null, valeur: cumul[Math.min(n, noeuds.length)]! });
    const limite = Math.min(noeuds.length, n);
    for (const { a, b } of this.plages(noeuds, 0, limite, tMin - tq, false)) {
      for (let i = Math.max(a + this.marge, tMin - tq); i <= b - this.marge && i < limite; i++) {
        if ((tq + i) % PAS_COUP !== 0) continue;
        const j = this.g.jinv(noeuds[i]!);
        const q2 = this.g.apresInversion(j);
        const suite = this.valeur(q2, tq + i + ROBOT_ECART_MIN, fin);
        if (suite < 0) continue;
        const jr = this.g.tickDe(j) - tq;
        sortie.push({ t: tq + i, valeur: (cumul[jr] ?? cumul[noeuds.length]!) + this.g.gainInversion(j) + suite });
      }
    }
    return sortie;
  }

  /** La meilleure valeur de `q` jusqu'à `fin` (−1 : aucune suite permise). */
  valeur(q: Noeud, tMin: number, fin: number): number {
    let table = this.valeurs.get(fin);
    if (!table) this.valeurs.set(fin, (table = new Map()));
    const k = q * 256 + Math.min(255, Math.max(0, tMin - this.g.tickDe(q)));
    const connu = table.get(k);
    if (connu !== undefined) return connu;
    let meilleur = -1;
    for (const c of this.coups(q, tMin, fin)) if (c.valeur > meilleur) meilleur = c.valeur;
    table.set(k, meilleur);
    return meilleur;
  }
}

/** Le motif du morceau où est la colonne `x` (en unités) : `special-<thème>` pour la case spéciale d'un thème. */
const motifEn = (terrain: Terrain, x: number): { morceau: number; motif: string } => {
  const morceau = Math.trunc(x / (LARGEUR_MORCEAU * CASE));
  const m = terrain.morceau(morceau);
  return { morceau, motif: m.motif === "special" ? `special-${m.theme}` : m.motif };
};

interface Plan {
  /** Le pas du prochain appui, ou null : aucun appui avant la fin de la vue. */
  t: number | null;
  fenetre: number;
  respecte: boolean;
}

/** Ce que rend le robot : les pas de ses appuis, la partie qu'il a jouée (avec ramassage, comme celle d'un joueur) et le rapport. */
export interface PartieDuRobot {
  appuis: number[];
  partie: Partie;
  rapport: RapportRobot;
}

/** Le robot joue, **d'un trait**. */
export function jouerRobot(terrain: Terrain, options: OptionsRobot = {}): PartieDuRobot {
  const g = jouerRobotEnTranches(terrain, options);
  for (;;) {
    const r = g.next();
    if (r.done) return r.value;
  }
}

/**
 * Le robot joue **en tranches** : un `yield` après chaque plan (quelques millisecondes), pour qu'un navigateur le fasse tourner en arrière-plan sans geler l'écran (`apps/gravity/src/niveau.ts` : les seuils d'un jour qui n'est
 * pas figé). Le résultat est celui de `jouerRobot`, quelles que soient les pauses : la recherche est pure.
 */
export function* jouerRobotEnTranches(terrain: Terrain, options: OptionsRobot = {}): Generator<void, PartieDuRobot, undefined> {
  const maxTicks = options.maxTicks ?? DUREE_MAX_TICKS;
  const strict = options.strict ?? true;
  const p = new Partie(terrain);
  const appuis: number[] = [];
  const rapport: RapportRobot = { appuis: [], piecesPrises: 0, piecesLachees: 0, entorses: [] };
  let dernier = -1000;
  const arrets = [...(options.arrets ?? [])].sort((a, b) => a - b);
  let prochainArret = 0;
  let recherches = new Map<string, Recherche>();
  let graphe = new Graphe(terrain);
  const largeurMorceau = LARGEUR_MORCEAU * CASE;

  const rechercheDe = (but: number, marge: number): Recherche => {
    const c = `${but}|${marge}`;
    let r = recherches.get(c);
    if (!r) {
      if (recherches.size > 8) recherches = new Map();
      r = new Recherche(graphe, but, marge);
      recherches.set(c, r);
    }
    return r;
  };

  /** Le meilleur coup d'après `rech` (ne pas appuyer avant la fin de la vue, ou appuyer à `t`) ; null si aucune suite permise. Un appui n'est pris que si ses `2 × marge + 1` pas passent un par un. */
  const choisir = (rech: Recherche, tMin: number): { t: number | null; fenetre: number } | null => {
    const racine = graphe.interner(p);
    const fin = (Math.trunc(p.tick / PAQUET_VUE) + Math.trunc(ROBOT_VUE_PAS / PAQUET_VUE)) * PAQUET_VUE;
    const coups = rech.coups(racine, tMin, fin);
    if (coups.length === 0) return null;
    const long = graphe.chaine(racine, rech.but, fin - p.tick + TAMPON + MESURE_MAX + 2).noeuds;
    const valeurs = [...new Set(coups.map((c) => c.valeur))].sort((a, b) => b - a);
    for (const v of valeurs) {
      const groupe = coups.filter((c) => c.valeur === v);
      // Ne rien faire l'emporte à égalité ; sinon le milieu des appuis éprouvés.
      if (groupe.some((c) => c.t === null)) return { t: null, fenetre: 0 };
      const bons = groupe.filter((c) => rech.verifier(long, c.t! - p.tick));
      if (bons.length === 0) continue;
      const i0 = bons[Math.trunc((bons.length - 1) / 2)]!.t! - p.tick;
      // La fenêtre mesurée de l'appui choisi : les pas consécutifs autour de lui qui réussissent aussi.
      let a = i0;
      while (a - 1 >= 0 && i0 - (a - 1) <= MESURE_MAX && rech.exact(long[a - 1]!)) a--;
      let b = i0;
      while (b + 1 < long.length && b + 1 - i0 <= MESURE_MAX && rech.exact(long[b + 1]!)) b++;
      return { t: p.tick + i0, fenetre: b - a + 1 };
    }
    return null;
  };

  const planifier = (): Plan => {
    const k = Math.trunc(p.x / largeurMorceau);
    const tMin = dernier + ROBOT_ECART_MIN;
    for (let horizon = ROBOT_HORIZON; horizon >= 0; horizon--) {
      const but = (k + horizon + 1) * largeurMorceau;
      for (let marge = ROBOT_MARGE; marge >= 0; marge--) {
        const plan = choisir(rechercheDe(but, marge), tMin);
        if (plan) return { ...plan, respecte: marge === ROBOT_MARGE && horizon === ROBOT_HORIZON };
        if (strict) return { t: null, fenetre: 0, respecte: false };
      }
    }
    return { t: null, fenetre: 0, respecte: false };
  };

  let plan: Plan | null = null;
  let planK = -1;
  let replanA = 0;
  while (!p.finie && p.tick < maxTicks && (options.maxDistance === undefined || p.distance < options.maxDistance)) {
    const k = Math.trunc(p.x / largeurMorceau);
    // On planifie au début, après chaque appui, et — si aucun appui n'est prévu — tous les `PAQUET_VUE` pas et à chaque nouveau morceau (le but recule).
    if (plan === null || (plan.t === null && (k !== planK || p.tick >= replanA))) {
      if (graphe.taille > LIMITE_GRAPHE) {
        graphe = new Graphe(terrain);
        recherches = new Map();
      }
      plan = planifier();
      planK = k;
      replanA = p.tick + PAQUET_VUE;
      yield;
      if (!plan.respecte) {
        const { morceau, motif } = motifEn(terrain, p.x);
        if (rapport.entorses.at(-1)?.morceau !== morceau) rapport.entorses.push({ morceau, motif, tick: p.tick });
      }
    }
    if (plan.t === p.tick) {
      const { morceau, motif } = motifEn(terrain, p.x);
      p.appuyer();
      appuis.push(p.tick);
      dernier = p.tick;
      rapport.appuis.push({ tick: p.tick, morceau, motif, fenetre: plan.fenetre, respecte: plan.respecte });
      plan = null;
    }
    p.avancer();
    while (prochainArret < arrets.length && p.distance >= arrets[prochainArret]!) options.surPoint?.(arrets[prochainArret++]!, p);
  }
  rapport.piecesPrises = p.pieces;
  rapport.piecesLachees = p.charges.reduce((n, c) => n + c.pieces.filter((x) => x.etat === 2).length, 0);
  return { appuis, partie: p, rapport };
}

/** Le résultat de la partie du robot, comme le serveur le rejouerait. */
export const resultatDuRobot = (p: Partie): Resultat => p.resultat();


