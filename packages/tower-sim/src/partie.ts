// Lot T1 — la partie de Tower : la simulation de jeu, sur Rapier 2D déterministe. Pure au sens des autres simulations : elle ne lit ni horloge ni hasard non semé, ses
// entrées sont des ENTIERS (le masque de commandes d'un tick ; positions et vitesses en huitièmes) ; ses sorties (positions, angles) sont des nombres rendus par Rapier.
//
// Le déroulé d'un tick (`Partie.avancer`) :
//   1. la pièce active reçoit les commandes (demi-case à gauche ou à droite, quart de tour), puis sa vitesse de chute ;
//   2. si, au pas qui vient, elle serait à moins de `MARGE_CONTACT` de la plateforme ou d'une pièce, **elle lâche** : le joueur n'a plus la main, elle devient un
//      corps libre (la gravité s'applique) et compte comme posée ;
//   3. Rapier avance d'un pas (1/60 s) ;
//   4. toute pièce dont le centre passe sous le niveau de la plateforme est retirée et coûte UNE vie (la pièce active comme une pièce emportée par un effondrement) ;
//   5. sans pièce active, la suivante apparaît au-dessus du point le plus haut de la tour ; plus de pièce ou plus de vie : on attend la stabilisation (toutes les
//      pièces endormies, `STABILISATION_MAX_TICKS` au plus) puis on fige le résultat.
// La pièce active est un corps de Rapier **sans gravité**, dont la vitesse est posée à chaque tick (jamais de position calculée par la simulation) : une collision lui
// donne naturellement une impulsion, mais le contact prévu au 2. la lâche avant.
//
// Lot T2 — les paliers. Quand la hauteur stable franchit un palier (`scenario.paliers`), son effet entre dans une file ; chaque pièce qui naît prend l'effet en cours (ou, s'il n'y
// en a pas, le suivant de la file) : un effet couvre `DUREE_EFFET` pièces (trois pour le coup de vent, une pour les autres), puis le suivant commence — « l'un après l'autre ».
//   - petite / géante : la pièce naît à la moitié / au double de sa taille (`boitesE(…, taille)`, des huitièmes entiers) ;
//   - glissante : ses colliders ont un frottement de `FROTTEMENT_GLISSANT`, règle de combinaison « minimum » ;
//   - coup de vent : tous les `VENT_PERIODE_TICKS` ticks la pièce active se décale d'un huitième de mètre dans le sens du jour, comme un ordre de déplacement (refusé si elle s'enfonçait) ;
//   - pièce figée : au premier contact après le lâcher (le même que celui du lierre) elle devient un corps fixe, là où elle est, quitte à flotter ; au plus tard `FIGEE_TICKS` ticks après le lâcher ;
//   - lierre : au premier tick, après le lâcher, où un contact de Rapier est à moins de `DISTANCE_SOUDURE`, elle se soude (joint fixe) à chaque corps qu'elle touche.
// Sans `scenario.paliers`, rien de tout cela ne s'exécute : la partie du lot T1 est inchangée.
import type RAPIER from "@dimforge/rapier2d-deterministic-compat";
import type { PieceKind } from "../lab/interface";
import {
  COMMANDE,
  COMMANDES_CONNUES,
  DEMI_CASE_8,
  FIGEE_TICKS,
  LIMITE_X8,
  MARGE_REFUS,
  NIVEAU_PLATEFORME,
  PHYSIQUE,
  REGLAGES_DEFAUT,
  type Reglages,
  STABILISATION_MAX_TICKS,
  TICKS_PAR_SECONDE,
  TOWER_SIM_VERSION,
  VERSIONS_SIM_JOUABLES,
  VITESSE_CALME,
} from "./constantes";
import { CONTACT_V3, CONTACT_V4, DECALAGES_SECOURS, GROUPES_FANTOME, GROUPES_NORMAL, MARGE_LATERALE, type ParamsContact, ROTATION_SECOURS } from "./contact";
import { cadreDe, departGauche8, PAS_GRILLE_8, pivoter } from "./grille";
import { physiqueEstDEssai, physiqueResolue, type ReglagesPhysique } from "./physique";
import { DUREE_EFFET, type Effet, estBonus, type Palier, type Taille } from "./paliers";
import type { Rapier } from "./rapier";
import { boitesE, type Echelles, etenduePieceE, sommetPieceE } from "./echelles";
import { enMillimetres, sinCos } from "./sommet";

/** Une pièce posée d'avance (une tour de départ, `?scenario=paliers`) : forme, quarts de tour, position du centre de masse en huitièmes de mètre. */
export interface PieceDepart {
  kind: PieceKind;
  rot: number;
  x8: number;
  y8: number;
}

/**
 * Une suite de pièces et une plateforme : le contenu d'une partie (le scénario d'essai, ou celui du jour : `dailyTower`, lot T2). `jour` et `g` (version du générateur)
 * ne servent qu'à une rediffusion, pour vérifier qu'on la rejoue sur le contenu qu'elle nomme.
 */
export interface Scenario {
  nom: string;
  pieces: readonly PieceKind[];
  /** Demi-largeur de la plateforme, en huitièmes de mètre. Son dessus est à y = 0. */
  plateformeDemi8: number;
  /** Les paliers (lot T2), du plus bas au plus haut. Absents : aucun palier. */
  paliers?: readonly Palier[];
  /** Le sens du coup de vent : −1 vers la gauche, 1 vers la droite (défaut 1). */
  ventSens?: 1 | -1;
  /** Une tour déjà posée au départ (les pièces `kind` ne sont pas comptées parmi les pièces posées). */
  depart?: readonly PieceDepart[];
  /** Le jour (numéro de jour civil) du contenu du jour ; absent d'un scénario nommé. */
  jour?: number;
  /** La version du générateur qui a produit le contenu du jour ; absente d'un scénario nommé. */
  g?: number;
  /** Lot T3b (générateur 3) : le tirage du contenu du jour (0, 1, 2…) ; absent d'un scénario nommé et des générateurs 1 et 2 (= 0). */
  tirage?: number;
}

