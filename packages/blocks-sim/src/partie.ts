import { BONUS_PLATEAU_VIDE, COLONNES, NB_ACTIONS, PLAFOND_PIECES, POINTS_EFFACEMENT, POSES_SANS_EFFACEMENT_MAX, type ReglageTirage, TAILLE_SERIE } from "./constantes";
import type { ContenuJouable } from "./generateur";
import { resoudreReglage, serieAuRang } from "./suite";
import { compterPleines, effacer, estVide, type Grille, peutPoser, pleines, poser, tientQuelquePart, VIDE } from "./grille";
import { PIECES, type Piece } from "./pieces";

// LA PARTIE (seed § 3 et 5, règles v2 du lot B8, v3 du lot B8c : **la partie tire elle-même ses séries**, pour la grille du moment — `suite.ts`). L'état : la grille (deux entiers), le rang de la série, les pièces restantes de la série (trois emplacements, vides une fois posées), le score, le combo, les poses sans effacement
// depuis le dernier, le combo maximal atteint, la fin. **On reçoit les pièces par séries de trois, et on les pose dans l'ordre qu'on veut** ; la série suivante arrive quand la troisième est posée (aucune pièce suivante n'est montrée).
// **Une action = (emplacement 0 à 2, colonne, ligne)**, écrite sur un octet : `emplacement × 64 + ligne × 8 + colonne` (0 à 191), la case (colonne, ligne) étant le coin haut-gauche de la boîte de la pièce. Une action illégale
// (emplacement vide, case occupée, pièce qui déborde) est rejetée **sans changer l'état**. Après chaque pose :
//   1. +1 point par case posée ;
//   2. toutes les lignes et colonnes pleines sont effacées ENSEMBLE (une case au croisement compte pour les deux) ; `n` = leur nombre ;
//   3. si n > 0 : le combo augmente de 1, l'effacement rapporte `10 × n × n × combo`, le compteur de poses sans effacement repart à 0 ;
//   4. sinon ce compteur augmente de 1 et, à la 3ᵉ pose sans effacement, le combo retombe à 0 ;
//   5. si la grille est vide après un effacement : +300 (fixe).
// Fin : dès qu'**aucune des pièces restantes** de la série ne tient nulle part (une pièce qui ne tient nulle part est « grisée » : `grisee`), ou que le plafond de pièces est atteint.

export type Raison = "bloquee" | "plafond";
/** Le résultat d'un bot, qui peut s'être arrêté avant la fin (lot B8b : un nombre fixe de pièces). Ce n'est jamais ce que le serveur classe. */
export type ResultatDeBot = Omit<Resultat, "raison"> & { raison: Raison | "arret" };

/** Ce qu'une pose a fait : de quoi dessiner le gain, l'effacement et le combo (rien de ceci n'est classé). */
export interface Pose {
  /** L'emplacement (0 à 2) de la pièce posée dans la série. */
  emplacement: number;
  col: number;
  ligne: number;
  piece: Piece;
  /** Les points des cases posées. */
  cases: number;
  /** Les lignes pleines (bit `l` = ligne `l`) et les colonnes pleines (bit `c` = colonne `c`) effacées. */
  lignes: number;
  colonnes: number;
  /** `n` : lignes + colonnes effacées. */
  n: number;
  /** Les points de l'effacement (`10 × n × n × combo`), 0 sans effacement. */
  effacement: number;
  /** +300 si le plateau est vide. */
  plateauVide: boolean;
  /** Le total gagné par la pose. */
  gain: number;
  /** Le combo après la pose. */
  combo: number;
  /** Le combo a-t-il été perdu par cette pose (3ᵉ sans effacement, et il était > 0) ? */
  comboPerdu: boolean;
  /** Cette pose était la dernière de sa série : une nouvelle série vient d'arriver (si la partie continue). */
  serieNouvelle: boolean;
}

export interface Resultat {
  score: number;
  /** Le combo maximal atteint (le deuxième critère du classement). */
  combo: number;
  /** Le nombre de poses. */
  poses: number;
  raison: Raison;
}

