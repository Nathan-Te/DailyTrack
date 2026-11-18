import * as Cam from "./camera";
const { avancerCamera, vitesseCamera } = Cam;
// Les constantes de la boucle de pas sont posées dans des locales : sous Vitest (module runner) chaque import se lit par un accesseur, 3 fois plus lent dans une boucle de millions de pas (le robot).
import * as K from "./constantes";
import { REGLES_COURANTES, type Regles } from "./regles";
const {
  AIMANT_PART,
  AIMANT_RAYON,
  AIMANT_TICKS,
  AVION_GRAVITE,
  AVION_POUSSEE,
  AVION_VY_MAX,
  BONUS_PORTEE,
  BORD_MARGE,
  BORD_RETOUR,
  CASE,
  CIBLE_CAMERA,
  DEPART_X,
  DEPART_Y,
  DUREE_MAX_TICKS,
  AVANCE_MAX,
  FACTEUR_NORMAL,
  FRAGILE_DELAI,
  GEMME_PORTEE,
  GRACE,
  INVULNERABILITE,
  LARGEUR_MORCEAU,
  LASER_X0,
  LASER_X1,
  LIGNES,
  MODE_AVION,
  MODE_GRAVITE,
  MODE_ONDE,
  MODE_RESSORT,
  MULT_MAX,
  PIECE_MANQUEE,
  PIECE_PORTEE,
  PIECES_PAR_PALIER,
  PIQUE_X0,
  PIQUE_X1,
  PIQUE_Y0,
  PIQUE_Y1,
  POINTS_GEMME,
  POINTS_PIECE,
  RATTRAPAGE,
  RESSORT_ATTENTE,
  RESSORT_BOND,
  RESSORT_GRAVITE,
  SAUVETAGE_VY,
  SCIE_RAYON,
  SAUVETAGE_Y_BAS,
  SAUVETAGE_Y_HAUT,
  TAILLE,
  TAMPON,
  TAPIS_DEN,
  TAPIS_NUM,
  TICKS_PAR_SECONDE,
  VENT_POUSSEE,
  VENT_VY_MIN,
  VIDE_BAS,
  VIDE_HAUT,
  VY_MAX,
} = K;
import * as M from "./monde";
import type { Terrain } from "./monde";
const { FACTEUR_DU_PORTAIL, FRAGILE, GLACE, INVERSEUR, MODE_DU_PORTAIL, PIQUE, TAPIS, VENT, etatLaser, positionScie, solide } = M;
import type { ModeDeVol } from "./constantes";
import type { TypePortail } from "./monde";

// La partie de Gravity : **entière, un pas = 1/120 s**. Le joueur court vers la droite à la vitesse de la caméra ; **la seule entrée est l'état du bouton** (lot GR6 : `appuyer` / `relacher`, un changement par pas). En
// mode gravité, le DÉBUT d'un appui inverse la gravité s'il y a une surface sous les pieds (ou si on vient de la quitter : temps de grâce), jamais sur la glace ; un appui juste avant un contact est gardé (tampon).
// **Les modes de vol (lot GR6)** : l'avion (maintenu on monte, relâché on descend, avec de l'inertie), l'onde (45°, le signe suit le bouton) et le ressort (chaque début d'appui est un bond, même en l'air) ; on y entre et
// on en sort par des **portails** du niveau (`Morceau.portails`), qui changent aussi la vitesse (portails de vitesse). Les règles ne changent pas : le rouge tue, le vide aussi, le bord gauche aussi ; le bouclier sauve
// (et un sauvetage du vide remet en mode gravité). Tout est en unités du monde (1 case = 4 096) et en unités par seconde, **aucun flottant** :
// la physique est celle de la fonction `pas()` de la maquette, à ses constantes (`constantes.ts`), avec les deux défauts de la maquette corrigés (voir `pas`, `placerLibre`).
//
// À chaque pas : (1) la caméra avance ; (2) un appui gardé, si l'on touche une surface, inverse la gravité ; (3) la course (la caméra + 4,2 cases est visée, rattrapage si on a du retard, tapis × 1,35, un mur arrête) ;
// (4) la chute (gravité, vent, collision par axe) ; (5) le ramassage (aimant, pièces, gemmes, bonus) ; (6) les morts (le vide, le bord gauche). Le pique est testé à chaque collision. **Le bouclier sauve une fois**
// puis laisse 0,8 s d'invulnérabilité.

export const MORT_VIDE = 1;
export const MORT_PIQUE = 2;
export const MORT_BORD = 3;
export const MORT_TEMPS = 4;
/** Lot GR7 : la scie et le laser tuent, comme le pique (rouge = danger) : le bouclier les sauve de la même façon. Un sol fragile qui tombe n'a pas de cause à lui : on meurt du vide. */
export const MORT_SCIE = 5;
export const MORT_LASER = 6;
export type CauseDeMort = 1 | 2 | 3 | 4 | 5 | 6;

