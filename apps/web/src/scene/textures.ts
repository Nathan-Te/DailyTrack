// Lot 38 — textures de la direction C, **dessinées dans un canvas au chargement** (aucun fichier) : un grain de matière (bitume, béton, roche)
// commun aux maillages éclairés, et un sol par thème (pelouse tondue, sable ridé, neige, champ, alpage, dalles, nuit). Petites (128 et 256 px),
// répétées ; le coût est un peu de mémoire de la carte graphique et quelques millisecondes à la construction (mesurées par la vitrine).
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
