import { C, type DecorTheme, Ell, type Forme, L, P, R } from "./logique";

// Lot B5 — le décor de la JUNGLE : la canopée en boules sur deux plans, un temple en gradins, des lianes qui se balancent, de grandes feuilles qui entrent par les bords, des troncs, un perroquet, des fougères, une rivière et
// des lucioles. Aplats seulement.
const feuille = (x: number, y: number, s: number): Forme[] => [P("#5E9876", [x, y, x + 40 * s, y - 20 * s, x + 90 * s, y + 20 * s, x + 40 * s, y + 20 * s], true), L("#4E7E62", x, y, x + 84 * s, y + 18 * s, 1.5)];
const tronc = (x: number): Forme[] => [R("#8A6A44", x, -120, 14, 380, true), L("#A98660", x + 4, -120, x + 4, 260, 1.5), P("#8A6A44", [x - 8, 250, x, 232, x + 14, 232, x + 22, 250])];
const liane = (x: number): Forme[] => [L("#4E7E62", x, -80, x + 3, 80, 3), P("#6FAE8B", [x + 3, 40, x + 13, 38, x + 15, 48, x + 5, 50]), P("#6FAE8B", [x + 2, 66, x - 8, 64, x - 10, 74, x, 76])];

export const DECOR: DecorTheme = {
  calme: 0.3,
  bandes: [{ de: -9999, c: "#8FD1A0" }, { de: 70, c: "#84CA97" }, { de: 150, c: "#79C28C" }, { de: 210, c: "#6FBA84" }],
  plans: [
    {
      // Le lointain : le haut de la canopée, en boules, des brumes.
      centre: [],
      repete: [R("#BFE0C8", 20, 40, 90, 8), R("#BFE0C8", 36, 32, 50, 8), R("#BFE0C8", 260, 96, 80, 8), R("#BFE0C8", 100, -60, 80, 8), R("#BFE0C8", 300, -120, 70, 8), C("#72A988", 20, 190, 40), C("#72A988", 80, 176, 44), C("#72A988", 330, 180, 46), C("#72A988", 390, 196, 34), C("#72A988", 200, 200, 38), R("#72A988", 0, 200, 400, 60)],
    },
    {
      // Le moyen : le temple en gradins, les troncs, les lianes et leurs feuilles, le perroquet.
      centre: [R("#7A9A82", 110, 220, 100, 30, true), R("#7A9A82", 122, 206, 76, 14, true), R("#7A9A82", 134, 192, 52, 14, true), R("#5E7E66", 148, 200, 14, 16), R("#8DAE94", 150, 186, 20, 6), C("#F2B544", 160, 180, 4)],
      repete: [
        ...tronc(250), ...tronc(370), ...liane(120), ...liane(300),
        P("#E5534B", [296, 112, 306, 102, 314, 112, 314, 124, 296, 124], true), P("#F2B544", [314, 116, 320, 119, 314, 121]), C("#1F4A30", 309, 115, 1.6), L("#C23B34", 300, 124, 296, 134, 1.6), L("#C23B34", 304, 124, 302, 134, 1.6),
      ],
    },
    {
      // Le proche : les grandes feuilles qui entrent par les bords.
      centre: [],
      repete: [...feuille(-10, 120, 1), P("#5E9876", [410, 90, 360, 70, 316, 120, 366, 120], true), ...feuille(-10, 220, 0.9), ...feuille(320, 200, 0.8), Ell("#6FAE8B", 60, 70, 18, 7, true), Ell("#6FAE8B", 350, 40, 16, 6, true)],
    },
    {
      // Le sol : la rivière, la berge, les fougères.
      centre: [],
      repete: [R("#67A07F", 0, 250, 400, 50), R("#56896E", 0, 282, 400, 18), R("#4E7E62", 0, 246, 400, 5), P("#82BC9A", [60, 250, 70, 238, 80, 250]), P("#82BC9A", [74, 250, 86, 236, 98, 250]), P("#82BC9A", [300, 250, 312, 236, 324, 250]), Ell("#8CC4A2", 140, 268, 10, 3), Ell("#8CC4A2", 330, 280, 12, 3), R("#8A6A44", 40, 246, 20, 4, true), R("#8A6A44", 340, 246, 24, 4, true), P("#5E9876", [0, 250, 14, 226, 30, 250], true), P("#5E9876", [370, 250, 384, 226, 400, 250], true), P("#5E9876", [180, 250, 192, 232, 206, 250], true), L("#8CC4A2", 20, 266, 50, 266, 3), L("#8CC4A2", 100, 278, 124, 278, 3), L("#8CC4A2", 270, 266, 300, 266, 3)],
    },
  ],
  anims: [
    { mode: "bob", formes: [P("#E5534B", [330, 190, 338, 182, 346, 190, 346, 200, 330, 200], true), P("#F2B544", [346, 193, 351, 195, 346, 197])], a: 4, T: 3.4, repete: true },
    { mode: "derive", formes: [L("#4E7E62", 120, -80, 123, 80, 3), L("#4E7E62", 300, -80, 303, 80, 3)], a: 3, T: 5.5, repete: true },
    { mode: "scintille", formes: [C("#F4F29A", 60, 150, 1.6), C("#F4F29A", 140, 120, 1.6), C("#F4F29A", 330, 160, 1.6), C("#F4F29A", 220, 170, 1.6)], a: 0, T: 4.1, repete: true },
    { mode: "scintille", formes: [C("#F4F29A", 90, 190, 1.6), C("#F4F29A", 290, 130, 1.6), C("#F4F29A", 380, 210, 1.6)], a: 0, T: 5.3, ph: 0.4, repete: true },
    { mode: "derive", formes: [L("#8CC4A2", 60, 272, 76, 272, 2), L("#8CC4A2", 230, 290, 250, 290, 2)], a: 10, T: 7, repete: true },
  ],
};
