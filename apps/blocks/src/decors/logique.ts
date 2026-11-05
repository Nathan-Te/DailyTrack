import { melanger } from "@cdj/visuels/blocs";

// Lot B5 — la LOGIQUE PURE des décors de Blocks (sans navigateur, testée) : le vocabulaire de formes en aplat, le décor d'un thème, la mesure de ce qu'il peint. **De l'affichage seulement** : rien ici ne lit la partie.
// C'est le même esprit et le même vocabulaire que les décors de Tower (`apps/tower/src/decorLogique.ts` : rectangles, polygones, disques, traits ; plans lointain, moyen, proche, sol ; petites animations lentes), **redessinés ici** (un jeu
// n'importe jamais un autre jeu) ; ce qui mériterait d'aller dans `@cdj/visuels` est proposé dans le README du lot B5. Différences voulues : **le décor est plus calme que les blocs** (pas de contour d'encre noir : un contour d'un ton
// plus sombre que la forme ; toutes les couleurs sont tirées vers le ciel de la valeur `calme` du thème), et il se pose DERRIÈRE une grille : la scène le centre sur l'écran, ancré au bas.

/** La planche : 400 × 300 px de dessin (la ligne du sol à y = 250), répétée en largeur (en miroir une tuile sur deux) et ancrée au bas de l'écran. Des éléments à y < 0 peuplent le ciel quand l'écran est un portrait. */
export const LARGEUR_PLANCHE = 400;
export const HAUTEUR_PLANCHE = 300;
export const LIGNE_SOL = 250;

/** Une forme en aplat. `ink` : un contour d'un ton plus sombre (jamais l'encre noire des blocs). Polygones convexes seulement. */
export type Forme =
  | { t: "r"; c: string; x: number; y: number; w: number; h: number; ink?: boolean }
  | { t: "p"; c: string; pts: readonly number[]; ink?: boolean }
  | { t: "c"; c: string; x: number; y: number; r: number; ink?: boolean }
  | { t: "l"; c: string; x1: number; y1: number; x2: number; y2: number; w: number };
export const R = (c: string, x: number, y: number, w: number, h: number, ink = false): Forme => ({ t: "r", c, x, y, w, h, ink });
export const P = (c: string, pts: readonly number[], ink = false): Forme => ({ t: "p", c, pts, ink });
export const C = (c: string, x: number, y: number, r: number, ink = false): Forme => ({ t: "c", c, x, y, r, ink });
export const L = (c: string, x1: number, y1: number, x2: number, y2: number, w = 2): Forme => ({ t: "l", c, x1, y1, x2, y2, w });
/** Un ruban plat (aurore, vague) : la ligne brisée `pts` épaissie vers le bas de `ep` px. */
export function Ruban(c: string, ep: number, pts: readonly number[]): Forme[] {
  const sortie: Forme[] = [];
  for (let i = 0; i + 3 < pts.length; i += 2) sortie.push(P(c, [pts[i]!, pts[i + 1]!, pts[i + 2]!, pts[i + 3]!, pts[i + 2]!, pts[i + 3]! + ep, pts[i]!, pts[i + 1]! + ep]));
  return sortie;
}
/** Un relief en aplat (collines, falaises) : le haut suit les points `[x, y, x, y…]` (x croissants), le bas est la ligne `base`. */
export function Profil(c: string, base: number, pts: readonly number[], ink = false): Forme[] {
  const sortie: Forme[] = [];
  for (let i = 0; i + 3 < pts.length; i += 2) sortie.push(P(c, [pts[i]!, base, pts[i]!, pts[i + 1]!, pts[i + 2]!, pts[i + 3]!, pts[i + 2]!, base], ink));
  return sortie;
}
/** Une ellipse (un manchot, une feuille) : un polygone à seize côtés. */
export const Ell = (c: string, cx: number, cy: number, rx: number, ry: number, ink = false): Forme =>
  P(c, Array.from({ length: 16 }, (_, i) => [cx + rx * Math.cos((i * Math.PI) / 8), cy + ry * Math.sin((i * Math.PI) / 8)]).flat(), ink);
/** Les mêmes formes, décalées de `dx`, `dy` px. */
export function deplacer(formes: readonly Forme[], dx: number, dy: number): Forme[] {
  return formes.map((f): Forme => {
    switch (f.t) {
      case "r":
      case "c":
        return { ...f, x: f.x + dx, y: f.y + dy };
      case "l":
        return { ...f, x1: f.x1 + dx, y1: f.y1 + dy, x2: f.x2 + dx, y2: f.y2 + dy };
      case "p":
        return { ...f, pts: f.pts.map((v, i) => v + (i % 2 === 0 ? dx : dy)) };
    }
  });
}

