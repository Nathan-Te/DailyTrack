import { flashLabel } from "./dom";
import { t } from "./i18n";

/** Copie un texte dans le presse-papiers ; renvoie faux si le navigateur refuse (page non sécurisée, permission, navigateur ancien). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Partage natif (feuille de partage du téléphone) quand il existe. Renvoie vrai si le joueur a partagé. */
export async function nativeShare(data: { text: string; url: string }): Promise<boolean> {
  try {
    await navigator.share(data);
    return true;
  } catch {
    return false; // annulé par le joueur ou refusé
  }
}

/** Le partage natif n'est utile que sur téléphone : sur ordinateur la feuille du système ne sait pas coller un message (lot 33), « Copier » est l'action. */
export const canNativeShare = (): boolean => typeof navigator.share === "function" && matchMedia("(pointer: coarse)").matches;

/** Le message à partager : la ligne, puis le lien du jeu à la ligne. */
export const shareMessage = (line: string, url: string): string => `${line}\n${url}`;

/**
 * « Copier » (lot 33) : le message complet va dans le presse-papiers (« Copié ») ; si le navigateur refuse, il s'affiche dans un champ déjà
 * sélectionné, prêt pour Ctrl+C (le champ est posé après le bouton, ou après `apres`).
 */
export async function copyShare(b: HTMLButtonElement, line: string, url: string, apres: HTMLElement = b): Promise<void> {
  const message = shareMessage(line, url);
  if (await copyText(message)) return flashLabel(b, t("partage.copie"));
  let champ = apres.parentElement?.querySelector<HTMLTextAreaElement>(".partage__champ");
  if (!champ) {
    champ = document.createElement("textarea");
    champ.className = "champ partage__champ";
    champ.readOnly = true;
    champ.rows = 2;
    champ.setAttribute("aria-label", t("partage.champ"));
    apres.after(champ);
  }
  champ.value = message;
  champ.focus();
  champ.select();
}
