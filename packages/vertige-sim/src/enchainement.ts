import { MODULES } from "./bibliotheque";
import { assembler, type Enchainement } from "./modules";
import { enregistrerNiveau } from "./niveaux";

// L'enchaînement fixe (lot V2) : des modules assemblés à la main, qui préfigurent le niveau du jour.
export const ORDRE_ENCHAINEMENT: readonly string[] = ["saut-1", "mur-1", "gravite-1", "portail-gravite", "dash-2", "portail-gravite-retour", "dash-1"];

let cache: Enchainement | null = null;
/** L'enchaînement assemblé (construit une fois), son niveau, sa solution et les temps de son robot. */
export function enchainement(): Enchainement {
  return (cache ??= assembler(ORDRE_ENCHAINEMENT.map((id) => MODULES.find((m) => m.id === id)!)));
}

/** Enregistre le niveau « enchainement » du jeu (`niveau("enchainement")`, voir `niveaux.ts`) : à l'initialisation de ce fichier, et à appeler explicitement dans un navigateur (un paquet `sideEffects: false` peut y voir disparaître un import qui n'a que cet effet). */
export function enregistrerEnchainement(): void {
  enregistrerNiveau("enchainement", () => enchainement().niveau);
}
enregistrerEnchainement();