/** Ce qui vient de se passer pendant le dernier pas (des drapeaux, pour le rendu et les sons : ils n'entrent jamais dans la suite de la partie). */
export const EV_INVERSION = 1;
export const EV_ATTERRISSAGE = 2;
export const EV_PIECE = 4;
export const EV_GEMME = 8;
export const EV_BONUS = 16;
export const EV_BOUCLIER = 32;
export const EV_INVERSEUR = 64;
export const EV_MORT = 128;
export const EV_MANQUEE = 256;
/** Lot GR6 : un portail franchi à ce pas (`portail` dit lequel) ; un bond du ressort ; un changement de sens de l'onde. */
export const EV_PORTAIL = 512;
export const EV_BOND = 1024;
export const EV_VIRAGE = 2048;
/** Lot GR7 : un sol fragile vient de craquer (on s'y est posé) ; un tronçon fragile vient de tomber. */
export const EV_CRAQUE = 4096;
export const EV_EFFONDREMENT = 8192;

/** Lot GR7 — un tronçon de sol fragile (une suite de cases fragiles de la même rangée `cy`, des colonnes `cx0` à `cx1` incluses) touché au pas `t0` : il tombe au pas `t0 + FRAGILE_DELAI` et ne revient jamais. **Jamais modifié** : une liste de ces tronçons est remplacée par une nouvelle quand on en ajoute un (les copies de la partie la partagent). */
export interface Fragile {
  cx0: number;
  cx1: number;
  cy: number;
  t0: number;
}

/** Une pièce en cours de partie : sa position (l'aimant la déplace), son état (0 libre, 1 prise, 2 manquée). */
export interface PieceEtat {
  x: number;
  y: number;
  etat: 0 | 1 | 2;
}
/** L'état des objets d'un morceau : ses pièces, ses gemmes et ses bonus (pris ou non). */
export interface ChargeMorceau {
  pieces: PieceEtat[];
  gemmes: boolean[];
  bonus: boolean[];
}

export interface Resultat {
  /** Le score : la distance plus les points des pièces et des gemmes. */
  score: number;
  /** La distance en mètres depuis le départ. */
  distance: number;
  pieces: number;
  gemmes: number;
  /** Le plus haut multiplicateur atteint. */
  multMax: number;
  /** Les pas joués (la partie finit au plus à `DUREE_MAX_TICKS`). */
  ticks: number;
  /** Pourquoi elle a fini : `MORT_*`. */
  cause: CauseDeMort;
  /** Les appuis donnés. */
  appuis: number;
  /** Les inversions de gravité faites. */
  inversions: number;
  /** Lot GR6 : les changements du bouton (appuis et relâchés : la rediffusion) et **le mode de vol le plus loin atteint** (le dernier mode non gravité dont on a franchi le portail ; 0 : aucun). */
  changements: number;
  modeLoin: ModeDeVol;
}

const idiv = (a: number, b: number): number => Math.trunc(a / b);
// 1 case = 4 096 = 2^12 : un décalage arithmétique est la division par une case, arrondie vers le bas (justement pour les positions négatives).
const CASE_BITS = 12;
const enCases = (u: number): number => u >> CASE_BITS;
const DEMI_JOUEUR = TAILLE >> 1;
const CASES_PAR_MORCEAU = LARGEUR_MORCEAU * CASE;

