import type { PieceKind, Rediffusion, Taille } from "@cdj/tower-sim";

// Le fantôme local (lots T1 et T2) : la silhouette de **ta meilleure partie de la session**, gardée en mémoire — rien n'est écrit dans le stockage du navigateur (le fantôme du serveur, celui
// de la meilleure tour du jour, viendra au lot T4). La meilleure est celle de la plus grande hauteur finale stable, puis des vies, puis du temps (le départage du score).
//
// Lot T2 : ce qu'on GARDE est la **rediffusion** de la meilleure partie (`Rediffusion`, et son texte `base64url`, celui que le serveur recevra) ; la silhouette en DÉRIVE : c'est l'état final
// de cette partie **rejouée** (les pièces encore sur la tour), calculé par tranches pour ne pas figer l'écran de fin. Même chemin que le fantôme du premier du classement (lot T4).
export interface FantomePiece {
  kind: PieceKind;
  rot: number;
  taille: Taille;
  x: number;
  y: number;
  angle: number;
}

export interface Fantome {
  hauteurMm: number;
  vies: number;
  ticks: number;
  /** La rediffusion de la partie et son texte. */
  rediffusion: Rediffusion;
  code: string;
  /** La silhouette : null tant que le rejeu n'est pas fini. */
  pieces: FantomePiece[] | null;
}

/** La partie `b` bat-elle `a` ? Hauteur, puis vies, puis moins de temps. */
export function meilleure(a: Pick<Fantome, "hauteurMm" | "vies" | "ticks"> | null, b: Pick<Fantome, "hauteurMm" | "vies" | "ticks">): boolean {
  if (!a) return true;
  if (b.hauteurMm !== a.hauteurMm) return b.hauteurMm > a.hauteurMm;
  if (b.vies !== a.vies) return b.vies > a.vies;
  return b.ticks < a.ticks;
}

/** Garde en mémoire la meilleure partie de la session. */
export class MemoireFantome {
  private meilleur: Fantome | null = null;
  /** Propose une partie finie ; rend vrai si elle devient la meilleure. */
  proposer(f: Fantome): boolean {
    if (!meilleure(this.meilleur, f)) return false;
    this.meilleur = f;
    return true;
  }
  get(): Fantome | null {
    return this.meilleur;
  }
}
