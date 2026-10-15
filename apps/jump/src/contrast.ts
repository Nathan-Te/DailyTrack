// Contraste de luminance (lot 9), **pur** : luminance relative sRGB et rapport de contraste au sens des WCAG, `(L1 + 0,05) ÷ (L2 + 0,05)`.
// Sert aux tests de lisibilité des thèmes (dangers, personnage, friables) ; l'affichage n'en dépend pas.

const channel = (c: number): number => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** Luminance relative d'une couleur 0xRRGGBB (0 noir … 1 blanc). */
export function luminance(rgb: number): number {
  return 0.2126 * channel((rgb >> 16) & 255) + 0.7152 * channel((rgb >> 8) & 255) + 0.0722 * channel(rgb & 255);
}

/** Rapport de contraste entre deux couleurs (1 … 21), symétrique. */
export function contrastRatio(a: number, b: number): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Teinte (degrés, 0 … 360), saturation (0 … 1, au sens TSL) et chroma (max − min des canaux, 0 … 1 : la « couleur » réellement visible,
 * faible pour un gris ou un blanc cassé) d'une couleur 0xRRGGBB.
 */
export function hueOf(rgb: number): { hue: number; sat: number; chroma: number } {
  const r = ((rgb >> 16) & 255) / 255;
  const g = ((rgb >> 8) & 255) / 255;
  const b = (rgb & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  const sat = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let hue = 0;
  if (d > 0) {
    if (max === r) hue = 60 * (((g - b) / d + 6) % 6);
    else if (max === g) hue = 60 * ((b - r) / d + 2);
    else hue = 60 * ((r - g) / d + 4);
  }
  return { hue, sat, chroma: d };
}

/** Écart de teinte (degrés, 0 … 180). */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(hueOf(a).hue - hueOf(b).hue) % 360;
  return d > 180 ? 360 - d : d;
}

/** Mélange linéaire de deux couleurs 0xRRGGBB (`t` = 0 : `a`, 1 : `b`). */
export function mix(a: number, b: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
