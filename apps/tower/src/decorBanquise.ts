import { C, type DecorTheme, Ell, type Forme, L, P, R, Ruban } from "./decorLogique";

// Lot T9 — le décor de la BANQUISE : une aurore en rubans plats, des icebergs sur deux plans, des manchots sur un glaçon, de la neige qui tombe, une plateforme enneigée (planche `tower-planche-decors.html`). Aplats seulement.
const ENC = "#2A1E16";
const PAP = "#FFF6E0";
const manchot = (x: number, y: number, s = 1): Forme[] => [Ell(ENC, x, y, 7 * s, 11 * s, true), Ell(PAP, x + 1 * s, y + 3 * s, 4 * s, 7 * s), P("#F28C38", [x + 4 * s, y - 8 * s, x + 10 * s, y - 6 * s, x + 4 * s, y - 4 * s], true)];
/** Un champ de flocons (des croix pâles), semé à la main : la même suite à chaque fois. */
const flocons: Forme[] = Array.from({ length: 34 }, (_, i) => {
  const x = (i * 97) % 400;
  const y = (i * 53) % 400 - 400 + 100;
  return i % 3 === 0 ? R(PAP, x, y, 5, 5, false) : R("#A9CFE0", x, y, 4, 4);
});

export const DECOR: DecorTheme = {
  plans: [
    {
      // Le lointain : l'aurore en deux rubans plats et de petites étoiles de givre.
      centre: [],
      repete: [
        ...Ruban("#BFE8DA", 16, [0, 50, 60, 30, 120, 50, 190, 40, 260, 50, 330, 40, 400, 50]),
        ...Ruban("#CFE0F7", 10, [0, 84, 80, 60, 170, 84, 290, 66, 400, 84]),
        L("#A9CFE0", 60, 120, 66, 120, 2), L("#A9CFE0", 63, 117, 63, 123, 2), L("#A9CFE0", 300, 110, 306, 110, 2), L("#A9CFE0", 303, 107, 303, 113, 2), L("#A9CFE0", 350, 150, 356, 150, 2),
      ],
    },
    {
      // Le moyen : les icebergs pâles.
      centre: [],
      repete: [
        P("#C3E1EE", [0, 250, 20, 190, 50, 210, 50, 250]), P("#C3E1EE", [50, 250, 50, 210, 74, 170, 114, 250]),
        P("#C3E1EE", [270, 250, 296, 180, 316, 210, 316, 250]), P("#C3E1EE", [316, 250, 316, 210, 342, 162, 382, 250]), P("#E4F3FA", [296, 180, 290, 250, 316, 250]),
      ],
    },
    {
      // Le proche : l'iceberg blanc, son ombre.
      centre: [],
      repete: [P("#FFFFFF", [20, 250, 38, 204, 58, 250], true), P("#A9CFE0", [38, 204, 32, 250, 46, 250])],
    },
    {
      // Le sol : le glaçon, les manchots, un petit glaçon.
      centre: [],
      repete: [R(PAP, 60, 252, 74, 8, true), ...manchot(80, 241), ...manchot(104, 243, 0.85), R(PAP, 320, 258, 22, 7, true), R("#2A6A8A", 110, 266, 26, 3), R("#2A6A8A", 270, 272, 30, 3)],
    },
  ],
  anims: [
    // La neige tombe, devant le ciel, sur tout l'écran (suit l'écran, pas le monde).
    { mode: "tombe", plan: 2, formes: flocons, a: 400, T: 18, ecran: true },
    { mode: "derive", plan: 3, formes: [L("#2A6A8A", 110, 266, 136, 266, 3), L("#2A6A8A", 270, 272, 300, 272, 3), L("#2A6A8A", 330, 262, 352, 262, 3)], a: 12, T: 8 },
  ],
  bandes: [{ de: 45, c: "#CDE6F3" }, { de: 90, c: "#A9CEE6" }, { de: 130, c: "#7FA9CF" }],
  zones: [{ de: 0, a: 15, genres: ["nuageHaut"] }, { de: 15, a: 45, genres: ["nuage", "oiseaux"] }, { de: 45, a: 100, genres: ["aurore", "etoiles"] }, { de: 100, a: 161, genres: ["aurore", "etoiles"] }],
  ciel: { nuage: "#FFFFFF", nuageHaut: "#F2FAFD", oiseau: ENC, etoile: PAP, avion: PAP, ballon: ["#E5534B", "#3F7FD9", "#FFF6E0"], aurore: ["#BFE8DA", "#CFE0F7"] },
  // La plateforme enneigée : un bonnet de neige sur le dessus (y vers le bas, 0 = le dessus), des bosses.
  plateforme: (hw) => {
    const l = hw * 20;
    return [R(PAP, -l, -5, 2 * l, 6, true), ...[-0.7, -0.2, 0.4, 0.8].map((k) => C(PAP, k * l, -5, 7, true)), ...[-0.7, -0.2, 0.4, 0.8].map((k) => R(PAP, k * l - 6, -6, 12, 6))];
  },
};
