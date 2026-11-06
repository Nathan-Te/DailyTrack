import { Rng } from "@cdj/core";
import { COEURS, DUREE_TICKS, MAX_MONSTRES, MAX_MONSTRES_VAGUE, RAYON_ARENE, RAYON_CHAUVE, RAYON_CHEVALIER, RAYON_GELEE, RAYON_GOLEM, cm } from "./constantes";
import { coupDe, directionDe, esquiveDe, viseeDe } from "./entrees";
import type { Contenu } from "./generateur";
import { distance, distance2, idiv, isqrt, unitaire, dirVers, modDir } from "./maths";
import { PONT, SOL, caseDe, type Niveau } from "./niveau";
import { REGLAGES_DEFAUT, type Reglages } from "./reglagesSim";
import { COS, SIN } from "./trig";

// La partie de Rush : 60 Hz, tout en entiers, l'état d'un seul tenant. À chaque tick, `avancer(entree)` applique l'octet d'entrée du tick (voir `entrees.ts`) puis fait avancer le monde : le chevalier, les apparitions,
// les monstres, le golem, les zones annoncées, les ondes, les contacts. **Le même code joue la partie du joueur et la rediffusion du serveur** ; la vue (`apps/rush`) ne fait que lire cet état.
// Le hasard (apparitions, pierres) vient d'une graine du contenu et n'est tiré qu'à des ticks fixés par l'état : une rediffusion refait les mêmes tirages.
// Lot BR1b : la COURSE hors combat (la vitesse monte de ×1,6 après ~1,2 s sans frapper, sans être touché et sans ennemi alerté à moins de 10 m ; elle retombe au premier coup, à la première alerte, au premier dégât ; pas de course dans l'arène),
// des monstres à l'alerte propre (les groupes : 10 à 12 m) et des OBSTACLES cassables (ronces : 1 coup, caisses : 2 coups ; le coup final en vaut 2) qui occupent des cases du chemin tant qu'ils tiennent.
// Lot BR0c : le coup du chevalier est plus lent et plus lourd (30 ticks, le coup final 42 ; anticipation, impact, récupération ; dégâts ×1,6 et ×2,5 au coup final ; il s'engage à 40 % de sa vitesse ; recul plus fort, les monstres glissent puis titubent) ;
// les points de vie sont en dixièmes (un coup ordinaire ôte 16, la gelée en a 30). Lot BR0b : l'entrée porte une VISÉE séparée du déplacement (le chevalier regarde et frappe où il vise, il marche où il veut) ; un coup TENU enchaîne ; le rythme des ennemis est ralenti et se règle d'un coup (`reglages.rythme`).

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
  /** Lot BR1b : les ticks calmes (sans coup, sans dégât, sans ennemi alerté à moins de `courseRayon`), plafonnés à `courseDelai`. */
  calme: number;
  /** Lot BR1b : la montée de la course, de 0 (la marche) à `courseMontee` (la vitesse de course) ; il ne monte qu'en marchant. */
  elan: number;
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
  /** Lot BR1 : sa place (le camp), son état de veille — 0 au repos, 1 en alerte (il poursuit), 2 de retour — et sa laisse (unités autour de sa place ; 0 : il poursuit partout, comme dans les scénarios d'essai). */
  hx: number;
  hy: number;
  alerte: number;
  laisse: number;
  /** Lot BR1b : son rayon d'alerte propre en unités (un groupe : 10 à 12 m), ou 0 : celui de son type. */
  ra: number;
}

/** Lot BR1b : un obstacle cassable du niveau, vivant tant que `hp` > 0 ; il occupe `cases`. */
export interface ObstacleVivant {
  /** Son indice dans `niveau.obstacles`. */
  id: number;
  genre: number;
  x: number;
  y: number;
  r: number;
  hp: number;
  hpMax: number;
  /** Les ticks restants de l'éclair après un coup. */
  flash: number;
  /** Le dernier coup qui l'a touché : un coup ne touche qu'une fois. */
  coup: number;
  cases: number[];
  /** Ce qu'il contient (lot BR2) : 0, rien. */
  butin: number;
}

