import "./ecrans.css";
import { barreJeu, el, suivreDialogue, type TraducteurCommun } from "@cdj/ui";
import { langueCourante, t, traducteurDuSocle } from "./i18n";

// Les écrans « dans le jeu » de Tower (lot T7) : Réglages et Archives, sur le modèle de ceux de Jump (`jump-reglages.html`, `jump-classement.html`) — la barre des jeux en plaque crème avec
// « ‹ TOWER » qui ferme l'écran, puis l'étiquette de Tower dans sa coque, sur le voile à rayures. **Un module à la demande** (rien au premier chargement) : l'accueil et la pause l'ouvrent. Échap
// ferme l'écran (sauf pendant la capture d'une touche : `data-capture`, lot M2). Un `role="dialog"` nommé, le focus entre et revient (`suivreDialogue`).

export interface Ecran {
  readonly ouvert: boolean;
  /** Le corps de l'étiquette : l'écran y pose ses sections. */
  readonly corps: HTMLElement;
  readonly voile: HTMLElement;
  ouvrir(): void;
  fermer(): void;
  /** Redessine la barre (le jour change) et le nom de l'écran. */
  majBarre(): void;
}

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

export function creerEcran(racine: HTMLElement, o: OptionsEcran): Ecran {
  // Le dialogue est le voile (la barre « ‹ TOWER » est dedans) : à la manette, B active ce retour.
  const voile = el("div", { classe: "voile voile--ecran", attrs: { id: `${o.id}-ecran`, role: "dialog", "aria-modal": "true", hidden: true } });
  const barre = el("div", { classe: "ecran__barre" });
  const corps = el("div", { classe: "ecran__corps" });
  const coque = el("main", { classe: "coque coque--ecran" }, el("div", { classe: "coque__stries", attrs: { "aria-hidden": "true" } }), el("div", { classe: "etiquette-tower etiquette-tower--ecran" }, corps));
  voile.append(el("div", { classe: "ecran__colonne" }, barre, coque));
  racine.append(voile);
  let ouvert = false;
  const majBarre = (): void => {
    const { jour, numero } = o.jour();
    voile.setAttribute("aria-label", t(o.aria));
    barre.replaceChildren(barreJeu(communs(), { href: "../", jour, ...(numero !== null ? { numero } : {}), retour: { texte: t("accueil.titre").toLocaleUpperCase(langueCourante()), ariaLabel: t("ecran.retour"), onClick: () => fermer() } }));
  };
  function fermer(): void {
    if (!ouvert) return;
    ouvert = false;
    voile.hidden = true;
    o.surFermeture?.();
  }
  suivreDialogue(voile, { focusInitial: () => barre.querySelector<HTMLElement>(".dj-barre-jeu__retour") });
  // Échap ferme l'écran, avant la pause et l'accueil qui sont dessous.
  window.addEventListener(
    "keydown",
    (e) => {
      if (e.code !== "Escape" || !ouvert || document.documentElement.dataset.capture) return;
      fermer();
      e.stopImmediatePropagation();
    },
    { capture: true },
  );
  return {
    get ouvert() {
      return ouvert;
    },
    corps,
    voile,
    majBarre,
    ouvrir() {
      if (ouvert) return;
      ouvert = true;
      majBarre();
      voile.hidden = false;
      voile.scrollTop = 0;
      o.surOuverture?.();
    },
    fermer,
  };
}
