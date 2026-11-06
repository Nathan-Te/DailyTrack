import { COLONNES } from "@cdj/blocks-sim";

// La MISE EN PAGE de la scène (pure, testée) — lot B5, d'après la maquette A de B0 (`docs/blocks/maquettes/`, qui fait foi pour l'esprit : plaques, matière, couleurs) mais **à la bonne échelle** : la maquette n'avait été dessinée qu'au
// téléphone et à 1440 × 900. **La grille est la vedette** ; deux dispositions, et on prend celle qui donne la plus grande grille :
//   · **paysage et bureau** : trois colonnes autour de la grille (centrée si la place le permet, sinon décalée de quelques pour cent vers la gauche), haute d'environ 80 % de la hauteur utile. À gauche, **collé à la grille**, le HUD (score, combo, aide) ;
//     à droite la pièce du moment et, dessous, la suivante. Les grands vides à gauche et à droite sont du décor, pas des cadres ;
//   · **portrait** : une rangée en haut (score, combo, puis le bouton pause du kit), la grille quasi en pleine largeur, une ligne d'aide (quand il reste de la place), puis en bas la zone de saisie (« Ta pièce ») et, à côté, la suivante (« Suivante »).
// Le fantôme n'existe plus (lot B5, seed § 5 : une grille en transparence est illisible) : il n'y a plus de troisième plaque.
// **Échelle fixe des pièces (lot B7)** : la pièce du moment est TOUJOURS à la taille exacte des cases de la grille (seed § 6), la suivante TOUJOURS à `PART_SUIVANTE` (60 %) de cette taille, la même pour les 40 pièces, devant un gabarit de 5 × 5 cases
// à la même échelle. Rien ne s'ajuste à la zone : c'est la zone qui est dimensionnée pour la plus grande pièce (la barre de 5, debout ou couchée, et les carrés et grands L de 3 × 3) ; si elle ne tient pas, c'est la grille qui rapetisse, jamais les pièces.
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Disposition {
  portrait: boolean;
  /** Le côté d'une case de la grille, en pixels. */
  cote: number;
  grille: Rect;
  /** La zone de saisie : on prend la pièce du moment n'importe où dedans. Dimensionnée pour la plus grande pièce à la taille des cases. */
  main: Rect;
  /** La zone de la pièce suivante (information : on ne la prend pas). Dimensionnée pour le gabarit de 5 × 5 cases à `coteSuivante`. */
  suivante: Rect;
  /** Le gabarit de 5 × 5 cases (à `coteSuivante`) derrière la pièce suivante, centré sur `centreSuivante`. */
  gabarit: Rect;
  /** Les plaques du score et du combo. */
  score: Rect;
  combo: Rect;
  /** La ligne d'aide (avant la première pose). */
  aide: Rect;
  /** Là où le kit pose son bouton (la pause) : rien d'autre n'y est dessiné. */
  boutons: Rect;
  /** Le côté d'une case de la pièce du moment : toujours celui des cases de la grille (`cote`), pour toutes les pièces. */
  coteMain: number;
  /** Le centre où la pièce du moment est posée dans la zone. */
  centreMain: { x: number; y: number };
  /** Le côté d'une case de la pièce suivante : `PART_SUIVANTE` × `cote`, le même pour toutes les pièces. */
  coteSuivante: number;
  centreSuivante: { x: number; y: number };
}

export const MARGE = 8;
export const BOUTON = 44;
/** La place de l'étiquette (« Ta pièce », « Suivante », 12 px) en haut d'une zone. */
export const ETIQUETTE = 28;
const ECART = 14;
/** L'écart entre rangées en portrait (la hauteur compte : les zones sont grandes). */
const ECART_PORTRAIT = 8;
/** L'écart entre « Ta pièce » et « Suivante » dans la colonne de droite. */
const ECART_ZONES = MARGE / 2;
/** La part de la hauteur utile que prend la grille au PC et en paysage. */
export const PART_GRILLE = 0.8;
/** La colonne du HUD (à gauche de la grille) est large de `LARGEUR_COLONNE` cases + deux marges. */
const LARGEUR_COLONNE = 3.5;
/** Lot B7 — la pièce suivante : sa part de la taille des cases, fixe, la même pour les 40 pièces. */
export const PART_SUIVANTE = 0.6;
/** La plus longue pièce du catalogue : la barre de 5 (1 × 5 ou 5 × 1). Les autres tiennent dans 3 × 3, 4 × 1 ou 3 × 2. */
export const LONGUEUR_MAX = 5;
/** Le gabarit derrière la pièce suivante : 5 × 5 cases. */
export const GABARIT = LONGUEUR_MAX;
/** La marge intérieure minimale d'une zone en portrait (de chaque côté de la plus grande pièce). */
const MARGE_ZONE_MIN = 3;
/** La hauteur d'une plaque du HUD au téléphone en portrait. */
const PLAQUE_PORTRAIT = 52;

