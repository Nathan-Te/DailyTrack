import type { OptionsManette } from "./manette";

// Lot M1 (plateforme) : le seul morceau de la manette qui est dans le premier chargement d'un jeu ou du portail — quelques lignes. Le module (`manette.ts`, sa
// feuille, son catalogue) n'est chargé (`import()`) qu'à la **première manette** (`gamepadconnected`) : sans manette, aucun octet de plus, aucune lecture.
// Les jeux lisent leur manette comme avant (`navigator.getGamepads`) et la passent par `padPourLeJeu` : tant que le module n'est pas là, elle est inchangée ; une fois
// chargé, un menu ouvert la leur cache (un appui ne sert jamais deux fois : le A qui ferme la pause ne fait pas sauter le personnage), sauf Start.

let filtre: ((pad: Gamepad) => Gamepad) | null = null;

/** La manette que le jeu doit lire : celle de l'API, moins ce qu'un menu a pris. `undefined` reste `undefined`. */
export function padPourLeJeu(pad: Gamepad | undefined): Gamepad | undefined {
  return filtre && pad ? filtre(pad) : pad;
}

/** Ce que charge `activerManette` : le moteur des menus et les déclarations de l'application (son `manette.ts` réexporte `demarrerManette`). */
export interface ModuleManette {
  demarrerManette(options: OptionsManette, brancher: (filtre: ((pad: Gamepad) => Gamepad) | null) => void): void;
  OPTIONS_MANETTE: OptionsManette;
}

/**
 * Charge le menu à la manette à la première manette branchée. À appeler une fois par page, au démarrage. `charger` est un seul `import()` du fichier `manette.ts` de
 * l'application — ses écrans (leur action principale) et le moteur : rien ne pèse au premier chargement que ces quelques lignes.
 */
export function activerManette(charger: () => Promise<ModuleManette>): void {
  addEventListener("gamepadconnected", () => void charger().then((m) => m.demarrerManette(m.OPTIONS_MANETTE, (f) => (filtre = f)), () => 0), { once: true });
}
