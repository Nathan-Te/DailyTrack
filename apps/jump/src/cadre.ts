import { barreJeu, creerCadre as cadreDuSocle, el, type Cadre } from "@cdj/ui";
import { onLangue, t, traducteurDuSocle } from "./i18n";

export type { Cadre };

// Les écrans de Jump posés sur la scène (lot I5 ; lot I4b : le cadre commun de @cdj/ui, `creerCadre` et cadre.css, partagé avec Track) : la barre des jeux
// (`barreJeu` : « ‹ DU JOUR » vers le portail, ou « ‹ JUMP » qui ferme l'écran) en plaque crème, l'étiquette jaune (`.etiquette`, interface.css) dans sa coque
// moutarde, et ce qui défile. L'arrivée, le classement du jour, les archives, les réglages ; l'accueil pose sa propre barre (`barreDuJour`, home.ts) ; la
// pause, « Comment jouer » et le carnage sont des dialogues sur le voile. La barre se redessine d'elle-même au changement de langue et de jour (`definirJour`).

/** Le jour du jeu pour la barre : le numéro de jour civil (Paris, `@cdj/clock`) et le numéro du niveau (absent avant le premier). */
let jourDuJeu = { jour: 0, numero: undefined as number | undefined };
const barres = new Set<() => void>();

/** À appeler une fois au démarrage : la date et le numéro que montrent les barres. */
export function definirJour(jour: number, numero?: number): void {
  jourDuJeu = { jour, numero: numero !== undefined && numero >= 1 ? numero : undefined };
  for (const maj of barres) maj();
}

/** La barre des jeux telle qu'elle est aujourd'hui (l'accueil la pose dans une plaque crème sur la scène). */
export function barreDuJour(o: { retourJeu?: () => void; pleinEcran?: boolean } = {}): HTMLElement {
  return barreJeu(traducteurDuSocle(), {
    href: "../",
    jour: jourDuJeu.jour,
    numero: jourDuJeu.numero,
    pleinEcran: o.pleinEcran,
    ...(o.retourJeu ? { retour: { texte: t("jeu.jump.titre"), ariaLabel: t("cadre.retourJump"), onClick: o.retourJeu } } : {}),
  });
}

/** S'abonne aux changements de jour de la barre (l'accueil, qui pose sa propre barre). */
export function onJour(cb: () => void): void {
  barres.add(cb);
}

export interface OptionsCadre {
  /** L'identifiant du cadre (`arrival`, `settings`…) : les tests et les outils le visent. */
  id: string;
  /** Le nom de l'écran pour les lecteurs d'écran : une clé du catalogue. */
  titreAria: string;
  /** Le retour de la barre : `portail` (« ‹ DU JOUR », lien vers le portail) ou `jeu` (« ‹ JUMP », un bouton qui appelle `onRetour` : ferme l'écran). */
  retour: "portail" | "jeu";
  onRetour?: () => void;
  /** Au-dessus des autres écrans (réglages ouverts depuis la pause ou l'accueil). */
  haut?: boolean;
}

/**
 * Un écran **dans le jeu** (lot I5, retour de Nathan ; règle de la charte rév. 8 § 9) : posé sur la scène sous le voile à rayures, la barre des jeux en plaque
 * crème, l'étiquette jaune dans sa coque moutarde, caché au départ. Lot I4b : le cadre est celui de @cdj/ui (`creerCadre`, cadre.css), commun avec Track.
 */
export function creerCadre(o: OptionsCadre): Cadre {
  const cadre = cadreDuSocle({
    id: o.id,
    haut: o.haut,
    etiquette: "etiquette",
    aria: () => t(o.titreAria),
    barre: () => barreDuJour(o.retour === "jeu" ? { retourJeu: () => o.onRetour?.() } : {}),
  });
  // L'étiquette dans la coque moutarde (stries de préhension), comme à l'accueil.
  cadre.defile.prepend(el("div", { classe: "coque" }, el("div", { classe: "coque__stries", attrs: { "aria-hidden": "true" } }), cadre.etiquette));
  barres.add(cadre.majBarre);
  onLangue(cadre.majBarre);
  return cadre;
}
