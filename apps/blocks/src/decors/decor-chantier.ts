import { C, type DecorTheme, type Forme, L, P, R } from "./logique";

// Lot B5 — le décor du CHANTIER : un ciel poussiéreux, des immeubles et leurs fenêtres au loin, une grue à treillis (le crochet se balance), un bâtiment en construction et son échafaudage, une pelleteuse et un tas de terre, des
// cônes, une barrière rayée et les tirets de la route. Aplats seulement.
const ACIER = "#6C737A";
const treillis = (x: number, y0: number, n: number): Forme[] => Array.from({ length: n }, (_, i) => (i % 2 === 0 ? L("#B8860B", x, y0 + i * 14, x + 12, y0 + (i + 1) * 14, 1.4) : L("#B8860B", x + 12, y0 + i * 14, x, y0 + (i + 1) * 14, 1.4)));
const fenetres = (c: string, x: number, y: number, cols: number, rangs: number): Forme[] => Array.from({ length: cols * rangs }, (_, i) => R(c, x + (i % cols) * 11, y + Math.floor(i / cols) * 14, 6, 8));
const cone = (x: number): Forme[] => [P("#F28C38", [x, 250, x + 9, 224, x + 18, 250], true), R("#FFF6E0", x + 3, 236, 12, 4)];

export const DECOR: DecorTheme = {
  calme: 0.2,
  bandes: [{ de: -9999, c: "#F6E7C8" }, { de: 70, c: "#F2DDB6" }, { de: 130, c: "#EDD3A4" }, { de: 200, c: "#E8CB98" }],
  plans: [
    {
      // Le lointain : le soleil dans la poussière, la ville au loin.
      centre: [C("#FBEBB8", 70, 64, 28), C("#F8DC96", 70, 64, 20)],
      repete: [
        R("#FFF6E0", 230, 40, 60, 10), R("#FFF6E0", 244, 32, 30, 9), R("#FFF6E0", 330, 100, 50, 9), R("#FFF6E0", 20, -60, 60, 10), R("#FFF6E0", 300, -120, 70, 10),
        R("#D6BE92", 0, 170, 40, 80), R("#D6BE92", 44, 150, 34, 100), R("#D6BE92", 290, 160, 44, 90), R("#D6BE92", 338, 140, 40, 110), R("#D6BE92", 380, 180, 20, 70), R("#D6BE92", 150, 190, 36, 60),
        ...fenetres("#C2A878", 6, 178, 3, 5), ...fenetres("#C2A878", 50, 158, 2, 6), ...fenetres("#C2A878", 296, 170, 3, 5), ...fenetres("#C2A878", 344, 148, 3, 7), ...fenetres("#C2A878", 156, 198, 2, 3),
      ],
    },
    {
      // Le moyen : la grue (mât, treillis, flèche, contrepoids, cabine), un échafaudage sur chaque tuile.
      centre: [R("#E8A41A", 96, 40, 12, 210, true), ...treillis(96, 56, 12), R("#E8A41A", 54, 30, 216, 8, true), R(ACIER, 62, 38, 24, 16, true), R("#F6E7C8", 66, 42, 8, 6), L("#B8860B", 100, 30, 170, 10, 1.4), L("#B8860B", 100, 30, 60, 10, 1.4), R(ACIER, 54, 22, 20, 8)],
      repete: [
        L("#9A7B4A", 330, 250, 330, 160, 3), L("#9A7B4A", 372, 250, 372, 160, 3), L("#9A7B4A", 330, 190, 372, 190, 3), L("#9A7B4A", 330, 220, 372, 220, 3), L("#9A7B4A", 330, 160, 372, 160, 3), L("#9A7B4A", 330, 190, 372, 220, 2), L("#9A7B4A", 330, 160, 372, 190, 2),
      ],
    },
    {
      // Le proche : le bâtiment en construction (dalles, poteaux, armatures) et la pelleteuse.
      centre: [],
      repete: [
        R("#C9B58C", 190, 214, 70, 8, true), R("#C9B58C", 194, 190, 62, 8, true), R("#C9B58C", 198, 166, 54, 8, true), L("#9C8A62", 200, 222, 200, 250, 4), L("#9C8A62", 250, 222, 250, 250, 4), L("#9C8A62", 225, 198, 225, 214, 3), L("#9C8A62", 220, 174, 220, 190, 3), L("#B8860B", 205, 166, 205, 150, 1.5), L("#B8860B", 215, 166, 215, 146, 1.5), L("#B8860B", 245, 166, 245, 152, 1.5),
        R("#E8A41A", 60, 236, 36, 14, true), R("#4A4F55", 56, 246, 44, 7, true), R("#E8A41A", 72, 224, 16, 12, true), L("#E8A41A", 70, 232, 46, 214, 4), L("#E8A41A", 46, 214, 34, 236, 3), P("#6C737A", [30, 236, 42, 236, 36, 246, 26, 244], true),
      ],
    },
    {
      // Le sol : la route, ses tirets, un tas de terre, des cônes et une barrière rayée.
      centre: [],
      repete: [
        R("#8E8F8D", 0, 250, 400, 50), R("#7E7F7D", 0, 284, 400, 16), R("#B89A62", 0, 247, 400, 4),
        R("#EBD08A", 20, 272, 30, 5), R("#EBD08A", 90, 272, 30, 5), R("#EBD08A", 290, 272, 30, 5), R("#EBD08A", 350, 272, 30, 5),
        ...cone(300), ...cone(370), P("#9A7B4A", [110, 250, 140, 228, 170, 250], true), P("#8A6B3E", [150, 250, 170, 238, 190, 250], true),
        R("#E6C675", 232, 232, 56, 12, true), P("#4A3A30", [238, 233, 247, 233, 239, 243, 230, 243]), P("#4A3A30", [256, 233, 265, 233, 257, 243, 248, 243]), P("#4A3A30", [274, 233, 283, 233, 275, 243, 266, 243]), R("#4A3A30", 238, 244, 4, 6), R("#4A3A30", 278, 244, 4, 6),
      ],
    },
  ],
  anims: [
    { mode: "bob", formes: [L("#4A4F55", 160, 38, 160, 100, 1.6), P("#4A4F55", [154, 100, 166, 100, 164, 110, 156, 110]), R("#E8A41A", 150, 110, 20, 14, true)], a: 3, T: 3.6 },
    { mode: "scintille", formes: [...fenetres("#FBEBB8", 6, 178, 1, 2), ...fenetres("#FBEBB8", 344, 148, 1, 3)], a: 0, T: 6, ph: 0.2, repete: true },
    { mode: "derive", formes: [R("#FFF6E0", 120, 120, 40, 7), R("#FFF6E0", 132, 113, 20, 7)], a: 20, T: 22, repete: true },
  ],
};
