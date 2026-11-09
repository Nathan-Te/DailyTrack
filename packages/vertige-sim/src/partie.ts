import { CM, DEMI, DUREE_MAX_TICKS, HAUT, REGARD_MAX, TANGAGE_MAX, TOUCHES_TOUTES, TOUR, T_ARRIERE, T_AVANT, T_DASH, T_DROITE, T_GAUCHE, T_SAUT } from "./constantes";
import type { Boite, Niveau } from "./niveaux";
import { pas, REGLAGES_DEFAUT, type Reglages } from "./reglages";
import { cosinus, idiv, sinus } from "./trigo";

// La partie : un pas de 1/120 s par `avancer(commande)`. Tout est entier (positions en µm, vitesses en µm/s, angles en 1/65 536 de tour) ; les collisions se résolvent axe par axe, contre des boîtes alignées
// sur les axes. Les mouvements sont ceux de la maquette : course, saut (temps de grâce, saut mémorisé), contrôle en l'air, course sur le mur (gravité réduite, durée limitée, seulement en avançant le long du
// mur), saut de mur (poussée et court verrou), dash (sans gravité, avec sa recharge). Ce que la maquette faisait autrement, et que ce lot corrige, est dit dans le README du lot.

/** Les commandes d'un pas : les touches tenues (bits `T_*`), puis le mouvement du regard dans ce pas (lacet et tangage, en 1/65 536 de tour, positifs vers la gauche et vers le haut). */
export interface Commande {
  k: number;
  dl: number;
  dt: number;
}

export interface Resultat {
  /** La zone d'arrivée a été touchée. */
  arrive: boolean;
  /** Le temps entre le premier mouvement et l'arrivée, en pas de 1/120 s (0 si la partie n'est pas arrivée). */
  ticks: number;
  /** Les pas joués. */
  pas: number;
  gemmes: number;
  chutes: number;
}

const EPS = 10; // 10 µm : une boîte qui n'en déborde pas plus ne « chevauche » pas
const POUSSEE = 100; // la distance laissée entre le joueur et ce qu'il touche (100 µm)
const SONDE = 80_000; // la sonde de mur : 8 cm
const DEMI_RACINE_2 = 46341; // 1/√2 à l'échelle 65 536
const RAYON_GEMME2 = 1_300_000 * 1_300_000;

const dans = (v: number, a: number, b: number): boolean => v >= a && v <= b;
const mod = (a: number, n: number): number => ((a % n) + n) % n;
const borne = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

export class Partie {
  readonly niveau: Niveau;
  readonly reglages: Readonly<Reglages>;
  // La position des pieds (µm) et la vitesse (µm/s).
  x: number;
  y: number;
  z: number;
  vx = 0;
  vy = 0;
  vz = 0;
  lacet: number;
  tangage = 0;
  sol = false;
  /** Pas restants : temps de grâce au bord, saut mémorisé, dash, recharge du dash, verrou du saut de mur ; pas passés sur le mur. */
  coyote = 0;
  tampon = 0;
  dash = 0;
  dashRecharge = 0;
  murVerrou = 0;
  murT = 0;
  surMur = false;
  /** La normale du mur touché (−1, 0 ou 1 par axe), tant qu'il y en a un. */
  murNx = 0;
  murNz = 0;
  private dashDx = 0;
  private dashDz = 0;
  private touchesAvant = 0;
  /** Le pas du premier mouvement et celui de l'arrivée, −1 tant qu'ils n'ont pas eu lieu. */
  depart = -1;
  fin = -1;
  /** Le nombre de pas joués. */
  tick = 0;
  chutes = 0;
  readonly prises: boolean[];
  private repX: number;
  private repY: number;
  private repZ: number;
  private repLacet: number;
  private readonly n: { coyote: number; tampon: number; murDuree: number; murVerrou: number; dash: number; recharge: number };

  constructor(niveau: Niveau, reglages: Readonly<Reglages> = REGLAGES_DEFAUT) {
    this.niveau = niveau;
    this.reglages = reglages;
    this.x = this.repX = niveau.depart.x;
    this.y = this.repY = niveau.depart.y;
    this.z = this.repZ = niveau.depart.z;
    this.lacet = this.repLacet = niveau.depart.lacet;
    this.prises = niveau.gemmes.map(() => false);
    this.n = { coyote: pas(reglages.coyote), tampon: pas(reglages.tampon), murDuree: pas(reglages.murDuree), murVerrou: pas(reglages.murVerrou), dash: pas(reglages.dashDuree), recharge: pas(reglages.dashRecharge) };
  }

  get finie(): boolean {
    return this.fin >= 0 || this.tick >= DUREE_MAX_TICKS;
  }
  /** Le temps du chrono, en pas : 0 avant le premier mouvement, fixe après l'arrivée. */
  get chrono(): number {
    return this.depart < 0 ? 0 : (this.fin >= 0 ? this.fin : this.tick) - this.depart;
  }

  private chevauche(px: number, py: number, pz: number, s: Boite): boolean {
    return px - DEMI < s.x1 - EPS && px + DEMI > s.x0 + EPS && py < s.y1 - EPS && py + HAUT > s.y0 + EPS && pz - DEMI < s.z1 - EPS && pz + DEMI > s.z0 + EPS;
  }

