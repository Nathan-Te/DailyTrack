import { lireNouveauDepart } from "@cdj/profile";
import { avisNouveauDepart } from "@cdj/ui";
import { traducteurDuSocle } from "./i18n";
import { gameStorage } from "./storage";

/**
 * Lot R8 : le message « Nouveau départ : tout le monde repart de zéro. Bonne chance ! », **une seule fois**, sur l'accueil d'un navigateur dont les
 * données de jeu viennent d'être effacées par la remise à zéro du lancement. `null` s'il n'y a rien à dire (le drapeau est retiré à la lecture).
 */
export function avisDeNouveauDepart(): HTMLElement | null {
  let aMontrer = false;
  try {
    aMontrer = lireNouveauDepart(gameStorage());
  } catch {
    /* stockage refusé : pas de message */
  }
  return aMontrer ? avisNouveauDepart(traducteurDuSocle()) : null;
}
