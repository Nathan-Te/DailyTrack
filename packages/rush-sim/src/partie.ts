import { Rng } from "@cdj/core";
import { COEURS, DUREE_TICKS, MAX_MONSTRES, RAYON_ARENE, RAYON_CHAUVE, RAYON_CHEVALIER, RAYON_GELEE, RAYON_GOLEM, cm } from "./constantes";
import { coupDe, directionDe, esquiveDe } from "./entrees";
import type { Contenu } from "./generateur";
import { distance, distance2, idiv, isqrt, unitaire, dirVers, modDir } from "./maths";
import { REGLAGES_DEFAUT, type Reglages } from "./reglagesSim";
import { COS, SIN } from "./trig";

// La partie de Rush : 60 Hz, tout en entiers, l'état d'un seul tenant. À chaque tick, `avancer(entree)` applique l'octet d'entrée du tick (voir `entrees.ts`) puis fait avancer le monde : le chevalier, les apparitions,
// les monstres, le golem, les zones annoncées, les ondes, les contacts. **Le même code joue la partie du joueur et la rediffusion du serveur** ; la vue (`apps/rush`) ne fait que lire cet état.
// Le hasard (apparitions, pierres) vient d'une graine du contenu et n'est tiré qu'à des ticks fixés par l'état : une rediffusion refait les mêmes tirages.

// --- Les types lus par le rendu -------------------------------------------------------------------------------------------------------------------------------------------------------------------
export const LIBRE = 0;
export const COUP = 1;
export const ESQUIVE = 2;
export const GELEE = 0;
export const CHAUVE = 1;
// La chauve-souris : tourne, s'annonce, plonge, se repose.
export const ORBITE = 0;
export const ANNONCE_PLONGEON = 1;
export const PLONGEON = 2;
export const REPOS = 3;
// Le golem.
export const MARCHE = 0;
export const ANNONCE = 1;
export const RECUPERE = 2;
export const RUGIT = 3;
export const POING = 0;
export const ONDE = 1;
export const PIERRES = 2;

export interface Chevalier {
  x: number;
  y: number;
  /** Où il regarde (0 à 127). */
  dir: number;
  coeurs: number;
  etat: number;
  /** Les ticks écoulés dans l'état (coup, esquive). */
  t: number;
  /** Le coup en cours ou le dernier (0 à 2). */
  combo: number;
  /** Les ticks restants de l'appui sur « coup » gardé en mémoire. */
  tampon: number;
  /** Les ticks restants de l'appui sur « esquive » gardé en mémoire. */
  tampEsq: number;
  /** Les ticks sans coup avant que l'enchaînement reparte du premier. */
  reprise: number;
  /** L'attente avant la prochaine esquive. */
  attente: number;
  /** L'invincibilité de l'esquive. */
  esq: number;
  /** L'invincibilité après un dégât. */
  degat: number;
  kx: number;
  ky: number;
  /** Il bouge à ce tick (pour l'animation). */
  marche: boolean;
}

export interface Monstre {
  id: number;
  type: number;
  x: number;
  y: number;
  kx: number;
  ky: number;
  hp: number;
  /** Les ticks restants de l'éclair blanc. */
  flash: number;
  etat: number;
  t: number;
  /** Le tick d'apparition : l'animation d'entrée et la phase de saut en dépendent. */
  age: number;
  /** Chauve-souris : l'angle de l'orbite (0 à 127) et son sens (±1) ; gelée : inutilisés. */
  a: number;
  sens: number;
  /** La direction verrouillée (vecteur de 1 024) du saut ou du plongeon. */
  cx: number;
  cy: number;
  /** Les ticks restants d'étourdissement (après avoir blessé le chevalier). */
  gel: number;
  duree: number;
  /** Le dernier coup qui l'a touché : un coup ne touche qu'une fois. */
  coup: number;
}

export interface Golem {
  x: number;
  y: number;
  hp: number;
  hpMax: number;
  phase: number;
  etat: number;
  t: number;
  /** La durée de l'annonce (pour la fraction qui avance). */
  duree: number;
  attaque: number;
  /** Les ticks de marche avant la prochaine attaque. */
  repos: number;
  compteur: number;
  flash: number;
  dir: number;
  /** Les ticks restants de la récupération après une attaque (pour l'animation). */
  recup: number;
  /** Le dernier coup qui l'a touché. */
  coup: number;
}

