/** Copie un texte dans le presse-papiers ; renvoie faux si le navigateur refuse. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* permission refusée ou page non sécurisée : on essaie l'ancienne méthode */
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

/** Partage natif (feuille de partage du téléphone) quand il existe. Renvoie vrai si le joueur a partagé. */
export async function nativeShare(data: { text: string; url: string }): Promise<boolean> {
  if (typeof navigator.share !== "function") return false;
  try {
    await navigator.share(data);
    return true;
  } catch {
    return false; // annulé par le joueur ou refusé
  }
}

export const canNativeShare = (): boolean => typeof navigator.share === "function";
