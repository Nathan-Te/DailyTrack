import { C, type DecorTheme, Ell, type Forme, L, P, R, Ruban } from "./logique";

// Lot B5 — le décor de la BANQUISE : une aurore en rubans plats, des étoiles de givre, des icebergs sur trois plans, des blocs de glace empilés et leurs reflets, des manchots sur un glaçon, de la neige qui tombe et l'eau gelée.
// Aplats seulement.
const NEIGE = "#FFFFFF";
const manchot = (x: number, y: number, s = 1): Forme[] => [Ell("#3A4A5A", x, y, 7 * s, 11 * s), Ell("#FFF6E0", x + 1 * s, y + 3 * s, 4 * s, 7 * s), P("#F28C38", [x + 4 * s, y - 8 * s, x + 10 * s, y - 6 * s, x + 4 * s, y - 4 * s]), C("#FFF6E0", x + 3 * s, y - 6 * s, 1.5 * s)];
const bloc = (x: number, y: number, w: number, h: number): Forme[] => [R("#D4ECF6", x, y, w, h, true), R("#F4FBFE", x + 3, y + 3, w - 6, 4), L("#A9CFE0", x + w * 0.5, y + 8, x + w * 0.35, y + h - 3, 1.5)];
/** Un champ de flocons (des carrés pâles), semé à la main : la même suite à chaque fois, sur 400 × 400 px. */
const flocons: Forme[] = Array.from({ length: 46 }, (_, i) => {
  const x = (i * 97) % 400;
  const y = (i * 53) % 400;
  return i % 3 === 0 ? R(NEIGE, x, y, 5, 5) : R("#CFE6F2", x, y, 4, 4);
});

export const DECOR: DecorTheme = {
  calme: 0.15,
  bandes: [{ de: -9999, c: "#E4F3FA" }, { de: 60, c: "#D8EDF7" }, { de: 120, c: "#CBE6F3" }, { de: 190, c: "#BEDFEF" }],
  plans: [
    {
      // Le lointain : l'aurore en trois rubans plats, des étoiles de givre.
      centre: [],
      repete: [
        ...Ruban("#C2EBDD", 16, [0, 50, 60, 30, 120, 50, 190, 40, 260, 50, 330, 40, 400, 50]),
        ...Ruban("#D5E4F8", 10, [0, 84, 80, 60, 170, 84, 290, 66, 400, 84]),
        ...Ruban("#D3F0E6", 8, [0, -30, 90, -50, 200, -30, 320, -46, 400, -30]),
        L("#B5D8E8", 60, 120, 66, 120, 2), L("#B5D8E8", 63, 117, 63, 123, 2), L("#B5D8E8", 300, 110, 306, 110, 2), L("#B5D8E8", 303, 107, 303, 113, 2), L("#B5D8E8", 350, 150, 356, 150, 2), L("#B5D8E8", 150, -90, 156, -90, 2), L("#B5D8E8", 153, -93, 153, -87, 2), L("#B5D8E8", 340, -150, 346, -150, 2),
      ],
    },
    {
      // Le moyen : les icebergs pâles.
      centre: [],
      repete: [
        P("#C3E1EE", [0, 250, 20, 190, 50, 210, 50, 250]), P("#C3E1EE", [50, 250, 50, 210, 74, 170, 114, 250]), P("#DCEEF6", [74, 170, 70, 250, 100, 250]),
        P("#C3E1EE", [270, 250, 296, 180, 316, 210, 316, 250]), P("#C3E1EE", [316, 250, 316, 210, 342, 162, 382, 250]), P("#E4F3FA", [296, 180, 290, 250, 316, 250]),
      ],
    },
    {
      // Le proche : l'iceberg blanc et son ombre, les blocs de glace empilés.
      centre: [],
      repete: [P(NEIGE, [20, 250, 38, 204, 58, 250], true), P("#A9CFE0", [38, 204, 32, 250, 46, 250]), ...bloc(160, 232, 30, 18), ...bloc(172, 214, 24, 18), ...bloc(196, 238, 22, 12), ...bloc(340, 236, 28, 14)],
    },
    {
      // Le sol : la glace, le glaçon et ses manchots, l'eau libre.
      centre: [],
      repete: [R("#A9D0E4", 0, 250, 400, 50), R("#8CBAD4", 0, 282, 400, 18), R("#C9E4F0", 0, 247, 400, 5), R("#FFF6E0", 60, 252, 74, 8, true), ...manchot(80, 241), ...manchot(104, 243, 0.85), R("#FFF6E0", 320, 258, 22, 7, true), R("#6FA6C4", 110, 268, 26, 3), R("#6FA6C4", 270, 274, 30, 3)],
    },
  ],
  anims: [
    // La neige tombe, devant tout, sur tout l'écran.
    { mode: "tombe", formes: flocons, a: 400, T: 20 },
    { mode: "derive", formes: [L("#6FA6C4", 110, 268, 136, 268, 3), L("#6FA6C4", 270, 274, 300, 274, 3), L("#6FA6C4", 330, 266, 352, 266, 3)], a: 12, T: 8, repete: true },
    { mode: "scintille", formes: [L("#FFFFFF", 30, 262, 44, 262, 2), L("#FFFFFF", 170, 272, 190, 272, 2), L("#FFFFFF", 230, 290, 250, 290, 2)], a: 0, T: 3.3, repete: true },
  ],
};
