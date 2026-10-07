import { isTyping } from "./input";
import {
  DEADZONE_RANGE,
  DEFAULT_TOUCH_SETTINGS,
  SENSITIVITY_RANGE,
  saveTouchSettings,
  type TouchPad,
  type TouchSettings,
} from "./touch";

// Interface tactile (lot 10) : zones de jeu, aides à l'écran, boutons d'action, réglages, invitation à tourner
// le téléphone, plein écran. Toute la logique des doigts est dans `touch.ts` ; ici, seulement du DOM.
// Les conteneurs (`#touch`, `#tbar`, `#tsettings`, `#rotate`) sont dans `index.html`, cachés tant que la page n'est
// pas en mode tactile (`body.touch`).

export interface TouchHooks {
  onPause(): void;
  onRespawn(): void;
  onRestart(): void;
}

export interface TouchUi {
  /** La fenêtre des réglages est ouverte (le jeu se met alors en pause). */
  settingsOpen(): boolean;
  /** Montre l'état de pause sur le bouton. */
  setPaused(paused: boolean): void;
  /** Redessine les aides (après un changement de réglage, d'écran ou de phase). */
  refresh(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

export function hintText(s: Readonly<TouchSettings>): string {
  const steer = s.steerMode === "drag" ? "Glisse à gauche pour tourner" : "← → à gauche pour tourner";
  const pedals = s.autoThrottle ? "touche à droite pour freiner" : "frein et gaz à droite";
  return `${steer} · ${pedals}`;
}

type FullscreenDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitFullscreenEnabled?: boolean;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FullscreenEl = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const canFullscreen = () => {
  const d = document as FullscreenDoc;
  return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled);
};

async function toggleFullscreen(): Promise<void> {
  const d = document as FullscreenDoc;
  const root = document.documentElement as FullscreenEl;
  try {
    if (d.fullscreenElement || d.webkitFullscreenElement) {
      await (d.exitFullscreen?.() ?? d.webkitExitFullscreen?.());
      return;
    }
    await (root.requestFullscreen?.({ navigationUI: "hide" }) ?? root.webkitRequestFullscreen?.());
    // Android : en plein écran, on peut verrouiller le paysage (ailleurs, refusé : tant pis).
    await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape");
  } catch {
    /* refusé par le navigateur : le jeu reste tel quel */
  }
}

/** Construit l'interface tactile dans les conteneurs de la page et branche les doigts sur `pad`. */
export function mountTouchUi(pad: TouchPad, hooks: TouchHooks): TouchUi {
  const zone = document.getElementById("touch")!;
  const bar = document.getElementById("tbar")!;
  const panel = document.getElementById("tsettings")!;
  const rotate = document.getElementById("rotate")!;

  // --- Aides à l'écran (aucune ne reçoit de toucher : tout passe par `zone`) ------------------------
  const ring = el("div", "ring");
  const knob = el("div", "knob");
  const left = el("div", "tbtn pad steer-left", "◀");
  const right = el("div", "tbtn pad steer-right", "▶");
  const brake = el("div", "tbtn pad pedal-brake", "FREIN");
  const gas = el("div", "tbtn pad pedal-gas", "GAZ");
  const hint = el("div", "hint");
  zone.replaceChildren(ring, knob, left, right, brake, gas, hint);

  const put = (e: HTMLElement, x: number, y: number) => e.style.setProperty("transform", `translate(${x}px, ${y}px) translate(-50%, -50%)`);

  function render() {
    const s = pad.snapshot();
    zone.dataset.mode = pad.settings.steerMode;
    zone.dataset.throttle = pad.settings.autoThrottle ? "auto" : "manual";
    left.classList.toggle("on", s.left);
    right.classList.toggle("on", s.right);
    brake.classList.toggle("on", s.brake);
    gas.classList.toggle("on", s.gas);
    ring.hidden = knob.hidden = !s.drag;
    if (s.drag) {
      put(ring, s.drag.originX, s.drag.originY);
      put(knob, s.drag.x, s.drag.originY);
    }
    hint.textContent = hintText(pad.settings);
    hint.hidden = pad.touched;
  }

  const localX = (e: PointerEvent) => e.clientX - zone.getBoundingClientRect().left;
  zone.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    try {
      zone.setPointerCapture(e.pointerId);
    } catch {
      /* pointeur déjà relâché */
    }
    pad.width = zone.clientWidth;
    pad.down(e.pointerId, localX(e), e.clientY);
    render();
  });
  zone.addEventListener("pointermove", (e) => {
    pad.move(e.pointerId, localX(e), e.clientY);
    render();
  });
  for (const type of ["pointerup", "pointercancel", "lostpointercapture"] as const) {
    zone.addEventListener(type, (e) => {
      pad.up(e.pointerId);
      render();
    });
  }
  // Pas de menu d'appui long, de zoom par pincement (iOS) ni de double-tap.
  const block = (e: Event) => {
    if (!isTyping(e)) e.preventDefault(); // le champ du pseudo garde son menu (copier / coller)
  };
  for (const type of ["contextmenu", "gesturestart", "gesturechange", "dblclick"]) document.addEventListener(type, block);
  window.addEventListener("blur", () => {
    pad.releaseAll();
    render();
  });

  // --- Boutons d'action ---------------------------------------------------------------------------
  const button = (cls: string, label: string, title: string, onClick: () => void) => {
    const b = el("button", cls, label);
    b.type = "button";
    b.title = title;
    b.setAttribute("aria-label", title);
    b.addEventListener("click", () => {
      b.blur();
      onClick();
    });
    return b;
  };
  const pauseBtn = button("pause", "⏸", "Pause", () => hooks.onPause());
  const full = button("full", "⛶", "Plein écran", () => void toggleFullscreen());
  full.hidden = !canFullscreen();
  bar.replaceChildren(
    pauseBtn,
    button("respawn", "↺", "Recommencer au dernier point de contrôle", () => hooks.onRespawn()),
    button("restart", "⟲", "Recommencer depuis le départ", () => hooks.onRestart()),
    button("gear", "⚙", "Réglages des commandes", () => setSettingsOpen(true)),
    full,
  );

  // --- Réglages -----------------------------------------------------------------------------------
  const apply = (patch: Partial<TouchSettings>) => {
    Object.assign(pad.settings, patch);
    saveTouchSettings(pad.settings);
    pad.releaseAll();
    renderSettings();
    render();
  };
  const row = (label: string, ...controls: HTMLElement[]) => {
    const r = el("div", "row");
    r.append(el("span", "label", label), ...controls);
    return r;
  };
  const segmented = <T extends string | boolean>(options: [T, string][], current: () => T, set: (v: T) => void) => {
    const box = el("div", "seg");
    const buttons = options.map(([value, label]) => {
      const b = el("button", "", label);
      b.type = "button";
      b.addEventListener("click", () => {
        b.blur();
        set(value);
      });
      box.append(b);
      return [value, b] as const;
    });
    return { box, sync: () => buttons.forEach(([v, b]) => b.classList.toggle("on", v === current())) };
  };
  const slider = (range: { min: number; max: number; step: number }, get: () => number, set: (v: number) => void, format: (v: number) => string) => {
    const wrap = el("div", "slider");
    const input = el("input");
    input.type = "range";
    input.min = String(range.min);
    input.max = String(range.max);
    input.step = String(range.step);
    const value = el("span", "value");
    input.addEventListener("input", () => set(Number(input.value)));
    input.addEventListener("change", () => input.blur());
    wrap.append(input, value);
    return {
      wrap,
      sync: () => {
        input.value = String(get());
        value.textContent = format(get());
      },
    };
  };

  const steerMode = segmented<TouchSettings["steerMode"]>([["drag", "Glisser"], ["buttons", "Boutons ← →"]], () => pad.settings.steerMode, (v) => apply({ steerMode: v }));
  const sensitivity = slider(SENSITIVITY_RANGE, () => pad.settings.sensitivity, (v) => apply({ sensitivity: v }), (v) => `×${v.toFixed(2)}`);
  const deadzone = slider(DEADZONE_RANGE, () => pad.settings.deadzone, (v) => apply({ deadzone: v }), (v) => `${Math.round(v * 100)} %`);
  const throttle = segmented<boolean>([[true, "Automatique"], [false, "Bouton gaz"]], () => pad.settings.autoThrottle, (v) => apply({ autoThrottle: v }));
  const vibration = segmented<boolean>([[true, "Oui"], [false, "Non"]], () => pad.settings.vibration, (v) => apply({ vibration: v }));
  const reset = el("button", "reset", "Par défaut");
  reset.type = "button";
  reset.addEventListener("click", () => apply({ ...DEFAULT_TOUCH_SETTINGS }));
  const close = el("button", "close", "✕");
  close.type = "button";
  close.setAttribute("aria-label", "Fermer");
  close.addEventListener("click", () => setSettingsOpen(false));

  const head = el("div", "head");
  const tools = el("div", "tools");
  tools.append(reset, close);
  head.append(el("div", "title", "Commandes tactiles"), tools);
  const inner = el("div", "panel");
  inner.append(
    head,
    row("Direction", steerMode.box),
    row("Sensibilité", sensitivity.wrap),
    row("Zone morte", deadzone.wrap),
    row("Accélérateur", throttle.box),
    row("Vibration", vibration.box),
  );
  panel.replaceChildren(inner);
  panel.addEventListener("click", (e) => {
    if (e.target === panel) setSettingsOpen(false);
  });

  function renderSettings() {
    for (const c of [steerMode, sensitivity, deadzone, throttle, vibration]) c.sync();
  }
  function setSettingsOpen(open: boolean) {
    panel.hidden = !open;
    pad.releaseAll();
    renderSettings();
    render();
  }

  // --- Invitation à tourner le téléphone (portrait) ----------------------------------------------
  const card = el("div", "card");
  const dismiss = el("button", "", "Jouer quand même");
  dismiss.type = "button";
  dismiss.addEventListener("click", () => document.body.classList.add("rotate-ok"));
  card.append(el("div", "icon", "📱"), el("div", "", "Tourne ton téléphone : on conduit mieux en paysage."), dismiss);
  rotate.replaceChildren(card);

  renderSettings();
  render();
  return {
    settingsOpen: () => !panel.hidden,
    setPaused(paused) {
      pauseBtn.textContent = paused ? "▶" : "⏸";
      pauseBtn.title = paused ? "Reprendre" : "Pause";
      pauseBtn.setAttribute("aria-label", pauseBtn.title);
    },
    refresh: render,
  };
}