export class Partie {
  tick = 0;
  /** La caméra (le bord gauche de l'écran) et le joueur (le coin haut-gauche de sa boîte), en unités. */
  cam = 0;
  x = DEPART_X;
  y = DEPART_Y;
  vy = 0;
  /** +1 : la gravité tire vers le bas ; −1 : vers le haut. */
  g: 1 | -1 = 1;
  /** Lot GR6 — le mode de vol (`MODE_*`), le facteur de vitesse du dernier portail de vitesse (pour cent), l'état du bouton, et les pas depuis lesquels il a changé / depuis le dernier début d'appui (ticks absolus). */
  mode: ModeDeVol = MODE_GRAVITE;
  facteur = FACTEUR_NORMAL;
  bouton = false;
  dernierChg = -1000;
  dernierAppui = -1000;
  /** Ressort : les pas avant que le bond suivant soit permis (`RESSORT_ATTENTE` après un bond). */
  bondAttente = 0;
  /** Le mode non gravité le plus loin atteint, et le dernier portail franchi (pour le rendu : valable le pas où `EV_PORTAIL` est levé). */
  modeLoin: ModeDeVol = MODE_GRAVITE;
  portail: TypePortail | null = null;
  /** Lot GR7 : les tronçons de sol fragile touchés (ceux d'avant l'écran sont retirés). Immuable : voir `Fragile`. */
  fragiles: readonly Fragile[] = [];
  /** **La rediffusion** : les pas où le bouton a changé (le premier est un appui, ils alternent). */
  changements: number[] = [];
  /** Les états voulus du bouton, à appliquer un par pas (un appui et un relâché dans le même pas se suivent : jamais deux changements au même pas). */
  private file: boolean[] = [];
  /** Posé sur une surface (dans le sens de la gravité) au dernier pas, et laquelle (le type de la case). */
  sol = false;
  surface = 0;
  /** Les pas restants du temps de grâce (on vient de quitter un bord) et du tampon (un appui attend un contact). */
  grace = 0;
  tampon = 0;
  /** Les pas restants d'invulnérabilité (après un bouclier) et d'aimant. */
  invuln = 0;
  aimant = 0;
  bouclier = false;
  pieces = 0;
  gemmes = 0;
  points = 0;
  chaine = 0;
  mult = 1;
  multMax = 1;
  appuis = 0;
  inversions = 0;
  /** 0 tant que la partie dure ; sinon `MORT_*`. */
  mort: 0 | CauseDeMort = 0;
  /** Les événements du dernier pas (`EV_*`). */
  ev = 0;
  /** Les positions avant le dernier pas : le rendu interpole entre elles et les actuelles. */
  precX = DEPART_X;
  precY = DEPART_Y;
  precCam = 0;
  /** Vrai si un essai (`sauterAuThemeSuivant`) a déplacé le joueur : la partie n'est plus rejouable, elle n'est jamais classée. */
  essai = false;
  /** Les objets, morceau par morceau (chargés à la demande, dans l'ordre : `charge(k)`). */
  charges: ChargeMorceau[] = [];
  /**
   * Vrai : on ramasse (pièces, gemmes, bonus, aimant). Faux (lot GR2) : une **copie de planification** (`copier(true)`), qui ne ramasse rien — ni pièce, ni bouclier : la physique est exactement la même (le ramassage ne
   * change jamais le mouvement), mais le bouclier n'existe pas, donc un danger tue : c'est ce que veut le robot (passer sans bouclier), à un coût moindre (pas de boucle sur les objets).
   */
  ramasse = true;

  // Le résultat de la dernière collision (`heurte`), sans allocation.
  private hCx = 0;
  private hCy = 0;
  private hType = 0;

  /** Les règles sous lesquelles la partie se joue : celles du terrain (la version de la simulation du jour, lot GR5), sinon la version courante. */
  readonly regles: Regles;
  constructor(readonly terrain: Terrain) {
    this.regles = terrain.regles ?? REGLES_COURANTES;
  }

  get finie(): boolean {
    return this.mort !== 0;
  }
  /** La distance en mètres depuis le départ (le joueur ne recule jamais). */
  get distance(): number {
    return enCases(this.x - DEPART_X);
  }
  get score(): number {
    return this.distance + this.points;
  }
  /** Le numéro du thème en cours (0 à 4 dans l'ordre du jour, puis la boucle). */
  get rangDuTheme(): number {
    return idiv(idiv(this.x, CASES_PAR_MORCEAU), this.regles.morceauxParTheme);
  }
  /** L'appui est-il pris en compte maintenant (une surface sous les pieds ou quittée à l'instant, et pas de glace) ? */
  get peutInverser(): boolean {
    return this.mode === MODE_GRAVITE && (this.sol || this.grace > 0) && this.surface !== GLACE;
  }
  /** Ressort : un appui donné maintenant donne-t-il un bond tout de suite (au moins `RESSORT_ATTENTE` pas depuis le dernier) ? */
  get peutBondir(): boolean {
    return this.mode === MODE_RESSORT && this.bondAttente <= 1;
  }

  /** L'état des objets du morceau `k` (les morceaux avant lui sont chargés aussi). */
  charge(k: number): ChargeMorceau {
    while (this.charges.length <= k) {
      const m = this.terrain.morceau(this.charges.length);
      this.charges.push({ pieces: m.pieces.map((p) => ({ x: p.x, y: p.y, etat: 0 as const })), gemmes: m.gemmes.map(() => false), bonus: m.bonus.map(() => false) });
    }
    return this.charges[k]!;
  }

  /** Le joueur pose le doigt à ce pas (avant `avancer`) : en mode gravité ou ressort l'appui est gardé 14 pas (0,12 s). Un appui déjà voulu ne se répète pas. */
  appuyer(): void {
    if (this.mort !== 0) return;
    if ((this.file.length > 0 ? this.file[this.file.length - 1]! : this.bouton) === true) return;
    this.file.push(true);
  }
  /** Le joueur lève le doigt à ce pas (avant `avancer`). Un relâché déjà voulu ne se répète pas. */
  relacher(): void {
    if (this.mort !== 0) return;
    if ((this.file.length > 0 ? this.file[this.file.length - 1]! : this.bouton) === false) return;
    this.file.push(false);
  }
  /** Applique un changement du bouton au pas courant (un seul par pas) : c'est ce pas qui entre dans la rediffusion. */
  private changer(etat: boolean): void {
    this.bouton = etat;
    this.changements.push(this.tick);
    this.dernierChg = this.tick;
    if (etat) {
      this.appuis++;
      this.dernierAppui = this.tick;
      if (this.mode === MODE_GRAVITE || this.mode === MODE_RESSORT) this.tampon = TAMPON;
    }
  }

