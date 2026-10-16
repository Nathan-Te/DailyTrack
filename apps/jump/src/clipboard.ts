// Envoi de la ligne à partager (lot 10), DOM : la feuille de partage du téléphone (Web Share API), sinon le presse-papiers ; si les deux
// manquent, l'écran d'arrivée montre le texte, sélectionnable (comme DailyTrack, lot 1b).

/** Ce que l'envoi a donné : partagé (feuille du téléphone), copié, annulé par le joueur, ou impossible (montrer le texte). */
export type SendResult = "partage" | "copie" | "annule" | "echec";

/** Copie un texte dans le presse-papiers ; faux si le navigateur refuse. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* permission refusée ou page non sécurisée : l'ancienne méthode */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.append(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Partage : sur téléphone (`native`), la feuille de partage si elle existe ; sinon (ou si elle échoue autrement que par une annulation) le
 * presse-papiers. Le texte contient déjà le lien : on ne le passe pas deux fois.
 */
export async function sendShare(text: string, native: boolean): Promise<SendResult> {
  if (native && typeof navigator.share === "function") {
    try {
      await navigator.share({ text });
      return "partage";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "annule";
    }
  }
  return (await copyText(text)) ? "copie" : "echec";
}
