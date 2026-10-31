import "./liensCommunaute.css";
import { el } from "./dom";
import pictoDiscord from "./discord.svg?no-inline";
import tasseKofi from "./kofi-tasse.png";

// Lot S1 : les liens de la communauté (Discord, Ko-fi), **le seul composant et les seules adresses** de la plateforme, avec **le même aspect partout** : celui des boutons du pied du portail (le bleu de Ko-fi
// et sa tasse, le bleu-violet de Discord et son pictogramme, faits ici — rien n'est chargé de chez eux). De simples liens : aucun script, bouton ni widget intégré (cookies et traceurs tiers), nouvel onglet sans
// transmettre la page d'origine, aucun paramètre qui identifie le joueur. Les textes sont donnés déjà traduits. Sur l'accueil d'un jeu : `liensCommunaute`, en bas à gauche ; dans le pied du portail : `lienCommunaute`.

export const LIEN_DISCORD = "https://discord.gg/2KZkUSpDej";
export const LIEN_KOFI = "https://ko-fi.com/C7X829MCE1";
export type LienCommunaute = "discord" | "kofi";
export const ADRESSES_COMMUNAUTE: Readonly<Record<LienCommunaute, string>> = { discord: LIEN_DISCORD, kofi: LIEN_KOFI };

/** Un bouton : le pictogramme (hébergé ici) et le nom. */
export function lienCommunaute(type: LienCommunaute, texte: string, id: string): HTMLAnchorElement {
  return el(
    "a",
    { classe: `dj-communaute__lien dj-communaute__lien--${type}`, attrs: { id, href: ADRESSES_COMMUNAUTE[type], target: "_blank", rel: "noopener noreferrer" } },
    el("img", { attrs: { alt: "", src: type === "kofi" ? tasseKofi : pictoDiscord, height: 24, width: type === "kofi" ? 30 : 24 } }),
    el("span", { texte }),
  );
}
