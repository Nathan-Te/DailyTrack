// Lot T3b — générateur du contenu du jour, version 3 : le TIRAGE. Un tirage n décale la graine du jour de façon déterministe (comme les variantes de circuit de Track, lot 14) ;
// la préparation (`npm run preparer:tower`) essaie les tirages 0, 1, 2… et garde le premier dont le Diamant du bot tombe dans la plage (`tirage.ts`). **Le tirage 0 suit les mêmes règles
// que les autres : sa graine est décalée comme eux, il n'est pas le contenu de la version 2.** Même corps que la version 1 (sacs de sept, plateforme, effets des paliers, vent : `corpsDuJour`),
// avec les paliers tous les 8 m (`PALIERS_METRES_V3`) et le thème du sac de thèmes (le même pour tous les tirages d'un jour). Ce fichier ne change plus une fois qu'un jour servi l'a utilisé.
import { mixSeed } from "@cdj/core";
import { PALIERS_METRES_V3 } from "../paliers";
import { themeDuJour } from "../themes";
import type { Contenu } from "./index";
import { corpsDuJour } from "./v1";

/** Le sel du jour de la version 3 (la graine d'un jour en g3 n'est celle d'aucune autre version), puis le décalage du tirage. */
export const dailyTowerV3 = (jour: number, tirage: number): Contenu => ({
  ...corpsDuJour(jour, mixSeed(mixSeed(jour, 0x70e13), 0x7a11 + tirage), PALIERS_METRES_V3),
  g: 3,
  tirage,
  theme: themeDuJour(jour),
});
