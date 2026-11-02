import { type DecorTheme, type Forme, L, C, P, Profil, R } from "./decorLogique";

// Lot T9 — le décor du PORT (planche `tower-planche-decors.html`) : un phare rayé, les maisons du quai, un voilier, des mouettes, une bouée et la houle à deux tons, sur trois plans qui défilent à des vitesses
// différentes (lointain 0,2 · moyen 0,5 · proche 0,8) et le sol (1). Aplats seulement ; coordonnées de la planche (px, 20 px par mètre).
const ENC = "#2A1E16";
const PAP = "#FFF6E0";
const mouette = (x: number, y: number): Forme[] => [L(ENC, x, y, x + 6, y - 6, 2), L(ENC, x + 6, y - 6, x + 12, y, 2), L(ENC, x + 12, y, x + 18, y - 6, 2), L(ENC, x + 18, y - 6, x + 24, y, 2)];
const houle = (c: string, ys: readonly number[]): Forme[] => ys.flatMap((y, i) => [L(c, -400 + i * 170, y, -400 + i * 170 + 26 + (i % 3) * 6, y, 3), L(c, -120 + i * 170, y + 6, -120 + i * 170 + 34, y + 6, 3), L(c, 160 + i * 170, y + 2, 160 + i * 170 + 28, y + 2, 3)]);

export const DECOR: DecorTheme = {
  plans: [
    {
      // Le lointain : le soleil, les nuages, les collines et le village de l'autre rive.
      centre: [C("#FFE9A8", 330, 70, 24)],
      repete: [
        R("#8CC9E0", 0, -260, 400, 306),
        R("#C9E8F2", 40, 70, 70, 12), R("#C9E8F2", 56, 60, 34, 11), R("#C9E8F2", 250, 112, 80, 12), R("#C9E8F2", 270, 102, 40, 11),
        ...Profil("#7FB8CF", 250, [0, 214, 30, 208, 50, 218, 76, 204, 108, 216, 148, 210, 190, 222, 240, 212, 300, 220, 360, 210, 400, 214]),
        R("#6FA8C0", 88, 196, 18, 22), R("#6FA8C0", 108, 204, 16, 14), P("#6FA8C0", [86, 196, 97, 187, 108, 196]),
      ],
    },
    {
      // Le moyen : le phare rayé (au milieu) et les maisons du quai.
      centre: [
        R(PAP, 46, 150, 18, 70, true), R("#E5534B", 46, 166, 18, 10), R("#E5534B", 46, 190, 18, 10),
        R("#F2B544", 42, 138, 26, 12, true), P("#E5534B", [40, 138, 55, 128, 70, 138], true),
      ],
      repete: [
        R("#F2D8A7", 250, 224, 26, 26, true), P("#C2401F", [246, 224, 263, 210, 280, 224], true), R("#8C7660", 258, 234, 8, 16),
        R("#E8C79A", 282, 232, 20, 18, true), P("#9C3B1F", [279, 232, 292, 222, 305, 232], true),
      ],
    },
    {
      // Le proche : le voilier.
      centre: [P("#E5534B", [300, 236, 380, 236, 370, 250, 308, 250], true), P(PAP, [338, 236, 338, 184, 364, 230], true), L(ENC, 338, 236, 338, 180, 2)],
      repete: [],
    },
    {
      // Le sol : la bouée et le fond de la houle.
      centre: [C("#E5534B", 96, 262, 7, true), R(PAP, 92, 258, 8, 3)],
      repete: [R("#24607D", 0, 290, 400, 10)],
    },
  ],
  anims: [
    { mode: "bob", plan: 1, formes: mouette(110, 96), a: 5, T: 4.2 },
    { mode: "bob", plan: 1, formes: mouette(140, 118), a: 4, T: 5.1, ph: 0.4 },
    { mode: "bob", plan: 1, formes: mouette(300, 150), a: 5, T: 4.7, ph: 0.7 },
    { mode: "derive", plan: 3, formes: houle("#4A8BAA", [256, 270, 284]), a: 18, T: 7 },
    { mode: "derive", plan: 3, formes: houle("#24607D", [262, 278]), a: 14, T: 9, ph: 0.5 },
  ],
  bandes: [{ de: 45, c: "#7CBEDB" }, { de: 90, c: "#5A9CCB" }, { de: 130, c: "#3E78B0" }],
  zones: [{ de: 0, a: 15, genres: ["nuageHaut"] }, { de: 15, a: 45, genres: ["nuage", "oiseaux"] }, { de: 45, a: 100, genres: ["nuageHaut", "avion"] }, { de: 100, a: 161, genres: ["montgolfiere", "etoiles"] }],
  ciel: { nuage: "#C9E8F2", nuageHaut: "#E6F4FA", oiseau: ENC, etoile: PAP, avion: PAP, ballon: ["#E5534B", "#F2B544", "#FFF6E0"], aurore: ["#BFE8DA", "#CFE0F7"] },
};
