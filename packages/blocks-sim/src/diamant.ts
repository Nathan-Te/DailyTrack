import { BONUS_PLATEAU_VIDE, COLONNES, LIGNE_PLEINE, LIGNES, POINTS_EFFACEMENT, POSES_SANS_EFFACEMENT_MAX } from "./constantes";
import type { Contenu } from "./generateur";
import { PIECES, type Piece } from "./pieces";
import { Partie, type Resultat } from "./partie";
import { seuilsDepuis, type Seuils } from "./medailles";

// LE BOT DIAMANT (lot B3) — seed § 5 : « pour chaque pièce, il essaie toutes les positions, en regardant la pièce suivante, et garde la meilleure grille selon une évaluation ». Son score sur la suite du jour est le
// Diamant (dans les données, la clé reste `auteur`) ; l'or, l'argent et le bronze s'en déduisent (`medailles.ts`).
//
// **Le bot fait partie des règles du classement** : tout changement de sa logique ou de ses poids monte `BLOCKS_BOT_VERSION` (`constantes.ts`) et régénère le golden de ses scores (`npm run golden:blocks`).
// **Jamais d'aléa** : ni `Math.random`, ni horloge, ni état entre deux parties. À valeur égale, la première position gagne (rang de position = l'octet d'action : lignes de haut en bas, puis colonnes de gauche à droite),
// pour la pièce du moment comme pour la suivante. Il ne joue que des actions légales (il lit les mêmes règles que `Partie`, qui rejette le reste). Sa partie est une rediffusion valide, rejouée par le code du serveur.
//
// **Comment il choisit.** Pour chaque position légale de la pièce du moment, puis pour chaque position légale de la pièce suivante (la suite est connue : c'est le seul coup d'avance), il note
//   valeur = POIDS.point × (points gagnés par les deux poses, combo compris) + évaluation de la grille obtenue,
// et garde la position de la pièce du moment dont le meilleur enchaînement vaut le plus. Si la pièce suivante ne tient plus nulle part après une position, cette position vaut `MORT` (en dessous de tout) :
// il ne la joue que s'il n'a rien d'autre. Sans pièce suivante (la dernière du plafond), il ne regarde que la grille après la pose.
// **L'évaluation de la grille** (tous des entiers ; un poids négatif est un malus) :
//   · `occupees`    — chaque case occupée : une grille légère laisse de la place ;
//   · `isolees`     — chaque case vide fermée de ses quatre côtés (bord compris) : aucune pièce n'y entre, il faut une ligne pour la libérer ;
//   · `enfermees`   — chaque case vide fermée de trois côtés : un trou à demi bouché ;
//   · `perimetre`   — chaque côté entre une case vide et une case occupée (le bord compte pour occupé) : une grille compacte a un petit périmètre ;
//   · `presquePleines` — chaque ligne ou colonne à 6 ou 7 cases occupées : une ligne qui s'efface à la prochaine pose (bonus).
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
  /** Chaque pièce du catalogue (40 orientations) qui ne tient plus nulle part : seulement pour les finalistes (voir `coupDuDiamant`). */
  sansPlace: -40,
} as const;
/** La valeur d'une position après laquelle la pièce suivante ne tient plus : la partie s'arrête là. */
const MORT = -1_000_000;

const L = LIGNES;
/** Le nombre de bits d'un octet. */
const BITS = new Uint8Array(256);
for (let i = 1; i < 256; i++) BITS[i] = (BITS[i >> 1]! + (i & 1)) as number;
/** Un octet étalé en huit demi-octets (un par colonne, 0 ou 1) : la somme de huit lignes donne le nombre de cases de chaque colonne. */
const ETALE = new Uint32Array(256);
for (let o = 0; o < 256; o++) {
  let v = 0;
  for (let c = 0; c < COLONNES; c++) if (o & (1 << c)) v |= 1 << (4 * c);
  ETALE[o] = v >>> 0;
}

/** L'état d'une branche de la recherche : les huit lignes de la grille, le combo, les poses sans effacement depuis le dernier, les points gagnés depuis la racine. */
interface Etat {
  r: Uint8Array;
  combo: number;
  sans: number;
  gain: number;
}
const etat = (): Etat => ({ r: new Uint8Array(L), combo: 0, sans: 0, gain: 0 });

/** Pose `p` en (col, ligne) sur `de` (déjà jugée légale), écrit le résultat dans `vers` : même barème que `Partie.poser`. */
function appliquer(de: Etat, vers: Etat, p: Piece, col: number, ligne: number): void {
  const r = vers.r;
  r.set(de.r);
  for (let k = 0; k < p.hauteur; k++) r[ligne + k]! |= p.rangees[k]! << col;
  // Les lignes et colonnes pleines, effacées ensemble (une case au croisement compte pour les deux).
  let lignes = 0;
  let colonnes = LIGNE_PLEINE;
  for (let l = 0; l < L; l++) {
    if (r[l] === LIGNE_PLEINE) lignes |= 1 << l;
    colonnes &= r[l]!;
  }
  const n = BITS[lignes]! + BITS[colonnes]!;
  let gain = p.cases;
  vers.combo = de.combo;
  vers.sans = de.sans;
  if (n > 0) {
    for (let l = 0; l < L; l++) r[l] = (lignes >> l) & 1 ? 0 : r[l]! & ~colonnes & LIGNE_PLEINE;
    vers.combo++;
    vers.sans = 0;
    gain += POINTS_EFFACEMENT * n * n * vers.combo;
    if ((r[0]! | r[1]! | r[2]! | r[3]! | r[4]! | r[5]! | r[6]! | r[7]!) === 0) gain += BONUS_PLATEAU_VIDE;
  } else {
    vers.sans++;
    if (vers.sans >= POSES_SANS_EFFACEMENT_MAX && vers.combo > 0) vers.combo = 0;
  }
  vers.gain = de.gain + gain;
}