/** Les mesures d'une plaque de hauteur `h` : l'étiquette (jamais sous 12 px), la valeur (jamais sous 20 px, 18 px au plus petit quand elle est longue : `VALEUR_MIN`), la marge intérieure, le côté d'un carré du combo, l'épaisseur du trait. */
export const VALEUR_MIN = 18;
export const metriquesPlaque = (h: number): { etiquette: number; valeur: number; pad: number; carre: number; trait: number } => ({
  etiquette: Math.max(12, Math.round(h * 0.16)),
  valeur: Math.max(20, Math.round(h * 0.44)),
  pad: Math.max(9, Math.round(h * 0.16)),
  carre: Math.max(10, Math.round(h * 0.17)),
  trait: Math.max(2, Math.round(h / 40)),
});

/** La hauteur d'une plaque dans la colonne de gauche : elle suit la taille des cases (56 px au plus petit, 104 px au plus grand). */
const hauteurPlaque = (cote: number): number => Math.max(56, Math.min(104, Math.round(cote * 0.75)));

/** La hauteur d'une zone qui montre `n` cases de haut à `cote` px par case, son étiquette et sa marge du bas. */
const hauteurZone = (n: number, cote: number): number => Math.ceil(n * cote) + ETIQUETTE + MARGE;

function finir(estPortrait: boolean, cote: number, grille: Rect, main: Rect, suivante: Rect, score: Rect, combo: Rect, aide: Rect, boutons: Rect): Disposition {
  const coteSuivante = cote * PART_SUIVANTE;
  const centre = (z: Rect): { x: number; y: number } => ({ x: z.x + z.w / 2, y: z.y + ETIQUETTE + (z.h - ETIQUETTE - MARGE) / 2 });
  const centreSuivante = centre(suivante);
  const cg = GABARIT * coteSuivante;
  return {
    portrait: estPortrait,
    cote,
    grille,
    main,
    suivante,
    gabarit: { x: centreSuivante.x - cg / 2, y: centreSuivante.y - cg / 2, w: cg, h: cg },
    score,
    combo,
    aide,
    boutons,
    coteMain: cote,
    centreMain: centre(main),
    coteSuivante,
    centreSuivante,
  };
}

function paysage(largeur: number, hauteur: number): Disposition {
  // Le côté d'une case est le plus grand (au plus 80 % de la hauteur pour la grille) pour lequel TOUT tient : la colonne de droite (pièce du moment puis suivante, à leur échelle fixe), la colonne du HUD à gauche, et le bouton pause libre.
  const boutons: Rect = { x: Math.max(0, largeur - (BOUTON + MARGE)), y: 0, w: BOUTON + MARGE, h: BOUTON };
  let derniere: Disposition | null = null;
  for (let cote = Math.max(1, Math.floor((PART_GRILLE * hauteur) / COLONNES)); cote >= 1; cote--) {
    const g = cote * COLONNES;
    const colG = Math.round(LARGEUR_COLONNE * cote) + 2 * MARGE;
    const colD = Math.ceil(LONGUEUR_MAX * cote) + 2 * MARGE;
    const hMain = hauteurZone(LONGUEUR_MAX, cote);
    const hSuiv = hauteurZone(GABARIT * PART_SUIVANTE, cote);
    const hCol = hMain + ECART_ZONES + hSuiv;
    const gy = Math.floor((hauteur - g) / 2);
    // La grille est centrée ; si la colonne de droite (plus large que celle du HUD) ne tient pas ainsi, elle se décale vers la gauche, jusqu'à ce que la colonne du HUD touche le bord.
    const xMin = colG + ECART;
    const xMax = largeur - colD - ECART - g;
    if (xMin > xMax || hCol > hauteur) {
      derniere = construire(cote, Math.max(xMin, Math.min(xMax, Math.floor((largeur - g) / 2))), gy, Math.max(0, Math.min(hauteur - hCol, Math.round(gy - (hCol - g) / 2))));
      continue;
    }
    // La colonne de droite est centrée sur la grille (elle dépasse un peu en haut et en bas), sans sortir de l'écran. Si elle toucherait le bouton pause (en haut à droite), elle passe dessous, ou la grille se décale à gauche pour la laisser libre.
    const x0 = Math.max(xMin, Math.min(xMax, Math.floor((largeur - g) / 2)));
    const yCentre = Math.max(0, Math.min(hauteur - hCol, Math.round(gy - (hCol - g) / 2)));
    const xLibre = Math.max(xMin, Math.min(xMax, boutons.x - colD - ECART - g));
    for (const [x, y] of [[x0, yCentre], [x0, Math.min(hauteur - hCol, BOUTON)], [xLibre, yCentre]] as const) {
      const d = construire(cote, x, gy, y);
      derniere = d;
      if (!sechevauchent(d.main, boutons) && !sechevauchent(d.suivante, boutons)) return d;
    }
  }
  return derniere!;

  function construire(cote: number, gx: number, gy: number, yCol: number): Disposition {
    const g = cote * COLONNES;
    const colG = Math.round(LARGEUR_COLONNE * cote) + 2 * MARGE;
    const colD = Math.ceil(LONGUEUR_MAX * cote) + 2 * MARGE;
    const hMain = hauteurZone(LONGUEUR_MAX, cote);
    const hSuiv = hauteurZone(GABARIT * PART_SUIVANTE, cote);
    const hp = hauteurPlaque(cote);
    const grille: Rect = { x: gx, y: gy, w: g, h: g };
    const xGauche = gx - ECART - colG;
    const score: Rect = { x: xGauche, y: gy, w: colG, h: hp };
    const combo: Rect = { x: xGauche, y: gy + hp + MARGE, w: colG, h: hp };
    const yAide = combo.y + hp + MARGE;
    const aide: Rect = { x: xGauche, y: yAide, w: colG, h: Math.max(0, gy + g - yAide) };
    const x = gx + g + ECART;
    const main: Rect = { x, y: yCol, w: colD, h: hMain };
    const suivante: Rect = { x, y: yCol + hMain + ECART_ZONES, w: colD, h: hSuiv };
    return finir(false, cote, grille, main, suivante, score, combo, aide, boutons);
  }
}

