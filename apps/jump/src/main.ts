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
  ESSAI_SOLUTION_CODE,
  INPUT_MASK,
  JUMP_SIM_VERSION,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  RESPAWN_TICKS,
  SANDBOX_LEVEL,
  TICK_RATE,
  UNITS_PER_TILE,
  decodeReplay,
  demoAttempts,
  fromRuns,
  lifeReplay,
  playerMode,
  replayAttempt,
  runsTicks,
  sawCenters,
  buildModule,
  dailyLevel,
  replayStartState,
  type AttemptState,
  type DailyLevel,
  type JumpParams,
  type JumpReplay,
  type Level,
  type PlayerState,
} from "@cdj/jump-sim";
import { CrowdMesh, GhostMesh, StainLayer } from "./actors";
import { Carnage, HERO, carnageLabel } from "./carnage";
import { Ghost } from "./ghost";
import { DayMemory, browserStorage, clearAll, loadGhostSetting, saveGhostSetting, type RecordedEssai } from "./memory";
import { stainFor } from "./stains";
import { followCamera, snapCamera, type CameraView, type Follow } from "./camera";
import { Controls } from "./input";
import { animateLook, onStep, restLook, type Look } from "./look";
import { BurstMesh, BurstPool, Shake } from "./fx";
import { mountHud } from "./hud";
import { FixedStepper } from "./loop";
import { paletteForDay } from "./palette";
import { createScene, type JumpScene } from "./scene";
import { JumpSession, formatTicks, type SessionEvent } from "./session";
import { wantsTouch } from "./touch";
import { mountTouchUi, type TouchUi } from "./touchUi";
import { loadTuned, mountTunePanel } from "./tune";
import { LAUNCH_TILES, nextModule, referenceTicks, solutionReplay } from "./modulesInfo";
import { dailyHref, moduleHref, readUrlOptions, type Scenario } from "./urlOptions";
import { NEW_DAY_TEXT, REFUSED_TEXT, chooseDay, dayLine, finishMedalText, isPreview, type DayChoice } from "./dailyInfo";

// Lot 5 : le niveau du jour (`dailyLevel`) est la page par défaut ; `?seed=AAAA-MM-JJ` ouvre celui d'une date (archive, ou à venir sur un
// aperçu : le site publié refuse les dates futures, `dailyInfo.ts`) ; HUD « DailyJump #N » et médaille visée, médaille et temps de l'auteur
// à l'arrivée, `&solution` (la rediffusion de l'auteur), `?debug` (limites des morceaux, `__jump.daily`), passage de minuit.
// Lot 3 : rediffusions. Chaque essai est enregistré puis **rejoué** par la mémoire du jour (`memory.ts`), qui garde le meilleur essai, les
// vies et les morts du jour (stockage `jump:`, protégé : le jeu marche sans). Fantôme du meilleur essai calé sur le chrono (`ghost.ts`),
// carnage par vagues à l'arrivée (`carnage.ts`), taches de peinture (`stains.ts`), lecture `?watch=best`, démonstration `?carnage=demo`.
// Rien n'est enregistré avec des réglages modifiés.
// Lot 2 : dangers (pics, scies fixes et mobiles, blocs friables, ressorts), mort instantanée, réapparition en 0,15 s, chrono par essai,
// arrivée ; HUD (chrono, meilleur temps, morts), bandeau d'arrivée, éclatement et tremblement à la mort (`?fx=off` les coupe),
// `?debug&hitbox` (boîtes justes), scénarios `essai` (par défaut) et `dangers`.
// Lot 1b : commandes tactiles (zones sans trou, glissement ← →, saut au second doigt), page adaptée au téléphone, réglages au doigt.
// Lot 1 : le personnage. Boucle à pas fixe (120 Hz) sur `stepPlayer`, rendu interpolé, caméra qui suit, clavier et manette,
// surimpression et `window.__jump` avec `?debug`, panneau de réglages avec `?debug&tune`. Pas encore de danger ni d'arrivée.

/**
 * `ready` : l'essai attend la première commande ; `playing` : en course ; `dead` : éclaté, nouvel essai dans un instant ; `finished` : arrivé ;
 * `carnage` : toutes les vies du jour rejouées (lot 3).
 */
