import { iconeTrack } from "./icones";
import { aCle, fNombre, onLangue, t } from "./i18n";
import { REWIND_SECONDS, WATCH_SPEEDS, speedLabel, speedShort, type WatchSpeed } from "./watch";

// Barre de lecture du mode spectateur (lot 27b, passée à la charte au lot I4) : barre de progression, retour de 5 s, pause, vitesses, caméra, sur une
// plaque asphalte nette (salon.css). Du DOM seulement ; les décisions sont dans `watch.ts` et `main.ts`. Les boutons font 44 px de haut au moins et la
// barre n'est jamais une zone de conduite (en spectateur, le jeu ne monte pas les commandes tactiles : il n'y a pas de frontière entre zones à éviter).
// Les textes (étiquettes des boutons, vitesses) suivent la langue : la barre se redessine au changement de langue.

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
  root.classList.add("plaque", "dj-sombre");
  root.setAttribute("role", "group");
  let state: { paused: boolean; speed: WatchSpeed; camera: string } | null = null;

  const button = (id: string, label: string, onClick: () => void, ...contenu: (Node | string)[]) => {
    const b = document.createElement("button");
    b.type = "button";
    b.id = id;
    b.className = "plaque plaque--bouton lecture__bouton";
    b.append(...contenu);
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
  progress.className = "lecture__progression";
  progress.min = "0";
  progress.max = "1000";
  progress.step = "1";
  progress.value = "0";
  let dragging = false;
  progress.addEventListener("pointerdown", () => (dragging = true));
  const release = () => (dragging = false);
  progress.addEventListener("pointerup", release);
  progress.addEventListener("pointercancel", release);
  progress.addEventListener("input", () => h.onSeek(Number(progress.value) / 1000));
  progress.addEventListener("change", () => progress.blur());

  const back = button("watch-back", "", h.onRewind);
  const play = button("watch-play", "", h.onTogglePause);
  const cam = button("watch-camera", "", h.onCamera, iconeTrack("camera"));
  const group = document.createElement("div");
  group.className = "segment lecture__vitesses";
  group.setAttribute("role", "group");
  const speeds = new Map<WatchSpeed, HTMLButtonElement>();
  for (const s of WATCH_SPEEDS) {
    const b = document.createElement("button");
    b.type = "button";
    b.id = `watch-speed-${String(s).replace(".", "_")}`;
    b.className = "segment__bouton";
    b.dataset.speed = String(s);
    b.addEventListener("click", () => {
      b.blur();
      h.onSpeed(s);
    });
    group.append(b);
    speeds.set(s, b);
  }
  const row = document.createElement("div");
  row.className = "lecture__ligne";
  row.append(back, play, group, cam);
  root.replaceChildren(progress, row);

  /** Les textes qui dépendent de la langue et de l'état (appelé au changement de l'un ou de l'autre). */
  const paint = () => {
    root.setAttribute("aria-label", t("revoir.barre"));
    progress.setAttribute("aria-label", t("revoir.progression"));
    group.setAttribute("aria-label", t("revoir.vitesses"));
    const retour = t("revoir.retour", { n: REWIND_SECONDS });
    back.title = retour;
    back.setAttribute("aria-label", retour);
    back.replaceChildren(t("revoir.retourCourt", { n: fNombre(REWIND_SECONDS) }));
    for (const [s, b] of speeds) {
      b.textContent = speedShort(s);
      b.title = t("revoir.vitesse", { vitesse: speedLabel(s) });
      b.setAttribute("aria-label", b.title);
    }
    if (state) {
      const label = state.paused ? t("revoir.reprendre") : t("revoir.pause");
      play.replaceChildren(iconeTrack(state.paused ? "lecture" : "pause"));
      play.dataset.etat = state.paused ? "pause" : "lecture";
      play.title = label;
      play.setAttribute("aria-label", label);
      for (const [s, b] of speeds) {
        b.setAttribute("aria-pressed", String(s === state.speed));
        b.classList.toggle("on", s === state.speed);
      }
      const camLabel = t("revoir.cameraActive", { nom: aCle(`revoir.cameras.${state.camera}`) ? t(`revoir.cameras.${state.camera}`) : state.camera });
      cam.title = camLabel;
      cam.setAttribute("aria-label", camLabel);
    }
  };
  paint();
  onLangue(() => {
    shown = "";
    paint();
  });

  let shown = "";
  return {
    update(v) {
      const key = `${v.paused}|${v.speed}|${v.camera}`;
      if (key !== shown) {
        shown = key;
        state = { paused: v.paused, speed: v.speed, camera: v.camera };
        paint();
      }
      if (!dragging) progress.value = String(Math.round(v.progress * 1000));
    },
    show(visible) {
      root.hidden = !visible;
    },
  };
}
