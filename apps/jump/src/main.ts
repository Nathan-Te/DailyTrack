import { parisDay } from "@cdj/clock";
import { formatDay } from "@cdj/core";
import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  ATTEMPT_READY,
  DANGERS_LEVEL,
  DEATH_NAMES,
  DEFAULT_JUMP_PARAMS,
  ESSAI_LEVEL,
  INPUT_MASK,
  JUMP_SIM_VERSION,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  RESPAWN_TICKS,
  SANDBOX_LEVEL,
  TICK_RATE,
  UNITS_PER_TILE,
  playerMode,
  sawCenters,
  type AttemptState,
  type JumpParams,
  type Level,
  type PlayerState,
} from "@cdj/jump-sim";
import { followCamera, snapCamera, type CameraView, type Follow } from "./camera";
import { Controls } from "./input";
import { animateLook, onStep, restLook, type Look } from "./look";
import { BurstPool, Shake } from "./fx";
import { mountHud } from "./hud";
import { FixedStepper } from "./loop";
import { paletteForDay } from "./palette";
import { createScene, type JumpScene } from "./scene";
import { JumpSession, formatTicks, type SessionEvent } from "./session";
import { wantsTouch } from "./touch";
import { mountTouchUi, type TouchUi } from "./touchUi";
import { loadTuned, mountTunePanel } from "./tune";
import { readUrlOptions, type Scenario } from "./urlOptions";

// Lot 2 : dangers (pics, scies fixes et mobiles, blocs friables, ressorts), mort instantanée, réapparition en 0,15 s, chrono par essai,
// arrivée ; HUD (chrono, meilleur temps, morts), bandeau d'arrivée, éclatement et tremblement à la mort (`?fx=off` les coupe),
// `?debug&hitbox` (boîtes justes), scénarios `essai` (par défaut) et `dangers`.
// Lot 1b : commandes tactiles (zones sans trou, glissement ← →, saut au second doigt), page adaptée au téléphone, réglages au doigt.
// Lot 1 : le personnage. Boucle à pas fixe (120 Hz) sur `stepPlayer`, rendu interpolé, caméra qui suit, clavier et manette,
// surimpression et `window.__jump` avec `?debug`, panneau de réglages avec `?debug&tune`. Pas encore de danger ni d'arrivée.

/** `ready` : l'essai attend la première commande ; `playing` : en course ; `dead` : éclaté, nouvel essai dans un instant ; `finished` : arrivé. */
type Phase = "loading" | "ready" | "playing" | "dead" | "finished" | "no-webgl";

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

