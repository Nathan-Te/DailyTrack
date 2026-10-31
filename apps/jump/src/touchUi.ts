import { el, svg } from "@cdj/ui";
import type { Controls } from "./input";
import { lier, t } from "./i18n";
import { NO_INSETS, TouchPad, ZONES, buttonRects, isMouseEcho, layoutFor, zoneSpans, type ButtonSize, type Insets, type Zone } from "./touch";
import { touchDebugLine, type ReleaseReason } from "./touchDebug";

// Interface tactile (lot 1b) : la couche qui reçoit les doigts (pointer events, plusieurs à la fois), les boutons dessinés (sans effet sur le toucher)
// et, avec `?zones=1`, le dessin des zones. Toute la décision (quelle zone, quelle direction) est dans `touch.ts`, pur et testé ; ici on ne fait que
// brancher le DOM. **Lot I5 (charte rév. 7, maquette `jump-hud.html`)** : les boutons sont des plaques papier à bordure encre **aux bords** (← → en bas
// à gauche, le gros bouton jaune « SAUT » en bas à droite), jamais devant le personnage ; **mêmes zones et même comportement** qu'au lot 1b. La bande
// haute n'a plus de boutons à elle : la pause (en haut à gauche, `#pausebtn`) y est pour tout le monde, et recommencer, le fantôme et le plein écran
// sont dans la pause. `?debug&tune` garde son bouton ⚙ (`#gear`, outil interne) à côté de la pause.
//
// **Lot 29 — commandes tactiles fiables.** Qu'aucune touche ne reste tenue sans doigt dessus : l'état se déduit des doigts posés (`TouchPad`), et ces doigts
// sont **tenus à jour par plusieurs voies** pour qu'un événement perdu n'en laisse aucun fantôme — lever et annulation écoutés sur la fenêtre (pas
// seulement sur la couche : un doigt qui finit sa course sur un bouton du haut n'y arrive pas), perte de capture, liste des touchers du système
// (`touchstart`…`touchcancel`, `reconcile`), puis tout lâché au focus perdu, à la visibilité changée, à `pagehide`, à la rotation, au redimensionnement ;
// les événements de souris qui suivent un toucher sont ignorés. `?debug` : une ligne (`#touchdebug`) dit les doigts posés et les touches tenues.

export interface TouchUiOptions {
  controls: Controls;
  /** Vrai avec `?touch=1` : les boutons sont visibles d'emblée (sinon, après le premier toucher). */
  forced: boolean;
  /** `?zones=1` : dessine les zones et un point par doigt. */
  zones: boolean;
  /** `?debug&tune` : un bouton ⚙ ouvre le panneau de réglages du personnage. */
  tune: boolean;
  /** `?debug` : une ligne dit les doigts posés et les touches tenues (lot 29). */
  debug: boolean;
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

  // Lot 29, `?debug` : les doigts que le jeu croit posés et les touches qu'il tient ; mise à jour à chaque changement, pas à chaque image.
  const debugBox = opts.debug ? el("div", { attrs: { id: "touchdebug", "aria-hidden": "true" } }) : null;
  if (debugBox) document.body.append(debugBox);
  let lastRelease: ReleaseReason | null = null;
  const drawDebug = () => {
    if (!debugBox) return;
    const line = touchDebugLine(pad.count, pad.bits, lastRelease);
    if (debugBox.textContent !== line) debugBox.textContent = line;
  };

  const sync = () => {
    controls.setTouch(pad.direction, pad.jump);
    drawDebug();
    for (const [zone, v] of visuals) v.classList.toggle("down", pad.pressed(zone));
    if (zonesBox) {
      const live = new Set(pad.list().map((f) => f.id));
      for (const [id, d] of dots) if (!live.has(id)) (d.remove(), dots.delete(id));
      for (const f of pad.list()) {
        let d = dots.get(f.id);
        if (!d) {
          d = el("div", { classe: `dot ${f.zone}` });
          zonesBox.append(d);
          dots.set(f.id, d);
        }
        d.style.cssText = `left:${f.x}px;top:${f.y}px`;
      }
    }
  };

  let suspended = false;
  /** Lâche tout d'office (et se souvient pourquoi, pour `?debug`). */
  const release = (reason: ReleaseReason) => {
    if (pad.count > 0) lastRelease = reason;
    pad.releaseAll();
    sync();
  };

