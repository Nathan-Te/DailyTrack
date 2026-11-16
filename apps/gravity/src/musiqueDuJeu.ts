import { gameStorage } from "@cdj/kit/stockage";
import { brancherMusique } from "@cdj/musique/branche";

// La musique commune de « Gravity » (une seule instance) : `main.ts` la donne au kit (accueil, début de partie, réglages) et **la scène l'utilise pour changer de morceau quand le thème change** (lot GR4 : le kit n'annonce que
// le thème du départ — `theme:<code>` — et le kit ne passe pas la musique à la partie). Ce fichier est dans le premier chargement (une ligne, `branche.ts` ≤ 0,5 ko) ; le lecteur reste à la demande, au premier geste.
export const musique = brancherMusique("gravity", gameStorage);
