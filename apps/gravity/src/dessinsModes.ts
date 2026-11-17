// Les dessins des MODES DE VOL (lot GR6), **purs** : des tampons de géométrie (`Art`, sans moteur de rendu) — les arches de portail (papier et encre : une couleur et une icône par mode), l'avion en papier plié, le ressort. **Rien
// ici ne lit la simulation.** **Jamais de rouge** (réservé aux dangers : `test/rendu.test.ts`) ni le jaune du héros : avion turquoise, onde violet, ressort vert (les couleurs des blocs et du vent de `@cdj/visuels`), retour à la gravité
// papier et encre, vitesse bleu-violet ; la couleur ne porte jamais seule l'information (chaque portail a son icône).
import { BLOCK_STYLE, WIND_STYLE, mix } from "@cdj/visuels/plateformes";
import { Art } from "@cdj/visuels/plateformes/three";
import type { TypePortail } from "@cdj/gravity-sim";
import { CHEVRONS_DU_PORTAIL, estPortailDeVitesse } from "./modesLogique";

/** La demi-largeur d'une arche de portail (cases) et l'épaisseur de son cadre. */
export const ARCHE = { demiLargeur: 0.34, cadre: 0.17, bande: 0.08, rayonIcone: 0.38 } as const;
const Z = { voile: 0.0, cadre: 0.0, bande: 0.001, icone: 0.0, glyphe: 0.002 } as const;

/** La couleur d'un portail : celle de son mode (avion, onde, ressort), le papier pour le retour à la gravité, le bleu-violet des portails de vitesse. */
export function couleurDuPortail(type: TypePortail, papier: number): number {
  switch (type) {
    case "avion":
      return BLOCK_STYLE.altA.fill;
    case "onde":
      return BLOCK_STYLE.altB.fill;
    case "ressort":
      return WIND_STYLE.leaf;
    case "gravite":
      return papier;
    default:
      return BLOCK_STYLE.blink.fill;
  }
}

/** Un trait épais (un quadrilatère) d'un point à un autre. */
function trait(a: Art, x0: number, y0: number, x1: number, y1: number, w: number, z: number, couleur: number): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l = Math.hypot(dx, dy) || 1;
  const nx = ((-dy / l) * w) / 2;
  const ny = ((dx / l) * w) / 2;
  a.quad([x0 + nx, y0 + ny, x1 + nx, y1 + ny, x1 - nx, y1 - ny, x0 - nx, y0 - ny], z, couleur);
}
/** Une ligne brisée épaisse, ses coudes arrondis par un disque. */
function polyligne(a: Art, pts: readonly number[], w: number, z: number, couleur: number): void {
  for (let i = 0; i + 3 < pts.length; i += 2) trait(a, pts[i]!, pts[i + 1]!, pts[i + 2]!, pts[i + 3]!, w, z, couleur);
  for (let i = 0; i + 1 < pts.length; i += 2) a.disc(pts[i]!, pts[i + 1]!, w / 2, z, couleur, 8);
}
/** Un anneau elliptique (de `rx`, `ry` à `rx − e0`, `ry − e0` pour le bord extérieur, jusqu'à `e1` pour le bord intérieur). */
function bandeEllipse(a: Art, rx: number, ry: number, e0: number, e1: number, z: number, couleur: number, seg = 32): void {
  const pt = (k: number, e: number): [number, number] => {
    const t = (k / seg) * Math.PI * 2;
    return [(rx - e) * Math.cos(t), (ry - e) * Math.sin(t)];
  };
  for (let k = 0; k < seg; k++) {
    const [ox0, oy0] = pt(k, e0);
    const [ox1, oy1] = pt(k + 1, e0);
    const [ix1, iy1] = pt(k + 1, e1);
    const [ix0, iy0] = pt(k, e1);
    a.quad([ox0, oy0, ox1, oy1, ix1, iy1, ix0, iy0], z, couleur);
  }
}

