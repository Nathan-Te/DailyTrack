import { FALL_DEPTH, type Track } from "@cdj/sim";

/**
 * Le sol lointain d'un circuit (le plan sous tout, où se posent les pieds des portiques et le décor) : `FALL_DEPTH` sous la hauteur où l'on est perdu. Lot 58 :
 * sous un virage très relevé (son bord intérieur plus bas que la route), il passe 2 m sous ce bord ; ailleurs, comme avant. Le palier 1 et l'ancienne scène
 * (`existant.ts`) le partagent.
 */
export const solLointain = (track: Track): number => Math.min(track.voidY - FALL_DEPTH, (track.fallY ?? Infinity) + FALL_DEPTH - 2);
