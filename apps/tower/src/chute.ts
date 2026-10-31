import { NIVEAU_MER } from "./profondeurs";

// La chute d'une pièce tombée (lot T5), **affichage seulement** : la simulation retire la pièce à l'instant où son centre passe sous le niveau de la plateforme (une vie perdue) ; le décor lui
// laisse finir sa chute, sur sa lancée, jusqu'à la mer — où elle disparaît dans une gerbe d'eau. Pur : la scène n'ajoute que le dessin. (`profondeurs.ts` : où elle passe, devant la mer du fond.)

const G = 9.81;
/** Dans l'eau la pièce ralentit (sans rebond) : elle coule derrière l'eau de devant, qui la cache. */
const FREIN_EAU = 0.9;
/** Sous la surface, la pièce est retirée du décor quand elle est plus bas que cela de plus (m). */
const PROFONDEUR_RETRAIT = 1;

export interface ChuteDecor {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  w: number;
  /** Le rayon de la pièce (m) : son point le plus bas touche l'eau quand `y − rayon` atteint le niveau de la mer. */
  rayon: number;
  /** Le « plouf » a eu lieu. */
  plouf: boolean;
  /** Plus rien à dessiner. */
  finie: boolean;
}

/** La chute d'une pièce à l'instant où la simulation la perd : sa position, son angle et les vitesses estimées (m/s, rad/s). */
export function commencerChute(x: number, y: number, angle: number, vx: number, vy: number, w: number, rayon: number): ChuteDecor {
  return { x, y, angle, vx, vy, w, rayon, plouf: false, finie: false };
}

/** Avance de `dt` secondes ; rend vrai l'instant (une seule fois) où la pièce touche l'eau : c'est là que naît la gerbe et que le « plouf » sonne. */
export function avancerChute(c: ChuteDecor, dt: number): boolean {
  if (c.finie) return false;
  const enEau = c.plouf;
  c.vy -= G * dt * (enEau ? 0.25 : 1);
  if (enEau) {
    const f = Math.exp(-FREIN_EAU * 3 * dt);
    c.vx *= f;
    c.vy *= f;
    c.w *= f;
  }
  c.x += c.vx * dt;
  c.y += c.vy * dt;
  c.angle += c.w * dt;
  let touche = false;
  if (!c.plouf && c.y - c.rayon <= NIVEAU_MER) {
    c.plouf = true;
    touche = true;
  }
  if (c.plouf && c.y + c.rayon < NIVEAU_MER - PROFONDEUR_RETRAIT) c.finie = true;
  return touche;
}

/** Le rayon d'une pièce pour la chute : la plus grande distance d'un coin de ses boîtes à son centre de masse (huitièmes de mètre → mètres). */
export function rayonDePiece(boites: readonly { cx: number; cy: number; hw: number; hh: number }[]): number {
  let r2 = 0;
  for (const b of boites) for (const sx of [-1, 1]) for (const sy of [-1, 1]) r2 = Math.max(r2, ((b.cx + sx * b.hw) / 8) ** 2 + ((b.cy + sy * b.hh) / 8) ** 2);
  return Math.sqrt(r2);
}
