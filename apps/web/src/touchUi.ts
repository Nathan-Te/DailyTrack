import { icone, svg } from "@cdj/ui";
import { el as makeEl, row, segmented, slider, type Control } from "./dom";
import { iconeTrack } from "./icones";
import { fNombre, onLangue, t } from "./i18n";
import { isTyping } from "./input";
import {
  buttonRects,
  zoneAt,
  zoneSpans,
  type ButtonSize,
  type Insets,
  type Zone,
  DEADZONE_RANGE,
  DEFAULT_TOUCH_SETTINGS,
  SENSITIVITY_RANGE,
  saveTouchSettings,
  type TouchPad,
  type TouchSettings,
} from "./touch";

// Interface tactile (lot 10, habillée au lot I4 : plaques asphalte, flèches SVG, « FREIN » en Barlow italique, « GAZ » en livrée — maquettes track-hud*.html) :
// zones de jeu, aides à l'écran, boutons d'action, réglages, invitation à tourner le téléphone, plein écran. Même disposition et même comportement qu'au
// lot 10 (zones et `buttonRects` de touch.ts inchangés) ; seul l'habillage change (tactile.css). Toute la logique des doigts est dans `touch.ts` ; ici, seulement du DOM.
// Les conteneurs (`#touch`, `#tbar`, `#tsettings`, `#rotate`) sont dans `index.html`, cachés tant que la page n'est
// pas en mode tactile (`body.touch`).

export interface TouchHooks {
  /** `?zones=1` : dessine les zones actives et un point par doigt (diagnostic). */
  showZones?: boolean;
  onRespawn(): void;
  onRestart(): void;
  /** Caméra suivante (proche, loin, capot). */
  onCamera(): void;
  /** Ouvre les réglages (lot 29 : un seul panneau, onglet « Commandes »). */
  onSettings(): void;
}