function portrait(largeur: number, hauteur: number): Disposition {
  const boutons: Rect = { x: Math.max(0, largeur - (BOUTON + MARGE)), y: 0, w: BOUTON + MARGE, h: BOUTON };
  const plaque = Math.max(60, Math.floor((largeur - boutons.w - 2 * MARGE) / 2));
  const score: Rect = { x: 0, y: 0, w: plaque, h: PLAQUE_PORTRAIT };
  const combo: Rect = { x: plaque + MARGE, y: 0, w: plaque, h: PLAQUE_PORTRAIT };
  // Le côté d'une case est le plus grand pour lequel la grille, puis les deux zones (la plus grande pièce à la taille des cases : 5 de long ; la suivante : 5 cases à 60 %) tiennent en largeur côte à côte et en hauteur.
  let cote = Math.max(1, Math.floor(largeur / COLONNES));
  while (cote > 1) {
    const largeurZones = Math.ceil((LONGUEUR_MAX + GABARIT * PART_SUIVANTE) * cote) + 4 * MARGE_ZONE_MIN + MARGE;
    const haut = PLAQUE_PORTRAIT + ECART_PORTRAIT + cote * COLONNES + ECART_PORTRAIT + hauteurZone(LONGUEUR_MAX, cote);
    if (largeurZones <= largeur && haut <= hauteur) break;
    cote--;
  }
  const g = cote * COLONNES;
  const grille: Rect = { x: Math.floor((largeur - g) / 2), y: PLAQUE_PORTRAIT + ECART_PORTRAIT, w: g, h: g };
  const bas = grille.y + g + ECART_PORTRAIT;
  const hz = Math.max(1, Math.min(hauteurZone(LONGUEUR_MAX, cote), hauteur - bas));
  // La marge intérieure des zones prend la place qui reste (au plus 2 marges), et la paire de zones est centrée.
  const m = Math.max(MARGE_ZONE_MIN, Math.min(2 * MARGE, Math.floor((largeur - Math.ceil((LONGUEUR_MAX + GABARIT * PART_SUIVANTE) * cote) - MARGE) / 4)));
  const wMain = Math.ceil(LONGUEUR_MAX * cote) + 2 * m;
  const wSuiv = Math.ceil(GABARIT * PART_SUIVANTE * cote) + 2 * m;
  const x0 = Math.max(0, Math.floor((largeur - wMain - MARGE - wSuiv) / 2));
  const main: Rect = { x: x0, y: hauteur - hz, w: wMain, h: hz };
  const suivante: Rect = { x: x0 + wMain + MARGE, y: hauteur - hz, w: wSuiv, h: hz };
  const aide: Rect = { x: 0, y: bas, w: largeur, h: Math.max(0, hauteur - hz - bas - MARGE) };
  return finir(true, cote, grille, main, suivante, score, combo, aide, boutons);
}

/** La disposition d'une scène de `largeur` × `hauteur` pixels (la zone utile, marges de sécurité déduites) : celle des deux qui donne la plus grande grille ; à égalité, le portrait si l'écran est plus haut que large. */
export function disposer(largeur: number, hauteur: number): Disposition {
  const p = portrait(largeur, hauteur);
  const l = paysage(largeur, hauteur);
  return p.cote > l.cote || (p.cote === l.cote && hauteur >= largeur) ? p : l;
}

export const dans = (r: Rect, x: number, y: number): boolean => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
export const sechevauchent = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
