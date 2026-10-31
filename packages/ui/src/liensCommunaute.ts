import "./liensCommunaute.css";
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
  const a = document.createElement("a");
  a.className = `dj-communaute__lien dj-communaute__lien--${type}`;
  a.id = id;
  a.href = ADRESSES_COMMUNAUTE[type];
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  const img = document.createElement("img");
  img.alt = "";
  img.src = type === "kofi" ? tasseKofi : pictoDiscord;
  img.height = 24;
  img.width = type === "kofi" ? 30 : 24;
  const s = document.createElement("span");
  s.textContent = texte;
  a.append(img, s);
  return a;
}

/** Les deux boutons en bas à gauche d'un écran d'accueil : l'appelant les pose dans l'écran, ils disparaissent avec lui. Au changement de langue il en refait un groupe. */
export function liensCommunaute(textes: Readonly<Record<LienCommunaute, string>>): HTMLElement {
  const g = document.createElement("div");
  g.className = "dj-communaute dj-sombre";
  g.id = "communaute";
  g.append(lienCommunaute("discord", textes.discord, "communaute-discord"), lienCommunaute("kofi", textes.kofi, "communaute-kofi"));
  return g;
}