  /**
   * Une copie indépendante de l'état (pour essayer un coup à l'avance : le robot, les tests). Le terrain est partagé (il est immuable).
   * `planification` (lot GR2) : une copie qui ne ramasse rien (`ramasse` faux, `charges` vide) — la même physique, sans le coût des objets.
   * Sinon, **seuls les morceaux que le ramassage peut encore toucher sont recopiés** (ceux d'avant le joueur ne changent plus : la caméra ne recule jamais, la copie les partage) : le coût d'une copie ne grandit pas avec la partie.
   */
  copier(planification = false): Partie {
    const c = new Partie(this.terrain);
    // Champ par champ (plus rapide qu'`Object.assign`, qui dominait le coût du robot) : `test/robot.test.ts` vérifie qu'aucun champ n'est oublié.
    c.tick = this.tick;
    c.cam = this.cam;
    c.x = this.x;
    c.y = this.y;
    c.vy = this.vy;
    c.g = this.g;
    c.sol = this.sol;
    c.surface = this.surface;
    c.grace = this.grace;
    c.tampon = this.tampon;
    c.invuln = this.invuln;
    c.aimant = this.aimant;
    c.bouclier = this.bouclier;
    c.pieces = this.pieces;
    c.gemmes = this.gemmes;
    c.points = this.points;
    c.chaine = this.chaine;
    c.mult = this.mult;
    c.multMax = this.multMax;
    c.appuis = this.appuis;
    c.inversions = this.inversions;
    c.mort = this.mort;
    c.ev = this.ev;
    c.precX = this.precX;
    c.precY = this.precY;
    c.precCam = this.precCam;
    c.essai = this.essai;
    c.mode = this.mode;
    c.facteur = this.facteur;
    c.bouton = this.bouton;
    c.dernierChg = this.dernierChg;
    c.dernierAppui = this.dernierAppui;
    c.bondAttente = this.bondAttente;
    c.modeLoin = this.modeLoin;
    c.portail = this.portail;
    c.fragiles = this.fragiles;
    c.file = [...this.file];
    if (planification) {
      // Une copie de planification n'a ni bouclier, ni invulnérabilité, ni aimant (même si la partie copiée en a) : un danger la tue.
      c.ramasse = false;
      c.bouclier = false;
      c.invuln = 0;
      c.aimant = 0;
      return c;
    }
    c.ramasse = this.ramasse;
    c.changements = [...this.changements];
    const figes = Math.max(0, Math.min(this.charges.length, idiv(this.cam - 8 * CASE, CASES_PAR_MORCEAU)));
    c.charges = this.charges.map((ch, k) => (k < figes ? ch : { pieces: ch.pieces.map((p) => ({ ...p })), gemmes: [...ch.gemmes], bonus: [...ch.bonus] }));
    return c;
  }

  /** Un pas de la partie. */
  avancer(): void {
    if (this.mort !== 0) return;
    this.ev = 0;
    this.precX = this.x;
    this.precY = this.y;
    this.precCam = this.cam;
    if (this.file.length > 0) this.changer(this.file.shift()!);
    this.pas();
    this.tick++;
    if (this.tampon > 0) this.tampon--;
    if (this.grace > 0) this.grace--;
    if (this.mort === 0 && this.tick >= DUREE_MAX_TICKS) this.mort = MORT_TEMPS;
  }

  resultat(): Resultat {
    return { score: this.score, distance: this.distance, pieces: this.pieces, gemmes: this.gemmes, multMax: this.multMax, ticks: this.tick, cause: (this.mort || MORT_TEMPS) as CauseDeMort, appuis: this.appuis, inversions: this.inversions, changements: this.changements.length, modeLoin: this.modeLoin };
  }

  /** Les cases qui touchent la boîte en `(px, py)` : 0 rien, 1 une case solide (sa place dans `hCx` / `hCy`), 2 un pique (sa boîte réduite est touchée). Le pique l'emporte sur le reste (comme dans la maquette). */
  private heurte(px: number, py: number): number {
    const x0 = enCases(px);
    const x1 = enCases(px + TAILLE - 1);
    const y0 = enCases(py);
    const y1 = enCases(py + TAILLE - 1);
    let res = 0;
    for (let cx = x0; cx <= x1; cx++) {
      if (cx < 0) continue;
      const k = idiv(cx, LARGEUR_MORCEAU);
      const morceau = this.terrain.morceau(k);
      const base = (cx - k * LARGEUR_MORCEAU) * LIGNES;
      for (let cy = y0; cy <= y1; cy++) {
        if (cy < 0 || cy >= LIGNES) continue;
        const type = morceau.cases[base + cy]!;
        if (type === PIQUE) {
          const gx = cx * CASE;
          const gy = cy * CASE;
          if (px + TAILLE > gx + PIQUE_X0 && px < gx + PIQUE_X1 && py + TAILLE > gy + PIQUE_Y0 && py < gy + PIQUE_Y1) return 2;
        } else if (res === 0 && (type === FRAGILE ? this.fragileSolide(cx, cy) : solide(type, this.tick, morceau.decalage))) {
          res = 1;
          this.hCx = cx;
          this.hCy = cy;
          this.hType = type;
        }
      }
    }
    return res;
  }

