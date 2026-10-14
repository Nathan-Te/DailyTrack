import type { Controls } from "./input";
import { NO_INSETS, TouchPad, ZONE_SPANS, buttonRects, layoutFor, type Insets, type Zone } from "./touch";

// Interface tactile (lot 1b) : la couche qui reçoit les doigts (pointer events, plusieurs à la fois), les boutons dessinés (translucides,
// sans effet sur le toucher), la bande haute (recommencer, réglages, plein écran) et, avec `?zones=1`, le dessin des zones. Toute la décision
// (quelle zone, quelle direction) est dans `touch.ts`, pur et testé ; ici on ne fait que brancher le DOM.

export interface TouchUiOptions {
  controls: Controls;
  /** Vrai avec `?touch=1` : les boutons sont visibles d'emblée (sinon, après le premier toucher). */
  forced: boolean;
  /** `?zones=1` : dessine les zones et un point par doigt. */
  zones: boolean;
  /** `?debug&tune` : un bouton ⚙ ouvre le panneau de réglages. */
  tune: boolean;
  onRestart(): void;
  onGear(): void;
}

export interface TouchUi {
  readonly pad: TouchPad;
  /** Panneau ouvert : la couche ne capte plus rien et les doigts posés sont lâchés. */
  suspend(on: boolean): void;
  /** Vrai si la page peut passer en plein écran (le bouton n'existe pas sinon). */
  readonly fullscreenButton: boolean;
}

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, id?: string, cls?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (id) e.id = id;
  if (cls) e.className = cls;
  return e;
};

const GLYPH: Record<Zone, string> = { left: "◀", right: "▶", jump: "▲" };
const LABEL: Record<Zone, string> = { left: "Gauche", right: "Droite", jump: "Saut" };

/** Zones sûres (encoche, barre d'accueil) en pixels CSS : on les lit par une sonde, `env()` n'est pas lisible autrement. */
export function readInsets(): Insets {
  const probe = el("div");
  probe.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;left:0;top:0;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)";
  document.body.append(probe);
  const cs = getComputedStyle(probe);
  const px = (v: string) => (Number.parseFloat(v) > 0 ? Number.parseFloat(v) : 0);
  const insets = { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) };
  probe.remove();
  return insets;
}

