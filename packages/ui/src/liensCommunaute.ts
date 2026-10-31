import "./liensCommunaute.css";

// Lot S1 : les liens de la communauté (Discord, Ko-fi), **le seul composant et les seules adresses** de la plateforme : le pied du portail (`boutonCommunaute.ts`) et l'accueil de chaque jeu
// (deux plaques de 44 px, icônes au trait, en bas à gauche). De simples liens : aucun script, bouton intégré ni image d'un service tiers (règle du site), nouvel onglet sans transmettre la
// page d'origine, aucun paramètre qui identifie le joueur. **À la demande, et sans rien importer du reste du socle** : les textes lui sont donnés, déjà traduits.

export const LIEN_DISCORD = "https://discord.gg/2KZkUSpDej";
export const LIEN_KOFI = "https://ko-fi.com/C7X829MCE1";
export type LienCommunaute = "discord" | "kofi";
export const ADRESSES_COMMUNAUTE: Readonly<Record<LienCommunaute, string>> = { discord: LIEN_DISCORD, kofi: LIEN_KOFI };

/** Les icônes au trait (24 × 24, `currentColor`) : une bulle de discussion, une tasse. */
const TRACES: Readonly<Record<LienCommunaute, string>> = {
  discord: "M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM9 11h.01M15 11h.01",
  kofi: "M4 8h13v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM17 10h1.5a2.5 2.5 0 0 1 0 5H17M8 4v1.5M12 4v1.5",
};

/** Les deux plaques en bas à gauche d'un écran d'accueil (le nom lu en `aria-label`) : l'appelant les pose dans l'écran, elles disparaissent avec lui. Au changement de langue il en refait un groupe. */
export function liensCommunaute(textes: Readonly<Record<LienCommunaute, string>>): HTMLElement {
  const g = document.createElement("div");
  g.className = "dj-communaute dj-sombre";
  g.id = "communaute";
  for (const type of ["discord", "kofi"] as const) {
    const a = document.createElement("a");
    a.className = "dj-communaute__plaque";
    a.id = `communaute-${type}`;
    a.href = ADRESSES_COMMUNAUTE[type];
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.setAttribute("aria-label", textes[type]);
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("viewBox", "0 0 24 24");
    s.setAttribute("aria-hidden", "true");
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", TRACES[type]);
    s.append(p);
    a.append(s);
    g.append(a);
  }
  return g;
}
