import { formatNombre } from "@cdj/ui";
import { langueCourante } from "./i18n";

// Les formats de hauteur de Tower (lot T4, sortis de `hud.ts` pour que l'accueil, dans le premier chargement, ne tire pas le HUD de la partie).

/** Une hauteur en millimètres, en mètres à trois décimales : « 27,406 m » (espace insécable). */
export const formatHauteur = (mm: number): string => `${formatNombre(mm / 1000, langueCourante(), 3)} m`;

/** Une hauteur de palier en mètres entiers : « 8 m » (espace insécable, comme `formatHauteur`). */
export const formatPalier = (metres: number): string => `${formatNombre(metres, langueCourante(), 0)} m`;
