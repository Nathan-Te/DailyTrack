import { BONUS_PLATEAU_VIDE, COLONNES, LIGNE_PLEINE, LIGNES, POINTS_EFFACEMENT, POSES_SANS_EFFACEMENT_MAX, TAILLE_SERIE } from "./constantes";
import { BLOCKS_GENERATOR_VERSION } from "./constantes";
import { dailyBlocks, type Contenu } from "./generateur";
import { figerJour, type JourFige } from "./jours";
import { PIECES, type Piece } from "./pieces";
import { actionDe, colonneDe, emplacementDe, ligneDe, Partie, type Resultat, type ResultatDeBot } from "./partie";
import { PIECES_DU_DIAMANT, SEUILS_MEDAILLES, type Seuils } from "./medailles";
import { BITS, evaluerGrille, piecesSansPlace, POIDS_DIAMANT } from "./evaluation";
export { evaluerGrille, piecesSansPlace, POIDS_DIAMANT };

// LE BOT DIAMANT (lot B3, refait au lot B8 pour les séries de trois) — seed § 5 : « pour chaque série, il cherche le meilleur ordre et les meilleures positions des trois pièces, selon une évaluation de la grille ».
// Son score sur la suite du jour est le Diamant (dans les données, la clé reste `auteur`) ; les autres médailles viennent des bots de référence et de ses fractions (`medailles.ts`).
//
// **Le bot fait partie des règles du classement** : tout changement de sa logique, de ses poids ou de sa largeur de faisceau monte `BLOCKS_BOT_VERSION` (`constantes.ts`) et régénère le golden de ses scores (`npm run golden:blocks`).
// **Jamais d'aléa** : ni `Math.random`, ni horloge, ni état entre deux parties. Il ne joue que des actions légales (celles de `Partie`, qui rejette le reste) : sa partie est une rediffusion valide, rejouée par le code du serveur.
//
// **Comment il choisit : une RECHERCHE EN FAISCEAU, série par série.** On part de la grille et des pièces restantes de la série ; à chaque niveau (une pose de plus), chaque grille gardée donne ses enfants — toutes les positions légales
// de chacune des pièces restantes, dans cet ordre : emplacement, puis ligne de haut en bas, puis colonne de gauche à droite — et on ne garde que les `K` MEILLEURES grilles (`LARGEUR_FAISCEAU`). Valeur d'une grille =
//   POIDS.point × (points gagnés depuis la racine, combo compris) + évaluation de la grille.
// **Départage fixe** : à valeur égale, l'enfant engendré en premier garde sa place ; deux chemins qui mènent à la même grille (même combo, mêmes pièces restantes) ne comptent qu'une fois (le meilleur, puis le premier). Une branche où il
// reste une pièce mais où aucune ne tient est « morte » (la partie s'arrête là) : elle ne passe devant les autres que si toutes meurent. **Il ne regarde jamais la série suivante** (lot B8b : un joueur ne la voit pas, seed § 3 — le bot qui donne les médailles doit jouer à armes égales) : il ne connaît que la grille et les pièces restantes de sa série. Au dernier niveau, les `FINALISTES` meilleures grilles sont départagées par le nombre de pièces du catalogue qui ne tiennent plus nulle part (`sansPlace`), qui ne dit rien d'une pièce à venir.
// **L'évaluation de la grille** : `evaluation.ts` (partagée avec le bot moyen).
const L = LIGNES;

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

/** La largeur du faisceau : combien de grilles on garde à chaque niveau. Fait partie du bot (`BLOCKS_BOT_VERSION`). Mesure (lot B8) : README du lot. */
export const LARGEUR_FAISCEAU = 8;
/** Les meilleures grilles de fin de série départagées par `sansPlace`. */
const FINALISTES = 6;
const K_MAX = 256;

