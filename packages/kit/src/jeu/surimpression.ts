import { el } from "@cdj/ui";
import type { ZonesSurimpression } from "./types";

// Lot PG1 — **le HUD en surimpression** : quand une définition dit `hud: "surimpression"`, le kit pose sur le plateau quatre zones (haut-gauche, centre, haut-droite et l'annonce, au milieu) que le jeu remplit
// (`OptionsPartie.zones`), et le texte de la barre (`hud().principal` et `.secondaire`) n'est plus visible : il reste dans la page, lu par la pause et les lecteurs d'écran. Le kit ne dessine rien d'autre que ces zones :
// leur place, leurs marges de sécurité, leur lisibilité sur téléphone (`ecrans.css`, jetons seulement) ; ce qui s'y écrit — un nombre, une pastille, un nom de thème — est au jeu. **Du DOM seulement, aucun texte.**

export interface Surimpression {
  /** L'élément à poser dans le plateau (au-dessus de la scène du jeu, sans jamais attraper un toucher). */
  racine: HTMLElement;
  zones: ZonesSurimpression;
  /** Vide les quatre zones (une partie neuve repart d'un HUD vide ; la racine, elle, reste). */
  vider(): void;
}

/** Les quatre zones, vides. `aria-hidden` : ce que le jeu y écrit répète la barre, que les lecteurs d'écran lisent déjà. */
export function creerSurimpression(): Surimpression {
  const zone = (nom: string): HTMLElement => el("div", { classe: `jeu-surimpression__zone jeu-surimpression__${nom}`, attrs: { "data-zone": nom } });
  const hautGauche = zone("haut-gauche");
  const centre = zone("centre");
  const hautDroite = zone("haut-droite");
  const annonce = el("div", { classe: "jeu-surimpression__annonce", attrs: { "data-zone": "annonce" } });
  const racine = el("div", { classe: "jeu-surimpression", attrs: { "aria-hidden": "true" } }, hautGauche, centre, hautDroite, annonce);
  const zones: ZonesSurimpression = { hautGauche, centre, hautDroite, annonce };
  return { racine, zones, vider: () => Object.values(zones).forEach((z) => z.replaceChildren()) };
}
