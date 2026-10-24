// Lot 44 — **la matière de C** (lot 38), venue avec le décor du palier 1 (chargée à la demande avec `decor/commun.ts`) : le grain de matière, une texture presque
// blanche multipliée par les couleurs des sommets du décor et du sol relevé (coordonnées « monde » : `uvMonde`), et le sol lointain de chaque thème (pelouse
// tondue, sable ridé, neige, champ, alpage, dalles, nuit) qui remplace le damier quand le décor arrive. Dessinées dans un canvas (aucun fichier), une fois.
// La route et les éléments de course gardent leurs aplats (la piste d'abord) : la matière est celle du décor.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import type { PaletteName } from "@cdj/sim";

/** Petit générateur à graine (les textures sont les mêmes pour tout le monde). */
function graine(n: number): () => number {
  let a = n >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function texture(canvas: HTMLCanvasElement, couleur = true): CanvasTexture {
  const t = new CanvasTexture(canvas);
  t.wrapS = t.wrapT = RepeatWrapping;
  if (couleur) t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

let grainMemo: CanvasTexture | null = null;
/**
 * Le grain : une texture presque blanche (215–255) multipliée par les couleurs des sommets. Bruit fin et quelques taches plus larges : le bitume
 * et le béton cessent d'être des aplats parfaits sans changer de couleur.
 */
export function grain(): CanvasTexture {
  if (grainMemo) return grainMemo;
  const n = 128;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(n, n);
  const rnd = graine(38);
  for (let i = 0; i < n * n; i++) {
    const v = 232 + Math.floor(rnd() * 23);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  ctx.globalAlpha = 0.045;
  for (let k = 0; k < 14; k++) {
    ctx.fillStyle = rnd() < 0.5 ? "#000" : "#fff";
    ctx.beginPath();
    ctx.arc(rnd() * n, rnd() * n, 3 + rnd() * 8, 0, Math.PI * 2);
    ctx.fill();
  }
  grainMemo = texture(canvas, false);
  return grainMemo;
}

export type SolC = "pelouse" | "sable" | "neige" | "nuit" | "champ" | "roche" | "alpage" | "dalles";

export const SOLS_C: Record<PaletteName, SolC> = { stade: "pelouse", desert: "sable", neige: "neige", nuit: "nuit", campagne: "champ", canyon: "roche", alpin: "alpage", ville: "dalles", neon: "nuit" };

/** Le sol lointain d'un thème : une tuile de 256 px (16 m), qui remplace le damier. */
export function texturedSol(sorte: SolC, a: string, b: string): CanvasTexture {
  const n = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext("2d")!;
  const rnd = graine(sorte.length * 977);
  const points = (couleur: string, nombre: number, taille: number) => {
    ctx.fillStyle = couleur;
    for (let k = 0; k < nombre; k++) ctx.fillRect(rnd() * n, rnd() * n, taille, taille);
  };
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, n, n);
  if (sorte === "pelouse") {
    // Pelouse tondue : deux bandes de tonte, des brins.
    ctx.fillStyle = b;
    ctx.fillRect(0, 0, n, n / 2);
    points("rgba(0,0,0,0.10)", 900, 2);
    points("rgba(255,255,255,0.08)", 600, 2);
  } else if (sorte === "sable" || sorte === "roche") {
    // Sable ridé par le vent (ou dalle de roche fissurée) : des rides claires et sombres.
    ctx.strokeStyle = sorte === "sable" ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.18)";
    ctx.lineWidth = sorte === "sable" ? 3 : 2;
    for (let y = 8; y < n; y += 18) {
      ctx.beginPath();
      for (let x = 0; x <= n; x += 8) ctx.lineTo(x, y + Math.sin((x / n) * Math.PI * 4 + y) * 4);
      ctx.stroke();
    }
    points(b, 500, 3);
  } else if (sorte === "neige") {
    points("rgba(120,160,210,0.14)", 1200, 2);
    points("rgba(255,255,255,0.9)", 300, 3);
  } else if (sorte === "nuit") {
    points("rgba(255,255,255,0.03)", 900, 2);
    ctx.strokeStyle = "rgba(120,140,255,0.06)";
    ctx.strokeRect(0.5, 0.5, n - 1, n - 1);
  } else if (sorte === "champ") {
    // Champ labouré : des sillons, des épis.
    for (let x = 0; x < n; x += 16) {
      ctx.fillStyle = b;
      ctx.fillRect(x, 0, 7, n);
    }
    points("rgba(240,200,90,0.25)", 500, 2);
  } else if (sorte === "alpage") {
    ctx.fillStyle = b;
    for (let k = 0; k < 40; k++) ctx.fillRect(rnd() * n, rnd() * n, 18 + rnd() * 30, 10 + rnd() * 20);
    points("#ffffff", 120, 2);
    points("#f2d34a", 80, 2);
  } else {
    // Dalles de béton : un quadrillage de joints.
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 2;
    for (let k = 0; k <= n; k += 64) {
      ctx.beginPath();
      ctx.moveTo(k, 0);
      ctx.lineTo(k, n);
      ctx.moveTo(0, k);
      ctx.lineTo(n, k);
      ctx.stroke();
    }
    points("rgba(0,0,0,0.06)", 700, 3);
  }
  return texture(canvas);
}

// Lot 45 : `uvMonde` est dans `../uvMonde.ts` (la matière du palier 2 en a besoin pour la route, sans tirer le décor) ; réexportée ici.
export { uvMonde } from "../uvMonde";

