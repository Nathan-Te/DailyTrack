import { parisDay } from "@cdj/clock";
import { formatDay } from "@cdj/core";
import { JUMP_SIM_VERSION } from "@cdj/jump-sim";
import { paletteForDay } from "./palette";
import { createScene, type JumpScene } from "./scene";
import { TEST_LEVEL } from "./testLevel";

// Lot 0 : le socle. Une grille d'essai, le personnage immobile sur le départ, la palette du jour, la version et le jour en coin.
// Aucun gameplay. Pas d'API, rien dans le stockage local (le préfixe `jump:` existe : voir storage.ts).

type Phase = "loading" | "ready" | "no-webgl";

/** Ce que `?debug` expose sur `window.__jump` (lu par les tests de navigateur). */
export interface JumpDebug {
  phase: Phase;
  /** Jour du jeu affiché (AAAA-MM-JJ). */
  day: string;
  simVersion: number;
  palette: string;
  /** Redessine, relit les pixels de l'image et compte les couleurs : preuve qu'un rendu non vide est à l'écran. */
  probe(): { width: number; height: number; colors: number; background: number };
}

declare global {
  interface Window {
    __jump?: JumpDebug;
  }
}

const params = new URLSearchParams(location.search);
const debug = params.has("debug");

const day = parisDay(Date.now());
const dayText = formatDay(day);
const palette = paletteForDay(day);

const stamp = document.getElementById("stamp")!;
stamp.textContent = `DailyJump · sim v${JUMP_SIM_VERSION} · ${dayText}`;
document.documentElement.style.background = `#${palette.background.toString(16).padStart(6, "0")}`;

let scene: JumpScene | null = null;
try {
  scene = createScene(document.body, TEST_LEVEL, palette);
} catch {
  scene = null;
}

const info: JumpDebug = {
  phase: "loading",
  day: dayText,
  simVersion: JUMP_SIM_VERSION,
  palette: palette.name,
  probe() {
    if (!scene) return { width: 0, height: 0, colors: 0, background: 0 };
    scene.render();
    const gl = scene.renderer.getContext();
    const width = gl.drawingBufferWidth;
    const height = gl.drawingBufferHeight;
    const px = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const seen = new Set<number>();
    const bg = palette.background;
    let background = 0;
    let total = 0;
    for (let i = 0; i < px.length; i += 4 * 5) {
      const rgb = (px[i]! << 16) | (px[i + 1]! << 8) | px[i + 2]!;
      seen.add(rgb);
      total++;
      if (rgb === bg) background++;
    }
    return { width, height, colors: seen.size, background: total ? background / total : 0 };
  },
};
if (debug) window.__jump = info;

if (!scene) {
  document.getElementById("nogl")!.style.display = "flex";
  info.phase = "no-webgl";
} else {
  const view = scene;
  const draw = () => view.render();
  window.addEventListener("resize", () => {
    view.resize();
    draw();
  });
  // Pour parcourir la grille d'essai (deux écrans et demi) : flèches, molette ou glisser. Présentation seule ; la vraie caméra arrive au lot 1.
  const scrollBy = (tiles: number) => {
    view.scrollTo(view.centerX + tiles);
    draw();
  };
  window.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") scrollBy(2);
    else if (e.key === "ArrowLeft") scrollBy(-2);
  });
  window.addEventListener(
    "wheel",
    (e) => {
      scrollBy(((e.deltaX || e.deltaY) / Math.max(1, window.innerHeight)) * 18);
    },
    { passive: true },
  );
  let dragX: number | null = null;
  window.addEventListener("pointerdown", (e) => (dragX = e.clientX));
  window.addEventListener("pointermove", (e) => {
    if (dragX === null) return;
    scrollBy(((dragX - e.clientX) / Math.max(1, window.innerHeight)) * 18);
    dragX = e.clientX;
  });
  const stop = () => (dragX = null);
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);

  draw();
  info.phase = "ready";
}