type Phase = "loading" | "ready" | "playing" | "dead" | "finished" | "carnage" | "no-webgl";

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
  /** Le niveau écrit à la main ouvert (`?scenario=`), null : le niveau du jour (lot 5) ou un morceau. */
  scenario: Scenario | null;
  /** Lot 5 : le niveau du jour (null pour un scénario ou un morceau). */
  readonly daily: DailyView | null;
  /** Lot 4 : le morceau joué (`?module=`), son temps de référence (pas) ; null pour un scénario. */
  module: { id: string; variant: number; entry: "arret" | "elan"; solution: boolean; levelId: string; reference: number | null; next: string } | null;
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
  /** Lot 3 : rediffusions du jour (meilleur essai, vies) ; exporter et importer en base64url. */
  readonly replays: {
    list(): { kind: "meilleur" | "vie"; essai: number; ticks: number; time?: number; deaths?: number; code: string }[];
    /** Texte du meilleur essai (`"best"`) ou de la vie n° `i` (null s'il n'y en a pas). */
    export(which?: "best" | number): string | null;
    /** Importe une rediffusion comme meilleur essai, si le rejeu la valide. */
    import(code: string): { ok: true; time: number } | { ok: false; reason: string };
  };
  /** Lot 3 : le carnage. */
  readonly carnage: {
    readonly state: CarnageView;
    /** Démarre un carnage sur le meilleur essai du jour (héros) et les autres vies du jour. Faux s'il n'y a pas de meilleur essai. */
    start(): boolean;
    /**
     * Carnage de démonstration (`?carnage=demo`) : `lives` vies fictives (par défaut, celles de la démonstration ; plus, elles sont reprises).
     * `crowd` (mesure) : `lives` copies de la solution, qui courent toutes en même temps jusqu'au bout.
     */
    demo(lives?: number, crowd?: boolean): boolean;
    /** Comme une commande : passe le carnage. */
    skip(): void;
  };
  /** Lot 3 : stockage local (`jump:*`). */
  readonly storage: { clear(): number; size(): number; readonly memory: { best: number | null; lives: number; deaths: number; positions: { x: number; y: number }[] } };
  /** Lot 3 : fantôme (réglage, visible, où il en est). */
  readonly ghost: { enabled: boolean; available: boolean; visible: boolean; tick: number; status: string; x: number; y: number };
  /** Bascule le fantôme (comme G ou le bouton 👻). */
  toggleGhost(): boolean;
  /** Lot 3 : taches à l'écran. */
  readonly stains: { count: number; discs: number; added: number };
  /** Lecture `?watch=best` en cours. */
  readonly watching: boolean;
  /**
   * Temps de fil principal (ms), mesuré sur les 600 dernières images : par image (moyenne, 95e centile), et séparément la simulation **par
   * pas** et le dessin **par image** (le rendu logiciel fait peu d'images, donc beaucoup de pas par image : ces deux-là se comparent).
   */
  readonly frameTimes: { mean: number; p95: number; frames: number; stepMs: number; drawMs: number; reset(): void };
}

/** Le niveau du jour tel que `__jump.daily` le montre (lot 5). */
export interface DailyView {
  date: string;
  number: number;
  id: string;
  /** Aujourd'hui (date de Paris lue au chargement) ; `jour`, `archive` ou `futur` ; site publié ou aperçu ; date future refusée. */
  today: string;
  mode: DayChoice["mode"];
  preview: boolean;
  refused: boolean;
  hash: string;
  width: number;
  height: number;
  pieces: { id: string; variant: number; entry: string; exigence: number; tags: readonly string[]; col0: number; col1: number; start: number; end: number }[];
  attempts: { index: number; status: string; reason: string; pieces: string[]; ticks: number; rate: number; score: number }[];
  chosen: number;
  fallback: boolean;
  authorTicks: number;
  medals: { author: number; gold: number; silver: number; bronze: number };
  exigence: { sum: number; rate: number; thirds: readonly number[] };
  /** La rediffusion de l'auteur (base64url). */
  code: string;
  /** Médaille de la dernière arrivée (null : aucune, ou pas encore d'arrivée). */
  lastMedal: string | null;
  /** Passage de minuit : un nouveau niveau attend la prochaine commande « recommencer ». */
  newDay: boolean;
  /** Message discret affiché (date refusée, nouveau niveau), "" sinon. */
  notice: string;
  /** Ligne du HUD. */
  line: string;
}

export interface CarnageView {
  active: boolean;
  demo: boolean;
  /** Vies du carnage (héros compris), arrivées et morts jusqu'ici, vies en course, pas du héros. */
  lives: number;
  arrivals: number;
  deaths: number;
  running: number;
  tick: number;
  heroTicks: number;
  label: string;
}

declare global {
  interface Window {
    __jump?: JumpDebug;
  }
}

