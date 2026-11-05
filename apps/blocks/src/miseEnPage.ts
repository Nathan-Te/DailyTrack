import { COLONNES } from "@cdj/blocks-sim";

// La MISE EN PAGE de la scène (pure, testée), selon la maquette A de B0 (`docs/blocks/maquettes/`) :
//   · **portrait** : une rangée en haut (score, combo, puis les deux boutons du kit : fantôme et pause), la grille en pleine largeur, une ligne d'aide, puis en bas la **zone de saisie** large (« Ta pièce ») et, à côté, la
//     pièce suivante, petite (« Suivante ») ;
//   · **paysage et bureau** : score et combo à gauche, la grille, puis à droite la zone de saisie et dessous la suivante ; les deux boutons du kit en haut à droite.
// Les marges sont de 8 px (la grille de 8 × 8 en pleine largeur : B0, question 10). Les pièces ont au plus 5 cases de long : leur taille au repos est calculée pour que chacune tienne dans sa zone.
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
  /** Lot B4 — la plaque du fantôme (son score à ce rang, l'écart avec le tien) : seulement quand il y a un fantôme (`disposer(…, true)`), sinon `null` et rien ne change. */
  fantome: Rect | null;
  /** La ligne d'aide (avant la première pose). */
  aide: Rect;
  /** Là où le kit pose ses deux boutons (fantôme, pause) : rien d'autre n'y est dessiné. */
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
/** La place de l'étiquette (« Ta pièce », « Suivante ») en haut d'une zone, et du bord en bas. */
const ETIQUETTE = 24;
const ECART = 12;

export function disposer(largeur: number, hauteur: number, avecFantome = false): Disposition {
  const portrait = hauteur >= largeur * 0.95;
  const boutons: Rect = { x: Math.max(0, largeur - (2 * BOUTON + MARGE)), y: 0, w: 2 * BOUTON + MARGE, h: BOUTON };
  let cote: number;
  let grille: Rect;
  let main: Rect;
  let suivante: Rect;
  let score: Rect;
  let combo: Rect;
  let aide: Rect;
  let fantome: Rect | null = null;
  if (portrait) {
    // La rangée du haut : score, combo, (fantôme,) puis les deux boutons du kit. Avec un fantôme, trois plaques se partagent la place.
    const n = avecFantome ? 3 : 2;
    const plaque = Math.max(avecFantome ? 56 : 60, Math.floor((largeur - boutons.w - n * MARGE) / n));
    score = { x: 0, y: 0, w: plaque, h: BOUTON };
    combo = { x: plaque + MARGE, y: 0, w: plaque, h: BOUTON };
    if (avecFantome) fantome = { x: 2 * (plaque + MARGE), y: 0, w: plaque, h: BOUTON };
    const zoneMin = Math.max(120, Math.floor(hauteur * 0.22));
    cote = Math.max(1, Math.floor(Math.min(largeur / COLONNES, (hauteur - BOUTON - 2 * ECART - zoneMin) / COLONNES)));
    const g = cote * COLONNES;
    grille = { x: Math.floor((largeur - g) / 2), y: BOUTON + ECART, w: g, h: g };
    const bas = grille.y + g + ECART;
    const hz = Math.max(1, Math.min(210, hauteur - bas));
    const wMain = Math.max(1, Math.round((largeur - MARGE) * 0.68));
    main = { x: 0, y: hauteur - hz, w: wMain, h: hz };
    suivante = { x: wMain + MARGE, y: hauteur - hz, w: Math.max(1, largeur - wMain - MARGE), h: hz };
    aide = { x: 0, y: bas, w: largeur, h: Math.max(0, hauteur - hz - bas - MARGE) };
  } else {
    const colonne = Math.max(120, Math.min(200, Math.round(largeur * 0.2)));
    score = { x: 0, y: 0, w: colonne, h: 56 };
    combo = { x: 0, y: 64, w: colonne, h: 56 };
    if (avecFantome) fantome = { x: 0, y: 128, w: colonne, h: 56 };
    const hautAide = avecFantome ? 192 : 128;
    aide = { x: 0, y: hautAide, w: colonne, h: Math.max(0, hauteur - hautAide) };
    cote = Math.max(1, Math.min(72, Math.floor(Math.min(hauteur / COLONNES, (largeur - colonne - 2 * ECART - 140) / COLONNES))));
    const g = cote * COLONNES;
    grille = { x: colonne + ECART, y: Math.floor((hauteur - g) / 2), w: g, h: g };
    const x = grille.x + g + ECART;
    const haut = BOUTON + MARGE;
    const hMain = Math.max(1, Math.floor((hauteur - haut) * 0.6));
    main = { x, y: haut, w: Math.max(1, largeur - x), h: hMain };
    suivante = { x, y: haut + hMain + MARGE, w: main.w, h: Math.max(1, hauteur - haut - hMain - MARGE) };
  }
  const coteMain = Math.max(1, Math.min(cote * 0.9, (main.w - 2 * MARGE) / 3, (main.h - ETIQUETTE - MARGE) / 3));
  const coteSuivante = Math.max(1, Math.min(coteMain * 0.6, (suivante.w - 2 * MARGE) / 3, (suivante.h - ETIQUETTE - MARGE) / 3));
  return {
    portrait,
    cote,
    grille,
    main,
    suivante,
    score,
    combo,
    fantome,
    aide,
    boutons,
    coteMain,
    centreMain: { x: main.x + main.w / 2, y: main.y + ETIQUETTE + (main.h - ETIQUETTE) / 2 },
    coteSuivante,
    centreSuivante: { x: suivante.x + suivante.w / 2, y: suivante.y + ETIQUETTE + (suivante.h - ETIQUETTE) / 2 },
  };
}

/** Le côté d'une case de cette pièce au repos dans la zone de saisie : le plus grand qui la fait tenir, sans dépasser 0,9 case de la grille. */
export const coteEnMain = (d: Disposition, p: { largeur: number; hauteur: number }): number =>
  Math.max(1, Math.min(d.cote * 0.9, (d.main.w - 2 * MARGE) / p.largeur, (d.main.h - ETIQUETTE - MARGE) / p.hauteur));
/** Idem dans la zone de la pièce suivante : plus petite que celle du moment. */
export const coteEnSuivante = (d: Disposition, p: { largeur: number; hauteur: number }): number =>
  Math.max(1, Math.min(d.cote * 0.55, (d.suivante.w - 2 * MARGE) / p.largeur, (d.suivante.h - ETIQUETTE - MARGE) / p.hauteur));

export const dans = (r: Rect, x: number, y: number): boolean => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
export const sechevauchent = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
