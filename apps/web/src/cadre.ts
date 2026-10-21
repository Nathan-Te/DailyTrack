import { barreJeu, creerCadre as cadreDuSocle, type Cadre } from "@cdj/ui";
import { onLangue, t, traducteurDuSocle } from "./i18n";

export type { Cadre };

// Les écrans hors partie de Track (lot I4, **lot I4b : tous posés sur la scène**, charte rév. 8 § 9 — « quand on entre dans un jeu, on y reste ») :
// le cadre commun de @cdj/ui (`creerCadre`, cadre.css : voile à rayures sur la scène, barre des jeux en plaque crème, l'étiquette asphalte et, dessous, le
// pied), avec la barre de Track (« ‹ DU JOUR » vers le portail, ou « ‹ TRACK » qui ferme l'écran) et l'étiquette asphalte (`.etiquette`, interface.css).
// Accueil, arrivée (jour, Salon, rediffusion), podium, archives, classement, réglages ; la pause et « Comment jouer » sont des dialogues sur le voile.
// La barre se redessine d'elle-même au changement de langue et quand le jour du jeu change (`definirJour`).

/** Le jour du jeu pour la barre : le numéro de jour civil (Paris, `@cdj/clock`) et le numéro du circuit (absent avant le premier). */
let jourDuJeu = { jour: 0, numero: undefined as number | undefined };
const barres = new Set<() => void>();

/** À appeler une fois au démarrage (et à chaque nouveau jour) : la date et le numéro que montrent les barres. */
export function definirJour(jour: number, numero?: number): void {
  jourDuJeu = { jour, numero: numero !== undefined && numero >= 1 ? numero : undefined };
  for (const maj of barres) maj();
}

export interface OptionsCadre {
  /** L'identifiant du cadre (`home`, `finish`…) : les tests et les outils le visent. Absent : le jeu a déjà posé l'élément `racine`. */
  id?: string;
  /** Le cadre déjà dans la page (`#home`…) ; sinon un nouvel élément est créé. */
  racine?: HTMLElement;
  /** Le nom de l'écran pour les lecteurs d'écran : une clé du catalogue. */
  titreAria: string;
  /**
   * Le retour de la barre : `portail` (« ‹ DU JOUR », lien vers le portail) ou `jeu` (« ‹ TRACK », un bouton qui appelle `onRetour` : ferme l'écran).
   */
  retour: "portail" | "jeu";
  onRetour?: () => void;
  /** Un sous-écran (archives, classement, réglages) : au-dessus des autres, qui s'effacent tant qu'il est ouvert (un seul voile). */
  haut?: boolean;
  /** Lot I7 : le bouton plein écran dans la barre des jeux (l'accueil seulement : on se met en plein écran avant de jouer). */
  pleinEcran?: boolean;
}

const existants = new WeakMap<HTMLElement, Cadre>();

/** Le cadre d'un élément : créé la première fois, le même ensuite (l'arrivée du jour et celle du Salon partagent `#finish`). */
export function creerCadre(o: OptionsCadre): Cadre {
  const deja = o.racine && existants.get(o.racine);
  if (deja) return deja;
  const cadre = cadreDuSocle({
    racine: o.racine,
    id: o.id,
    haut: o.haut,
    etiquette: "etiquette dj-sombre",
    aria: () => t(o.titreAria),
    barre: () =>
      barreJeu(traducteurDuSocle(), {
        href: "../",
        jour: jourDuJeu.jour,
        numero: jourDuJeu.numero,
        pleinEcran: o.pleinEcran,
        ...(o.retour === "jeu" ? { retour: { texte: t("jeu.track.titre"), ariaLabel: t("cadre.retourTrack"), onClick: () => o.onRetour?.() } } : {}),
      }),
  });
  barres.add(cadre.majBarre);
  onLangue(cadre.majBarre);
  existants.set(cadre.racine, cadre);
  return cadre;
}
