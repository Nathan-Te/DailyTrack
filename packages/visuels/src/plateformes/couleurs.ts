// Couleurs d'un décor de plateformes, **pures** : le mélange linéaire de deux couleurs 0xRRGGBB (utilisé par la profondeur des tuiles).
// Les mesures de contraste (luminance, teinte) servent aux tests du jeu qui lit ces palettes : elles restent dans le jeu.

/** Mélange linéaire de deux couleurs 0xRRGGBB (`t` = 0 : `a`, 1 : `b`). */
export function mix(a: number, b: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const ch = (s: number) => Math.round(((a >> s) & 255) * (1 - k) + ((b >> s) & 255) * k);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}
