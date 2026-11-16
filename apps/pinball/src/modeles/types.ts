import type { BufferGeometry } from "three";

// Lot PBV4 : les modèles des modules communs, un fichier par thème (`foire.ts`, `ocean.ts`, `espace.ts`, `volcan.ts`), chacun avec ses deux versions : **en volume** (`trois` : des pièces construites par le code avec les
// `Outils`, sans fichier 3D) et **à plat** (`plat` : une icône vue de dessus pour le rendu de secours). Un fichier de thème n'importe jamais three.js (seulement ses types) : les outils lui sont passés, ce qui garde three.js
// hors du rendu de secours. **Le retour au contact n'est pas écrit dans les thèmes** : il est commun (`trois.ts`, `plat.ts`) et passe par le rôle des pièces — un bumper s'enfonce (`haut`) et son socle s'allume
// (`lumiere`), une cible tombe (toute la pièce), un spinner tourne (`tourne`), un trou s'allume quand il garde la bille (`lumiere`). Ainsi un même type de module réagit de la même façon dans tous les thèmes.

/** L'encre, le papier et la moutarde du jeu (les mêmes que `dessin.ts`, que ce dossier n'importe pas : `test/modeles.test.ts` vérifie qu'ils sont égaux). */
export const ENCRE = "#2A1E16";
export const PAPIER = "#FFF6E0";
export const MOUTARDE = "#E8B23A";

/** Les modules communs : un modèle par thème pour chacun (les mini-bumpers sont le modèle du bumper, réduit). */
export const TYPES_COMMUNS = ["bumper", "cible", "spinner", "trou"] as const;
export type TypeCommun = (typeof TYPES_COMMUNS)[number];
/** Les modèles de référence sont construits à ces tailles de collision (px) : un bumper de 17 px de rayon, une cible de 20 px de long, un spinner de 22 px de demi-largeur, un trou de 13 px de rayon. */
export const REFERENCE = { bumper: 17, cible: 20, spinner: 22, trou: 13 } as const;

/** La matière d'une pièce. `c` : sa couleur ; pour une pièce `lumiere`, `c` est la couleur éteinte et `allumee` la couleur au contact ; `teintes` : une couleur par instance, tour à tour. */
export interface Matiere {
  c: string;
  /** Rugosité (0 : miroir, 1 : mat), métal (0 ou 1), reflet de la pièce (l'environnement). */
  rug?: number;
  met?: number;
  env?: number;
  /** Opacité (transparent si < 1). */
  op?: number;
  /** Une lueur constante (lave, néon). */
  em?: string;
  allumee?: string;
  teintes?: readonly string[];
  /** Les deux faces (une coque ouverte : la parabole du radar). */
  deux?: boolean;
}
export type Role = "haut" | "lumiere" | "tourne";
export interface Piece {
  geo: BufferGeometry;
  m: Matiere;
  /** Sans rôle, la pièce suit le module (une cible qui tombe l'emporte tout entière). */
  role?: Role;
  /** L'épaisseur du contour d'encre (une coque retournée), 0 ou absent : sans contour. */
  contour?: number;
  /** Une pièce qui ne projette pas d'ombre (translucide, très fine). */
  sansOmbre?: boolean;
  /** Ne se montre que sur une instance sur deux (0 : les paires, 1 : les impaires) : « des planètes à cratères ou à anneau ». */
  variante?: 0 | 1;
}
export interface Modele3D {
  pieces: Piece[];
  /** Bumper : la hauteur au-dessus de laquelle le haut s'enfonce. Spinner : le point et l'axe de la rotation. */
  pivot?: readonly [number, number, number];
  axe?: readonly [number, number, number];
}