/** Le cadre d'une arche : l'encre du contour, une bande de la couleur du portail dedans. Centré en (0, 0), `demiHauteur` : la moitié de la hauteur libre (cases). */
export function dessinCadrePortail(type: TypePortail, demiHauteur: number, encre: number, papier: number): Art {
  const a = new Art();
  const rx = ARCHE.demiLargeur;
  bandeEllipse(a, rx, demiHauteur, 0, ARCHE.cadre, Z.cadre, encre);
  const e0 = (ARCHE.cadre - ARCHE.bande) / 2;
  bandeEllipse(a, rx, demiHauteur, e0, e0 + ARCHE.bande, Z.bande, couleurDuPortail(type, papier));
  return a;
}
/** Le voile de l'arche (rendu transparent par son matériau) : l'intérieur de l'ellipse, de la couleur du portail. */
export function dessinVoilePortail(type: TypePortail, demiHauteur: number, papier: number): Art {
  const a = new Art();
  const seg = 28;
  const pts: number[] = [];
  for (let k = 0; k < seg; k++) pts.push((ARCHE.demiLargeur - ARCHE.cadre * 0.6) * Math.cos((k / seg) * Math.PI * 2), (demiHauteur - ARCHE.cadre * 0.6) * Math.sin((k / seg) * Math.PI * 2));
  const c = couleurDuPortail(type, papier);
  a.fan(0, 0, pts, Z.voile, c, c);
  return a;
}

/** Les chevrons (›) d'un portail de vitesse, ou deux tirets pour le portail lent : en encre, centrés en (0, 0), dans un disque de 0,3. */
function glypheDeVitesse(a: Art, type: TypePortail, encre: number, z: number): void {
  const n = CHEVRONS_DU_PORTAIL[type as keyof typeof CHEVRONS_DU_PORTAIL] ?? 0;
  if (n === 0) {
    trait(a, -0.16, 0.075, 0.16, 0.075, 0.1, z, encre);
    trait(a, -0.16, -0.075, 0.16, -0.075, 0.1, z, encre);
    return;
  }
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * 0.15;
    polyligne(a, [x - 0.06, 0.15, x + 0.06, 0, x - 0.06, -0.15], 0.075, z, encre);
  }
}

/** L'icône d'un portail : un disque de la couleur du portail, cerné d'encre, et son signe (avion en papier, zigzag de l'onde, ressort, flèche double de la gravité, chevrons ou tirets de la vitesse). */
export function dessinIconePortail(type: TypePortail, encre: number, papier: number): Art {
  const a = new Art();
  a.disc(0, 0, ARCHE.rayonIcone, Z.icone, encre, 20);
  a.disc(0, 0, ARCHE.rayonIcone - 0.06, Z.icone + 0.001, couleurDuPortail(type, papier), 20);
  const z = Z.glyphe + 0.001;
  switch (type) {
    case "avion":
      a.fan(0, 0, [0.25, 0, -0.22, 0.15, -0.08, -0.01], z, encre, encre);
      a.fan(0, 0, [0.25, 0, -0.08, -0.01, -0.15, -0.14], z, encre, mix(encre, papier, 0.35));
      break;
    case "onde":
      polyligne(a, [-0.23, -0.1, -0.115, 0.1, 0, -0.1, 0.115, 0.1, 0.23, -0.1], 0.07, z, encre);
      break;
    case "ressort":
      polyligne(a, [-0.1, -0.2, 0.1, -0.12, -0.1, -0.04, 0.1, 0.04, -0.1, 0.12, 0.1, 0.2], 0.065, z, encre);
      trait(a, -0.14, -0.23, 0.14, -0.23, 0.06, z, encre);
      break;
    case "gravite":
      trait(a, 0, -0.14, 0, 0.14, 0.07, z, encre);
      a.fan(0, 0.17, [0, 0.27, -0.13, 0.1, 0.13, 0.1], z, encre, encre);
      a.fan(0, -0.17, [0, -0.27, -0.13, -0.1, 0.13, -0.1], z, encre, encre);
      break;
    default:
      if (estPortailDeVitesse(type)) glypheDeVitesse(a, type, encre, z);
  }
  return a;
}

