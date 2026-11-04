import type { PaletteTheme, ThemeBloc } from "./palettes";

// Les cinq autres thèmes (le port est dans `palettes.ts`). **À la demande** : ce fichier ne pèse rien tant qu'un jeu ne l'a pas demandé (`import("@cdj/visuels/blocs/themes")`).
// Tout est en aplats ; le contraste de chaque pièce avec chaque fond d'un jeu est vérifié par le test de ce jeu (pour Tower : `apps/tower/test/palettes.test.ts`).
export const PALETTES: Record<Exclude<ThemeBloc, "port">, PaletteTheme> = {
  chantier: {
    pieces: { I: "#E8731A", O: "#F2B705", T: "#8A5CC8", L: "#D9558F", J: "#2F6FC4", S: "#3F9F4A", Z: "#D63F37" },
    ciel: "#F6E7C8",
    sol: "#4A4F55",
    vague: "#6C737A",
    plateforme: "#8A6B3E",
    plateformeReflet: "#B08A52",
    pilier: "#5A4630",
  },
  canyon: {
    pieces: { I: "#F28C38", O: "#FFD23F", T: "#9B6BD6", L: "#F07FB0", J: "#3F7FD9", S: "#5DBB63", Z: "#E5534B" },
    ciel: "#FFEBC8",
    sol: "#E3BC84",
    vague: "#C6844A",
    plateforme: "#C98A4E",
    plateformeReflet: "#E0A86C",
    pilier: "#8A5A36",
  },
  banquise: {
    pieces: { I: "#E8731A", O: "#F2B705", T: "#8A5CC8", L: "#D9558F", J: "#2F6FC4", S: "#3F9F4A", Z: "#D63F37" },
    ciel: "#E4F3FA",
    sol: "#0F3D57",
    vague: "#2A6A8A",
    plateforme: "#9DB9C6",
    plateformeReflet: "#C9DEE8",
    pilier: "#6F8D9B",
  },
  jungle: {
    pieces: { I: "#F28C38", O: "#FFD23F", T: "#9B6BD6", L: "#F07FB0", J: "#3F7FD9", S: "#5DBB63", Z: "#E5534B" },
    ciel: "#8FD1A0",
    sol: "#16402A",
    vague: "#2C7448",
    plateforme: "#7A5A38",
    plateformeReflet: "#9A7650",
    pilier: "#5A4028",
  },
  nuit: {
    pieces: { I: "#F28C38", O: "#FFD23F", T: "#B58CF0", L: "#F59AC4", J: "#5C9BF0", S: "#7AD07F", Z: "#F0706A" },
    ciel: "#1B2A4A",
    sol: "#101A30",
    vague: "#2B3F6B",
    plateforme: "#4A5A7A",
    plateformeReflet: "#6A7C9E",
    pilier: "#34425E",
  },
};
