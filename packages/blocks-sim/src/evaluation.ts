import { COLONNES, LIGNE_PLEINE, LIGNES } from "./constantes";
import { PIECES } from "./pieces";

// L'ÉVALUATION D'UNE GRILLE (lot B3, gardée au lot B8) : la fonction que le bot moyen (`glouton.ts`) et le Diamant (`diamant.ts`) partagent. Hors de l'index.
// **L'évaluation de la grille** (tous des entiers ; un poids négatif est un malus) :
//   · `occupees`    — chaque case occupée : une grille légère laisse de la place ;
//   · `isolees`     — chaque case vide fermée de ses quatre côtés (bord compris) : aucune pièce n'y entre, il faut une ligne pour la libérer ;
//   · `enfermees`   — chaque case vide fermée de trois côtés : un trou à demi bouché ;
//   · `perimetre`   — chaque côté entre une case vide et une case occupée (le bord compte pour occupé) : une grille compacte a un petit périmètre ;
//   · `presquePleines` — chaque ligne ou colonne à 6 ou 7 cases occupées : une ligne qui s'efface à la prochaine pose (bonus) ;
//   · `boites3`     — chaque boîte libre de 3 × 3 : de la place pour les grosses pièces.
// Les poids ci-dessous sont réglables ; les modifier est un changement de version du bot.
export const POIDS_DIAMANT = {
  /** Un point de score gagné par une pose (cases posées + effacement avec le combo + plateau vide). */
  point: 10,
  occupees: -4,
  isolees: -90,
  enfermees: -22,
  perimetre: -16,
  presquePleines: 18,
  boites3: 8,
  /** Chaque pièce du catalogue (40 orientations) qui ne tient plus nulle part : seulement pour les finalistes (voir `planDuDiamant`). */
  sansPlace: -40,
} as const;
const L = LIGNES;
/** Le nombre de bits d'un octet. */
export const BITS = new Uint8Array(256);
for (let i = 1; i < 256; i++) BITS[i] = (BITS[i >> 1]! + (i & 1)) as number;
/** Un octet étalé en huit demi-octets (un par colonne, 0 ou 1) : la somme de huit lignes donne le nombre de cases de chaque colonne. */
const ETALE = new Uint32Array(256);
for (let o = 0; o < 256; o++) {
  let v = 0;
  for (let c = 0; c < COLONNES; c++) if (o & (1 << c)) v |= 1 << (4 * c);
  ETALE[o] = v >>> 0;
}

/** L'évaluation d'une grille (voir l'en-tête). */
export function evaluerGrille(r: ArrayLike<number>): number {
  let occ = 0;
  let isolees = 0;
  let enfermees = 0;
  let perimetre = 0;
  let presque = 0;
  let boites3 = 0;
  let colonnes = 0; // huit demi-octets : le nombre de cases de chaque colonne
  for (let l = 0; l < L; l++) {
    const o = r[l]!;
    const n = BITS[o]!;
    occ += n;
    if (n === 6 || n === 7) presque++;
    colonnes += ETALE[o]!;
    if (l >= 2) {
      const l3 = (m: number): number => { const v = ~m & LIGNE_PLEINE; return v & (v >> 1) & (v >> 2); };
      boites3 += BITS[l3(r[l]!) & l3(r[l - 1]!) & l3(r[l - 2]!)]!;
    }
    const vide = ~o & LIGNE_PLEINE;
    const gauche = ((o << 1) | 1) & LIGNE_PLEINE; // bit c : la case à gauche est occupée (ou c'est le bord)
    const droite = (o >> 1) | 0x80;
    const haut = l === 0 ? LIGNE_PLEINE : r[l - 1]!;
    const bas = l === L - 1 ? LIGNE_PLEINE : r[l + 1]!;
    isolees += BITS[vide & gauche & droite & haut & bas]!;
    // Fermée de trois côtés exactement : (au moins trois côtés) − (quatre côtés).
    const g_d = gauche & droite;
    const h_b = haut & bas;
    const troisCotes = (g_d & (haut | bas)) | (h_b & (gauche | droite));
    enfermees += BITS[vide & troisCotes]! - BITS[vide & g_d & h_b]!;
    // Côtés entre une case vide et une case occupée (le bord compte pour occupé) : à l'intérieur de la ligne, aux deux bords, puis vers la ligne du dessous (ou le bord bas).
    perimetre += BITS[(o ^ (o >> 1)) & 0x7f]! + (o & 1 ? 0 : 1) + (o & 0x80 ? 0 : 1) + (l === L - 1 ? BITS[vide]! : BITS[o ^ r[l + 1]!]!);
    if (l === 0) perimetre += BITS[vide]!; // le bord haut
  }
  for (let c = 0; c < COLONNES; c++) {
    const n = (colonnes >>> (4 * c)) & 15;
    if (n === 6 || n === 7) presque++;
  }
  const P = POIDS_DIAMANT;
  return P.occupees * occ + P.isolees * isolees + P.enfermees * enfermees + P.perimetre * perimetre + P.presquePleines * presque + P.boites3 * boites3;
}

/** Combien de pièces du catalogue ne tiennent nulle part sur cette grille (une grille encombrée ne reçoit plus les grandes formes). Plus coûteux que l'évaluation : réservé aux finalistes. */
export function piecesSansPlace(r: ArrayLike<number>): number {
  let sans = 0;
  for (const p of PIECES) {
    let place = false;
    for (let l = 0; l + p.hauteur <= L && !place; l++) {
      for (let c = 0; c + p.largeur <= COLONNES && !place; c++) {
        let libre = true;
        for (let k = 0; k < p.hauteur; k++) {
          if ((r[l + k]! & (p.rangees[k]! << c)) !== 0) {
            libre = false;
            break;
          }
        }
        place = libre;
      }
    }
    if (!place) sans++;
  }
  return sans;
}

