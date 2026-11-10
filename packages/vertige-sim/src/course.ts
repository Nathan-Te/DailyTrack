import { CM, DEMI, DUREE_MAX_TICKS, HAUT, REGARD_MAX, TANGAGE_MAX, TOUCHES_TOUTES, TOUR, T_ARRIERE, T_AVANT, T_DASH, T_DROITE, T_GAUCHE, T_SAUT, YEUX } from "./constantes";
import type { Boite, Niveau } from "./niveaux";
import { appliquer, appliquerT, demiTour, DIRS, dirDe, gravite, mul, numeroOrientation, ORIENTATIONS, oppose, quartDeTour, croix, type Dir, type Mat, type V3 } from "./orientation";
import { PORTAIL_DEMI_H, PORTAIL_DEMI_L, liaisons, type Liaison } from "./portails";
import { pas, REGLAGES_DEFAUT, type Reglages } from "./sensations";
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
  /** Les bascules de gravité (surfaces, orbes) et les traversées de portail (lot V1). */
  bascules: number;
  traversees: number;
}

const EPS = 10; // 10 µm : une boîte qui n'en déborde pas plus ne « chevauche » pas
const POUSSEE = 100; // la distance laissée entre le joueur et ce qu'il touche (100 µm)
const SONDE = 80_000; // la sonde de mur : 8 cm
const DEMI_RACINE_2 = 46341; // 1/√2 à l'échelle 65 536
const RAYON_GEMME2 = 1_300_000 * 1_300_000;
const RAYON_ORBE2 = 1_000_000 * 1_000_000;
/** Après une bascule, 0,2 s (24 pas) sans nouvelle bascule : un angle entre deux surfaces ne fait pas osciller la gravité. */
const BASCULE_VERROU = 24;
/** Une orbe ramassée est éteinte 2 s (240 pas), puis se rallume ; une chute la rallume tout de suite. */
const ORBE_RECHARGE = 240;
/** La moitié de la boîte, au-dessus des pieds : le centre qui décide des portails, des orbes et des gemmes. */
const MI_HAUT = 900_000; // HAUT / 2 (un littéral : voir portails.ts)

/** Une boîte du niveau exprimée dans le repère local d'une orientation. */
interface BoiteL extends Boite {
  g: boolean;
}
const LOCALES = new WeakMap<Niveau, Map<number, readonly BoiteL[]>>();
/** Les blocs du niveau dans le repère local de l'orientation `ori` (construits une fois par niveau et par orientation : les 24 au plus). */
function boitesLocales(niveau: Niveau, ori: number): readonly BoiteL[] {
  let parOri = LOCALES.get(niveau);
  if (!parOri) LOCALES.set(niveau, (parOri = new Map()));
  let l = parOri.get(ori);
  if (!l) {
    const m = ORIENTATIONS[ori]!;
    l = niveau.blocs.map((b) => {
      const lo = [b.boite.x0, b.boite.y0, b.boite.z0];
      const hi = [b.boite.x1, b.boite.y1, b.boite.z1];
      const a = [0, 0, 0];
      const z = [0, 0, 0];
      for (let j = 0; j < 3; j++) {
        for (let i = 0; i < 3; i++) {
          const v = m[3 * i + j]!;
          if (v === 0) continue;
          a[j] = v > 0 ? lo[i]! : 0 - hi[i]!;
          z[j] = v > 0 ? hi[i]! : 0 - lo[i]!;
        }
      }
      return { x0: a[0]!, y0: a[1]!, z0: a[2]!, x1: z[0]!, y1: z[1]!, z1: z[2]!, g: b.gravite === true };
    });
    parOri.set(ori, l);
  }
  return l;
}
const LIAISONS = new WeakMap<Niveau, readonly Liaison[]>();
function liaisonsDe(niveau: Niveau): readonly Liaison[] {
  let l = LIAISONS.get(niveau);
  if (!l) LIAISONS.set(niveau, (l = (niveau.portails ?? []).flatMap((p) => liaisons(p))));
  return l;
}

const dans = (v: number, a: number, b: number): boolean => v >= a && v <= b;
const mod = (a: number, n: number): number => ((a % n) + n) % n;
const borne = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);

