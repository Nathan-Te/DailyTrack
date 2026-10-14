import { parisDay } from "@cdj/clock";
import { formatDay } from "@cdj/core";
import {
  DEFAULT_JUMP_PARAMS,
  INPUT_MASK,
  JUMP_SIM_VERSION,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  SANDBOX_LEVEL,
  TICK_RATE,
  UNITS_PER_TILE,
  playerMode,
  type JumpParams,
  type Level,
  type PlayerState,
} from "@cdj/jump-sim";
import { followCamera, snapCamera, type CameraView, type Follow } from "./camera";
import { Controls } from "./input";
import { animateLook, onStep, restLook, type Look } from "./look";
import { FixedStepper } from "./loop";
import { paletteForDay } from "./palette";
import { createScene, type JumpScene } from "./scene";
import { JumpSession } from "./session";
import { loadTuned, mountTunePanel } from "./tune";
import { readUrlOptions, type Scenario } from "./urlOptions";

// Lot 1 : le personnage. Boucle à pas fixe (120 Hz) sur `stepPlayer`, rendu interpolé, caméra qui suit, clavier et manette,
// surimpression et `window.__jump` avec `?debug`, panneau de réglages avec `?debug&tune`. Pas encore de danger ni d'arrivée.

type Phase = "loading" | "ready" | "playing" | "no-webgl";

/** Le personnage tel que `__jump.player` le montre : unités humaines, plus l'état brut de la simulation. */
export interface PlayerView {
  /** Coin haut-gauche de la boîte, en tuiles (y vers le bas). */
  x: number;
  y: number;
  /** Vitesse, en tuiles/s (vy > 0 : vers le bas). */
  vx: number;
  vy: number;
  mode: "sol" | "air" | "mur";
  ground: boolean;
  /** Pas de coyote restants, de tampon, de verrou. */
  coyote: number;
  buffer: number;
  lock: number;
  raw: PlayerState;
}

/** Ce que `?debug` expose sur `window.__jump` (lu par les tests de navigateur). */
export interface JumpDebug {
  phase: Phase;
  /** Jour du jeu affiché (AAAA-MM-JJ). */
  day: string;
  simVersion: number;
  palette: string;
  scenario: Scenario;
  readonly player: PlayerView;
  /** Les réglages en vigueur (modifiés en place par le panneau). */
  params: JumpParams;
  /** Partie aux réglages modifiés : jamais enregistrée. */
  readonly tuned: boolean;
  /** Pas joués depuis le départ. */
  readonly ticks: number;
  /** Pas à pas : la boucle ne fait plus avancer la simulation, seul `advance` le fait (sans rendu). */
  manual(on: boolean): void;
  /** Joue `n` pas tout de suite (commande injectée, sinon clavier et manette) et renvoie le personnage. */
  advance(n: number): PlayerView;
  /** Impose les 3 bits de commande des pas suivants (`null` : rendre la main au clavier et à la manette). */
  input(bits: number | null): void;
  /** Comme la touche R. */
  restart(): void;
  /** Redessine, relit les pixels de l'image et compte les couleurs : preuve qu'un rendu non vide est à l'écran. */
  probe(): { width: number; height: number; colors: number; background: number };
}

declare global {
  interface Window {
    __jump?: JumpDebug;
  }
}

const options = readUrlOptions(location.search);
const LEVELS: Record<Scenario, Level> = { "bac-a-sable": SANDBOX_LEVEL };
const level = LEVELS[options.scenario];

const day = parisDay(Date.now());
const dayText = formatDay(day);
const palette = paletteForDay(day);

const stamp = document.getElementById("stamp")!;
stamp.textContent = `DailyJump · sim v${JUMP_SIM_VERSION} · ${dayText}`;
document.documentElement.style.background = `#${palette.background.toString(16).padStart(6, "0")}`;

// Réglages : les défauts, sauf en `?debug&tune` où le panneau reprend ceux qu'on avait laissés (`jump:tune`).
const params: JumpParams = options.tune ? loadTuned() : { ...DEFAULT_JUMP_PARAMS };
const session = new JumpSession(level, params);

let scene: JumpScene | null = null;
try {
  scene = createScene(document.body, level, palette);
} catch {
  scene = null;
}

const T = UNITS_PER_TILE;
let phase: Phase = "loading";
let manual = false;
let injected: number | null = null;
let look: Look = restLook();
const controls = new Controls();
const stepper = new FixedStepper();

function view(s: PlayerState = session.state): PlayerView {
  const p = session.params;
  return {
    x: s.x / T,
    y: s.y / T,
    vx: (s.vx * TICK_RATE) / T,
    vy: (s.vy * TICK_RATE) / T,
    mode: playerMode(s),
    ground: s.ground === 1,
    coyote: s.ground ? p.coyote : s.air <= p.coyote ? p.coyote - s.air : 0,
    buffer: s.buffer,
    lock: s.lock,
    raw: { ...s },
  };
}