  /** Un sol fragile est solide tant que son tronçon n'est pas tombé (et sans contact il ne tombe pas). */
  private fragileSolide(cx: number, cy: number): boolean {
    const f = this.fragiles;
    for (let i = 0; i < f.length; i++) {
      const q = f[i]!;
      if (q.cy === cy && cx >= q.cx0 && cx <= q.cx1) return this.tick < q.t0 + FRAGILE_DELAI;
    }
    return true;
  }

  /** On s'est posé sur le sol fragile `(cx, cy)` : son tronçon (toute la suite de cases fragiles de la rangée) craque, et tombera `FRAGILE_DELAI` pas plus tard. Un tronçon déjà touché ne change pas. */
  private craquer(cx: number, cy: number): void {
    const f = this.fragiles;
    for (let i = 0; i < f.length; i++) {
      const q = f[i]!;
      if (q.cy === cy && cx >= q.cx0 && cx <= q.cx1) return;
    }
    let a = cx;
    let b = cx;
    while (cx - a < 32 && this.typeEn(a - 1, cy) === FRAGILE) a--;
    while (b - cx < 32 && this.typeEn(b + 1, cy) === FRAGILE) b++;
    const gardes = f.filter((q) => (q.cx1 + 3) * CASE > this.cam);
    this.fragiles = [...gardes, { cx0: a, cx1: b, cy, t0: this.tick }];
    this.ev |= EV_CRAQUE;
  }

  /** Les dangers qui bougent ou qui s'allument (lot GR7) : la scie ou le laser que la boîte du joueur touche à ce pas (`MORT_*`), sinon 0. Seuls les morceaux sous la boîte sont regardés. */
  private dangerMobile(): number {
    const k0 = idiv(this.x, CASES_PAR_MORCEAU);
    const k1 = idiv(this.x + TAILLE - 1, CASES_PAR_MORCEAU);
    const px = this.x;
    const py = this.y;
    for (let k = k0; k <= k1; k++) {
      const m = this.terrain.morceau(k);
      for (let i = 0; i < m.scies.length; i++) {
        const [sx, sy] = positionScie(m.scies[i]!, this.tick);
        const dx = sx < px ? px - sx : sx > px + TAILLE ? sx - px - TAILLE : 0;
        const dy = sy < py ? py - sy : sy > py + TAILLE ? sy - py - TAILLE : 0;
        if (dx * dx + dy * dy < SCIE_RAYON * SCIE_RAYON) return MORT_SCIE;
      }
      for (let i = 0; i < m.lasers.length; i++) {
        const l = m.lasers[i]!;
        if (etatLaser(this.tick, l.decalage) !== 2) continue;
        const gx = k * CASES_PAR_MORCEAU + l.c * CASE;
        if (px + TAILLE > gx + LASER_X0 && px < gx + LASER_X1 && py + TAILLE > l.r0 * CASE && py < (l.r1 + 1) * CASE) return MORT_LASER;
      }
    }
    return 0;
  }

  private typeEn(cx: number, cy: number): number {
    if (cx < 0 || cy < 0 || cy >= LIGNES) return 0;
    const k = idiv(cx, LARGEUR_MORCEAU);
    return this.terrain.morceau(k).cases[(cx - k * LARGEUR_MORCEAU) * LIGNES + cy]!;
  }