export class Partie {
  readonly niveau: Niveau;
  readonly reglages: Readonly<Reglages>;
  // La position des pieds (µm) et la vitesse (µm/s), dans le repère LOCAL du joueur (lot V1) : son haut est +y, quelle que soit la gravité. Avec l'orientation d'origine (`ori` = 0), le repère local est le monde.
  x: number;
  y: number;
  z: number;
  vx = 0;
  vy = 0;
  vz = 0;
  lacet: number;
  tangage = 0;
  sol = false;
  /** L'orientation du repère local dans le monde (numéro 0 à 23 et matrice : `orientation.ts`) ; la gravité va vers `gravite(m)`. */
  ori = 0;
  m: Mat = ORIENTATIONS[0]!;
  /** Les blocs du niveau dans le repère local courant. */
  private blocs: readonly BoiteL[];
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
  /** Les bascules de gravité et les traversées de portail depuis le début ; le pas de la dernière de chaque sorte (−1 : aucune). Le rendu s'en sert pour la transition de la caméra. */
  bascules = 0;
  traversees = 0;
  derniereBascule = -1;
  derniereTraversee = -1;
  /** Pas restants avant qu'une nouvelle bascule soit permise ; pas restants avant que chaque orbe se rallume. */
  basculeVerrou = 0;
  readonly orbesT: number[];
  readonly prises: boolean[];
  /** Le contact avec une surface de gravité pendant ce pas : la direction du monde vers elle, ou −1. */
  private marque = -1;
  // Le point de reprise : les pieds dans le MONDE, l'orientation et le lacet.
  private repPieds: V3;
  private repOri = 0;
  private repLacet: number;
  private readonly liaisons: readonly Liaison[];
  private readonly n: { coyote: number; tampon: number; murDuree: number; murVerrou: number; dash: number; recharge: number };

  constructor(niveau: Niveau, reglages: Readonly<Reglages> = REGLAGES_DEFAUT) {
    this.niveau = niveau;
    this.reglages = reglages;
    const d = niveau.depart;
    this.repPieds = [d.x, d.y, d.z];
    this.repOri = d.ori ?? 0;
    this.lacet = this.repLacet = d.lacet;
    this.x = d.x;
    this.y = d.y;
    this.z = d.z;
    this.prises = niveau.gemmes.map(() => false);
    this.orbesT = (niveau.orbes ?? []).map(() => 0);
    this.liaisons = liaisonsDe(niveau);
    this.blocs = boitesLocales(niveau, this.repOri);
    if (this.repOri !== 0) {
      this.fixer(ORIENTATIONS[this.repOri]!);
      [this.x, this.y, this.z] = appliquerT(this.m, this.repPieds);
    }
    this.n = { coyote: pas(reglages.coyote), tampon: pas(reglages.tampon), murDuree: pas(reglages.murDuree), murVerrou: pas(reglages.murVerrou), dash: pas(reglages.dashDuree), recharge: pas(reglages.dashRecharge) };
  }

  get finie(): boolean {
    return this.fin >= 0 || this.tick >= DUREE_MAX_TICKS;
  }
  /** Le temps du chrono, en pas : 0 avant le premier mouvement, fixe après l'arrivée. */
  get chrono(): number {
    return this.depart < 0 ? 0 : (this.fin >= 0 ? this.fin : this.tick) - this.depart;
  }
  /** La direction de la gravité dans le monde (0 à 5). */
  get gravite(): Dir {
    return gravite(this.m);
  }
  /** Les pieds dans le monde (µm). */
  pieds(): V3 {
    return appliquer(this.m, [this.x, this.y, this.z]);
  }
  /** Le centre de la boîte dans le monde (µm). */
  centre(): V3 {
    return appliquer(this.m, [this.x, this.y + MI_HAUT, this.z]);
  }
  /** Les yeux dans le monde (µm). */
  yeux(): V3 {
    return appliquer(this.m, [this.x, this.y + YEUX, this.z]);
  }
  /** La vitesse dans le monde (µm/s). */
  vitesseMonde(): V3 {
    return appliquer(this.m, [this.vx, this.vy, this.vz]);
  }

