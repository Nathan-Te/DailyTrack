import "./liensCommunauteJeu.css";
import { CATALOGUE_COMMUNAUTE } from "./catalogue.communaute";
import { el } from "./dom";
import { lienCommunaute } from "./liensCommunaute";

// Lot S1 : le groupe des deux boutons d'un écran d'accueil de jeu (le portail n'importe que `liensCommunaute.ts` : il ne paie pas la mise en place). À la demande.

/** Les deux boutons en bas à gauche d'un écran d'accueil : l'appelant les pose dans l'écran, ils disparaissent avec lui. Les noms lus suivent `<html lang>` ; au changement de langue le jeu refait le groupe. */
export function liensCommunaute(): HTMLElement {
  const t = CATALOGUE_COMMUNAUTE[document.documentElement.lang.startsWith("en") ? "en" : "fr"] as unknown as Readonly<Record<string, string>>;
  return el("div", { classe: "dj-communaute dj-sombre", attrs: { id: "communaute", role: "group", "aria-label": t["communaute.groupe"] } }, lienCommunaute("discord", t["communaute.discord"]!, "communaute-discord"), lienCommunaute("kofi", t["communaute.kofi"]!, "communaute-kofi"));
}