/** Un faisceau : au plus K grilles, triées par valeur décroissante (`ordre` : les indices de cases de stockage), chacune avec son état et les actions qui y mènent. */
interface Faisceau {
  n: number;
  ordre: Int32Array;
  val: Float64Array;
  rows: Uint8Array;
  combo: Int32Array;
  sans: Int32Array;
  gain: Int32Array;
  reste: Int32Array;
  acts: Int16Array;
  sigLo: Int32Array;
  sigHi: Int32Array;
}
const faisceau = (): Faisceau => ({ n: 0, ordre: new Int32Array(K_MAX), val: new Float64Array(K_MAX), rows: new Uint8Array(K_MAX * L), combo: new Int32Array(K_MAX), sans: new Int32Array(K_MAX), gain: new Int32Array(K_MAX), reste: new Int32Array(K_MAX), acts: new Int16Array(K_MAX * TAILLE_SERIE), sigLo: new Int32Array(K_MAX), sigHi: new Int32Array(K_MAX) });
const F1 = faisceau();
const F2 = faisceau();
const PARENT = etat();
const ENFANT = etat();

/** Propose une grille (l'état `e`, avec `reste` = les emplacements restants, en bits) au faisceau `f` de largeur `k` : elle y entre si elle fait partie des `k` meilleures et n'est pas déjà là (le meilleur, puis le premier, gagne). */
function proposer(f: Faisceau, k: number, valeur: number, e: Etat, reste: number, parent: Faisceau, pi: number, niveau: number, action: number): void {
  if (f.n === k && valeur <= f.val[f.ordre[k - 1]!]!) return;
  const lo = e.r[0]! | (e.r[1]! << 8) | (e.r[2]! << 16) | (e.r[3]! << 24);
  const hi = e.r[4]! | (e.r[5]! << 8) | (e.r[6]! << 16) | (e.r[7]! << 24);
  let libre = -1;
  for (let j = 0; j < f.n; j++) {
    const s = f.ordre[j]!;
    if (f.sigLo[s] !== lo || f.sigHi[s] !== hi || f.reste[s] !== reste || f.combo[s] !== e.combo || f.sans[s] !== e.sans) continue;
    if (f.val[s]! >= valeur) return; // la même grille, au moins aussi bonne, est déjà là
    libre = s;
    for (let m = j; m < f.n - 1; m++) f.ordre[m] = f.ordre[m + 1]!;
    f.n--;
    break;
  }
  let i = f.n;
  while (i > 0 && f.val[f.ordre[i - 1]!]! < valeur) i--;
  if (i >= k) return;
  let slot: number;
  if (libre >= 0) slot = libre;
  else if (f.n < k) slot = f.n;
  else slot = f.ordre[k - 1]!;
  const fin = f.n < k ? f.n : k - 1;
  for (let j = fin; j > i; j--) f.ordre[j] = f.ordre[j - 1]!;
  f.ordre[i] = slot;
  if (f.n < k) f.n++;
  f.val[slot] = valeur;
  f.rows.set(e.r, slot * L);
  f.combo[slot] = e.combo;
  f.sans[slot] = e.sans;
  f.gain[slot] = e.gain;
  f.reste[slot] = reste;
  f.sigLo[slot] = lo;
  f.sigHi[slot] = hi;
  for (let a = 0; a < niveau - 1; a++) f.acts[slot * TAILLE_SERIE + a] = parent.acts[pi * TAILLE_SERIE + a]!;
  f.acts[slot * TAILLE_SERIE + niveau - 1] = action;
}

function tientQuelquePartRows(r: ArrayLike<number>, p: Piece): boolean {
  for (let l = 0; l + p.hauteur <= L; l++) for (let c = 0; c + p.largeur <= COLONNES; c++) if (tientRows(r, p, c, l)) return true;
  return false;
}
function tientRows(r: ArrayLike<number>, p: Piece, col: number, ligne: number): boolean {
  for (let k = 0; k < p.hauteur; k++) if ((r[ligne + k]! & (p.rangees[k]! << col)) !== 0) return false;
  return true;
}

/**
 * **Le plan du Diamant pour les pièces restantes de la série en cours** : la suite d'actions (octets `emplacement × 64 + ligne × 8 + colonne`) à jouer, dans l'ordre, ou une liste vide si rien ne tient. Pur : ne change pas la partie.
 * `k` : la largeur du faisceau (mesures seulement ; le jeu et le serveur prennent `LARGEUR_FAISCEAU`).
 */