/** L'action d'une pose : `emplacement × 64 + ligne × 8 + colonne`. */
export const actionDe = (emplacement: number, col: number, ligne: number): number => emplacement * 64 + ligne * COLONNES + col;
export const emplacementDe = (action: number): number => Math.floor(action / 64);
export const colonneDe = (action: number): number => action % COLONNES;
export const ligneDe = (action: number): number => Math.floor((action % 64) / COLONNES);
/** Une action est-elle écrite correctement (un entier de 0 à 191) ? Ce n'est pas dire qu'elle est légale. */
export const actionBienFormee = (a: unknown): a is number => typeof a === "number" && Number.isInteger(a) && a >= 0 && a < NB_ACTIONS;

export class Partie {
  grille: Grille;
  /** Le nombre de poses faites (= l'index, dans la suite, de la prochaine pièce à tirer pour la série en cours : `3 × serie + 3`, à la fin d'une série). */
  poses = 0;
  /** Le rang de la série en cours (0 pour la première). */
  serie = 0;
  score = 0;
  combo = 0;
  sansEffacement = 0;
  comboMax = 0;
  fin: Raison | null = null;
  /** Les trois emplacements de la série en cours : la pièce, ou `null` une fois posée. */
  private restantes: (Piece | null)[] = [];
  private readonly reglage: ReglageTirage;

  constructor(readonly contenu: ContenuJouable) {
    this.grille = contenu.depart ?? VIDE;
    this.reglage = resoudreReglage(contenu.reglage);
    this.remplir();
    this.verifierFin();
  }

  /** La série de rang `serie` arrive : celle qu'un scénario impose, sinon celle que le tirage donne pour la grille du moment (après les effacements de la dernière pose). */
  private remplir(): void {
    const imposee = this.contenu.imposees?.[this.serie];
    const pieces = (imposee ? imposee.map((id) => PIECES[id]!) : serieAuRang(this.contenu.graine, this.serie, this.grille, this.reglage, PLAFOND_PIECES)).slice(0, Math.max(0, PLAFOND_PIECES - this.serie * TAILLE_SERIE)); // le plafond coupe la dernière série
    this.restantes = Array.from({ length: TAILLE_SERIE }, (_, k) => pieces[k] ?? null);
  }

  /** Les trois emplacements de la série en cours (une pièce, ou `null` quand elle est posée) ; vide une fois la partie finie. */
  get pieces(): readonly (Piece | null)[] {
    return this.fin === null ? this.restantes : [null, null, null];
  }
  /** La pièce d'un emplacement, ou `null` (posée, hors partie, ou partie finie). */
  piece(emplacement: number): Piece | null {
    return this.fin === null ? (this.restantes[emplacement] ?? null) : null;
  }
  /** Les pièces de la série en cours, même une fois la partie finie (la fin les montre grisées). */
  get dernieresPieces(): readonly (Piece | null)[] {
    return this.restantes;
  }
  get finie(): boolean {
    return this.fin !== null;
  }
  /** Combien de pièces restent à poser dans la série en cours. */
  get restantesCount(): number {
    return this.restantes.filter((p) => p !== null).length;
  }

  /** Cette pièce ne tient nulle part : elle est grisée (et ne se saisit pas). Faux pour un emplacement vide. */
  grisee(emplacement: number): boolean {
    const p = this.restantes[emplacement];
    return p != null && !tientQuelquePart(this.grille, p);
  }

  /** La pièce de cet emplacement peut-elle se poser ici ? */
  legale(emplacement: number, col: number, ligne: number): boolean {
    const p = this.piece(emplacement);
    return p !== null && peutPoser(this.grille, p, col, ligne);
  }

  /** Les lignes et colonnes qui seraient effacées par cette pose (pour les allumer pendant le survol), ou `null` si elle est illégale. */
  apercu(emplacement: number, col: number, ligne: number): { lignes: number; colonnes: number } | null {
    const p = this.piece(emplacement);
    if (p === null || !peutPoser(this.grille, p, col, ligne)) return null;
    return pleines(poser(this.grille, p, col, ligne));
  }

