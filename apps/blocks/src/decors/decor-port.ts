import { C, type DecorTheme, type Forme, L, P, Profil, R } from "./logique";

// Lot B5 — le décor du PORT : un ciel en bandes qui s'éclaircit vers l'horizon, un grand soleil, des nuages en gradins, les collines et le village de l'autre rive, des grues de quai au loin, le phare rayé, les maisons et les
// conteneurs du quai, un voilier et un petit bateau, des mouettes, une bouée et la houle à deux tons. Aplats seulement (le même esprit que le port de Tower, redessiné pour Blocks).
const BLANC = "#FFF6E0";
const mouette = (x: number, y: number): Forme[] => [L("#3A4A5A", x, y, x + 6, y - 6, 2), L("#3A4A5A", x + 6, y - 6, x + 12, y, 2), L("#3A4A5A", x + 12, y, x + 18, y - 6, 2), L("#3A4A5A", x + 18, y - 6, x + 24, y, 2)];
const nuage = (x: number, y: number, c = "#E6F4FA"): Forme[] => [R(c, x, y, 70, 12), R(c, x + 16, y - 10, 34, 11), R(c, x + 40, y - 4, 40, 8)];
const grue = (x: number): Forme[] => [R("#9DB8C8", x, 160, 4, 90), R("#9DB8C8", x - 26, 156, 56, 4), L("#9DB8C8", x + 2, 160, x + 28, 156, 1.5), L("#9DB8C8", x + 20, 160, x + 20, 188, 1)];
const conteneur = (x: number, y: number, c: string): Forme[] => [R(c, x, y, 26, 14, true), L("#00000022", x + 6, y + 2, x + 6, y + 12, 1), L("#00000022", x + 13, y + 2, x + 13, y + 12, 1), L("#00000022", x + 20, y + 2, x + 20, y + 12, 1)];
const houle = (c: string, ys: readonly number[]): Forme[] => ys.flatMap((y, i) => [L(c, -200 + i * 130, y, -170 + i * 130 + (i % 3) * 6, y, 3), L(c, 40 + i * 130, y + 6, 76 + i * 130, y + 6, 3), L(c, 250 + i * 130, y + 2, 280 + i * 130, y + 2, 3)]);

export const DECOR: DecorTheme = {
  calme: 0.18,
  bandes: [{ de: -9999, c: "#9FD3E6" }, { de: 60, c: "#B5DEEC" }, { de: 120, c: "#CBE8F1" }, { de: 190, c: "#DDF0F5" }],
  plans: [
    {
      // Le lointain : le soleil et son halo, les nuages, les collines de l'autre rive, le village, les grues du port.
      centre: [C("#FFF1C8", 330, 70, 36), C("#FFE9A8", 330, 70, 24)],
      repete: [
        ...nuage(40, 74), ...nuage(238, 110), ...nuage(150, -20, "#EEF8FC"), ...nuage(330, -70, "#EEF8FC"), ...nuage(30, -130, "#EEF8FC"), ...nuage(250, -190, "#EEF8FC"),
        ...Profil("#8FC3D9", 250, [0, 214, 30, 208, 50, 218, 76, 204, 108, 216, 148, 210, 190, 222, 240, 212, 300, 220, 360, 210, 400, 214]),
        R("#7DB1C9", 88, 196, 18, 22), R("#7DB1C9", 108, 204, 16, 14), P("#7DB1C9", [86, 196, 97, 187, 108, 196]), R("#7DB1C9", 300, 200, 20, 20), P("#7DB1C9", [298, 200, 310, 190, 322, 200]),
        ...grue(150), ...grue(360),
      ],
    },
    {
      // Le moyen : le phare rayé (au milieu), les maisons et les conteneurs du quai.
      centre: [R(BLANC, 46, 150, 18, 70, true), R("#E5534B", 46, 166, 18, 10), R("#E5534B", 46, 190, 18, 10), R("#F2B544", 42, 138, 26, 12, true), P("#E5534B", [40, 138, 55, 128, 70, 138], true), C("#FFF1C8", 55, 144, 3)],
      repete: [
        R("#F2D8A7", 250, 224, 26, 26, true), P("#C2401F", [246, 224, 263, 210, 280, 224], true), R("#8C7660", 258, 234, 8, 16), R("#E8C79A", 282, 232, 20, 18, true), P("#9C3B1F", [279, 232, 292, 222, 305, 232], true),
        R("#F2D8A7", 120, 230, 22, 20, true), P("#C2401F", [116, 230, 131, 218, 146, 230], true), R("#FFF1C8", 126, 236, 5, 5),
        ...conteneur(150, 236, "#E5534B"), ...conteneur(178, 236, "#3F7FD9"), ...conteneur(164, 222, "#F2B544"), ...conteneur(330, 236, "#5FAE7C"),
      ],
    },
    {
      // Le proche : le voilier et son reflet, un petit bateau à rames.
      centre: [P("#E5534B", [300, 236, 380, 236, 370, 250, 308, 250], true), P(BLANC, [338, 236, 338, 184, 364, 230], true), P("#F4E3B5", [334, 236, 334, 198, 316, 234]), L("#5A4A3A", 338, 236, 338, 180, 2)],
      repete: [P("#8C5A3C", [60, 250, 98, 250, 92, 258, 66, 258], true), L("#5A4A3A", 70, 242, 86, 252, 1.5)],
    },
    {
      // Le sol : l'eau, la bouée, le quai.
      centre: [C("#E5534B", 96, 266, 7, true), R(BLANC, 92, 262, 8, 3)],
      repete: [R("#4A8FB0", 0, 250, 400, 50), R("#3A7C9E", 0, 280, 400, 20), R("#8C7660", 0, 247, 400, 4), R("#6B5847", 0, 251, 400, 3)],
    },
  ],
  anims: [
    { mode: "bob", formes: mouette(110, 96), a: 5, T: 4.2, repete: true },
    { mode: "bob", formes: mouette(140, 118), a: 4, T: 5.1, ph: 0.4, repete: true },
    { mode: "bob", formes: mouette(300, 150), a: 5, T: 4.7, ph: 0.7, repete: true },
    { mode: "derive", formes: houle("#6AA6C2", [258, 270, 290]), a: 14, T: 7, repete: true },
    { mode: "derive", formes: houle("#3A7C9E", [264, 284]), a: 10, T: 9, ph: 0.5, repete: true },
    { mode: "scintille", formes: [L("#FFF1C8", 280, 262, 300, 262, 2), L("#FFF1C8", 310, 268, 326, 268, 2), L("#FFF1C8", 30, 274, 48, 274, 2)], a: 0, T: 3.6, repete: true },
  ],
};
