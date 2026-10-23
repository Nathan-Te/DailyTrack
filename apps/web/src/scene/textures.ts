// Lot 38 — textures de la direction C : le ciel à quatre arrêts, **dessiné dans un canvas au chargement** (aucun fichier). Lot 44 : le grain de matière et
// le sol de chaque thème sont partis avec le décor (`decor/matiereC.ts`, à la demande) ; le ciel reste ici (premier chargement : `composerP1.ts`).
import { CanvasTexture, SRGBColorSpace } from "three";

/** Le ciel de C : quatre arrêts (zénith, haut, horizon, sous l'horizon) au lieu de deux : une lueur à l'horizon. */
export function texturedCielC(stops: readonly [number, number, number]): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, hex(stops[0]));
  g.addColorStop(0.42, hex(stops[1]));
  g.addColorStop(0.62, hex(stops[2]));
  g.addColorStop(1, hex(stops[2]));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 2, 256);
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  return t;
}