export function planDuDiamant(partie: Pick<Partie, "grille" | "dernieresPieces" | "combo" | "sansEffacement" | "contenu" | "serie" | "finie">, k: number = LARGEUR_FAISCEAU): number[] {
  if (partie.finie) return [];
  const pieces = partie.dernieresPieces;
  let masque = 0;
  for (let e = 0; e < TAILLE_SERIE; e++) if (pieces[e]) masque |= 1 << e;
  const aPoser = (masque & 1) + ((masque >> 1) & 1) + ((masque >> 2) & 1);
  if (aPoser === 0) return [];
  const P = POIDS_DIAMANT;
  let courant = F1;
  let suivant = F2;
  courant.n = 0;
  // La racine : la grille de la partie.
  const racine = ENFANT;
  for (let l = 0; l < L; l++) racine.r[l] = ((l < 4 ? partie.grille.lo : partie.grille.hi) >>> ((l & 3) * 8)) & LIGNE_PLEINE;
  racine.combo = partie.combo;
  racine.sans = partie.sansEffacement;
  racine.gain = 0;
  courant.n = 1;
  courant.ordre[0] = 0;
  courant.val[0] = 0;
  courant.rows.set(racine.r, 0);
  courant.combo[0] = racine.combo;
  courant.sans[0] = racine.sans;
  courant.gain[0] = 0;
  courant.reste[0] = masque;
  let mortGain = -1;
  let mortActs: number[] = [];
  for (let niveau = 1; niveau <= aPoser; niveau++) {
    suivant.n = 0;
    for (let j = 0; j < courant.n; j++) {
      const pi = courant.ordre[j]!;
      for (let l = 0; l < L; l++) PARENT.r[l] = courant.rows[pi * L + l]!;
      PARENT.combo = courant.combo[pi]!;
      PARENT.sans = courant.sans[pi]!;
      PARENT.gain = courant.gain[pi]!;
      const reste = courant.reste[pi]!;
      let enfants = 0;
      for (let e = 0; e < TAILLE_SERIE; e++) {
        if (!(reste & (1 << e))) continue;
        const p = pieces[e]!;
        const apres = reste & ~(1 << e);
        for (let ligne = 0; ligne + p.hauteur <= L; ligne++) {
          for (let col = 0; col + p.largeur <= COLONNES; col++) {
            if (!tient(PARENT.r, p, col, ligne)) continue;
            enfants++;
            appliquer(PARENT, ENFANT, p, col, ligne);
            proposer(suivant, k, P.point * ENFANT.gain + evaluerGrille(ENFANT.r), ENFANT, apres, courant, pi, niveau, actionDe(e, col, ligne));
          }
        }
      }
      if (enfants === 0 && reste !== 0 && PARENT.gain > mortGain) {
        // Il reste une pièce mais aucune ne tient : la partie s'arrête là.
        mortGain = PARENT.gain;
        mortActs = Array.from({ length: niveau - 1 }, (_, a) => courant.acts[pi * TAILLE_SERIE + a]!);
      }
    }
    if (suivant.n === 0) break;
    const t = courant;
    courant = suivant;
    suivant = t;
    if (niveau === aPoser) break;
  }
  // Le dernier niveau est complet si le faisceau a `aPoser` poses ; sinon (branches mortes) on joue la meilleure branche morte.
  const complet = courant.n > 0 && courant.reste[courant.ordre[0]!] === 0;
  if (!complet) return mortActs;
  // Les finalistes : la meilleure valeur, corrigée par le nombre de pièces du catalogue qui ne tiennent plus (aucune lecture de la suite : le bot ne voit pas les séries à venir).
  let choisi = -1;
  let meilleur = -Infinity;
  const finalistes = Math.min(courant.n, FINALISTES);
  for (let j = 0; j < finalistes; j++) {
    const s = courant.ordre[j]!;
    const v = courant.val[s]! + P.sansPlace * piecesSansPlace(courant.rows.subarray(s * L, s * L + L));
    if (v > meilleur) {
      meilleur = v;
      choisi = s;
    }
  }
  return Array.from({ length: aPoser }, (_, a) => courant.acts[choisi * TAILLE_SERIE + a]!);
}