const options = readUrlOptions(location.search);
const LEVELS: Record<Scenario, Level> = { essai: ESSAI_LEVEL, dangers: DANGERS_LEVEL, "bac-a-sable": SANDBOX_LEVEL };
// Lot 5 : « aujourd'hui » = la date de Paris (`@cdj/clock`), lue ici, hors de la simulation ; le niveau du jour en découle.
const today = parisDay(Date.now());
const preview = isPreview(location);
const choice: DayChoice | null = options.daily ? chooseDay(options.seed, today, preview) : null;
const daily: DailyLevel | null = choice ? dailyLevel(choice.day) : null;
// Lot 4 : un morceau du catalogue (`?module=<id>&variante=<n>&entree=arret|elan[&solution]`). En jeu humain avec l'entrée en élan, un
// couloir de lancement est ajouté devant le palier d'entrée ; la solution, elle, part lancée du départ du morceau (sans couloir).
const mod = options.module;
const built = mod ? buildModule(mod.id, mod.variant, { lancement: mod.entry === "elan" && !mod.solution ? LAUNCH_TILES : 0 }) : null;
const level = built ? built.level : daily ? daily.level : LEVELS[options.scenario ?? "essai"];
const reference = mod ? referenceTicks(mod.id, mod.variant, mod.entry, mod.entry === "elan" && !mod.solution) : null;
const nextHref = mod ? moduleHref({ id: nextModule(mod.id), variant: 0, entry: mod.entry }, options) : null;

const dayText = formatDay(today);
// La palette du jour : celle de la date du niveau (une archive garde la sienne).
const palette = paletteForDay(daily ? daily.day : today);

const stamp = document.getElementById("stamp")!;
stamp.textContent = `DailyJump · sim v${JUMP_SIM_VERSION} · ${dayText}`;
if (mod && built) {
  const entryText = mod.entry === "elan" ? "élan" : "arrêt";
  document.getElementById("modname")!.textContent = `${mod.solution ? "Solution · " : ""}${mod.id} · variante ${mod.variant} · ${entryText}`;
  document.title = `DailyJump · ${mod.id}`;
}
if (daily) document.title = daily.number >= 1 ? `DailyJump #${daily.number}` : "DailyJump";
document.documentElement.style.background = `#${palette.background.toString(16).padStart(6, "0")}`;

// Réglages : les défauts, sauf en `?debug&tune` où le panneau reprend ceux qu'on avait laissés (`jump:tune`).
const params: JumpParams = options.tune ? loadTuned() : { ...DEFAULT_JUMP_PARAMS };

// ——— Mémoire du jour (lot 3) : par niveau, purgée au changement de jour ou de niveau ———
// Un morceau : `module:<id>:<variante>` (lot 4), rangé à part selon l'entrée (le niveau à couloir n'est pas le même).
const levelId: string = built ? built.levelId : daily ? daily.id : (options.scenario ?? "essai");
const store = browserStorage();
const memory = new DayMemory({ store, level, levelId, key: mod ? `${levelId}:${mod.entry}` : levelId, today: () => formatDay(parisDay(Date.now())) });
// `?watch=best` : lecture du meilleur essai, sans jouer (rien n'est enregistré). Sans meilleur essai : partie normale et un message.
// `?module=…&solution` : lecture de la solution stockée du morceau (rejouée par la même simulation).
// `&solution` sur le niveau du jour (lot 5) : la rediffusion de l'auteur, la preuve du niveau.
const watchReplay = mod?.solution ? solutionReplay(mod.id, mod.variant, mod.entry) : daily && options.solution ? daily.replay : options.watchBest ? memory.bestReplay() : null;
const watching = watchReplay !== null;
const watchInputs = watchReplay ? fromRuns(watchReplay.runs) : [];
let watchIndex = 0;

const session = new JumpSession(level, params, watching ? null : levelId);
session.best = memory.best?.time ?? null;
if (watchReplay) session.state = replayStartState(level, watchReplay.start);
session.prev = session.state;

const burst = options.fx ? new BurstPool() : null;
const shake = new Shake();
let scene: JumpScene | null = null;
try {
  // `?debug` sur le niveau du jour : les limites des morceaux, avec leur identifiant, leur variante et leur exigence.
  const pieces = options.debug && daily ? daily.pieces.map((p) => ({ col0: p.col0, col1: p.col1, row: p.entryRow, label: `${p.id} v${p.variant} · ${"●".repeat(p.exigence)}${"○".repeat(5 - p.exigence)} ${p.exigence}/5` })) : undefined;
  scene = createScene(document.body, level, palette, { hitbox: options.hitbox, burst, pieces });
} catch {
  scene = null;
}

// ——— Lot 3 : fantôme, taches ———
let ghostOn = !options.ghostOff && loadGhostSetting(store);
let ghost: Ghost | null = null;
const refreshGhost = () => {
  const best = memory.bestReplay();
  try {
    ghost = best && !watching ? new Ghost(level, best) : null;
  } catch {
    ghost = null;
  }
};
refreshGhost();
const ghostMesh = scene ? new GhostMesh(scene.world, palette.player) : null;
const stains = scene ? new StainLayer(scene.world, palette.player, palette.tile) : null;
const storedStains = () => memory.deaths.map((d) => stainFor(level, d.x, d.y));
stains?.reset(storedStains());

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

