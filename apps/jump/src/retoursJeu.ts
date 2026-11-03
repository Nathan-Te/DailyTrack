import * as profil from "@cdj/profile/src/retours";
import { ouvrirRetour } from "@cdj/ui/src/retoursOuvrir";

// Lot C1 : « Un bug ? Une idée ? » — le dialogue de la plateforme, **à la demande** (`import()` de la pause et des Réglages). Comme `retrouverJeu.ts`, ce module n'importe rien du jeu ni du premier chargement
// (un module à la demande qui en importe un le fait éclater : mesuré, budgets.md) : l'appelant lui passe l'adresse du serveur et le stockage. La langue est celle de `<html lang>` ; le jour et la version
// viennent du serveur. Après l'envoi, « Mes messages » mène à la page du portail.
export function ouvrir(base: string | null, stockage: Pick<Storage, "getItem"> | null): void {
  ouvrirRetour({
    jeu: "jump",
    langue: document.documentElement.lang === "en" ? "en" : "fr",
    base: base ?? "",
    playerId: profil.joueurDuStockage(stockage),
    profil,
    hrefMessages: "../messages/",
  });
}