  private pas(): void {
    // La caméra : sa vitesse monte avec la distance.
    const vitesse = vitesseCamera(this.cam, this.regles, this.facteur);
    this.cam = avancerCamera(this.cam, this.regles, this.facteur);
    this.portail = null;
    for (let i = 0; i < this.fragiles.length; i++) if (this.fragiles[i]!.t0 + FRAGILE_DELAI === this.tick) this.ev |= EV_EFFONDREMENT;

    // L'inversion : seulement au contact d'une surface (le tampon garde l'appui, la grâce le laisse passer après un bord), jamais sur la glace.
    // **Défaut de la maquette (a)** : elle donnait `vy = −g × 2` (un élan vers la surface qu'on quitte) que le sol annulait aussitôt. L'élan est donc nul ici : même jeu, sans un pas perdu.
    if (this.mode === MODE_GRAVITE) {
      if (this.tampon > 0 && this.peutInverser) {
        this.g = (this.g === 1 ? -1 : 1) as 1 | -1;
        this.sol = false;
        this.grace = 0;
        this.tampon = 0;
        this.vy = 0;
        this.inversions++;
        this.ev |= EV_INVERSION;
      }
    } else if (this.mode === MODE_RESSORT) {
      // Le ressort : chaque début d'appui est un bond, même en l'air ; au moins `RESSORT_ATTENTE` pas entre deux bonds (un appui pendant l'attente est gardé par le tampon).
      if (this.bondAttente > 0) this.bondAttente--;
      if (this.tampon > 0 && this.bondAttente === 0) {
        this.vy = -this.g * RESSORT_BOND;
        this.bondAttente = RESSORT_ATTENTE;
        this.tampon = 0;
        this.sol = false;
        this.ev |= EV_BOND;
      }
    }

    // L'horizontal : la course, rattrapage si on a du retard, un mur arrête.
    const cible = this.cam + CIBLE_CAMERA;
    let vx = this.surface === TAPIS && this.sol && this.mode === MODE_GRAVITE ? idiv(vitesse * TAPIS_NUM, TAPIS_DEN) : vitesse;
    if (this.x < cible) vx += RATTRAPAGE;
    if (this.x > cible + AVANCE_MAX) vx = idiv(vitesse * 9, 10);
    let nx = this.x + idiv(vx, TICKS_PAR_SECONDE);
    let h = this.heurte(nx, this.y);
    if (h === 2) {
      if (this.danger(MORT_PIQUE)) return;
      h = 0;
    }
    if (h === 1) nx = this.hCx * CASE - TAILLE - 1;
    const xAvant = this.x;
    if (nx > this.x) this.x = nx;
    if (this.x > xAvant) this.franchir(xAvant + DEMI_JOUEUR, this.x + DEMI_JOUEUR);

    // Le vertical : la gravité (ou le vent, qui porte vers le haut et allège la gravité), puis la collision.
    if (this.mode === MODE_GRAVITE) {
      const dansVent = this.typeEn(enCases(this.x + DEMI_JOUEUR), enCases(this.y + DEMI_JOUEUR)) === VENT;
      this.vy += (dansVent ? -VENT_POUSSEE : 0) + this.g * (dansVent ? this.regles.ventGravite : this.regles.gravite);
      if (dansVent && this.vy < VENT_VY_MIN) this.vy = VENT_VY_MIN;
    } else if (this.mode === MODE_AVION) {
      // L'avion : maintenu, la poussée l'emporte sur la gravité de l'avion (on monte) ; relâché, on descend. De l'inertie : |vy| ≤ `AVION_VY_MAX`.
      this.vy += this.g * (this.bouton ? -AVION_POUSSEE : AVION_GRAVITE);
      if (this.vy > AVION_VY_MAX) this.vy = AVION_VY_MAX;
      else if (this.vy < -AVION_VY_MAX) this.vy = -AVION_VY_MAX;
    } else if (this.mode === MODE_ONDE) {
      // L'onde : à 45°, la vitesse verticale est celle de la course ; maintenu on monte (contre la gravité), relâché on descend.
      const v = vx < VY_MAX ? vx : VY_MAX;
      const nv = this.bouton ? -this.g * v : this.g * v;
      if ((this.vy > 0 && nv < 0) || (this.vy < 0 && nv > 0)) this.ev |= EV_VIRAGE;
      this.vy = nv;
    } else {
      this.vy += this.g * RESSORT_GRAVITE;
    }
    if (this.vy > VY_MAX) this.vy = VY_MAX;
    else if (this.vy < -VY_MAX) this.vy = -VY_MAX;
    const etaitAuSol = this.sol;
    let ny = this.y + idiv(this.vy, TICKS_PAR_SECONDE);
    h = this.heurte(this.x, ny);
    this.sol = false;
    if (h === 2) {
      if (this.danger(MORT_PIQUE)) return;
      h = 0;
    }
    if (h === 1) {
      if (this.vy > 0) ny = this.hCy * CASE - TAILLE - 1;
      else ny = (this.hCy + 1) * CASE + 1;
      // On touche la surface seulement si on allait dans le sens de la gravité (sinon, c'est la tête qui cogne). Avion et onde : le sol et le plafond se touchent sans mourir, on glisse (jamais « posé »).
      if (this.mode !== MODE_AVION && this.mode !== MODE_ONDE && ((this.vy > 0 && this.g === 1) || (this.vy < 0 && this.g === -1))) {
        if (!etaitAuSol && Math.abs(this.vy) > 6 * CASE) this.ev |= EV_ATTERRISSAGE;
        this.sol = true;
        this.surface = this.hType;
        // Lot GR7 : on se pose sur un sol fragile (n'importe laquelle des cases sous la boîte) : le tronçon craque.
        for (let cx = enCases(this.x), fin = enCases(this.x + TAILLE - 1); cx <= fin; cx++) if (this.typeEn(cx, this.hCy) === FRAGILE) this.craquer(cx, this.hCy);
        if (this.hType === INVERSEUR && this.mode === MODE_GRAVITE) {
          this.g = (this.g === 1 ? -1 : 1) as 1 | -1;
          this.sol = false;
          this.ev |= EV_INVERSEUR;
        }
      }
      this.vy = 0;
    }
    if (etaitAuSol && !this.sol && this.mode === MODE_GRAVITE) this.grace = GRACE + 1; // + 1 : le pas qui finit la décrémente aussitôt (8 pas de grâce pleins)
    this.y = ny;

    // Le ramassage : l'aimant attire les pièces proches (leur position fait partie de l'état), puis pièces, gemmes, bonus.
    const cxj = this.x + DEMI_JOUEUR;
    const cyj = this.y + DEMI_JOUEUR;
    if (this.aimant > 0) this.aimant--;
    if (this.invuln > 0) this.invuln--;
    const k0 = Math.max(0, idiv(this.cam - 8 * CASE, CASES_PAR_MORCEAU));
    const k1 = idiv(this.cam + 30 * CASE, CASES_PAR_MORCEAU);
    for (let k = k0; this.ramasse && k <= k1; k++) {
      const charge = this.charge(k);
      const morceau = this.terrain.morceau(k);
      for (const p of charge.pieces) {
        if (p.etat !== 0 || p.x > this.cam + 30 * CASE) continue;
        if (this.aimant > 0) {
          const dx = p.x - cxj;
          const dy = p.y - cyj;
          if (dx * dx + dy * dy < AIMANT_RAYON * AIMANT_RAYON) {
            p.x += idiv(cxj - p.x, AIMANT_PART);
            p.y += idiv(cyj - p.y, AIMANT_PART);
          }
        }
        if (Math.abs(p.x - cxj) < PIECE_PORTEE && Math.abs(p.y - cyj) < PIECE_PORTEE) {
          p.etat = 1;
          this.pieces++;
          this.chaine++;
          this.mult = Math.min(MULT_MAX, 1 + idiv(this.chaine, PIECES_PAR_PALIER));
          if (this.mult > this.multMax) this.multMax = this.mult;
          this.points += POINTS_PIECE * this.mult;
          this.ev |= EV_PIECE;
        } else if (p.x < this.cam - PIECE_MANQUEE) {
          // Une pièce sortie de l'écran sans avoir été prise : le multiplicateur retombe.
          p.etat = 2;
          this.chaine = 0;
          this.mult = 1;
          this.ev |= EV_MANQUEE;
        }
      }
      morceau.gemmes.forEach((o, i) => {
        if (!charge.gemmes[i] && Math.abs(o.x - cxj) < GEMME_PORTEE && Math.abs(o.y - cyj) < GEMME_PORTEE) {
          charge.gemmes[i] = true;
          this.gemmes++;
          this.points += POINTS_GEMME * this.mult;
          this.ev |= EV_GEMME;
        }
      });
      morceau.bonus.forEach((o, i) => {
        if (!charge.bonus[i] && Math.abs(o.x - cxj) < BONUS_PORTEE && Math.abs(o.y - cyj) < BONUS_PORTEE) {
          charge.bonus[i] = true;
          if (o.type === "bouclier") this.bouclier = true;
          else this.aimant = AIMANT_TICKS;
          this.ev |= EV_BONUS;
        }
      });
    }

    // Lot GR7 : les scies et les lasers (rouge = danger : le bouclier les sauve comme un pique).
    const cause = this.dangerMobile();
    if (cause !== 0 && this.danger(cause as CauseDeMort)) return;

    // Les morts : le vide, en haut ou en bas ; le bord gauche de l'écran (le bouclier en sauve une).
    if (this.y < VIDE_HAUT || this.y > VIDE_BAS) {
      if (this.danger(MORT_VIDE)) return;
    }
    if (this.x < this.cam - BORD_MARGE) {
      if (this.danger(MORT_BORD)) return;
    }
  }

