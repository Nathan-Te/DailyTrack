import { type DecorTheme, L, C, P, R } from "./decorLogique";

// Lot T9 — le décor du CHANTIER : une grue à treillis et son crochet, un échafaudage, la ville au loin, des cônes et une barrière rayée (planche `tower-planche-decors.html`). Aplats seulement.
const ENC = "#2A1E16";
const PAP = "#FFF6E0";
const TREILLIS = Array.from({ length: 9 }, (_, i) => (i % 2 === 0 ? L(ENC, 96, 60 + i * 20, 108, 80 + i * 20, 1.4) : L(ENC, 108, 60 + i * 20, 96, 80 + i * 20, 1.4)));
const crochet = [L(ENC, 240, 42, 240, 108, 1.6), P(ENC, [234, 108, 246, 108, 244, 116, 236, 116])];

export const DECOR: DecorTheme = {
  plans: [
    {
      // Le lointain : le soleil et la ville au loin (immeubles pâles, fenêtres).
      centre: [C("#F2B705", 70, 64, 20)],
      repete: [
        R("#F0DAB0", 0, -260, 400, 300),
        R("#C9B07F", 0, 170, 40, 80), R("#C9B07F", 44, 150, 34, 100), R("#C9B07F", 290, 160, 44, 90), R("#C9B07F", 338, 140, 40, 110), R("#C9B07F", 380, 180, 20, 70),
        R("#B79C6B", 50, 160, 6, 8), R("#B79C6B", 62, 160, 6, 8), R("#B79C6B", 50, 176, 6, 8), R("#B79C6B", 62, 192, 6, 8), R("#B79C6B", 346, 152, 6, 8), R("#B79C6B", 358, 168, 6, 8), R("#B79C6B", 298, 174, 6, 8),
      ],
    },
    {
      // Le moyen : la grue (mât, treillis, flèche, contrepoids) au milieu ; un échafaudage sur chaque tuile.
      centre: [R("#E8A41A", 96, 40, 12, 210, true), ...TREILLIS, R("#E8A41A", 60, 32, 210, 10, true), R("#6C737A", 62, 42, 24, 16, true)],
      repete: [L("#8A6B3E", 330, 250, 330, 170, 3), L("#8A6B3E", 372, 250, 372, 170, 3), L("#8A6B3E", 330, 190, 372, 190, 3), L("#8A6B3E", 330, 220, 372, 220, 3), L("#8A6B3E", 330, 190, 372, 220, 3)],
    },
    {
      // Le proche : un bâtiment en construction (dalles et poteaux).
      centre: [],
      repete: [R("#B9A57E", 190, 214, 60, 8, true), R("#B9A57E", 194, 190, 52, 8, true), L("#8C7A55", 198, 222, 198, 250, 4), L("#8C7A55", 242, 222, 242, 250, 4), L("#8C7A55", 220, 198, 220, 214, 3)],
    },
    {
      // Le sol : les tirets de la route, les cônes et la barrière rayée.
      centre: [],
      repete: [
        R("#F2B705", 20, 272, 30, 5), R("#F2B705", 90, 272, 30, 5), R("#F2B705", 290, 272, 30, 5), R("#F2B705", 350, 272, 30, 5),
        P("#F28C38", [300, 250, 309, 224, 318, 250], true), P("#F28C38", [370, 250, 379, 224, 388, 250], true), R(PAP, 303, 236, 12, 4), R(PAP, 373, 236, 12, 4),
        R("#F2B705", 14, 230, 70, 12, true), P(ENC, [22, 231, 31, 231, 23, 241, 14, 241]), P(ENC, [40, 231, 49, 231, 41, 241, 32, 241]), P(ENC, [58, 231, 67, 231, 59, 241, 50, 241]), R(ENC, 20, 242, 4, 8), R(ENC, 74, 242, 4, 8),
      ],
    },
  ],
  // Le crochet se balance un tout petit peu au bout de son câble.
  anims: [{ mode: "bob", plan: 1, formes: crochet, a: 3, T: 3.6 }, { mode: "scintille", plan: 0, formes: [R("#B79C6B", 56, 168, 6, 8), R("#B79C6B", 352, 160, 6, 8)], a: 0, T: 6, ph: 0.2 }],
  bandes: [{ de: 45, c: "#E6CD9C" }, { de: 90, c: "#CDB07A" }, { de: 130, c: "#B89A62" }],
  zones: [{ de: 0, a: 15, genres: ["nuageHaut"] }, { de: 15, a: 45, genres: ["nuage", "oiseaux"] }, { de: 45, a: 100, genres: ["avion", "nuageHaut"] }, { de: 100, a: 161, genres: ["montgolfiere", "etoiles"] }],
  ciel: { nuage: "#FFF6E0", nuageHaut: "#FBEFD2", oiseau: ENC, etoile: PAP, avion: PAP, ballon: ["#D63F37", "#2F6FC4", "#F2B705"], aurore: ["#EBD3A2", "#D9BE88"] },
};
