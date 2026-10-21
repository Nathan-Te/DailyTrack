import { barreJeu, el } from "@cdj/ui";
import { onLangue, t, traducteurDuSocle } from "./i18n";

// Le cadre crème de Du Jour autour de l'étiquette jaune de Jump (lot I5, charte § 1 et § 9 ; patron de Track : apps/web/src/cadre.ts) : la barre des
// jeux (`barreJeu` de @cdj/ui : « ‹ DU JOUR » vers le portail, ou « ‹ JUMP » qui ferme l'écran), puis l'étiquette jaune (`.etiquette`, interface.css),
// dont le corps défile. Les écrans de **sortie de partie** et de **Du Jour** sont bâtis ainsi (arrivée, classement du jour, archives, réglages) ; ceux
// **pendant la partie** (pause, « Comment jouer », carnage) sont posés sur la scène, et l'accueil aussi (sous le voile à rayures, `home.ts`). La barre
// se redessine d'elle-même au changement de langue et quand le jour du jeu est connu (`definirJour`).

/** Le jour du jeu pour la barre : le numéro de jour civil (Paris, `@cdj/clock`) et le numéro du niveau (absent avant le premier). */
let jourDuJeu = { jour: 0, numero: undefined as number | undefined };
const barres = new Set<() => void>();

/** À appeler une fois au démarrage : la date et le numéro que montrent les barres. */
export function definirJour(jour: number, numero?: number): void {
  jourDuJeu = { jour, numero: numero !== undefined && numero >= 1 ? numero : undefined };
  for (const maj of barres) maj();
}

/** La barre des jeux telle qu'elle est aujourd'hui (l'accueil la pose dans une plaque crème sur la scène). */
export function barreDuJour(o: { retourJeu?: () => void } = {}): HTMLElement {
  return barreJeu(traducteurDuSocle(), {
    href: "../",
    jour: jourDuJeu.jour,
    numero: jourDuJeu.numero,
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

export interface Cadre {
  racine: HTMLElement;
  /** L'étiquette jaune. */
  etiquette: HTMLElement;
  /** Le contenu défilant de l'étiquette : l'écran y pose ses éléments. */
  corps: HTMLElement;
  /** Sous l'étiquette, dans le cadre (« Il te reste aujourd'hui » de l'arrivée). */
  pied: HTMLElement;
}

/** Un cadre crème plein écran, caché au départ ; `document.body` le reçoit. */
export function creerCadre(o: OptionsCadre): Cadre {
  const racine = el("div", { classe: ["cadre", o.haut && "cadre--haut"], attrs: { id: o.id, role: "dialog", "aria-modal": "true", hidden: true } });
  const corps = el("div", { classe: "etiquette__corps" });
  const etiquette = el("main", { classe: "etiquette" }, corps);
  const pied = el("div", { classe: "cadre__pied" });
  const defile = el("div", { classe: "cadre__defile" }, etiquette, pied);
  let barre: HTMLElement | null = null;
  const majBarre = () => {
    racine.setAttribute("aria-label", t(o.titreAria));
    const nouvelle = barreDuJour(o.retour === "jeu" ? { retourJeu: () => o.onRetour?.() } : {});
    if (barre) barre.replaceWith(nouvelle);
    else racine.prepend(nouvelle);
    barre = nouvelle;
  };
  majBarre();
  racine.append(defile);
  barres.add(majBarre);
  onLangue(majBarre);
  document.body.append(racine);
  return { racine, etiquette, corps, pied };
}