  /**
   * Les portails franchis entre deux pas (le centre du joueur passe de `de` à `a`, en unités) : un portail est franchi quand le centre du joueur dépasse le milieu de sa colonne. Un portail de mode change le mode (la gravité
   * garde son sens en entrant ; le portail de retour la remet vers le sol), un portail de vitesse change le facteur de la caméra jusqu'au suivant. Le tampon et la grâce ne survivent pas à un changement de mode.
   */
  private franchir(de: number, a: number): void {
    const k0 = idiv(de, CASES_PAR_MORCEAU);
    const k1 = idiv(a, CASES_PAR_MORCEAU);
    for (let k = k0; k <= k1; k++) {
      const portails = this.terrain.morceau(k).portails;
      for (let i = 0; i < portails.length; i++) {
        const p = portails[i]!;
        const px = k * CASES_PAR_MORCEAU + p.c * CASE + (CASE >> 1);
        if (px <= de || px > a) continue;
        const facteur = FACTEUR_DU_PORTAIL[p.type];
        if (facteur !== undefined) this.facteur = facteur;
        else this.entrerMode(MODE_DU_PORTAIL[p.type] as ModeDeVol);
        this.portail = p.type;
        this.ev |= EV_PORTAIL;
      }
    }
  }

  private entrerMode(mode: ModeDeVol): void {
    this.mode = mode;
    if (mode !== MODE_GRAVITE) this.modeLoin = mode;
    this.sol = false;
    this.grace = 0;
    this.tampon = 0;
    this.bondAttente = 0;
    // **Entrer dans un mode comme en sortir remet « à l'endroit »** (`g = 1`) : un avion vole toujours vers le haut, jamais la tête en bas, quel que soit le côté où l'on était quand on a franchi le portail ; en sortant, on retombe vers le sol.
    this.g = 1;
    if (mode === MODE_AVION) this.vy = this.vy > AVION_VY_MAX ? AVION_VY_MAX : this.vy < -AVION_VY_MAX ? -AVION_VY_MAX : this.vy;
  }

