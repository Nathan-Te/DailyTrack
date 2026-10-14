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
  /** Personnage (et ses éclats à la mort). */
  player: number;
  /** Dangers : pics et scies (lot 2). */
  hazard: number;
  /** Blocs friables. */
  crumble: number;
  /** Ressorts (le plateau). */
  spring: number;
}

export const PALETTES: readonly Palette[] = [
  { name: "forêt", background: 0x1c3a2b, tile: 0x4f8f4a, finish: 0xffd22e, player: 0xf4efe2, hazard: 0xe8283a, crumble: 0xb08a55, spring: 0x39c6ff },
  { name: "usine", background: 0x2b2f36, tile: 0x7d8794, finish: 0xff8a3d, player: 0xffd22e, hazard: 0xff3b3b, crumble: 0xa9764a, spring: 0x39ff88 },
  { name: "glace", background: 0xcfe8f5, tile: 0x5aa3c7, finish: 0xe8283a, player: 0x16324a, hazard: 0xd1145a, crumble: 0x9fc4d8, spring: 0xff8a00 },
  { name: "nuit", background: 0x0b1020, tile: 0x3a4a8a, finish: 0xffd22e, player: 0xf4efe2, hazard: 0xff3b5c, crumble: 0x8a7a5a, spring: 0x39ff88 },
  { name: "néon", background: 0x14061f, tile: 0xd400a8, finish: 0x39ff88, player: 0x00e5ff, hazard: 0xff2d2d, crumble: 0x8a5ad4, spring: 0xffd22e },
];

/** Sel propre à DailyJump : le même numéro de jour ne donne pas la même graine que DailyTrack. */
const PALETTE_SALT = 0x6a756d70;

export function paletteForDay(day: number): Palette {
  return new Rng(mixSeed(day, PALETTE_SALT)).pick(PALETTES);
}