/**
 * Une animation lente (coupée avec « mouvements réduits » : la forme reste à sa place) : `bob` monte et descend de `a` px, `derive` va et vient de `a` px, `tombe` descend en boucle sur `a` px (la neige), `scintille`
 * s'allume et s'éteint. `T` : la période (s). `repete` : posée sur chaque tuile (sinon une seule fois, au milieu).
 */
export interface Anim {
  mode: "bob" | "derive" | "tombe" | "scintille";
  formes: readonly Forme[];
  a: number;
  T: number;
  ph?: number;
  repete?: boolean;
}
export interface PlanDecor {
  /** Posé une fois, au milieu. */
  centre: readonly Forme[];
  /** Posé sur chaque tuile. */
  repete: readonly Forme[];
}
/** Une bande de ciel en aplat : du haut `de` (px de la planche) jusqu'à la bande suivante (la première part de très haut). */
export interface BandeCiel {
  de: number;
  c: string;
}
export interface DecorTheme {
  /** Les bandes du ciel, de haut en bas (des aplats qui se suivent, jamais un dégradé). */
  bandes: readonly BandeCiel[];
  /** Les quatre plans : lointain, moyen, proche, sol. */
  plans: readonly [PlanDecor, PlanDecor, PlanDecor, PlanDecor];
  anims: readonly Anim[];
  /** Combien le décor est tiré vers le ciel (0 à 1) : plus c'est grand, plus il est calme. */
  calme: number;
}

/** La couleur d'une forme dans la scène : tirée vers `ciel` de `calme`. */
export const calmer = (couleur: string, ciel: string, calme: number): string => melanger(couleur, ciel, calme);
/** Le contour d'une forme : un ton plus sombre que son remplissage (jamais l'encre des blocs). */
export const contour = (couleur: string): string => melanger(couleur, "#000000", 0.28);

/** L'aire peinte par une forme dans la planche (rognée à la planche pour les rectangles, qui peuvent s'étendre très haut). */
export function aire(f: Forme): number {
  switch (f.t) {
    case "r": {
      const w = Math.max(0, Math.min(f.x + f.w, LARGEUR_PLANCHE) - Math.max(f.x, 0));
      const h = Math.max(0, Math.min(f.y + f.h, HAUTEUR_PLANCHE) - Math.max(f.y, 0));
      return w * h;
    }
    case "c":
      return Math.PI * f.r * f.r;
    case "l":
      return Math.hypot(f.x2 - f.x1, f.y2 - f.y1) * f.w;
    case "p": {
      let s = 0;
      for (let i = 0; i < f.pts.length; i += 2) {
        const j = (i + 2) % f.pts.length;
        s += f.pts[i]! * f.pts[j + 1]! - f.pts[j]! * f.pts[i + 1]!;
      }
      return Math.abs(s) / 2;
    }
  }
}

/** Toutes les formes d'un décor, dans l'ordre où elles se peignent : les bandes du ciel (rectangles), les quatre plans, les animations. */
export function formesDuDecor(d: DecorTheme): Forme[] {
  const bandes = d.bandes.map((b, i): Forme => R(b.c, 0, Math.max(0, b.de), LARGEUR_PLANCHE, (i + 1 < d.bandes.length ? d.bandes[i + 1]!.de : HAUTEUR_PLANCHE) - Math.max(0, b.de)));
  return [...bandes, ...d.plans.flatMap((p) => [...p.centre, ...p.repete]), ...d.anims.flatMap((a) => a.formes)];
}

/** Les couleurs d'un décor (après `calmer`, `ciel` étant la première bande) et la part de la planche que chacune peint : de quoi vérifier le contraste avec la grille et le calme du décor. Les couleurs de contour ne comptent pas. */
export function couleursDuDecor(d: DecorTheme): { couleur: string; part: number }[] {
  const ciel = d.bandes[0]!.c;
  const parCouleur = new Map<string, number>();
  for (const f of formesDuDecor(d)) {
    const c = calmer(f.c, ciel, d.calme);
    parCouleur.set(c, (parCouleur.get(c) ?? 0) + aire(f));
  }
  const total = LARGEUR_PLANCHE * HAUTEUR_PLANCHE;
  return [...parCouleur].map(([couleur, a]) => ({ couleur, part: a / total })).sort((a, b) => b.part - a.part);
}