  /** Un danger (pique, vide, bord) : vrai si la partie est finie. En invulnérabilité ou avec le bouclier, on est sauvé (et le bouclier se consomme). */
  private danger(cause: CauseDeMort): boolean {
    if (this.invuln > 0) {
      this.sauver(cause);
      return false;
    }
    if (!this.bouclier) {
      this.mort = cause;
      this.ev |= EV_MORT;
      return true;
    }
    this.bouclier = false;
    this.invuln = INVULNERABILITE;
    this.ev |= EV_BOUCLIER;
    this.sauver(cause);
    return false;
  }

  /**
   * Le sauvetage. Le vide : replacé près de la surface d'en face et lancé vers elle (la gravité s'inverse). Le bord : replacé à 2 cases devant la caméra.
   * **Défaut de la maquette (b)** : elle posait `x = caméra + 2` sans regarder, donc parfois dans un mur ; ici on cherche l'emplacement libre le plus proche (`placerLibre`).
   */
  private sauver(cause: CauseDeMort): void {
    if (cause === MORT_VIDE) {
      const bas = this.y > (LIGNES - 1) * CASE;
      // Lot GR6 : un bouclier qui sauve d'une chute dans un mode **remet en mode gravité**.
      this.mode = MODE_GRAVITE;
      this.bondAttente = 0;
      this.tampon = 0;
      this.g = bas ? -1 : 1;
      const [x, y] = this.placerLibre(this.x, bas ? SAUVETAGE_Y_BAS : SAUVETAGE_Y_HAUT);
      this.x = Math.max(this.x, x);
      this.y = y;
      this.vy = bas ? -SAUVETAGE_VY : SAUVETAGE_VY;
      this.sol = false;
      this.grace = 0;
    } else if (cause === MORT_BORD) {
      const [x, y] = this.placerLibre(this.cam + BORD_RETOUR, this.y);
      if (y !== this.y) this.vy = 0;
      this.x = Math.max(this.x, x);
      this.y = y;
    }
  }

  /** L'emplacement libre le plus proche de `(x, y)` : on cherche par quarts de case, du plus petit déplacement au plus grand (vers la droite, vers le haut ou le bas). Sans rien trouver : l'emplacement demandé. */
  private placerLibre(x: number, y: number): [number, number] {
    const Q = CASE >> 2;
    const MAX_COUT = 96;
    for (let cout = 0; cout <= MAX_COUT; cout++) {
      for (let a = 0; a <= cout; a++) {
        const b = cout - a;
        for (const sens of b === 0 ? [1] : [1, -1]) {
          const px = x + a * Q;
          const py = y + sens * b * Q;
          if (py < 0 || py > VIDE_BAS - TAILLE) continue;
          if (this.heurte(px, py) === 0) return [px, py];
        }
      }
    }
    return [x, y];
  }

  /**
   * **Pour les essais seulement** (la touche T, `?theme=`) : saute au début du thème suivant, posé au sol. Ce n'est pas rejouable : la partie est marquée `essai`, le jeu ne l'envoie jamais (le serveur
   * rejoue des appuis, il ne sait pas téléporter).
   */
  sauterAuThemeSuivant(): void {
    if (this.mort !== 0) return;
    const colonne = idiv(this.x, CASE);
    const parTheme = this.regles.morceauxParTheme;
    const prochain = (idiv(idiv(colonne, LARGEUR_MORCEAU), parTheme) + 1) * parTheme * LARGEUR_MORCEAU;
    this.x = (prochain + 2) * CASE;
    this.y = DEPART_Y;
    this.g = 1;
    this.vy = 0;
    this.sol = false;
    this.grace = 0;
    this.tampon = 0;
    this.mode = MODE_GRAVITE;
    this.bondAttente = 0;
    this.cam = this.x - CIBLE_CAMERA;
    this.precX = this.x;
    this.precY = this.y;
    this.precCam = this.cam;
    this.essai = true;
  }
}

/** Joue une partie entière : `changements` est la liste des pas où le bouton change d'état (strictement croissante ; le premier est un appui, le suivant un relâché, etc.). Jusqu'à la mort ou aux dix minutes. */
export function jouer(terrain: Terrain, changements: readonly number[]): Resultat {
  const p = new Partie(terrain);
  let k = 0;
  while (!p.finie) {
    while (k < changements.length && changements[k]! <= p.tick) {
      if (changements[k] === p.tick) {
        if (p.bouton) p.relacher();
        else p.appuyer();
      }
      k++;
    }
    p.avancer();
  }
  return p.resultat();
}