export interface Golem {
  x: number;
  y: number;
  hp: number;
  hpMax: number;
  phase: number;
  etat: number;
  t: number;
  /** La durée de l'annonce (pour la fraction qui avance). Avec deux coups (phase 2 : deux poings, deux ondes) elle les compte tous les deux. */
  duree: number;
  /** Le tick (depuis le début de l'annonce) du premier impact : `duree` pour une seule frappe. */
  t1: number;
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
  /** 0 pour le premier coup d'une attaque, 1 pour le second (phase 2). */
  rang: number;
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

export type GenreEvenement = "coup" | "touche" | "mort" | "esquive" | "frole" | "degats" | "annonce" | "impact" | "onde" | "phase2" | "victoire" | "defaite" | "apparition" | "bloque" | "sauve" | "alerte" | "barriere" | "eveil" | "obstacle" | "brise";
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
const DUREE_TAMPON = 16;
const DUREE_TAMPON_ESQUIVE = 6;
const DUREE_REPRISE = 30;
/** La phase active d'un coup (ticks après l'impact) : le chevalier s'engage tant qu'elle dure. */
const PHASE_ACTIVE = 4;
/** Les ticks où une cible touchée titube (elle ne fait rien) après avoir glissé : le coup ordinaire, le coup final. */
const TITUBE = [16, 16, 32] as const;
/** Le dégât de base (un « point » du jeu) : un coup ordinaire en ôte `degats` % (160 % → 16). */
const POINT = 10;
const RAYON_ZONE_POING = cm(250);
const RAYON_ZONE_PIERRE = cm(150);
const RAYON_ONDE = cm(760);
const VIE_GELEE = 30;
const VIE_CHAUVE = 10;
/** Le scénario `mannequin` : six gelées qui ne bougent pas (positions en cm, chacune rentre chez elle après un coup) et un golem qui ne frappe pas ; rien ne meurt. */
const MANNEQUINS: readonly (readonly [number, number])[] = [[-330, 330], [-170, 250], [0, 210], [170, 250], [330, 330], [0, 60]];
const GOLEM_MANNEQUIN: readonly [number, number] = [0, -450];
const ARRET_DEGAT = 90;

// Le rythme des ennemis (lot BR0b : le prototype BR0 était trop rapide). Toutes ces durées sont des ticks et toutes ces vitesses des cm/s AU RYTHME 100 % ; `reglages.rythme` les met à l'échelle (`dur`, `vit`).
/** L'annonce de chaque attaque du golem (phase 1, phase 2), second coup compris ; le second poing est posé à l'impact du premier. */
const ANNONCE_GOLEM: readonly [number, number] = [70, 50];
/** La récupération après chaque attaque, sans frapper : la fenêtre pour taper. */
const RECUP_GOLEM = { [POING]: [90, 60], [ONDE]: [100, 65], [PIERRES]: [80, 55] } as const;
/** Les deux ondes de la phase 2 sont séparées de ce nombre de ticks (assez pour refaire une esquive). */
const ECART_ONDES = 70;
const ECART_PIERRES = 12;
/** La gelée s'écrase (annonce) puis bondit puis se repose. */
const GELEE_ANNONCE = 30;
const GELEE_BOND = 24;
const GELEE_REPOS = 10;
const GELEE_VITESSE = 336;
/** La direction du bond est verrouillée un peu avant qu'il parte : on a le temps de se décaler. */
const GELEE_VERROU = 6;
/** La chauve-souris tourne, s'annonce (45), plonge (34), se repose (60). */
const CHAUVE_ANNONCE = 45;
const CHAUVE_PLONGEON = 34;
const CHAUVE_REPOS = 60;
const CHAUVE_VITESSE = 392;
const CHAUVE_VITESSE_PLONGEON = 805;
/** Lot BR1 : un monstre du niveau remarque le chevalier à ce rayon (autour de lui) ; il le lâche quand il s'est éloigné de sa place de `LAISSE` ou que le chevalier est à deux fois le rayon d'alerte. */
export const ALERTE_GELEE = cm(700);
export const ALERTE_CHAUVE = cm(1000);
export const LAISSE = cm(2000);
/** Le chevalier est dans l'arène (la barrière se referme derrière lui) quand il est à cette distance du bord. */
const ENTREE_ARENE = cm(200);
/** Une vague d'arène : la pause avant la suivante quand le terrain est presque vide. */
const PAUSE_VAGUE = 180;
/** Le moment de la partie figée de la vitrine (le chrono de `cible-ia.png`). */
const TICK_VITRINE = 1306;

const rayonDe = (type: number): number => (type === GELEE ? RAYON_GELEE : RAYON_CHAUVE);

/** Les durées des ennemis, mises au rythme de la partie : ce que le rendu lit pour animer (jamais lu par la simulation autrement). */
export interface Durees {
  geleeAnnonce: number;
  geleeBond: number;
  geleeCycle: number;
  chauveAnnonce: number;
  chauvePlongeon: number;
}

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
  /** Le rythme des ennemis, en %. */
  private readonly rt: number;
  /** Les durées des ennemis, au rythme de la partie. */
  readonly durees: Durees;
  /** Les ticks depuis que l'arène s'est presque vidée (−1 : elle ne l'est pas) : la pause entre deux vagues. */
  private videDepuis = -1;
  /** Lot BR1 : le niveau du jour (grille), le centre de l'arène, le tick où la barrière s'est refermée (−1 : ouverte) et les cases de la porte. */
  readonly niveau: Niveau | null;
  /** Lot BR1b : les obstacles du niveau (ceux qui ont cédé sont retirés) et les cases qu'ils occupent. */
  obstacles: ObstacleVivant[] = [];
  /** Un octet par case : 1 tant qu'un obstacle la tient (un tableau, pas un ensemble : `marchable` est appelé des millions de fois dans un rejeu). */
  private bloquees: Uint8Array;
  readonly ax: number;
  readonly ay: number;
  barriere = -1;
  private readonly porte: ReadonlySet<number>;

