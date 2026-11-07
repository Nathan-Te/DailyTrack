import { COLONNES, TAILLE_SERIE } from "@cdj/blocks-sim";

// La MISE EN PAGE de la scène (pure, testée) — lot B5, d'après la maquette A de B0 (`docs/blocks/maquettes/`, qui fait foi pour l'esprit : plaques, matière, couleurs) mais **à la bonne échelle**. **La grille est la vedette** ;
// deux dispositions, et on prend celle qui donne la plus grande grille :
//   · **paysage et bureau** : trois colonnes autour de la grille (centrée si la place le permet, sinon décalée de quelques pour cent vers la gauche), haute d'environ 80 % de la hauteur utile. À gauche, **collé à la grille**, le HUD (score, combo,
//     aide) ; à droite le plateau des trois pièces, en colonne ;
//   · **portrait** : une rangée en haut (score, combo, puis le bouton pause du kit), la grille quasi en pleine largeur, une ligne d'aide (quand il reste de la place), puis en bas le plateau des trois pièces, côte à côte.
// Le fantôme n'existe plus (lot B5) ; la pièce suivante non plus (lot B8, seed § 3 : aucune pièce suivante n'est montrée).
// **Le plateau des trois pièces (lot B8)** : trois emplacements de la même taille, chacun une grande cible tactile (même pour un domino), et les trois pièces à UNE MÊME ÉCHELLE FIXE — `PART_PLATEAU` de la taille des cases de la grille, jamais ajustée à la
// taille de la pièce (règle de B7, gardée) : un domino paraît petit, un 3 × 3 gros. Chaque emplacement est dimensionné pour la plus grande pièce (la barre de 5, couchée ou debout) à cette échelle ; si le plateau ne tient pas, c'est la grille qui
// rapetisse, jamais les pièces. Une pièce posée laisse son emplacement vide, sans décaler les autres. Saisie : la pièce grossit à la taille des cases de la grille (`cote`) et reste sous le doigt.
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
  /** Le plateau des trois pièces (sa carte, étiquette comprise). */
  plateau: Rect;
  /** Les trois emplacements, de gauche à droite (portrait) ou de haut en bas (paysage) : on prend la pièce n'importe où dans son emplacement. */
  emplacements: readonly [Rect, Rect, Rect];
  /** Les plaques du score et du combo. */
  score: Rect;
  combo: Rect;
  /** La ligne d'aide (avant la première pose). */
  aide: Rect;
  /** Là où le kit pose son bouton (la pause) : rien d'autre n'y est dessiné. */
  boutons: Rect;
  /** Le côté d'une case d'une pièce au repos dans son emplacement : `PART_PLATEAU` × `cote`, le même pour toutes les pièces et tous les emplacements. */
  coteMain: number;
  /** Le centre où une pièce est posée dans chaque emplacement. */
  centresMain: readonly [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
}

export const MARGE = 8;
export const BOUTON = 44;
/** La place de l'étiquette (« Ta pièce », « Suivante », 12 px) en haut d'une zone. */
export const ETIQUETTE = 28;
const ECART = 14;
/** L'écart entre rangées en portrait (la hauteur compte : les zones sont grandes). */
const ECART_PORTRAIT = 8;
/** Lot B8 — les pièces au repos : leur part de la taille des cases de la grille, fixe, la même pour les 40 pièces. 0,46 est le plus grand pas de 0,01 pour lequel, au téléphone en portrait, trois emplacements de la barre de 5 tiennent côte à côte sous une grille de 90 % de la largeur. */
export const PART_PLATEAU = 0.46;
/** Le vide autour de la plus grande pièce, dans son emplacement. */
const PAD_EMPLACEMENT = 4;
/** L'écart entre deux emplacements. */
const ECART_EMPLACEMENT = 6;
/** La marge de la carte du plateau, autour des emplacements. */
const MARGE_CARTE = 6;
/** La part de la hauteur utile que prend la grille au PC et en paysage. */
export const PART_GRILLE = 0.8;
/** La colonne du HUD (à gauche de la grille) est large de `LARGEUR_COLONNE` cases + deux marges. */
const LARGEUR_COLONNE = 3.5;
/** La plus longue pièce du catalogue : la barre de 5 (1 × 5 ou 5 × 1). Les autres tiennent dans 3 × 3, 4 × 1 ou 3 × 2. */
export const LONGUEUR_MAX = 5;
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

/** Le côté d'un emplacement (un carré) : la plus grande pièce (5 de long) à l'échelle du plateau, et son vide. */
const tailleEmplacement = (cote: number): number => Math.ceil(LONGUEUR_MAX * PART_PLATEAU * cote) + 2 * PAD_EMPLACEMENT;

function finir(estPortrait: boolean, cote: number, grille: Rect, plateau: Rect, emplacements: [Rect, Rect, Rect], score: Rect, combo: Rect, aide: Rect, boutons: Rect): Disposition {
  const centre = (r: Rect): { x: number; y: number } => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
  return {
    portrait: estPortrait,
    cote,
    grille,
    plateau,
    emplacements,
    score,
    combo,
    aide,
    boutons,
    coteMain: PART_PLATEAU * cote,
    centresMain: [centre(emplacements[0]), centre(emplacements[1]), centre(emplacements[2])],
  };
}

