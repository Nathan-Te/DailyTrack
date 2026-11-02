import { C, type DecorTheme, type Forme, L, R } from "./decorLogique";

// Lot T9 — le décor de la NUIT : la lune, les étoiles, des immeubles aux fenêtres allumées, une enseigne au néon et leurs reflets dans l'eau (planche `tower-planche-decors.html`). Aplats seulement ; les fenêtres scintillent.
const PAP = "#FFF6E0";
const NEON = "#F07FB0";
const fenetres = (c: string, pts: readonly (readonly [number, number])[]): Forme[] => pts.map(([x, y]) => R(c, x, y, 6, 7));

export const DECOR: DecorTheme = {
  plans: [
    {
      // Le lointain : le ciel plus clair près de l'eau, la lune et ses cratères, les étoiles.
      centre: [C("#F3E9C6", 320, 62, 22), C("#E0D3A8", 312, 56, 4), C("#E0D3A8", 326, 70, 3)],
      repete: [
        R("#22355C", 0, 170, 400, 80),
        R(PAP, 40, 40, 3, 3), R(PAP, 90, 80, 2, 2), R(PAP, 150, 30, 3, 3), R(PAP, 220, 90, 2, 2), R(PAP, 260, 40, 3, 3), R(PAP, 370, 120, 2, 2), R(PAP, 20, 130, 2, 2), L(PAP, 200, 50, 200, 58, 2), L(PAP, 196, 54, 204, 54, 2),
      ],
    },
    {
      // Le moyen : les immeubles sombres et leurs fenêtres allumées.
      centre: [],
      repete: [
        R("#2B3F6B", 0, 180, 40, 70), R("#2B3F6B", 44, 160, 36, 90), R("#2B3F6B", 84, 196, 40, 54), R("#2B3F6B", 280, 170, 40, 80), R("#2B3F6B", 324, 150, 34, 100), R("#2B3F6B", 362, 190, 38, 60),
        ...fenetres("#F2B544", [[52, 170], [66, 184], [52, 198], [8, 190], [290, 182], [304, 196], [332, 164], [344, 190], [370, 202]]),
      ],
    },
    {
      // Le proche : l'enseigne au néon (un cadre rose sur l'immeuble).
      centre: [],
      repete: [L(NEON, 90, 206, 118, 206, 2.5), L(NEON, 118, 206, 118, 218, 2.5), L(NEON, 118, 218, 90, 218, 2.5), L(NEON, 90, 218, 90, 206, 2.5)],
    },
    {
      // Le sol : les reflets des lumières dans l'eau.
      centre: [],
      repete: [R("#101A30", 0, 250, 400, 50), L("#F2B544", 55, 260, 55, 266, 3), L("#F2B544", 55, 274, 55, 278, 3), L("#F2B544", 69, 264, 69, 270, 3), L(NEON, 104, 262, 104, 267, 3), L(NEON, 104, 274, 104, 278, 3), L("#F2B544", 300, 262, 300, 268, 3), L("#F2B544", 341, 260, 341, 266, 3), L("#F3E9C6", 320, 270, 336, 270, 3)],
    },
  ],
  anims: [
    { mode: "scintille", plan: 1, formes: fenetres("#F2B544", [[52, 170], [8, 190], [332, 164]]), a: 0, T: 4.3 },
    { mode: "scintille", plan: 1, formes: fenetres("#1E2E52", [[66, 184], [290, 182], [370, 202]]), a: 0, T: 5.9, ph: 0.35 },
    { mode: "scintille", plan: 0, formes: [R(PAP, 90, 80, 2, 2), R(PAP, 260, 40, 3, 3)], a: 0, T: 3.1, ph: 0.6 },
    { mode: "derive", plan: 3, formes: [L("#2B3F6B", 40, 258, 70, 258, 3), L("#2B3F6B", 200, 270, 236, 270, 3), L("#2B3F6B", 320, 262, 350, 262, 3)], a: 10, T: 8 },
  ],
  bandes: [{ de: 45, c: "#162240" }, { de: 90, c: "#101A36" }, { de: 130, c: "#0B1230" }],
  zones: [{ de: 0, a: 15, genres: ["nuageHaut"] }, { de: 15, a: 45, genres: ["nuage", "chauve"] }, { de: 45, a: 100, genres: ["etoiles", "avion"] }, { de: 100, a: 161, genres: ["etoiles", "aurore"] }],
  ciel: { nuage: "#2B3F6B", nuageHaut: "#26385F", oiseau: "#0B1230", etoile: "#FFF6E0", avion: "#F2B544", ballon: ["#F07FB0", "#F2B544", "#5C9BF0"], aurore: ["#1F6F63", "#3A4FA0"] },
};