  constructor(
    readonly contenu: Contenu,
    readonly reglages: Reglages = REGLAGES_DEFAUT,
    readonly journal = false,
  ) {
    this.rng = new Rng(contenu.graine);
    this.niveau = contenu.niveau;
    this.ax = this.niveau ? this.niveau.arene.x : 0;
    this.ay = this.niveau ? this.niveau.arene.y : 0;
    this.porte = new Set(this.niveau ? this.niveau.porte : []);
    this.bloquees = new Uint8Array(this.niveau ? this.niveau.l * this.niveau.h : 0);
    this.vit = idiv(cm(reglages.vitesse), 60);
    this.rt = reglages.rythme;
    this.durees = { geleeAnnonce: this.dur(GELEE_ANNONCE), geleeBond: this.dur(GELEE_BOND), geleeCycle: this.dur(GELEE_ANNONCE) + this.dur(GELEE_BOND) + this.dur(GELEE_REPOS), chauveAnnonce: this.dur(CHAUVE_ANNONCE), chauvePlongeon: this.dur(CHAUVE_PLONGEON) };
    this.immortel = contenu.scenario === "arene" || contenu.scenario === "vitrine" || contenu.scenario === "mannequin";
    this.c = { x: this.niveau ? this.niveau.depart.x : 0, y: this.niveau ? this.niveau.depart.y : cm(520), dir: this.niveau ? this.niveau.depart.dir : 96, coeurs: COEURS, etat: LIBRE, t: 0, combo: 0, tampon: 0, tampEsq: 0, reprise: 0, attente: 0, esq: 0, degat: 0, kx: 0, ky: 0, marche: false, calme: 0, elan: 0 };
    if (contenu.scenario === "arene") this.golem = null;
    else {
      const hpMax = reglages.golemVie;
      const [gx, gy] = contenu.scenario === "mannequin" ? GOLEM_MANNEQUIN : [0, -300];
      // Dans le niveau, le golem dort au fond de l'arène, du côté opposé à l'entrée.
      const n = this.niveau;
      const px = n ? n.arene.x - idiv(COS[n.arene.dir]! * cm(300), 1024) : cm(gx);
      const py = n ? n.arene.y - idiv(SIN[n.arene.dir]! * cm(300), 1024) : cm(gy);
      this.golem = { x: px, y: py, hp: contenu.phase2 ? idiv(hpMax, 2) : hpMax, hpMax, phase: contenu.phase2 ? 2 : 1, etat: MARCHE, t: 0, duree: 0, t1: 0, attaque: 0, repos: this.dur(contenu.phase2 ? 50 : 150), compteur: 0, flash: 0, dir: n ? n.arene.dir : 32, recup: 0, coup: 0 };
    }
    if (contenu.scenario === "arene") {
      this.apparaitre(contenu.monstres > 0 ? Math.min(contenu.monstres, 6) : 4);
      this.vague = 1;
    }
    if (this.niveau) this.monterNiveau(this.niveau);
    if (contenu.scenario === "vitrine") this.monterVitrine();
    if (contenu.scenario === "mannequin") this.monterMannequin();
  }

  /** Une durée en ticks au rythme de la partie (arrondie, au moins 1) : plus le rythme est haut, plus c'est court. */
  dur(n: number): number {
    return Math.max(1, idiv(n * 100 + idiv(this.rt, 2), this.rt));
  }
  /** Une vitesse en cm/s → unités par tick au rythme de la partie. */
  private vitesse(cmParSeconde: number): number {
    return idiv(cm(cmParSeconde) * this.rt, 6000);
  }

  /** Les monstres du niveau : chacun à sa place, au repos, avec sa laisse. */
  private monterNiveau(n: Niveau): void {
    for (const m of n.monstres) {
      const gelee = m.type === GELEE;
      this.monstres.push({ id: this.prochainId++, type: m.type, x: m.x, y: m.y, kx: 0, ky: 0, hp: gelee ? VIE_GELEE : VIE_CHAUVE, flash: 0, etat: ORBITE, t: 0, age: -100, a: this.rng.int(128), sens: this.rng.int(2) === 0 ? 1 : -1, cx: 0, cy: 0, gel: 0, duree: 120 + this.rng.int(120), coup: 0, hx: m.x, hy: m.y, alerte: 0, laisse: LAISSE, ra: m.alerte });
    }
    n.obstacles.forEach((o, id) => {
      this.obstacles.push({ id, genre: o.genre, x: o.x, y: o.y, r: o.r, hp: o.coups, hpMax: o.coups, flash: 0, coup: 0, cases: o.cases, butin: o.butin });
      for (const k of o.cases) this.bloquees[k] = 1;
    });
  }

  /** Le golem dort tant que la barrière de l'arène est ouverte. */
  get golemEveille(): boolean {
    return !this.niveau || this.barriere >= 0;
  }

  /** La scène figée de la vitrine : la composition de `docs/rush/maquettes/cible-ia.png` (le golem au centre avec un cercle d'annonce, le chevalier à gauche, quatre gelées, deux chauves-souris). Le jeu ne la fait pas avancer. */
  private monterVitrine(): void {
    this.tick = TICK_VITRINE;
    const g = this.golem!;
    g.x = cm(60);
    g.y = -cm(150);
    g.hp = idiv(g.hpMax * 3, 5);
    g.etat = ANNONCE;
    g.attaque = POING;
    g.duree = g.t1 = this.dur(ANNONCE_GOLEM[0]);
    g.t = g.duree + 1; // le poing vient de s'abattre (le golem de la cible a les poings au sol) ; le cercle, lui, est annoncé aux trois cinquièmes
    g.dir = 32;
    this.zones.push({ type: POING, x: cm(60), y: cm(50), r: RAYON_ZONE_POING, t0: this.tick - idiv(g.duree * 6, 10), ti: this.tick + g.duree - idiv(g.duree * 6, 10), rang: 0 });
    this.c.x = -cm(400);
    this.c.y = cm(250);
    this.c.dir = 52; // il regarde vers le bas à gauche, l'épée devant lui : son visage se voit
    this.c.marche = true;
    this.monstres = [];
    const bete = (type: number, x: number, y: number, t: number, a = 0): void => {
      this.monstres.push({ id: this.prochainId++, type, x: cm(x), y: cm(y), kx: 0, ky: 0, hp: type === GELEE ? VIE_GELEE : VIE_CHAUVE, flash: 0, etat: ORBITE, t, age: 0, a, sens: 1, cx: 0, cy: 0, gel: 0, duree: 999, coup: 0, hx: cm(x), hy: cm(y), alerte: 1, laisse: 0, ra: 0 });
    };
    bete(GELEE, -140, -520, 12);
    bete(GELEE, -560, 330, 40);
    bete(GELEE, 700, 20, 3);
    bete(GELEE, 480, 560, 33);
    bete(CHAUVE, -490, -300, 0, 20);
    bete(CHAUVE, 770, -270, 0, 90);
  }

