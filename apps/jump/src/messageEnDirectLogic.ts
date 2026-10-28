// Lot N2 de la plateforme — le **message en direct** dans Jump : la décision, pure et testée (`test/messageEnDirect.test.ts`). Le DOM et le réseau sont dans
// `messageEnDirect.ts` ; la surveillance elle-même (relire toutes les 60 s, seulement visible) est celle de `@cdj/profile` (`surveillerAnnonce`).
//
// **Où le bandeau a le droit d'apparaître** : l'accueil (avant de lancer le niveau), l'arrivée (fin du niveau) et la pause. **Jamais pendant un niveau** (course, ou
// carnage et rediffusion tant qu'ils jouent) **ni sur un autre écran** (réglages, classement, archives, « Comment jouer » : ils se posent sur l'un des trois, qui garde
// sa place dessous). **Aucune lecture du réseau hors de ces trois écrans** : dès qu'un niveau commence, `suspendre()` arrête la minuterie, l'écoute et le réseau.

/** L'écran où le bandeau s'affiche. */
export type EcranMessage = "accueil" | "arrivee" | "pause";

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

/**
 * L'adresse de l'API que le bandeau lit, ou `null` : **pas de serveur** (aucune adresse), **démonstration** (`?api=demo` : le jeu ne parle à aucun serveur) — alors aucun
 * bandeau, aucune lecture, rien ne casse. `apiBase` est celle du classement (`rankApiBase`) : le message vient du même serveur.
 */
export function baseDuMessage(apiBase: string | null): string | null {
  if (apiBase === null || apiBase === "" || apiBase === "demo") return null;
  return apiBase;
}

/** Ce que la surveillance de `@cdj/profile` (`Surveillance`) offre ici : la mettre en marche ou l'arrêter. */
export interface SurveillanceCommandable {
  activer(): void;
  suspendre(): void;
}

/**
 * Fait suivre la surveillance à l'écran du moment : un écran du bandeau → `activer()` (une seule fois tant qu'on reste sur l'un des trois : de l'accueil à la pause, rien
 * ne se relit de plus) ; plus d'écran (un niveau commence, un carnage joue) → `suspendre()` **tout de suite** (minuterie, écoute et réseau arrêtés). Même écran deux fois de
 * suite : rien.
 */
export function commanderSurveillance(s: SurveillanceCommandable): (ecran: EcranMessage | null) => void {
  let courant: EcranMessage | null = null;
  return (ecran) => {
    if (ecran === courant) return;
    const avant = courant;
    courant = ecran;
    if (ecran === null) s.suspendre();
    else if (avant === null) s.activer();
  };
}