/**
 * Lot T6 — la visée, pour l'AFFICHAGE : deux traits verticaux qui partent des bords gauche et droit de la pièce en main et descendent jusqu'à la première surface qu'ils rencontrent
 * (`yBas` : null s'il n'y en a aucune, la pièce tomberait à la mer), et l'endroit où la pièce touchera en premier (`arrivee` : son centre de masse à l'arrivée, null s'il n'y en a pas).
 * Mètres, repère de la plateforme.
 */
export interface Visee {
  traits: { x: number; yHaut: number; yBas: number | null }[];
  arrivee: { x: number; y: number } | null;
}

export type Phase = "jeu" | "stabilisation" | "fini";
/** `active` : tombe sous la main du joueur ; `libre` : corps libre ; `perdue` : sous la plateforme (retirée) ; `abandonnee` : active quand la dernière vie a été perdue. */
export type EtatPiece = "active" | "libre" | "perdue" | "abandonnee";

export interface VuePiece {
  id: number;
  kind: PieceKind;
  /** Quarts de tour appliqués à la forme (au lot T1 : à la création ; l'angle de Rapier fait le reste). */
  rot: number;
  etat: EtatPiece;
  /** Centre de masse (mètres) et angle (radians). Une pièce retirée garde sa dernière position. */
  x: number;
  y: number;
  angle: number;
  endormie: boolean;
  /** Lot T2 : la taille de la pièce, l'effet qui s'applique à elle (null : aucun) et deux états qu'une scène peut montrer (soudée par le lierre, figée en corps fixe). */
  taille: Taille;
  effet: Effet | null;
  soudee: boolean;
  fixe: boolean;
}

export interface VuePartie {
  tick: number;
  phase: Phase;
  pieces: VuePiece[];
  /** Indice de la pièce active (−1 : aucune). */
  active: number;
  /** Forme de la pièce suivante (celle qui naîtra après l'active) ; null après la dernière. */
  suivante: PieceKind | null;
  /** Numéro de la pièce en main (1 à `total`), ou le nombre de pièces distribuées une fois la distribution finie. */
  numero: number;
  total: number;
  vies: number;
  /** Pièces posées (lâchées) et pièces tombées (sous la plateforme, effondrement compris). */
  posees: number;
  tombees: number;
  /** Hauteur de la tour en millimètres (pièces calmes) et la plus haute atteinte. */
  hauteurMm: number;
  hauteurMaxMm: number;
  /** Lot T2 : le prochain palier à franchir (null : tous franchis, ou aucun palier), et le nombre de paliers déjà déclenchés avec le dernier effet déclenché. */
  palier: { metres: number; effet: Effet; bonus: boolean } | null;
  declenches: number;
  dernierEffet: Effet | null;
  /** Lot T5 : l'effet qui attend la prochaine pièce à naître (celle de la plaque « Suivante »), ou null. Affichage seulement : jamais haché ni rejoué. */
  effetSuivant: Effet | null;
}

/** Le résultat figé. Le score est `hauteurMm` ; départage : `vies` (plus = mieux), puis `ticks` (moins = mieux). */
export interface Resultat {
  /** Hauteur finale stable : le point le plus haut d'une pièce encore sur la tour, en millimètres entiers. */
  hauteurMm: number;
  /** Vies restantes (une pièce tombée pendant l'attente de stabilisation en coûte aussi). */
  vies: number;
  /** Le temps, en ticks, jusqu'à la fin de la partie (dernière pièce posée ou dernière vie perdue), sans l'attente de stabilisation. */
  ticks: number;
  /** Le tick où le résultat a été figé (fin + attente). */
  ticksGel: number;
  hauteurMaxMm: number;
  posees: number;
  tombees: number;
  motif: "pieces" | "vies";
}

interface Piece {
  id: number;
  kind: PieceKind;
  rot: number;
  etat: EtatPiece;
  body: RAPIER.RigidBody | null;
  /** Colonne de la pièce active (huitièmes) : la simulation en est l'autorité, jamais Rapier. */
  x8: number;
  /** Lot T6 (version 4) : le bord gauche de la boîte englobante, en huitièmes de mètre — c'est lui qu'on pilote ; `x8` en dérive (le centre de masse). */
  g8: number;
  x: number;
  y: number;
  angle: number;
  endormie: boolean;
  /** Plus haut point (mètres), mis à jour avec la position. */
  sommet: number;
  /** Devient vrai la première fois que la pièce est calme (posée pour de bon sur la tour) et le reste : la hauteur en direct ne saute pas quand une pièce tangue. */
  stabilisee: boolean;
  // Lot T2
  taille: Taille;
  effet: Effet | null;
  /** Le tick du lâcher (−1 tant que la pièce est active ou posée d'avance). */
  lacheTick: number;
  /** Ticks passés sous le contrôle du joueur (le rythme du vent). */
  vecu: number;
  soudee: boolean;
  fixe: boolean;
}

/** La portée de la visée (mètres) : plus que toute la hauteur d'une partie. */
const PORTEE_VISEE = 200;

