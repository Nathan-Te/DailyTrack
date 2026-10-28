import { el, svg } from "@cdj/ui";
import type { Controls } from "./input";
import { lier, t } from "./i18n";
import { NO_INSETS, TouchPad, ZONES, buttonRects, layoutFor, zoneSpans, type ButtonSize, type Insets, type Zone } from "./touch";

// Interface tactile (lot 1b) : la couche qui reçoit les doigts (pointer events, plusieurs à la fois), les boutons dessinés (sans effet sur le toucher)
// et, avec `?zones=1`, le dessin des zones. Toute la décision (quelle zone, quelle direction) est dans `touch.ts`, pur et testé ; ici on ne fait que
// brancher le DOM. **Lot I5 (charte rév. 7, maquette `jump-hud.html`)** : les boutons sont des plaques papier à bordure encre **aux bords** (← → en bas
// à gauche, le gros bouton jaune « SAUT » en bas à droite), jamais devant le personnage ; **mêmes zones et même comportement** qu'au lot 1b. La bande
// haute n'a plus de boutons à elle : la pause (en haut à gauche, `#pausebtn`) y est pour tout le monde, et recommencer, le fantôme et le plein écran
// sont dans la pause. `?debug&tune` garde son bouton ⚙ (`#gear`, outil interne) à côté de la pause.

export interface TouchUiOptions {
  controls: Controls;
  /** Vrai avec `?touch=1` : les boutons sont visibles d'emblée (sinon, après le premier toucher). */
  forced: boolean;
  /** `?zones=1` : dessine les zones et un point par doigt. */
  zones: boolean;
  /** `?debug&tune` : un bouton ⚙ ouvre le panneau de réglages du personnage. */
  tune: boolean;
  /** Taille des boutons dessinés (réglage du joueur). */
  buttonSize: ButtonSize;
  onGear(): void;
}

export interface TouchUi {
  readonly pad: TouchPad;
  /** Panneau ouvert : la couche ne capte plus rien et les doigts posés sont lâchés. */
  suspend(on: boolean): void;
  /** Nouvelle taille des boutons (Réglages) : ils sont redessinés tout de suite, la frontière ← / → suit. */
  setButtonSize(size: ButtonSize): void;
}

/** Une flèche des boutons de direction (la forme de la maquette). */
function fleche(d: string): SVGSVGElement {
  return svg("svg", { attrs: { viewBox: "0 0 30 30", width: 30, height: 30, "aria-hidden": "true", focusable: "false" } }, svg("path", { attrs: { d, fill: "none", stroke: "currentColor", "stroke-width": 4.5, "stroke-linecap": "square" } }));
}
const FLECHES: Record<Exclude<Zone, "jump">, string> = { left: "M19 5 9 15l10 10", right: "M11 5l10 10-10 10" };
const LABEL: Record<Zone, string> = { left: "tactile.gauche", right: "tactile.droite", jump: "tactile.saut.aria" };

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
  let size = opts.buttonSize;
  const pad = new TouchPad(layoutFor(window.innerWidth, window.innerHeight, insets, size));

  // La couche qui reçoit les doigts : toute la page, sous les boutons du haut.
  const layer = el("div", { attrs: { id: "touch" } });
  const buttons = el("div", { attrs: { id: "tbuttons", "aria-hidden": "true" } });
  const visuals = new Map<Zone, HTMLElement>();
  for (const zone of ZONES) {
    const b = el("div", { classe: ["tbtn", `tbtn--${zone}`], attrs: { "data-zone": zone } });
    if (zone === "jump") lier(b, "tactile.saut");
    else b.append(fleche(FLECHES[zone]));
    lier(b, LABEL[zone], undefined, "aria-label");
    visuals.set(zone, b);
    buttons.append(b);
  }

  // `?debug&tune` : le bouton ⚙ du panneau de réglages du personnage (outil interne), à côté de la pause.
  if (opts.tune) {
    const gear = el("button", { classe: ["plaque", "plaque--bouton"], attrs: { type: "button", id: "gear" } });
    gear.append(svg("svg", { attrs: { viewBox: "0 0 24 24", width: 20, height: 20, "aria-hidden": "true", focusable: "false" } }, svg("path", { attrs: { d: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v4M12 18v4M2 12h4M18 12h4", fill: "none", stroke: "currentColor", "stroke-width": 2.5 } })));
    lier(gear, "hud.gear.aria", undefined, "aria-label");
    gear.addEventListener("click", () => {
      gear.blur();
      opts.onGear();
    });
    document.getElementById("hud-gauche")?.append(gear);
  }

  const rotate = el("div", { classe: ["plaque", "plaque--petite"], attrs: { id: "rotate", role: "status" } });
  lier(rotate, "hud.tourner");

  // L'invitation à tourner le téléphone ne bloque rien : sa couche laisse passer les doigts vers la couche de jeu (lot 1b, `e2e/mobile.spec.ts`).
  document.body.append(layer, buttons, el("div", { classe: "rotate-couche" }, rotate));

  // ——— Dessin des zones et des doigts (?zones=1) ———
  const zonesBox = opts.zones ? el("div", { attrs: { id: "zones" } }) : null;
  const dots = new Map<number, HTMLElement>();
  const drawZones = () => {
    if (!zonesBox) return;
    const l = pad.layout;
    zonesBox.replaceChildren();
    const band = el("div", { classe: "zone band", texte: t("tactile.zone.bande") });
    band.style.cssText = `left:0;top:0;width:${l.width}px;height:${l.band}px`;
    zonesBox.append(band);
    for (const s of zoneSpans(l)) {
      const z = el("div", { classe: `zone ${s.zone}`, texte: t(LABEL[s.zone]) });
      z.style.cssText = `left:${s.x0 * l.width}px;top:${l.band}px;width:${(s.x1 - s.x0) * l.width}px;height:${l.height - l.band}px`;
      zonesBox.append(z);
    }
  };
  if (zonesBox) document.body.append(zonesBox);

  const place = () => {
    insets = readInsets();
    pad.layout = layoutFor(window.innerWidth, window.innerHeight, insets, size);
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
          d = el("div", { classe: `dot ${f.role}` });
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
    suspend(on) {
      suspended = on;
      document.body.classList.toggle("touch-suspended", on);
      release();
    },
    setButtonSize(next) {
      if (next === size) return;
      size = next;
      relayout();
    },
  };
}
