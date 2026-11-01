// Classement en course (lot 29, plaque asphalte au lot I4) : un petit panneau dans un coin, affiché par défaut, qu'on replie d'un geste (bouton de l'en-tête,
// touche L). L'état « replié » est mémorisé (réglage `board`, voir settings.ts). Le panneau ne reçoit les appuis que par son en-tête : le reste laisse
// passer les doigts (la moitié gauche de l'écran tactile sert à diriger).
import { icone } from "@cdj/ui";
import { el } from "./dom";
import { onLangue, t } from "./i18n";

export interface BoardPanel {
  root: HTMLElement;
  /** Titre dans l'en-tête (le nombre de pilotes, la session…), déjà traduit par l'appelant ; sans titre, « Classement ». */
  setTitle(text: string): void;
  /** Contenu (lignes du classement). */
  body: HTMLElement;
  folded(): boolean;
  /** Replie ou déplie ; `notify` : prévenir l'appelant (mémoriser le choix). */
  setFolded(folded: boolean, notify?: boolean): void;
}

export function mountBoardPanel(root: HTMLElement, onToggle: (folded: boolean) => void): BoardPanel {
  root.classList.add("plaque", "classement-coin");
  const head = el("button", "bhead");
  head.type = "button";
  const title = el("span", "btitle");
  const caret = el("span", "caret");
  caret.append(icone("chevron", { taille: 16 }));
  head.append(title, caret);
  const body = el("div", "bbody");
  root.replaceChildren(head, body);
  let isFolded = false;
  let customTitle = "";
  // Le nom du bouton est son texte visible (axe, `label-content-name-mismatch` : un nom qui ne contient pas le texte affiché est refusé) ; l'action
  // (replier / déplier) est sa description (infobulle) et l'état est dans `aria-expanded`.
  const label = () => {
    const shown = customTitle || t("palmares.court");
    title.textContent = shown;
    head.title = t(isFolded ? "palmares.deplier" : "palmares.replier");
  };
  const panel: BoardPanel = {
    root,
    body,
    setTitle(text) {
      customTitle = text;
      label();
    },
    folded: () => isFolded,
    setFolded(folded, notify = false) {
      isFolded = folded;
      root.classList.toggle("folded", folded);
      head.setAttribute("aria-expanded", String(!folded));
      label();
      if (notify) onToggle(folded);
    },
  };
  head.addEventListener("click", () => {
    head.blur();
    panel.setFolded(!isFolded, true);
  });
  panel.setFolded(false);
  onLangue(label);
  return panel;
}
