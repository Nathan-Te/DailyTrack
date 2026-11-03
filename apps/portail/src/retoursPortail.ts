import { readPlayerId, type Langue } from "@cdj/profile";
import * as profil from "@cdj/profile/src/retours";
import { ouvrirRetour } from "@cdj/ui/src/retoursOuvrir";
import { baseApi } from "./jour";
import { stockageDuPortail } from "./stockage";

// Lot C1, partie A : le dialogue « Un bug ? Une idée ? » du portail — chargé **à la demande** par `retoursLien.ts`. L'identité est celle de l'appareil (jamais créée ici : sans profil, l'envoi est anonyme
// et le dialogue le dit). Après l'envoi, « Mes messages » mène à la page du portail.
export function ouvrir(langue: Langue, racine: string): void {
  const stockage = stockageDuPortail();
  ouvrirRetour({
    jeu: "portail",
    langue,
    base: baseApi(),
    playerId: stockage ? readPlayerId(stockage) : null,
    profil,
    hrefMessages: `${racine}messages/`,
  });
}
