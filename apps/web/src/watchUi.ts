import { REWIND_SECONDS, WATCH_SPEEDS, speedLabel, speedShort, type WatchSpeed } from "./watch";

// Barre de lecture du mode spectateur (lot 27b) : barre de progression, retour de 5 s, pause, vitesses, caméra. Du DOM seulement ;
// les décisions sont dans `watch.ts` et `main.ts`. Les boutons font 44 px de haut au moins et la barre n'est jamais une zone de conduite
// (en spectateur, le jeu ne monte pas les commandes tactiles : il n'y a pas de frontière entre zones à éviter).

export interface WatchHandlers {
  onTogglePause(): void;
  onRewind(): void;
  onSpeed(speed: WatchSpeed): void;
  onCamera(): void;
  /** Le doigt ou la souris déplace la barre de progression : position ∈ [0, 1]. */
  onSeek(fraction: number): void;
}

export interface WatchUi {
  /** Met à jour l'affichage (appelé à chaque image : ne touche au DOM que si quelque chose change). */
  update(v: { paused: boolean; speed: WatchSpeed; progress: number; camera: string }): void;
  show(visible: boolean): void;
}

export function mountWatchUi(root: HTMLElement, h: WatchHandlers): WatchUi {
  const button = (id: string, text: string, label: string, onClick: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.id = id;
    b.textContent = text;
    b.title = label;
    b.setAttribute("aria-label", label);
    b.addEventListener("click", () => {
      b.blur(); // sinon Espace ou Entrée la déclencherait une seconde fois
      onClick();
    });
    return b;
  };

  const progress = document.createElement("input");
  progress.type = "range";
  progress.id = "watch-progress";
  progress.min = "0";
  progress.max = "1000";
  progress.step = "1";
  progress.value = "0";
  progress.setAttribute("aria-label", "Progression du tour");
  let dragging = false;
  progress.addEventListener("pointerdown", () => (dragging = true));
  const release = () => (dragging = false);
  progress.addEventListener("pointerup", release);
  progress.addEventListener("pointercancel", release);
  progress.addEventListener("input", () => h.onSeek(Number(progress.value) / 1000));
  progress.addEventListener("change", () => progress.blur());

  const play = button("watch-play", "⏸", "Pause", h.onTogglePause);
  const back = button("watch-back", `⏪${REWIND_SECONDS}s`, `Retour de ${REWIND_SECONDS} secondes`, h.onRewind);
  const speeds = new Map<WatchSpeed, HTMLButtonElement>();
  for (const s of WATCH_SPEEDS) {
    const b = button(`watch-speed-${String(s).replace(".", "_")}`, speedShort(s), `Vitesse ${speedLabel(s)}`, () => h.onSpeed(s));
    b.dataset.speed = String(s);
    speeds.set(s, b);
  }
  const cam = button("watch-camera", "🎥", "Caméra suivante", h.onCamera);

  const row = document.createElement("div");
  row.className = "row";
  row.append(back, play, ...speeds.values(), cam);
  root.replaceChildren(progress, row);

  let shown = "";
  return {
    update(v) {
      const key = `${v.paused}|${v.speed}|${v.camera}`;
      if (key !== shown) {
        shown = key;
        play.textContent = v.paused ? "▶" : "⏸";
        play.title = v.paused ? "Reprendre" : "Pause";
        play.setAttribute("aria-label", play.title);
        for (const [s, b] of speeds) b.classList.toggle("on", s === v.speed);
        cam.title = `Caméra : ${v.camera} (C)`;
      }
      if (!dragging) progress.value = String(Math.round(v.progress * 1000));
    },
    show(visible) {
      root.hidden = !visible;
    },
  };
}