/** Le plan en cours d'une partie (le scène `&bot` pose coup après coup : on ne recalcule pas à chaque pose). */
const plans = new WeakMap<object, { serie: number; restantes: number; plan: number[] }>();

/** Le prochain coup du Diamant, ou `null` si rien ne tient. Pur pour la partie ; garde le plan de la série en mémoire. */
export function coupDuDiamant(partie: Partie): { emplacement: number; col: number; ligne: number } | null {
  let p = plans.get(partie);
  if (!p || p.serie !== partie.serie || p.restantes - partie.restantesCount < 0 || p.restantes - partie.restantesCount >= p.plan.length) {
    p = { serie: partie.serie, restantes: partie.restantesCount, plan: planDuDiamant(partie) };
    plans.set(partie, p);
  }
  const a = p.plan[p.restantes - partie.restantesCount];
  if (a === undefined) return null;
  // Un plan se vérifie : s'il n'est plus légal (la partie a changé sous lui), on le refait.
  if (!partie.legale(emplacementDe(a), colonneDe(a), ligneDe(a))) {
    p = { serie: partie.serie, restantes: partie.restantesCount, plan: planDuDiamant(partie) };
    plans.set(partie, p);
    const b = p.plan[0];
    return b === undefined ? null : { emplacement: emplacementDe(b), col: colonneDe(b), ligne: ligneDe(b) };
  }
  return { emplacement: emplacementDe(a), col: colonneDe(a), ligne: ligneDe(a) };
}

/**
 * Joue une partie avec le Diamant : le résultat et les actions (octets `emplacement × 64 + ligne × 8 + colonne`). `k` : la largeur du faisceau (mesures). **`jusqua` (lot B8b)** : s'arrête après ce nombre de pièces
 * posées (une série entière à la fois : le bot planifie série par série) ; la partie n'est alors pas finie, le résultat est son score du moment (`raison` « arret ») et ses actions ne sont pas une rediffusion qu'on envoie.
 * Sans `jusqua`, c'est la partie entière, une rediffusion valide.
 */
export function jouerDiamant(contenu: Pick<Contenu, "suite" | "depart">, k: number = LARGEUR_FAISCEAU, jusqua: number = Infinity): { resultat: ResultatDeBot; actions: number[] } {
  const partie = new Partie(contenu);
  const actions: number[] = [];
  while (!partie.finie && partie.poses < jusqua) {
    const plan = planDuDiamant(partie, k);
    if (plan.length === 0) break; // inatteignable : une partie non finie a toujours une pièce qui tient
    for (const a of plan) {
      if (partie.poses >= jusqua) break;
      if (partie.jouerAction(a) === null) throw new Error("diamant : action illégale");
      actions.push(a);
    }
  }
  return { resultat: partie.instantane(), actions };
}

/** La partie du Diamant sur le contenu du jour, arrêtée après `PIECES_DU_DIAMANT` pièces (ou plus tôt, s'il meurt) : celle qu'on regarde (`&bot`) et qu'on revoit. Pas une rediffusion qu'on envoie (la partie n'est pas finie). */
export const partieDuDiamant = (contenu: Pick<Contenu, "suite" | "depart">): { resultat: ResultatDeBot; actions: number[] } => jouerDiamant(contenu, LARGEUR_FAISCEAU, PIECES_DU_DIAMANT);

/** Le fichier à figer pour un jour : sa suite **et** ses seuils (ceux de cette version du code ; l'outil `figer:blocks` et « Mettre en production » écrivent ce fichier, jamais deux fois). */
export function figerJourDuDiamant(jour: number, version: number = BLOCKS_GENERATOR_VERSION): JourFige {
  return figerJour(jour, { ...SEUILS_MEDAILLES }, version);
}
