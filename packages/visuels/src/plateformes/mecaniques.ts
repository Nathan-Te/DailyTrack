import type { Grille } from "./tuiles";

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

// ——— Lot PG1 : ce que le jeu d'origine dessinait seul et que les autres jeux de plateformes reprennent (piques, tapis, courant d'air, blocs qui changent) ———
// **Pur** : des nombres et des tampons de nombres, aucun moteur de rendu. Les valeurs sont celles du jeu d'origine, **sans changement** (`test/plateformesPG1.test.ts` en garde l'empreinte).

/** Le sens d'un pique : la pointe vers le haut, le bas, la gauche ou la droite (le jeu dit ce que sont ses codes de case). */
export type SensPique = "haut" | "bas" | "gauche" | "droite";
/** Profondeurs (tuiles) du pique et de son cerne (derrière lui), et l'épaisseur de ce cerne : un triangle agrandi de `cerne` tout autour (`trianglesDePiques(…, PIQUE.cerne)`). Le pique est rouge (`HAZARD`), son cerne sombre (`HAZARD_OUTLINE`). */
export const PIQUE = { z: 0.05, zCerne: 0.045, cerne: 0.09 } as const;

/**
 * Les piques d'une grille : **un triangle franc par case**, pointe selon le sens (coordonnées du monde, y vers le haut : la rangée `r` occupe y de −r−1 à −r), neuf nombres par triangle (x y z × 3, z = 0). `grow` > 0 : le
 * cerne, le même triangle agrandi autour de son centre de gravité. `sensDe` dit si une case est un pique et où il pointe (`null` : une autre case).
 */
export function trianglesDePiques(grille: Grille, sensDe: (t: number) => SensPique | null, grow = 0): number[] {
  const pos: number[] = [];
  for (let row = 0; row < grille.height; row++) {
    for (let col = 0; col < grille.width; col++) {
      const sens = sensDe(grille.tiles[row * grille.width + col]!);
      if (!sens) continue;
      const x0 = col;
      const x1 = col + 1;
      const yTop = -row;
      const yBot = -row - 1;
      const xm = col + 0.5;
      const ym = -row - 0.5;
      if (sens === "haut") pos.push(x0, yBot, 0, x1, yBot, 0, xm, yTop, 0);
      else if (sens === "bas") pos.push(x0, yTop, 0, xm, yBot, 0, x1, yTop, 0);
      else if (sens === "gauche") pos.push(x1, yTop, 0, x0, ym, 0, x1, yBot, 0);
      else pos.push(x0, yBot, 0, x1, ym, 0, x0, yTop, 0);
      if (grow > 0) {
        // Cerne : le triangle agrandi autour de son centre de gravité.
        const k = pos.length - 9;
        const cx = (pos[k]! + pos[k + 3]! + pos[k + 6]!) / 3;
        const cy = (pos[k + 1]! + pos[k + 4]! + pos[k + 7]!) / 3;
        for (let v = 0; v < 3; v++) {
          const dx = pos[k + v * 3]! - cx;
          const dy = pos[k + v * 3 + 1]! - cy;
          const len = Math.hypot(dx, dy) || 1;
          pos[k + v * 3] = cx + dx * (1 + (grow * 2) / len);
          pos[k + v * 3 + 1] = cy + dy * (1 + (grow * 2) / len);
        }
      }
    }
  }
  return pos;
}

/** Les chevrons du tapis qui défilent : période (tuiles), vitesse d'affichage (tuiles/s : la moitié de la vitesse du tapis, pour ne pas hacher l'image), profondeur de dessin (juste au-dessus de la garniture, sous les dangers). */
export const BELT_PERIOD = 0.8;
export const BELT_FLOW = 2.4;
export const BELT_Z = 0.0075;
/** Part de la période occupée par un chevron (le reste est du fond) et retard des bords du chevron sur sa pointe (périodes) : il pointe dans le sens du tapis. */
export const STRIPE = 0.42;
export const CHEVRON_LAG = 0.38;

