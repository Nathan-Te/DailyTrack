import { Rng, mixSeed } from "@cdj/core";

// Palette du jour : le fond uni, les tuiles, le personnage. Tirée de la date (même règle pour tout le monde), comme les thèmes de DailyTrack.
// Présentation seulement : la simulation ne la connaît pas.

export interface Palette {
  name: string;
  /** Fond uni. */
  background: number;
  /** Tuiles pleines. */
  tile: number;
  /** Arrivée. */
  finish: number;
  /** Personnage. */
  player: number;
}

export const PALETTES: readonly Palette[] = [
  { name: "forêt", background: 0x1c3a2b, tile: 0x4f8f4a, finish: 0xffd22e, player: 0xf4efe2 },
  { name: "usine", background: 0x2b2f36, tile: 0x7d8794, finish: 0xff8a3d, player: 0xffd22e },
  { name: "glace", background: 0xcfe8f5, tile: 0x5aa3c7, finish: 0xe8283a, player: 0x16324a },
  { name: "nuit", background: 0x0b1020, tile: 0x3a4a8a, finish: 0xffd22e, player: 0xf4efe2 },
  { name: "néon", background: 0x14061f, tile: 0xd400a8, finish: 0x39ff88, player: 0x00e5ff },
];

/** Sel propre à DailyJump : le même numéro de jour ne donne pas la même graine que DailyTrack. */
const PALETTE_SALT = 0x6a756d70;

export function paletteForDay(day: number): Palette {
  return new Rng(mixSeed(day, PALETTE_SALT)).pick(PALETTES);
}