  private fixer(m: Mat): void {
    this.m = m;
    this.ori = numeroOrientation(m);
    this.blocs = boitesLocales(this.niveau, this.ori);
  }

  private chevauche(px: number, py: number, pz: number, s: Boite): boolean {
    return px - DEMI < s.x1 - EPS && px + DEMI > s.x0 + EPS && py < s.y1 - EPS && py + HAUT > s.y0 + EPS && pz - DEMI < s.z1 - EPS && pz + DEMI > s.z0 + EPS;
  }

  /** Déplace d'un axe et résout les contacts ; rend −1 (contact en allant vers le moins), 1 (vers le plus), 0 (rien). Une surface de gravité touchée est notée (la première du pas). */
  private deplacer(axe: "x" | "y" | "z", d: number): number {
    if (d === 0) return 0;
    this[axe] += d;
    let touche = 0;
    for (const s of this.blocs) {
      if (!this.chevauche(this.x, this.y, this.z, s)) continue;
      if (axe === "y") this.y = d > 0 ? s.y0 - HAUT - POUSSEE : s.y1 + POUSSEE;
      else if (axe === "x") this.x = d > 0 ? s.x0 - DEMI - POUSSEE : s.x1 + DEMI + POUSSEE;
      else this.z = d > 0 ? s.z0 - DEMI - POUSSEE : s.z1 + DEMI + POUSSEE;
      touche = d > 0 ? 1 : -1;
      if (s.g && this.marque < 0) this.marque = dirDe(appliquer(this.m, [axe === "x" ? touche : 0, axe === "y" ? touche : 0, axe === "z" ? touche : 0]));
    }
    return touche;
  }

  /** La normale d'un mur contre le joueur (à 8 cm), ou null ; `g` : le mur est une surface de gravité. L'ordre des essais est fixe : +x, −x, +z, −z. */
  private murVoisin(): { nx: number; nz: number; g: boolean } | null {
    for (const [axe, sgn] of [["x", 1], ["x", -1], ["z", 1], ["z", -1]] as const) {
      const px = this.x + (axe === "x" ? sgn * SONDE : 0);
      const pz = this.z + (axe === "z" ? sgn * SONDE : 0);
      for (const b of this.blocs) if (this.chevauche(px, this.y, pz, b)) return { nx: axe === "x" ? -sgn : 0, nz: axe === "z" ? -sgn : 0, g: b.g };
    }
    return null;
  }

  /**
   * Tourne la gravité vers `vers` (lot V1) : la bascule est INSTANTANÉE. Le repère local tourne d'un quart de tour (d'un demi-tour si `vers` est l'opposé : autour de l'axe horizontal le plus proche de la droite du
   * joueur) ; la boîte garde son centre, la vitesse du monde est conservée (exprimée dans le nouveau repère), le lacet et le tangage sont les mêmes nombres (relatifs au nouveau repère : la vue tourne avec le monde).
   * Si la boîte, ainsi tournée, touche un bloc, elle est remontée le long de son nouveau haut (au plus 8 fois).
   */
  private tournerGravite(vers: Dir): boolean {
    const actuelle = this.gravite;
    if (vers === actuelle) return false;
    let q: Mat;
    if (vers === oppose(actuelle)) {
      const droite = Math.abs(cosinus(this.lacet)) >= Math.abs(sinus(this.lacet));
      q = demiTour(appliquer(this.m, droite ? [1, 0, 0] : [0, 0, 1]));
    } else q = quartDeTour(croix(DIRS[actuelle]!, DIRS[vers]!));
    const centre = this.centre();
    const vitesse = this.vitesseMonde();
    this.fixer(mul(q, this.m));
    this.poserCentre(centre);
    [this.vx, this.vy, this.vz] = appliquerT(this.m, vitesse);
    for (let i = 0; i < 8; i++) {
      let remonte = 0;
      for (const b of this.blocs) if (this.chevauche(this.x, this.y, this.z, b)) remonte = Math.max(remonte, b.y1 + POUSSEE - this.y);
      if (remonte === 0) break;
      this.y += remonte;
    }
    this.sol = false;
    this.coyote = 0;
    this.dash = 0;
    this.surMur = false;
    this.murT = 0;
    this.basculeVerrou = BASCULE_VERROU;
    this.bascules++;
    this.derniereBascule = this.tick;
    return true;
  }