/** Confie les essais clos à la mémoire du jour (qui les rejoue) ; rend le dernier enregistré. */
function drainEssais(): RecordedEssai | null {
  let last: RecordedEssai | null = null;
  for (let e = session.takeEssai(); e; e = session.takeEssai()) {
    const rec = memory.recordEssai(e.essai, e.tuned);
    if (!rec) continue;
    last = rec;
    if (rec.newBest) refreshGhost();
  }
  // Le meilleur temps affiché est celui que le rejeu a recalculé.
  if (last && memory.best) session.best = memory.best.time;
  return last;
}

// ——— Carnage (lot 3) ———
interface CarnageRun {
  run: Carnage;
  crowd: CrowdMesh;
  demo: boolean;
  /** Commande au pas précédent : seule une nouvelle commande (un appui) passe le carnage. */
  prevBits: number;
}
let carnage: CarnageRun | null = null;
let carnageBurst: { pool: BurstPool; mesh: BurstMesh } | null = null;
/** Zoom arrière du carnage : on voit plus large autour du héros. */
const CARNAGE_ZOOM = 1.3;

function startCarnage(hero: JumpReplay, others: JumpReplay[], demo: boolean, bits = 0): boolean {
  if (!scene || carnage) return false;
  let run: Carnage;
  try {
    run = new Carnage(level, hero, others);
  } catch {
    return false;
  }
  const crowd = new CrowdMesh(scene.world, palette.player, others.length);
  crowd.show(true);
  if (options.fx && !carnageBurst) {
    // Éclats plafonnés : un seul pool, recyclé (les plus vieux éclats repartent d'abord).
    const pool = new BurstPool(384);
    carnageBurst = { pool, mesh: new BurstMesh(pool, palette.player, scene.world) };
  }
  carnage = { run, crowd, demo, prevBits: bits };
  hud.hideFinish();
  ghostMesh?.hide();
  stains?.reset([]);
  scene.zoom = CARNAGE_ZOOM;
  scene.resize(touchOn);
  camera = snapCamera(follow(run.hero.state.player), scene.frame);
  stepper.reset();
  phase = "carnage";
  hud.carnage(carnageLabel(run.total, 0));
  return true;
}

function endCarnage(): void {
  const c = carnage;
  if (!c || !scene) return;
  carnage = null;
  c.crowd.dispose(scene.world);
  carnageBurst?.pool.clear();
  hud.carnage(null);
  stains?.reset(storedStains());
  scene.zoom = 1;
  scene.resize(touchOn);
  stepper.reset();
  if (c.demo) {
    restart();
    hud.toast("Fin de la démonstration");
  } else {
    phase = phaseOf(session.state);
    camera = snapCamera(follow(session.state.player), scene.frame);
    hud.finish(session, finishOptions());
  }
}

/** Un pas du carnage ; une nouvelle commande le passe. */
function stepCarnage(): void {
  const c = carnage!;
  const bits = injected ?? controls.sample();
  const pressed = bits & ~c.prevBits;
  c.prevBits = bits;
  if (pressed) {
    c.run.stop();
    endCarnage();
    return;
  }
  for (const e of c.run.step()) {
    if (e.kind !== "death") continue;
    stains?.add(stainFor(level, e.x, e.y));
    if (carnageBurst) carnageBurst.pool.burst(e.x / T, -e.y / T, e.life === HERO ? 20 : 8);
  }
  hud.carnage(carnageLabel(c.run.total, c.run.arrivals));
  if (c.run.done) endCarnage();
}

/** Le carnage de démonstration : la solution de l'auteur en héros, des essais fictifs déterministes pour les autres vies. */
function demoLives(max = 0): JumpReplay[] {
  const solution = decodeReplay(ESSAI_SOLUTION_CODE);
  const lives: JumpReplay[] = [];
  const attempts = demoAttempts(ESSAI_LEVEL, solution, 2026, { attempts: max > 50 ? Math.ceil(max / 3) : 14 });
  for (const a of attempts) for (const life of replayAttempt(ESSAI_LEVEL, a.replay).lives) lives.push(lifeReplay(a.replay, life));
  if (max <= 0) return lives;
  // Mesures à 150 ou 300 vies : on reprend les mêmes vies autant qu'il faut.
  const out: JumpReplay[] = [];
  for (let i = 0; out.length < max && lives.length > 0; i++) out.push(lives[i % lives.length]!);
  return out;
}

function startDemo(max = 0, crowd = false): boolean {
  if (level !== ESSAI_LEVEL) {
    hud.toast("Démonstration : seulement sur ?scenario=essai");
    return false;
  }
  const solution = decodeReplay(ESSAI_SOLUTION_CODE);
  return startCarnage(solution, crowd ? new Array(max).fill(solution) : demoLives(max), true, lastBits);
}

