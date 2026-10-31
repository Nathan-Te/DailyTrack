import { type Annonce, type OuAnnonce, surveillerAnnonce, texteDeAnnonce } from "@cdj/profile";
import { bandeauAnnonce, el, type TraducteurCommun, visibiliteDeLaPage } from "@cdj/ui";
import { langueCourante, traducteurDuSocle } from "./i18n";

// Le message en direct de Tower (lot T4) : le composant commun (`bandeauAnnonce` de `@cdj/ui`, la surveillance de `@cdj/profile`), posé sur l'accueil et sur l'arrivée — jamais pendant une
// partie. Aux couleurs de Tower (`accueil.css`, `.message-direct__bandeau`). Il ne prend **jamais le focus** (`role="status"`). Le texte est une donnée : `textContent`, jamais du HTML.
// Lot TP : Tower a sa destination propre, `tower` (`OuAnnonce` de `@cdj/profile`, la table `annonces`, la case « Tower » du panneau d'administration).
export const OU_TOWER: OuAnnonce = "tower";

export type EcranMessage = "accueil" | "arrivee";

export interface MessageDirect {
  /** L'écran du moment (`null` : une partie commence, plus rien ne s'affiche ni ne se lit). */
  montrer(ecran: EcranMessage | null): void;
}

/** Le traducteur du socle, relu à chaque appel : le bandeau garde ses libellés (« Important », « Fermer ») dans la langue courante. */
const traducteurVivant = (): TraducteurCommun => ({ get langue() { return traducteurDuSocle().langue; }, t: (cle: never, params?: never) => traducteurDuSocle().t(cle, params) }) as unknown as TraducteurCommun;

/** `base` : l'adresse de l'API ; `hotes` : l'emplacement de chaque écran (vide, il n'occupe aucune place). */
export function monterMessage(o: { base: string; stockage: Pick<Storage, "getItem" | "setItem"> | null; hotes: Record<EcranMessage, HTMLElement> }): MessageDirect {
  let ecran: EcranMessage | null = null;
  let annonce: Annonce | null = null;
  let bandeau: HTMLElement | null = null;
  let dessine: number | null = null;
  const retirer = (): void => {
    bandeau?.remove();
    bandeau = null;
    dessine = null;
  };
  const rendre = (): void => {
    if (ecran === null || annonce === null) return retirer();
    if (!bandeau || dessine !== annonce.id) {
      retirer();
      bandeau = bandeauAnnonce(traducteurVivant(), { texte: texteDeAnnonce(annonce, langueCourante()), ton: annonce.ton, classe: "message-direct__bandeau", onFermer: () => surveillance.fermer() });
      dessine = annonce.id;
    }
    const hote = o.hotes[ecran];
    if (bandeau.parentElement !== hote) hote.append(bandeau);
  };
  const surveillance = surveillerAnnonce({
    base: o.base,
    ou: OU_TOWER,
    stockage: o.stockage,
    surChangement: (a) => {
      annonce = a;
      rendre();
    },
    ...visibiliteDeLaPage(),
  });
  return {
    montrer(suivant) {
      if (suivant === ecran) return;
      ecran = suivant;
      if (suivant === null) surveillance.suspendre();
      else surveillance.activer();
      rendre();
    },
  };
}

/** Un emplacement vide pour le bandeau (aucune place tant qu'il n'y a rien). */
export const hoteMessage = (): HTMLElement => el("div", { classe: "message-direct" });
