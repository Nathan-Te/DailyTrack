// Lot N2 de la plateforme — le **message en direct** dans Jump : la décision, pure et testée (`test/messageEnDirect.test.ts`). Le DOM et le réseau sont dans
// `messageEnDirect.ts` ; la surveillance elle-même (relire toutes les 60 s, seulement visible) est celle de `@cdj/profile` (`surveillerAnnonce`).
//
// **Où le bandeau a le droit d'apparaître** : l'accueil (avant de lancer le niveau), l'arrivée (fin du niveau) et la pause. **Jamais pendant un niveau** (course, ou
// carnage et rediffusion tant qu'ils jouent) **ni sur un autre écran** (réglages, classement, archives, « Comment jouer » : ils se posent sur l'un des trois, qui garde
// sa place dessous). **Aucune lecture du réseau hors de ces trois écrans** : dès qu'un niveau commence, `suspendre()` arrête la minuterie, l'écoute et le réseau.

import type { EcranMessage } from "@cdj/kit/message";

// Lot K3 : le type de l'écran, `baseDuMessage` et `commanderSurveillance` sont ceux de `@cdj/kit/message` (communs à Jump et à Tower) ; ici reste la règle propre à Jump — quel écran porte le bandeau.
export { baseDuMessage, commanderSurveillance, type EcranMessage, type SurveillanceCommandable } from "@cdj/kit/message";

/** Ce que le jeu sait de ses écrans (lu dans `main.ts` à chaque changement, jamais à chaque image). */
export interface EtatEcrans {
  /** L'accueil est ouvert (la partie est en pause). */
  accueil: boolean;
  /** La pause (menu ⏸) est ouverte. */
  pause: boolean;
  /** L'écran d'arrivée du niveau du jour est affiché. */
  arrivee: boolean;
  /** Un carnage ou une rediffusion joue (le résultat reste à l'écran, ce n'est pas un écran du bandeau). */
  carnage: boolean;
}

/**
 * L'écran qui porte le bandeau, ou `null` : rien ne s'affiche et **rien ne se lit** (une partie en cours, un carnage, un niveau qui commence). La pause prime (elle se pose
 * sur tout), puis l'arrivée, puis l'accueil ; un carnage les écarte tous.
 */
export function ecranDuMessage(e: EtatEcrans): EcranMessage | null {
  if (e.carnage) return null;
  if (e.pause) return "pause";
  if (e.arrivee) return "arrivee";
  if (e.accueil) return "accueil";
  return null;
}
