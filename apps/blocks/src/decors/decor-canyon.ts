import { C, type DecorTheme, type Forme, L, P, Profil, R } from "./logique";

// Lot B5 — le décor du CANYON : un couchant en bandes, un grand soleil, des mesas sur deux plans avec leurs strates, une arche de roche, des dunes, des cactus, des vautours qui planent et une boule de ronces qui roule.
// Aplats seulement.
const vautour = (x: number, y: number): Forme[] => [L("#5A3A30", x, y, x + 6, y - 6, 2), L("#5A3A30", x + 6, y - 6, x + 12, y, 2), L("#5A3A30", x + 12, y, x + 18, y - 6, 2), L("#5A3A30", x + 18, y - 6, x + 24, y, 2)];
const cactus = (x: number, h = 56): Forme[] => [R("#5F9A60", x, 250 - h, 12, h, true), R("#5F9A60", x - 10, 250 - h * 0.55, 10, 12, true), R("#5F9A60", x - 10, 250 - h * 0.55 - 12, 10, 14, true), R("#5F9A60", x + 12, 250 - h * 0.7, 10, 12, true), R("#5F9A60", x + 12, 250 - h * 0.7 - 14, 10, 16, true), C("#5F9A60", x + 6, 250 - h, 6, true)];

export const DECOR: DecorTheme = {
  calme: 0.3,
  bandes: [{ de: -9999, c: "#FFEBC8" }, { de: 50, c: "#FBD9A0" }, { de: 110, c: "#F5C27E" }, { de: 175, c: "#EDA865" }],
  plans: [
    {
      // Le lointain : le grand soleil, quelques nuages étirés, les mesas pâles et l'arche de roche.
      centre: [C("#FFF0C4", 280, 190, 56), C("#FFE1A0", 280, 190, 46)],
      repete: [
        R("#FFF3DA", 30, 40, 80, 6), R("#FFF3DA", 50, 32, 40, 6), R("#FFF3DA", 250, 80, 70, 6), R("#FFF3DA", 120, -50, 90, 6), R("#FFF3DA", 300, -110, 70, 6), R("#FFF3DA", 20, -170, 80, 6),
        R("#D99870", 0, 170, 40, 80), R("#D99870", 40, 156, 60, 94), R("#D99870", 100, 186, 30, 64), R("#D99870", 230, 200, 40, 50), R("#D99870", 270, 176, 70, 74), R("#D99870", 340, 196, 60, 54),
        R("#C98564", 160, 196, 14, 54), R("#C98564", 196, 196, 14, 54), P("#C98564", [160, 196, 210, 196, 203, 182, 167, 182]), R("#EDA865", 174, 200, 22, 50),
      ],
    },
    {
      // Le moyen : les mesas sombres et leurs strates.
      centre: [],
      repete: [
        R("#B8654A", 0, 204, 60, 46, true), R("#B8654A", 60, 186, 44, 64, true), R("#B8654A", 104, 204, 20, 46, true),
        L("#CE7A58", 2, 220, 122, 220, 3), L("#CE7A58", 2, 236, 122, 236, 3), L("#CE7A58", 62, 196, 102, 196, 3), L("#CE7A58", 62, 210, 102, 210, 2),
        R("#B8654A", 300, 220, 50, 30, true), R("#B8654A", 350, 206, 50, 44, true), L("#CE7A58", 302, 234, 398, 234, 3), L("#CE7A58", 352, 218, 398, 218, 3),
      ],
    },
    {
      // Le proche : des dunes et des rochers.
      centre: [],
      repete: [...Profil("#DDA064", 262, [0, 250, 40, 244, 90, 250, 140, 242, 200, 250, 250, 246, 310, 250, 360, 243, 400, 250]), R("#A5694A", 150, 242, 22, 10, true), R("#A5694A", 160, 236, 12, 8, true), R("#A5694A", 330, 244, 16, 8, true)],
    },
    {
      // Le sol : le sable, les cactus, quelques pierres.
      centre: [],
      repete: [R("#D89A5C", 0, 250, 400, 50), R("#C8884C", 0, 282, 400, 18), ...cactus(352), ...cactus(40, 38), R("#8A5A36", 110, 280, 10, 5), R("#8A5A36", 220, 288, 14, 5), R("#8A5A36", 290, 276, 8, 4)],
    },
  ],
  anims: [
    { mode: "bob", formes: vautour(70, 100), a: 6, T: 6.3, repete: true },
    { mode: "bob", formes: vautour(120, 80), a: 5, T: 7.1, ph: 0.5, repete: true },
    { mode: "bob", formes: vautour(300, 120), a: 5, T: 6.7, ph: 0.2, repete: true },
    { mode: "derive", formes: [C("#9A6A40", 250, 270, 6), L("#7A5230", 244, 270, 256, 270, 1), L("#7A5230", 250, 264, 250, 276, 1)], a: 30, T: 9, repete: true },
    { mode: "scintille", formes: [L("#FFF6E0", 100, 262, 108, 262, 2), L("#FFF6E0", 300, 292, 310, 292, 2)], a: 0, T: 4.4, repete: true },
  ],
};
