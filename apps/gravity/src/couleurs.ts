// Les couleurs de la scène (lot GR3) : **les jetons de la charte** (`@cdj/ui`, `jetons.css`) quand la page les porte, avec leur valeur en repli (les tests, une page sans feuille). Les couleurs de la DA de Jump (thèmes, rouge des
// dangers, jaune du héros, blocs à mécanique) viennent de `@cdj/visuels/plateformes` : rien n'est recopié ici.
import { HAZARD, PLAYER } from "@cdj/visuels/plateformes";

/** Un jeton de couleur (`--dj-encre`) lu sur la page, en 0xRRGGBB ; `repli` s'il n'y est pas. */
export function jeton(nom: string, repli: number): number {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
    const m = /^#([0-9a-f]{6})$/i.exec(v);
    if (m) return parseInt(m[1]!, 16);
  } catch {
    /* pas de page : le repli */
  }
  return repli;
}

export interface CouleursGravity {
  /** Le trait d'encre et le papier (la charte). */
  encre: number;
  papier: number;
  /** Les gemmes, le bouclier et son aura : la couleur Diamant. */
  diamant: number;
  /** Le héros : le jaune de Jump. */
  jaune: number;
  /** Le rouge des dangers : réservé aux piques (rien d'autre n'en prend la teinte). */
  danger: number;
}

export function couleursGravity(): CouleursGravity {
  return { encre: jeton("--dj-encre", 0x2a1e16), papier: jeton("--dj-papier", 0xfff6e0), diamant: jeton("--dj-diamant", 0x4fc3dc), jaune: PLAYER, danger: HAZARD };
}

/** Une couleur 0xRRGGBB en `#rrggbb` (le CSS du HUD). */
export const enCss = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;
