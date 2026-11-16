// Lot PBV3 : la mesure des couleurs d'une image sur la zone de la table (outil hors CI, `e2e/captures-lot-pbv3.spec.ts -g couleurs`), pour comparer le jeu à ses images cibles avec des chiffres et pas seulement à l'œil.
// Quatre mesures, sur les pixels du quadrilatère de la table (les épaules de l'arc et le bas du terrain : le meuble, la pièce et le HUD n'y entrent pas) :
//  · luminance : la moyenne de la luma Rec. 709 des valeurs sRGB (0 noir, 100 blanc) ;
//  · saturation : la moyenne de la saturation HSV (0 gris, 100 couleur pure) ;
//  · teinte : la moyenne circulaire des teintes, pondérée par la saturation (en degrés : ~30 orangé, ~45 miel, ~185 turquoise) ;
//  · contraste : l'écart type de la luminance (des noirs denses et des hautes lumières l'augmentent).
// Pur (aucun DOM) : `couleurs.test.ts` le vérifie sur des images connues.

export type Point = readonly [number, number];
export interface Couleurs {
  luminance: number;
  saturation: number;
  teinte: number;
  contraste: number;
  pixels: number;
}

/** Le point est-il dans le quadrilatère convexe `q` (sommets dans l'ordre, sens quelconque) ? */
export function dansQuad(q: readonly Point[], x: number, y: number): boolean {
  let signe = 0;
  for (let i = 0; i < q.length; i++) {
    const [ax, ay] = q[i]!;
    const [bx, by] = q[(i + 1) % q.length]!;
    const c = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (c === 0) continue;
    const s = c > 0 ? 1 : -1;
    if (signe && s !== signe) return false;
    signe = s;
  }
  return true;
}

/** Mesure les pixels RGBA (`largeur` × `hauteur`) qui tombent dans `quad` (un pixel sur `pas` dans chaque sens). */
export function mesurerCouleurs(rgba: ArrayLike<number>, largeur: number, hauteur: number, quad: readonly Point[], pas = 2): Couleurs {
  let n = 0;
  let somme = 0;
  let somme2 = 0;
  let sat = 0;
  let hx = 0;
  let hy = 0;
  const x0 = Math.max(0, Math.floor(Math.min(...quad.map((p) => p[0]))));
  const x1 = Math.min(largeur - 1, Math.ceil(Math.max(...quad.map((p) => p[0]))));
  const y0 = Math.max(0, Math.floor(Math.min(...quad.map((p) => p[1]))));
  const y1 = Math.min(hauteur - 1, Math.ceil(Math.max(...quad.map((p) => p[1]))));
  for (let y = y0; y <= y1; y += pas) {
    for (let x = x0; x <= x1; x += pas) {
      if (!dansQuad(quad, x + 0.5, y + 0.5)) continue;
      const i = (y * largeur + x) * 4;
      const r = rgba[i]! / 255;
      const g = rgba[i + 1]! / 255;
      const b = rgba[i + 2]! / 255;
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const s = max > 0 ? (max - min) / max : 0;
      if (max > min) {
        let h = max === r ? (g - b) / (max - min) : max === g ? 2 + (b - r) / (max - min) : 4 + (r - g) / (max - min);
        h = (h * Math.PI) / 3;
        hx += Math.cos(h) * s;
        hy += Math.sin(h) * s;
      }
      n++;
      somme += l;
      somme2 += l * l;
      sat += s;
    }
  }
  const moy = somme / Math.max(1, n);
  const teinte = ((Math.atan2(hy, hx) * 180) / Math.PI + 360) % 360;
  return { luminance: moy * 100, saturation: (sat / Math.max(1, n)) * 100, teinte, contraste: Math.sqrt(Math.max(0, somme2 / Math.max(1, n) - moy * moy)) * 100, pixels: n };
}

/** La zone de la table sur les images cibles (`docs/pinball/maquettes/cibles/`), relevée à la main sur une grille : les épaules de l'arc (y = 205 de la table) et le bas du terrain (y = 740), rails compris. */
export const ZONE_CIBLE: Readonly<Record<"foire" | "ocean", readonly Point[]>> = {
  foire: [[185, 300], [860, 300], [945, 1360], [85, 1360]],
  ocean: [[165, 330], [860, 330], [945, 1385], [85, 1385]],
};

/** Une ligne du tableau du README : `luminance · saturation · teinte · contraste`. */
export const ligne = (c: Couleurs): string => `${c.luminance.toFixed(1)} | ${c.saturation.toFixed(1)} | ${c.teinte.toFixed(0)}° | ${c.contraste.toFixed(1)}`;
