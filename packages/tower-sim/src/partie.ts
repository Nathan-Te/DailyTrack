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
import type RAPIER from "@dimforge/rapier2d-deterministic-compat";
import type { PieceKind } from "../lab/interface";
import {
  COMMANDE,
  DEMI_CASE_8,
  LIMITE_X8,
  MARGE_CONTACT,
  MARGE_REFUS,
  NIVEAU_PLATEFORME,
  PHYSIQUE,
  REGLAGES_DEFAUT,
  type Reglages,
  STABILISATION_MAX_TICKS,
  TICKS_PAR_SECONDE,
  VITESSE_CALME,
} from "./constantes";
import type { Rapier } from "./rapier";
import { boites, enMillimetres, sommetPiece } from "./sommet";

/** Une suite de pièces et une plateforme : le contenu d'une partie (au lot T2, celui du jour). */
export interface Scenario {
  nom: string;
  pieces: readonly PieceKind[];
  /** Demi-largeur de la plateforme, en huitièmes de mètre. Son dessus est à y = 0. */
  plateformeDemi8: number;
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
  x: number;
  y: number;
  angle: number;
  endormie: boolean;
  /** Plus haut point (mètres), mis à jour avec la position. */
  sommet: number;
  /** Devient vrai la première fois que la pièce est calme (posée pour de bon sur la tour) et le reste : la hauteur en direct ne saute pas quand une pièce tangue. */
  stabilisee: boolean;
}

export class Partie {
  private readonly R: Rapier;
  private readonly world: RAPIER.World;
  private readonly pieces: Piece[] = [];
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

  /** `options.stabilisationMaxTicks` : seulement pour les tests (l'attente maximale de stabilisation, `STABILISATION_MAX_TICKS` par défaut). */
  constructor(
    R: Rapier,
    readonly scenario: Scenario,
    readonly reglages: Readonly<Reglages> = REGLAGES_DEFAUT,
    private readonly options: { stabilisationMaxTicks?: number } = {},
  ) {
    this.R = R;
    this.vies = reglages.vies;
    const world = new R.World({ x: 0, y: -PHYSIQUE.gravite });
    world.timestep = 1 / TICKS_PAR_SECONDE;
    world.integrationParameters.numSolverIterations = PHYSIQUE.iterations;
    world.createCollider(
      R.ColliderDesc.cuboid(scenario.plateformeDemi8 / 8, 0.5).setTranslation(0, -0.5 + NIVEAU_PLATEFORME).setFriction(PHYSIQUE.frottement).setRestitution(PHYSIQUE.rebond),
    );
    this.world = world;
    this.apparaitre();
  }

  get tick(): number {
    return this.ticks;
  }

  get etape(): Phase {
    return this.phase;
  }

  /** Le résultat figé, ou null tant que la partie n'est pas finie. */
  resultat(): Resultat | null {
    return this.figee;
  }

  /** Avance d'un tick avec le masque de commandes `commandes` (voir `COMMANDE`). Sans effet une fois la partie finie. */
  avancer(commandes: number): void {
    if (this.phase === "fini") return;
    this.ticks++;
    if (this.phase === "jeu" && this.active) this.piloter(commandes | 0);
    this.world.step();
    this.apresPas();
  }

  // ---- la pièce active ----

  private piloter(commandes: number): void {
    const p = this.active!;
    if (commandes & COMMANDE.GAUCHE) this.deplacer(p, -DEMI_CASE_8);
    if (commandes & COMMANDE.DROITE) this.deplacer(p, DEMI_CASE_8);
    if (commandes & COMMANDE.TOURNER) this.tourner(p);
    const facteur = commandes & COMMANDE.DESCENDRE ? this.reglages.facteurDescente : 1;
    const vy = (this.reglages.vitesseChute8 * facteur) / 8;
    p.body!.setLinvel({ x: 0, y: -vy }, true);
    // Au pas qui vient la pièce descend de vy / 60 : si elle toucherait (à la marge près) la plateforme ou une pièce, elle lâche maintenant.
    if (this.touche(p, p.x, p.y - vy / TICKS_PAR_SECONDE, MARGE_CONTACT)) this.lacher(p);
  }

  private deplacer(p: Piece, delta8: number): void {
    const x8 = p.x8 + delta8;
    if (Math.abs(x8) > LIMITE_X8) return;
    if (this.touche(p, x8 / 8, p.y, -MARGE_REFUS)) return;
    p.x8 = x8;
    p.x = x8 / 8;
    p.body!.setTranslation({ x: p.x, y: p.y }, true);
  }

  /** Un quart de tour dans le sens des aiguilles d'une montre, autour du centre de masse ; refusé s'il entre dans une pièce. */
  private tourner(p: Piece): void {
    const rot = (p.rot + 3) & 3;
    if (this.toucheBoites(boites(p.kind, rot), p.body!, p.x, p.y, -MARGE_REFUS)) return;
    this.world.removeRigidBody(p.body!);
    p.rot = rot;
    p.body = this.creerCorps(p);
  }

  private lacher(p: Piece): void {
    p.body!.setGravityScale(1, true);
    p.etat = "libre";
    this.posees++;
    this.active = null;
  }

