// La direction artistique de Rush : des aplats (ombrage en trois tons), un contour d'encre, de petits yeux. Les couleurs du MONDE du jeu vivent ici (comme les palettes des autres jeux) ; l'interface hors partie, elle, ne
// lit que les jetons de `@cdj/ui`. Les deux thèmes ne changent que le sol, le ciel et la lumière.

export interface PaletteMonde {
  /** Le fond, hors de l'arène. */
  fond: number;
  /** Les deux tons du damier du sol. */
  sol: number;
  sol2: number;
  /** Le liseré et le mur de l'arène. */
  mur: number;
  murHaut: number;
  /** La lumière directe et l'ambiante. */
  lumiere: number;
  ambiance: number;
  intensiteLumiere: number;
  intensiteAmbiance: number;
}

export const PALETTES: Readonly<Record<string, PaletteMonde>> = {
  clair: { fond: 0xd9c9a8, sol: 0xe9dcbc, sol2: 0xdccba3, mur: 0x8c6d54, murHaut: 0xb08a68, lumiere: 0xfff1d6, ambiance: 0xf4e6c8, intensiteLumiere: 2.4, intensiteAmbiance: 1.1 },
  sombre: { fond: 0x2a2030, sol: 0x4a3d52, sol2: 0x40344a, mur: 0x1f1826, murHaut: 0x5a4a66, lumiere: 0xb9b0ff, ambiance: 0x6a5f8c, intensiteLumiere: 2.0, intensiteAmbiance: 1.0 },
};

export const ENCRE = 0x1a120c;
export const BLANC = 0xfffaf0;

// Les personnages, identiques dans les deux thèmes.
export const COULEURS = {
  armure: 0xe8b23a,
  acier: 0xe6e0d2,
  plume: 0xc2401f,
  gelee: 0x6fd1a0,
  geleeClair: 0xc9f5de,
  chauve: 0x7a4fb5,
  chauveClair: 0xb48ee6,
  golem: 0x9a8a78,
  golemSombre: 0x6e6154,
  golemMousse: 0x7f9a5a,
  lueur: 0xf2b544,
  danger: 0xe2382a,
  onde: 0xff7a3c,
  poussiere: 0xe6d6b4,
  etincelle: 0xfff2a8,
} as const;
