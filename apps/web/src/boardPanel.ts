// Classement en course (lot 29) : un petit panneau dans un coin, affiché par défaut, qu'on replie d'un geste (bouton de l'en-tête, touche L).
// L'état « replié » est mémorisé (réglage `board`, voir settings.ts). Le panneau ne reçoit les appuis que par son en-tête : le reste laisse
// passer les doigts (la moitié gauche de l'écran tactile sert à diriger).
import { el } from "./dom";

export interface BoardPanel {
  root: HTMLElement;
  /** Titre dans l'en-tête (le nombre de pilotes, la session…). */
  setTitle(text: string): void;
  /** Contenu (lignes du classement). */
  body: HTMLElement;
  folded(): boolean;
  /** Replie ou déplie ; `notify` : prévenir l'appelant (mémoriser le choix). */
  setFolded(folded: boolean, notify?: boolean): void;
}

export function mountBoardPanel(root: HTMLElement, onToggle: (folded: boolean) => void): BoardPanel {
  const head = el("button", "bhead");
  head.type = "button";
  const title = el("span", "btitle", "Classement");
  const caret = el("span", "caret", "▾");
  head.append(title, caret);
  const body = el("div", "bbody");
  root.replaceChildren(head, body);
  let isFolded = false;
  const panel: BoardPanel = {
    root,
    body,
    setTitle(text) {
      title.textContent = text;
      head.title = text;
    },
    folded: () => isFolded,
    setFolded(folded, notify = false) {
      isFolded = folded;
      root.classList.toggle("folded", folded);
      caret.textContent = folded ? "▸" : "▾";
      head.setAttribute("aria-expanded", String(!folded));
      head.setAttribute("aria-label", `${folded ? "Déplier" : "Replier"} le classement`);
      if (notify) onToggle(folded);
    },
  };
  head.addEventListener("click", () => {
    head.blur();
    panel.setFolded(!isFolded, true);
  });
  panel.setFolded(false);
  return panel;
}
