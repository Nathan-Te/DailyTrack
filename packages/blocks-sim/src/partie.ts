import { BONUS_PLATEAU_VIDE, COLONNES, PLAFOND_PIECES, POINTS_EFFACEMENT, POSES_SANS_EFFACEMENT_MAX } from "./constantes";
import type { Contenu } from "./generateur";
import { compterPleines, effacer, estVide, type Grille, peutPoser, pleines, poser, tientQuelquePart, VIDE } from "./grille";
import { PIECES, type Piece } from "./pieces";

// LA PARTIE (seed § 3 et 5). L'état : la grille (deux entiers), l'index de la pièce du moment, le score, le combo, les poses sans effacement depuis le dernier, le combo maximal atteint, la fin.
// **Une action = la case (colonne, ligne) du coin haut-gauche de la boîte de la pièce du moment**, écrite sur un octet : `ligne × 8 + colonne` (0 à 63). Une action illégale est rejetée **sans changer l'état**.
// Après chaque pose :
//   1. +1 point par case posée ;
//   2. toutes les lignes et colonnes pleines sont effacées ENSEMBLE (une case au croisement compte pour les deux) ; `n` = leur nombre ;
//   3. si n > 0 : le combo augmente de 1, l'effacement rapporte `10 × n × n × combo`, le compteur de poses sans effacement repart à 0 ;
//   4. sinon ce compteur augmente de 1 et, à la 3ᵉ pose sans effacement, le combo retombe à 0 ;
//   5. si la grille est vide après un effacement : +300 (fixe).
// Fin : dès que la pièce du moment ne tient nulle part, ou que le plafond de pièces est atteint.

export type Raison = "bloquee" | "plafond";

/** Ce qu'une pose a fait : de quoi dessiner le gain, l'effacement et le combo (rien de ceci n'est classé). */
export interface Pose {
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
}

export interface Resultat {
  score: number;
  /** Le combo maximal atteint (le deuxième critère du classement). */
  combo: number;
  /** Le nombre de poses. */
  poses: number;
  raison: Raison;
}

export const actionDe = (col: number, ligne: number): number => ligne * COLONNES + col;
export const colonneDe = (action: number): number => action % COLONNES;
export const ligneDe = (action: number): number => Math.floor(action / COLONNES);

export class Partie {
  grille: Grille;
  /** L'index de la pièce du moment dans la suite = le nombre de poses faites. */
  rang = 0;
  score = 0;
  combo = 0;
  sansEffacement = 0;
  comboMax = 0;
  fin: Raison | null = null;

  constructor(readonly contenu: Pick<Contenu, "suite" | "depart">) {
    this.grille = contenu.depart ?? VIDE;
    this.verifierFin();
  }

  /** La pièce du moment, ou `null` une fois la partie finie. */
  get piece(): Piece | null {
    return this.fin === null ? PIECES[this.contenu.suite[this.rang]!]! : null;
  }
  /** La pièce suivante (information seulement), ou `null` s'il n'y en a plus. */
  get suivante(): Piece | null {
    return this.fin === null && this.rang + 1 < PLAFOND_PIECES ? PIECES[this.contenu.suite[this.rang + 1]!]! : null;
  }
  get finie(): boolean {
    return this.fin !== null;
  }
  get poses(): number {
    return this.rang;
  }

  /** La pièce du moment peut-elle se poser ici ? */
  legale(col: number, ligne: number): boolean {
    const p = this.piece;
    return p !== null && peutPoser(this.grille, p, col, ligne);
  }

  /** Les lignes et colonnes qui seraient effacées par cette pose (pour les allumer pendant le survol), ou `null` si elle est illégale. */
  apercu(col: number, ligne: number): { lignes: number; colonnes: number } | null {
    const p = this.piece;
    if (p === null || !peutPoser(this.grille, p, col, ligne)) return null;
    return pleines(poser(this.grille, p, col, ligne));
  }

  /** Pose la pièce du moment ; rend ce qu'elle a fait, ou `null` (sans rien changer) si l'action est illégale ou la partie finie. */
  poser(col: number, ligne: number): Pose | null {
    const p = this.piece;
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
    this.rang++;
    this.verifierFin();
    return { col, ligne, piece: p, cases: p.cases, lignes: n > 0 ? m.lignes : 0, colonnes: n > 0 ? m.colonnes : 0, n, effacement, plateauVide, gain, combo: this.combo, comboPerdu };
  }

  private verifierFin(): void {
    if (this.rang >= PLAFOND_PIECES) this.fin = "plafond";
    else if (!tientQuelquePart(this.grille, PIECES[this.contenu.suite[this.rang]!]!)) this.fin = "bloquee";
  }

  resultat(): Resultat | null {
    return this.fin === null ? null : { score: this.score, combo: this.comboMax, poses: this.rang, raison: this.fin };
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
 * Rejoue une partie entière : la suite des actions (octets `ligne × 8 + colonne`). Refuse — par une `ErreurRejeu` — une action illégale, une action après la fin, une suite au-delà du plafond et une partie qui
 * n'est pas terminée à la dernière action. C'est le code du jeu ET du serveur.
 */
export function jouer(contenu: Pick<Contenu, "suite" | "depart">, actions: readonly number[]): Resultat {
  if (actions.length > PLAFOND_PIECES) throw new ErreurRejeu("trop_longue", "trop de poses");
  const p = new Partie(contenu);
  for (let i = 0; i < actions.length; i++) {
    if (p.finie) throw new ErreurRejeu("apres_la_fin", `action ${i} après la fin de la partie`);
    const a = actions[i]!;
    if (!Number.isInteger(a) || a < 0 || a >= 64 || p.poser(colonneDe(a), ligneDe(a)) === null) throw new ErreurRejeu("action_illegale", `action ${i} illégale`);
  }
  const r = p.resultat();
  if (r === null) throw new ErreurRejeu("non_terminee", "la partie n'est pas terminée");
  return r;
}