function onEvent(e: SessionEvent): void {
  if (e.kind === "death") {
    if (burst) {
      burst.burst(e.x / T, -e.y / T);
      shake.start();
    }
    // Tache de la journée (pas en lecture, pas avec des réglages modifiés).
    if (!watching && memory.recordDeath({ x: e.x, y: e.y, cause: e.cause }, session.tuned)) stains?.add(stainFor(level, e.x, e.y));
  } else if (e.kind === "checkpoint") hud.toast("Point de passage");
  else if (e.kind === "respawn") {
    look = restLook();
    if (scene) camera = snapCamera(follow(session.state.player), scene.frame);
    stepper.reset();
  } else if (e.kind === "finish") {
    if (watching) {
      // Une lecture n'est pas un temps du joueur : le meilleur affiché reste celui du jour.
      session.best = memory.best?.time ?? null;
      hud.finish(session, { ...finishOptions(), title: mod?.solution ? "Solution" : daily && options.solution ? "Rediffusion de l'auteur" : "Rediffusion", watching: true });
      return;
    }
    const rec = drainEssais();
    // Le carnage démarre de lui-même ; sans essai enregistré (réglages modifiés), le bandeau tout de suite.
    if (!(rec?.result.finished && startCarnage(rec.replay, memory.liveReplays(rec.essai), false, lastBits))) hud.finish(session, finishOptions());
  }
}

/** Médaille de la dernière arrivée sur le niveau du jour (`__jump.daily.lastMedal`). */
let lastMedal: string | null = null;

/** Bandeau d'arrivée : niveau du jour (lot 5) : la médaille obtenue et le temps de l'auteur ; morceau (lot 4) : le temps de la solution, « Morceau suivant ». */
function finishOptions(): { reference: string | null; next: string | null } {
  if (daily) {
    const m = finishMedalText(session.state.time, daily.medals);
    lastMedal = m.medal;
    return { reference: m.text, next: null };
  }
  if (!mod) return { reference: null, next: null };
  const ref = reference === null ? "Solution : —" : `Solution : ${formatTicks(reference)}${mod.entry === "elan" && !mod.solution ? " (couloir compris)" : ""}`;
  return { reference: ref, next: nextHref };
}

/** Commande du dernier pas joué (le carnage ne se passe que sur une nouvelle commande). */
let lastBits = 0;

function stepOnce(): void {
  if (carnage) {
    stepCarnage();
    return;
  }
  const bits = watching ? (watchInputs[watchIndex++] ?? 0) : (injected ?? controls.sample());
  lastBits = bits;
  const prev = session.state;
  const event = session.step(bits);
  if (session.state.status !== ATTEMPT_DEAD && prev.status !== ATTEMPT_DEAD) look = onStep(look, prev.player, session.state.player, session.params.fallSpeed);
  ghost?.sync(session.state.time);
  if (phase !== "loading" && phase !== "no-webgl") phase = phaseOf(session.state);
  if (event) onEvent(event);
  if (!carnage) drainEssais();
}

function follow(s: PlayerState): Follow {
  return { cx: (s.x + PLAYER_WIDTH / 2) / T, cy: -(s.y + PLAYER_HEIGHT / 2) / T, vx: (s.vx * TICK_RATE) / T, ground: s.ground === 1 };
}

let camera: CameraView = { x: 0, y: 0, ahead: 0 };

function restart(): void {
  // Passage de minuit (lot 5) : la partie en cours a continué ; « recommencer » ouvre le nouveau niveau du jour.
  if (newDay) {
    location.replace(location.pathname + dailyHref(options));
    return;
  }
  if (carnage) {
    carnage.run.stop();
    carnage.demo = false;
    endCarnage();
  }
  session.restart();
  drainEssais();
  if (watchReplay) {
    watchIndex = 0;
    session.state = replayStartState(level, watchReplay.start);
    session.prev = session.state;
  }
  ghost?.sync(0);
  controls.resetLatch();
  stepper.reset();
  look = restLook();
  hud.hideFinish();
  if (scene) camera = snapCamera(follow(session.state.player), scene.frame);
  if (phase !== "loading" && phase !== "no-webgl") phase = phaseOf(session.state);
}

const hud = mountHud({ onRestart: () => controls.requestRestart() });