/** Un cercle rouge au sol : il frappe à `ti`. */
export interface Zone {
  type: number;
  x: number;
  y: number;
  r: number;
  t0: number;
  ti: number;
}
/** Une onde du golem : un anneau qui s'élargit depuis son centre. */
export interface OndeGolem {
  x: number;
  y: number;
  r: number;
  vitesse: number;
  epaisseur: number;
  rMax: number;
  touche: boolean;
}

export type GenreEvenement = "coup" | "touche" | "mort" | "esquive" | "frole" | "degats" | "annonce" | "impact" | "onde" | "phase2" | "victoire" | "defaite" | "apparition" | "bloque" | "sauve";
/** Ce que le rendu doit savoir d'un tick (sons, éclats, secousse) : jamais lu par la simulation. */
export interface Evenement {
  k: GenreEvenement;
  tick: number;
  x: number;
  y: number;
  /** Selon le genre : le coup (0 à 2), les dégâts, le type de la cible… */
  a: number;
  b: number;
}

export interface Resultat {
  victoire: boolean;
  /** Le tick de la chute du golem (ou de la fin de la partie perdue). */
  ticks: number;
  coeurs: number;
  tues: number;
  /** Les dégâts reçus. */
  subis: number;
}

// --- Les constantes des règles --------------------------------------------------------------------------------------------------------------------------------------------------------------------
const DUREE_ESQUIVE = 12;
const ATTENTE_ESQUIVE = 40;
const DUREE_TAMPON = 10;
const DUREE_TAMPON_ESQUIVE = 6;
const DUREE_REPRISE = 24;
const DEGATS_COUP = [1, 1, 2] as const;
const ELAN_COUP_CM = [30, 30, 80] as const;
const RAYON_ZONE_POING = cm(250);
const RAYON_ZONE_PIERRE = cm(150);
const RAYON_ONDE = cm(760);
const VIE_GELEE = 3;
const VIE_CHAUVE = 1;
const ARRET_DEGAT = 90;
const ECART_ONDES = 48;

const rayonDe = (type: number): number => (type === GELEE ? RAYON_GELEE : RAYON_CHAUVE);

export class Partie {
  tick = 0;
  readonly c: Chevalier;
  monstres: Monstre[] = [];
  readonly golem: Golem | null;
  zones: Zone[] = [];
  ondes: OndeGolem[] = [];
  /** Le coup en cours (numéro croissant). */
  coupId = 0;
  tues = 0;
  subis = 0;
  victoire = false;
  perdue = false;
  /** Les événements du tick courant et des précédents, tant que le rendu ne les a pas pris (`journal` vrai). */
  evenements: Evenement[] = [];
  /** Les sandboxes ne meurent pas : le chevalier retrouve ses cœurs. */
  readonly immortel: boolean;
  private readonly rng: Rng;
  private prochainId = 1;
  private entreePrecedente = 0;
  private vague = 0;
  private finTick = -1;
  /** La vitesse de marche du chevalier, en unités par tick. */
  private readonly vit: number;

  constructor(
    readonly contenu: Contenu,
    readonly reglages: Reglages = REGLAGES_DEFAUT,
    readonly journal = false,
  ) {
    this.rng = new Rng(contenu.graine);
    this.vit = idiv(cm(reglages.vitesse), 60);
    this.immortel = contenu.scenario === "arene";
    this.c = { x: 0, y: cm(520), dir: 96, coeurs: COEURS, etat: LIBRE, t: 0, combo: 0, tampon: 0, tampEsq: 0, reprise: 0, attente: 0, esq: 0, degat: 0, kx: 0, ky: 0, marche: false };
    if (contenu.scenario === "arene") this.golem = null;
    else {
      const hpMax = reglages.golemVie;
      this.golem = { x: 0, y: -cm(300), hp: contenu.phase2 ? idiv(hpMax, 2) : hpMax, hpMax, phase: contenu.phase2 ? 2 : 1, etat: MARCHE, t: 0, duree: 0, attaque: 0, repos: contenu.phase2 ? 40 : 120, compteur: 0, flash: 0, dir: 32, recup: 0, coup: 0 };
    }
    if (contenu.scenario === "arene") this.apparaitre(contenu.monstres > 0 ? Math.min(contenu.monstres, 6) : 4);
  }