  /** Pose le centre de la boîte (monde) : calcule les pieds dans le repère local courant. */
  private poserCentre(c: V3): void {
    const l = appliquerT(this.m, c);
    this.x = l[0];
    this.y = l[1] - MI_HAUT;
    this.z = l[2];
  }

  /** Une traversée de portail : le centre de la boîte a passé le plan d'un portail (par le devant, vers l'arrière) en restant dans l'ouverture. La rotation du portail s'applique à la position (avec la translation),
   *  à la vitesse, au regard et à la gravité : le repère local tourne (`R · M`), les nombres locaux de la vitesse, du lacet et du tangage ne changent pas. */
  private traverser(avant: V3): boolean {
    const apres = this.centre();
    for (const l of this.liaisons) {
      const c = l.de.centre;
      const d0 = (avant[0] - c[0]) * l.de.n[0] + (avant[1] - c[1]) * l.de.n[1] + (avant[2] - c[2]) * l.de.n[2];
      const d1 = (apres[0] - c[0]) * l.de.n[0] + (apres[1] - c[1]) * l.de.n[1] + (apres[2] - c[2]) * l.de.n[2];
      if (!(d0 >= 0 && d1 < 0)) continue;
      const lr = (apres[0] - c[0]) * l.de.r[0] + (apres[1] - c[1]) * l.de.r[1] + (apres[2] - c[2]) * l.de.r[2];
      const lu = (apres[0] - c[0]) * l.de.u[0] + (apres[1] - c[1]) * l.de.u[1] + (apres[2] - c[2]) * l.de.u[2];
      if (Math.abs(lr) > PORTAIL_DEMI_L || Math.abs(lu) > PORTAIL_DEMI_H) continue;
      const r = appliquer(l.R, [apres[0] - c[0], apres[1] - c[1], apres[2] - c[2]]);
      this.fixer(mul(l.R, this.m));
      this.poserCentre([r[0] + l.vers.centre[0], r[1] + l.vers.centre[1], r[2] + l.vers.centre[2]]);
      this.sol = false;
      this.coyote = 0;
      this.traversees++;
      this.derniereTraversee = this.tick;
      return true;
    }
    return false;
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
    if (this.basculeVerrou > 0) this.basculeVerrou--;
    for (let i = 0; i < this.orbesT.length; i++) if (this.orbesT[i]! > 0) this.orbesT[i]!--;
    this.marque = -1;
    const avant = this.centre();
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
    // Les portails : le centre de la boîte a-t-il passé un plan ? (Sinon, les orbes, puis les surfaces de gravité.)
    const traverse = this.liaisons.length > 0 && this.traverser(avant);
    if (!traverse) this.declencherGravite(mur);
    // Les points de reprise, la chute.
    if (this.sol) {
      const f = this.pieds();
      for (const p of this.niveau.reprises) {
        if (dans(f[0], p.zone.x0, p.zone.x1) && dans(f[1], p.zone.y0, p.zone.y1) && dans(f[2], p.zone.z0, p.zone.z1)) {
          this.repPieds = [p.x, p.y, p.z];
          this.repOri = this.ori;
          this.repLacet = p.lacet;
        }
      }
    }
    const pieds = this.pieds();
    const v = this.niveau.vide;
    if (pieds[1] < this.niveau.chute || (v && !(dans(pieds[0], v.x0, v.x1) && dans(pieds[1], v.y0, v.y1) && dans(pieds[2], v.z0, v.z1)))) {
      this.fixer(ORIENTATIONS[this.repOri]!);
      [this.x, this.y, this.z] = appliquerT(this.m, this.repPieds);
      this.lacet = this.repLacet;
      this.vx = this.vy = this.vz = 0;
      this.sol = false;
      this.dash = this.coyote = this.tampon = this.murT = this.basculeVerrou = 0;
      this.orbesT.fill(0);
      this.surMur = false;
      this.chutes++;
    }
    // Les gemmes (une sphère de 1,3 m autour du centre de la boîte), puis l'arrivée.
    const cm = this.centre();
    this.niveau.gemmes.forEach((g, i) => {
      if (this.prises[i]) return;
      const dx = g.x - cm[0];
      const dy = g.y - cm[1];
      const dz = g.z - cm[2];
      if (dx * dx + dy * dy + dz * dz < RAYON_GEMME2) this.prises[i] = true;
    });
    this.tick++;
    const a = this.niveau.arrivee;
    if (a && this.depart >= 0) {
      const f = this.pieds();
      // La zone d'arrivée est une boîte du monde ; la boîte du joueur (0,6 × 1,8 × 0,6 selon son repère) la touche si leurs intervalles se recouvrent.
      const demi = appliquer(this.m, [DEMI, 0, DEMI]);
      const haut = appliquer(this.m, [0, HAUT, 0]);
      const lo = [f[0] - Math.abs(demi[0]) + Math.min(0, haut[0]), f[1] - Math.abs(demi[1]) + Math.min(0, haut[1]), f[2] - Math.abs(demi[2]) + Math.min(0, haut[2])];
      const hi = [f[0] + Math.abs(demi[0]) + Math.max(0, haut[0]), f[1] + Math.abs(demi[1]) + Math.max(0, haut[1]), f[2] + Math.abs(demi[2]) + Math.max(0, haut[2])];
      if (lo[0]! < a.x1 - EPS && hi[0]! > a.x0 + EPS && lo[1]! < a.y1 - EPS && hi[1]! > a.y0 + EPS && lo[2]! < a.z1 - EPS && hi[2]! > a.z0 + EPS) this.fin = this.tick;
    }
  }

