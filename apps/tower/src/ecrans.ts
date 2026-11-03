import "./ecrans.css";
import { creerEcran as creerEcranKit, type Ecran } from "@cdj/kit/ecrans";
import type { TraducteurCommun } from "@cdj/ui";
import { langueCourante, t, traducteurDuSocle } from "./i18n";

// Les écrans « dans le jeu » de Tower (lot T7) : Réglages et Archives, sur le modèle de ceux de Jump (`jump-reglages.html`, `jump-classement.html`) — la barre des jeux en plaque crème avec « ‹ TOWER » qui
// ferme l'écran, puis l'étiquette de Tower dans sa coque, sur le voile à rayures. **Un module à la demande** (rien au premier chargement) : l'accueil et la pause l'ouvrent. **Lot K3 : le cadre est celui de
// `@cdj/kit/ecrans`** (commun aux jeux : Échap, focus, barre) ; il ne reste ici que ce qui est propre à Tower — son habillage (`ecrans.css`, `etiquette-tower`), son nom et ses textes.

export type { Ecran };

export interface OptionsEcran {
  /** `reglages`, `archives` : les tests et la manette le visent (`#<id>-ecran`). */
  id: string;
  /** La clé de catalogue du nom de l'écran (lecteurs d'écran). */
  aria: string;
  /** Le jour et le numéro de la tour que montre la barre. */
  jour(): { jour: number; numero: number | null };
  surOuverture?(): void;
  surFermeture?(): void;
}

const communs = (): TraducteurCommun => traducteurDuSocle() as unknown as TraducteurCommun;

export const creerEcran = (racine: HTMLElement, o: OptionsEcran): Ecran =>
  creerEcranKit(racine, {
    id: o.id,
    aria: () => t(o.aria),
    jour: o.jour,
    retour: () => ({ texte: t("accueil.titre").toLocaleUpperCase(langueCourante()), ariaLabel: t("ecran.retour") }),
    classeEtiquette: "etiquette-tower etiquette-tower--ecran",
    traducteur: communs,
    surOuverture: o.surOuverture,
    surFermeture: o.surFermeture,
  });