  /** Le scénario `mannequin` (lot BR0c) : le chevalier face à six gelées immobiles et à un golem qui ne frappe pas, pour juger le coup, l'impact et l'enchaînement tenu. Rien ne meurt, rien ne blesse. */
  private monterMannequin(): void {
    this.c.y = cm(520);
    this.c.dir = 96;
    for (const [x, y] of MANNEQUINS) this.monstres.push({ id: this.prochainId++, type: GELEE, x: cm(x), y: cm(y), kx: 0, ky: 0, hp: VIE_GELEE, flash: 0, etat: ORBITE, t: 0, age: -100, a: 0, sens: 1, cx: 0, cy: 0, gel: 0, duree: 999, coup: 0, hx: cm(x), hy: cm(y), alerte: 1, laisse: 0, ra: 0 });
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
    nombre(this.barriere);
    objet(this.c);
    objet(this.golem);
    for (const m of this.monstres) objet(m);
    for (const z of this.zones) objet(z);
    for (const o of this.ondes) objet(o);
    for (const o of this.obstacles) {
      nombre(o.id);
      nombre(o.hp);
      nombre(o.flash);
    }
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
    this.mouvementChevalier(directionDe(entree), viseeDe(entree), coupFront, coupDe(entree), esquiveFront);
    if (this.niveau && this.barriere < 0 && distance(this.c.x, this.c.y, this.ax, this.ay) < RAYON_ARENE - ENTREE_ARENE) this.fermerBarriere();
    this.apparitions();
    for (const m of this.monstres) this.mouvementMonstre(m);
    for (const o of this.obstacles) if (o.flash > 0) o.flash--;
    this.separer();
    if (this.golem && this.golemEveille) this.mouvementGolem(this.golem);
    this.resoudreZones();
    this.avancerOndes();
    this.contacts();
    this.monstres = this.monstres.filter((m) => m.hp > 0);
    if (this.golem && this.golem.hp <= 0 && !this.victoire) this.gagner();
  }

  /** Le chevalier entre dans l'arène : la barrière se referme derrière lui et le golem se réveille (il rugit, invulnérable, un instant). */
  private fermerBarriere(): void {
    const n = this.niveau!;
    this.barriere = this.tick;
    this.ev("barriere", n.arene.ex, n.arene.ey);
    const g = this.golem;
    if (g && g.hp > 0) {
      g.etat = RUGIT;
      g.t = 0;
      g.duree = this.dur(60);
      this.ev("eveil", g.x, g.y);
    }
  }

  // --- Le chevalier ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  private mouvementChevalier(direction: number, visee: number, coupFront: boolean, coupTenu: boolean, esquiveFront: boolean): void {
    const c = this.c;
    if (c.tampon > 0) c.tampon--;
    // Un appui est gardé en mémoire ; un coup TENU l'est à chaque tick : il enchaîne les trois coups en boucle, à la cadence du combo.
    if (coupFront || coupTenu) c.tampon = DUREE_TAMPON;
    if (c.tampEsq > 0) c.tampEsq--;
    if (esquiveFront) c.tampEsq = DUREE_TAMPON_ESQUIVE;
    if (c.attente > 0) c.attente--;
    if (c.esq > 0) c.esq--;
    if (c.degat > 0) c.degat--;
    if (c.reprise > 0 && --c.reprise === 0 && c.etat === LIBRE) c.combo = 0;
    c.marche = false;
    this.majCourse(direction >= 0 && c.etat === LIBRE);

    // L'esquive coupe un coup à n'importe quel moment (survivre passe avant) ; un appui un peu trop tôt est gardé en mémoire.
    const dureeCoup = this.dureeCoup(c.combo);
    if (c.tampEsq > 0 && c.attente === 0 && c.etat !== ESQUIVE) {
      c.tampEsq = 0;
      // L'esquive part dans la direction du déplacement ; à l'arrêt, vers la visée ; sinon où le chevalier regarde.
      const d = direction >= 0 ? direction * 4 : visee >= 0 ? visee * 4 : c.dir;
      c.dir = d;
      c.etat = ESQUIVE;
      c.t = 0;
      c.esq = this.reglages.fenetreEsquive;
      c.attente = ATTENTE_ESQUIVE;
      c.tampon = 0;
      this.ev("esquive", c.x, c.y, d);
    }