  /** Pose la pièce de l'emplacement ; rend ce qu'elle a fait, ou `null` (sans rien changer) si l'action est illégale ou la partie finie. */
  poser(emplacement: number, col: number, ligne: number): Pose | null {
    const p = this.piece(emplacement);
    if (p === null || !peutPoser(this.grille, p, col, ligne)) return null;
    let g = poser(this.grille, p, col, ligne);
    const m = pleines(g);
    const n = compterPleines(m);
    let effacement = 0;
    let plateauVide = false;
    let comboPerdu = false;
    if (n > 0) {
      g = effacer(g, m.lignes, m.colonnes);
      this.combo++;
      effacement = POINTS_EFFACEMENT * n * n * this.combo;
      this.sansEffacement = 0;
      plateauVide = estVide(g);
      if (this.combo > this.comboMax) this.comboMax = this.combo;
    } else {
      this.sansEffacement++;
      if (this.sansEffacement >= POSES_SANS_EFFACEMENT_MAX && this.combo > 0) {
        this.combo = 0;
        comboPerdu = true;
      }
    }
    const gain = p.cases + effacement + (plateauVide ? BONUS_PLATEAU_VIDE : 0);
    this.score += gain;
    this.grille = g;
    this.poses++;
    this.restantes[emplacement] = null;
    const serieNouvelle = this.restantes.every((x) => x === null);
    if (serieNouvelle) {
      this.serie++;
      this.remplir();
    }
    this.verifierFin();
    return { emplacement, col, ligne, piece: p, cases: p.cases, lignes: n > 0 ? m.lignes : 0, colonnes: n > 0 ? m.colonnes : 0, n, effacement, plateauVide, gain, combo: this.combo, comboPerdu, serieNouvelle };
  }

  /** Joue une action (`emplacement × 64 + ligne × 8 + colonne`) ; `null` si elle est illégale (rien ne change). */
  jouerAction(action: number): Pose | null {
    return actionBienFormee(action) ? this.poser(emplacementDe(action), colonneDe(action), ligneDe(action)) : null;
  }

  private verifierFin(): void {
    if (this.poses >= PLAFOND_PIECES) this.fin = "plafond";
    else if (!this.restantes.some((p) => p !== null && tientQuelquePart(this.grille, p))) this.fin = "bloquee";
  }

  resultat(): Resultat | null {
    return this.fin === null ? null : { score: this.score, combo: this.comboMax, poses: this.poses, raison: this.fin };
  }

  /** Le résultat à cet instant, partie finie ou non (lot B8b : un bot arrêté après un nombre fixe de pièces rend son score du moment ; `raison` : `arret` s'il n'a pas fini). Ne se classe jamais. */
  instantane(): ResultatDeBot {
    return { score: this.score, combo: this.comboMax, poses: this.poses, raison: this.fin ?? "arret" };
  }
}

/** Pourquoi un rejeu est refusé (jamais une exception brute). */
export type CodeRejeu = "action_illegale" | "apres_la_fin" | "non_terminee" | "trop_longue";
export class ErreurRejeu extends Error {
  constructor(
    readonly code: CodeRejeu,
    message: string,
  ) {
    super(message);
    this.name = "ErreurRejeu";
  }
}

/**
 * Rejoue une partie entière : la suite des actions (octets `emplacement × 64 + ligne × 8 + colonne`). Refuse — par une `ErreurRejeu` — une action illégale (emplacement vide, case occupée, hors de la grille), une action après la fin,
 * une suite au-delà du plafond et une partie qui n'est pas terminée à la dernière action. C'est le code du jeu ET du serveur.
 */
export function jouer(contenu: ContenuJouable, actions: readonly number[]): Resultat {
  if (actions.length > PLAFOND_PIECES) throw new ErreurRejeu("trop_longue", "trop de poses");
  const p = new Partie(contenu);
  for (let i = 0; i < actions.length; i++) {
    if (p.finie) throw new ErreurRejeu("apres_la_fin", `action ${i} après la fin de la partie`);
    if (p.jouerAction(actions[i]!) === null) throw new ErreurRejeu("action_illegale", `action ${i} illégale`);
  }
  const r = p.resultat();
  if (r === null) throw new ErreurRejeu("non_terminee", "la partie n'est pas terminée");
  return r;
}