export class Partie {
  private readonly R: Rapier;
  private readonly world: RAPIER.World;
  private pieces: Piece[] = [];
  private active: Piece | null = null;
  private ticks = 0;
  private phase: Phase = "jeu";
  private distribuees = 0;
  private vies: number;
  private posees = 0;
  private tombees = 0;
  private hauteurMm = 0;
  private hauteurMaxMm = 0;
  private motif: "pieces" | "vies" = "pieces";
  private ticksFin = 0;
  private figee: Resultat | null = null;
  // Lot T2
  private journal: number[] = [];
  /** Les effets déclenchés qui attendent leur pièce, l'effet en cours (et ce qu'il lui reste de pièces), le prochain palier, le nombre de paliers déclenchés. */
  private file: Effet[] = [];
  private courant: { effet: Effet; restant: number } | null = null;
  private prochainPalier = 0;
  private declenches = 0;
  private dernierEffet: Effet | null = null;
  /** Pièce par corps (poignée de Rapier) ; la plateforme (corps fixe, créé seulement avec des paliers) y est `null`. */
  private parCorps = new Map<number, Piece | null>();
  private retenue = false;
  /** Lot T5 : les réglages d'essai de la physique (les défauts, sauf demande) et les tailles d'essai qui en découlent. */
  private readonly physique: ReglagesPhysique;
  private readonly echelles: Echelles;
  /** Lot T6 : la version de la simulation que joue cette partie (3 : celle des rediffusions d'avant le lot, rejouée au bit près ; 4 : la grille et la pose juste). */
  readonly version: number;
  private readonly v4: boolean;
  private readonly contact: ParamsContact;
  private readonly secours: boolean;

  /**
   * `options.stabilisationMaxTicks` : seulement pour les tests (l'attente maximale de stabilisation, `STABILISATION_MAX_TICKS` par défaut). `options.physique` (lot T5) : les réglages d'ESSAI de
   * `?debug&tune` (frottement, rebond, vent, tailles, seuils de contact) ; absents, la partie est exactement celle des lots précédents. `depuis` : la partie à copier
   * (lot T3, voir `cloner`) ; le monde de Rapier est alors restauré d'un instantané au lieu d'être construit.
   */
  constructor(
    R: Rapier,
    readonly scenario: Scenario,
    readonly reglages: Readonly<Reglages> = REGLAGES_DEFAUT,
    private readonly options: { stabilisationMaxTicks?: number; physique?: Partial<ReglagesPhysique>; version?: number; secoursRotation?: boolean; contact?: Partial<ParamsContact> } = {},
    depuis?: Partie,
  ) {
    this.R = R;
    this.version = options.version ?? TOWER_SIM_VERSION;
    if (!VERSIONS_SIM_JOUABLES.includes(this.version)) throw new Error(`simulation ${this.version} : ce code joue les versions ${VERSIONS_SIM_JOUABLES.join(", ")}`);
    this.v4 = this.version >= 4;
    this.contact = { ...(this.v4 ? CONTACT_V4 : CONTACT_V3), ...(options.contact ?? {}) };
    this.secours = options.secoursRotation ?? ROTATION_SECOURS;
    this.vies = reglages.vies;
    this.physique = physiqueResolue(options.physique);
    this.echelles = { petite4: this.physique.echellePetite4, geante4: this.physique.echelleGeante4 };
    if (depuis) {
      this.world = R.World.restoreSnapshot(depuis.world.takeSnapshot());
      this.copierEtat(depuis);
      return;
    }
    const world = new R.World({ x: 0, y: -PHYSIQUE.gravite });
    world.timestep = 1 / TICKS_PAR_SECONDE;
    world.integrationParameters.numSolverIterations = this.v4 ? this.contact.iterations : PHYSIQUE.iterations;
    if (this.v4) {
      // Lot T6 : les paramètres de contact de la version 4 (`contact.ts`) ; la version 3 garde ceux de Rapier.
      const ip = world.integrationParameters;
      ip.normalizedAllowedLinearError = this.contact.erreurLineaire;
      ip.normalizedPredictionDistance = this.contact.prediction;
      ip.numInternalPgsIterations = this.contact.iterationsInternes;
      if (this.contact.frequence !== null) ip.contact_natural_frequency = this.contact.frequence;
    }
    const plateforme = R.ColliderDesc.cuboid(scenario.plateformeDemi8 / 8, 0.5).setFriction(this.physique.frottement).setRestitution(this.physique.rebond);
    if (scenario.paliers && scenario.paliers.length > 0) {
      // Avec des paliers, la plateforme est un corps fixe : le lierre peut s'y souder (un joint relie deux corps).
      const corps = world.createRigidBody(R.RigidBodyDesc.fixed().setTranslation(0, -0.5 + NIVEAU_PLATEFORME));
      world.createCollider(plateforme, corps);
      this.parCorps.set(corps.handle, null);
    } else world.createCollider(plateforme.setTranslation(0, -0.5 + NIVEAU_PLATEFORME));
    this.world = world;
    for (const d of scenario.depart ?? []) this.poserDepart(d);
    this.apparaitre();
  }

  /**
   * Lot T3 — une copie indépendante de la partie, à l'état exact d'un instantané du monde de Rapier (les poignées des corps sont conservées) : le bot en essaie des coups sans
   * toucher à la vraie partie. Les deux avancent ensuite à l'identique pour les mêmes commandes. À libérer par `dispose`.
   */
  cloner(): Partie {
    return new Partie(this.R, this.scenario, this.reglages, this.options, this);
  }

  private copierEtat(s: Partie): void {
    const corps = (h: number): RAPIER.RigidBody => this.world.getRigidBody(h);
    const mapa = new Map<Piece, Piece>();
    this.pieces = s.pieces.map((p) => {
      const q: Piece = { ...p, body: p.body ? corps(p.body.handle) : null };
      mapa.set(p, q);
      return q;
    });
    this.active = s.active ? mapa.get(s.active)! : null;
    this.ticks = s.ticks;
    this.phase = s.phase;
    this.distribuees = s.distribuees;
    this.vies = s.vies;
    this.posees = s.posees;
    this.tombees = s.tombees;
    this.hauteurMm = s.hauteurMm;
    this.hauteurMaxMm = s.hauteurMaxMm;
    this.motif = s.motif;
    this.ticksFin = s.ticksFin;
    this.figee = s.figee;
    this.journal = [...s.journal];
    this.file = [...s.file];
    this.courant = s.courant ? { ...s.courant } : null;
    this.prochainPalier = s.prochainPalier;
    this.declenches = s.declenches;
    this.dernierEffet = s.dernierEffet;
    this.parCorps = new Map();
    for (const [h, p] of s.parCorps) this.parCorps.set(h, p ? mapa.get(p)! : null);
  }

