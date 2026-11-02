// Les couleurs des tests de palettes et de décors (lots T3 et T9) : une clarté L* (CIE Lab, 0 à 100) d'une couleur `#RRGGBB`.
export const HEX = /^#[0-9A-Fa-f]{6}$/;
const lin = (c: number): number => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export function clarte(hex: string): number {
  const y = 0.2126 * lin(parseInt(hex.slice(1, 3), 16)) + 0.7152 * lin(parseInt(hex.slice(3, 5), 16)) + 0.0722 * lin(parseInt(hex.slice(5, 7), 16));
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y;
}
