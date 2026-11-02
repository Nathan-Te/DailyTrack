import { C, type DecorTheme, L, P, R } from "./decorLogique";

// Lot T9 — le décor de la JUNGLE : la canopée, un temple en gradins, de grandes feuilles, des lianes, un perroquet, des fougères et une plateforme en planches (planche `tower-planche-decors.html`). Aplats seulement.
const ENC = "#2A1E16";
const feuille = (x: number, y: number, s: number) => P("#2C7448", [x, y, x + 40 * s, y - 20 * s, x + 90 * s, y + 20 * s, x + 40 * s, y + 20 * s], true);

export const DECOR: DecorTheme = {
  plans: [
    {
      // Le lointain : le haut de la canopée, en boules.
      centre: [],
      repete: [R("#4E9E6E", 0, -260, 400, 320), C("#378059", 20, 190, 40), C("#378059", 80, 176, 44), C("#378059", 330, 180, 46), C("#378059", 390, 196, 34), C("#378059", 200, 200, 38)],
    },
    {
      // Le moyen : le temple en gradins, les lianes et leurs feuilles, le perroquet.
      centre: [R("#4E7A5A", 110, 220, 100, 30), R("#4E7A5A", 122, 206, 76, 14), R("#4E7A5A", 134, 192, 52, 14), R("#3E6A4A", 140, 200, 16, 16)],
      repete: [
        L("#1F4A30", 120, 0, 124, 80, 3), L("#1F4A30", 300, 0, 296, 110, 3),
        P("#3FA36B", [124, 40, 134, 38, 136, 48, 126, 50], true), P("#3FA36B", [120, 66, 110, 64, 108, 74, 118, 76], true), P("#3FA36B", [302, 60, 312, 58, 314, 68, 304, 70], true), P("#3FA36B", [298, 92, 288, 90, 286, 100, 296, 102], true),
        P("#E5534B", [296, 112, 306, 102, 314, 112, 314, 124, 296, 124], true), P("#F2B544", [314, 116, 320, 119, 314, 121], true), C(ENC, 309, 115, 1.6), L(ENC, 300, 124, 296, 134, 1.6), L(ENC, 304, 124, 302, 134, 1.6),
      ],
    },
    {
      // Le proche : les grandes feuilles qui entrent par les bords.
      centre: [],
      repete: [feuille(-10, 120, 1), P("#2C7448", [410, 90, 360, 70, 316, 120, 366, 120], true), feuille(-10, 220, 0.9), L("#1F4A30", 0, 128, 76, 138, 1.6)],
    },
    {
      // Le sol : les fougères au bord de l'eau et quelques feuilles flottantes.
      centre: [],
      repete: [P("#2C7448", [0, 250, 14, 226, 30, 250], true), P("#2C7448", [370, 250, 384, 226, 400, 250], true), L("#2C7448", 20, 266, 50, 266, 3), L("#2C7448", 100, 278, 124, 278, 3), L("#2C7448", 270, 266, 300, 266, 3)],
    },
  ],
  anims: [
    { mode: "bob", plan: 1, formes: [P("#E5534B", [330, 190, 338, 182, 346, 190, 346, 200, 330, 200], true), P("#F2B544", [346, 193, 351, 195, 346, 197], true)], a: 4, T: 3.4 },
    { mode: "derive", plan: 1, formes: [L("#1F4A30", 120, 0, 124, 80, 3), L("#1F4A30", 300, 0, 296, 110, 3)], a: 3, T: 5.5 },
  ],
  bandes: [{ de: 45, c: "#56A277" }, { de: 90, c: "#357F57" }, { de: 130, c: "#2C6F4D" }],
  zones: [{ de: 0, a: 15, genres: ["nuageHaut"] }, { de: 15, a: 45, genres: ["nuage", "perroquet"] }, { de: 45, a: 100, genres: ["montgolfiere", "nuageHaut"] }, { de: 100, a: 161, genres: ["etoiles", "montgolfiere"] }],
  ciel: { nuage: "#CDEBD3", nuageHaut: "#DFF3E4", oiseau: "#E5534B", etoile: "#FFF6E0", avion: "#FFF6E0", ballon: ["#F2B544", "#E5534B", "#FFF6E0"], aurore: ["#8FD9B0", "#5FAF7E"] },
  // La plateforme en planches : les joints entre les planches, tous les 1,5 m.
  plateforme: (hw) => {
    const l = hw * 20;
    const joints = [];
    for (let x = -l + 30; x < l - 5; x += 30) joints.push(L("#5A4028", x, 2, x, 21, 1.6));
    return joints;
  },
};
