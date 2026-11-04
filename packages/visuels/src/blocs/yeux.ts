import type { Expression } from "./expression";

// La GÉOMÉTRIE des yeux d'une pièce (lot T5 de Tower, reprise par le module commun au lot DA1), **indépendante du moteur de rendu** : deux yeux (contour d'encre, blanc, pupille) et deux sourcils, posés dans la plus
// grande boîte de la pièce, **droits dans son repère**. `expression.ts` (pure) dit comment les dessiner ; `disposerYeux` en tire des nombres — la position et l'échelle de chaque œil, la pupille, le sourcil — que
// chaque dessinateur pose à sa façon (un maillage Three.js, un chemin Canvas 2D). Un œil qui se ferme s'écrase en hauteur (un trait d'encre) ; les sourcils sont deux barres d'encre ; aplats seulement.
// L'ordre d'empilement est le même partout : l'encre, le blanc, la pupille, puis le sourcil (`PROFONDEUR_OEIL`).

/** Les distances de l'œil normal, en mètres pour une pièce de taille 1 (celles d'avant le lot T5 de Tower). */
export const ECART = 0.17;
export const R_ENCRE = 0.21;
export const R_BLANC = 0.18;
export const R_PUPILLE = 0.075;
/** Le disque est un polygone de 20 côtés dans les deux dessinateurs (c'est celui de Three.js : `CircleGeometry(1, 20)`), pour que le même œil se dessine de la même façon. */
export const COTES_DISQUE = 20;
/** La profondeur de chaque couche d'un œil (au-dessus de la couleur de la pièce, à 0,01). */
export const PROFONDEUR_OEIL = { encre: 0.02, blanc: 0.03, pupille: 0.04, sourcil: 0.045 } as const;

/** Un œil posé : le groupe (centre et échelle, en repère de la pièce), les trois disques dans le repère du groupe, le sourcil dans le repère de la pièce. */
export interface PoseOeil {
  cote: -1 | 1;
  /** Le centre de l'œil et son échelle (l'ouverture ; la hauteur est écrasée par la fermeture). Les disques ci-dessous sont dans ce repère. */
  x: number;
  y: number;
  sx: number;
  sy: number;
  rEncre: number;
  rBlanc: number;
  pupille: { x: number; y: number; r: number };
  /** Le sourcil, dans le repère de la pièce : centre, largeur, hauteur, rotation (rad, sens trigonométrique). */
  sourcil: { visible: boolean; x: number; y: number; w: number; h: number; rot: number };
}

/**
 * Pose une expression : le centre et l'échelle de chaque œil (l'ouverture, écrasée par la fermeture), la place et la taille des pupilles (avec leur tremblement), les sourcils. `ex`, `ey` : le centre des yeux dans la pièce ;
 * `echelle` : la taille des yeux ; `t` : le temps d'affichage (secondes) ; `phase` : la phase de tremblement de la pièce (deux pièces n'ont pas la même). Des yeux neufs à chaque appel (comme `expressionDe` rend une expression neuve).
 */
export function disposerYeux(ex: number, ey: number, echelle: number, x: Expression, t: number, phase = 0): PoseOeil[] {
  const libre = (R_BLANC - R_PUPILLE * x.pupille) * echelle * 0.85;
  const visible = x.sourcils && x.fermeture < 0.9;
  return ([-1, 1] as const).map((cote) => {
    const tx = x.tremble > 0 ? Math.sin(t * 41 + phase + cote) * x.tremble : 0;
    const ty = x.tremble > 0 ? Math.cos(t * 37 + phase * 1.7 + cote) * x.tremble : 0;
    const cx = ex + cote * ECART * echelle;
    return {
      cote,
      x: cx,
      y: ey,
      sx: x.ouverture,
      sy: x.ouverture * (1 - 0.9 * x.fermeture),
      rEncre: R_ENCRE * echelle,
      rBlanc: R_BLANC * echelle,
      pupille: { x: Math.max(-1, Math.min(1, x.regardX + tx)) * libre, y: Math.max(-1, Math.min(1, x.regardY + ty)) * libre, r: R_PUPILLE * echelle * x.pupille },
      // Le sourcil : inquiet, le bout intérieur monte (l'œil gauche, côté +x ; le droit, côté −x).
      sourcil: { visible, x: cx, y: ey + (0.27 + x.sourcilHaut) * echelle * x.ouverture, w: 0.3 * echelle, h: 0.065 * echelle, rot: -cote * x.sourcilAngle },
    };
  });
}

/** La plus grande boîte d'une pièce (celle où se posent les yeux) : son centre, en mètres. */
export function centreDesYeux(bs: readonly { cx: number; cy: number; hw: number; hh: number }[]): { x: number; y: number } {
  const grande = bs.reduce((a, b) => (Math.min(b.hw, b.hh) > Math.min(a.hw, a.hh) ? b : a));
  return { x: grande.cx / 8, y: grande.cy / 8 };
}
