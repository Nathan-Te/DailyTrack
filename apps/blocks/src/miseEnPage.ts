import { COLONNES } from "@cdj/blocks-sim";

// La MISE EN PAGE de la scène (pure, testée) — lot B5, d'après la maquette A de B0 (`docs/blocks/maquettes/`, qui fait foi pour l'esprit : plaques, matière, couleurs) mais **à la bonne échelle** : la maquette n'avait été dessinée qu'au
// téléphone et à 1440 × 900. **La grille est la vedette** ; deux dispositions, et on prend celle qui donne la plus grande grille :
//   · **paysage et bureau** : trois colonnes autour de la grille, qui est centrée et haute d'environ 80 % de la hauteur utile. À gauche, **collé à la grille**, le HUD (score, combo, aide) ; à droite, dans une colonne étroite, la pièce du moment
//     (à la taille des cases de la grille) et, dessous, la suivante (plus petite). Les grands vides à gauche et à droite sont du décor, pas des cadres ;
//   · **portrait** : une rangée en haut (score, combo, puis le bouton pause du kit), la grille en pleine largeur, une ligne d'aide, puis en bas la zone de saisie (« Ta pièce ») et, à côté, la suivante (« Suivante »).
// Le fantôme n'existe plus (lot B5, seed § 5 : une grille en transparence est illisible) : il n'y a plus de troisième plaque. Les pièces ont au plus 5 cases de long : celles de 4 et 5 cases se posent plus petites que les cases dans la colonne
// étroite, puis grossissent à la taille des cases quand on les saisit.
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
  /** La zone de saisie : on prend la pièce du moment n'importe où dedans. */
  main: Rect;
  /** La zone de la pièce suivante (information : on ne la prend pas). */
  suivante: Rect;
  /** Les plaques du score et du combo. */
  score: Rect;
  combo: Rect;
  /** La ligne d'aide (avant la première pose). */
  aide: Rect;
  /** Là où le kit pose son bouton (la pause) : rien d'autre n'y est dessiné. */
  boutons: Rect;
  /** Le côté d'une case d'une pièce de boîte 3 × 3 au repos dans la zone de saisie (elle grossit à `cote` quand on la saisit). */
  coteMain: number;
  /** Le centre où la pièce du moment est posée dans la zone. */
  centreMain: { x: number; y: number };
  coteSuivante: number;
  centreSuivante: { x: number; y: number };
}

export const MARGE = 8;
export const BOUTON = 44;
/** La place de l'étiquette (« Ta pièce », « Suivante », 12 px) en haut d'une zone. */
export const ETIQUETTE = 28;
const ECART = 14;
/** La part de la hauteur utile que prend la grille au PC et en paysage. */
export const PART_GRILLE = 0.8;
/** La colonne de la pièce du moment est large de `LARGEUR_COLONNE` cases + deux marges : les pièces de 3 cases de large y tiennent à la taille des cases. */
const LARGEUR_COLONNE = 3.5;
/** La pièce suivante : sa part de la taille des cases. */
const PART_SUIVANTE = 0.55;
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

/** La hauteur d'une zone qui montre une pièce de 3 cases de haut à `cote` px par case, son étiquette et ses marges. */
const hauteurZone = (cote: number): number => Math.ceil(3 * cote) + ETIQUETTE + 2 * MARGE;

function paysage(largeur: number, hauteur: number): Disposition {
  // La colonne de gauche et celle de droite ont la même largeur : la grille est exactement au centre.
  const cote = Math.max(1, Math.floor(Math.min((PART_GRILLE * hauteur) / COLONNES, (largeur - 4 * MARGE - 2 * ECART) / (COLONNES + 2 * LARGEUR_COLONNE))));
  const g = cote * COLONNES;
  const colonne = Math.round(LARGEUR_COLONNE * cote) + 2 * MARGE;
  const grille: Rect = { x: Math.floor((largeur - g) / 2), y: Math.floor((hauteur - g) / 2), w: g, h: g };
  const hp = hauteurPlaque(cote);
  const xGauche = grille.x - ECART - colonne;
  const score: Rect = { x: xGauche, y: grille.y, w: colonne, h: hp };
  const combo: Rect = { x: xGauche, y: grille.y + hp + MARGE, w: colonne, h: hp };
  const yAide = combo.y + hp + MARGE;
  const aide: Rect = { x: xGauche, y: yAide, w: colonne, h: Math.max(0, grille.y + g - yAide) };
  const x = grille.x + g + ECART;
  const hMain = hauteurZone(cote);
  const main: Rect = { x, y: grille.y, w: colonne, h: hMain };
  const hSuiv = Math.min(hauteurZone(cote * PART_SUIVANTE), Math.max(1, grille.y + g - (grille.y + hMain + MARGE)));
  const suivante: Rect = { x, y: grille.y + hMain + MARGE, w: colonne, h: hSuiv };
  return finir(false, cote, grille, main, suivante, score, combo, aide, { x: Math.max(0, largeur - (BOUTON + MARGE)), y: 0, w: BOUTON + MARGE, h: BOUTON });
}

