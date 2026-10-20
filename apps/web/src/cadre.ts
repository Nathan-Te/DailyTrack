import { barreJeu, el } from "@cdj/ui";
import { onLangue, t, traducteurDuSocle } from "./i18n";

// Le cadre crème de Du Jour autour de l'étiquette Track (lot I4, charte § 1 et § 9) : la barre des jeux (`barreJeu` de @cdj/ui), puis l'étiquette
// asphalte (`.etiquette`, interface.css) dont le contenu défile. Tous les écrans hors partie (accueil, arrivée, archives, réglages, aide, classement,
// Salon, podium) sont bâtis ainsi, pour se ressembler : `creerCadre()` rend le cadre, sa barre et le corps de l'étiquette ; la barre se redessine
// d'elle-même au changement de langue et quand le jour du jeu change (`definirJour`).

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
  /** Au-dessus des autres cadres (réglages et aide ouverts depuis un autre écran). */
  haut?: boolean;
}

export interface Cadre {
  racine: HTMLElement;
  /** L'étiquette asphalte. */
  etiquette: HTMLElement;
  /** Le contenu défilant de l'étiquette : l'écran y pose ses éléments. */
  corps: HTMLElement;
  /** Redessine la barre (langue, jour). Appelé tout seul. */
  majBarre(): void;
}

export function creerCadre(o: OptionsCadre): Cadre {
  const racine = o.racine ?? el("div");
  if (o.id) racine.id = o.id;
  racine.classList.add("cadre");
  if (o.haut) racine.classList.add("cadre--haut");
  racine.setAttribute("role", "dialog");
  racine.setAttribute("aria-modal", "true");
  const corps = el("div", { classe: "etiquette__corps" });
  const etiquette = el("main", { classe: ["etiquette", "dj-sombre"] }, corps);
  let barre: HTMLElement | null = null;
  const majBarre = () => {
    racine.setAttribute("aria-label", t(o.titreAria));
    const traducteur = traducteurDuSocle();
    const nouvelle = barreJeu(traducteur, {
      href: "../",
      jour: jourDuJeu.jour,
      numero: jourDuJeu.numero,
      ...(o.retour === "jeu" ? { retour: { texte: t("jeu.track.titre"), ariaLabel: t("cadre.retourTrack"), onClick: () => o.onRetour?.() } } : {}),
    });
    if (barre) barre.replaceWith(nouvelle);
    else racine.prepend(nouvelle);
    barre = nouvelle;
  };
  majBarre();
  racine.append(etiquette);
  barres.add(majBarre);
  onLangue(majBarre);
  return { racine, etiquette, corps, majBarre };
}