/** La place de la pièce sur la grille : les rangées qu'elle couvre sont libres sous son masque. */
function tient(r: Uint8Array, p: Piece, col: number, ligne: number): boolean {
  for (let k = 0; k < p.hauteur; k++) if ((r[ligne + k]! & (p.rangees[k]! << col)) !== 0) return false;
  return true;
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

/** Les finalistes : les `FINALISTES` meilleurs enchaînements (pièce du moment puis suivante) selon l'évaluation seule ; la recherche exhaustive ne coûte que l'évaluation, le départage fin (`sansPlace`) ne porte que sur eux. */
const FINALISTES = 12;
const finalistes = { n: 0, valeur: new Float64Array(FINALISTES), action: new Int32Array(FINALISTES), grille: Array.from({ length: FINALISTES }, () => new Uint8Array(L)) };
function proposer(valeur: number, action: number, r: Uint8Array): void {
  const f = finalistes;
  let i = f.n; // insérer après tous ceux qui valent autant ou plus : à valeur égale, le premier trouvé reste devant
  while (i > 0 && f.valeur[i - 1]! < valeur) i--;
  if (i >= FINALISTES) return;
  const fin = Math.min(f.n, FINALISTES - 1);
  for (let j = fin; j > i; j--) {
    f.valeur[j] = f.valeur[j - 1]!;
    f.action[j] = f.action[j - 1]!;
    f.grille[j]!.set(f.grille[j - 1]!);
  }
  f.valeur[i] = valeur;
  f.action[i] = action;
  f.grille[i]!.set(r);
  if (f.n < FINALISTES) f.n++;
}

// Les tampons de la recherche (un état par profondeur) : rien n'est alloué pendant le choix d'un coup.
const RACINE = etat();
const APRES1 = etat();
const APRES2 = etat();

/** Le meilleur coup (col, ligne) pour la pièce du moment d'une partie, ou `null` si elle ne tient nulle part. Pur : ne change pas la partie. */
export function coupDuDiamant(partie: Pick<Partie, "grille" | "piece" | "suivante" | "combo" | "sansEffacement">): { col: number; ligne: number } | null {
  const p = partie.piece;
  if (!p) return null;
  for (let l = 0; l < L; l++) RACINE.r[l] = ((l < 4 ? partie.grille.lo : partie.grille.hi) >>> ((l & 3) * 8)) & LIGNE_PLEINE;
  RACINE.combo = partie.combo;
  RACINE.sans = partie.sansEffacement;
  RACINE.gain = 0;
  const q = partie.suivante;
  const P = POIDS_DIAMANT;
  finalistes.n = 0;
  for (let ligne = 0; ligne + p.hauteur <= L; ligne++) {
    for (let col = 0; col + p.largeur <= COLONNES; col++) {
      if (!tient(RACINE.r, p, col, ligne)) continue;
      const action = ligne * COLONNES + col;
      appliquer(RACINE, APRES1, p, col, ligne);
      if (q === null) {
        proposer(P.point * APRES1.gain + evaluerGrille(APRES1.r), action, APRES1.r);
        continue;
      }
      let place = false;
      for (let l2 = 0; l2 + q.hauteur <= L; l2++) {
        for (let c2 = 0; c2 + q.largeur <= COLONNES; c2++) {
          if (!tient(APRES1.r, q, c2, l2)) continue;
          place = true;
          appliquer(APRES1, APRES2, q, c2, l2);
          proposer(P.point * APRES2.gain + evaluerGrille(APRES2.r), action, APRES2.r);
        }
      }
      if (!place) proposer(MORT + P.point * APRES1.gain, action, APRES1.r); // aucune place pour la suivante : la partie s'arrête là
    }
  }
  if (finalistes.n === 0) return null;
  let choisi = -1;
  let valeur = -Infinity;
  for (let i = 0; i < finalistes.n; i++) {
    const v = finalistes.valeur[i]! + (finalistes.valeur[i]! > MORT / 2 ? P.sansPlace * piecesSansPlace(finalistes.grille[i]!) : 0);
    if (v > valeur || (v === valeur && finalistes.action[i]! < finalistes.action[choisi]!)) {
      valeur = v;
      choisi = i;
    }
  }
  const a = finalistes.action[choisi]!;
  return { col: a % COLONNES, ligne: Math.floor(a / COLONNES) };
}

/** Joue une partie entière avec le Diamant : le résultat et les actions (octets `ligne × 8 + colonne`), une rediffusion valide. */
export function jouerDiamant(contenu: Pick<Contenu, "suite" | "depart">): { resultat: Resultat; actions: number[] } {
  const partie = new Partie(contenu);
  const actions: number[] = [];
  while (!partie.finie) {
    const a = coupDuDiamant(partie)!;
    partie.poser(a.col, a.ligne);
    actions.push(a.ligne * COLONNES + a.col);
  }
  return { resultat: partie.resultat()!, actions };
}

/** La partie du bot sur le contenu du jour. */
export const partieDuDiamant = (contenu: Pick<Contenu, "suite" | "depart">): Resultat => jouerDiamant(contenu).resultat;

/** Les seuils des médailles d'un jour : le Diamant est la partie du bot, le reste s'en déduit (`medailles.ts`). Pur et déterministe ; quelques millisecondes (médiane) à quelques dizaines (pire cas) par jour. */
export const seuilsDe = (contenu: Pick<Contenu, "suite" | "depart">): Seuils => seuilsDepuis(partieDuDiamant(contenu).score);
