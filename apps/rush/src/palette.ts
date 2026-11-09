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
  /** La lumière directe (le soleil et son ombre portée) et l'hémisphérique (lot BR0c : le ciel bleu d'en haut, le sable chaud d'en bas). */
  lumiere: number;
  ambiance: number;
  intensiteLumiere: number;
  intensiteAmbiance: number;
  /** Le ciel et le sol de la lumière hémisphérique ; la brume vers l'horizon. */
  hemiCiel: number;
  hemiSol: number;
  brume: number;
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
  // Lot BR-A2 — le sol hors dalles (la terre battue du chemin, l'herbe de ses bords), la lumière et l'ambiance du thème.
  /** La terre battue (deux tons) et l'herbe des bords (deux tons) : tout sol qui n'est pas une dalle (arène, salle d'épreuve). */
  terre: number;
  terre2: number;
  herbeSol: number;
  herbeSol2: number;
  /** La brume : où elle commence et où elle est entière (mètres depuis la caméra). */
  brumeProche: number;
  brumeLoin: number;
  /** La direction du soleil (la position de la lumière par rapport au point regardé, mètres). */
  soleil: readonly [number, number, number];
  /** L'étalonnage du thème (post-traitement en haute qualité) : le bloom, le vignettage, la teinte (multiplie le rouge, le vert, le bleu), la saturation et le contraste. */
  etalonnage: { bloom: number; vignette: number; teinte: readonly [number, number, number]; saturation: number; contraste: number };
  /** Les particules d'ambiance : `pollen` (jour doux), `poussiere` (carrière), `lucioles` (sous-bois) ; leur couleur, leur nombre (haute qualité ; la moitié en basse) et leur taille en mètres. */
  particules: { genre: "pollen" | "poussiere" | "lucioles"; couleur: number; couleur2: number; nombre: number; taille: number };
  /** Les rais de lumière (0 : aucun, 1 : marqués) et la brume basse (0 : aucune, 1 : épaisse). */
  rais: number;
  brumeBasse: number;
}