/** Épaissit un polygone de `e` autour de son centre (le contour d'encre d'une pièce de papier). */
function epaissir(pts: readonly number[], e: number): number[] {
  let cx = 0;
  let cy = 0;
  const n = pts.length / 2;
  for (let i = 0; i < n; i++) {
    cx += pts[i * 2]!;
    cy += pts[i * 2 + 1]!;
  }
  cx /= n;
  cy /= n;
  const sortie: number[] = [];
  for (let i = 0; i < n; i++) {
    const dx = pts[i * 2]! - cx;
    const dy = pts[i * 2 + 1]! - cy;
    const l = Math.hypot(dx, dy) || 1;
    sortie.push(pts[i * 2]! + (dx / l) * e, pts[i * 2 + 1]! + (dy / l) * e);
  }
  return sortie;
}

/**
 * L'avion en papier plié, vu de côté, dans le repère du héros (origine au centre de la boîte de 0,8, y vers le haut, il vole vers la droite) : **l'arrière** (le dos de la feuille, le empennage) est derrière le cube (z < 0), **l'avant**
 * (l'aile pliée, plus sombre) devant son bas (z > 0) : le cube est assis dedans. Papier et encre, jamais de rouge. Rendu en deux tampons.
 */
export function dessinAvion(encre: number, papier: number): { arriere: Art; avant: Art } {
  const dos = [0.8, -0.18, -0.72, 0.0, -0.72, -0.3, 0.05, -0.4];
  const aile = [0.8, -0.18, -0.72, -0.15, -0.72, -0.3, 0.05, -0.4];
  const ailette = [-0.72, 0.0, -0.46, -0.02, -0.74, 0.24];
  const ombre = mix(papier, encre, 0.22);
  const arriere = new Art();
  arriere.fan(0, 0, epaissir(ailette, 0.04), -0.03, encre, encre);
  arriere.fan(0, 0, epaissir(dos, 0.045), -0.02, encre, encre);
  arriere.fan(0, 0, ailette, -0.019, papier, papier);
  arriere.fan(0, 0, dos, -0.018, papier, papier);
  const avant = new Art();
  avant.fan(0, 0, epaissir(aile, 0.045), 0.08, encre, encre);
  avant.fan(0, 0, aile, 0.081, ombre, ombre);
  // le pli : une arête d'encre du nez à la queue
  trait(avant, 0.8, -0.18, -0.72, -0.15, 0.035, 0.082, encre);
  return { arriere, avant };
}

/** Le ressort : une ligne brisée d'encre (fil papier au milieu) de 0 à 1 de haut, de −0,24 à 0,24 de large ; la hauteur se règle à la pose (`scale.y`). La plaque d'appui est un autre tampon (elle ne s'écrase pas). */
export function dessinRessort(encre: number, papier: number): { fil: Art; plaque: Art } {
  const fil = new Art();
  const pts: number[] = [];
  const tours = 6;
  for (let i = 0; i <= tours; i++) pts.push(i % 2 === 0 ? -0.24 : 0.24, i / tours);
  polyligne(fil, pts, 0.11, 0.02, encre);
  polyligne(fil, pts, 0.04, 0.03, papier);
  const plaque = new Art();
  plaque.rect(-0.32, -0.05, 0.32, 0.05, 0.02, encre);
  return { fil, plaque };
}

/** Un trait de la traînée de l'onde, de `(x0, y0)` à `(x1, y1)`, de l'encre, prolongé de la demi-épaisseur de chaque côté (les coudes se recouvrent). Écrit dans des tableaux à remplir ; rend le nombre de sommets écrits. */
export function segmentDeTrainee(pos: Float32Array, o: number, x0: number, y0: number, x1: number, y1: number, w: number): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l = Math.hypot(dx, dy) || 1;
  const ux = (dx / l) * (w / 2);
  const uy = (dy / l) * (w / 2);
  const nx = (-dy / l) * (w / 2);
  const ny = (dx / l) * (w / 2);
  const ax = x0 - ux;
  const ay = y0 - uy;
  const bx = x1 + ux;
  const by = y1 + uy;
  pos.set([ax + nx, ay + ny, 0, bx + nx, by + ny, 0, bx - nx, by - ny, 0, ax - nx, ay - ny, 0], o);
}
