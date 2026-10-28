import { svg } from "@cdj/ui";
import { onLangue, t } from "./i18n";
import { isTyping } from "./input";
import {
  buttonRects,
  zoneAt,
  zoneSpans,
  type Insets,
  type SteerMode,
  type Steerer,
  type Zone,
  saveTouchSettings,
  type TouchPad,
  type TouchSettings,
} from "./touch";

// Interface tactile (lot 10, habillée au lot I4, refaite à la retouche 2 : charte rév. 7, maquette track-hud-paysage.html) : les boutons de direction et de
// pédales **aux bords** de l'écran (jamais devant la voiture), leurs zones de toucher, l'invitation à tourner le téléphone. Plus de barre du bas ni d'aide
// sur la scène : les actions de course (point de contrôle, recommencer) sont des plaques du HUD (en haut à gauche), la caméra et le plein écran ont leur plaque (lot I7), les graphismes sont dans la pause. Toute la logique des doigts est dans `touch.ts` ; ici, seulement du DOM. Les conteneurs (`#touch`, `#rotate`) sont dans
// `index.html`, cachés tant que la page n'est pas en mode tactile (`body.touch`).

export interface TouchHooks {
  /** `?zones=1` : dessine les zones actives et un point par doigt (diagnostic). */
  showZones?: boolean;
  /** Lot 52 : l'aide d'une ligne sous la bande (le gyroscope : « tiens le téléphone droit… »), et un message court qui s'affiche quelques secondes (le gyroscope refusé : « Retour au mode … »). */
  notice?(text: string): void;
  alerte?(text: string): void;
}

export interface TouchUi {
  /** Gardé pour main.ts (lot I4 : la barre n'a plus de bouton pause, la plaque du HUD le remplace). */
  setPaused(paused: boolean): void;
  /** Redessine les aides (après un changement de réglage, d'écran ou de phase). */
  refresh(): void;
  /** Lot 52 : vrai tant que le mode de direction choisi se charge (ou que le joueur répond à la demande d'autorisation) : le décompte attend. */
  loading(): boolean;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}

// --- Les modes de direction chargés à la demande (lot 52) -------------------------------------------------------------------------------------------------
// Les boutons restent dans le premier chargement ; la glissière, le volant et le gyroscope sont trois modules (logique, dessin, réglages, textes, feuille de style)
// que `import()` charge quand le joueur les choisit, ou au chargement de la page s'il les a déjà choisis — **avant le décompte** (`loading`).

export interface SteerMounted {
  /** Replace les aides (après une mesure de l'écran ou un réglage). */
  layout(): void;
  render(): void;
  unmount(): void;
}
export interface SteerRows {
  nodes: HTMLElement[];
  sync(): void;
}
export interface SteerIo {
  /** L'aide d'une ligne sous la bande (comme l'aide des commandes). */
  notice(text: string): void;
  /** L'autorisation est refusée, ou le capteur est absent : le jeu reprend le mode d'avant et le dit. */
  fail(raison: "refuse" | "absent"): void;
}
export interface SteerModule {
  steerer: Steerer;
  mount(host: HTMLElement): SteerMounted;
  /** Les réglages propres au mode, lignes de Réglages › Commandes. */
  rows(apply: (patch: Partial<TouchSettings>) => void): SteerRows;
  /** Vrai pendant que le module attend le joueur (la fenêtre d'autorisation du système). */
  loading?(): boolean;
  /** L'aide d'une ligne du mode (et celle des pédales si elles changent) ; `cd`, `cp` : le côté de la direction, celui des pédales. */
  hint?(s: Readonly<TouchSettings>, cd: string, cp: string): { direction: string; pedales?: string };
  /** Le message et la carte du retour au mode d'avant. */
  refusal?(raison: "refuse" | "absent", retour: SteerMode): { carte: HTMLElement; message: string };
}
export type SteerFactory = (pad: TouchPad, io: SteerIo) => SteerModule;

const CHARGEURS: Record<Exclude<SteerMode, "buttons">, () => Promise<{ create: SteerFactory }>> = {
  slider: () => import("./steerSlider"),
  wheel: () => import("./steerWheel"),
  gyro: () => import("./steerGyro"),
};

/** Le mode monté dans `#touch` (sauf les boutons, dessinés par `mountTouchUi`), et ce qu'il faut pour le changer. */
export const dir = {
  pad: null as TouchPad | null,
  host: null as HTMLElement | null,
  hooks: {} as TouchHooks,
  courant: null as { mode: SteerMode; module: SteerModule; monte: SteerMounted } | null,
  /** Le mode d'avant le gyroscope : celui qu'on reprend s'il est refusé (les boutons, faute d'autre). */
  avant: "buttons" as SteerMode,
  generation: 0,
  charge: false,
  /** Redessine les réglages du mode (appelé quand un module vient d'être monté ou démonté). */
  surChangement: null as (() => void) | null,
  /** La carte du dernier retour (affichée dans Réglages › Commandes jusqu'au prochain choix). */
  carte: null as HTMLElement | null,
  /** Redessine les boutons et les aides (`mountTouchUi`) : après un changement de mode que le joueur n'a pas fait lui-même (le gyroscope refusé). */
  redessiner: null as (() => void) | null,
};
const prevenir = () => dir.surChangement?.();

