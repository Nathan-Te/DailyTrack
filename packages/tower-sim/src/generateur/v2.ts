// Lot T3 — générateur du contenu du jour, version 2 : exactement le contenu de la version 1 (pièces, plateforme, paliers, vent), avec le thème tiré par le sac de thèmes commun
// (`themes.ts`) au lieu de `port` pour tous. Ce fichier ne change plus une fois qu'un jour servi l'a utilisé.
import { themeDuJour } from "../themes";
import type { Contenu } from "./index";
import { dailyTowerV1 } from "./v1";

export function dailyTowerV2(jour: number): Contenu {
  return { ...dailyTowerV1(jour), g: 2, theme: themeDuJour(jour) };
}