  /** Déplace d'un axe et résout les contacts ; rend −1 (contact en allant vers le moins), 1 (vers le plus), 0 (rien). */
  private deplacer(axe: "x" | "y" | "z", d: number): number {
    if (d === 0) return 0;
    this[axe] += d;
    let touche = 0;
    for (const b of this.niveau.blocs) {
      const s = b.boite;
      if (!this.chevauche(this.x, this.y, this.z, s)) continue;
      if (axe === "y") this.y = d > 0 ? s.y0 - HAUT - POUSSEE : s.y1 + POUSSEE;
      else if (axe === "x") this.x = d > 0 ? s.x0 - DEMI - POUSSEE : s.x1 + DEMI + POUSSEE;
      else this.z = d > 0 ? s.z0 - DEMI - POUSSEE : s.z1 + DEMI + POUSSEE;
      touche = d > 0 ? 1 : -1;
    }
    return touche;
  }

  /** La normale d'un mur contre le joueur (à 8 cm), ou null. L'ordre des essais est fixe : +x, −x, +z, −z. */
  private murVoisin(): { nx: number; nz: number } | null {
    for (const [axe, sgn] of [["x", 1], ["x", -1], ["z", 1], ["z", -1]] as const) {
      const px = this.x + (axe === "x" ? sgn * SONDE : 0);
      const pz = this.z + (axe === "z" ? sgn * SONDE : 0);
      for (const b of this.niveau.blocs) if (this.chevauche(px, this.y, pz, b.boite)) return { nx: axe === "x" ? -sgn : 0, nz: axe === "z" ? -sgn : 0 };
    }
    return null;
  }

  avancer(c: Commande): void {
    if (this.finie) return;
    const r = this.reglages;
    const n = this.n;
    // Le regard.
    this.lacet = mod(this.lacet + borne(c.dl, -REGARD_MAX, REGARD_MAX), TOUR);
    this.tangage = borne(this.tangage + borne(c.dt, -REGARD_MAX, REGARD_MAX), -TANGAGE_MAX, TANGAGE_MAX);
    // Les touches : un appui est le passage de « relâchée » à « tenue ».
    const k = c.k & TOUCHES_TOUTES;
    const appuis = k & ~this.touchesAvant;
    this.touchesAvant = k;
    if (this.tampon > 0) this.tampon--;
    if (this.coyote > 0) this.coyote--;
    if (this.dashRecharge > 0) this.dashRecharge--;
    if (this.murVerrou > 0) this.murVerrou--;
    if (appuis & T_SAUT) this.tampon = n.tampon;
    // La direction souhaitée, à l'échelle 65 536 (norme 65 536, ou 0).
    const av = (k & T_AVANT ? 1 : 0) - (k & T_ARRIERE ? 1 : 0);
    const dr = (k & T_DROITE ? 1 : 0) - (k & T_GAUCHE ? 1 : 0);
    const sn = sinus(this.lacet);
    const cs = cosinus(this.lacet);
    const m = av !== 0 && dr !== 0 ? DEMI_RACINE_2 : 65536;
    const sx = idiv((dr * cs - av * sn) * m, 65536);
    const sz = idiv((-av * cs - dr * sn) * m, 65536);
    const bouge = sx !== 0 || sz !== 0;
    if (this.depart < 0 && bouge) this.depart = this.tick;
    // Le dash.
    if (appuis & T_DASH && this.dashRecharge <= 0) {
      this.dash = n.dash;
      this.dashRecharge = n.recharge;
      this.dashDx = bouge ? sx : -sn;
      this.dashDz = bouge ? sz : -cs;
    }
    // Le mur (seulement en l'air) et la course sur le mur : en avançant, le long du mur, assez vite.
    const mur = !this.sol ? this.murVoisin() : null;
    const tangente = mur ? Math.abs(mur.nx !== 0 ? this.vz : this.vx) : 0;
    this.surMur = !!mur && (k & T_AVANT) !== 0 && tangente > r.murVitesse * CM && this.murT < n.murDuree && this.murVerrou <= 0 && this.dash <= 0;
    this.murNx = mur ? mur.nx : 0;
    this.murNz = mur ? mur.nz : 0;
    if (this.surMur) this.murT++;
    else if (this.sol) this.murT = 0;
    // Le saut et le saut de mur.
    if (this.tampon > 0) {
      if (this.sol || this.coyote > 0) {
        this.vy = r.saut * CM;
        this.tampon = 0;
        this.coyote = 0;
        this.sol = false;
      } else if (mur) {
        this.vx += mur.nx * r.sautMurPousse * CM;
        this.vz += mur.nz * r.sautMurPousse * CM;
        this.vy = r.sautMurHaut * CM;
        this.tampon = 0;
        this.murVerrou = n.murVerrou;
        this.murT = 0;
      }
    }
    // La vitesse.
    if (this.dash > 0) {
      this.dash--;
      this.vx = idiv(this.dashDx * r.dashVitesse * CM, 65536);
      this.vz = idiv(this.dashDz * r.dashVitesse * CM, 65536);
      this.vy = 0;
    } else {
      const cibleX = idiv(sx * r.vitesse * CM, 65536);
      const cibleZ = idiv(sz * r.vitesse * CM, 65536);
      const dixiemes = this.sol ? r.accelSol : this.surMur ? r.accelMur : r.accelAir; // k × dt = dixièmes / 1200
      this.vx += idiv((cibleX - this.vx) * dixiemes, 1200);
      this.vz += idiv((cibleZ - this.vz) * dixiemes, 1200);
      if (this.surMur) {
        this.vy = Math.max(this.vy - idiv(r.gravite * CM * r.murGravite, 12000), -r.murChute * CM);
        this.vx -= idiv(mur!.nx * r.murAttirance * CM, 120);
        this.vz -= idiv(mur!.nz * r.murAttirance * CM, 120);
      } else this.vy -= idiv(r.gravite * CM, 120);
    }
    // Le déplacement, axe par axe. Une vitesse contre un mur est annulée.
    if (this.deplacer("x", idiv(this.vx, 120)) !== 0) this.vx = 0;
    if (this.deplacer("z", idiv(this.vz, 120)) !== 0) this.vz = 0;
    const vertical = this.deplacer("y", idiv(this.vy, 120));
    const etaitAuSol = this.sol;
    this.sol = vertical < 0;
    if (vertical !== 0) this.vy = 0;
    if (etaitAuSol && !this.sol) this.coyote = n.coyote;
    // Les points de reprise, la chute.
    if (this.sol) {
      for (const p of this.niveau.reprises) {
        if (dans(this.x, p.zone.x0, p.zone.x1) && dans(this.y, p.zone.y0, p.zone.y1) && dans(this.z, p.zone.z0, p.zone.z1)) {
          this.repX = p.x;
          this.repY = p.y;
          this.repZ = p.z;
          this.repLacet = p.lacet;
        }
      }
    }
    if (this.y < this.niveau.chute) {
      this.x = this.repX;
      this.y = this.repY;
      this.z = this.repZ;
      this.lacet = this.repLacet;
      this.vx = this.vy = this.vz = 0;
      this.sol = false;
      this.dash = this.coyote = this.tampon = this.murT = 0;
      this.surMur = false;
      this.chutes++;
    }
    // Les gemmes (une sphère de 1,3 m autour de la poitrine), puis l'arrivée.
    this.niveau.gemmes.forEach((g, i) => {
      if (this.prises[i]) return;
      const dx = g.x - this.x;
      const dy = g.y - (this.y + 900_000);
      const dz = g.z - this.z;
      if (dx * dx + dy * dy + dz * dz < RAYON_GEMME2) this.prises[i] = true;
    });
    this.tick++;
    const a = this.niveau.arrivee;
    if (a && this.depart >= 0 && this.chevauche(this.x, this.y, this.z, a)) this.fin = this.tick;
  }

