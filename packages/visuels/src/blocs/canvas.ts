import { COTES_DISQUE, type PoseOeil } from "./yeux";
import { ENCRE, PAPIER } from "./couleurs";
import type { CoucheRelief } from "./relief";

// Le dessinateur CANVAS 2D des blocs : pour un jeu en grille (Blocks) ou tout jeu qui dessine dans un `<canvas>`. Il lit **la même description** que celui de Three.js (`decrirePiece`, `disposerYeux`) : mêmes rectangles,
// mêmes couleurs, mêmes yeux, même ordre d'empilement. Deux détails pour que le rendu soit celui de Tower à l'œil :
//   - un disque est le polygone de 20 côtés de Three.js (`COTES_DISQUE`), pas un cercle lissé ;
//   - **les rectangles d'une couche sont un seul chemin rempli une fois** : deux rectangles qui se touchent, remplis un à un, laisseraient un filet clair à leur arête (deux couvertures partielles qui s'ajoutent mal) ;
//     un chemin rempli une fois (règle « non nul ») les réunit sans joint.
// Le repère de la description est celui de la pièce : mètres, y vers le haut. `placer` y met le contexte ; rien n'est gardé d'un appel à l'autre (chaque fonction restaure le contexte).

/** Où et comment poser une pièce : son centre en pixels (`x`, `y`, y vers le bas), son angle (rad, sens trigonométrique), les pixels par mètre (par case). */
export interface Placement {
  x: number;
  y: number;
  angle?: number;
  pxParMetre: number;
}

/** Met le contexte dans le repère de la pièce (mètres, y vers le haut). À appeler entre `save()` et `restore()`. */
export function placer(ctx: CanvasRenderingContext2D, p: Placement): void {
  ctx.translate(p.x, p.y);
  ctx.scale(p.pxParMetre, -p.pxParMetre);
  if (p.angle) ctx.rotate(p.angle);
}

/** Les couches d'une pièce (`decrirePiece`), dans le repère courant : un chemin rempli par couche. */
export function dessinerCouches(ctx: CanvasRenderingContext2D, couches: readonly CoucheRelief[]): void {
  for (const c of couches) {
    ctx.fillStyle = c.couleur;
    ctx.beginPath();
    for (const r of c.rects) ctx.rect(r.cx - r.w / 2, r.cy - r.h / 2, r.w, r.h);
    ctx.fill();
  }
}

function disque(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, couleur: string): void {
  ctx.fillStyle = couleur;
  ctx.beginPath();
  for (let i = 0; i < COTES_DISQUE; i++) {
    const a = (i / COTES_DISQUE) * 2 * Math.PI;
    const px = x + r * Math.cos(a);
    const py = y + r * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Les yeux (`disposerYeux`), dans le repère courant, **couche par couche** comme Three.js les empile (`PROFONDEUR_OEIL`) : les contours d'encre des deux yeux, puis leurs blancs, puis leurs pupilles, puis les sourcils visibles.
 * Un œil écarquillé (la chute) recouvre l'autre ; dessiner un œil entier après l'autre cacherait une pupille que Three.js montre.
 */
export function dessinerYeux(ctx: CanvasRenderingContext2D, poses: readonly PoseOeil[]): void {
  for (const couche of ["encre", "blanc", "pupille"] as const) {
    for (const p of poses) {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.scale(p.sx, p.sy);
      if (couche === "encre") disque(ctx, 0, 0, p.rEncre, ENCRE);
      else if (couche === "blanc") disque(ctx, 0, 0, p.rBlanc, PAPIER);
      else disque(ctx, p.pupille.x, p.pupille.y, p.pupille.r, ENCRE);
      ctx.restore();
    }
  }
  for (const p of poses) {
    const s = p.sourcil;
    if (!s.visible) continue;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rot);
    ctx.fillStyle = ENCRE;
    ctx.fillRect(-s.w / 2, -s.h / 2, s.w, s.h);
    ctx.restore();
  }
}

/** Une pièce complète : ses couches, puis ses yeux s'il y en a, au `placement` donné. Le contexte est restauré. */
export function dessinerPiece(ctx: CanvasRenderingContext2D, placement: Placement, couches: readonly CoucheRelief[], yeux?: readonly PoseOeil[]): void {
  ctx.save();
  placer(ctx, placement);
  dessinerCouches(ctx, couches);
  if (yeux) dessinerYeux(ctx, yeux);
  ctx.restore();
}
