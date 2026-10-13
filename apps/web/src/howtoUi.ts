// Fenêtre « Comment jouer » (lot 29) : une page courte et visuelle. Les commandes de l'appareil en cours d'abord (clavier ou doigts), les
// autres repliées ; les idées à retenir en dessous. Montrée à la première visite, puis accessible depuis l'accueil, la pause et les réglages.
import { button, el, overlay } from "./dom";
import { GAMEPAD_CONTROLS, KEYBOARD_CONTROLS, TIPS, TOUCH_CONTROLS, type Control, type Device } from "./howto";

export interface HowtoUi {
  /** Ouvre l'aide ; `onClose` est appelé une fois, à la fermeture (l'accueil enchaîne alors sur la course). */
  open(onClose?: () => void): void;
  close(): void;
  isOpen(): boolean;
}

function controlsTable(list: Control[]): HTMLElement {
  const t = el("div", "controls");
  for (const c of list) {
    const r = el("div", "ctl");
    const keys = el("span", "keys");
    c.keys.forEach((k, i) => {
      if (i > 0) keys.append(el("span", "or", "·"));
      keys.append(el("kbd", "", k));
    });
    r.append(keys, el("span", "does", c.does));
    t.append(r);
  }
  return t;
}

/** Schéma de l'écran tactile : où poser les doigts (pas de bitmap : des boîtes CSS, toujours nettes). */
function touchDiagram(): HTMLElement {
  const d = el("div", "tdiagram");
  d.setAttribute("aria-hidden", "true");
  const left = el("div", "zone left");
  left.append(el("b", "", "Tourner"), el("span", "", "glisse le pouce"));
  const brake = el("div", "zone brake");
  brake.append(el("b", "", "Frein"));
  const gas = el("div", "zone gas");
  gas.append(el("b", "", "Gaz"));
  d.append(left, brake, gas);
  return d;
}

export function mountHowto(root: HTMLElement, device: Device, hooks: { onSeen?: () => void } = {}): HowtoUi {
  let onClose: (() => void) | undefined;
  const close = () => {
    if (ov.root.hidden) return;
    ov.root.hidden = true;
    const f = onClose;
    onClose = undefined;
    hooks.onSeen?.();
    f?.();
  };
  const ov = overlay("howto", "Comment jouer", close);
  ov.root.classList.add("howto");

  function touchDiagramAndTable(): HTMLElement {
    const box = el("div");
    box.append(touchDiagram(), controlsTable(TOUCH_CONTROLS));
    return box;
  }
  const section = (title: string, content: HTMLElement, open: boolean) => {
    const d = el("details", "dev");
    d.open = open;
    d.append(el("summary", "", title), content);
    return d;
  };
  const drive = el("section", "drive");
  drive.append(el("h3", "", "Conduire"));
  if (device === "touch") {
    drive.append(section("Avec les doigts", touchDiagramAndTable(), true), section("Au clavier", controlsTable(KEYBOARD_CONTROLS), false), section("À la manette", controlsTable(GAMEPAD_CONTROLS), false));
  } else {
    drive.append(section("Au clavier", controlsTable(KEYBOARD_CONTROLS), true), section("À la manette", controlsTable(GAMEPAD_CONTROLS), false), section("Avec les doigts (téléphone, tablette)", touchDiagramAndTable(), false));
  }

  const tips = el("section", "tips");
  for (const t of TIPS) {
    const c = el("div", "tip");
    c.append(el("div", "icon", t.icon));
    const text = el("div", "text");
    text.append(el("h4", "", t.title), el("p", "", t.text));
    c.append(text);
    tips.append(c);
  }
  const done = button("J'ai compris", "primary big");
  done.id = "howto-done";
  done.addEventListener("click", close);
  const actions = el("div", "actions end");
  actions.append(done);
  ov.body.append(tips, drive, actions);
  root.append(ov.root);

  return {
    open(cb) {
      onClose = cb;
      ov.root.hidden = false;
      ov.body.scrollTop = 0;
      done.focus({ preventScroll: true });
    },
    close,
    isOpen: () => !ov.root.hidden,
  };
}
