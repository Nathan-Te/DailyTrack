import * as profil from "@cdj/profile/src/retours";
import { ouvrirRetour } from "@cdj/ui/src/retoursOuvrir";

// Lot C1 : « Un bug ? Une idée ? » — le dialogue de la plateforme, à la demande (texte seul). La langue est celle de `<html lang>`.
export function ouvrirRetours(jeu: string, base: string | null, stockage: Pick<Storage, "getItem"> | null): void {
  // Le code du jeu : le serveur accepte tout code de jeu ; sans clé propre dans le catalogue, la page est nommée « portail » et le dialogue est crème.
  ouvrirRetour({ jeu: jeu as never, langue: document.documentElement.lang === "en" ? "en" : "fr", base: base ?? "", playerId: profil.joueurDuStockage(stockage), profil, hrefMessages: "../messages/" });
}