  /** Lot T3 — deux lectures à coût nul, que le bot fait à chaque tick : les pièces tombées, et la pièce active (−1 : aucune). */
  get nbTombees(): number {
    return this.tombees;
  }

  get idActive(): number {
    return this.active ? this.active.id : -1;
  }

  /** Lot T3 — lecture légère pour le bot (sans construire une `VuePartie` à chaque tick). `sommetMm` : le point le plus haut d'une pièce libre, qu'elle soit calme ou non. */
  lecture(): { active: number; tombees: number; vies: number; hauteurMm: number; sommetMm: number; phase: Phase } {
    let h = 0;
    for (const p of this.pieces) if (p.etat === "libre" && p.sommet > h) h = p.sommet;
    return { active: this.active ? this.active.id : -1, tombees: this.tombees, vies: this.vies, hauteurMm: this.hauteurMm, sommetMm: enMillimetres(h), phase: this.phase };
  }

  /** Lot T3 : la largeur (millimètres) de ce qui est dans les `profondeurMm` du haut de la tour : l'écart entre le bord gauche et le bord droit des pièces libres dont le sommet y est. */
  largeurSommetMm(profondeurMm: number): number {
    let haut = -Infinity;
    for (const p of this.pieces) if (p.etat === "libre" && p.sommet > haut) haut = p.sommet;
    if (haut === -Infinity) return 0;
    const seuil = haut - profondeurMm / 1000;
    let g = Infinity;
    let d = -Infinity;
    for (const p of this.pieces) {
      if (p.etat !== "libre" || p.sommet < seuil) continue;
      const e = etenduePieceE(p.kind, p.rot, p.x, p.angle, p.taille, this.echelles);
      if (e.gauche < g) g = e.gauche;
      if (e.droite > d) d = e.droite;
    }
    return enMillimetres(d - g);
  }

  /** Lot T3 : combien de pièces libres bougent encore (ni endormies, ni figées, ni plus lentes que `vitesse` en m/s) ? */
  agitees(vitesse: number): number {
    let n = 0;
    const v2 = vitesse * vitesse;
    for (const p of this.pieces) {
      if (p.etat !== "libre" || p.fixe || !p.body || p.body.isSleeping()) continue;
      const v = p.body.linvel();
      if (v.x * v.x + v.y * v.y > v2) n++;
    }
    return n;
  }

  /**
   * Lot T3 — pour les COPIES du bot seulement : la pièce active reste où elle est (elle n'est plus pilotée, donc ne tombe plus), de sorte qu'un essai peut laisser la tour se
   * stabiliser longtemps sans que la pièce suivante vienne la heurter. Jamais utilisé par le jeu ni par un rejeu.
   */
  retenir(oui: boolean): void {
    this.retenue = oui;
  }

  get tick(): number {
    return this.ticks;
  }

  /** Lot T5 : cette partie a-t-elle des réglages d'ESSAI de physique (`?debug&tune`) ? Une telle partie n'est jamais classée (le serveur la rejouerait avec les réglages normaux). */
  get physiqueDEssai(): boolean {
    return physiqueEstDEssai(this.physique);
  }

  /** Lot T5 : les tailles d'essai (pour le rendu : le jeu dessine les pièces à la taille que la physique leur donne). */
  get taillesDEssai(): Readonly<Echelles> {
    return this.echelles;
  }

  get etape(): Phase {
    return this.phase;
  }

  /** Les masques de commandes des ticks joués pendant la phase de jeu (la stabilisation n'en lit aucune) : de quoi construire la rediffusion (`rediffusion.ts`). */
  commandesJouees(): readonly number[] {
    return this.journal;
  }

  /** Le résultat figé, ou null tant que la partie n'est pas finie. */
  resultat(): Resultat | null {
    return this.figee;
  }

  /** Avance d'un tick avec le masque de commandes `commandes` (voir `COMMANDE`). Sans effet une fois la partie finie. */
  avancer(commandes: number): void {
    if (this.phase === "fini") return;
    this.ticks++;
    if (this.phase === "jeu") this.journal.push(commandes & COMMANDES_CONNUES);
    if (this.phase === "jeu" && this.active && !this.retenue) this.piloter(commandes | 0);
    this.world.step();
    this.apresPas();
  }

  // ---- la pièce active ----

  private piloter(commandes: number): void {
    const p = this.active!;
    if (commandes & COMMANDE.GAUCHE) this.deplacer(p, -DEMI_CASE_8);
    if (commandes & COMMANDE.DROITE) this.deplacer(p, DEMI_CASE_8);
    if (commandes & COMMANDE.TOURNER) this.tourner(p);
    if (p.effet === "vent" && ++p.vecu % this.physique.ventPeriodeTicks === 0) this.deplacer(p, (this.scenario.ventSens === -1 ? -1 : 1) * this.physique.ventPas8);
    const facteur = commandes & COMMANDE.DESCENDRE ? this.reglages.facteurDescente : 1;
    const normale = this.reglages.vitesseChute8 / 8;
    let vy = normale * facteur;
    // « Descendre » est un confort, jamais un effet physique (lot T2) : la descente rapide s'arrête à la marge de contact, la pièce finit sa course à la vitesse normale et
    // lâche exactement comme une pièce sans accélération — elle se pose à la même vitesse, avec la même force.
    if (facteur > 1 && this.toucheEnBas(p, p.x, p.y - vy / TICKS_PAR_SECONDE)) vy = normale;
    p.body!.setLinvel({ x: 0, y: -vy }, true);
    // Au pas qui vient la pièce descend de vy / 60 : si elle toucherait (à la marge près) la plateforme ou une pièce, elle lâche maintenant.
    if (this.toucheEnBas(p, p.x, p.y - vy / TICKS_PAR_SECONDE)) this.lacher(p);
  }