/** Phase des chevrons (tuiles de défilement) à l'instant `clock` (s) : `flow` × temps, ou 0 (figés) sans mouvement. Pure : un test vérifie « figé » et le sens sans moteur de rendu. */
export function beltTime(clock: number, motion: boolean): number {
  return motion ? clock * (BELT_FLOW / BELT_PERIOD) : 0;
}

/** Position (tuiles) du centre du chevron le plus proche de `x0` à la rangée centrale de la bande, au temps `uTime`, pour un tapis de sens `dir` : la même formule que le shader. */
export function chevronAt(x0: number, dir: number, uTime: number): number {
  const f = (dir * x0) / BELT_PERIOD - uTime;
  const k = Math.floor(f);
  return dir * (uTime + k + STRIPE / 2) * BELT_PERIOD;
}

/**
 * Une flèche du courant d'air (un chevron épais : deux branches de quatre sommets) centrée en (x, y), dans le sens (dx, dy) (un vecteur unitaire) : douze sommets (x y z) **ajoutés à `pos`**. La flèche mesure 0,5 le long du
 * vent et 0,7 en travers ; ses couleurs (`WIND_STYLE.arrow`) et son opacité (`WIND_ARROW_IDLE` éteinte, `WIND_ARROW_ON` allumée) sont plus haut.
 */
export function ajouterFlecheDeVent(pos: number[], x: number, y: number, dx: number, dy: number): void {
  // Repère de la flèche : u le long du vent, v en travers.
  const ux = dx;
  const uy = dy;
  const vx = -dy;
  const vy = dx;
  const at = (u: number, v: number) => [x + ux * u + vx * v, y + uy * u + vy * v, 0];
  const t = 0.13;
  const quad = (a: number[], b: number[], c: number[], d: number[]) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  // Deux branches : de (−0,25, ±0,35) à la pointe (0,25, 0).
  quad(at(-0.25, 0.35), at(-0.25 + t, 0.35), at(0.25 + t / 2, 0), at(0.25 - t / 2, 0));
  quad(at(-0.25, -0.35), at(-0.25 + t, -0.35), at(0.25 + t / 2, 0), at(0.25 - t / 2, 0));
}

/** Les blocs qui changent (clignotant, alternés A et B), **leur forme** : tailles en tuiles, centrées sur le bloc. L'aspect en couleur est `BLOCK_STYLE` ; la logique des états (cycles, annonce) reste au jeu. */
export const BLOC_FORME = {
  /** Côté de la face (qui part du bas du bloc : sa hauteur dessinée est le niveau de la jauge) et du contour ; épaisseur du contour fin et du contour épais. */
  face: 0.92,
  cadre: 0.96,
  fin: 0.05,
  epais: 0.14,
  /** Tirets par côté du contour pointillé (cinq tirets, quatre vides) ; épaisseur du trait du niveau de la jauge. */
  tirets: 5,
  traitDeNiveau: 0.05,
  /** Repère du jeu A (une barre : largeur × hauteur) et du jeu B (un losange : demi-diagonale) ; un clignotant n'en a pas. */
  barre: { w: 0.46, h: 0.11 },
  losange: 0.17,
  /** La pastille du prochain jeu, au coin d'un bloc alterné plein : une petite barre (pour A) ou un petit losange (pour B), à `pastille.coin` du centre. */
  pastille: { barre: { w: 0.2, h: 0.06 }, losange: 0.075, coin: 0.32 },
  /** Profondeurs (tuiles) du bloc, de ses contours, du trait de niveau, du repère et de la pastille. */
  z: { bloc: 0.03, contour: 0.002, trait: 0.003, repere: 0.004, pastille: 0.005 },
} as const;
/** Opacités : le remplissage d'un bloc absent dont le contour se remplit (translucide : il n'est pas encore là), le contour pointillé au repos et plein, le repère d'un alterné absent (en filigrane), la face fantôme que laisse une bascule. */
export interface OpacitesDeBloc {
  readonly remplissage: number;
  readonly pointilleMin: number;
  readonly pointilleMax: number;
  readonly repereAbsent: number;
  readonly fantome: number;
}
export const BLOC_OPACITES: OpacitesDeBloc = { remplissage: 0.4, pointilleMin: 0.4, pointilleMax: 0.9, repereAbsent: 0.55, fantome: 0.45 };