  // Le dernier toucher du système : un événement de souris qui le suit de près n'est que son écho (événements de compatibilité).
  let lastTouchAt: number | null = null;
  const noteTouch = (e: PointerEvent) => {
    if (e.pointerType !== "mouse") lastTouchAt = performance.now();
  };
  const lift = (id: number, reason: ReleaseReason | null = null) => {
    if (!pad.up(id)) return;
    if (reason) lastRelease = reason;
    sync();
  };

  layer.addEventListener("pointerdown", (e) => {
    if (suspended || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.preventDefault();
    noteTouch(e);
    if (isMouseEcho(e.pointerType, performance.now(), lastTouchAt)) {
      lastRelease = "souris ignorée";
      drawDebug();
      return;
    }
    if (e.pointerType !== "mouse") document.body.classList.add("touch-seen");
    try {
      layer.setPointerCapture(e.pointerId); // le doigt qui sort de l'écran reste suivi jusqu'au lever
    } catch {
      /* pointeur déjà fini (événement rejoué) : sans importance */
    }
    if (pad.down(e.pointerId, e.clientX, e.clientY, e.pointerType === "touch") !== "band") rotate.classList.add("gone");
    sync();
  });
  // Déplacement, lever et annulation s'écoutent sur la fenêtre, en capture : le doigt qui perd sa capture ou finit sur un autre élément (un bouton du haut)
  // ne laisse jamais sa commande tenue. Seuls les doigts connus comptent (`pad.has`).
  window.addEventListener(
    "pointermove",
    (e) => {
      if (suspended || !pad.has(e.pointerId)) return;
      noteTouch(e);
      if (e.pointerType === "mouse" && e.buttons === 0) lift(e.pointerId); // le bouton a été lâché hors de la page
      else (pad.move(e.pointerId, e.clientX, e.clientY), sync());
    },
    true,
  );
  window.addEventListener(
    "pointerup",
    (e) => {
      noteTouch(e);
      lift(e.pointerId);
    },
    true,
  );
  window.addEventListener(
    "pointercancel",
    (e) => {
      noteTouch(e);
      lift(e.pointerId, "annulation");
    },
    true,
  );
  // Capture perdue : le doigt ne nous parle plus. Mais l'événement peut arriver après la pose du doigt suivant, qui réutilise le même identifiant (DailyTrack
  // l'a mesuré) : tant que la couche tient à nouveau ce pointeur, il ne dit rien du nouveau doigt.
  layer.addEventListener("lostpointercapture", (e) => {
    if (!layer.hasPointerCapture(e.pointerId)) lift(e.pointerId, "perte de capture");
  });
  // La liste des touchers que le système dit posés fait foi : moins de touchers que de doigts suivis = un lever s'est perdu (`pad.reconcile`).
  // `touchcancel` (geste du système : centre de contrôle, notification, appel) vide la liste.
  const reconcile = (e: TouchEvent) => {
    lastTouchAt = performance.now();
    if (suspended) return;
    if (pad.reconcile(Array.from(e.touches, (t) => ({ x: t.clientX, y: t.clientY }))) > 0) {
      lastRelease = e.type === "touchcancel" ? "annulation" : "toucher perdu";
      sync();
    }
  };
  for (const type of ["touchstart", "touchmove", "touchend", "touchcancel"] as const) window.addEventListener(type, reconcile, { capture: true, passive: true });
  // Pas de menu contextuel (appui long) ni de zoom par pincement (Safari iOS ne respecte pas `user-scalable=no`).
  for (const type of ["contextmenu", "gesturestart", "gesturechange", "dblclick"]) document.addEventListener(type, (e) => e.preventDefault());
  // Tout lâcher quand le jeu ne voit plus la main : focus perdu, page cachée ou revenue, quittée, retournée, redimensionnée.
  window.addEventListener("blur", () => release("focus"));
  document.addEventListener("visibilitychange", () => release("visibilité"));
  window.addEventListener("pagehide", () => release("pagehide"));
  window.addEventListener("pageshow", () => release("pagehide"));
  document.addEventListener("freeze", () => release("pagehide"));
  const relayout = (reason: ReleaseReason) => {
    place();
    release(reason);
  };
  window.addEventListener("resize", () => relayout("rotation"));
  window.addEventListener("orientationchange", () => relayout("rotation"));
  place();

  return {
    pad,
    suspend(on) {
      suspended = on;
      document.body.classList.toggle("touch-suspended", on);
      release("panneau");
    },
    setButtonSize(next) {
      if (next === size) return;
      size = next;
      relayout("rotation");
    },
  };
}