  /** Un déplacement de `delta8` huitièmes de mètre (une demi-case par ordre du joueur, un huitième par poussée du vent) ; refusé s'il enfonce la pièce dans un autre corps ou la sort des limites. */
  private deplacer(p: Piece, delta8: number): void {
    const x8 = p.x8 + delta8;
    if (Math.abs(x8) > LIMITE_X8) return;
    if (this.touche(p, x8 / 8, p.y, -MARGE_REFUS)) return;
    p.x8 = x8;
    p.g8 += delta8;
    p.x = x8 / 8;
    p.body!.setTranslation({ x: p.x, y: p.y }, true);
  }

  /**
   * Un quart de tour dans le sens des aiguilles d'une montre ; refusé s'il entre dans une pièce. Version 3 : autour du centre de masse. **Version 4 (lot T6) : autour d'un point de la grille** (le
   * centre de la boîte englobante, `grille.ts`), de sorte que les bords restent sur la grille des demi-cases ; si le quart de tour est refusé, on essaie, dans cet ordre fixe, un décalage d'une
   * demi-case à gauche, puis à droite, puis vers le haut (`DECALAGES_SECOURS`, débrayable : `ROTATION_SECOURS`), avant de refuser.
   */
  private tourner(p: Piece): void {
    const rot = (p.rot + 3) & 3;
    if (!this.v4) {
      if (this.toucheBoites(boitesE(p.kind, rot, p.taille, this.echelles), p.body!, p.x, p.y, -MARGE_REFUS, -MARGE_REFUS)) return;
      this.retirerCorps(p);
      p.rot = rot;
      p.body = this.creerCorps(p);
      return;
    }
    const avant = cadreDe(boitesE(p.kind, p.rot, p.taille, this.echelles));
    const bs = boitesE(p.kind, rot, p.taille, this.echelles);
    const apres = cadreDe(bs);
    const bas8 = p.y * 8 + avant.bas;
    const pv = pivoter(avant, apres, p.g8, bas8);
    const essais: (readonly [number, number])[] = [[0, 0]];
    if (this.secours) for (const d of DECALAGES_SECOURS) essais.push(d);
    for (const [dx, dy] of essais) {
      const g8 = pv.gauche8 + dx * PAS_GRILLE_8;
      const x8 = g8 - apres.gauche;
      if (Math.abs(x8) > LIMITE_X8) continue;
      const y = (pv.bas8 + dy * PAS_GRILLE_8 - apres.bas) / 8;
      if (this.toucheBoites(bs, p.body!, x8 / 8, y, -MARGE_REFUS, -MARGE_REFUS)) continue;
      this.retirerCorps(p);
      p.rot = rot;
      p.g8 = g8;
      p.x8 = x8;
      p.x = x8 / 8;
      p.y = y;
      p.body = this.creerCorps(p);
      return;
    }
  }

  private lacher(p: Piece): void {
    p.body!.setLinvel({ x: 0, y: -this.reglages.vitesseChute8 / 8 }, true); // jamais la vitesse d'une descente rapide : celle d'une chute normale
    p.body!.setGravityScale(1, true);
    if (this.v4) for (let i = 0; i < p.body!.numColliders(); i++) p.body!.collider(i).setCollisionGroups(GROUPES_NORMAL);
    p.etat = "libre";
    p.lacheTick = this.ticks;
    this.posees++;
    this.active = null;
  }

  private touche(p: Piece, x: number, y: number, marge: number): boolean {
    return this.toucheBoites(boitesE(p.kind, p.rot, p.taille, this.echelles), p.body!, x, y, marge, marge);
  }

  /**
   * La pièce active, à la position (x, y), toucherait-elle quelque chose (à la marge de contact près) ? Version 3 : la forme agrandie de la marge dans tous les sens, un voisin collé sur le côté
   * compte (la pièce lâchait alors trop tôt, le long du voisin). Version 4 : agrandie de la marge vers le BAS seulement, et rétrécie d'un millimètre sur les côtés — un voisin collé
   * ou à un millimètre de pénétration ne compte pas, seul ce qui se trouve en dessous.
   */
  private toucheEnBas(p: Piece, x: number, y: number): boolean {
    const bs = boitesE(p.kind, p.rot, p.taille, this.echelles);
    if (!this.v4) return this.toucheBoites(bs, p.body!, x, y, this.physique.margeContact, this.physique.margeContact);
    return this.toucheBoites(bs, p.body!, x, y - this.physique.margeContact / 2, -MARGE_LATERALE, this.physique.margeContact / 2);
  }

  /** Une boîte de la forme, agrandie de `margeX` et `margeY` (réduite si négative), recouvre-t-elle un autre corps que `corps` ? */
  private toucheBoites(bs: readonly { cx: number; cy: number; hw: number; hh: number }[], corps: RAPIER.RigidBody, x: number, y: number, margeX: number, margeY: number): boolean {
    let touche = false;
    for (const b of bs) {
      const shape = new this.R.Cuboid(Math.max(0.0001, b.hw / 8 + margeX), Math.max(0.0001, b.hh / 8 + margeY));
      this.world.intersectionsWithShape(
        { x: x + b.cx / 8, y: y + b.cy / 8 },
        0,
        shape,
        () => {
          touche = true;
          return false;
        },
        undefined,
        undefined,
        undefined,
        corps,
      );
      if (touche) return true;
    }
    return false;
  }