  resultat(): Resultat {
    return { arrive: this.fin >= 0, ticks: this.fin >= 0 ? this.fin - this.depart : 0, pas: this.tick, gemmes: this.prises.filter(Boolean).length, chutes: this.chutes };
  }

  /** L'empreinte de TOUT l'état (FNV-1a sur ses entiers) : deux machines qui jouent les mêmes commandes ont la même, au bit près. */
  empreinte(): string {
    let h = 0x811c9dc5;
    const entier = (v: number): void => {
      // Une valeur est mélangée par morceaux de 16 bits (sa partie basse, puis ce qui reste).
      const bas = ((v % 65536) + 65536) % 65536;
      const haut = Math.floor(v / 65536);
      const haut2 = Math.floor(haut / 65536);
      for (const m of [bas, haut & 0xffff, haut2 & 0xffff]) h = Math.imul(h ^ m, 0x01000193) >>> 0;
    };
    const etat = [this.x, this.y, this.z, this.vx, this.vy, this.vz, this.lacet, this.tangage, this.sol ? 1 : 0, this.coyote, this.tampon, this.dash, this.dashRecharge, this.murVerrou, this.murT, this.surMur ? 1 : 0, this.murNx, this.murNz, this.depart, this.fin, this.tick, this.chutes];
    for (const v of etat) entier(v);
    for (const p of this.prises) entier(p ? 1 : 0);
    return h.toString(16).padStart(8, "0");
  }
}

/** Joue des commandes sur un niveau, de bout en bout (jusqu'à l'arrivée, la fin du temps ou la dernière commande). */
export function jouer(niveau: Niveau, commandes: readonly Commande[], reglages: Readonly<Reglages> = REGLAGES_DEFAUT): Partie {
  const p = new Partie(niveau, reglages);
  for (let i = 0; i < commandes.length && !p.finie; i++) p.avancer(commandes[i]!);
  return p;
}

/** Le temps de classement d'un résultat (en pas) : le temps de l'arrivée, ou le pire temps. */
export const tempsDe = (r: Pick<Resultat, "arrive" | "ticks">): number => (r.arrive ? r.ticks : DUREE_MAX_TICKS);
