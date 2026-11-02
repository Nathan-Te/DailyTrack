import { C, type DecorTheme, type Forme, L, R } from "./decorLogique";

// Lot T9 — le décor du CANYON : un couchant en trois bandes, un grand soleil, des mesas sur deux plans avec leurs strates, des cactus et des vautours (planche `tower-planche-decors.html`). Aplats seulement.
const ENC = "#2A1E16";
const vautour = (x: number, y: number): Forme[] => [L(ENC, x, y, x + 6, y - 6, 2), L(ENC, x + 6, y - 6, x + 12, y, 2), L(ENC, x + 12, y, x + 18, y - 6, 2), L(ENC, x + 18, y - 6, x + 24, y, 2)];

export const DECOR: DecorTheme = {
  plans: [
    {
      // Le lointain : le couchant en trois bandes, le grand soleil et les mesas pâles.
      centre: [C("#FFE1A0", 280, 190, 46)],
      repete: [
        R("#E0753E", 0, -260, 400, 330), R("#F2A65A", 0, 70, 400, 60),
        R("#B05A38", 0, 170, 40, 80), R("#B05A38", 40, 156, 60, 94), R("#B05A38", 100, 186, 30, 64), R("#B05A38", 230, 200, 40, 50), R("#B05A38", 270, 176, 70, 74), R("#B05A38", 340, 196, 60, 54),
      ],
    },
    {
      // Le moyen : les mesas sombres et leurs strates.
      centre: [],
      repete: [
        R("#9C4E34", 0, 204, 60, 46, true), R("#9C4E34", 60, 186, 44, 64, true), R("#9C4E34", 104, 204, 20, 46, true),
        L("#B9603F", 2, 220, 122, 220, 3), L("#B9603F", 2, 236, 122, 236, 3), L("#B9603F", 62, 196, 102, 196, 3),
        R("#9C4E34", 300, 220, 50, 30, true), R("#9C4E34", 350, 206, 50, 44, true), L("#B9603F", 302, 234, 398, 234, 3), L("#B9603F", 352, 218, 398, 218, 3),
      ],
    },
    {
      // Le proche : des dunes basses.
      centre: [],
      repete: [R("#C6844A", 150, 246, 90, 4), R("#C6844A", 250, 247, 60, 3)],
    },
    {
      // Le sol : le cactus et deux cailloux.
      centre: [],
      repete: [
        R("#3F7F4A", 352, 234, 12, 56, true), R("#3F7F4A", 342, 248, 10, 14, true), R("#3F7F4A", 364, 240, 10, 14, true), C("#3F7F4A", 358, 234, 6, true),
        R("#8A5A36", 40, 280, 10, 5), R("#8A5A36", 110, 288, 14, 5),
      ],
    },
  ],
  anims: [{ mode: "bob", plan: 2, formes: vautour(70, 100), a: 6, T: 6.3 }, { mode: "bob", plan: 2, formes: vautour(120, 80), a: 5, T: 7.1, ph: 0.5 }],
  bandes: [{ de: 40, c: "#D9733F" }, { de: 85, c: "#A8553A" }, { de: 125, c: "#6F3A38" }],
  zones: [{ de: 0, a: 15, genres: ["nuageHaut"] }, { de: 15, a: 45, genres: ["nuage", "vautour"] }, { de: 45, a: 100, genres: ["nuageHaut", "avion"] }, { de: 100, a: 161, genres: ["etoiles", "vautour"] }],
  ciel: { nuage: "#FBD9A0", nuageHaut: "#F2C27E", oiseau: ENC, etoile: "#FFF6E0", avion: "#FFF6E0", ballon: ["#E5534B", "#F2B544", "#FFF6E0"], aurore: ["#E8894A", "#F2A65A"] },
};