export interface TouchUi {
  /** Gardé pour main.ts (lot I4 : la barre n'a plus de bouton pause, la plaque du HUD le remplace). */
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
  const direction = t(s.steerMode === "drag" ? "tactile.indice.glisser" : "tactile.indice.fleches");
  const pedales = t(s.autoThrottle ? "tactile.indice.auto" : "tactile.indice.pedales");
  return t("tactile.indice", { direction, pedales });
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

/**
 * Réglages des commandes tactiles (mode de direction, taille des boutons, sensibilité, zone morte, accélérateur, vibration), appliqués tout de
 * suite et mémorisés (`cdj:touch`). Montés dans Réglages › Commandes ; `onChange` redessine les aides à l'écran.
 */
export function touchSettingsControls(pad: TouchPad, onChange: () => void): Control {
  const apply = (patch: Partial<TouchSettings>) => {
    Object.assign(pad.settings, patch);
    saveTouchSettings(pad.settings);
    pad.releaseAll();
    sync();
    onChange();
  };
  const steerMode = segmented<TouchSettings["steerMode"]>([["drag", t("tactile.direction.glisser")], ["buttons", t("tactile.direction.boutons")]], () => pad.settings.steerMode, (v) => apply({ steerMode: v }), t("tactile.direction.nom"));
  const sensitivity = slider(SENSITIVITY_RANGE, () => pad.settings.sensitivity, (v) => apply({ sensitivity: v }), (v) => `×${fNombre(v, 2)}`, t("tactile.sensibilite.nom"));
  const deadzone = slider(DEADZONE_RANGE, () => pad.settings.deadzone, (v) => apply({ deadzone: v }), (v) => `${fNombre(Math.round(v * 100))} %`, t("tactile.zoneMorte.nom"));
  const throttle = segmented<boolean>([[false, t("tactile.accelerateur.bouton")], [true, t("tactile.accelerateur.auto")]], () => pad.settings.autoThrottle, (v) => apply({ autoThrottle: v }), t("tactile.accelerateur.nom"));
  const size = segmented<ButtonSize>([["small", t("tactile.taille.small")], ["medium", t("tactile.taille.medium")], ["large", t("tactile.taille.large")]], () => pad.settings.buttonSize, (v) => apply({ buttonSize: v }), t("tactile.taille.nom"));
  const vibration = segmented<boolean>([[true, t("reglages.oui")], [false, t("reglages.non")]], () => pad.settings.vibration, (v) => apply({ vibration: v }), t("tactile.vibration.nom"));
  const reset = makeEl("button", "dj-bouton dj-bouton--secondaire", t("tactile.reinit"));
  reset.type = "button";
  reset.addEventListener("click", () => apply({ ...DEFAULT_TOUCH_SETTINGS }));
  const box = makeEl("div", "reglages__tactile-liste");
  box.append(
    row(t("tactile.direction.nom"), steerMode.box, t("tactile.direction.aide")),
    row(t("tactile.taille.nom"), size.box),
    row(t("tactile.sensibilite.nom"), sensitivity.box, t("tactile.sensibilite.aide")),
    row(t("tactile.zoneMorte.nom"), deadzone.box),
    row(t("tactile.accelerateur.nom"), throttle.box, t("tactile.accelerateur.aide")),
    row(t("tactile.vibration.nom"), vibration.box, t("tactile.vibration.aide")),
    reset,
  );
  function sync() {
    for (const c of [steerMode, size, sensitivity, deadzone, throttle, vibration]) c.sync();
  }
  sync();
  return { box, sync };
}

/** Une flèche de direction de la maquette (trait de 4, extrémités carrées). */
function fleche(d: string): SVGSVGElement {
  return svg("svg", { attrs: { viewBox: "0 0 30 30", width: 30, height: 30, "aria-hidden": "true", focusable: "false" } }, svg("path", { attrs: { d, fill: "none", stroke: "currentColor", "stroke-width": 4, "stroke-linecap": "square" } }));
}

/** Le téléphone qu'on tourne (invitation du portrait) : un rectangle debout et sa flèche. */
function telephone(): SVGSVGElement {
  return svg(
    "svg",
    { classe: "dj-icone", attrs: { viewBox: "0 0 40 40", width: 40, height: 40, "aria-hidden": "true", focusable: "false", fill: "none", stroke: "currentColor", "stroke-linecap": "square" } },
    svg("rect", { attrs: { x: 13, y: 6, width: 14, height: 24 } }),
    svg("path", { attrs: { d: "M18 26h4M30 12c4 2 6 5 6 8M36 20l-3-3M36 20l3-3" } }),
  );
}

/** Construit l'interface tactile dans les conteneurs de la page et branche les doigts sur `pad`. */
export function mountTouchUi(pad: TouchPad, hooks: TouchHooks): TouchUi {
  const zone = document.getElementById("touch")!;
  const bar = document.getElementById("tbar")!;
  const rotate = document.getElementById("rotate")!;

  // --- Aides à l'écran (aucune ne reçoit de toucher : tout passe par `zone`) ------------------------
  const ring = el("div", "ring");
  const knob = el("div", "knob");
  const left = el("div", "tbtn pad steer-left");
  const right = el("div", "tbtn pad steer-right");
  left.append(fleche("M19 5 9 15l10 10"));
  right.append(fleche("M11 5l10 10-10 10"));
  const brake = el("div", "tbtn pad pedal-brake", t("tactile.frein"));
  const gas = el("div", "tbtn pad pedal-gas", t("tactile.gaz"));
  const hint = el("div", "hint");
  const buttonEls: Record<string, HTMLElement> = { left, right, brake, gas };
  // Zones actives (diagnostic `?zones=1`) : une tranche par zone, de bord à bord, avec son nom.
  const overlay = el("div", "zones");
  overlay.hidden = !hooks.showZones;
  const dots = new Map<number, HTMLElement>();
  zone.replaceChildren(overlay, ring, knob, left, right, brake, gas, hint);

  // Zones sûres (encoche, barre d'accueil) : lues par une sonde CSS `env(safe-area-inset-*)`.
  const probe = el("div", "safe-probe");
  document.body.append(probe);
  const insets = (): Insets => {
    const c = getComputedStyle(probe);
    return { left: parseFloat(c.paddingLeft) || 0, right: parseFloat(c.paddingRight) || 0, top: parseFloat(c.paddingTop) || 0, bottom: parseFloat(c.paddingBottom) || 0 };
  };
  // Diagnostic `?zones=1` seulement (outil de test, jamais montré aux joueurs) : couleurs libres, en dehors de la charte.
  const ZONE_COLORS: Record<Zone, string> = { steer: "#4cc9f0", left: "#4cc9f0", right: "#7bd88f", brake: "#ff6b6b", gas: "#ffd22e" };

  function layout() {
    const w = zone.clientWidth;
    const h = zone.clientHeight;
    const rects = buttonRects(w, h, pad.settings, insets());
    for (const b of Object.values(buttonEls)) b.hidden = true;
    for (const r of rects) {
      const b = buttonEls[r.zone];
      if (!b) continue;
      b.hidden = false;
      b.style.left = `${r.x}px`;
      b.style.top = `${r.y}px`;
      b.style.width = `${r.w}px`;
      b.style.height = `${r.h}px`;
    }
    overlay.replaceChildren(
      ...zoneSpans(pad.settings).map((sp) => {
        const d = el("div", "zspan", sp.zone);
        d.style.left = `${sp.x0 * 100}%`;
        d.style.width = `${(sp.x1 - sp.x0) * 100}%`;
        d.style.background = ZONE_COLORS[sp.zone] + "33";
        d.style.borderColor = ZONE_COLORS[sp.zone];
        return d;
      }),
    );
  }
  window.addEventListener("resize", layout);
  window.addEventListener("orientationchange", layout);

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

  // Un point par doigt (`?zones=1`), de la couleur de la zone touchée ; rouge si le doigt est tombé hors de la zone de jeu.
  if (hooks.showZones) {
    const dot = (e: PointerEvent) => {
      let d = dots.get(e.pointerId);
      if (!d) {
        d = el("div", "fdot");
        dots.set(e.pointerId, d);
        document.body.append(d);
      }
      const box = zone.getBoundingClientRect();
      const inside = e.target instanceof Node && zone.contains(e.target);
      d.style.background = inside ? ZONE_COLORS[zoneAt(e.clientX - box.left, box.width, pad.settings)] : "#e5322d";
      d.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
    };
    const gone = (e: PointerEvent) => {
      dots.get(e.pointerId)?.remove();
      dots.delete(e.pointerId);
    };
    document.addEventListener("pointerdown", dot, true);
    document.addEventListener("pointermove", (e) => dots.has(e.pointerId) && dot(e), true);
    for (const t of ["pointerup", "pointercancel"] as const) document.addEventListener(t, gone, true);
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
  // Pas de `lostpointercapture` : il arrive après `pointerup`, parfois après la pose du doigt suivant quand le système
  // réutilise le même identifiant, et lèverait ce nouveau doigt (appui « perdu »).
  for (const type of ["pointerup", "pointercancel"] as const) {
    zone.addEventListener(type, (e) => {
      pad.up(e.pointerId);
      render();
    });
  }
  // Aucun toucher perdu : le navigateur ne doit ni faire défiler, ni zoomer, ni attendre un double-tap.
  for (const type of ["touchstart", "touchmove"] as const) zone.addEventListener(type, (e) => e.preventDefault(), { passive: false });
  // Pas de menu d'appui long, de zoom par pincement (iOS) ni de double-tap.
  const block = (e: Event) => {
    if (!isTyping(e)) e.preventDefault(); // le champ du pseudo garde son menu (copier / coller)
  };
  for (const type of ["contextmenu", "gesturestart", "gesturechange", "dblclick"]) document.addEventListener(type, block);
  window.addEventListener("blur", () => {
    pad.releaseAll();
    render();
  });

  // --- Boutons d'action : des plaques de 44 px, icônes au trait (aucun émoji) ----------------------------------------------------------------------
  // Lot I4 : la pause est la plaque du HUD (`#btn-pause`, en haut à gauche) ; la barre n'a plus son propre bouton pause.
  const button = (cls: string, icon: SVGSVGElement, cle: string, onClick: () => void) => {
    const b = el("button", cls);
    b.type = "button";
    b.dataset.cle = cle;
    b.append(icon);
    b.addEventListener("click", () => {
      b.blur();
      onClick();
    });
    return b;
  };
  const full = button("full", iconeTrack("plein-ecran", 20), "tactile.pleinEcran", () => void toggleFullscreen());
  full.hidden = !canFullscreen();
  // Le bouton caméra est le premier de la barre : la barre va de ≈ 36 % à 64 % de la largeur et le bouton tombe à ≈ 36–41 %, loin des
  // frontières entre zones (25 / 50 / 75 %) ; un test (`cameras.spec.ts`) mesure l'écart avec `?zones=1`.
  const actions = [
    button("camera", iconeTrack("camera", 20), "tactile.camera", () => hooks.onCamera()),
    button("respawn", icone("drapeau", { taille: 20 }), "tactile.pointDeControle", () => hooks.onRespawn()),
    button("restart", iconeTrack("recommencer", 20), "tactile.depart", () => hooks.onRestart()),
    button("gear", iconeTrack("reglages", 20), "tactile.reglages", () => hooks.onSettings()),
    full,
  ];
  bar.replaceChildren(...actions);

  // --- Invitation à tourner le téléphone (portrait) ----------------------------------------------
  const card = el("div", "card");
  const dismiss = el("button", "dj-bouton dj-bouton--secondaire");
  dismiss.type = "button";
  dismiss.addEventListener("click", () => document.body.classList.add("rotate-ok"));
  const message = el("div", "message");
  const icon = el("div", "icon");
  icon.append(telephone());
  card.append(icon, message, dismiss);
  rotate.replaceChildren(card);

  /** Les textes dans la langue courante (au montage et à chaque changement de langue). */
  function libelles() {
    brake.textContent = t("tactile.frein");
    gas.textContent = t("tactile.gaz");
    for (const b of actions) {
      const nom = t(b.dataset.cle!);
      b.title = nom;
      b.setAttribute("aria-label", nom);
    }
    message.textContent = t("tactile.rotation");
    dismiss.textContent = t("tactile.rotation.ok");
    hint.textContent = hintText(pad.settings);
  }
  libelles();
  onLangue(libelles);

  layout();
  render();
  return {
    setPaused() {
      /* lot I4 : la pause est la plaque du HUD (#btn-pause, main.ts) ; rien à montrer ici */
    },
    refresh() {
      layout();
      render();
    },
  };
}