  get finie(): boolean {
    return this.victoire || this.perdue || this.tick >= DUREE_TICKS;
  }

  resultat(): Resultat {
    return { victoire: this.victoire, ticks: this.finTick >= 0 ? this.finTick : this.tick, coeurs: this.c.coeurs, tues: this.tues, subis: this.subis };
  }

  /** L'empreinte de tout l'état (FNV-1a 32 bits sur ses entiers) : deux parties identiques ont la même à chaque tick. Les essais de déterminisme (Node, trois navigateurs) la comparent. */
  empreinte(): string {
    let h = 0x811c9dc5;
    const nombre = (n: number): void => {
      for (let i = 0; i < 4; i++) h = Math.imul(h ^ ((n >>> (8 * i)) & 0xff), 0x01000193) >>> 0;
    };
    const objet = (o: object | null): void => {
      if (o === null) return nombre(0xdead);
      for (const v of Object.values(o)) nombre(typeof v === "boolean" ? (v ? 1 : 0) : (v as number));
    };
    nombre(this.tick);
    nombre(this.tues);
    nombre(this.subis);
    nombre(this.coupId);
    objet(this.c);
    objet(this.golem);
    for (const m of this.monstres) objet(m);
    for (const z of this.zones) objet(z);
    for (const o of this.ondes) objet(o);
    return h.toString(16).padStart(8, "0");
  }

  /** Le rendu a lu les événements. */
  vider(): void {
    this.evenements.length = 0;
  }

  private ev(k: GenreEvenement, x: number, y: number, a = 0, b = 0): void {
    if (this.journal) this.evenements.push({ k, tick: this.tick, x, y, a, b });
  }