// ——— Lot 5 : ligne du jour (DailyJump #N, mode, médaille visée), message discret, passage de minuit ———
const dayLineEl = document.getElementById("dayline")!;
const dayNoteEl = document.getElementById("daynote")!;
let shownLine = "";
let notice = "";
/** Un nouveau jour a commencé pendant que la page était ouverte : le prochain « recommencer » ouvre son niveau. */
let newDay = false;
function setNotice(text: string, sticky: boolean): void {
  notice = text;
  dayNoteEl.textContent = text;
  dayNoteEl.classList.toggle("sticky", sticky);
  dayNoteEl.classList.remove("show");
  void dayNoteEl.offsetWidth; // relance l'animation
  dayNoteEl.classList.toggle("show", text !== "");
}
function updateDayLine(): void {
  if (!daily || !choice) return;
  const text = dayLine(daily, choice, preview, session.best);
  if (text === shownLine) return;
  shownLine = text;
  dayLineEl.textContent = text;
}
if (daily && choice) {
  dayLineEl.hidden = false;
  document.body.classList.add("daily");
  updateDayLine();
  if (choice.refused) setNotice(REFUSED_TEXT, false);
  // Le niveau d'aujourd'hui est ouvert (ou une date future refusée) : à minuit de Paris, un nouveau niveau attend. La partie continue.
  if (choice.mode === "jour") {
    const shownDay = choice.day;
    const watchDay = () => {
      if (newDay || parisDay(Date.now()) === shownDay) return;
      newDay = true;
      setNotice(NEW_DAY_TEXT, true);
    };
    setInterval(watchDay, 1000);
  }
}

// ——— Surimpression de `?debug` ———
const overlay = options.debug ? document.getElementById("debug") : null;
const tunedBadge = document.getElementById("tuned")!;
const fmt = (v: number, d = 1) => v.toFixed(d).replace(".", ",");

