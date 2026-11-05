import { C, type DecorTheme, type Forme, L, P, R } from "./logique";

// Lot B5 — le décor de la NUIT : la lune et ses cratères, des étoiles qui scintillent, une silhouette de ville aux fenêtres allumées (elles s'éteignent et se rallument), une enseigne au néon, un pont au loin, et leurs reflets dans l'eau.
// Aplats seulement ; plus sombre et plus calme que les autres : tout est tiré vers le ciel.
const PAP = "#FFF6E0";
const NEON = "#F07FB0";
const fenetres = (c: string, pts: readonly (readonly [number, number])[]): Forme[] => pts.map(([x, y]) => R(c, x, y, 6, 7));
const etoile = (x: number, y: number): Forme[] => [R(PAP, x, y, 3, 3), L(PAP, x + 1.5, y - 3, x + 1.5, y + 6, 1), L(PAP, x - 3, y + 1.5, x + 6, y + 1.5, 1)];

export const DECOR: DecorTheme = {
  calme: 0.1,
  bandes: [{ de: -9999, c: "#1B2A4A" }, { de: 70, c: "#22355C" }, { de: 130, c: "#2A4070" }, { de: 190, c: "#33507F" }],
  plans: [
    {
      // Le lointain : la lune et ses cratères, des étoiles fixes, la ligne claire de l'horizon, un pont.
      centre: [C("#4A5C84", 320, 62, 34), C("#F3E9C6", 320, 62, 22), C("#E0D3A8", 312, 56, 4), C("#E0D3A8", 326, 70, 3), C("#E0D3A8", 316, 72, 2)],
      repete: [
        R(PAP, 40, 40, 3, 3), R(PAP, 90, 80, 2, 2), R(PAP, 150, 30, 3, 3), R(PAP, 220, 90, 2, 2), R(PAP, 260, 40, 3, 3), R(PAP, 370, 120, 2, 2), R(PAP, 20, 130, 2, 2), R(PAP, 70, -40, 2, 2), R(PAP, 180, -90, 3, 3), R(PAP, 320, -150, 2, 2), R(PAP, 110, -200, 2, 2),
        R("#2E4A78", 0, 214, 400, 6), L("#2E4A78", 110, 214, 130, 196, 2), L("#2E4A78", 210, 214, 190, 196, 2), L("#2E4A78", 130, 196, 190, 196, 2), L("#2E4A78", 118, 214, 118, 200, 1), L("#2E4A78", 202, 214, 202, 200, 1),
      ],
    },
    {
      // Le moyen : la ville aux fenêtres allumées.
      centre: [],
      repete: [
        R("#2B3F6B", 0, 180, 40, 70), R("#2B3F6B", 44, 160, 36, 90), R("#2B3F6B", 84, 196, 40, 54), R("#2B3F6B", 150, 206, 50, 44), R("#2B3F6B", 280, 170, 40, 80), R("#2B3F6B", 324, 150, 34, 100), R("#2B3F6B", 362, 190, 38, 60),
        L("#2B3F6B", 62, 160, 62, 148, 2), L("#2B3F6B", 341, 150, 341, 136, 2), C("#F07FB0", 62, 147, 1.5),
        ...fenetres("#F2B544", [[52, 170], [66, 184], [52, 198], [8, 190], [290, 182], [304, 196], [332, 164], [344, 190], [370, 202], [160, 216], [176, 226]]),
      ],
    },
    {
      // Le proche : l'enseigne au néon.
      centre: [],
      repete: [L(NEON, 90, 206, 118, 206, 2.5), L(NEON, 118, 206, 118, 218, 2.5), L(NEON, 118, 218, 90, 218, 2.5), L(NEON, 90, 218, 90, 206, 2.5), L(NEON, 96, 212, 112, 212, 1.5)],
    },
    {
      // Le sol : l'eau noire et les reflets.
      centre: [],
      repete: [R("#16233F", 0, 250, 400, 50), R("#101A30", 0, 282, 400, 18), R("#2E4A78", 0, 247, 400, 4), L("#F2B544", 55, 260, 55, 266, 3), L("#F2B544", 55, 274, 55, 278, 3), L("#F2B544", 69, 264, 69, 270, 3), L(NEON, 104, 262, 104, 267, 3), L(NEON, 104, 274, 104, 278, 3), L("#F2B544", 300, 262, 300, 268, 3), L("#F2B544", 341, 260, 341, 266, 3), L("#F3E9C6", 320, 270, 336, 270, 3)],
    },
  ],
  anims: [
    { mode: "scintille", formes: fenetres("#F2B544", [[52, 170], [8, 190], [332, 164], [160, 216]]), a: 0, T: 4.3, repete: true },
    { mode: "scintille", formes: fenetres("#1E2E52", [[66, 184], [290, 182], [370, 202], [176, 226]]), a: 0, T: 5.9, ph: 0.35, repete: true },
    { mode: "scintille", formes: [...etoile(90, 80), ...etoile(260, 40), ...etoile(330, -100)], a: 0, T: 3.1, ph: 0.6, repete: true },
    { mode: "scintille", formes: [...etoile(40, 40), ...etoile(180, -90), ...etoile(20, -160)], a: 0, T: 4.7, ph: 0.15, repete: true },
    { mode: "derive", formes: [L("#2B4A78", 40, 258, 70, 258, 3), L("#2B4A78", 200, 270, 236, 270, 3), L("#2B4A78", 320, 262, 350, 262, 3)], a: 10, T: 8, repete: true },
  ],
};
