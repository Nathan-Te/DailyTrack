// Envoi de la ligne à partager (lot T4), DOM, **chargé à la demande** : la feuille de partage du téléphone (Web Share API), sinon le presse-papiers ; si les deux manquent, l'arrivée montre le
// texte, sélectionnable (comme DailyJump). La ligne elle-même est dans `partage.ts` (pure).

/** Ce que l'envoi a donné : partagé (feuille du téléphone), copié, annulé par le joueur, ou impossible (montrer le texte). */
export type ResultatPartage = "partage" | "copie" | "annule" | "echec";

/** Copie un texte dans le presse-papiers ; faux si le navigateur refuse. */
export async function copierTexte(texte: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(texte);
      return true;
    }
  } catch {
    /* permission refusée ou page non sécurisée : l'ancienne méthode */
  }
  try {
    const zone = document.createElement("textarea");
    zone.value = texte;
    zone.setAttribute("readonly", "");
    zone.className = "fin__presse-papiers";
    document.body.append(zone);
    zone.select();
    const ok = document.execCommand("copy");
    zone.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Sur téléphone (`natif`), la feuille de partage si elle existe ; sinon (ou si elle échoue autrement que par une annulation) le presse-papiers. Le texte contient déjà le lien. */
export async function envoyerPartage(texte: string, natif: boolean): Promise<ResultatPartage> {
  if (natif && typeof navigator.share === "function") {
    try {
      await navigator.share({ text: texte });
      return "partage";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "annule";
    }
  }
  return (await copierTexte(texte)) ? "copie" : "echec";
}
