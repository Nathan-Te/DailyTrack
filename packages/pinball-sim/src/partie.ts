import * as K from "./constantes";
import type { Controle } from "./constantes";
import * as E from "./entiers";
import { MISSION_DU_THEME, type Contenu, type Mission } from "./generateur";
import { deriver, REGLAGES, type Derives, type Reglages } from "./reglages";
import { construireTable, type Segment, type Table } from "./table";
// Les constantes et les fonctions chaudes sont posées dans des locales : sous Vitest (module runner) chaque import se lit par un accesseur, deux à trois fois plus lent dans une boucle de millions de pas (le robot du
// lot PB4 en joue des dizaines de millions). Rien ne change pour le jeu ni le serveur.
const {
  AXE, DROITE, DUREE_MAX_TICKS, EV_BANQUE, EV_BUMPER, EV_CIBLE, EV_COULEE, EV_FIN, EV_GEYSER, EV_LANCE, EV_MANEGE, EV_MISSION, EV_MULT, EV_PERDUE, EV_PORTAIL, EV_SAUVEE, EV_SLING, EV_SPINNER, EV_TOURBILLON, EV_TROU, EV_VOIE, GAUCHE, LANCE_X2, LANCE_Y, LANCEUR, MULT_MAX, NB_BILLES, NORME, PERDUE_Y, POINTS,
  RAYON, TICKS_PAR_SECONDE, TOUR, UNITE,
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
  /** Les événements du pas (bits `EV_*`) et ses gains de points. */
  ev = 0;
  readonly gains: Gain[] = [];
  /** Lot PB4 : vrai pour une copie d'essai du robot (`copier(true)`) : les gains de points ne sont pas gardés (le score, lui, compte). Aucun effet sur la partie. */
  sansGains = false;
  /** **Lot PB3 : la mission du thème.** Ce qu'il faut faire (`MISSION_DU_THEME`), le but (un réglage), le compteur, et si elle est réussie (**une seule fois par partie**, d'une bille à l'autre). */
  readonly mission: Mission;
  readonly but: number;
  compteur = 0;
  missionFaite = false;
  /** Le manège : le secteur de la bille (−1 : hors du plateau) et l'avance en huitièmes de tour depuis le dernier tour compté (huit font un tour de manège ; elle se garde d'une bille à l'autre), par plateau. */
  readonly manegeSecteur: number[];
  readonly manegeAvance: number[];
  /** Les pas avant que chaque tourbillon, chaque portail et chaque geyser puissent servir de nouveau ; pour le rendu, les pas qu'il reste au jet de chaque geyser ; la bille est-elle dans la coulée ; les jets de la bille courante. */
  readonly tourbillonPause: number[];
  readonly portailPause: number[];
  readonly geyserAttente: number[];
  readonly geyserJet: number[];
  readonly couleeDedans: boolean[];
  geyserJets = 0;
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
    this.but = { manege: reglages.butManege, tourbillon: reglages.butTourbillon, portail: reglages.butPortail, geyser: reglages.butGeyser }[this.mission];
    this.manegeSecteur = m ? m.manegeSecteur.slice() : tb.plateaux.map(() => -1);
    this.manegeAvance = m ? m.manegeAvance.slice() : tb.plateaux.map(() => 0);
    this.tourbillonPause = m ? m.tourbillonPause.slice() : tb.tourbillons.map(() => 0);
    this.portailPause = m ? m.portailPause.slice() : tb.portails.map(() => 0);
    this.geyserAttente = m ? m.geyserAttente.slice() : tb.geysers.map(() => 0);
    this.geyserJet = m ? m.geyserJet.slice() : tb.geysers.map(() => 0);
    this.couleeDedans = m ? m.couleeDedans.slice() : tb.coulees.map(() => false);
    this.sansGains = sansGains;
    if (!m) return;
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
    this.fin = m.fin;
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

  /** Un pas de plus vers le but de la mission (une seule fois par partie : 10 000 points, au multiplicateur d'avant, puis le multiplicateur monte d'un cran). `quoi` : l'élément qui vient de servir. */
  private pourLaMission(quoi: Mission): void {
    if (this.missionFaite || quoi !== this.mission) return;
    this.compteur = Math.min(this.but, this.compteur + 1);
    if (this.compteur < this.but) return;
    this.missionFaite = true;
    this.points(POINTS.mission);
    this.mult = Math.min(MULT_MAX, this.mult + 1);
    this.multMax = Math.max(this.multMax, this.mult);
    this.ev |= EV_MISSION | EV_MULT;
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
    this.geyserJets = 0;
    this.manegeSecteur.fill(-1);
  }

  /** Un pas de 1/600 s. */
  avancer(): void {
    if (this.fin) return;
    this.ev = 0;
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
      return this.finDuPas();
    }
    for (let i = 0; i < this.trouPause.length; i++) this.trouPause[i] = this.trouPause[i]! - 1;
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
        return this.finDuPas();
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
          }
        }
      }
    }
    this.batteur(GAUCHE);
    this.batteur(DROITE);
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
    if (this.x > 350 * UNITE && this.y > 690 * UNITE && Math.abs(this.vy) < 60 * UNITE) {
      this.dansLanceur = true;
      this.x = LANCE_X2 * UNITE / 2;
    }
    if (this.y > PERDUE_Y * UNITE) {
      if (r.sauvee > 0 && !this.sauvee && this.tick - this.entree <= r.sauvee) {
        this.nouvelleBille();
        this.sauvee = true;
        this.ev |= EV_SAUVEE;
      } else {
        this.ev |= EV_PERDUE;
        if (--this.billes <= 0) {
          this.fin = true;
          this.ev |= EV_FIN;
        } else this.nouvelleBille();
      }
    }
    this.finDuPas();
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
  private batteur(i: number): void {
    const sens = i === GAUCHE ? 1 : -1;
    const a = this.a[i]!;
    const bx = sens > 0 ? this.x : AXE2 - this.x;
    const by = this.y;
    const co = cosinus(a);
    const si = sinus(a);
    let p = div((bx - ORIGINE) * co + (by - PIVOT_Y) * si, NORME);
    p = p < 0 ? 0 : p > LONGUEUR ? LONGUEUR : p;
    const qx = ORIGINE + div(co * p, NORME);
    const qy = PIVOT_Y + div(si * p, NORME);
    const m = RU + BATTEUR_GROS - div(BATTEUR_PERTE * p, LONGUEUR);
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
    const vqx = -div(da * (qy - PIVOT_Y) * K_VITESSE, 100000);
    const vqy = div(da * (qx - ORIGINE) * K_VITESSE, 100000);
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
