import { COLONNES, LIGNES } from "./constantes";

// Le catalogue des pièces (seed § 4) : 40 pièces, **chaque orientation est une pièce distincte** (pas de rotation en jeu). Les formes sont écrites en art ASCII (`X` = case) puis tournées / retournées ICI,
// une fois, au chargement : l'ordre des pièces (donc leur `id`, qui est ce que la suite du jour contient) est fixe et ne change qu'avec `BLOCKS_GENERATOR_VERSION`.
// Une pièce est ses `rangees` : un octet par ligne de la pièce, le bit `c` allumé = la case de la colonne `c` (0 = à gauche). Posée en (col, ligne), la rangée `k` va dans la ligne `ligne + k`, décalée de `col`.

export type Famille = "petite" | "barre" | "carre" | "coin" | "l" | "grandL" | "tsz" | "rectangle";

export interface Piece {
  /** Son rang dans le catalogue : ce que la suite du jour contient. */
  readonly id: number;
  /** Un nom stable (tests, scénarios, outils) : `famille-orientation`. */
  readonly nom: string;
  readonly famille: Famille;
  readonly cases: number;
  readonly largeur: number;
  readonly hauteur: number;
  /** Un octet par ligne de la pièce, du haut vers le bas. */
  readonly rangees: readonly number[];
  /** Le poids de tirage de base (avant la rampe). */
  readonly poids: number;
  /** 0 : 1 à 3 cases ; 1 : 4 cases ; 2 : 5 cases ; 3 : 6 cases ou plus. La rampe n'augmente que le poids des pièces de grosseur > 0. */
  readonly grosseur: 0 | 1 | 2 | 3;
  /** Sa boîte est de 3 × 3 (le carré 3 × 3, les quatre grands L et les quatre grands T) : jamais deux de suite. */
  readonly boite33: boolean;
  /** « Très grosse » : **6 cases ou plus, ou boîte de 3 × 3**. Aucune parmi les 6 premières pièces. */
  readonly tresGrosse: boolean;
}

type Art = readonly string[];
const cle = (a: Art): string => a.join("/");
/** Un quart de tour dans le sens horaire. */
const tourner = (a: Art): string[] => Array.from({ length: a[0]!.length }, (_, r) => Array.from({ length: a.length }, (_, c) => a[a.length - 1 - c]![r]!).join(""));
const miroir = (a: Art): string[] => a.map((r) => [...r].reverse().join(""));

function orientations(base: Art, mode: "fixe" | "tour" | "tourEtMiroir"): Art[] {
  const vues = new Set<string>();
  const out: Art[] = [];
  const ajouter = (a: Art): void => {
    if (!vues.has(cle(a))) {
      vues.add(cle(a));
      out.push(a);
    }
  };
  const tours = (a: Art): void => {
    let c: Art = a;
    for (let i = 0; i < 4; i++) {
      ajouter(c);
      c = tourner(c);
    }
  };
  if (mode === "fixe") ajouter(base);
  else {
    tours(base);
    if (mode === "tourEtMiroir") tours(miroir(base));
  }
  return out;
}

// [famille, nom, art de base, orientations, poids]. Poids (seed § 4) : petites faible (les deux dominos : pas de pièce de 1 case), barres moyen, carrés moyen (2 × 2) / faible (3 × 3), coins moyen, L et J moyen, grand L et grand T faible (2), T S Z moyen, rectangles faible.
const DEFINITIONS: readonly (readonly [Famille, string, Art, "fixe" | "tour" | "tourEtMiroir", number])[] = [
  ["petite", "domino", ["XX"], "tour", 4],
  ["barre", "barre3", ["XXX"], "tour", 8],
  ["barre", "barre4", ["XXXX"], "tour", 6],
  ["barre", "barre5", ["XXXXX"], "tour", 4],
  ["carre", "carre2", ["XX", "XX"], "fixe", 9],
  ["carre", "carre3", ["XXX", "XXX", "XXX"], "fixe", 3],
  ["coin", "coin", ["X.", "XX"], "tour", 8],
  ["l", "l", ["X.", "X.", "XX"], "tourEtMiroir", 6],
  ["grandL", "grandl", ["X..", "X..", "XXX"], "tour", 2],
  ["tsz", "t", ["XXX", ".X."], "tour", 6],
  ["tsz", "grandt", ["XXX", ".X.", ".X."], "tour", 2],
  ["tsz", "s", [".XX", "XX."], "tour", 5],
  ["tsz", "z", ["XX.", ".XX"], "tour", 5],
  ["rectangle", "rect", ["XXX", "XXX"], "tour", 3],
];

function construire(): Piece[] {
  const pieces: Piece[] = [];
  for (const [famille, nom, base, mode, poids] of DEFINITIONS) {
    orientations(base, mode).forEach((art, k) => {
      const cases = art.join("").replace(/\./g, "").length;
      const rangees = art.map((r) => [...r].reduce((o, ch, c) => (ch === "X" ? o | (1 << c) : o), 0));
      const largeur = art[0]!.length;
      const hauteur = art.length;
      const boite33 = largeur === 3 && hauteur === 3;
      pieces.push({
        id: pieces.length,
        nom: `${nom}-${k}`,
        famille,
        cases,
        largeur,
        hauteur,
        rangees,
        poids,
        grosseur: cases <= 3 ? 0 : cases === 4 ? 1 : cases === 5 ? 2 : 3,
        boite33,
        tresGrosse: cases >= 6 || boite33,
      });
    });
  }
  return pieces;
}

export const PIECES: readonly Piece[] = construire();
export const NB_PIECES = PIECES.length;

export function pieceParNom(nom: string): Piece {
  const p = PIECES.find((x) => x.nom === nom);
  if (!p) throw new Error(`pièce inconnue : ${nom}`);
  return p;
}

/** Les positions possibles de la boîte de la pièce (coin haut-gauche) : colonnes 0 à `COLONNES − largeur`, lignes 0 à `LIGNES − hauteur`. */
export const colonnesMax = (p: Piece): number => COLONNES - p.largeur;
export const lignesMax = (p: Piece): number => LIGNES - p.hauteur;
