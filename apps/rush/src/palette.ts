// La direction artistique de Rush : des aplats (ombrage en trois tons), un contour d'encre, de petits yeux. Les couleurs du MONDE du jeu vivent ici (comme les palettes des autres jeux) ; l'interface hors partie, elle, ne
// lit que les jetons de `@cdj/ui`. Les deux thèmes ne changent que le sol, le ciel et la lumière.

export interface PaletteMonde {
  /** Le fond, hors de l'image (la couleur d'effacement). */
  fond: number;
  /** Les deux tons des dalles du damier du sol. */
  sol: number;
  sol2: number;
  /** Le liseré et le mur de l'arène (anciens noms, gardés pour l'essai de palette). */
  mur: number;
  murHaut: number;
  /** La lumière directe et l'ambiante. */
  lumiere: number;
  ambiance: number;
  intensiteLumiere: number;
  intensiteAmbiance: number;
  // Le décor (lot BR0b) : l'île flottante, son muret et le ciel.
  /** La tranche des dalles, les deux tons de la falaise, l'herbe et ses touffes. */
  tranche: number;
  falaise: number;
  falaise2: number;
  herbe: number;
  herbe2: number;
  /** Le bois du muret : le clair, le sombre. */
  bois: number;
  bois2: number;
  /** Les nuages et le ciel (le haut, le bas du dégradé). */
  nuage: number;
  cielHaut: number;
  cielBas: number;
}

export const PALETTES: Readonly<Record<string, PaletteMonde>> = {
  clair: {
    fond: 0xbfe1f4, sol: 0xf2dca6, sol2: 0xe4c98c, mur: 0x8c6d54, murHaut: 0xb08a68, lumiere: 0xfff1d6, ambiance: 0xf4e6c8, intensiteLumiere: 2.4, intensiteAmbiance: 1.1,
    tranche: 0xcfae78, falaise: 0x8a6a4c, falaise2: 0xa88660, herbe: 0x86c06c, herbe2: 0x6aa857, bois: 0xb07a43, bois2: 0x7c5230, nuage: 0xffffff, cielHaut: 0x8fcdf0, cielBas: 0xd6edf8,
  },
  sombre: {
    fond: 0x2a2050, sol: 0x54465f, sol2: 0x473a52, mur: 0x1f1826, murHaut: 0x5a4a66, lumiere: 0xb9b0ff, ambiance: 0x6a5f8c, intensiteLumiere: 2.0, intensiteAmbiance: 1.0,
    tranche: 0x34293f, falaise: 0x2a2233, falaise2: 0x3d324c, herbe: 0x4a7a68, herbe2: 0x3a6656, bois: 0x6a5278, bois2: 0x42324f, nuage: 0x7a6e9c, cielHaut: 0x1b1540, cielBas: 0x5b4b86,
  },
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
  golem: 0xa0734c,
  golemSombre: 0x6c4a30,
  golemMousse: 0x7f9a5a,
  lueur: 0xf2b544,
  danger: 0xe2382a,
  onde: 0xff7a3c,
  poussiere: 0xe6d6b4,
  etincelle: 0xfff2a8,
} as const;
