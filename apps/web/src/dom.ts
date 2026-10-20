// Petits outils de DOM de l'interface (lot 29, repris au lot I4) : une seule manière de fabriquer les boutons, les choix et les curseurs de l'accueil, de la
// pause, des réglages et de l'aide, pour qu'ils se ressemblent. Les classes sont celles de la charte (`dj-bouton` du socle `@cdj/ui`, `segment`, `curseur`,
// `reglage` : interface.css et reglages.css). Les textes passés ici sont **déjà traduits** (`t()`, i18n.ts) ; un texte qui doit suivre la langue sans que
// l'écran se redessine passe par `lier()` (i18n.ts).

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

/**
 * Bouton (jamais de soumission de formulaire). `cls` : `primary` = le bouton principal de Track (livrée, « Courir ») ; `link` = un lien discret souligné ;
 * `tete` = un secondaire en Barlow Condensed ; sans rien = un bouton secondaire (contour). Les autres mots deviennent des classes. Le focus est rendu après
 * le clic : la touche Entrée (« rejouer ») ne le redéclenche pas.
 */
export function button(label: string, cls = "", onClick?: (b: HTMLButtonElement) => void | Promise<void>): HTMLButtonElement {
  const mots = cls.split(/\s+/).filter(Boolean);
  const base = mots.includes("primary") ? "dj-bouton dj-bouton--track" : mots.includes("link") ? "lien" : "dj-bouton dj-bouton--secondaire";
  const b = el("button", [base, ...mots.filter((m) => m !== "primary" && m !== "link").map((m) => (m === "tete" ? "bouton--tete" : m))].join(" "), label);
  b.type = "button";
  if (onClick) {
    b.addEventListener("click", async () => {
      b.blur();
      await onClick(b);
    });
  }
  return b;
}

/** Texte d'un bouton changé un instant (« Copié »), puis rétabli. */
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
  const box = el("div", "segment");
  box.setAttribute("role", "radiogroup");
  if (label) box.setAttribute("aria-label", label);
  const buttons = options.map(([value, text]) => {
    const b = el("button", "segment__bouton", text);
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
      b.setAttribute("aria-checked", String(v === current()));
    });
  return { box, sync };
}

/** Curseur avec sa valeur à droite. */
export function slider(range: { min: number; max: number; step: number }, get: () => number, set: (v: number) => void, format: (v: number) => string, label = ""): Control {
  const box = el("div", "curseur");
  const input = el("input");
  input.type = "range";
  input.min = String(range.min);
  input.max = String(range.max);
  input.step = String(range.step);
  if (label) input.setAttribute("aria-label", label);
  const value = el("span", "curseur__valeur");
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
  const r = el("div", "reglage");
  const text = el("div", "reglage__nom");
  text.append(el("div", "reglage__titre", label));
  if (hint) text.append(el("div", "reglage__aide", hint));
  r.append(text, control);
  return r;
}