function stepOnce(): void {
  const bits = injected ?? controls.sample();
  if (bits !== 0 && phase === "ready") phase = "playing";
  const prev = session.state;
  session.step(bits);
  look = onStep(look, prev, session.state, session.params.fallSpeed);
}

function follow(s: PlayerState): Follow {
  return { cx: (s.x + PLAYER_WIDTH / 2) / T, cy: -(s.y + PLAYER_HEIGHT / 2) / T, vx: (s.vx * TICK_RATE) / T, ground: s.ground === 1 };
}

let camera: CameraView = { x: 0, y: 0, ahead: 0 };

function restart(): void {
  session.restart();
  controls.resetLatch();
  stepper.reset();
  look = restLook();
  if (scene) camera = snapCamera(follow(session.state), scene.frame);
  if (phase === "playing") phase = "ready";
}

// ——— Surimpression de `?debug` ———
const overlay = options.debug ? document.getElementById("debug") : null;
const tunedBadge = document.getElementById("tuned")!;
const fmt = (v: number, d = 1) => v.toFixed(d).replace(".", ",");

function updateOverlay(): void {
  tunedBadge.textContent = session.tuned ? "réglages modifiés" : "";
  if (!overlay) return;
  const v = view();
  const side = session.state.slide < 0 ? " (gauche)" : session.state.slide > 0 ? " (droite)" : "";
  overlay.textContent = [
    `vitesse   → ${fmt(v.vx)}  ↑ ${fmt(-v.vy)} tuiles/s`,
    `état      ${v.mode}${side}`,
    `coyote    ${v.coyote}/${params.coyote}   tampon ${v.buffer}/${params.jumpBuffer}   verrou ${v.lock}`,
    `position  colonne ${fmt(v.x, 2)} · rangée ${fmt(v.y, 2)}   pas ${session.ticks}`,
    manual ? "pas à pas (manual)" : "",
  ]
    .filter(Boolean)
    .join("\n");
}

const info: JumpDebug = {
  get phase() {
    return phase;
  },
  set phase(p: Phase) {
    phase = p;
  },
  day: dayText,
  simVersion: JUMP_SIM_VERSION,
  palette: palette.name,
  scenario: options.scenario,
  get player() {
    return view();
  },
  params,
  get tuned() {
    return session.tuned;
  },
  get ticks() {
    return session.ticks;
  },
  manual(on: boolean) {
    manual = on;
    stepper.reset();
  },
  advance(n: number) {
    for (let i = 0; i < n; i++) stepOnce();
    return view();
  },
  input(bits: number | null) {
    if (bits !== null && (!Number.isInteger(bits) || bits < 0 || bits > INPUT_MASK)) throw new RangeError(`Commande invalide : ${bits}`);
    injected = bits;
  },
  restart,
  probe() {
    if (!scene) return { width: 0, height: 0, colors: 0, background: 0 };
    draw(1, 0);
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
if (options.debug) {
  window.__jump = info;
  overlay?.removeAttribute("hidden");
}

if (options.tune) {
  const panel = document.getElementById("tune")!;
  mountTunePanel(panel, params, () => updateOverlay());
}

/** Dessine l'image : personnage interpolé entre l'état précédent et l'état courant (`alpha`), caméra lissée sur `dt` secondes. */
function draw(alpha: number, dt: number): void {
  if (!scene) return;
  const a = session.prev;
  const b = session.state;
  const x = (a.x + (b.x - a.x) * alpha) / T;
  const y = (a.y + (b.y - a.y) * alpha) / T;
  look = animateLook(look, dt, (-b.vy * TICK_RATE) / T);
  scene.setPlayer({ x, y, look });
  const f = follow(b);
  camera = followCamera(camera, { ...f, cx: x + PLAYER_WIDTH / T / 2, cy: -(y + PLAYER_HEIGHT / T / 2) }, scene.frame, dt);
  scene.setView(camera.x, camera.y);
  scene.render();
}

if (!scene) {
  document.getElementById("nogl")!.style.display = "flex";
  phase = "no-webgl";
} else {
  const s = scene;
  s.resize();
  camera = snapCamera(follow(session.state), s.frame);
  window.addEventListener("resize", () => {
    s.resize();
    draw(manual ? 1 : stepper.alpha, 0);
  });
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.25);
    last = now;
    controls.pollPad();
    if (controls.takeRestart()) restart();
    if (!manual) {
      const steps = stepper.advance(dt);
      for (let i = 0; i < steps; i++) stepOnce();
    }
    draw(manual ? 1 : stepper.alpha, dt);
    updateOverlay();
    requestAnimationFrame(frame);
  };
  draw(1, 0);
  updateOverlay();
  phase = "ready";
  requestAnimationFrame(frame);
}