  /** Les orbes puis les surfaces de gravité : la première cause d'une bascule gagne, et jamais pendant le verrou qui suit une bascule. */
  private declencherGravite(mur: { nx: number; nz: number; g: boolean } | null): void {
    if (this.basculeVerrou > 0) return;
    const orbes = this.niveau.orbes;
    if (orbes && orbes.length > 0) {
      const cm = this.centre();
      for (let i = 0; i < orbes.length; i++) {
        const o = orbes[i]!;
        if (this.orbesT[i]! > 0 || o.dir === this.gravite) continue;
        const dx = o.x - cm[0];
        const dy = o.y - cm[1];
        const dz = o.z - cm[2];
        if (dx * dx + dy * dy + dz * dz < RAYON_ORBE2) {
          this.orbesT[i] = ORBE_RECHARGE;
          this.tournerGravite(o.dir);
          return;
        }
      }
    }
    // Une surface de gravité : touchée en se déplaçant, ou longée en courant sur le mur (la direction va du joueur vers le mur).
    let vers = this.marque;
    if (vers < 0 && mur && mur.g && this.surMur) vers = dirDe(appliquer(this.m, [-mur.nx, 0, -mur.nz]));
    if (vers >= 0) this.tournerGravite(vers as Dir);
  }

  resultat(): Resultat {
    return { arrive: this.fin >= 0, ticks: this.fin >= 0 ? this.fin - this.depart : 0, pas: this.tick, gemmes: this.prises.filter(Boolean).length, chutes: this.chutes, bascules: this.bascules, traversees: this.traversees };
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
    const etat = [this.x, this.y, this.z, this.vx, this.vy, this.vz, this.lacet, this.tangage, this.sol ? 1 : 0, this.coyote, this.tampon, this.dash, this.dashRecharge, this.murVerrou, this.murT, this.surMur ? 1 : 0, this.murNx, this.murNz, this.depart, this.fin, this.tick, this.chutes, this.ori, this.basculeVerrou, this.bascules, this.traversees, this.derniereBascule, this.derniereTraversee];
    for (const v of etat) entier(v);
    for (const p of this.prises) entier(p ? 1 : 0);
    for (const t of this.orbesT) entier(t);
    return h.toString(16).padStart(8, "0");
  }
}

/** Joue des commandes sur un niveau, de bout en bout (jusqu'à l'arrivée, la fin du temps ou la dernière commande). */
export function jouer(niveau: Niveau, commandes: readonly Commande[], reglages: Readonly<Reglages> = REGLAGES_DEFAUT): Partie {
  const p = new Partie(niveau, reglages);
  for (let i = 0; i < commandes.length && !p.finie; i++) p.avancer(commandes[i]!);
  return p;
}
