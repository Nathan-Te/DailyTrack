// Lot N2 de la plateforme — le **message en direct** dans Track : la décision seulement (pure, testée : `test/annonce.test.ts`). Ce module est dans le premier chargement
// (quelques octets : le budget de Track est serré) ; tout le reste (surveillance, bandeau, feuille) est dans `annonceUi.ts`, chargé **à la demande**, la première fois qu'un écran
// où le bandeau a le droit d'être s'affiche. Règle : « seulement à l'accueil du jeu, à l'arrivée et en pause » ; jamais pendant une course, jamais sur un autre écran.

/** Les trois écrans où le message s'affiche : l'accueil, l'arrivée (après une course) et la pause. */
export type EcranAnnonce = "accueil" | "arrivee" | "pause";

/**
 * L'écran où le bandeau a le droit d'être, ou `null` : course (décompte compris) et tout autre écran, où il n'y a ni bandeau, ni minuterie, ni lecture du réseau.
 * Arguments (positionnels : appelée à chaque image, sans allocation) : `autre` (un autre écran est ouvert : réglages, aide, archives, classement, Garage…), `accueil`, `pause`, `arrivee`.
 */
export function ecranAnnonce(autre: boolean, accueil: boolean, pause: boolean, arrivee: boolean): EcranAnnonce | null {
  return autre ? null : accueil ? "accueil" : pause ? "pause" : arrivee ? "arrivee" : null;
}

/**
 * Le message n'existe que dans une partie normale **avec un serveur** : pas sans serveur (`base` absente), pas en démonstration (`?api=demo`, `base === demo`), pas hors du circuit du
 * jour et de ses archives (`autreMode` : le Salon, une session en direct ; un scénario ou un circuit d'essai) ni dans une rediffusion regardée (`spectateur`).
 */
export function annonceAutorisee(base: string | null, demo: string, autreMode: boolean, spectateur: boolean): boolean {
  return !!base && base !== demo && !autreMode && !spectateur;
}
