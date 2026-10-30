import type { PieceKind, VuePartie } from "@cdj/tower-sim";

// Le fantôme local (lot T1) : la silhouette de **ta meilleure partie de la session**, gardée en mémoire — rien n'est écrit dans le stockage du navigateur (le fantôme du serveur, celui
// de la meilleure tour du jour, viendra au lot T4). C'est la position finale des pièces restées sur la tour ; la meilleure est celle de la plus grande hauteur finale stable,
// puis des vies, puis du temps (le départage du score).
export interface FantomePiece {
  kind: PieceKind;
  rot: number;
  x: number;
  y: number;
  angle: number;
}

export interface Fantome {
  hauteurMm: number;
  vies: number;
  ticks: number;
  pieces: FantomePiece[];
}

/** La partie `b` bat-elle `a` ? Hauteur, puis vies, puis moins de temps. */
export function meilleure(a: Pick<Fantome, "hauteurMm" | "vies" | "ticks"> | null, b: Pick<Fantome, "hauteurMm" | "vies" | "ticks">): boolean {
  if (!a) return true;
  if (b.hauteurMm !== a.hauteurMm) return b.hauteurMm > a.hauteurMm;
  if (b.vies !== a.vies) return b.vies > a.vies;
  return b.ticks < a.ticks;
}

/** Le fantôme d'une partie finie : les pièces encore sur la tour (ni perdues ni abandonnées). */
export function fantomeDe(vue: VuePartie, resultat: { hauteurMm: number; vies: number; ticks: number }): Fantome {
  return {
    hauteurMm: resultat.hauteurMm,
    vies: resultat.vies,
    ticks: resultat.ticks,
    pieces: vue.pieces.filter((p) => p.etat === "libre").map((p) => ({ kind: p.kind, rot: p.rot, x: p.x, y: p.y, angle: p.angle })),
  };
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