function paysage(largeur: number, hauteur: number): Disposition {
  // Le côté d'une case est le plus grand (au plus 80 % de la hauteur pour la grille) pour lequel TOUT tient : la colonne de droite (les trois emplacements, l'un sous l'autre, à l'échelle fixe), la colonne du HUD à gauche, et le bouton pause libre.
  const boutons: Rect = { x: Math.max(0, largeur - (BOUTON + MARGE)), y: 0, w: BOUTON + MARGE, h: BOUTON };
  let derniere: Disposition | null = null;
  for (let cote = Math.max(1, Math.floor((PART_GRILLE * hauteur) / COLONNES)); cote >= 1; cote--) {
    const g = cote * COLONNES;
    const colG = Math.round(LARGEUR_COLONNE * cote) + 2 * MARGE;
    const s = tailleEmplacement(cote);
    const colD = s + 2 * MARGE_CARTE;
    const hCol = ETIQUETTE + TAILLE_SERIE * s + (TAILLE_SERIE - 1) * ECART_EMPLACEMENT + MARGE_CARTE;
    const gy = Math.floor((hauteur - g) / 2);
    // La grille est centrée ; si la colonne de droite ne tient pas ainsi, elle se décale vers la gauche, jusqu'à ce que la colonne du HUD touche le bord.
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
      if (!sechevauchent(d.plateau, boutons)) return d;
    }
  }
  return derniere!;

  function construire(cote: number, gx: number, gy: number, yCol: number): Disposition {
    const g = cote * COLONNES;
    const colG = Math.round(LARGEUR_COLONNE * cote) + 2 * MARGE;
    const s = tailleEmplacement(cote);
    const colD = s + 2 * MARGE_CARTE;
    const hCol = ETIQUETTE + TAILLE_SERIE * s + (TAILLE_SERIE - 1) * ECART_EMPLACEMENT + MARGE_CARTE;
    const hp = hauteurPlaque(cote);
    const grille: Rect = { x: gx, y: gy, w: g, h: g };
    const xGauche = gx - ECART - colG;
    const score: Rect = { x: xGauche, y: gy, w: colG, h: hp };
    const combo: Rect = { x: xGauche, y: gy + hp + MARGE, w: colG, h: hp };
    const yAide = combo.y + hp + MARGE;
    const aide: Rect = { x: xGauche, y: yAide, w: colG, h: Math.max(0, gy + g - yAide) };
    const x = gx + g + ECART;
    const plateau: Rect = { x, y: yCol, w: colD, h: hCol };
    const emp = (k: number): Rect => ({ x: x + MARGE_CARTE, y: yCol + ETIQUETTE + k * (s + ECART_EMPLACEMENT), w: s, h: s });
    return finir(false, cote, grille, plateau, [emp(0), emp(1), emp(2)], score, combo, aide, boutons);
  }
}

function portrait(largeur: number, hauteur: number): Disposition {
  const boutons: Rect = { x: Math.max(0, largeur - (BOUTON + MARGE)), y: 0, w: BOUTON + MARGE, h: BOUTON };
  const plaque = Math.max(60, Math.floor((largeur - boutons.w - 2 * MARGE) / 2));
  const score: Rect = { x: 0, y: 0, w: plaque, h: PLAQUE_PORTRAIT };
  const combo: Rect = { x: plaque + MARGE, y: 0, w: plaque, h: PLAQUE_PORTRAIT };
  // Le côté d'une case est le plus grand pour lequel la grille, puis le plateau (trois emplacements côte à côte, la plus grande pièce à l'échelle fixe) tiennent en largeur et en hauteur.
  const largeurPlateau = (cote: number): number => TAILLE_SERIE * tailleEmplacement(cote) + (TAILLE_SERIE - 1) * ECART_EMPLACEMENT + 2 * MARGE_CARTE;
  const hauteurPlateau = (cote: number): number => ETIQUETTE + tailleEmplacement(cote) + MARGE_CARTE;
  let cote = Math.max(1, Math.floor(largeur / COLONNES));
  while (cote > 1) {
    const haut = PLAQUE_PORTRAIT + ECART_PORTRAIT + cote * COLONNES + ECART_PORTRAIT + hauteurPlateau(cote);
    if (largeurPlateau(cote) <= largeur && haut <= hauteur) break;
    cote--;
  }
  const g = cote * COLONNES;
  const grille: Rect = { x: Math.floor((largeur - g) / 2), y: PLAQUE_PORTRAIT + ECART_PORTRAIT, w: g, h: g };
  const bas = grille.y + g + ECART_PORTRAIT;
  const s = tailleEmplacement(cote);
  const hp = Math.max(1, Math.min(hauteurPlateau(cote), hauteur - bas));
  const wp = Math.min(largeur, largeurPlateau(cote));
  const plateau: Rect = { x: Math.floor((largeur - wp) / 2), y: hauteur - hp, w: wp, h: hp };
  const emp = (k: number): Rect => ({ x: plateau.x + MARGE_CARTE + k * (s + ECART_EMPLACEMENT), y: plateau.y + ETIQUETTE, w: s, h: s });
  const aide: Rect = { x: 0, y: bas, w: largeur, h: Math.max(0, hauteur - hp - bas - MARGE) };
  return finir(true, cote, grille, plateau, [emp(0), emp(1), emp(2)], score, combo, aide, boutons);
}

/** La disposition d'une scène de `largeur` × `hauteur` pixels (la zone utile, marges de sécurité déduites) : celle des deux qui donne la plus grande grille ; à égalité, le portrait si l'écran est plus haut que large. */
export function disposer(largeur: number, hauteur: number): Disposition {
  const p = portrait(largeur, hauteur);
  const l = paysage(largeur, hauteur);
  return p.cote > l.cote || (p.cote === l.cote && hauteur >= largeur) ? p : l;
}

export const dans = (r: Rect, x: number, y: number): boolean => x >= r.x && y >= r.y && x < r.x + r.w && y < r.y + r.h;
export const sechevauchent = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
