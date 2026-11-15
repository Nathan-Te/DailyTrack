import {
  AXE, DROITE, DUREE_MAX_TICKS, EV_BANQUE, EV_BUMPER, EV_CIBLE, EV_FIN, EV_LANCE, EV_MULT, EV_PERDUE, EV_SAUVEE, EV_SLING, EV_SPINNER, EV_TROU, EV_VOIE, GAUCHE, LANCE_X2, LANCE_Y, LANCEUR, MULT_MAX, NB_BILLES, NORME, PERDUE_Y, POINTS,
  RAYON, TICKS_PAR_SECONDE, TOUR, UNITE, type Controle,
} from "./constantes";
import { cosinus, div, racine, sinus, unitaire } from "./entiers";
import type { Contenu } from "./generateur";
import { deriver, REGLAGES, type Derives, type Reglages } from "./reglages";
import { construireTable, type Segment, type Table } from "./table";

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
  private fin = false;

  constructor(
    readonly contenu: Contenu,
    reglages: Reglages = REGLAGES,
  ) {
    this.reglages = reglages;
    this.d = deriver(reglages);
    this.table = construireTable(contenu, reglages);
    this.a = [this.d.repos, this.d.repos];
    this.aAvant = [this.d.repos, this.d.repos];
    this.bas = this.table.murs.map(() => false);
    this.banqueDans = this.table.banques.map(() => 0);
    this.voiesAllumees = this.table.voies.map(() => false);
    this.trouPause = this.table.trous.map(() => 0);
    this.spin = this.table.spinners.map(() => 0);
    this.choc = this.table.bumpers.map(() => 0);
  }

  get finie(): boolean {
    return this.fin;
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
    this.gains.push({ points: p, x, y });
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
    this.dansLanceur = true;
    this.charge = 0;
    this.sauvee = false;
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
        const tr = t.trous[this.captifDe]!;
        const co = cosinus(ANGLE_TROU);
        const si = sinus(ANGLE_TROU);
        this.vx = div(co * r.trouVitesse * UNITE, NORME);
        this.vy = div(si * r.trouVitesse * UNITE, NORME);
        const sortie = div(tr.r * 2, 5) + 14 * UNITE; // le rayon × 0,4 + 14 px
        this.x = tr.x + div(co * sortie, NORME);
        this.y = tr.y + div(si * sortie, NORME);
        this.px = this.x;
        this.py = this.y;
        this.captifDe = -1;
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
      if (this.cercle(b.x, b.y, b.r, r.rebondBumper, b.kick)) {
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
  private cercle(cx: number, cy: number, cr: number, e: number, kick: number): boolean {
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
    const vn = div(this.vx * nx + this.vy * ny, NORME);
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