    if (c.etat === ESQUIVE) {
      const v = idiv(this.vit * 29, 10); // la marche est plus lente depuis BR0c (−10 %) : la course de l'esquive garde sa longueur
      this.deplacer(c, idiv(COS[c.dir]! * v, 1024), idiv(SIN[c.dir]! * v, 1024));
      c.marche = true;
      if (++c.t >= DUREE_ESQUIVE) {
        c.etat = LIBRE;
        c.t = 0;
      }
    } else if (c.etat === COUP) {
      // Le coup (lot BR0c) : anticipation (jusqu'à l'impact), phase active (4 ticks), récupération jusqu'au bout. Il s'engage : à `engagement` % de sa vitesse, dans la direction tenue, sinon vers où il frappe tant que dure la phase active.
      const impact = this.impactCoup(c.combo);
      const v = idiv(this.vit * this.reglages.engagement, 100);
      if (direction >= 0) {
        this.deplacer(c, idiv(COS[direction * 4]! * v, 1024), idiv(SIN[direction * 4]! * v, 1024));
        c.marche = true;
      } else if (c.t <= impact + PHASE_ACTIVE) {
        const elan = c.combo === 2 ? idiv(v * 3, 2) : v;
        this.deplacer(c, idiv(COS[c.dir]! * elan, 1024), idiv(SIN[c.dir]! * elan, 1024));
      }
      if (c.t === impact) this.frapper();
      c.t++;
      if (c.t >= dureeCoup) {
        // Le coup tenu (ou un appui gardé en mémoire) enchaîne à la fin du coup, jamais avant : l'enchaînement garde le rythme du coup.
        if (c.tampon > 0) this.commencerCoup((c.combo + 1) % 3, direction, visee);
        else {
          c.etat = LIBRE;
          c.t = 0;
          c.reprise = DUREE_REPRISE;
        }
      }
    } else {
      // Libre : marcher, ou commencer un coup. Avec une visée, le chevalier regarde où il vise (même à l'arrêt) et marche où il veut ; sans visée, il regarde où il va.
      if (visee >= 0) c.dir = visee * 4;
      if (c.tampon > 0) this.commencerCoup(c.reprise > 0 ? (c.combo + 1) % 3 : 0, direction, visee);
      else if (direction >= 0) {
        const marche = direction * 4;
        if (visee < 0) c.dir = marche;
        c.marche = true;
        const v = this.vitesseCourse();
        this.deplacer(c, idiv(COS[marche]! * v, 1024), idiv(SIN[marche]! * v, 1024));
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

  /**
   * La course hors combat (lot BR1b), une fois par tick : le chevalier se calme (`calme` compte les ticks tranquilles) ; passé `courseDelai`, sa vitesse monte en `courseMontee` ticks (tant qu'il marche) jusqu'à `courseFacteur` % de la marche.
   * Tout ce qui est du combat la coupe d'un coup : un coup (`commencerCoup`), un dégât (`blesser`), un ennemi qui s'alerte (`veille`), un ennemi déjà alerté à moins de `courseRayon`. Pas de course hors du niveau, ni une fois la barrière fermée.
   */
  private majCourse(marche: boolean): void {
    const c = this.c;
    const r = this.reglages;
    if (!this.niveau || this.barriere >= 0 || c.etat === COUP) {
      c.calme = 0;
      c.elan = 0;
      return;
    }
    const rayon = cm(r.courseRayon);
    const menace = this.monstres.some((m) => m.hp > 0 && m.alerte === 1 && distance2(m.x, m.y, c.x, c.y) < rayon * rayon);
    if (menace) {
      c.calme = 0;
      c.elan = 0;
    } else if (c.calme < r.courseDelai) c.calme++;
    else if (marche && c.elan < r.courseMontee) c.elan++;
  }

  /** La vitesse de marche du tick, en unités par tick : la marche, ou la course qui monte (jamais lue par la vue autrement que par `elan`). */
  private vitesseCourse(): number {
    const c = this.c;
    const r = this.reglages;
    if (c.elan <= 0) return this.vit;
    return idiv(this.vit * (100 * r.courseMontee + (r.courseFacteur - 100) * c.elan), 100 * r.courseMontee);
  }

  /** La course en cours, de 0 (la marche) à 100 (la pleine course) : la vue penche le chevalier et trace les lignes de vitesse d'après elle. */
  get course(): number {
    return idiv(this.c.elan * 100, Math.max(1, this.reglages.courseMontee));
  }

  dureeCoup(s: number): number {
    return s === 2 ? idiv(this.reglages.cadence * 14, 10) : this.reglages.cadence;
  }
  /** Le tick de l'impact dans le coup : la fin de l'anticipation (le coup final prend 4/3 de temps pour lever l'épée). */
  impactCoup(s: number): number {
    return Math.max(2, s === 2 ? idiv(this.reglages.anticipation * 4, 3) : this.reglages.anticipation);
  }
  /** Les dégâts d'un coup (en dixièmes de point de vie) : ordinaire `degats` % du point, le coup final `coupFinal` % de cela. */
  degatsCoup(s: number): number {
    const base = idiv(POINT * this.reglages.degats, 100);
    return s === 2 ? idiv(base * this.reglages.coupFinal, 100) : base;
  }

  private commencerCoup(s: number, direction: number, visee: number): void {
    const c = this.c;
    c.etat = COUP;
    c.t = 0;
    c.combo = s;
    c.tampon = 0;
    c.reprise = 0;
    c.calme = 0;
    c.elan = 0;
    this.coupId++;
    // Il frappe où le joueur VISE (la souris, le stick droit) ; sans visée, vers ce que le joueur tient ; sans direction (ou presque en face d'un ennemi), vers l'ennemi le plus proche (visée assistée).
    const cible = this.plusProche(cm(420));
    if (visee >= 0) c.dir = visee * 4;
    else if (direction >= 0) {
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
    for (const o of this.obstacles) essayer(o.x, o.y, o.r);
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
    const degats = this.degatsCoup(s);
    const force = idiv(cm(this.reglages.recul) * (s === 2 ? 20 : 10), 10);
    const mannequin = this.contenu.scenario === "mannequin";
    for (const m of this.monstres) {
      if (m.hp <= 0 || m.coup === this.coupId || !dans(m.x, m.y, rayonDe(m.type))) continue;
      m.coup = this.coupId;
      if (m.laisse > 0 && m.alerte !== 1) {
        m.alerte = 1;
        m.t = 0;
      }
      m.hp -= degats;
      m.flash = 7;
      m.gel = Math.max(m.gel, TITUBE[s]!); // elle glisse (le recul) puis titube
      const [ux, uy] = unitaire(m.x - c.x, m.y - c.y);
      const ex = ux === 0 && uy === 0 ? COS[c.dir]! : ux;
      const ey = ux === 0 && uy === 0 ? SIN[c.dir]! : uy;
      m.kx = idiv(ex * force, 1024);
      m.ky = idiv(ey * force, 1024);
      if (m.type === CHAUVE && (m.etat === PLONGEON || m.etat === ANNONCE_PLONGEON)) {
        m.etat = REPOS;
        m.t = 0;
      }
      this.ev("touche", m.x, m.y, s, m.type);
      if (mannequin) m.hp = VIE_GELEE; // le mannequin ne meurt pas
      if (m.hp <= 0) {
        this.tues++;
        this.ev("mort", m.x, m.y, m.type, s);
      }
    }
    // Lot BR1b : un obstacle cassable cède en 1 ou 2 coups (le coup final en vaut 2) ; ce qu'il contient (lot BR2) tombe à sa place.
    for (const o of this.obstacles) {
      if (o.coup === this.coupId || !dans(o.x, o.y, o.r)) continue;
      o.coup = this.coupId;
      o.hp -= s === 2 ? 2 : 1;
      o.flash = 7;
      this.ev("obstacle", o.x, o.y, s, o.genre);
      if (o.hp <= 0) {
        for (const k of o.cases) this.bloquees[k] = 0;
        this.ev("brise", o.x, o.y, o.genre, o.id);
      }
    }
    this.obstacles = this.obstacles.filter((o) => o.hp > 0);
    const g = this.golem;
    if (g && g.hp > 0 && g.coup !== this.coupId && dans(g.x, g.y, RAYON_GOLEM)) {
      g.coup = this.coupId;
      if (g.etat === RUGIT) this.ev("bloque", g.x, g.y);
      else {
        g.hp -= degats;
        g.flash = 7;
        const phase2 = g.phase === 1 && g.hp > 0 && g.hp * 2 <= g.hpMax;
        this.ev("touche", g.x, g.y, s, phase2 ? 3 : 2); // b : 2 = le golem, 3 = le golem qui passe en phase 2 par ce coup
        if (mannequin) g.hp = g.hpMax; // le mannequin ne meurt pas
        else if (phase2) this.entrerPhase2(g);
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
      this.monstres.push({ id: this.prochainId++, type, x, y, kx: 0, ky: 0, hp: type === GELEE ? VIE_GELEE : VIE_CHAUVE, flash: 0, etat: ORBITE, t, age: this.tick, a: dirVers(x - this.c.x, y - this.c.y), sens: this.rng.int(2) === 0 ? 1 : -1, cx: 0, cy: 0, gel: 0, duree: 120 + this.rng.int(120), coup: 0, hx: x, hy: y, alerte: 1, laisse: 0, ra: 0 });
      this.ev("apparition", x, y, type);
    }
  }

  private apparitions(): void {
    const k = this.contenu.scenario;
    if (k === "arene") {
      if (this.contenu.monstres > 0) {
        // Le test de charge : l'arène garde `monstres` monstres en vie, cinq de plus toutes les 1,5 s.
        if (this.tick % 90 === 0) {
          this.vague++;
          if (this.monstres.length < this.contenu.monstres) this.apparaitre(Math.min(5, this.contenu.monstres - this.monstres.length));
        }
        return;
      }
      // Par défaut : des vagues (au plus `MAX_MONSTRES_VAGUE` à la fois). La suivante ne vient qu'après une pause, quand le terrain est presque vide.
      if (this.monstres.length > 1) this.videDepuis = -1;
      else if (this.videDepuis < 0) this.videDepuis = this.tick;
      else if (this.tick - this.videDepuis >= this.dur(PAUSE_VAGUE)) {
        this.vague++;
        this.apparaitre(Math.min(MAX_MONSTRES_VAGUE - this.monstres.length, 3 + this.vague));
        this.videDepuis = -1;
      }
    }
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
    if (m.laisse > 0) this.veille(m);
    if (this.contenu.scenario === "mannequin") {
      // Le mannequin ne bouge pas : après un coup (glissade, puis titubement) il rentre à sa place, sans attaquer.
      const [hx, hy] = MANNEQUINS[(m.id - 1) % MANNEQUINS.length]!;
      const d = distance(m.x, m.y, cm(hx), cm(hy));
      if (d > 0) {
        const v = Math.min(d, this.vitesse(180));
        m.x += idiv((cm(hx) - m.x) * v, d);
        m.y += idiv((cm(hy) - m.y) * v, d);
      }
      m.t = 0;
      return;
    }
    if (m.type === GELEE) {
      // Au repos (lot BR1), elle reste à sa place. En alerte elle s'écrase (annonce), vise juste avant de bondir, bondit, se repose ; de retour, elle bondit vers sa place.
      if (m.laisse > 0 && m.alerte === 0) {
        m.t = 0;
        return;
      }
      const but = m.alerte === 2 ? { x: m.hx, y: m.hy } : c;
      const d = this.durees;
      m.t = (m.t + 1) % d.geleeCycle;
      if (m.t === Math.max(1, d.geleeAnnonce - GELEE_VERROU)) {
        const [ux, uy] = unitaire(but.x - m.x, but.y - m.y);
        m.cx = ux;
        m.cy = uy;
      }
      if (m.t >= d.geleeAnnonce && m.t < d.geleeAnnonce + d.geleeBond) {
        const v = this.vitesse(GELEE_VITESSE);
        this.deplacer(m, idiv(m.cx * v, 1024), idiv(m.cy * v, 1024));
      }
      return;
    }
    // La chauve-souris.
    m.t++;
    if (m.etat === ORBITE) {
      if (m.t % 2 === 0) m.a = modDir(m.a + m.sens);
      // Elle tourne autour du chevalier (en alerte) ; au repos, autour de sa place, de près ; de retour, elle rentre.
      const sur = m.laisse === 0 || m.alerte === 1;
      const rayon = sur ? cm(450) : m.alerte === 2 ? 0 : cm(150);
      const tx = (sur ? c.x : m.hx) + idiv(COS[m.a]! * rayon, 1024);
      const ty = (sur ? c.y : m.hy) + idiv(SIN[m.a]! * rayon, 1024);
      const d = distance(m.x, m.y, tx, ty);
      const v = Math.min(d, this.vitesse(CHAUVE_VITESSE));
      if (d > 0) this.deplacer(m, idiv((tx - m.x) * v, d), idiv((ty - m.y) * v, d));
      if (sur && m.t >= m.duree) {
        m.etat = ANNONCE_PLONGEON;
        m.t = 0;
      }
    } else if (m.etat === ANNONCE_PLONGEON) {
      if (m.t >= this.durees.chauveAnnonce) {
        const [ux, uy] = unitaire(c.x - m.x, c.y - m.y);
        m.cx = ux;
        m.cy = uy;
        m.etat = PLONGEON;
        m.t = 0;
      }
    } else if (m.etat === PLONGEON) {
      const v = this.vitesse(CHAUVE_VITESSE_PLONGEON);
      this.deplacer(m, idiv(m.cx * v, 1024), idiv(m.cy * v, 1024));
      if (m.t >= this.durees.chauvePlongeon) {
        m.etat = REPOS;
        m.t = 0;
      }
    } else if (m.t >= this.dur(CHAUVE_REPOS)) {
      m.etat = ORBITE;
      m.t = 0;
      m.a = dirVers(m.x - c.x, m.y - c.y);
      m.duree = 120 + this.rng.int(120);
    }
  }

  /** La veille d'un monstre du niveau : il remarque le chevalier à son rayon d'alerte, le poursuit tant qu'il reste dans sa laisse, puis rentre à sa place (et ne regarde plus le chevalier avant d'y être). */
  private veille(m: Monstre): void {
    const c = this.c;
    const dc = distance(m.x, m.y, c.x, c.y);
    const alerte = m.ra > 0 ? m.ra : m.type === CHAUVE ? ALERTE_CHAUVE : ALERTE_GELEE;
    if (m.alerte === 0) {
      if (this.barriere < 0 && dc < alerte) {
        m.alerte = 1;
        m.t = 0;
        c.calme = 0; // lot BR1b : un ennemi qui s'alerte coupe la course
        c.elan = 0;
        this.ev("alerte", m.x, m.y, m.type);
      }
    } else if (m.alerte === 1) {
      if (distance(m.x, m.y, m.hx, m.hy) > m.laisse || dc > alerte * 2 || this.barriere >= 0) {
        m.alerte = 2;
        if (m.type === CHAUVE) {
          m.etat = ORBITE;
          m.t = 0;
        }
      }
    } else if (distance(m.x, m.y, m.hx, m.hy) < cm(100)) {
      m.alerte = 0;
      m.t = 0;
      if (m.type === CHAUVE) m.etat = ORBITE;
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
        if (this.niveau && (a.type === CHAUVE || b.type === CHAUVE)) continue; // dans le niveau, la chauve-souris vole par-dessus les autres
        const somme = ra + rayonDe(b.type);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d2 = dx * dx + dy * dy;
        if (d2 >= somme * somme) continue;
        const d = isqrt(d2);
        const recouvre = idiv(somme - d, 2);
        const [ux, uy] = d === 0 ? [1024, 0] : unitaire(dx, dy);
        this.pousserMonstre(a, -idiv(ux * recouvre, 1024), -idiv(uy * recouvre, 1024));
        this.pousserMonstre(b, idiv(ux * recouvre, 1024), idiv(uy * recouvre, 1024));
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
    g.duree = this.dur(100);
    this.zones = [];
    this.zones.push({ type: ONDE, x: g.x, y: g.y, r: RAYON_ONDE, t0: this.tick, ti: this.tick + this.dur(70), rang: 0 });
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
        g.repos = this.dur(g.phase === 2 ? 60 : this.niveau ? 100 : 60);
      }
      return;
    }
    if (g.etat === ANNONCE) {
      if (g.t >= g.duree) {
        g.etat = RECUPERE;
        g.t = 0;
        g.recup = this.dur(RECUP_GOLEM[g.attaque as 0 | 1 | 2][g.phase === 2 ? 1 : 0]);
      }
      return;
    }
    if (g.etat === RECUPERE) {
      if (g.t >= g.recup) {
        g.etat = MARCHE;
        g.t = 0;
        g.repos = this.dur(idiv(this.reglages.golemCadence * (g.phase === 2 ? 62 : 100), 100));
      }
      return;
    }
    // Il marche vers le chevalier, puis choisit son attaque.
    const dx = c.x - g.x;
    const dy = c.y - g.y;
    const d = isqrt(dx * dx + dy * dy);
    g.dir = dirVers(dx, dy);
    if (this.contenu.scenario === "mannequin") return; // le mannequin ne marche pas et ne frappe pas : il regarde le chevalier
    if (d > RAYON_GOLEM + RAYON_CHEVALIER + cm(60)) {
      const v = this.vitesse(g.phase === 2 ? 150 : 105);
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
    const annonce = this.dur(ANNONCE_GOLEM[g.phase === 2 ? 1 : 0]);
    g.t1 = annonce;
    if (a === POING) {
      // Le cercle est posé là où le chevalier se tient : il a le temps de partir.
      const tx = c.x;
      const ty = c.y;
      this.zones.push({ type: POING, x: tx, y: ty, r: RAYON_ZONE_POING, t0: maintenant, ti: maintenant + annonce, rang: 0 });
      // Phase 2 : le second coup est annoncé à l'impact du premier, sur le chevalier (voir `resoudreZones`), avec la même annonce.
      g.duree = g.phase === 2 ? annonce * 2 : annonce;
      this.ev("annonce", tx, ty, POING);
    } else if (a === ONDE) {
      this.zones.push({ type: ONDE, x: g.x, y: g.y, r: RAYON_ONDE, t0: maintenant, ti: maintenant + annonce, rang: 0 });
      g.duree = g.phase === 2 ? annonce + this.dur(ECART_ONDES) : annonce;
      this.ev("annonce", g.x, g.y, ONDE);
    } else {
      const n = g.phase === 2 ? 5 : 3;
      const ecart = this.dur(ECART_PIERRES);
      for (let i = 0; i < n; i++) {
        let x = c.x;
        let y = c.y;
        if (i > 0) {
          const ang = this.rng.int(128);
          const r = cm(200) + this.rng.int(cm(450));
          x += idiv(COS[ang]! * r, 1024);
          y += idiv(SIN[ang]! * r, 1024);
          const dx = x - this.ax;
          const dy = y - this.ay;
          const d = isqrt(dx * dx + dy * dy);
          const max = RAYON_ARENE - cm(100);
          if (d > max) {
            x = this.ax + idiv(dx * max, d);
            y = this.ay + idiv(dy * max, d);
          }
        }
        this.zones.push({ type: PIERRES, x, y, r: RAYON_ZONE_PIERRE, t0: maintenant, ti: maintenant + annonce + i * ecart, rang: 0 });
      }
      g.duree = annonce + (n - 1) * ecart;
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
        this.ondes.push({ x: z.x, y: z.y, r: RAYON_GOLEM, vitesse: this.vOnde(), epaisseur: cm(110), rMax: z.r + cm(80), touche: false });
        this.ev("onde", z.x, z.y);
        // Phase 2 : une seconde onde, `ECART_ONDES` ticks plus tard (plus que l'attente de l'esquive : elle doit pouvoir se refaire).
        if (g && g.phase === 2 && g.etat === ANNONCE && g.attaque === ONDE && z.rang === 0) restantes.push({ type: ONDE, x: z.x, y: z.y, r: z.r, t0: this.tick, ti: this.tick + this.dur(ECART_ONDES), rang: 1 });
        continue;
      }
      this.ev("impact", z.x, z.y, z.type, z.r);
      if (distance2(this.c.x, this.c.y, z.x, z.y) < z.r * z.r) this.blesser(z.x, z.y, 1);
      // Phase 2 : le second coup de poing est annoncé sur le chevalier, là où il se tient à l'impact du premier, avec la même annonce.
      if (z.type === POING && g && g.phase === 2 && g.etat === ANNONCE && z.rang === 0) restantes.push({ type: POING, x: this.c.x, y: this.c.y, r: RAYON_ZONE_POING, t0: this.tick, ti: this.tick + g.t1, rang: 1 });
    }
    this.zones = restantes;
  }

  /** La vitesse d'une onde du golem, en unités par tick (au rythme de la partie) : le pilote la lit. */
  vOnde(): number {
    return this.vitesse(950);
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
    if (!this.vulnerable() || this.contenu.scenario === "mannequin") return;
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
    c.calme = 0;
    c.elan = 0;
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
  /**
   * Un déplacement. Sans niveau (les scénarios) : le disque de l'arène. Dans le niveau (lot BR1) : la GRILLE — le chevalier et les gelées glissent le long des murs, du vide et des bords de pont (un axe après l'autre), la chauve-souris vole
   * par-dessus — puis, une fois la barrière refermée, le disque de l'arène retient le chevalier (et ce qui est dans l'arène).
   */
  private deplacer(e: { x: number; y: number }, dx: number, dy: number): void {
    if (!this.niveau) {
      e.x += dx;
      e.y += dy;
      this.dansArene(e, e === this.c ? RAYON_CHEVALIER : 0);
      return;
    }
    if (e === this.c) {
      if (this.barriere >= 0) {
        e.x += dx;
        e.y += dy;
        this.dansArene(e, RAYON_CHEVALIER);
      } else this.glisser(e, dx, dy, RAYON_CHEVALIER);
      return;
    }
    const m = e as Monstre;
    if (m.type === CHAUVE) {
      e.x += dx;
      e.y += dy;
    } else this.glisser(e, dx, dy, RAYON_GELEE);
    if (this.barriere >= 0) this.dansArene(e, 0);
  }

  /** Les monstres qui se repoussent : dans le niveau, un monstre au sol ne traverse pas les murs. */
  private pousserMonstre(m: Monstre, dx: number, dy: number): void {
    if (this.niveau) this.deplacer(m, dx, dy);
    else {
      m.x += dx;
      m.y += dy;
    }
  }

  /** La case sous le point est marchable (et la porte est fermée ou non). */
  private marchable(x: number, y: number): boolean {
    const n = this.niveau!;
    const idx = caseDe(n, x, y);
    if (idx < 0) return false;
    const c = n.cases[idx]!;
    return (c === SOL || c === PONT) && !(this.barriere >= 0 && this.porte.has(idx)) && this.bloquees[idx] !== 1;
  }

  /** Un disque de rayon `r` tient en (x, y) : les quatre coins de son carré sont sur des cases marchables (une case fait 2 m, plus que tout corps). */
  private libre(x: number, y: number, r: number): boolean {
    return this.marchable(x - r, y - r) && this.marchable(x + r, y - r) && this.marchable(x - r, y + r) && this.marchable(x + r, y + r);
  }

  private glisser(e: { x: number; y: number }, dx: number, dy: number, r: number): void {
    // Coincé dans un mur (la porte vient de se fermer sur lui) : on le laisse sortir.
    if (!this.libre(e.x, e.y, r)) {
      e.x += dx;
      e.y += dy;
      return;
    }
    if (this.libre(e.x + dx, e.y, r)) e.x += dx;
    if (this.libre(e.x, e.y + dy, r)) e.y += dy;
  }

  private dansArene(e: { x: number; y: number }, rayon: number): void {
    if (this.niveau && this.barriere < 0) return;
    const max = RAYON_ARENE - rayon;
    const dx = e.x - this.ax;
    const dy = e.y - this.ay;
    const d2 = dx * dx + dy * dy;
    // Dans le niveau, ce qui est resté dehors (un monstre poursuivant) n'est pas ramené dans l'arène.
    if (this.niveau && e !== this.c && d2 > (RAYON_ARENE + cm(100)) * (RAYON_ARENE + cm(100))) return;
    if (d2 > max * max) {
      const d = isqrt(d2);
      e.x = this.ax + idiv(dx * max, d);
      e.y = this.ay + idiv(dy * max, d);
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
