// Petits outils de DOM de l'interface (lot 29) : une seule manière de fabriquer les boutons, les choix et les curseurs de l'accueil, de la
// pause, des réglages et de l'aide, pour qu'ils se ressemblent (voir ui.css : `.btn`, `.seg`, `.slider`, `.panel`).

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/** Bouton (jamais de soumission de formulaire). Le focus est rendu après le clic : la touche Entrée (« rejouer ») ne le redéclenche pas. */
export function button(label: string, cls = "", onClick?: (b: HTMLButtonElement) => void | Promise<void>): HTMLButtonElement {
  const b = el("button", `btn ${cls}`.trim(), label);
  b.type = "button";
  if (onClick) {
    b.addEventListener("click", async () => {
      b.blur();
      await onClick(b);
    });
  }
  return b;
}

/** Texte d'un bouton changé un instant (« Copié ✓ »), puis rétabli. */
export function flashLabel(b: HTMLButtonElement, text: string, ms = 1600): void {
  const old = b.dataset.label ?? b.textContent ?? "";
  b.dataset.label = old;
  b.textContent = text;
  setTimeout(() => {
    b.textContent = old;
    delete b.dataset.label;
  }, ms);
}

export interface Control {
  /** Élément à insérer. */
  box: HTMLElement;
  /** Relit la valeur courante (à l'ouverture d'un panneau, ou après un changement venu d'ailleurs). */
  sync(): void;
}

/** Choix exclusif en boutons côte à côte (segmenté). */
export function segmented<T extends string | boolean | number>(options: readonly (readonly [T, string])[], current: () => T, set: (v: T) => void, label = ""): Control {
  const box = el("div", "seg");
  box.setAttribute("role", "radiogroup");
  if (label) box.setAttribute("aria-label", label);
  const buttons = options.map(([value, text]) => {
    const b = el("button", "", text);
    b.type = "button";
    b.setAttribute("role", "radio");
    b.addEventListener("click", () => {
      b.blur();
      set(value);
    });
    box.append(b);
    return [value, b] as const;
  });
  const sync = () =>
    buttons.forEach(([v, b]) => {
      const on = v === current();
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", String(on));
    });
  return { box, sync };
}

/** Curseur avec sa valeur à droite. */
export function slider(range: { min: number; max: number; step: number }, get: () => number, set: (v: number) => void, format: (v: number) => string, label = ""): Control {
  const box = el("div", "slider");
  const input = el("input");
  input.type = "range";
  input.min = String(range.min);
  input.max = String(range.max);
  input.step = String(range.step);
  if (label) input.setAttribute("aria-label", label);
  const value = el("span", "value");
  input.addEventListener("input", () => set(Number(input.value)));
  input.addEventListener("change", () => input.blur());
  box.append(input, value);
  return {
    box,
    sync() {
      input.value = String(get());
      value.textContent = format(get());
    },
  };
}

/** Une ligne de réglage : intitulé (et explication facultative) à gauche, commande à droite. */
export function row(label: string, control: HTMLElement, hint = ""): HTMLElement {
  const r = el("div", "setrow");
  const text = el("div", "what");
  text.append(el("div", "label", label));
  if (hint) text.append(el("div", "hint", hint));
  r.append(text, control);
  return r;
}

/** Fenêtre centrée sur un fond sombre : cliquer à côté (ou Échap) la ferme. Renvoie le fond et le panneau. */
export function overlay(id: string, title: string, onClose: () => void): { root: HTMLElement; panel: HTMLElement; body: HTMLElement } {
  const root = el("div", "overlay");
  root.id = id;
  root.hidden = true;
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", title);
  const panel = el("div", "panel");
  const head = el("div", "head");
  const close = button("✕", "icon");
  close.setAttribute("aria-label", "Fermer");
  close.addEventListener("click", onClose);
  head.append(el("h2", "title", title), close);
  const body = el("div", "body");
  panel.append(head, body);
  root.append(panel);
  root.addEventListener("click", (e) => {
    if (e.target === root) onClose();
  });
  return { root, panel, body };
}