/** L'essai tel que `__jump.attempt` le montre. */
export interface AttemptView {
  status: "attend" | "course" | "mort" | "arrivé";
  /** Chrono de l'essai, en pas, et affiché. */
  time: number;
  timeText: string;
  /** Pas depuis la mort (tant que mort) ; nouvel essai à `respawnTicks`. */
  deathTicks: number;
  respawnTicks: number;
  /** Session : morts, essais, meilleur temps (pas), dernière mort (cause, centre en tuiles, chrono). */
  deaths: number;
  attempts: number;
  best: number | null;
  bestText: string | null;
  lastDeath: { cause: string; x: number; y: number; time: number } | null;
  /** Point de passage retenu (indice, −1 aucun) et nombre de points du niveau (lot 2b). */
  checkpoint: number;
  checkpoints: number;
  /** Centres des scies, en tuiles. */
  saws: { x: number; y: number }[];
  crumbles: number[];
  sections: number[];
  raw: AttemptState;
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
  /** L'essai en cours et la session (lot 2). */
  readonly attempt: AttemptView;
  /** Effets de la mort : éclats émis, encore visibles, tremblement en cours ; `enabled` faux avec `?fx=off`. */
  readonly fx: { enabled: boolean; emitted: number; alive: number; shaking: boolean };
  /** Bandeau d'arrivée affiché. */
  readonly banner: boolean;
  /** Les réglages en vigueur (modifiés en place par le panneau). */
  params: JumpParams;
  /** Partie aux réglages modifiés : jamais enregistrée. */
  readonly tuned: boolean;
  /** Pas joués depuis le départ. */
  readonly ticks: number;
  /** Tactile (lot 1b) : interface active, doigts posés (rôle et position), commande qu'ils donnent, panneau de réglages ouvert (jeu en pause). */
  readonly touch: { active: boolean; fingers: { id: number; role: string; x: number; y: number }[]; bits: number; paused: boolean; panelOpen: boolean; viewTiles: number };
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
const LEVELS: Record<Scenario, Level> = { essai: ESSAI_LEVEL, dangers: DANGERS_LEVEL, "bac-a-sable": SANDBOX_LEVEL };
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

const burst = options.fx ? new BurstPool() : null;
const shake = new Shake();
let scene: JumpScene | null = null;
try {
  scene = createScene(document.body, level, palette, { hitbox: options.hitbox, burst });
} catch {
  scene = null;
}

const T = UNITS_PER_TILE;
const touchOn = wantsTouch(options.touch, window.matchMedia?.("(pointer: coarse)").matches ?? false);
let panelOpen = false;
let touchUi: TouchUi | null = null;
let phase: Phase = "loading";
let manual = false;
let injected: number | null = null;
let look: Look = restLook();
const controls = new Controls();
const stepper = new FixedStepper();

function view(s: PlayerState = session.state.player): PlayerView {
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

const STATUS_NAMES = ["attend", "course", "mort", "arrivé"] as const;

function attemptView(): AttemptView {
  const s = session.state;
  const d = session.lastDeath;
  return {
    status: STATUS_NAMES[s.status]!,
    time: s.time,
    timeText: formatTicks(s.time),
    deathTicks: s.status === ATTEMPT_DEAD ? s.deathTicks : 0,
    respawnTicks: RESPAWN_TICKS,
    deaths: session.deaths,
    attempts: session.attempts,
    best: session.best,
    bestText: session.best === null ? null : formatTicks(session.best),
    lastDeath: d ? { cause: DEATH_NAMES[d.cause] ?? "?", x: d.x / T, y: d.y / T, time: d.time } : null,
    checkpoint: s.checkpoint,
    checkpoints: level.checkpoints.length,
    saws: sawCenters(level, s).map((p) => ({ x: p.x / T, y: p.y / T })),
    crumbles: [...s.crumbles],
    sections: [...s.sections],
    raw: { ...s, player: { ...s.player }, crumbles: [...s.crumbles], sections: [...s.sections], tiles: [] },
  };
}

function phaseOf(s: AttemptState): Phase {
  if (s.status === ATTEMPT_READY) return "ready";
  if (s.status === ATTEMPT_DEAD) return "dead";
  if (s.status === ATTEMPT_FINISHED) return "finished";
  return "playing";
}

function onEvent(e: SessionEvent): void {
  if (e.kind === "death") {
    if (burst) {
      burst.burst(e.x / T, -e.y / T);
      shake.start();
    }
  } else if (e.kind === "checkpoint") hud.toast("Point de passage");
  else if (e.kind === "respawn") {
    look = restLook();
    if (scene) camera = snapCamera(follow(session.state.player), scene.frame);
    stepper.reset();
  } else if (e.kind === "finish") hud.finish(session);
}

function stepOnce(): void {
  const bits = injected ?? controls.sample();
  const prev = session.state;
  const event = session.step(bits);
  if (session.state.status !== ATTEMPT_DEAD && prev.status !== ATTEMPT_DEAD) look = onStep(look, prev.player, session.state.player, session.params.fallSpeed);
  if (event) onEvent(event);
  if (phase !== "loading" && phase !== "no-webgl") phase = phaseOf(session.state);
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
  hud.hideFinish();
  if (scene) camera = snapCamera(follow(session.state.player), scene.frame);
  if (phase !== "loading" && phase !== "no-webgl") phase = phaseOf(session.state);
}

const hud = mountHud({ onRestart: () => controls.requestRestart() });

// ——— Surimpression de `?debug` ———
const overlay = options.debug ? document.getElementById("debug") : null;
const tunedBadge = document.getElementById("tuned")!;
const fmt = (v: number, d = 1) => v.toFixed(d).replace(".", ",");

function updateOverlay(): void {
  tunedBadge.textContent = session.tuned ? "réglages modifiés" : "";
  if (!overlay) return;
  const v = view();
  const st = session.state;
  const side = st.player.slide < 0 ? " (gauche)" : st.player.slide > 0 ? " (droite)" : "";
  const d = session.lastDeath;
  const death = d ? `${DEATH_NAMES[d.cause]} (colonne ${fmt(d.x / T, 1)} · rangée ${fmt(d.y / T, 1)})` : "aucune";
  overlay.textContent = [
    `essai     n° ${session.attempts} · ${STATUS_NAMES[st.status]} · ${formatTicks(st.time)} · morts ${session.deaths} · point ${st.checkpoint < 0 ? "aucun" : `${st.checkpoint + 1}/${level.checkpoints.length}`}`,
    `mort      ${death}`,
    `vitesse   → ${fmt(v.vx)}  ↑ ${fmt(-v.vy)} tuiles/s`,
    `état      ${v.mode}${side}`,
    `coyote    ${v.coyote}/${params.coyote}   tampon ${v.buffer}/${params.jumpBuffer}   verrou ${v.lock}`,
    `position  colonne ${fmt(v.x, 2)} · rangée ${fmt(v.y, 2)}   pas ${session.ticks}`,
    options.hitbox ? "boîtes justes (hitbox)" : "",
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
  get attempt() {
    return attemptView();
  },
  get fx() {
    return { enabled: !!burst, emitted: burst?.emitted ?? 0, alive: burst?.alive ?? 0, shaking: shake.active };
  },
  get banner() {
    return hud.finishShown;
  },
  params,
  get tuned() {
    return session.tuned;
  },
  get ticks() {
    return session.ticks;
  },
  get touch() {
    const fingers = touchUi?.pad.list() ?? [];
    return {
      active: touchOn,
      fingers,
      bits: touchUi?.pad.bits ?? 0,
      paused: panelOpen,
      panelOpen,
      viewTiles: scene ? scene.frame.halfH * 2 : 0,
    };
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

/** Ouvre ou ferme le panneau de réglages (téléphone) : ouvert, la partie est en pause et la couche tactile ne capte plus rien. */
function setPanel(open: boolean): void {
  panelOpen = open;
  document.getElementById("tune")!.hidden = !open;
  touchUi?.suspend(open);
  controls.setTouch(0, false);
  stepper.reset();
}

if (touchOn) {
  touchUi = mountTouchUi({ controls, forced: options.touch === "1", zones: options.zones, tune: options.tune, onRestart: () => controls.requestRestart(), onGear: () => setPanel(true) });
}

if (options.tune) {
  const panel = document.getElementById("tune")!;
  mountTunePanel(panel, params, () => updateOverlay(), touchOn ? { onClose: () => setPanel(false) } : {});
}

/** Dessine l'image : personnage interpolé entre l'état précédent et l'état courant (`alpha`), caméra lissée sur `dt` secondes. */
let clock = 0;
function draw(alpha: number, dt: number): void {
  if (!scene) return;
  clock += dt;
  const sa = session.prev;
  const sb = session.state;
  const a = sa.player;
  const b = sb.player;
  const x = (a.x + (b.x - a.x) * alpha) / T;
  const y = (a.y + (b.y - a.y) * alpha) / T;
  look = animateLook(look, dt, (-b.vy * TICK_RATE) / T);
  scene.setPlayer({ x, y, look, visible: sb.status !== ATTEMPT_DEAD });
  burst?.update(dt);
  scene.setWorld(sa, sb, alpha, clock);
  // Mort : la caméra reste où l'on est mort (l'éclatement se voit) ; le nouvel essai la repose au départ.
  if (sb.status !== ATTEMPT_DEAD) {
    const f = follow(b);
    camera = followCamera(camera, { ...f, cx: x + PLAYER_WIDTH / T / 2, cy: -(y + PLAYER_HEIGHT / T / 2) }, scene.frame, dt);
  }
  const jolt = burst ? shake.offset(dt) : { x: 0, y: 0 };
  scene.setView(camera.x + jolt.x, camera.y + jolt.y);
  scene.render();
  hud.update(session);
}

if (!scene) {
  document.getElementById("nogl")!.style.display = "flex";
  phase = "no-webgl";
} else {
  const s = scene;
  s.resize(touchOn);
  camera = snapCamera(follow(session.state.player), s.frame);
  const onResize = () => {
    s.resize(touchOn);
    draw(manual ? 1 : stepper.alpha, 0);
  };
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  let last = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.25);
    last = now;
    controls.pollPad();
    if (controls.takeRestart()) restart();
    if (!manual && !panelOpen) {
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