/** Où poser une géométrie : translation, rotations (radians, dans l'ordre x, y, z), échelle. */
export interface Placement {
  x?: number;
  y?: number;
  z?: number;
  rx?: number;
  ry?: number;
  rz?: number;
  s?: number;
  sx?: number;
  sy?: number;
  sz?: number;
}
export type Point3 = readonly [number, number, number];
/** Les fabriques de géométrie, passées aux thèmes (`trois.ts` les donne). Toutes rendent une géométrie déjà placée ; `fusion` en fait une seule (un seul appel de dessin). */
export interface Outils {
  cylindre(rHaut: number, rBas: number, h: number, p?: Placement, seg?: number): BufferGeometry;
  sphere(r: number, p?: Placement, seg?: number): BufferGeometry;
  tore(R: number, r: number, p?: Placement, seg?: number, arc?: number): BufferGeometry;
  boite(l: number, h: number, pr: number, p?: Placement): BufferGeometry;
  /** Une calotte de sphère de rayon `r` et d'ouverture `angle` (radians), creux vers le haut, son fond à l'origine (la parabole du radar). */
  calotte(r: number, angle: number, p?: Placement, seg?: number): BufferGeometry;
  /** Un contour (x, y) extrudé sur `ep` selon z (centré), avec un léger biseau. */
  extruder(contour: readonly (readonly [number, number])[], ep: number, p?: Placement, biseau?: number): BufferGeometry;
  /** Une roche : une sphère bosselée (`seg` segments), toujours la même pour une même graine ; `relief` : la part du rayon que prennent les bosses. */
  roche(r: number, graine: number, p?: Placement, relief?: number, seg?: number): BufferGeometry;
  /** Un tube qui s'affine, le long de points. */
  tube(points: readonly Point3[], r0: number, r1: number, p?: Placement, seg?: number): BufferGeometry;
  /** Un anneau plat, tourné vers le haut (de r0 à r1). */
  anneau(r0: number, r1: number, p?: Placement, seg?: number): BufferGeometry;
  /** Replace une géométrie déjà faite (pour construire une roue à plat, puis la pencher). */
  placer(g: BufferGeometry, p: Placement): BufferGeometry;
  fusion(...g: BufferGeometry[]): BufferGeometry;
}

/** Les icônes à plat (rendu de secours), vues de dessus et centrées sur le module. Le contexte est déjà placé (et tourné pour une cible : le long du segment, +y vers les batteurs). */
export interface ModelesPlat {
  /** Le socle d'un bumper de rayon `r`, dans la couleur de sa lumière (`lum`, mêlée par `plat.ts`). */
  socle(c: CanvasRenderingContext2D, r: number, lum: string, k: number): void;
  /** Le haut d'un bumper (`plat.ts` le réduit quand il s'enfonce) ; `k` : son rang, pour les variantes. */
  haut(c: CanvasRenderingContext2D, r: number, k: number): void;
  /** Une cible debout, de longueur `l`. */
  cible(c: CanvasRenderingContext2D, l: number, k: number): void;
  /** Le spinner : ce qui ne bouge pas, puis ce qui tourne (`plat.ts` le fait tourner). */
  spinnerFixe(c: CanvasRenderingContext2D, l: number): void;
  spinnerTourne(c: CanvasRenderingContext2D, l: number): void;
  /** Le trou de rayon `r`, sa lumière dans la couleur `lum`. */
  trou(c: CanvasRenderingContext2D, r: number, lum: string, sec: number): void;
}
export interface ModelesDuTheme {
  trois: Record<TypeCommun, (o: Outils) => Modele3D> & { asteroide?: (o: Outils) => Modele3D };
  plat: ModelesPlat & { asteroide?: Pick<ModelesPlat, "socle" | "haut"> };
  /** Les couleurs de la lumière des bumpers et des trous, éteinte puis allumée (communes aux deux rendus). */
  lumieres: { bumper: readonly [string, string]; trou: readonly [string, string] };
}

/** Mêle deux couleurs `#rrggbb` (k de 0 à 1). */
export function meler(a: string, b: string, k: number): string {
  const x = parseInt(a.slice(1), 16);
  const y = parseInt(b.slice(1), 16);
  const m = (s: number): number => Math.round(((x >> s) & 255) * (1 - k) + ((y >> s) & 255) * k);
  return `#${((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1)}`;
}
/** Un tirage déterministe (pour les roches et les décors des icônes). */
export function alea(graine: number): () => number {
  let s = graine >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
/** Un cercle (une icône à plat) avec son trait d'encre. */
export function rond(c: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string | null, trait = 2, encre = ENCRE): void {
  c.beginPath();
  c.arc(x, y, r, 0, 6.283185307179586);
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (trait) {
    c.lineWidth = trait;
    c.strokeStyle = encre;
    c.stroke();
  }
}
/** Un polygone (une icône à plat). */
export function poly(c: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[], fill: string | null, trait = 2): void {
  c.beginPath();
  pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
  c.closePath();
  if (fill) {
    c.fillStyle = fill;
    c.fill();
  }
  if (trait) {
    c.lineWidth = trait;
    c.strokeStyle = ENCRE;
    c.stroke();
  }
}