  // --- Un tick -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  avancer(entree: number): void {
    if (this.finie) return;
    this.tick++;
    const front = (bit: boolean, avant: boolean): boolean => bit && !avant;
    const coupFront = front(coupDe(entree), coupDe(this.entreePrecedente));
    const esquiveFront = front(esquiveDe(entree), esquiveDe(this.entreePrecedente));
    this.entreePrecedente = entree;
    this.mouvementChevalier(directionDe(entree), coupFront, esquiveFront);
    this.apparitions();
    for (const m of this.monstres) this.mouvementMonstre(m);
    this.separer();
    if (this.golem) this.mouvementGolem(this.golem);
    this.resoudreZones();
    this.avancerOndes();
    this.contacts();
    this.monstres = this.monstres.filter((m) => m.hp > 0);
    if (this.golem && this.golem.hp <= 0 && !this.victoire) this.gagner();
  }

  // --- Le chevalier ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  private mouvementChevalier(direction: number, coupFront: boolean, esquiveFront: boolean): void {
    const c = this.c;
    if (c.tampon > 0) c.tampon--;
    if (coupFront) c.tampon = DUREE_TAMPON;
    if (c.tampEsq > 0) c.tampEsq--;
    if (esquiveFront) c.tampEsq = DUREE_TAMPON_ESQUIVE;
    if (c.attente > 0) c.attente--;
    if (c.esq > 0) c.esq--;
    if (c.degat > 0) c.degat--;
    if (c.reprise > 0 && --c.reprise === 0 && c.etat === LIBRE) c.combo = 0;
    c.marche = false;

    // L'esquive coupe un coup à n'importe quel moment (survivre passe avant) ; un appui un peu trop tôt est gardé en mémoire.
    const dureeCoup = this.dureeCoup(c.combo);
    if (c.tampEsq > 0 && c.attente === 0 && c.etat !== ESQUIVE) {
      c.tampEsq = 0;
      const d = direction >= 0 ? direction * 4 : c.dir;
      c.dir = d;
      c.etat = ESQUIVE;
      c.t = 0;
      c.esq = this.reglages.fenetreEsquive;
      c.attente = ATTENTE_ESQUIVE;
      c.tampon = 0;
      this.ev("esquive", c.x, c.y, d);
    }

    if (c.etat === ESQUIVE) {
      const v = idiv(this.vit * 26, 10);
      this.deplacer(c, idiv(COS[c.dir]! * v, 1024), idiv(SIN[c.dir]! * v, 1024));
      c.marche = true;
      if (++c.t >= DUREE_ESQUIVE) {
        c.etat = LIBRE;
        c.t = 0;
      }
    } else if (c.etat === COUP) {
      const impact = this.impactCoup(c.combo);
      if (c.t <= impact) {
        const elan = idiv(cm(ELAN_COUP_CM[c.combo]!), impact + 1);
        this.deplacer(c, idiv(COS[c.dir]! * elan, 1024), idiv(SIN[c.dir]! * elan, 1024));
      }
      if (c.t === impact) this.frapper();
      c.t++;
      if (c.tampon > 0 && c.t > impact + 2) this.commencerCoup((c.combo + 1) % 3, direction);
      else if (c.t >= dureeCoup) {
        c.etat = LIBRE;
        c.t = 0;
        c.reprise = DUREE_REPRISE;
      }
    } else {
      // Libre : marcher, ou commencer un coup.
      if (c.tampon > 0) this.commencerCoup(c.reprise > 0 ? (c.combo + 1) % 3 : 0, direction);
      else if (direction >= 0) {
        c.dir = direction * 4;
        c.marche = true;
        this.deplacer(c, idiv(COS[c.dir]! * this.vit, 1024), idiv(SIN[c.dir]! * this.vit, 1024));
      }
    }
    // Le recul : il s'ajoute au mouvement et s'éteint.
    if (c.kx !== 0 || c.ky !== 0) {
      this.deplacer(c, c.kx, c.ky);
      c.kx = amortir(c.kx);
      c.ky = amortir(c.ky);
    }
    this.pousserHorsDuGolem(c);
  }

  dureeCoup(s: number): number {
    return s === 2 ? idiv(this.reglages.cadence * 14, 10) : this.reglages.cadence;
  }
  impactCoup(s: number): number {
    return Math.max(2, idiv(this.dureeCoup(s) * 3, 10));
  }

  private commencerCoup(s: number, direction: number): void {
    const c = this.c;
    c.etat = COUP;
    c.t = 0;
    c.combo = s;
    c.tampon = 0;
    c.reprise = 0;
    this.coupId++;
    // Il se tourne vers ce que le joueur tient ; sans direction (ou presque en face d'un ennemi), vers l'ennemi le plus proche.
    const cible = this.plusProche(cm(420));
    if (direction >= 0) {
      c.dir = direction * 4;
      if (cible) {
        const v = dirVers(cible.x - c.x, cible.y - c.y);
        const ecart = Math.min(modDir(v - c.dir), modDir(c.dir - v));
        if (ecart <= 12) c.dir = v;
      }
    } else if (cible) c.dir = dirVers(cible.x - c.x, cible.y - c.y);
    this.ev("coup", c.x, c.y, s, c.dir);
  }

  /** Le monstre (ou le golem) le plus proche à moins de `max` (bord à bord). */
  private plusProche(max: number): { x: number; y: number } | null {
    const c = this.c;
    let meilleur: { x: number; y: number } | null = null;
    let d2m = Infinity;
    const essayer = (x: number, y: number, r: number): void => {
      const d = distance(c.x, c.y, x, y) - r;
      if (d <= max && d * d < d2m) {
        d2m = d * d;
        meilleur = { x, y };
      }
    };
    for (const m of this.monstres) if (m.hp > 0) essayer(m.x, m.y, rayonDe(m.type));
    if (this.golem && this.golem.hp > 0) essayer(this.golem.x, this.golem.y, RAYON_GOLEM);
    return meilleur;
  }

  /** L'impact du coup : tout ce qui est dans l'arc est touché, une fois par coup. */
  private frapper(): void {
    const c = this.c;
    const s = c.combo;
    const portee = idiv(cm(this.reglages.portee) * (s === 2 ? 125 : 100), 100);
    const demi = Math.min(90, this.reglages.arc + (s === 2 ? 30 : 0));
    const seuil = COS[Math.min(32, idiv(demi * 128, 360))]!;
    const fx = COS[c.dir]!;
    const fy = SIN[c.dir]!;
    const dans = (x: number, y: number, r: number): boolean => {
      const dx = x - c.x;
      const dy = y - c.y;
      const d = isqrt(dx * dx + dy * dy);
      if (d - r > portee) return false;
      if (d <= r) return true;
      // Le centre doit être dans l'arc, élargi de la taille de la cible (un grand corps est touché de plus loin sur le côté).
      return dx * fx + dy * fy >= seuil * d - r * 1024;
    };
    const degats = DEGATS_COUP[s]!;
    const force = idiv(cm(this.reglages.recul) * (s === 2 ? 18 : 10), 10);
    for (const m of this.monstres) {
      if (m.hp <= 0 || m.coup === this.coupId || !dans(m.x, m.y, rayonDe(m.type))) continue;
      m.coup = this.coupId;
      m.hp -= degats;
      m.flash = 7;
      const [ux, uy] = unitaire(m.x - c.x, m.y - c.y);
      const ex = ux === 0 && uy === 0 ? COS[c.dir]! : ux;
      const ey = ux === 0 && uy === 0 ? SIN[c.dir]! : uy;
      m.kx = idiv(ex * force, 1024);
      m.ky = idiv(ey * force, 1024);
      if (m.type === CHAUVE && (m.etat === PLONGEON || m.etat === ANNONCE_PLONGEON)) {
        m.etat = REPOS;
        m.t = 0;
      }
      this.ev("touche", m.x, m.y, degats, m.type);
      if (m.hp <= 0) {
        this.tues++;
        this.ev("mort", m.x, m.y, m.type, s);
      }
    }
    const g = this.golem;
    if (g && g.hp > 0 && g.coup !== this.coupId && dans(g.x, g.y, RAYON_GOLEM)) {
      g.coup = this.coupId;
      if (g.etat === RUGIT) this.ev("bloque", g.x, g.y);
      else {
        g.hp -= degats;
        g.flash = 7;
        this.ev("touche", g.x, g.y, degats, 2);
        if (g.phase === 1 && g.hp > 0 && g.hp * 2 <= g.hpMax) this.entrerPhase2(g);
      }
    }
  }

  // --- Les monstres ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  private apparaitre(n: number): void {
    for (let i = 0; i < n && this.monstres.length < MAX_MONSTRES; i++) {
      const angle = this.rng.int(128);
      const type = this.rng.int(100) < 60 ? GELEE : CHAUVE;
      const r = RAYON_ARENE - cm(70);
      const x = idiv(COS[angle]! * r, 1024);
      const y = idiv(SIN[angle]! * r, 1024);
      const t = this.rng.int(40);
      this.monstres.push({ id: this.prochainId++, type, x, y, kx: 0, ky: 0, hp: type === GELEE ? VIE_GELEE : VIE_CHAUVE, flash: 0, etat: ORBITE, t, age: this.tick, a: dirVers(x - this.c.x, y - this.c.y), sens: this.rng.int(2) === 0 ? 1 : -1, cx: 0, cy: 0, gel: 0, duree: 120 + this.rng.int(120), coup: 0 });
      this.ev("apparition", x, y, type);
    }
  }

  private apparitions(): void {
    const k = this.contenu.scenario;
    if (k === "arene") {
      const cible = this.contenu.monstres > 0 ? this.contenu.monstres : Math.min(30, 6 + 2 * this.vague);
      if (this.tick % 90 === 0) {
        this.vague++;
        if (this.monstres.length < cible) this.apparaitre(Math.min(5, cible - this.monstres.length));
      }
    } else if (k === "jour" && this.tick >= 240 && (this.tick - 240) % 480 === 0 && this.monstres.length < 5) this.apparaitre(3);
  }

  private mouvementMonstre(m: Monstre): void {
    const c = this.c;
    if (m.flash > 0) m.flash--;
    if (m.hp <= 0) return;
    if (m.kx !== 0 || m.ky !== 0) {
      this.deplacer(m, m.kx, m.ky);
      m.kx = amortir(m.kx);
      m.ky = amortir(m.ky);
    }
    if (m.gel > 0) {
      m.gel--;
      return;
    }
    if (m.type === GELEE) {
      m.t = (m.t + 1) % 40;
      if (m.t === 10) {
        const [ux, uy] = unitaire(c.x - m.x, c.y - m.y);
        m.cx = ux;
        m.cy = uy;
      }
      if (m.t >= 10 && m.t < 28) {
        const v = idiv(cm(480), 60);
        this.deplacer(m, idiv(m.cx * v, 1024), idiv(m.cy * v, 1024));
      }
      return;
    }
    // La chauve-souris.
    m.t++;
    if (m.etat === ORBITE) {
      if (m.t % 2 === 0) m.a = modDir(m.a + m.sens);
      const rayon = cm(450);
      const tx = c.x + idiv(COS[m.a]! * rayon, 1024);
      const ty = c.y + idiv(SIN[m.a]! * rayon, 1024);
      const d = distance(m.x, m.y, tx, ty);
      const v = Math.min(d, idiv(cm(560), 60));
      if (d > 0) this.deplacer(m, idiv((tx - m.x) * v, d), idiv((ty - m.y) * v, d));
      if (m.t >= m.duree) {
        m.etat = ANNONCE_PLONGEON;
        m.t = 0;
      }
    } else if (m.etat === ANNONCE_PLONGEON) {
      if (m.t >= 22) {
        const [ux, uy] = unitaire(c.x - m.x, c.y - m.y);
        m.cx = ux;
        m.cy = uy;
        m.etat = PLONGEON;
        m.t = 0;
      }
    } else if (m.etat === PLONGEON) {
      const v = idiv(cm(1150), 60);
      this.deplacer(m, idiv(m.cx * v, 1024), idiv(m.cy * v, 1024));
      if (m.t >= 26) {
        m.etat = REPOS;
        m.t = 0;
      }
    } else if (m.t >= 45) {
      m.etat = ORBITE;
      m.t = 0;
      m.a = dirVers(m.x - c.x, m.y - c.y);
      m.duree = 120 + this.rng.int(120);
    }
  }

  /** Les monstres (et le golem) ne se superposent pas : ils se repoussent. */
  private separer(): void {
    const ms = this.monstres;
    for (let i = 0; i < ms.length; i++) {
      const a = ms[i]!;
      if (a.hp <= 0) continue;
      const ra = rayonDe(a.type);
      for (let j = i + 1; j < ms.length; j++) {
        const b = ms[j]!;
        if (b.hp <= 0) continue;
        const somme = ra + rayonDe(b.type);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= somme * somme) continue;
        const d = isqrt(d2);
        const recouvre = idiv(somme - d, 2);
        const [ux, uy] = d === 0 ? [1024, 0] : unitaire(dx, dy);
        a.x -= idiv(ux * recouvre, 1024);
        a.y -= idiv(uy * recouvre, 1024);
        b.x += idiv(ux * recouvre, 1024);
        b.y += idiv(uy * recouvre, 1024);
      }
      this.pousserHorsDuGolem(a, ra);
      this.dansArene(a, ra);
    }
  }

  // --- Le golem -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  private entrerPhase2(g: Golem): void {
    g.phase = 2;
    g.etat = RUGIT;
    g.t = 0;
    g.duree = 100;
    this.zones = [];
    this.zones.push({ type: ONDE, x: g.x, y: g.y, r: RAYON_ONDE, t0: this.tick, ti: this.tick + 70 });
    this.ev("phase2", g.x, g.y);
  }

  private mouvementGolem(g: Golem): void {
    const c = this.c;
    if (g.flash > 0) g.flash--;
    if (g.hp <= 0) return;
    g.t++;
    if (g.etat === RUGIT) {
      if (g.t >= g.duree) {
        g.etat = MARCHE;
        g.t = 0;
        g.repos = 45;
      }
      return;
    }
    if (g.etat === ANNONCE) {
      if (g.t >= g.duree) {
        g.etat = RECUPERE;
        g.t = 0;
        g.recup = g.attaque === POING ? 50 : g.attaque === ONDE ? 55 : 40;
      }
      return;
    }
    if (g.etat === RECUPERE) {
      if (g.t >= g.recup) {
        g.etat = MARCHE;
        g.t = 0;
        g.repos = idiv(this.reglages.golemCadence * (g.phase === 2 ? 62 : 100), 100);
      }
      return;
    }
    // Il marche vers le chevalier, puis choisit son attaque.
    const dx = c.x - g.x;
    const dy = c.y - g.y;
    const d = isqrt(dx * dx + dy * dy);
    g.dir = dirVers(dx, dy);
    if (d > RAYON_GOLEM + RAYON_CHEVALIER + cm(60)) {
      const v = idiv(cm(g.phase === 2 ? 150 : 105), 60);
      g.x += idiv(idiv(dx * 1024, d) * v, 1024);
      g.y += idiv(idiv(dy * 1024, d) * v, 1024);
    }
    if (g.repos > 0) g.repos--;
    if (g.repos === 0) this.lancerAttaque(g, d);
  }

  private lancerAttaque(g: Golem, dChevalier: number): void {
    const c = this.c;
    const suite = g.phase === 2 ? [POING, ONDE, PIERRES, POING, PIERRES, ONDE] : [POING, PIERRES, POING, ONDE];
    let a = suite[g.compteur % suite.length]!;
    g.compteur++;
    if (a === POING && dChevalier > cm(700)) a = PIERRES; // trop loin pour un coup de poing
    g.attaque = a;
    g.etat = ANNONCE;
    g.t = 0;
    const maintenant = this.tick;
    if (a === POING) {
      // Le cercle est posé là où le chevalier se tient : il a le temps de partir.
      const tx = c.x;
      const ty = c.y;
      this.zones.push({ type: POING, x: tx, y: ty, r: RAYON_ZONE_POING, t0: maintenant, ti: maintenant + 50 });
      g.duree = 50;
      if (g.phase === 2) {
        // Le second coup est posé sur le chevalier à l'impact du premier : voir `resoudreZones`.
        g.duree = 72;
      }
      this.ev("annonce", tx, ty, POING);
    } else if (a === ONDE) {
      this.zones.push({ type: ONDE, x: g.x, y: g.y, r: RAYON_ONDE, t0: maintenant, ti: maintenant + 55 });
      g.duree = g.phase === 2 ? 55 + ECART_ONDES : 55;
      this.ev("annonce", g.x, g.y, ONDE);
    } else {
      const n = g.phase === 2 ? 5 : 3;
      for (let i = 0; i < n; i++) {
        let x = c.x;
        let y = c.y;
        if (i > 0) {
          const ang = this.rng.int(128);
          const r = cm(200) + this.rng.int(cm(450));
          x += idiv(COS[ang]! * r, 1024);
          y += idiv(SIN[ang]! * r, 1024);
          const d = isqrt(x * x + y * y);
          const max = RAYON_ARENE - cm(100);
          if (d > max) {
            x = idiv(x * max, d);
            y = idiv(y * max, d);
          }
        }
        this.zones.push({ type: PIERRES, x, y, r: RAYON_ZONE_PIERRE, t0: maintenant, ti: maintenant + 60 + i * 9 });
      }
      g.duree = 60 + (n - 1) * 9;
      this.ev("annonce", c.x, c.y, PIERRES);
    }
  }

  private resoudreZones(): void {
    if (this.zones.length === 0) return;
    const restantes: Zone[] = [];
    for (const z of this.zones) {
      if (this.tick < z.ti) {
        restantes.push(z);
        continue;
      }
      const g = this.golem;
      if (z.type === ONDE) {
        this.ondes.push({ x: z.x, y: z.y, r: RAYON_GOLEM, vitesse: idiv(cm(950), 60), epaisseur: cm(110), rMax: z.r + cm(80), touche: false });
        this.ev("onde", z.x, z.y);
        // Phase 2 : une seconde onde, `ECART_ONDES` ticks plus tard (plus que l'attente de l'esquive : elle doit pouvoir se refaire).
        if (g && g.phase === 2 && g.etat === ANNONCE && g.attaque === ONDE && z.ti === z.t0 + 55) restantes.push({ type: ONDE, x: z.x, y: z.y, r: z.r, t0: this.tick, ti: this.tick + ECART_ONDES });
        continue;
      }
      this.ev("impact", z.x, z.y, z.type, z.r);
      if (distance2(this.c.x, this.c.y, z.x, z.y) < z.r * z.r) this.blesser(z.x, z.y, 1);
      // Phase 2 : le second coup de poing tombe sur le chevalier, tout de suite après le premier.
      if (z.type === POING && g && g.phase === 2 && g.etat === ANNONCE && z.ti === z.t0 + 50) restantes.push({ type: POING, x: this.c.x, y: this.c.y, r: RAYON_ZONE_POING, t0: this.tick, ti: this.tick + 22 });
    }
    this.zones = restantes;
  }

  private avancerOndes(): void {
    if (this.ondes.length === 0) return;
    for (const o of this.ondes) {
      o.r += o.vitesse;
      if (!o.touche) {
        const d = distance(this.c.x, this.c.y, o.x, o.y);
        if (Math.abs(d - o.r) < idiv(o.epaisseur, 2) + idiv(RAYON_CHEVALIER, 2)) {
          if (this.vulnerable()) {
            o.touche = true;
            this.blesser(o.x, o.y, 1);
          } else if (this.c.esq > 0) {
            o.touche = true;
            this.ev("frole", this.c.x, this.c.y);
          }
        }
      }
    }
    this.ondes = this.ondes.filter((o) => o.r < o.rMax);
  }

  private gagner(): void {
    this.victoire = true;
    this.finTick = this.tick;
    this.zones = [];
    this.ondes = [];
    if (this.golem) this.ev("victoire", this.golem.x, this.golem.y);
  }

  // --- Les dégâts au chevalier ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
  private vulnerable(): boolean {
    return this.c.esq === 0 && this.c.degat === 0;
  }

  private contacts(): void {
    const c = this.c;
    if (!this.vulnerable()) return;
    for (const m of this.monstres) {
      if (m.hp <= 0 || m.gel > 0) continue;
      if (m.type === CHAUVE && m.etat === REPOS) continue;
      const somme = rayonDe(m.type) + RAYON_CHEVALIER;
      if (distance2(c.x, c.y, m.x, m.y) < somme * somme) {
        m.gel = 40;
        const [ux, uy] = unitaire(m.x - c.x, m.y - c.y);
        m.kx = idiv(ux * cm(30), 1024);
        m.ky = idiv(uy * cm(30), 1024);
        if (m.type === CHAUVE) {
          m.etat = REPOS;
          m.t = 0;
        }
        this.blesser(m.x, m.y, 1);
        return;
      }
    }
  }

  private blesser(sx: number, sy: number, n: number): void {
    const c = this.c;
    if (!this.vulnerable()) {
      if (c.esq > 0) this.ev("frole", c.x, c.y);
      return;
    }
    c.coeurs -= n;
    this.subis += n;
    c.degat = ARRET_DEGAT;
    const [ux, uy] = unitaire(c.x - sx, c.y - sy);
    const dx = ux === 0 && uy === 0 ? 0 : ux;
    const dy = ux === 0 && uy === 0 ? 1024 : uy;
    c.kx = idiv(dx * cm(48), 1024);
    c.ky = idiv(dy * cm(48), 1024);
    c.etat = LIBRE;
    c.t = 0;
    c.tampon = 0;
    c.reprise = 0;
    c.combo = 0;
    this.ev("degats", c.x, c.y, c.coeurs);
    if (c.coeurs <= 0) {
      if (this.immortel) {
        c.coeurs = COEURS;
        c.degat = 150;
        this.ev("sauve", c.x, c.y);
      } else {
        this.perdue = true;
        this.finTick = this.tick;
        this.ev("defaite", c.x, c.y);
      }
    }
  }

  // --- Les déplacements ------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  private deplacer(e: { x: number; y: number }, dx: number, dy: number): void {
    e.x += dx;
    e.y += dy;
    this.dansArene(e, e === this.c ? RAYON_CHEVALIER : 0);
  }

  private dansArene(e: { x: number; y: number }, rayon: number): void {
    const max = RAYON_ARENE - rayon;
    const d2 = e.x * e.x + e.y * e.y;
    if (d2 > max * max) {
      const d = isqrt(d2);
      e.x = idiv(e.x * max, d);
      e.y = idiv(e.y * max, d);
    }
  }

  private pousserHorsDuGolem(e: { x: number; y: number }, rayon = RAYON_CHEVALIER): void {
    const g = this.golem;
    if (!g || g.hp <= 0) return;
    const somme = RAYON_GOLEM + rayon;
    const dx = e.x - g.x;
    const dy = e.y - g.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= somme * somme) return;
    const d = isqrt(d2);
    const [ux, uy] = d === 0 ? [0, 1024] : unitaire(dx, dy);
    e.x = g.x + idiv(ux * somme, 1024);
    e.y = g.y + idiv(uy * somme, 1024);
    this.dansArene(e, rayon);
  }
}

/** Le recul décroît de 20 % par tick et s'éteint sous 8 unités. */
function amortir(v: number): number {
  const n = v - idiv(v, 5);
  return Math.abs(n) < 8 ? 0 : n;
}