function portrait(largeur: number, hauteur: number): Disposition {
  const boutons: Rect = { x: Math.max(0, largeur - (BOUTON + MARGE)), y: 0, w: BOUTON + MARGE, h: BOUTON };
  const plaque = Math.max(60, Math.floor((largeur - boutons.w - 2 * MARGE) / 2));
  const score: Rect = { x: 0, y: 0, w: plaque, h: PLAQUE_PORTRAIT };
  const combo: Rect = { x: plaque + MARGE, y: 0, w: plaque, h: PLAQUE_PORTRAIT };
  const zoneMin = Math.max(120, Math.floor(hauteur * 0.2));
  const cote = Math.max(1, Math.floor(Math.min(largeur / COLONNES, (hauteur - PLAQUE_PORTRAIT - 2 * ECART - zoneMin) / COLONNES)));
  const g = cote * COLONNES;
  const grille: Rect = { x: Math.floor((largeur - g) / 2), y: PLAQUE_PORTRAIT + ECART, w: g, h: g };
  const bas = grille.y + g + ECART;
  const hz = Math.max(1, Math.min(hauteurZone(cote), hauteur - bas));
  const wMain = Math.max(1, Math.round((largeur - MARGE) * 0.68));
  const main: Rect = { x: 0, y: hauteur - hz, w: wMain, h: hz };
  const suivante: Rect = { x: wMain + MARGE, y: hauteur - hz, w: Math.max(1, largeur - wMain - MARGE), h: hz };
  const aide: Rect = { x: 0, y: bas, w: largeur, h: Math.max(0, hauteur - hz - bas - MARGE) };
  return finir(true, cote, grille, main, suivante, score, combo, aide, boutons);
}

function finir(estPortrait: boolean, cote: number, grille: Rect, main: Rect, suivante: Rect, score: Rect, combo: Rect, aide: Rect, boutons: Rect): Disposition {
  const coteMain = Math.max(1, Math.min(cote, (main.w - 2 * MARGE) / 3, (main.h - ETIQUETTE - MARGE) / 3));
  const coteSuivante = Math.max(1, Math.min(coteMain * PART_SUIVANTE, (suivante.w - 2 * MARGE) / 3, (suivante.h - ETIQUETTE - MARGE) / 3));
  return {
    portrait: estPortrait,
    cote,
    grille,
    main,
    suivante,
    score,
    combo,
    aide,
    boutons,
    coteMain,
    centreMain: { x: main.x + main.w / 2, y: main.y + ETIQUETTE + (main.h - ETIQUETTE) / 2 },
    coteSuivante,
    centreSuivante: { x: suivante.x + suivante.w / 2, y: suivante.y + ETIQUETTE + (suivante.h - ETIQUETTE) / 2 },
  };
}

/** La disposition d'une scène de `largeur` × `hauteur` pixels (la zone utile, marges de sécurité déduites) : celle des deux qui donne la plus grande grille ; à égalité, le portrait si l'écran est plus haut que large. */
export function disposer(largeur: number, hauteur: number): Disposition {
  const p = portrait(largeur, hauteur);
  const l = paysage(largeur, hauteur);
  return p.cote > l.cote || (p.cote === l.cote && hauteur >= largeur) ? p : l;
}

/** Le côté d'une case de cette pièce au repos dans la zone de saisie : le plus grand qui la fait tenir, sans dépasser la taille des cases de la grille. */
export const coteEnMain = (d: Disposition, p: { largeur: number; hauteur: number }): number =>
  Math.max(1, Math.min(d.cote, (d.main.w - 2 * MARGE) / p.largeur, (d.main.h - ETIQUETTE - MARGE) / p.hauteur));
/** Idem dans la zone de la pièce suivante : plus petite que celle du moment. */
export const coteEnSuivante = (d: Disposition, p: { largeur: number; hauteur: number }): number =>
  Math.max(1, Math.min(d.cote * PART_SUIVANTE, (d.suivante.w - 2 * MARGE) / p.largeur, (d.suivante.h - ETIQUETTE - MARGE) / p.hauteur));

export const dans = (r: Rect, x: number, y: number): boolean => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
export const sechevauchent = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
