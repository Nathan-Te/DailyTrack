import type { PlayerState } from "@cdj/jump-sim";

// L'allure du personnage, **à l'affichage seulement** : écrasement et étirement au saut et à l'atterrissage, regard dans la direction
// du mouvement. Lit les états de la simulation, ne les modifie jamais.

export interface Look {
  /** > 0 : écrasé (plus large, moins haut) ; < 0 : étiré. */
  squash: number;
  /** Vitesse du ressort de l'écrasement (1/s). */
  squashVel: number;
  /** Regard : −1 gauche, 1 droite (lissé). */
  eyeX: number;
  /** Regard vertical : > 0 vers le haut (lissé). */
  eyeY: number;
  /** Dernier côté regardé, gardé à l'arrêt. */
  facing: number;
}

export const LOOK = {
  /** Étirement au décollage. */
  takeoff: -0.28,
  /** Écrasement maximal à l'atterrissage (chute à la vitesse maximale). */
  landing: 0.42,
  /** Ressort du retour à la forme (raideur 1/s², amortissement 1/s). */
  stiffness: 420,
  damping: 26,
  /** Raideur du regard (1/s). */
  eyeRate: 14,
};

export function restLook(): Look {
  return { squash: 0, squashVel: 0, eyeX: 1, eyeY: 0, facing: 1 };
}

/** Un pas de simulation vient d'être joué : repère décollage et atterrissage. `fallSpeed` : chute maximale (unités/pas). */
export function onStep(look: Look, prev: PlayerState, cur: PlayerState, fallSpeed: number): Look {
  let { squash, squashVel, facing } = look;
  if (cur.vy < 0 && cur.vy < prev.vy - 100) {
    squash = LOOK.takeoff; // impulsion vers le haut : saut ou saut mural
    squashVel = 0;
  } else if (!prev.ground && cur.ground) {
    squash = Math.max(squash, LOOK.landing * Math.min(1, Math.max(0.25, prev.vy / Math.max(1, fallSpeed))));
    squashVel = 0;
  }
  if (cur.slide !== 0) facing = -cur.slide; // contre un mur : il regarde de l'autre côté
  else if (cur.vx > 0) facing = 1;
  else if (cur.vx < 0) facing = -1;
  return { ...look, squash, squashVel, facing };
}

/** Une image : le ressort revient vers 0, le regard suit. `vyUp` : vitesse verticale vers le haut (tuiles/s). */
export function animateLook(look: Look, dt: number, vyUp: number): Look {
  const acc = -LOOK.stiffness * look.squash - LOOK.damping * look.squashVel;
  const squashVel = look.squashVel + acc * dt;
  const squash = Math.max(-0.5, Math.min(0.6, look.squash + squashVel * dt));
  const k = 1 - Math.exp(-LOOK.eyeRate * dt);
  const eyeX = look.eyeX + (look.facing - look.eyeX) * k;
  const targetY = Math.max(-1, Math.min(1, vyUp / 15));
  const eyeY = look.eyeY + (targetY - look.eyeY) * k;
  return { ...look, squash, squashVel, eyeX, eyeY };
}

/** Échelles du corps (largeur, hauteur) pour un écrasement donné : l'aire reste à peu près la même. */
export function squashScale(squash: number): { sx: number; sy: number } {
  const sy = 1 - squash;
  return { sx: 1 / Math.max(0.4, sy), sy };
}