export const PALETTES: Readonly<Record<string, PaletteMonde>> = {
  // Lot BR1 : trois thèmes purement visuels (palette du sol, couleur des murs bas, décor). `mur` / `murHaut` : le mur bas (haie, rochers, muret) et son dessus.
  prairie: {
    fond: 0xbfe1f4, sol: 0xf8e8c4, sol2: 0xecd5a4, mur: 0x5f9f4f, murHaut: 0x7cbc62, lumiere: 0xfff1d6, ambiance: 0xf4e6c8, intensiteLumiere: 2.1, intensiteAmbiance: 1.3, hemiCiel: 0xe9e4d8, hemiSol: 0xefd9ae, brume: 0xcfe8f7,
    tranche: 0xcfae78, falaise: 0x8a6a4c, falaise2: 0xa88660, herbe: 0x86c06c, herbe2: 0x6aa857, bois: 0xb07a43, bois2: 0x7c5230, nuage: 0xffffff, cielHaut: 0x8fcdf0, cielBas: 0xd6edf8,
    terre: 0xc9a77a, terre2: 0xb99868, herbeSol: 0x6fae52, herbeSol2: 0x5f9c47, brumeProche: 70, brumeLoin: 170, soleil: [9, 18, 4],
    etalonnage: { bloom: 1.1, vignette: 0.22, teinte: [1.03, 1.0, 0.95], saturation: 1.1, contraste: 1.04 },
    particules: { genre: "pollen", couleur: 0xfff2b0, couleur2: 0xffffff, nombre: 260, taille: 0.11 }, rais: 0.25, brumeBasse: 0.1,
  },
  carriere: {
    fond: 0xe6cfae, sol: 0xf0f1ef, sol2: 0xdee3e6, mur: 0x8a7f72, murHaut: 0xa89d8e, lumiere: 0xffe6bc, ambiance: 0xf0e2cc, intensiteLumiere: 2.0, intensiteAmbiance: 1.2, hemiCiel: 0xeee4d6, hemiSol: 0xd8cbb8, brume: 0xeed9bb,
    tranche: 0x9a8f80, falaise: 0x7a6e60, falaise2: 0x978b7a, herbe: 0xa7a46a, herbe2: 0x8c8b58, bois: 0xa5733f, bois2: 0x74502e, nuage: 0xfdf3e3, cielHaut: 0xe9b98a, cielBas: 0xf6e3c8,
    terre: 0xc4a98a, terre2: 0xb29676, herbeSol: 0x9a9658, herbeSol2: 0x888448, brumeProche: 50, brumeLoin: 135, soleil: [13, 14, 3],
    etalonnage: { bloom: 0.9, vignette: 0.32, teinte: [1.04, 0.96, 0.88], saturation: 1.05, contraste: 1.1 },
    particules: { genre: "poussiere", couleur: 0xf0d2a0, couleur2: 0xe0b878, nombre: 200, taille: 0.2 }, rais: 0.15, brumeBasse: 0.3,
  },
  "sousbois": {
    fond: 0xa6c9a4, sol: 0xd6e3a6, sol2: 0xc3d58c, mur: 0x3e7a3c, murHaut: 0x5a9a4c, lumiere: 0xfff1bf, ambiance: 0xcfe2b4, intensiteLumiere: 1.75, intensiteAmbiance: 1.05, hemiCiel: 0xc2dcbb, hemiSol: 0xa9c283, brume: 0xa4c9a2,
    tranche: 0x8f8a58, falaise: 0x6e5f44, falaise2: 0x8a7a58, herbe: 0x6fae5a, herbe2: 0x4f9148, bois: 0x8e5f36, bois2: 0x62412a, nuage: 0xeaf6e4, cielHaut: 0x7fb4a6, cielBas: 0xc4dcc0,
    terre: 0xb09a62, terre2: 0xa08a54, herbeSol: 0x4a8c3c, herbeSol2: 0x3d7a32, brumeProche: 40, brumeLoin: 120, soleil: [7, 19, -2],
    etalonnage: { bloom: 1.3, vignette: 0.42, teinte: [0.9, 0.99, 0.88], saturation: 1.1, contraste: 1.12 },
    particules: { genre: "lucioles", couleur: 0xe6ff7a, couleur2: 0xb8ff9a, nombre: 90, taille: 0.16 }, rais: 0.9, brumeBasse: 0.8,
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
  golem: 0x6a5c52,
  golemSombre: 0x40352f,
  golemMousse: 0x7f9a5a,
  lueur: 0xf2b544,
  /** Le liseré d'encre des gemmes (lot BR2). */
  encre: 0x2a1e16,
  danger: 0xe2382a,
  /** Les cercles d'annonce de la cible : un rouge corail translucide, un bord plus clair. */
  corail: 0xf0604e,
  corailClair: 0xff9c88,
  onde: 0xff7a3c,
  /** Lot BR3 : les nuages de spores du vieux chêne (un vert-jaune sombre, un liseré olive : PAS un danger rouge, mais un danger tout de même) et l'anneau d'invocation (violet pâle : ce n'est pas un danger). */
  spores: 0x4f8010,
  sporesClair: 0xc6d94a,
  sporesLisere: 0x2f5a08,
  invocation: 0x8f6fd6,
  invocationClair: 0x9b7de0,
  poussiere: 0xe6d6b4,
  etincelle: 0xfff2a8,
  /** Lot BR5 — ce qui est au JOUEUR (jamais de rouge : le rouge est réservé au danger) : le cercle d'atterrissage du bond (un cyan), la recharge (un violet), le cœur rendu par un vase (un rose), le bouclier (acier clair), la lame du tourbillon (un or pâle). */
  joueur: 0x0a8fbf,
  joueurClair: 0x1fc4e6,
  recharge: 0xa56bff,
  rechargeClair: 0xd6b8ff,
  coeur: 0xff8fb3,
  bouclier: 0xcfe8ff,
  lame: 0xffe9a0,
  // Lot BR6 — les quatre nouveaux ennemis (chacun sa teinte, sa silhouette, un écart ≥ 40 avec les deux tons du sol de CHAQUE thème : `test/lisibilite.test.ts`), les élites, le bouclier du chaman, le projectile du cracheur.
  /** Le cracheur : un crapaud orangé aux yeux sur tiges, la bouche sombre ; le chaman : une robe vert-de-gris à capuche et une orbe claire ; le totem : un pieu de bois sombre aux bandes ocre et sarcelle ; le porte-bouclier : un colosse ardoise derrière un grand bouclier d'acier. */
  cracheur: 0xb5651d,
  cracheurClair: 0xf0a860,
  cracheurBouche: 0x3a1a0c,
  chaman: 0x14746f,
  chamanSombre: 0x0d4f4b,
  chamanClair: 0x6fd6c9,
  orbe: 0xbff3ff,
  totemBois: 0x5b3a22,
  totemPierre: 0x6b5b4a,
  totemOcre: 0xe0a030,
  totemSarcelle: 0x1f8a82,
  pbCorps: 0x3d4a63,
  pbBouclier: 0x6c7fa3,
  pbBord: 0x2b3447,
  /** Un élite : sa couronne et son halo d'or ; le bouclier posé par un chaman (une bulle bleu clair) et son lien ; le projectile du cracheur (orange vif, comme un danger qui avance). */
  elite: 0xffc93c,
  bulle: 0x9fe6ff,
  projectile: 0xff7a3c,
} as const;

/** Le thème d'une palette (par identité) ; la prairie à défaut (lot BR-A2 : ici, pour que le décor et la fabrique le demandent sans importer le niveau). */
export function themeDe(a: PaletteMonde): "prairie" | "carriere" | "sousbois" {
  for (const k of Object.keys(PALETTES)) if (PALETTES[k] === a) return k as "prairie" | "carriere" | "sousbois";
  return "prairie";
}