function updateOverlay(): void {
  updateDayLine();
  tunedBadge.textContent = session.tuned ? "réglages modifiés : rien n'est enregistré" : "";
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
    watching ? (mod?.solution ? "lecture de la solution du morceau (solution)" : daily && options.solution ? "lecture de la rediffusion de l'auteur (solution)" : "lecture du meilleur essai (watch=best)") : "",
    daily ? dailyOverlay() : "",
    `jour      meilleur ${memory.best ? formatTicks(memory.best.time) : "—"} · vies ${memory.lives.length} · taches ${stains?.count ?? 0}${ghost ? ` · fantôme ${ghostOn ? "montré" : "caché"}` : ""}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** Surimpression `?debug` du niveau du jour : le morceau où se trouve le personnage. */
function dailyOverlay(): string {
  if (!daily) return "";
  const col = Math.floor((session.state.player.x + PLAYER_WIDTH / 2) / T);
  const k = daily.pieces.findIndex((p) => col >= p.col0 - 1 && col <= p.col1);
  const p = daily.pieces[k];
  const where = p ? `${k + 1}/${daily.pieces.length} ${p.id} v${p.variant} · exigence ${p.exigence}/5 · ${p.entry === "arret" ? "arrêt" : "élan"}` : "—";
  return `morceau   ${where}\nniveau    ${daily.id} · auteur ${formatTicks(daily.authorTicks)} · tirage ${daily.chosen}${daily.fallback ? " (secours)" : ""}`;
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
  get daily(): DailyView | null {
    if (!daily || !choice) return null;
    return {
      date: daily.date,
      number: daily.number,
      id: daily.id,
      today: dayText,
      mode: choice.mode,
      preview,
      refused: choice.refused,
      hash: daily.hash,
      width: daily.level.width,
      height: daily.level.height,
      pieces: daily.pieces.map((p) => ({ id: p.id, variant: p.variant, entry: p.entry, exigence: p.exigence, tags: p.tags, col0: p.col0, col1: p.col1, start: p.start, end: p.end })),
      attempts: daily.attempts.map((a) => ({ ...a, pieces: [...a.pieces] })),
      chosen: daily.chosen,
      fallback: daily.fallback,
      authorTicks: daily.authorTicks,
      medals: { ...daily.medals },
      exigence: { ...daily.exigence },
      code: daily.code,
      lastMedal,
      newDay,
      notice,
      line: shownLine,
    };
  },
  module: mod && built ? { ...mod, levelId: built.levelId, reference, next: nextHref! } : null,
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
  replays: {
    list() {
      const out: ReturnType<JumpDebug["replays"]["list"]> = [];
      if (memory.best) out.push({ kind: "meilleur", essai: memory.best.essai, ticks: memory.best.time, time: memory.best.time, deaths: memory.best.deaths, code: memory.best.code });
      for (const l of memory.lives) {
        let ticks = 0;
        try {
          ticks = runsTicks(decodeReplay(l.code).runs);
        } catch {
          ticks = 0;
        }
        out.push({ kind: "vie", essai: l.essai, ticks, code: l.code });
      }
      return out;
    },
    export(which = "best") {
      if (which === "best") return memory.best?.code ?? null;
      return memory.lives[which]?.code ?? null;
    },
    import(code: string) {
      const r = memory.importBest(code);
      if (r.ok) {
        session.best = memory.best?.time ?? null;
        refreshGhost();
      }
      return r;
    },
  },
  carnage: {
    get state(): CarnageView {
      const c = carnage;
      if (!c) return { active: false, demo: false, lives: 0, arrivals: 0, deaths: 0, running: 0, tick: 0, heroTicks: 0, label: "" };
      return { active: true, demo: c.demo, lives: c.run.total, arrivals: c.run.arrivals, deaths: c.run.deaths, running: c.run.running, tick: c.run.tick, heroTicks: c.run.heroTicks, label: carnageLabel(c.run.total, c.run.arrivals) };
    },
    start() {
      const best = memory.bestReplay();
      if (!best || !memory.best) return false;
      return startCarnage(best, memory.liveReplays(memory.best.essai), false, lastBits);
    },
    demo(lives?: number, crowd?: boolean) {
      return startDemo(lives ?? 0, crowd ?? false);
    },
    skip() {
      if (!carnage) return;
      carnage.run.stop();
      endCarnage();
    },
  },
  storage: {
    clear() {
      const n = clearAll(store);
      memory.purge();
      refreshGhost();
      session.best = null;
      stains?.reset([]);
      return n;
    },
    size() {
      return memory.storedSize();
    },
    get memory() {
      return { best: memory.best?.time ?? null, lives: memory.lives.length, deaths: memory.deaths.length, positions: memory.deaths.map((d) => ({ x: d.x / T, y: d.y / T })) };
    },
  },
  get ghost() {
    const g = ghost;
    const p = g?.state.player;
    return {
      enabled: ghostOn,
      available: !!g,
      visible: ghostMesh?.group.visible ?? false,
      tick: g?.tick ?? 0,
      status: g ? STATUS_NAMES[g.state.status]! : "aucun",
      x: p ? p.x / T : 0,
      y: p ? p.y / T : 0,
    };
  },
  toggleGhost() {
    return toggleGhost();
  },
  get stains() {
    return { count: stains?.count ?? 0, discs: stains?.discs ?? 0, added: stains?.added ?? 0 };
  },
  get watching() {
    return watching;
  },
  get frameTimes() {
    const list = [...frameWork];
    const sorted = list.slice().sort((a, b) => a - b);
    return {
      mean: list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0,
      p95: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))]! : 0,
      frames: list.length,
      stepMs: workStats.steps ? workStats.stepMs / workStats.steps : 0,
      drawMs: workStats.draws ? workStats.drawMs / workStats.draws : 0,
      reset() {
        frameWork.length = 0;
        workStats.steps = workStats.stepMs = workStats.draws = workStats.drawMs = 0;
      },
    };
  },
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

// ——— Fantôme : réglage mémorisé (`jump:fantome`), bouton 👻 (téléphone), bouton du coin et touche G (ordinateur) ———
const ghostButton = document.getElementById("ghostbtn") as HTMLButtonElement;
function showGhostSetting(): void {
  ghostButton.setAttribute("aria-pressed", ghostOn ? "true" : "false");
  ghostButton.textContent = `👻 Fantôme : ${ghostOn ? "oui" : "non"}`;
  touchUi?.setGhost(ghostOn);
}
function toggleGhost(): boolean {
  ghostOn = !ghostOn;
  saveGhostSetting(store, ghostOn);
  showGhostSetting();
  return ghostOn;
}
ghostButton.addEventListener("click", () => {
  ghostButton.blur();
  toggleGhost();
});
window.addEventListener("keydown", (e) => {
  if (e.code === "KeyG" && !e.repeat) toggleGhost();
});

if (touchOn) {
  touchUi = mountTouchUi({
    controls,
    forced: options.touch === "1",
    zones: options.zones,
    tune: options.tune,
    onRestart: () => controls.requestRestart(),
    onGear: () => setPanel(true),
    onGhost: () => toggleGhost(),
    ghostOn,
  });
}
showGhostSetting();

// La page se ferme (ou passe en arrière-plan) : l'essai en cours est clos comme un abandon, ses vies sont gardées.
const flushEssai = () => {
  if (watching || carnage) return;
  session.flush();
  drainEssais();
};
window.addEventListener("pagehide", flushEssai);

if (options.tune) {
  const panel = document.getElementById("tune")!;
  mountTunePanel(panel, params, () => updateOverlay(), touchOn ? { onClose: () => setPanel(false) } : {});
}

/** Dessine l'image : personnage interpolé entre l'état précédent et l'état courant (`alpha`), caméra lissée sur `dt` secondes. */
let clock = 0;
function draw(alpha: number, dt: number): void {
  if (!scene) return;
  clock += dt;
  burst?.update(dt);
  stains?.update(dt);
  if (carnage) {
    drawCarnage(scene, carnage, alpha, dt);
    return;
  }
  const sa = session.prev;
  const sb = session.state;
  const a = sa.player;
  const b = sb.player;
  const x = (a.x + (b.x - a.x) * alpha) / T;
  const y = (a.y + (b.y - a.y) * alpha) / T;
  look = animateLook(look, dt, (-b.vy * TICK_RATE) / T);
  scene.setPlayer({ x, y, look, visible: sb.status !== ATTEMPT_DEAD });
  scene.setWorld(sa, sb, alpha, clock);
  drawGhost(alpha);
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

/** Position interpolée (tuiles, coin haut-gauche) entre deux états ; pas d'interpolation à travers un saut (reprise sur un point). */
function poseBetween(a: PlayerState, b: PlayerState, alpha: number): { x: number; y: number } {
  if (Math.abs(b.x - a.x) + Math.abs(b.y - a.y) > T) return { x: b.x / T, y: b.y / T };
  return { x: (a.x + (b.x - a.x) * alpha) / T, y: (a.y + (b.y - a.y) * alpha) / T };
}

/** Le fantôme du meilleur essai : carré translucide ; mort, un anneau qui s'ouvre là où il est mort ; puis sa reprise. */
function drawGhost(alpha: number): void {
  if (!ghostMesh) return;
  const g = ghost;
  if (!g || !ghostOn || watching) {
    ghostMesh.hide();
    return;
  }
  const gs = g.state;
  if (gs.status === ATTEMPT_DEAD) ghostMesh.set(null, { x: gs.deathX / T, y: gs.deathY / T, dying: Math.min(1, gs.deathTicks / RESPAWN_TICKS) });
  else ghostMesh.set(poseBetween(g.prev.player, gs.player, alpha), null);
}

const CARNAGE_LOOK = restLook();

/** Le carnage : le héros (le personnage, avec ses yeux), la foule (un carré translucide par vie), le monde du héros, la caméra sur lui. */
function drawCarnage(sc: NonNullable<typeof scene>, c: CarnageRun, alpha: number, dt: number): void {
  const h = c.run.hero;
  const hero = poseBetween(h.prev.player, h.state.player, alpha);
  sc.setPlayer({ ...hero, look: CARNAGE_LOOK, visible: h.state.status !== ATTEMPT_DEAD });
  sc.setWorld(h.prev, h.state, alpha, clock);
  const lives = c.run.lives;
  for (let i = 0; i < lives.length; i++) {
    const life = lives[i]!;
    const r = life.runner;
    if (life.status !== "court" || !r || r.state.status === ATTEMPT_DEAD) c.crowd.set(i, null);
    else {
      const p = poseBetween(r.prev.player, r.state.player, alpha);
      c.crowd.set(i, p.x, p.y);
    }
  }
  c.crowd.commit();
  if (carnageBurst) {
    carnageBurst.pool.update(dt);
    carnageBurst.mesh.sync();
  }
  if (h.state.status !== ATTEMPT_DEAD) {
    const f = follow(h.state.player);
    camera = followCamera(camera, { ...f, cx: hero.x + PLAYER_WIDTH / T / 2, cy: -(hero.y + PLAYER_HEIGHT / T / 2) }, sc.frame, dt);
  }
  sc.setView(camera.x, camera.y);
  sc.render();
  hud.update(session, h.state.time);
}

/** Temps de fil principal par image (ms), les 600 dernières images : mesure du carnage (`__jump.frameTimes`). */
const frameWork: number[] = [];
const workStats = { steps: 0, stepMs: 0, draws: 0, drawMs: 0 };

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
    const t0 = performance.now();
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.25);
    last = now;
    controls.pollPad();
    if (controls.takeRestart()) restart();
    if (!manual && !panelOpen) {
      const steps = stepper.advance(dt);
      for (let i = 0; i < steps; i++) stepOnce();
      workStats.steps += steps;
    }
    const t1 = performance.now();
    draw(manual ? 1 : stepper.alpha, dt);
    updateOverlay();
    const t2 = performance.now();
    workStats.stepMs += t1 - t0;
    workStats.drawMs += t2 - t1;
    workStats.draws++;
    frameWork.push(t2 - t0);
    if (frameWork.length > 600) frameWork.shift();
    requestAnimationFrame(frame);
  };
  draw(1, 0);
  updateOverlay();
  phase = "ready";
  requestAnimationFrame(frame);
  if (daily && options.solution) hud.toast("Rediffusion de l'auteur");
  else if (mod?.solution && !watching) hud.toast("Pas de solution stockée pour ce morceau");
  else if (mod?.solution) hud.toast("Solution du morceau");
  else if (options.watchBest && !watching) hud.toast("Pas encore de meilleur essai aujourd'hui : à toi de jouer");
  else if (watching) hud.toast("Rediffusion de ton meilleur essai");
  if (options.carnageDemo) startDemo();
}

