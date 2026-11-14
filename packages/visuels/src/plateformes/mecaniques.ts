// L'aspect des blocs à mécanique, **pur** : les couleurs réservées du clignotant, de l'alterné et du courant d'air. (Le tapis roulant et la glace
// sont dans les thèmes : `BELT_STYLE`, `ICE_STYLE`.) La logique de ces blocs (cycles, états, événements) reste dans le jeu.

// Les mêmes dans tous les thèmes (comme le tapis et la glace). **Jamais le rouge des dangers (`HAZARD`, teinte 0°) ni le jaune du personnage
// (`PLAYER`, teinte 44°)** : teinte à au moins 30° de chacun (règle vérifiée par les tests du jeu), et l'un et l'autre jeu se distinguent aussi
// par leur repère (barre pour A, losange pour B) : la couleur ne porte pas seule l'information.

export interface BlockStyle {
  /** Face pleine, liseré clair (contour d'un bloc plein et d'un bloc absent) et repère. */
  fill: number;
  edge: number;
}

export const BLOCK_STYLE = {
  /** Clignotant : bleu-violet (teinte 226°). */
  blink: { fill: 0x6a8cff, edge: 0xd2e0ff },
  /** Alterné, jeu A : turquoise (teinte 175°) ; jeu B : violet (teinte 269°). */
  altA: { fill: 0x12b5a8, edge: 0xd2fffa },
  altB: { fill: 0xb066ff, edge: 0xf0dcff },
} as const satisfies Record<string, BlockStyle>;

// Les mêmes dans tous les thèmes (comme les tapis et les blocs). **Jamais le rouge des dangers (teinte 0°) ni le jaune du personnage (44°)** :
// teinte à au moins 30° de chacun, ou presque blanc (le pollen) ; contrastes ≥ 3:1 avec le ciel et chaque plan de chaque thème (vérifié
// par les tests du jeu). Verts et menthe : la forêt.
export const WIND_STYLE = {
  /** Feuilles (deux verts) et pollen (blanc verdi, peu saturé). */
  leaf: 0x9ad48a,
  leafDark: 0x6fd7a0,
  pollen: 0xe6f5ea,
  /** Flèches du mouvement réduit et contour de la zone. */
  arrow: 0x8de0c0,
  edge: 0xa6f0d4,
} as const;
/** Opacité du contour (très discret) ; des flèches éteintes (la zone ne souffle pas) et allumées. */
export const WIND_EDGE_OPACITY = 0.16;
export const WIND_ARROW_IDLE = 0.22;
export const WIND_ARROW_ON = 0.8;


/** Le tapis roulant : hauteur de la bande (tuiles), posée sous le contour clair de la face du dessus, et marge au-dessus. */
export const BELT_BAND = 0.22;
export const BELT_GAP = 0.05;
