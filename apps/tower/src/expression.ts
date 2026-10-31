// L'expression des yeux d'une pièce (lot T5), **pure** : de l'état de panique (0 à 3), du genre de la pièce (normal, chute, figée, soulagée, glissante), du regard et du clignement, elle
// calcule comment dessiner les deux yeux. Aucun Three.js ici : `yeux.ts` ne fait que poser ces nombres. Affichage seulement.
//
// Les quatre états : 0 calme (yeux normaux), 1 inquiet (des sourcils tombent vers le centre), 2 paniqué (yeux écarquillés, pupilles qui rétrécissent, un léger tremblement), 3 affolé (yeux
// immenses, pupilles en points, sourcils très hauts, tremblement). La chute : yeux écarquillés, pupilles en points qui regardent vers le haut d'où la pièce est tombée. Pièce figée : yeux fermés.
// Lierre : un air soulagé (paupières mi-closes, regard bas, sourcils détendus). Glissante : un air inquiet permanent, la pupille qui file d'un côté à l'autre.
import type { Niveau } from "./panique";

export type Genre = "normal" | "chute" | "figee" | "soulage" | "glissante";

export interface EntreeExpression {
  niveau: Niveau;
  genre: Genre;
  /** Le regard dans le repère de la pièce (un vecteur de norme ≤ 1) : où la pupille se déplace. */
  regard: { x: number; y: number };
  /** La fermeture due à un clignement en cours (0 ouvert, 1 fermé). */
  clignement: number;
  /** Le temps d'affichage (secondes) : tremblement et regard nerveux. */
  t: number;
}

export interface Expression {
  /** L'échelle des yeux (1 : normaux). */
  ouverture: number;
  /** L'échelle de la pupille (1 : normale). */
  pupille: number;
  /** Le déplacement de la pupille, en fraction de ce que l'œil permet (−1 à 1), repère de la pièce. */
  regardX: number;
  regardY: number;
  /** 0 : œil ouvert, 1 : fermé (un trait). */
  fermeture: number;
  /** Les sourcils : visibles ? hauteur au-dessus de l'œil (en rayons) et angle (rad, positif : le bout intérieur monte, l'air inquiet). */
  sourcils: boolean;
  sourcilHaut: number;
  sourcilAngle: number;
  /** L'amplitude du tremblement de la pupille (fraction de la place libre). */
  tremble: number;
}

interface Palier {
  ouverture: number;
  pupille: number;
  sourcils: boolean;
  haut: number;
  angle: number;
  tremble: number;
}
export const NIVEAUX: readonly Palier[] = [
  { ouverture: 1, pupille: 1, sourcils: false, haut: 0, angle: 0, tremble: 0 },
  { ouverture: 1.05, pupille: 0.9, sourcils: true, haut: 0.1, angle: 0.35, tremble: 0 },
  { ouverture: 1.18, pupille: 0.65, sourcils: true, haut: 0.22, angle: 0.5, tremble: 0.08 },
  { ouverture: 1.32, pupille: 0.45, sourcils: true, haut: 0.34, angle: 0.65, tremble: 0.2 },
];

const borne = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v));

export function expressionDe(e: EntreeExpression): Expression {
  // Une glissante est inquiète en permanence : au moins le niveau 1.
  const niveau = (e.genre === "glissante" ? Math.max(1, e.niveau) : e.niveau) as Niveau;
  const n = NIVEAUX[niveau]!;
  let x: Expression = { ouverture: n.ouverture, pupille: n.pupille, regardX: e.regard.x, regardY: e.regard.y, fermeture: 0, sourcils: n.sourcils, sourcilHaut: n.haut, sourcilAngle: n.angle, tremble: n.tremble };
  switch (e.genre) {
    case "chute": {
      const c = NIVEAUX[3]!;
      x = { ouverture: 1.42, pupille: 0.38, regardX: 0, regardY: 1, fermeture: 0, sourcils: true, sourcilHaut: c.haut + 0.08, sourcilAngle: c.angle, tremble: 0.3 };
      break;
    }
    case "figee":
      x = { ouverture: 1, pupille: 1, regardX: 0, regardY: 0, fermeture: 1, sourcils: false, sourcilHaut: 0, sourcilAngle: 0, tremble: 0 };
      break;
    case "soulage":
      x = { ouverture: 1, pupille: 1, regardX: 0, regardY: -0.6, fermeture: 0.55, sourcils: true, sourcilHaut: 0.12, sourcilAngle: -0.25, tremble: 0 };
      break;
    case "glissante":
      x.regardX = Math.sin(e.t * 2.4) * 0.85;
      x.regardY = 0;
      break;
    default:
      break;
  }
  x.regardX = borne(x.regardX, -1, 1);
  x.regardY = borne(x.regardY, -1, 1);
  // Un clignement ferme l'œil, sauf celui qui l'est déjà (figée).
  if (e.genre !== "figee") x.fermeture = Math.max(x.fermeture, borne(e.clignement, 0, 1));
  return x;
}

/** Le clignement d'une pièce : à intervalles tirés du hasard d'affichage (plus rapprochés quand elle panique), 140 ms, en triangle. */
export class Clignotement {
  private prochain: number;
  private debut = -1;
  static readonly DUREE = 0.14;

  constructor(
    private readonly hasard: () => number,
    t0 = 0,
  ) {
    this.prochain = t0 + 0.5 + hasard() * 3;
  }

  /** La fermeture (0 à 1) à l'instant `t` (secondes, croissant) pour une pièce de niveau de panique `niveau`. */
  valeur(t: number, niveau: Niveau): number {
    if (this.debut < 0 && t >= this.prochain) this.debut = this.prochain;
    if (this.debut >= 0) {
      const k = (t - this.debut) / Clignotement.DUREE;
      if (k < 1) return 1 - Math.abs(2 * k - 1);
      this.debut = -1;
      this.prochain = t + (niveau >= 2 ? 0.8 : 2.5) + this.hasard() * (niveau >= 2 ? 1.5 : 4);
    }
    return 0;
  }
}

/** Le regard d'une pièce vers un point du monde, rapporté au repère de la pièce (tournée de `angle`) : un vecteur de norme ≤ 1 (plus près que 0,6 m, il s'amenuise). */
export function regardVers(depart: { x: number; y: number }, cible: { x: number; y: number }, angle: number): { x: number; y: number } {
  const dx = cible.x - depart.x;
  const dy = cible.y - depart.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return { x: 0, y: 0 };
  const k = Math.min(1, d / 0.6) / d;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: (dx * c + dy * s) * k, y: (-dx * s + dy * c) * k };
}