/** Met le mode monté d'accord avec les réglages : charge le module au besoin (`import()`), le monte, branche sa direction sur le pad. */
export async function aligner(): Promise<void> {
  const { pad, host } = dir;
  if (!pad || !host) return;
  const mode = pad.settings.steerMode;
  const generation = ++dir.generation;
  dir.charge = false; // un chargement abandonné (un autre choix est arrivé) ne retient pas le décompte : celui qui charge le remet à vrai
  if (dir.courant && dir.courant.mode !== mode) {
    dir.courant.monte.unmount();
    dir.courant = null;
    pad.steerer = null;
  }
  if (mode === "buttons" || dir.courant) {
    dir.courant?.monte.layout();
    dir.redessiner?.();
    prevenir();
    return;
  }
  dir.charge = true;
  let module: SteerModule;
  try {
    module = (await CHARGEURS[mode]()).create(pad, { fail: (raison) => retourner(raison), notice: (texte) => dir.hooks.notice?.(texte) });
  } catch {
    // Hors ligne et le morceau n'est pas là : les boutons, qui sont toujours là.
    if (generation === dir.generation) {
      Object.assign(pad.settings, { steerMode: "buttons" });
      saveTouchSettings(pad.settings);
      void aligner();
    }
    return;
  }
  if (generation !== dir.generation) return; // un autre choix est arrivé pendant le chargement
  dir.charge = false;
  dir.courant = { mode, module, monte: module.mount(host) };
  pad.steerer = module.steerer;
  dir.redessiner?.();
  prevenir();
}

/** Le gyroscope est refusé ou absent : retour au mode d'avant, la carte dans Réglages › Commandes et le message en course. */
function retourner(raison: "refuse" | "absent"): void {
  const { pad } = dir;
  const module = dir.courant?.module;
  if (!pad || !module) return;
  const retour = dir.avant === "gyro" ? "buttons" : dir.avant;
  const r = module.refusal?.(raison, retour);
  Object.assign(pad.settings, { steerMode: retour });
  saveTouchSettings(pad.settings);
  pad.releaseAll();
  if (r) {
    dir.carte = r.carte;
    dir.hooks.alerte?.(r.message);
  }
  void aligner();
}

export function hintText(s: Readonly<TouchSettings>): string {
  const [g, d] = [t("tactile.cote.gauche"), t("tactile.cote.droite")];
  const [cd, cp] = s.mirrored ? [d, g] : [g, d]; // le côté de la direction, celui des pédales
  // Les boutons ici ; la glissière, le volant et le gyroscope disent leur propre aide (lot 52 : leurs textes viennent avec eux).
  const m = dir.courant?.mode === s.steerMode ? dir.courant.module.hint?.(s, cd, cp) : undefined;
  return t("tactile.indice", {
    direction: m?.direction ?? t("tactile.indice.fleches", { cote: cd }),
    pedales: m?.pedales ?? t(s.autoThrottle ? "tactile.indice.auto" : "tactile.indice.pedales", { cote: cp }),
  });
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
  const rotate = document.getElementById("rotate")!;

  // --- Aides à l'écran (aucune ne reçoit de toucher : tout passe par `zone`) ------------------------
  const left = el("div", "tbtn pad steer-left");
  const right = el("div", "tbtn pad steer-right");
  left.append(fleche("M19 5 9 15l10 10"));
  right.append(fleche("M11 5l10 10-10 10"));
  const brake = el("div", "tbtn pad pedal-brake", t("tactile.frein"));
  const gas = el("div", "tbtn pad pedal-gas", t("tactile.gaz"));
  const buttonEls: Record<string, HTMLElement> = { left, right, brake, gas };
  // Zones actives (diagnostic `?zones=1`) : une tranche par zone, de bord à bord, avec son nom.
  const overlay = el("div", "zones");
  overlay.hidden = !hooks.showZones;
  const dots = new Map<number, HTMLElement>();
  zone.replaceChildren(overlay, left, right, brake, gas);
  // Lot 52 : la glissière, le volant et le gyroscope dessinent dans `zone` quand leur module est chargé (`aligner`).
  dir.pad = pad;
  dir.host = zone;
  dir.hooks = hooks;
  void aligner();

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
    const ins = insets();
    pad.setGeometry(w, h, ins); // les zones de toucher épousent les boutons dessinés : même mesure, même définition (touch.ts)
    const rects = buttonRects(w, h, pad.settings, ins);
    for (const b of Object.values(buttonEls)) b.hidden = true;
    dir.courant?.monte.layout();
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
      ...zoneSpans(pad.settings, pad.geometry).map((sp) => {
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
  // La zone n'a aucune taille tant que l'accueil est ouvert (`body.home #touch { display: none }`) : on remesure dès qu'elle apparaît ou change de taille (sinon les boutons et les zones
  // restent calés sur une largeur nulle).
  if (typeof ResizeObserver === "function") new ResizeObserver(() => layout()).observe(zone);

  function render() {
    const s = pad.snapshot();
    zone.dataset.mode = pad.settings.steerMode;
    zone.dataset.throttle = pad.settings.autoThrottle ? "auto" : "manual";
    zone.dataset.mirrored = String(pad.settings.mirrored);
    left.classList.toggle("on", s.left);
    right.classList.toggle("on", s.right);
    brake.classList.toggle("on", s.brake);
    gas.classList.toggle("on", s.gas);
    dir.courant?.monte.render();
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
      const hit = inside ? zoneAt(e.clientX - box.left, box.width, pad.settings, pad.geometry) : null;
      d.style.background = hit ? ZONE_COLORS[hit] : inside ? "#9aa0a6" : "#e5322d"; // gris : le milieu de l'écran, sans zone ; rouge : hors de la zone de jeu
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
    message.textContent = t("tactile.rotation");
    dismiss.textContent = t("tactile.rotation.ok");
  }
  libelles();
  onLangue(libelles);

  layout();
  render();
  dir.redessiner = () => {
    layout();
    render();
  };
  return {
    setPaused() {
      /* lot I4 : la pause est la plaque du HUD (#btn-pause, main.ts) ; rien à montrer ici */
    },
    refresh() {
      layout();
      render();
    },
    loading: () => dir.charge || !!dir.courant?.module.loading?.(),
  };
}
