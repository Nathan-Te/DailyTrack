import { JUMP_THEME_NAMES, jumpThemeForDay, type JumpThemeName } from "@cdj/jump-sim";
import { THEMES, type Theme } from "@cdj/visuels/plateformes";

// Thèmes du jour (lot 9) : une identité visuelle et sonore complète. **Lot DA2 : la description (palettes, tuiles, décor, plans de parallaxe,
// couleurs réservées) vit dans `@cdj/visuels/plateformes`** (`packages/visuels/src/plateformes/themes.ts`), que ce fichier relit sans rien
// changer : un changement d'apparence passe par le module. Ce fichier garde ce qui est propre à Jump : le *choix* du thème d'une date
// (`jumpThemeForDay`, `themeForDay`) et la liste des noms (`JUMP_THEME_NAMES`), qui viennent de `@cdj/jump-sim` (lot 11 : le thème est une donnée
// du générateur). Les seuils de contraste sont vérifiés par `test/themes.test.ts` ; un test vérifie que les noms du module sont ceux de la simulation.

export {
  BELT_STYLE,
  HAZARD,
  HAZARD_OUTLINE,
  ICE_STYLE,
  PLAYER,
  THEMES,
  backdropColors,
  depthColor,
  fillsBelow,
  solidColors,
  themeByName,
} from "@cdj/visuels/plateformes";
export type {
  AmbienceId,
  BeltStyle,
  DecorAnchor,
  DecorKind,
  DecorPart,
  IceStyle,
  ParallaxKind,
  ParallaxLayer,
  PatternKind,
  Theme,
  TileStyle,
  TrimKind,
} from "@cdj/visuels/plateformes";

export const THEME_NAMES = JUMP_THEME_NAMES;
export type ThemeName = JumpThemeName;

// Garde de compilation : les thèmes du module sont exactement ceux de la simulation (un nom en trop ou en moins ne compile plus).
const _memesNoms: Record<ThemeName, Theme> = THEMES;
void _memesNoms;

/**
 * Le thème d'un jour (numéro de jour de `@cdj/core`), **pur** : le tirage est celui de la simulation (`jumpThemeForDay`, identique à celui du
 * lot 9). Deux jours consécutifs n'ont jamais le même thème.
 */
export function themeForDay(day: number): Theme {
  return THEMES[jumpThemeForDay(day)];
}
