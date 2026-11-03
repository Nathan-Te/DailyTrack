import { barreJeu, el, suivreDialogue, type TraducteurCommun } from "@cdj/ui";

// Le cadre des écrans « dans le jeu » (lot K3 ; avant : `ecrans.ts` de Tower, lot T7), sur le modèle de ceux de Jump : la barre des jeux en plaque crème avec « ‹ <JEU> » qui ferme l'écran, puis
// l'étiquette du jeu dans sa coque, sur le voile à rayures. **Un module à la demande** (rien au premier chargement). Échap ferme l'écran (sauf pendant la capture d'une touche : `data-capture`,
// lot M2). Un `role="dialog"` nommé, le focus entre et revient (`suivreDialogue`). L'habillage (les classes `etiquette-<jeu>`, la feuille du cadre) reste à la feuille du jeu.

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
  /** Le nom de l'écran pour les lecteurs d'écran (déjà dans la langue). */
  aria(): string;
  /** Le jour et le numéro que montre la barre. */
  jour(): { jour: number; numero: number | null };
  /** Le texte du retour (« TOWER ») et son nom lu, déjà dans la langue. */
  retour(): { texte: string; ariaLabel: string };
  /** La classe de l'étiquette du jeu (`etiquette-tower etiquette-tower--ecran`). */
  classeEtiquette: string;
  /** Le traducteur du socle du jeu. */
  traducteur(): TraducteurCommun;
  surOuverture?(): void;
  surFermeture?(): void;
}

export function creerEcran(racine: HTMLElement, o: OptionsEcran): Ecran {
  // Le dialogue est le voile (la barre est dedans) : à la manette, B active ce retour.
  const voile = el("div", { classe: "voile voile--ecran", attrs: { id: `${o.id}-ecran`, role: "dialog", "aria-modal": "true", hidden: true } });
  const barre = el("div", { classe: "ecran__barre" });
  const corps = el("div", { classe: "ecran__corps" });
  const coque = el("main", { classe: "coque coque--ecran" }, el("div", { classe: "coque__stries", attrs: { "aria-hidden": "true" } }), el("div", { classe: o.classeEtiquette }, corps));
  voile.append(el("div", { classe: "ecran__colonne" }, barre, coque));
  racine.append(voile);
  let ouvert = false;
  const majBarre = (): void => {
    const { jour, numero } = o.jour();
    const r = o.retour();
    voile.setAttribute("aria-label", o.aria());
    barre.replaceChildren(barreJeu(o.traducteur(), { href: "../", jour, ...(numero !== null ? { numero } : {}), retour: { texte: r.texte, ariaLabel: r.ariaLabel, onClick: () => fermer() } }));
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
