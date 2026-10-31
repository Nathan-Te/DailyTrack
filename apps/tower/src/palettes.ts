import type { ThemeTower } from "@cdj/tower-sim";
import type { PaletteTheme } from "./palette";

// Lot T3 — les cinq autres thèmes de Tower (le port est dans `palette.ts`). **Chargé à la demande** (`chargerPalette`) : il ne pèse pas sur le premier chargement. Tout est en aplats ;
// le décor de fond est semé à la main (jamais de hasard), un motif par thème. `test/palettes.test.ts` vérifie le contraste de chaque pièce avec chaque fond de chaque thème.
type Formes = PaletteTheme["formes"];
const semer = (n: number, f: (i: number) => [number, number, number, number][]): Formes => Array.from({ length: n }, (_, i) => f(i)).flat();

/** Chantier : des grues (un mât et une flèche) sur un ciel de sable. */
const GRUES = semer(24, (i) => {
  const x = ((i * 13) % 41) - 20;
  const y = 3 + i * 17;
  return [[x, y, 0.6, 11], [x + 2.4 * (i % 2 ? 1 : -1), y + 11.2, 6, 0.6]];
});

/** Canyon : des strates de roche, larges bandes basses. */
const STRATES = semer(30, (i) => [[((i * 11) % 23) - 11, 3 + i * 13, 26 + (i % 3) * 8, 1.4 + (i % 2) * 0.8]]);

/** Banquise : des blocs de glace qui flottent. */
const GLACONS = semer(40, (i) => {
  const x = ((i * 29) % 53) - 26;
  const y = 2 + i * 9.5;
  return [[x, y, 2.2, 1.6], [x + 0.6, y + 1.6, 1.1, 0.9]];
});

/** Jungle : des lianes et des feuilles. */
const LIANES = semer(30, (i) => {
  const x = ((i * 17) % 43) - 21;
  const y = 2 + i * 12;
  return [[x, y + 4, 0.35, 9], [x + 0.9, y + 8.6, 2.6, 0.8]];
});

/** Nuit : des étoiles, et une lune de loin en loin. */
const ETOILES = semer(46, (i) => {
  const x = ((i * 31) % 47) - 23;
  const y = 3 + i * 8.5;
  const f: [number, number, number, number][] = [[x, y, 0.3, 0.3], [x + 7, y + 3.3, 0.22, 0.22], [x - 9, y + 5.2, 0.26, 0.26]];
  if (i % 9 === 4) f.push([x + 3, y + 1, 2.4, 2.4]);
  return f;
});

export const PALETTES: Record<Exclude<ThemeTower, "port">, PaletteTheme> = {
  chantier: {
    pieces: { I: "#E8731A", O: "#F2B705", T: "#8A5CC8", L: "#D9558F", J: "#2F6FC4", S: "#3F9F4A", Z: "#D63F37" },
    ciel: "#F6E7C8",
    sol: "#4A4F55",
    vague: "#6C737A",
    decor: "#6B5A3E",
    formes: GRUES,
    plateforme: "#8A6B3E",
    plateformeReflet: "#B08A52",
    pilier: "#5A4630",
  },
  canyon: {
    pieces: { I: "#F28C38", O: "#FFD23F", T: "#9B6BD6", L: "#F07FB0", J: "#3F7FD9", S: "#5DBB63", Z: "#E5534B" },
    ciel: "#7A3E2E",
    sol: "#4A2A22",
    vague: "#6A3A2E",
    decor: "#5E3024",
    formes: STRATES,
    plateforme: "#C98A4E",
    plateformeReflet: "#E0A86C",
    pilier: "#8A5A36",
  },
  banquise: {
    pieces: { I: "#E8731A", O: "#F2B705", T: "#8A5CC8", L: "#D9558F", J: "#2F6FC4", S: "#3F9F4A", Z: "#D63F37" },
    ciel: "#E4F3FA",
    sol: "#0F3D57",
    vague: "#2A6A8A",
    decor: "#C3E1EE",
    formes: GLACONS,
    plateforme: "#9DB9C6",
    plateformeReflet: "#C9DEE8",
    pilier: "#6F8D9B",
  },
  jungle: {
    pieces: { I: "#F28C38", O: "#FFD23F", T: "#9B6BD6", L: "#F07FB0", J: "#3F7FD9", S: "#5DBB63", Z: "#E5534B" },
    ciel: "#1F5A3A",
    sol: "#16402A",
    vague: "#2C7448",
    decor: "#2C7448",
    formes: LIANES,
    plateforme: "#7A5A38",
    plateformeReflet: "#9A7650",
    pilier: "#5A4028",
  },
  nuit: {
    pieces: { I: "#F28C38", O: "#FFD23F", T: "#B58CF0", L: "#F59AC4", J: "#5C9BF0", S: "#7AD07F", Z: "#F0706A" },
    ciel: "#1B2A4A",
    sol: "#101A30",
    vague: "#2B3F6B",
    decor: "#2B3F6B",
    formes: ETOILES,
    plateforme: "#4A5A7A",
    plateformeReflet: "#6A7C9E",
    pilier: "#34425E",
  },
};