export function mountTouchUi(opts: TouchUiOptions): TouchUi {
  const { controls } = opts;
  document.body.classList.add("touch");
  if (opts.forced) document.body.classList.add("touch-seen");

  let insets: Insets = { ...NO_INSETS };
  const pad = new TouchPad(layoutFor(window.innerWidth, window.innerHeight, insets));

  // La couche qui reçoit les doigts : toute la page, sous les boutons de la bande.
  const layer = el("div", "touch");
  const buttons = el("div", "tbuttons");
  const visuals = new Map<Zone, HTMLElement>();
  for (const s of ZONE_SPANS) {
    const b = el("div", undefined, "tbtn");
    b.dataset.zone = s.zone;
    b.textContent = GLYPH[s.zone];
    b.setAttribute("aria-label", LABEL[s.zone]);
    visuals.set(s.zone, b);
    buttons.append(b);
  }

  const bar = el("div", "tbar");
  const restart = el("button", "restart", "tbar-btn");
  restart.type = "button";
  restart.textContent = "↻";
  restart.title = "Recommencer";
  restart.setAttribute("aria-label", "Recommencer");
  restart.addEventListener("click", () => {
    restart.blur();
    opts.onRestart();
  });
  bar.append(restart);

  const side = el("div", "tbar-right");
  if (opts.tune) {
    const gear = el("button", "gear", "tbar-btn");
    gear.type = "button";
    gear.textContent = "⚙";
    gear.title = "Réglages du personnage";
    gear.setAttribute("aria-label", "Réglages du personnage");
    gear.addEventListener("click", () => {
      gear.blur();
      opts.onGear();
    });
    side.append(gear);
  }
  // Plein écran : là où l'API existe (Android, tablettes, ordinateurs) ; l'iPhone n'a rien à proposer, donc aucun bouton.
  const fsApi = typeof document.fullscreenEnabled === "boolean" && document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === "function";
  if (fsApi) {
    const fs = el("button", "fullscreen", "tbar-btn");
    fs.type = "button";
    fs.title = "Plein écran";
    fs.setAttribute("aria-label", "Plein écran");
    const label = () => (fs.textContent = document.fullscreenElement ? "✕" : "⛶");
    label();
    fs.addEventListener("click", async () => {
      fs.blur();
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else {
          await document.documentElement.requestFullscreen({ navigationUI: "hide" });
          // Le paysage est la bonne orientation pour jouer ; refusé presque partout hors Android, sans conséquence.
          await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape");
        }
      } catch {
        /* refusé par le navigateur : le jeu reste tel quel */
      }
      label();
    });
    document.addEventListener("fullscreenchange", label);
    side.append(fs);
  }
  bar.append(side);

  const rotate = el("div", "rotate");
  rotate.textContent = "Tourne ton téléphone pour plus de confort";
  rotate.setAttribute("role", "status");

  const hud = document.getElementById("hud");
  document.body.append(layer, buttons, bar);
  (hud ?? document.body).prepend(rotate);

  // ——— Dessin des zones et des doigts (?zones=1) ———
  const zonesBox = opts.zones ? el("div", "zones") : null;
  const dots = new Map<number, HTMLElement>();
  const drawZones = () => {
    if (!zonesBox) return;
    const l = pad.layout;
    zonesBox.replaceChildren();
    const band = el("div", undefined, "zone band");
    band.style.cssText = `left:0;top:0;width:${l.width}px;height:${l.band}px`;
    band.textContent = "bande";
    zonesBox.append(band);
    for (const s of ZONE_SPANS) {
      const z = el("div", undefined, `zone ${s.zone}`);
      z.style.cssText = `left:${s.x0 * l.width}px;top:${l.band}px;width:${(s.x1 - s.x0) * l.width}px;height:${l.height - l.band}px`;
      z.textContent = LABEL[s.zone];
      zonesBox.append(z);
    }
  };
  if (zonesBox) document.body.append(zonesBox);

  const place = () => {
    insets = readInsets();
    pad.layout = layoutFor(window.innerWidth, window.innerHeight, insets);
    document.documentElement.style.setProperty("--band", `${pad.layout.band}px`);
    for (const r of buttonRects(pad.layout)) {
      const v = visuals.get(r.zone)!;
      v.style.cssText = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px`;
    }
    drawZones();
  };

  const sync = () => {
    controls.setTouch(pad.direction, pad.jump);
    for (const [zone, v] of visuals) v.classList.toggle("down", pad.pressed(zone));
    if (zonesBox) {
      const live = new Set(pad.list().map((f) => f.id));
      for (const [id, d] of dots) if (!live.has(id)) (d.remove(), dots.delete(id));
      for (const f of pad.list()) {
        let d = dots.get(f.id);
        if (!d) {
          d = el("div", undefined, `dot ${f.role}`);
          zonesBox.append(d);
          dots.set(f.id, d);
        }
        d.style.cssText = `left:${f.x}px;top:${f.y}px`;
      }
    }
  };

  let suspended = false;
  const release = () => {
    pad.releaseAll();
    sync();
  };

  layer.addEventListener("pointerdown", (e) => {
    if (suspended || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    if (e.pointerType !== "mouse") document.body.classList.add("touch-seen");
    try {
      layer.setPointerCapture(e.pointerId); // le doigt qui sort de l'écran reste suivi jusqu'au lever
    } catch {
      /* pointeur déjà fini (événement rejoué) : sans importance */
    }
    if (pad.down(e.pointerId, e.clientX, e.clientY) !== "band") rotate.classList.add("gone");
    sync();
  });
  layer.addEventListener("pointermove", (e) => {
    if (suspended) return;
    pad.move(e.pointerId, e.clientX, e.clientY);
    sync();
  });
  const lift = (e: PointerEvent) => {
    pad.up(e.pointerId);
    sync();
  };
  layer.addEventListener("pointerup", lift);
  layer.addEventListener("pointercancel", lift);
  // Pas de menu contextuel (appui long) ni de zoom par pincement (Safari iOS ne respecte pas `user-scalable=no`).
  for (const type of ["contextmenu", "gesturestart", "gesturechange", "dblclick"]) document.addEventListener(type, (e) => e.preventDefault());
  window.addEventListener("blur", release);
  document.addEventListener("visibilitychange", () => document.hidden && release());
  const relayout = () => {
    place();
    release();
  };
  window.addEventListener("resize", relayout);
  window.addEventListener("orientationchange", relayout);
  place();

  return {
    pad,
    fullscreenButton: fsApi,
    suspend(on) {
      suspended = on;
      document.body.classList.toggle("touch-suspended", on);
      release();
    },
  };
}