  private touche(p: Piece, x: number, y: number, marge: number): boolean {
    return this.toucheBoites(boites(p.kind, p.rot), p.body!, x, y, marge);
  }

  /** Une boîte de la forme, agrandie de `marge` (réduite si négative), recouvre-t-elle un autre corps que `corps` ? */
  private toucheBoites(bs: readonly { cx: number; cy: number; hw: number; hh: number }[], corps: RAPIER.RigidBody, x: number, y: number, marge: number): boolean {
    let touche = false;
    for (const b of bs) {
      const shape = new this.R.Cuboid(Math.max(0.0001, b.hw / 8 + marge), Math.max(0.0001, b.hh / 8 + marge));
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
    for (const b of boites(p.kind, p.rot)) {
      this.world.createCollider(
        R.ColliderDesc.cuboid(b.hw / 8, b.hh / 8).setTranslation(b.cx / 8, b.cy / 8).setDensity(1).setFriction(PHYSIQUE.frottement).setRestitution(PHYSIQUE.rebond),
        body,
      );
    }
    return body;
  }

  /** Fait naître la pièce suivante, centrée sur la plateforme, au-dessus du point le plus haut de la tour. */
  private apparaitre(): void {
    const id = this.distribuees;
    const kind = this.scenario.pieces[id]!;
    const bs = boites(kind, 0);
    let bas8 = 0;
    let gauche8 = Infinity;
    let droite8 = -Infinity;
    for (const b of bs) {
      bas8 = Math.min(bas8, b.cy - b.hh);
      gauche8 = Math.min(gauche8, b.cx - b.hw);
      droite8 = Math.max(droite8, b.cx + b.hw);
    }
    const x8 = -Math.floor((gauche8 + droite8) / 2);
    let sommet = NIVEAU_PLATEFORME;
    for (const q of this.pieces) if (q.etat === "libre" && q.sommet > sommet) sommet = q.sommet;
    const y8 = Math.ceil(sommet * 8) + this.reglages.hauteurApparition8 - bas8;
    const p: Piece = { id, kind, rot: 0, etat: "active", body: null, x8, x: x8 / 8, y: y8 / 8, angle: 0, endormie: false, sommet: y8 / 8, stabilisee: false };
    p.body = this.creerCorps(p);
    this.pieces.push(p);
    this.active = p;
    this.distribuees++;
  }

  // ---- après le pas ----

  private apresPas(): void {
    // 1. positions, pièces perdues.
    for (const p of this.pieces) {
      if (!p.body) continue;
      if (p.etat === "active") {
        const t = p.body.translation();
        p.x = t.x;
        p.y = t.y;
        continue;
      }
      // Une pièce endormie n'a pas bougé : sa position et son sommet gardés sont ceux d'avant (elle se réveille si une autre la heurte : `isSleeping` est relu à chaque pas).
      const dort = p.body.isSleeping();
      if (dort && p.endormie) continue;
      p.endormie = dort;
      const t = p.body.translation();
      p.x = t.x;
      p.y = t.y;
      p.angle = p.body.rotation();
      p.sommet = sommetPiece(p.kind, p.rot, p.y, p.angle);
      if (p.y < NIVEAU_PLATEFORME) this.perdre(p);
      else if (!p.stabilisee) {
        if (p.endormie) p.stabilisee = true;
        else {
          const v = p.body.linvel();
          p.stabilisee = v.x * v.x + v.y * v.y < VITESSE_CALME * VITESSE_CALME;
        }
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
    // 3. la stabilisation.
    if (this.phase === "stabilisation") {
      const stable = this.pieces.every((p) => p.etat !== "libre" || p.endormie);
      if (stable || this.ticks - this.ticksFin >= (this.options.stabilisationMaxTicks ?? STABILISATION_MAX_TICKS)) this.geler();
    }
  }

  /** Une pièce passe sous le niveau de la plateforme : retirée, une vie de moins (une seule fois : elle n'existe plus). */
  private perdre(p: Piece): void {
    if (p.body) this.world.removeRigidBody(p.body);
    p.body = null;
    if (p === this.active) this.active = null;
    p.etat = "perdue";
    this.tombees++;
    if (this.vies > 0) this.vies--;
  }

  private finir(motif: "pieces" | "vies"): void {
    if (this.active) {
      // Plus de vie avec une pièce en l'air : elle est abandonnée, elle ne compte ni comme posée ni comme tombée.
      this.world.removeRigidBody(this.active.body!);
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
    const suivante = this.distribuees < this.scenario.pieces.length ? this.scenario.pieces[this.distribuees]! : null;
    return {
      tick: this.ticks,
      phase: this.phase,
      pieces: this.pieces.map((p) => ({ id: p.id, kind: p.kind, rot: p.rot, etat: p.etat, x: p.x, y: p.y, angle: p.angle, endormie: p.endormie })),
      active: this.active ? this.active.id : -1,
      suivante,
      numero: this.distribuees,
      total: this.scenario.pieces.length,
      vies: this.vies,
      posees: this.posees,
      tombees: this.tombees,
      hauteurMm: this.hauteurMm,
      hauteurMaxMm: this.hauteurMaxMm,
    };
  }

  /** Libère la mémoire WebAssembly du monde. */
  dispose(): void {
    this.world.free();
  }
}