  private creerCorps(p: Piece): RAPIER.RigidBody {
    const R = this.R;
    const body = this.world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(p.x, p.y).setGravityScale(p.etat === "active" ? 0 : 1));
    for (const b of boitesE(p.kind, p.rot, p.taille, this.echelles)) {
      const collider = R.ColliderDesc.cuboid(b.hw / 8, b.hh / 8).setTranslation(b.cx / 8, b.cy / 8).setDensity(1).setRestitution(this.physique.rebond);
      if (p.effet === "glissante") collider.setFriction(this.physique.frottementGlissant).setFrictionCombineRule(R.CoefficientCombineRule.Min);
      else collider.setFriction(this.physique.frottement);
      // Version 4 : tant qu'elle est en main, la pièce n'a aucun contact (un fantôme) — le joueur la mène sur la grille, la simulation décide seule où elle s'arrête (`toucheEnBas`) ; elle ne pousse donc
      // pas un voisin collé, et un voisin ne la pousse pas. Au lâcher elle devient un corps comme les autres (`lacher`).
      if (this.v4 && p.etat === "active") collider.setCollisionGroups(GROUPES_FANTOME);
      this.world.createCollider(collider, body);
    }
    this.parCorps.set(body.handle, p);
    return body;
  }

  private retirerCorps(p: Piece): void {
    if (!p.body) return;
    this.parCorps.delete(p.body.handle);
    this.world.removeRigidBody(p.body);
  }

  /** Fait naître la pièce suivante, centrée sur la plateforme, au-dessus du point le plus haut de la tour. */
  private apparaitre(): void {
    const id = this.pieces.length;
    const kind = this.scenario.pieces[this.distribuees]!;
    const effet = this.effetDeLaPiece();
    const taille: Taille = effet === "petite" ? "petite" : effet === "geante" ? "geante" : "normale";
    const bs = boitesE(kind, 0, taille, this.echelles);
    let bas8 = 0;
    let gauche8 = Infinity;
    let droite8 = -Infinity;
    for (const b of bs) {
      bas8 = Math.min(bas8, b.cy - b.hh);
      gauche8 = Math.min(gauche8, b.cx - b.hw);
      droite8 = Math.max(droite8, b.cx + b.hw);
    }
    // Version 3 : le centre de masse sur l'axe (arrondi). Version 4 : le bord gauche de la boîte englobante sur la grille (`departGauche8`), centrée sur l'axe ; le centre de masse en dérive.
    const g8 = this.v4 ? departGauche8(cadreDe(bs)) : 0;
    const x8 = this.v4 ? g8 - gauche8 : -Math.floor((gauche8 + droite8) / 2);
    let sommet = NIVEAU_PLATEFORME;
    for (const q of this.pieces) if (q.etat === "libre" && q.sommet > sommet) sommet = q.sommet;
    const y8 = Math.ceil(sommet * 8) + this.reglages.hauteurApparition8 - bas8;
    const p: Piece = {
      id, kind, rot: 0, etat: "active", body: null, x8, g8, x: x8 / 8, y: y8 / 8, angle: 0, endormie: false, sommet: y8 / 8, stabilisee: false,
      taille, effet, lacheTick: -1, vecu: 0, soudee: false, fixe: false,
    };
    p.body = this.creerCorps(p);
    this.pieces.push(p);
    this.active = p;
    this.distribuees++;
  }

  /** L'effet de la pièce qui naît : celui qui est en cours, sinon le prochain de la file (« l'un après l'autre »). Un effet couvre `DUREE_EFFET` pièces. */
  private effetDeLaPiece(): Effet | null {
    if (!this.courant && this.file.length > 0) {
      const effet = this.file.shift()!;
      this.courant = { effet, restant: DUREE_EFFET[effet] };
    }
    const c = this.courant;
    if (!c) return null;
    if (--c.restant <= 0) this.courant = null;
    return c.effet;
  }

  /** Une pièce posée d'avance : un corps endormi, déjà « stabilisé » (elle compte dans la hauteur dès le début). */
  private poserDepart(d: PieceDepart): void {
    const p: Piece = {
      id: this.pieces.length, kind: d.kind, rot: d.rot & 3, etat: "libre", body: null, x8: d.x8, g8: 0, x: d.x8 / 8, y: d.y8 / 8, angle: 0, endormie: false, sommet: 0, stabilisee: true,
      taille: "normale", effet: null, lacheTick: -1, vecu: 0, soudee: false, fixe: false,
    };
    p.sommet = sommetPieceE(p.kind, p.rot, p.y, 0, "normale", this.echelles);
    p.body = this.creerCorps(p);
    p.body.sleep();
    this.pieces.push(p);
  }

  // ---- après le pas ----

  private apresPas(): void {
    // 1. positions, pièces perdues.
    for (const p of this.pieces) {
      if (!p.body) continue;
      if (p.etat === "active") {
        const t = p.body.translation();
        // Version 4 : la colonne de la pièce en main est celle de la grille (l'autorité, jamais Rapier) ; seule la hauteur vient du moteur.
        if (!this.v4) p.x = t.x;
        p.y = t.y;
        continue;
      }
      if (p.fixe) continue; // un corps fixe (pièce figée) ne bouge plus jamais
      // Une pièce endormie n'a pas bougé : sa position et son sommet gardés sont ceux d'avant (elle se réveille si une autre la heurte : `isSleeping` est relu à chaque pas).
      const dort = p.body.isSleeping();
      if (dort && p.endormie) continue;
      p.endormie = dort;
      const t = p.body.translation();
      p.x = t.x;
      p.y = t.y;
      p.angle = p.body.rotation();
      p.sommet = sommetPieceE(p.kind, p.rot, p.y, p.angle, p.taille, this.echelles);
      if (p.y < NIVEAU_PLATEFORME) this.perdre(p);
      else {
        if (!p.stabilisee) {
          if (p.endormie) p.stabilisee = true;
          else {
            const v = p.body.linvel();
            p.stabilisee = v.x * v.x + v.y * v.y < VITESSE_CALME * VITESSE_CALME;
          }
        }
        // Pièce figée : elle devient un corps fixe AU CONTACT (là où elle le touche, quitte à flotter) ; au plus tard `FIGEE_TICKS` ticks après le lâcher (un contact manqué).
        if (p.effet === "figee" && !p.fixe && (this.ticks - p.lacheTick >= FIGEE_TICKS || this.voisinsEnContact(p).size > 0)) this.figer(p);
        else if (p.effet === "lierre" && !p.soudee) this.souder(p);
      }
    }
    if (this.active && this.active.y < NIVEAU_PLATEFORME) this.perdre(this.active);
    if (this.phase === "jeu" && this.vies <= 0) this.finir("vies");
    if (this.phase === "jeu" && !this.active) {
      if (this.distribuees < this.scenario.pieces.length) this.apparaitre();
      else this.finir("pieces");
    }
    // 2. hauteur de la tour (pièces stabilisées) et plus haute atteinte.
    let h = 0;
    for (const p of this.pieces) if (p.etat === "libre" && p.stabilisee && p.sommet > h) h = p.sommet;
    this.hauteurMm = enMillimetres(h);
    if (this.hauteurMm > this.hauteurMaxMm) this.hauteurMaxMm = this.hauteurMm;
    // 2 bis. les paliers : chacun se déclenche une seule fois, la première fois que la hauteur stable l'atteint (deux franchis d'un coup entrent dans la file dans l'ordre).
    const paliers = this.scenario.paliers;
    if (paliers && this.phase === "jeu") {
      while (this.prochainPalier < paliers.length && this.hauteurMm >= paliers[this.prochainPalier]!.metres * 1000) {
        const effet = paliers[this.prochainPalier++]!.effet;
        this.file.push(effet);
        this.dernierEffet = effet;
        this.declenches++;
      }
    }
    // 3. la stabilisation.
    if (this.phase === "stabilisation") {
      const stable = this.pieces.every((p) => p.etat !== "libre" || p.endormie);
      if (stable || this.ticks - this.ticksFin >= (this.options.stabilisationMaxTicks ?? STABILISATION_MAX_TICKS)) this.geler();
    }
  }

  /** Pièce figée : posée, elle devient un corps fixe (immobile pour toujours ; les pièces qu'on lui pose dessus reposent dessus). */
  private figer(p: Piece): void {
    const b = p.body!;
    b.setLinvel({ x: 0, y: 0 }, false);
    b.setAngvel(0, false);
    b.setBodyType(this.R.RigidBodyType.Fixed, true);
    p.fixe = true;
    p.endormie = true;
    p.stabilisee = true;
  }

  /** Les corps que touche la pièce `p` à ce tick (un point de contact de Rapier à moins de `DISTANCE_SOUDURE`) : jamais la pièce active du joueur, ni une pièce retirée. La plateforme y est `null`. */
  private voisinsEnContact(p: Piece): Map<number, Piece | null> {
    const body = p.body!;
    const touches = new Map<number, Piece | null>();
    for (let i = 0; i < body.numColliders(); i++) {
      const c = body.collider(i);
      const voisins: RAPIER.Collider[] = [];
      this.world.contactPairsWith(c, (c2) => voisins.push(c2));
      for (const c2 of voisins) {
        const b2 = c2.parent();
        if (!b2 || b2.handle === body.handle || touches.has(b2.handle)) continue;
        const q = this.parCorps.get(b2.handle);
        if (q === undefined || (q !== null && q.etat !== "libre")) continue;
        let proche = false;
        this.world.contactPair(c, c2, (m) => {
          for (let k = 0; k < m.numContacts(); k++) if (m.contactDist(k) <= this.physique.distanceSoudure) proche = true;
        });
        if (proche) touches.set(b2.handle, q);
      }
    }
    return touches;
  }

  /** Lierre : au premier contact après le lâcher, un joint fixe relie la pièce à chaque corps qu'elle touche (la plateforme comprise), dans l'ordre des numéros de pièce. */
  private souder(p: Piece): void {
    const body = p.body!;
    const touches = this.voisinsEnContact(p);
    if (touches.size === 0) return;
    p.soudee = true;
    const ordre = [...touches.entries()].sort((a, b) => (a[1]?.id ?? -1) - (b[1]?.id ?? -1));
    const t1 = body.translation();
    const th1 = body.rotation();
    for (const [handle] of ordre) {
      const b2 = this.world.getRigidBody(handle);
      const t2 = b2.translation();
      const th2 = b2.rotation();
      // Le point de b1 (son origine) dans le repère de b2 : la rotation inverse de b2 passe par la table de sinus, jamais par Math.sin / Math.cos.
      const { s: sn, c: cs } = sinCos(th2);
      const dx = t1.x - t2.x;
      const dy = t1.y - t2.y;
      this.world.createImpulseJoint(this.R.JointData.fixed({ x: 0, y: 0 }, 0, { x: cs * dx + sn * dy, y: -sn * dx + cs * dy }, th1 - th2), body, b2, true);
    }
  }

  /** Une pièce passe sous le niveau de la plateforme : retirée, une vie de moins (une seule fois : elle n'existe plus). */
  private perdre(p: Piece): void {
    this.retirerCorps(p);
    p.body = null;
    if (p === this.active) this.active = null;
    p.etat = "perdue";
    this.tombees++;
    if (this.vies > 0) this.vies--;
  }

  private finir(motif: "pieces" | "vies"): void {
    if (this.active) {
      // Plus de vie avec une pièce en l'air : elle est abandonnée, elle ne compte ni comme posée ni comme tombée.
      this.retirerCorps(this.active);
      this.active.body = null;
      this.active.etat = "abandonnee";
      this.active = null;
    }
    this.phase = "stabilisation";
    this.motif = motif;
    this.ticksFin = this.ticks;
  }

  private geler(): void {
    let h = 0;
    for (const p of this.pieces) if (p.etat === "libre" && p.sommet > h) h = p.sommet;
    const hauteurMm = enMillimetres(h);
    if (hauteurMm > this.hauteurMaxMm) this.hauteurMaxMm = hauteurMm;
    this.hauteurMm = hauteurMm;
    this.phase = "fini";
    this.figee = {
      hauteurMm,
      vies: this.vies,
      ticks: this.ticksFin,
      ticksGel: this.ticks,
      hauteurMaxMm: this.hauteurMaxMm,
      posees: this.posees,
      tombees: this.tombees,
      motif: this.motif,
    };
  }

  // ---- lecture ----

  vue(): VuePartie {
    const paliers = this.scenario.paliers;
    const suivante = this.distribuees < this.scenario.pieces.length ? this.scenario.pieces[this.distribuees]! : null;
    return {
      tick: this.ticks,
      phase: this.phase,
      pieces: this.pieces.map((p) => ({
        id: p.id, kind: p.kind, rot: p.rot, etat: p.etat, x: p.x, y: p.y, angle: p.angle, endormie: p.endormie, taille: p.taille, effet: p.effet, soudee: p.soudee, fixe: p.fixe,
      })),
      active: this.active ? this.active.id : -1,
      suivante,
      numero: this.distribuees,
      total: this.scenario.pieces.length,
      vies: this.vies,
      posees: this.posees,
      tombees: this.tombees,
      hauteurMm: this.hauteurMm,
      hauteurMaxMm: this.hauteurMaxMm,
      palier: paliers && this.prochainPalier < paliers.length ? { metres: paliers[this.prochainPalier]!.metres, effet: paliers[this.prochainPalier]!.effet, bonus: estBonus(paliers[this.prochainPalier]!.effet) } : null,
      declenches: this.declenches,
      dernierEffet: this.dernierEffet,
      effetSuivant: this.effetSuivant(),
    };
  }

  /** Lot T5 : l'effet que prendra la pièce qui naîtra après celle en main (celui qui est en cours, sinon le prochain de la file) : la plaque « Suivante » le montre. Lecture seule (rien n'est consommé). */
  private effetSuivant(): Effet | null {
    if (this.courant) return this.courant.effet;
    return this.file.length > 0 ? this.file[0]! : null;
  }

  /** Pour les tests : la vitesse (m/s) du corps d'une pièce. Null si la pièce n'existe plus. */
  vitesseDe(id: number): { x: number; y: number } | null {
    const body = this.pieces[id]?.body;
    return body ? { ...body.linvel() } : null;
  }

  /** Pour les tests : le frottement du premier collider d'une pièce et sa règle de combinaison (`min` : le plus faible des deux surfaces l'emporte). Null si la pièce n'existe plus. */
  frottementDe(id: number): { valeur: number; min: boolean } | null {
    const body = this.pieces[id]?.body;
    if (!body) return null;
    const c = body.collider(0);
    return { valeur: c.friction(), min: c.frictionCombineRule() === this.R.CoefficientCombineRule.Min };
  }

  /**
   * Lot T6 — **la visée**, une LECTURE SEULE du monde de Rapier (un lancer de forme et deux rayons, rien n'est créé ni déplacé dans le monde), appelée depuis le rendu entre deux ticks,
   * jamais pendant un pas : la partie rejouée n'en dépend pas (testé : même rediffusion, même empreinte, avec ou sans visée). Null s'il n'y a pas de pièce en main.
   */
  visee(): Visee | null {
    const p = this.active;
    if (!p || !p.body) return null;
    const bs = boitesE(p.kind, p.rot, p.taille, this.echelles);
    const cadre = cadreDe(bs);
    const bas = { x: 0, y: -1 };
    // L'arrivée : chaque boîte est lancée vers le bas (rétrécie sur les côtés comme pour le lâcher : un voisin collé n'est pas « dessous »), la plus courte distance l'emporte.
    let toi = Infinity;
    for (const b of bs) {
      const forme = new this.R.Cuboid(Math.max(0.0001, b.hw / 8 - MARGE_LATERALE), b.hh / 8);
      const hit = this.world.castShape({ x: p.x + b.cx / 8, y: p.y + b.cy / 8 }, 0, bas, forme, 0, PORTEE_VISEE, false, undefined, undefined, undefined, p.body);
      if (hit && hit.time_of_impact < toi) toi = hit.time_of_impact;
    }
    // Les deux traits : un rayon par bord (rentré de `MARGE_LATERALE`), parti du point le plus bas de la pièce à cette abscisse.
    const traits = [cadre.gauche / 8, cadre.droite / 8].map((bord, i) => {
      const xRel = bord + (i === 0 ? MARGE_LATERALE : -MARGE_LATERALE);
      let yRel = Infinity;
      for (const b of bs) if (xRel >= (b.cx - b.hw) / 8 && xRel <= (b.cx + b.hw) / 8) yRel = Math.min(yRel, (b.cy - b.hh) / 8);
      const yHaut = p.y + yRel;
      const hit = this.world.castRay(new this.R.Ray({ x: p.x + xRel, y: yHaut }, bas), PORTEE_VISEE, true, undefined, undefined, undefined, p.body!);
      return { x: p.x + bord, yHaut, yBas: hit ? yHaut - hit.timeOfImpact : null };
    });
    return { traits, arrivee: toi === Infinity ? null : { x: p.x, y: p.y - toi } };
  }

  /** Libère la mémoire WebAssembly du monde. */
  dispose(): void {
    this.world.free();
  }
}
