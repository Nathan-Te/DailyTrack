import { PerspectiveCamera, WebGLRenderer } from "three";
import {
  AXLE_FRONT,
  AXLE_REAR,
  HALF_TRACK,
  DEFAULT_CAR_PARAMS,
  AXIS_MAX,
  DT,
  FLAT_WORLD,
  SIM_VERSION,
  NO_GROUND,
  bestPilotRun,
  carSpeed,
  copyCar,
  forwardSpeed,
  steerLimit,
  createCar,
  THEMES,
  createPilotageTrack,
  createSurface,
  createSurfacesTrack,
  themeByName,
  createTestTrack,
  dailyCircuit,
  isDefaultParams,
  parseTrack,
  ReplayPlayer,
  decodeReplay,
  encodeReplay,
  medalFor,
  parseDay,
  raceElapsedMs,
  stepCar,
  wrapAngle,
  type CarInput,
  type CarParams,
  type DailyCircuit,
  type Medal,
  type CarState,
  type RaceState,
} from "@cdj/sim";
import { archiveDays, renderArchive } from "./archive";
import { buildFlatArena } from "./arena";
import { canNativeShare, copyText, nativeShare } from "./clipboard";
import { GameAudio } from "./audio";
import { volumeIcon } from "./audioLogic";
import { WHEEL_RADIUS, createCarMesh, type WheelPose } from "./carMesh";
import { Effects, QualityGovernor, type Quality } from "./fx";
import { createTelemetry, readTelemetry } from "./telemetry";
import { formatDelta, formatTime } from "./format";
import type { Leaderboard } from "./api";
import { isValidName, normalizeName } from "./identity";
import { Controls, isTyping } from "./input";
import { IMPACT_COOLDOWN_MS, TouchPad, impactFelt, loadTouchSettings, vibrate, wantsTouch } from "./touch";
import { mountTouchUi } from "./touchUi";
import { Online, ghostModes, nextGhostMode, type GhostMode } from "./online";
import { listDayBests, loadBest, saveBest, type BestRun } from "./records";
import { MEDAL_ICON, shareLine, shareText, shareUrl, type ShareResult } from "./share";
import { RunSession } from "./session";
import { buildTrackScene } from "./trackMesh";
import { loadTunedParams, mountTunePanel } from "./tune";

const params = new URLSearchParams(location.search);
// Scénarios : `jour` (par défaut : le circuit du jour, `?seed=AAAA-MM-JJ` pour une autre date),
// `essai` (le circuit écrit à la main des lots 2-3), `pilotage` (le circuit de mise au point de la conduite, lot 7)
// et `plat` (le terrain d'essai du lot 1).
const requested = params.get("scenario");
// `?debug&spec=<blocs>` : un circuit écrit à la main (notation de `parseTrack`), pour les tests de navigateur.
let customTrack: ReturnType<typeof parseTrack> | null = null;
if (params.has("debug") && params.has("spec")) {
  try {
    customTrack = parseTrack("test", params.get("spec")!);
  } catch (e) {
    console.error("spec invalide", e);
  }
}
const scenario = customTrack ? "essai" : requested === "plat" || requested === "essai" || requested === "pilotage" || requested === "surfaces" ? requested : "jour";
// `?today=AAAA-MM-JJ` (avec `?debug`) simule une autre date du jour : pour tester les archives.
const fakeToday = params.has("debug") ? parseDay(params.get("today") ?? "") : null;
const todayUtc = fakeToday ?? Math.floor(Date.now() / 86_400_000);
const seedParam = params.get("seed");
const seedDay = seedParam === null ? null : parseDay(seedParam);
let daily: DailyCircuit | null = null;
// `?theme=<nom>` force le thème du jour (essais) : autre circuit, jamais classé.
const themeParam = params.get("theme");
const forcedTheme = themeByName(themeParam);
if (scenario === "jour") daily = dailyCircuit(seedDay ?? todayUtc, forcedTheme?.name);
const track = scenario === "plat" ? null : daily ? daily.track : customTrack ?? (scenario === "pilotage" ? createPilotageTrack() : scenario === "surfaces" ? createSurfacesTrack() : createTestTrack());
// Réglages de la voiture : ceux du classement, sauf avec le panneau `?debug&tune` (courses alors jamais classées).
const tuning = params.has("debug") && params.has("tune");
const carParams: CarParams = tuning ? loadTunedParams() : { ...DEFAULT_CAR_PARAMS };
const COUNTDOWN_S = 3;

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const view = track ? buildTrackScene(track, daily?.palette ?? "desert") : buildFlatArena();
const carModel = createCarMesh();
const carMesh = carModel.group;
view.scene.add(carMesh);
const ghostModel = createCarMesh(true);
const ghostMesh = ghostModel.group;
ghostMesh.visible = false;
view.scene.add(ghostMesh);

// --- Rendu, effets et sons (lot 9) : présentation seule, lecture seule de la simulation --------------------
// `?fx=off` coupe les effets ; `?quality=0|1|2` fige la qualité (sinon : réglage automatique selon la fluidité) ;
// `?shake=0` coupe les secousses de caméra ; `?demo` : le pilote automatique boucle sur le circuit.
const effects = new Effects(view.scene);
effects.enabled = params.get("fx") !== "off";
const qualityParam = params.get("quality");
const governor = new QualityGovernor(26, 19, qualityParam === "0" || qualityParam === "1" || qualityParam === "2");
if (governor.locked) governor.level = Number(qualityParam) as Quality;
effects.quality = governor.level;
const SHAKE = params.get("shake") === "0" ? 0 : 1;
const demo = params.has("demo");
const tel = createTelemetry();
const gameAudio = new GameAudio(() => syncSoundButton());
const wheelDroop: [number, number, number, number] = [0, 0, 0, 0];
const WHEEL_F = [AXLE_FRONT, AXLE_FRONT, -AXLE_REAR, -AXLE_REAR];
const WHEEL_L = [HALF_TRACK, -HALF_TRACK, HALF_TRACK, -HALF_TRACK];
const wheelPose: WheelPose = { forward: 0, steerAngle: 0, braking: false, droop: wheelDroop, dt: 0 };
const ghostPose: WheelPose = { forward: 0, steerAngle: 0, braking: false, droop: [0, 0, 0, 0], dt: 0 };
const hudLines = document.getElementById("lines")!;
const hudFlash = document.getElementById("flash")!;
let demoClock = 0;
let shake = 0;
let fovKick = 0;
let flash = 0;
let lastCountdown = 0;
let demoReplay: ReturnType<typeof bestPilotRun> = null;
let demoTimer = 0;

// Classement : seulement pour le circuit du jour, et si une adresse d'API est configurée (`?api=` ou VITE_API_URL).
const online = new Online(track ? track.id : null, daily && !daily.forcedTheme ? daily.date : null);
// On ne peut classer que le circuit d'aujourd'hui (un jour passé est figé : le serveur refuse).
const submitAllowed = !!daily && daily.day === todayUtc && !daily.forcedTheme;
// Outils de test (`?debug`) : accélérer le temps et jouer une rediffusion à la place du clavier.
const timeScale = params.has("debug") ? Math.max(1, Number(params.get("timescale")) || 1) : 1;
let autoplay: ReplayPlayer | null = null;

const camera = new PerspectiveCamera(65, 1, 0.1, 500);
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  effects.setViewport(window.innerHeight, camera.fov, renderer.getPixelRatio());
}
window.addEventListener("resize", resize);
resize();

const $ = (id: string) => document.getElementById(id)!;
const hudSpeed = $("speed");
const hudTimer = $("timer");
const hudSplits = $("splits");
const hudBanner = $("banner");
const hudFinish = $("finish");
const hudBoard = $("board");
const hudArchive = $("archive");
let splash: HTMLElement | null = document.getElementById("splash");

const MEDAL_NAME: Record<Medal, string> = { author: "Meilleur que l'auteur !", gold: "Médaille d'or", silver: "Médaille d'argent", bronze: "Médaille de bronze" };

// Titre du circuit et seuils des médailles.
if (daily) {
  const m = daily.medals;
  const invalidSeed = seedParam !== null && seedDay === null;
  // « Circuit du Jour » est masqué sur petit écran (`.long`) : il reste « #1 · 2026-10-06 · neige ».
  const long = document.createElement("span");
  long.className = "long";
  long.textContent = "Circuit du Jour ";
  $("meta").replaceChildren(long, `${daily.number >= 1 ? `#${daily.number} · ` : ""}${daily.date} · ${THEMES[daily.theme].label}${daily.forcedTheme ? " (thème forcé : essai, non classé)" : ""}${invalidSeed ? " (date invalide : circuit d'aujourd'hui)" : ""}`);
  $("medals").textContent = `${MEDAL_ICON.author} ${formatTime(m.author)}  ${MEDAL_ICON.gold} ${formatTime(m.gold)}  ${MEDAL_ICON.silver} ${formatTime(m.silver)}  ${MEDAL_ICON.bronze} ${formatTime(m.bronze)}`;
} else if (track) {
  $("meta").textContent = scenario === "pilotage" ? "Circuit de pilotage" : scenario === "surfaces" ? "Circuit des surfaces" : "Circuit d'essai";
}
function updateInfo() {
  $("info").textContent = track
    ? `ZQSD/WASD ou flèches · R : point de contrôle · Entrée : départ · manette : Y / Start · C : caméra · P : pause · G : fantôme${online.enabled ? " · L : classement" : ""}`
    : "scénario « plat » · ZQSD/WASD ou flèches · R ou Entrée : recommencer · C : caméra";
}

// --- État de la partie ----------------------------------------------------------------------
type Phase = "countdown" | "racing" | "finished";

// Commandes tactiles : appareil tactile (`pointer: coarse`) ou `?touch=1`. Mêmes axes que le clavier et la manette.
const touchMode = wantsTouch(params, matchMedia("(pointer: coarse)").matches);
const touchPad = touchMode ? new TouchPad(loadTouchSettings()) : null;
const controls = new Controls(window, touchPad);
if (touchMode) document.body.classList.add("touch");
let paused = false;
const touchUi = touchPad
  ? mountTouchUi(touchPad, {
      onPause: () => setPaused(!paused),
      onRespawn: () => controls.requestRespawn(),
      onRestart: () => controls.requestRestart(),
    })
  : null;
// Outil de test (`?debug`) : « pas à pas ». La simulation n'avance plus avec l'horloge mais d'un nombre exact de pas
// à chaque `__cdj.advance(n)` ; les commandes sont lues comme d'habitude (clavier, doigts…). Un test ne dépend ainsi
// plus de la vitesse de la machine.
let manual = false;
let manualTicks = 0;
let manualWaiters: (() => void)[] = [];
/** Dernière commande appliquée à la simulation (outil de test : `__cdj.input`). */
let lastInput: CarInput = { steer: 0, throttle: 0, brake: 0, respawn: 0 };
let lastImpactAt = -1e9;
let lastImpactSoundAt = -1e9;

function setPaused(value: boolean) {
  if (value && phase === "finished") return;
  paused = value;
  document.body.classList.toggle("paused", paused);
  touchUi?.setPaused(paused);
}
$("pause-resume").addEventListener("click", () => setPaused(false));
$("pause-restart").addEventListener("click", () => controls.requestRestart());
let best: BestRun | null = track ? loadBest(track.id) : null;
// Fantôme affiché : son record par défaut (`G` pour passer au premier, au joueur devant, ou à aucun).
let ghostMode: GhostMode = params.get("ghost") === "off" ? "off" : "mine";
let ghostSource: BestRun | null = ghostMode === "mine" ? best : null;
let ghostLabel = "ton record";
let ghostBusy = false;
let session: RunSession | null = track ? new RunSession(track, ghostSource, carParams) : null;
// Vrai si cette tentative a roulé, ne serait-ce qu'un instant, avec des réglages modifiés : ni record, ni classement.
let tunedRun = !isDefaultParams(carParams);
// Le fantôme qui roule vraiment dans cette tentative, et celui choisi en cours de course (effectif au prochain départ).
type GhostLabel = { label: string; ms: number | null };
let activeGhost: GhostLabel | null = session?.ghost && ghostSource ? { label: ghostLabel, ms: ghostSource.ms } : null;
let pendingGhost: GhostLabel | null = null;
let race: RaceState | null = session ? session.race : null;
let car: CarState = race ? race.car : createCar();
let previous: CarState = session ? session.previous : createCar();
copyCar(car, previous); // sinon la voiture s'afficherait à l'origine pendant le décompte
updateInfo();
let phase: Phase = track ? "countdown" : "racing";
let countdown = COUNTDOWN_S;
let bannerTimer = 0;
let accumulator = 0;
let pendingRespawn = false;
let shownSplits = 0;
let lastRespawns = 0;

// --- Partage et archives --------------------------------------------------------------------
let lastRank: { rank: number; participants: number } | null = null;
let shareEl: HTMLElement | null = null;

/** Le résultat à partager : le meilleur temps du jour, avec sa médaille et son rang si le serveur l'a donné. */
function currentShare(): ShareResult | null {
  if (!daily || !best) return null;
  return { number: daily.number, date: daily.date, ms: best.ms, medal: medalFor(best.ms, daily.medals), rank: lastRank?.rank ?? null, participants: lastRank?.participants ?? null };
}

function updateShareLine() {
  const share = currentShare();
  if (shareEl && share) shareEl.textContent = shareLine(share);
}

const shareLink = () => shareUrl(location, daily!.date, daily!.day === todayUtc);

function openArchive() {
  renderArchive(hudArchive.querySelector(".panel")!, archiveDays(todayUtc, listDayBests()), location.search, daily?.date ?? null, closeArchive);
  hudArchive.hidden = false;
}

function closeArchive() {
  hudArchive.hidden = true;
}
hudArchive.addEventListener("click", (e) => {
  if (e.target === hudArchive) closeArchive(); // clic à côté du panneau
});

function startAttempt() {
  if (track) {
    session = new RunSession(track, ghostSource, carParams);
    activeGhost = session.ghost && ghostSource ? { label: ghostLabel, ms: ghostSource.ms } : null;
    pendingGhost = null;
    race = session.race;
    car = race.car;
    previous = session.previous;
    phase = "countdown";
    countdown = COUNTDOWN_S;
  } else {
    car = createCar();
    previous = createCar();
  }
  copyCar(car, previous);
  updateInfo();
  updateGhostInfo();
  setPaused(false);
  touchPad?.releaseAll();
  tunedRun = !isDefaultParams(carParams);
  updateTunedLabel();
  autoplay = null;
  lastRank = null;
  shareEl = null;
  accumulator = 0;
  pendingRespawn = false;
  shownSplits = 0;
  lastRespawns = 0;
  snapCamera = true;
  effects.reset();
  lastCountdown = 0;
  shake = 0;
  demoTimer = 0;
  if (demo && track && demoReplay) autoplay = new ReplayPlayer(demoReplay.replay); // la démo : le pilote reprend à chaque tour
  hudSplits.textContent = "";
  hudFinish.hidden = true;
  document.body.classList.remove("finished");
  bannerTimer = 0;
}

/** Bandeau « réglages modifiés » : rappelle qu'une course réglée n'est ni classée ni enregistrée. */
function updateTunedLabel() {
  $("tuned").textContent = tunedRun ? "Réglages modifiés : course non classée" : "";
}

if (tuning) {
  mountTunePanel($("tune"), carParams, () => {
    if (phase !== "finished") tunedRun = true; // la course en cours a roulé avec ces réglages
    updateTunedLabel();
  });
}
updateTunedLabel();

function showBanner(text: string, seconds: number, small = false) {
  hudBanner.textContent = text;
  hudBanner.classList.toggle("small", small);
  bannerTimer = seconds;
}

/** Ligne du fantôme : celui qui roule, et — si on en a choisi un autre en pleine course — celui du prochain départ. */
function updateGhostInfo() {
  const el = $("ghostinfo");
  if (!activeGhost && !pendingGhost) return el.replaceChildren();
  const prefix = document.createElement("span");
  prefix.className = "long"; // « Fantôme : » est masqué sur petit écran, faute de place
  prefix.textContent = "Fantôme : ";
  const now = activeGhost ? `${activeGhost.label}${activeGhost.ms !== null ? ` · ${formatTime(activeGhost.ms)}` : ""}` : "aucun";
  const next = pendingGhost ? ` → ${pendingGhost.label}` : "";
  el.replaceChildren(prefix, now + next);
}

function setGhost(mode: GhostMode, source: BestRun | null, label: string) {
  ghostMode = mode;
  ghostSource = source;
  ghostLabel = label;
  if (phase === "racing") {
    pendingGhost = { label, ms: source ? source.ms : null };
    updateGhostInfo();
    showBanner(`Fantôme : ${label} (au prochain départ)`, 2, true);
  } else {
    startAttempt(); // pas de course en cours : on repart tout de suite avec le nouveau fantôme
    showBanner(`Fantôme : ${label}`, 1.6, true);
  }
}

/** `G` : fantôme suivant (son record → le premier → le joueur devant → aucun), en sautant ceux qui n'existent pas. */
async function cycleGhost() {
  if (!track || ghostBusy) return;
  ghostBusy = true;
  try {
    const modes = ghostModes(!!best?.replay, online.enabled);
    let mode = ghostMode;
    for (let i = 0; i < modes.length; i++) {
      mode = nextGhostMode(mode, modes);
      if (mode === "off") return setGhost("off", null, "aucun");
      if (mode === "mine") return setGhost("mine", best, "ton record");
      const choice = await online.remoteGhost(mode);
      if (choice) return setGhost(choice.mode, choice.source, choice.label);
      showBanner(mode === "first" ? "Pas encore de premier" : "Personne devant toi", 1.4, true);
    }
  } finally {
    ghostBusy = false;
  }
}

// --- Classement -----------------------------------------------------------------------------
let boardVisible = false;

function renderBoard(lb: Leaderboard) {
  const row = (r: { rank: number; name: string; ms: number; medal: string | null }, me: boolean) => {
    const d = document.createElement("div");
    d.className = me ? "row me" : "row";
    const icon = r.medal ? MEDAL_ICON[r.medal as Medal] : "";
    for (const [cls, text] of [["rank", `${r.rank}`], ["who", r.name], ["time", formatTime(r.ms)], ["icon", icon]] as const) {
      const span = document.createElement("span");
      span.className = cls;
      span.textContent = text;
      d.append(span);
    }
    return d;
  };
  const title = document.createElement("div");
  title.className = "title";
  const label = submitAllowed ? "Classement du jour" : `Classement figé · ${lb.date}`;
  title.textContent = lb.participants === 0 ? `${label} : personne` : `${label} · ${lb.participants} pilote${lb.participants > 1 ? "s" : ""}`;
  const rows = lb.top.map((r) => row(r, lb.me !== null && r.rank === lb.me.rank && r.name === lb.me.name));
  if (lb.me && lb.me.rank > lb.top.length) {
    const gap = document.createElement("div");
    gap.className = "gap";
    gap.textContent = "…";
    rows.push(gap, row(lb.me, true));
  }
  hudBoard.replaceChildren(title, ...rows);
}

async function refreshBoard() {
  if (!online.enabled) return;
  const r = await online.leaderboard();
  if (r.ok) renderBoard(r.data);
  else hudBoard.textContent = r.message;
}

function setBoardVisible(visible: boolean) {
  boardVisible = visible && online.enabled;
  hudBoard.hidden = !boardVisible;
  if (boardVisible) void refreshBoard();
}

const compactScreen = () => matchMedia("(max-width: 900px), (max-height: 520px)").matches;

/** À l'arrivée, le classement s'affiche tout seul à côté du panneau ; sur petit écran, il se demande (🏆) et ne le recouvre pas. */
function autoShowBoard() {
  if (!compactScreen()) setBoardVisible(true);
}
hudBoard.addEventListener("click", () => {
  if (compactScreen()) setBoardVisible(false); // fenêtre : un toucher la ferme
});

window.addEventListener("keydown", (e) => {
  if (e.repeat || isTyping(e)) return;
  if (e.code === "KeyG") void cycleGhost();
  if (e.code === "KeyM") gameAudio.mute();
  if (e.code === "KeyL") setBoardVisible(!boardVisible);
  if (e.code === "KeyH") (hudArchive.hidden ? openArchive : closeArchive)();
  if (e.code === "Escape") closeArchive();
});

// Boutons du menu (tactile et souris) : mêmes actions que les touches.
const menuButton = (id: string, onClick: () => void) => {
  const b = $(id) as HTMLButtonElement;
  b.addEventListener("click", () => {
    b.blur();
    onClick();
  });
  return b;
};
menuButton("btn-board", () => setBoardVisible(!boardVisible)).hidden = !online.enabled;
menuButton("btn-ghost", () => void cycleGhost()).hidden = !track;
const soundBtn = menuButton("btn-sound", () => gameAudio.cycle());
function syncSoundButton() {
  const icon = volumeIcon(gameAudio.settings.volume);
  soundBtn.querySelector(".ico")!.textContent = icon;
  soundBtn.querySelector(".txt")!.textContent = `${icon} Son`;
}
syncSoundButton();
menuButton("btn-archive", () => (hudArchive.hidden ? openArchive() : closeArchive()));

/** Envoi du meilleur temps au classement, et affichage du rang dans le panneau d'arrivée. */
function startOnlineFlow(box: HTMLElement) {
  const text = (msg: string, cls = "") => {
    const d = document.createElement("div");
    d.className = cls;
    d.textContent = msg;
    return d;
  };
  const button = (label: string, onClick: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "link";
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  };

  const showRank = (rank: number, participants: number, extra = "") => {
    lastRank = { rank, participants };
    updateShareLine();
    box.replaceChildren(text(`Rang ${rank} / ${participants}${extra}`, "rank"), button("Changer de pseudo", () => nameForm()));
    autoShowBoard();
  };

  const send = async () => {
    const name = online.name;
    if (!best || !name) return nameForm();
    box.replaceChildren(text("Envoi au classement…", "status"));
    const r = await online.submit(best, name);
    if (r.ok) {
      const gap = r.data.bestMs !== best.ms ? ` · temps du serveur : ${formatTime(r.data.bestMs)}` : "";
      showRank(r.data.rank, r.data.participants, gap);
    } else {
      box.replaceChildren(text(r.message, "error"), button("Réessayer", () => void send()));
    }
  };

  const nameForm = () => {
    const form = document.createElement("form");
    const input = document.createElement("input");
    input.type = "text";
    input.maxLength = 20;
    input.placeholder = "Ton pseudo";
    input.autocomplete = "off";
    input.value = online.name ?? "";
    const ok = document.createElement("button");
    ok.type = "submit";
    ok.textContent = "OK";
    const error = text("", "error");
    form.append(text(online.name ? "Nouveau pseudo" : "Choisis ton pseudo pour entrer au classement", "label"), input, ok, error);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = normalizeName(input.value);
      if (!isValidName(name)) {
        error.textContent = "1 à 20 caractères : lettres, chiffres, espace . _ ' -";
        return;
      }
      ok.disabled = true;
      const pending = online.needsSubmit(best);
      await online.rename(name, !pending); // pas encore classé : le pseudo part avec la course
      if (pending) await send();
      else {
        box.replaceChildren(text(`Pseudo : ${name}`, "status"));
        autoShowBoard();
      }
    });
    box.replaceChildren(form);
    input.focus();
    input.select();
  };

  if (!submitAllowed) {
    box.replaceChildren(text("Classement figé : ce jour est terminé", "status"));
    autoShowBoard();
  } else if (online.needsSubmit(best)) {
    void send();
  } else {
    // Ce temps n'améliore pas le record, déjà classé : on affiche simplement la place actuelle.
    box.replaceChildren(text("Chargement du classement…", "status"));
    void online.leaderboard().then((r) => {
      if (r.ok && r.data.me) showRank(r.data.me.rank, r.data.participants);
      else if (r.ok) box.replaceChildren();
      else box.replaceChildren(text(r.message, "error"));
      if (r.ok) autoShowBoard();
    });
  }
}

function renderSplits() {
  if (!race) return;
  hudSplits.replaceChildren(
    ...race.splits.map((ms, i) => {
      const line = document.createElement("div");
      line.textContent = `CP${i + 1}  ${formatTime(ms)}`;
      const ref = (ghostSource ?? best)?.splits[i];
      if (ref !== undefined) {
        const d = document.createElement("span");
        d.className = ms <= ref ? "down" : "up";
        d.textContent = `  ${formatDelta(ms - ref)}`;
        line.append(d);
      }
      return line;
    }),
  );
}

function medalLines(ms: number): [string, string][] {
  if (!daily) return [];
  const medal = medalFor(ms, daily.medals);
  if (medal) return [["medal", `${MEDAL_ICON[medal]} ${MEDAL_NAME[medal]}`]];
  return [["", `Pas de médaille · bronze à ${formatTime(daily.medals.bronze)}`]];
}

function finishRun() {
  if (!race || !track || !session) return;
  phase = "finished";
  const ms = race.finishMs;
  // Réglages modifiés : le temps s'affiche, mais n'est ni enregistré ni envoyé (ce n'est pas la voiture de tout le monde).
  const counted = !tunedRun && !demo; // la démo n'est jamais enregistrée
  const isRecord = counted && (!best || ms < best.ms);
  const previousBest = best;
  if (isRecord) {
    best = { ms, splits: [...race.splits], replay: encodeReplay(session.toReplay()), simVersion: SIM_VERSION, medal: daily ? medalFor(ms, daily.medals) : null };
    saveBest(track.id, best);
    if (ghostMode === "mine") ghostSource = best; // le prochain fantôme sera ce nouveau record
  }
  const lines: [string, string][] = [
    ["big", formatTime(ms)],
    ...medalLines(ms),
    !counted
      ? ["record", "Réglages modifiés : course non classée ni enregistrée"]
      : [isRecord ? "record" : "", isRecord ? (previousBest ? `Nouveau record ! (${formatDelta(ms - previousBest.ms)})` : "Premier temps enregistré") : `Record : ${formatTime(best!.ms)} (${formatDelta(ms - best!.ms)})`],
    ["", race.respawns > 0 ? `${race.respawns} reprise${race.respawns > 1 ? "s" : ""} au point de contrôle` : "Sans reprise"],
  ];
  const rows = lines.map(([cls, text]) => {
    const d = document.createElement("div");
    d.className = cls;
    d.textContent = text;
    return d;
  });
  const onlineBox = document.createElement("div");
  onlineBox.className = "online";
  const hint = document.createElement("div");
  hint.className = "hint";
  hint.textContent = "Entrée : rejouer · H : archives";

  // Ligne à partager (circuits du jour) et boutons : tout est cliquable, pour le tactile.
  shareEl = daily ? document.createElement("div") : null;
  if (shareEl) shareEl.className = "share";
  updateShareLine();
  const actions = document.createElement("div");
  actions.className = "actions";
  const action = (label: string, onClick: (b: HTMLButtonElement) => void | Promise<void>, cls = "") => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.textContent = label;
    b.addEventListener("click", async () => {
      b.blur(); // sinon la touche Entrée (rejouer) déclencherait aussi ce bouton
      await onClick(b);
    });
    actions.append(b);
    return b;
  };
  const flash = (b: HTMLButtonElement, text: string) => {
    const label = b.textContent;
    b.textContent = text;
    setTimeout(() => (b.textContent = label), 1600);
  };
  action("Rejouer", () => startAttempt(), "primary");
  if (daily) {
    action("Copier le résultat", async (b) => {
      const share = currentShare();
      if (share) flash(b, (await copyText(shareText(share, shareLink()))) ? "Copié ✓" : "Copie impossible");
    });
    if (canNativeShare()) {
      action("Partager", async () => {
        const share = currentShare();
        if (share) await nativeShare({ text: shareLine(share), url: shareLink() });
      });
    }
  }
  action("Archives", () => openArchive());
  const showOnline = online.enabled && counted;
  hudFinish.replaceChildren(...rows, ...(showOnline ? [onlineBox] : []), ...(shareEl && best ? [shareEl] : []), actions, hint);
  hudFinish.hidden = false;
  document.body.classList.add("finished");
  if (showOnline) startOnlineFlow(onlineBox);
  showBanner("ARRIVÉE", 2.5);
  effects.confetti(car.x, car.y, car.z);
  gameAudio.play("finish");
  const medal = daily && counted ? medalFor(ms, daily.medals) : null;
  if (medal) gameAudio.play("medal", { bronze: 0, silver: 1, gold: 2, author: 3 }[medal]);
  demoTimer = 6;
}

// --- Boucle : simulation à pas fixe, rendu interpolé ------------------------------------------
let last = performance.now();
let camYaw = 0;
let camBaseY = 0;
let snapCamera = true;
const camPos = { x: 0, y: 0, z: 0 };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Caméras poursuite (touche C / bouton Vue de la manette) : proche, ou loin pour mieux lire le circuit.
interface CameraRig {
  name: string;
  /** Distance derrière la voiture, à l'arrêt puis en plus à la vitesse de pointe. */
  back: number;
  backAtSpeed: number;
  height: number;
  /** Point visé : devant la voiture, à cette hauteur. */
  ahead: number;
  lookHeight: number;
  /** Champ de vision à l'arrêt, et ouverture en plus à pleine vitesse. */
  fov: number;
  fovAtSpeed: number;
  /** Rapidité (1/s) avec laquelle la caméra rattrape le cap de la voiture et sa position : un léger retard. */
  yawLag: number;
  posLag: number;
}
const CAMERAS: CameraRig[] = [
  { name: "proche", back: 5.6, backAtSpeed: 1.4, height: 2.3, ahead: 5, lookHeight: 1, fov: 68, fovAtSpeed: 20, yawLag: 7, posLag: 14 },
  { name: "loin", back: 9.5, backAtSpeed: 2.2, height: 4.2, ahead: 8, lookHeight: 1.3, fov: 62, fovAtSpeed: 16, yawLag: 5, posLag: 10 },
];
let cameraIndex = 0;
try {
  cameraIndex = Math.max(0, CAMERAS.findIndex((c) => c.name === localStorage.getItem("cdj:camera")));
} catch {
  /* stockage indisponible : caméra proche */
}

function cycleCamera() {
  cameraIndex = (cameraIndex + 1) % CAMERAS.length;
  try {
    localStorage.setItem("cdj:camera", CAMERAS[cameraIndex]!.name);
  } catch {
    /* tant pis */
  }
  showBanner(`Caméra ${CAMERAS[cameraIndex]!.name}`, 1, true);
}

// Indicateur d'effets (HUD) : super turbo, turbo, moteur coupé, et revêtement quand ce n'est pas la route.
const hudFx = $("fx");
const fxSample = createSurface();
const SURFACE_HUD: Record<string, string> = { dirt: "TERRE", ice: "GLACE", grass: "HERBE" };
let fxShown = "";
function updateEffects() {
  const parts: string[] = [];
  if (race && phase !== "countdown") {
    const c = race.car;
    if (c.cut) parts.push("⛔ MOTEUR COUPÉ");
    if (c.turbo > 0) parts.push("🔥 SUPER TURBO");
    else if (c.boost > 0) parts.push("⚡ TURBO");
    if (c.grounded) {
      race.world.sample(c.x, c.z, fxSample);
      const name = SURFACE_HUD[fxSample.kind];
      if (name) parts.push(name);
    }
  }
  const text = parts.join(" · ");
  if (text !== fxShown) {
    fxShown = text;
    hudFx.textContent = text;
    hudFx.dataset.cut = parts.some((p) => p.includes("COUPÉ")) ? "1" : "0";
  }
}

function stepOnce(input: CarInput) {
  lastInput = input;
  const respawnsBefore = race ? race.respawns : 0;
  if (session) {
    session.step(input); // course + enregistrement des commandes + fantôme, ensemble
  } else {
    copyCar(car, previous);
    stepCar(car, input, FLAT_WORLD, carParams);
  }
  // Choc et réception : lecture seule de la vitesse avant / après le pas (jamais d'effet sur la simulation).
  if (!race || race.respawns === respawnsBefore) {
    const t = performance.now();
    if (impactFelt(carSpeed(previous), carSpeed(car)) && t - lastImpactAt > IMPACT_COOLDOWN_MS) {
      lastImpactAt = t;
      if (touchPad) vibrate(touchPad.settings, 40);
      const strength = Math.min(1, (carSpeed(previous) - carSpeed(car)) / 8);
      shake = Math.max(shake, 0.35 + 0.5 * strength);
      if (t - lastImpactSoundAt > 120) {
        lastImpactSoundAt = t;
        gameAudio.play("impact", strength);
      }
    }
    if (previous.grounded === 0 && car.grounded === 1 && previous.vy < -3) {
      const strength = Math.min(1, -previous.vy / 14);
      effects.landing(car.x, car.y, car.z, strength);
      gameAudio.play("land", strength);
      shake = Math.max(shake, 0.2 + 0.7 * strength);
    }
  }
}

function frame(now: number) {
  // Gelé : pause, ou (au toucher) une fenêtre ouverte — avec l'accélérateur automatique, la voiture ne doit pas
  // rouler pendant qu'on lit les archives ou qu'on règle les commandes. Le temps de course compte des pas : exact.
  const frozen = paused || (touchMode && (!hudArchive.hidden || !!touchUi?.settingsOpen()));
  const manualTicksNow = manual ? manualTicks : 0;
  manualTicks = 0;
  const elapsed = manual ? manualTicksNow * DT : frozen ? 0 : Math.min((now - last) / 1000, 0.25) * timeScale; // borne : pas de spirale après un onglet en pause
  const frameMs = now - last;
  last = now;
  if (!frozen && !manual && governor.observe(frameMs)) effects.quality = governor.level;

  const { input, restart, camera: nextCamera, pause: togglePause } = controls.poll();
  if (togglePause) setPaused(!paused);
  if (nextCamera) cycleCamera();
  if (restart) startAttempt();
  else if (input.respawn && frozen) {
    /* pas de reprise pendant la pause : elle s'appliquerait en reprenant */
  } else if (input.respawn) {
    if (race) pendingRespawn = true;
    else startAttempt(); // sol plat : « reprise » = retour au départ
  }

  if (phase === "countdown") {
    countdown -= elapsed;
    if (countdown <= 0) {
      phase = "racing";
      accumulator = 0;
      showBanner("PARTEZ !", 0.9);
      gameAudio.play("go");
    } else {
      showBanner(String(Math.ceil(countdown)), 0.2);
      if (Math.ceil(countdown) !== lastCountdown) {
        lastCountdown = Math.ceil(countdown);
        if (!frozen) gameAudio.play("countdown", lastCountdown);
      }
    }
  } else if (manual) {
    for (let i = 0; i < manualTicksNow && !frozen; i++) {
      stepOnce(autoplay ? autoplay.next() : pendingRespawn ? input : { ...input, respawn: 0 });
      pendingRespawn = false;
    }
    accumulator = 0;
  } else {
    accumulator += elapsed;
    while (accumulator >= DT) {
      stepOnce(autoplay ? autoplay.next() : pendingRespawn ? input : { ...input, respawn: 0 });
      pendingRespawn = false;
      accumulator -= DT;
    }
  }
  const alpha = phase === "countdown" ? 0 : accumulator / DT;

  if (race) {
    if (race.splits.length > shownSplits) {
      shownSplits = race.splits.length;
      renderSplits();
      const ms = race.splits[shownSplits - 1]!;
      const ref = (ghostSource ?? best)?.splits[shownSplits - 1];
      showBanner(ref !== undefined ? `CP${shownSplits}  ${formatDelta(ms - ref)}` : `CP${shownSplits}  ${formatTime(ms)}`, 1.6, true);
      if (touchPad) vibrate(touchPad.settings, 25);
      effects.checkpoint(car.x, car.y, car.z);
      gameAudio.play("checkpoint");
      flash = 1;
    }
    if (race.respawns !== lastRespawns) {
      lastRespawns = race.respawns;
      session?.cutInterpolation(); // pas d'interpolation à travers une téléportation
      snapCamera = true;
    }
    if (race.finishMs >= 0 && phase === "racing") finishRun();
    hudTimer.textContent = phase === "countdown" ? formatTime(0) : formatTime(raceElapsedMs(race));
  } else {
    hudTimer.textContent = "";
  }

  if (bannerTimer > 0) {
    bannerTimer -= elapsed;
    if (bannerTimer <= 0) hudBanner.textContent = "";
  }

  const x = lerp(previous.x, car.x, alpha);
  const y = lerp(previous.y, car.y, alpha);
  const z = lerp(previous.z, car.z, alpha);
  const yaw = previous.yaw + wrapAngle(car.yaw - previous.yaw) * alpha;
  const speed = carSpeed(car);

  // Voiture : tangage et roulis de la caisse calculés par la simulation (suspension), en pentes → angles ;
  // roues : chacune suit le sol sous elle (lecture seule du monde), tourne avec la vitesse et braque.
  readTelemetry(car, race ? race.world : FLAT_WORLD, tel);
  const pitchS = lerp(previous.pitch, car.pitch, alpha);
  const rollS = lerp(previous.roll, car.roll, alpha);
  carMesh.position.set(x, y, z);
  carMesh.rotation.set(-Math.atan(pitchS), yaw, Math.atan(rollS), "YXZ");
  const wheelFollow = 1 - Math.exp(-30 * elapsed);
  for (let i = 0; i < 4; i++) {
    const ground = tel.wheels[i]!.ground;
    const target = ground < NO_GROUND / 2 ? 1 : y + WHEEL_F[i]! * pitchS + WHEEL_L[i]! * rollS - ground;
    wheelDroop[i] = wheelDroop[i]! + (target - wheelDroop[i]!) * wheelFollow;
  }
  wheelPose.forward = tel.forward;
  wheelPose.steerAngle = -car.steer * steerLimit(tel.forward, carParams);
  wheelPose.braking = phase !== "countdown" && lastInput.brake > 0;
  wheelPose.dt = elapsed;
  carModel.update(wheelPose);

  // Fantôme : la rediffusion du meilleur temps, interpolée comme la voiture.
  const ghost = session?.ghost;
  ghostMesh.visible = !!ghost;
  if (ghost) {
    const gc = ghost.race.car;
    const gp = ghost.previous;
    ghostMesh.position.set(lerp(gp.x, gc.x, alpha), lerp(gp.y, gc.y, alpha), lerp(gp.z, gc.z, alpha));
    ghostMesh.rotation.set(-Math.atan(lerp(gp.pitch, gc.pitch, alpha)), gp.yaw + wrapAngle(gc.yaw - gp.yaw) * alpha, Math.atan(lerp(gp.roll, gc.roll, alpha)), "YXZ");
    ghostPose.forward = forwardSpeed(gc);
    ghostPose.steerAngle = -gc.steer * steerLimit(ghostPose.forward, carParams);
    ghostPose.dt = elapsed;
    ghostModel.update(ghostPose);
  }

  // Démo : on change de caméra de temps en temps, et on repart après l'arrivée.
  if (demo) {
    demoClock += elapsed;
    if (demoClock > 7) {
      demoClock = 0;
      cameraIndex = (cameraIndex + 1) % CAMERAS.length;
    }
    if (phase === "finished" && demoTimer > 0 && (demoTimer -= elapsed) <= 0) startAttempt();
  }

  // Caméra poursuite : cap, hauteur et position suivent la voiture avec un léger retard ; le champ de vision
  // s'ouvre avec la vitesse (sensation de vitesse).
  const rig = CAMERAS[cameraIndex]!;
  const speedRatio = Math.min(speed / DEFAULT_CAR_PARAMS.maxSpeed, 1.4);
  if (snapCamera) {
    camYaw = yaw;
    camBaseY = y;
  }
  camYaw += wrapAngle(yaw - camYaw) * (1 - Math.exp(-rig.yawLag * elapsed));
  camBaseY += (y - camBaseY) * (1 - Math.exp(-8 * elapsed));
  const back = rig.back + speedRatio * rig.backAtSpeed;
  const tx = x - Math.sin(camYaw) * back;
  const ty = camBaseY + rig.height;
  const tz = z - Math.cos(camYaw) * back;
  const follow = snapCamera ? 1 : 1 - Math.exp(-rig.posLag * elapsed);
  camPos.x += (tx - camPos.x) * follow;
  camPos.y += (ty - camPos.y) * follow;
  camPos.z += (tz - camPos.z) * follow;
  snapCamera = false;
  // Secousse (chocs, réceptions) : décalage de la caméra qui s'éteint vite ; coupée avec `?shake=0`.
  shake *= Math.max(0, 1 - 7 * elapsed);
  const sh = SHAKE * shake * 0.22;
  camera.position.set(camPos.x + (Math.random() - 0.5) * sh, camPos.y + (Math.random() - 0.5) * sh, camPos.z + (Math.random() - 0.5) * sh);
  camera.lookAt(x + Math.sin(camYaw) * rig.ahead, camBaseY + rig.lookHeight, z + Math.cos(camYaw) * rig.ahead);
  // Turbo : le champ de vision s'ouvre encore (coup de zoom arrière), puis revient.
  fovKick += ((car.turbo > 0 ? 12 : car.boost > 0 ? 7 : 0) - fovKick) * (1 - Math.exp(-5 * elapsed));
  const fov = rig.fov + speedRatio * rig.fovAtSpeed + fovKick;
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }

  view.followGround(x, z);
  effects.setViewport(window.innerHeight, camera.fov, renderer.getPixelRatio());
  effects.update({ dt: elapsed, x, y, z, yaw, tel, braking: wheelPose.braking, boost: car.boost > 0, turbo: car.turbo > 0, racing: phase !== "countdown" });
  gameAudio.update({
    speed,
    throttle: lastInput.throttle / AXIS_MAX,
    brake: lastInput.brake > 0,
    slide: tel.slide,
    grounded: tel.grounded,
    surface: tel.surface,
    boost: car.boost > 0,
    turbo: car.turbo > 0,
    cut: car.cut > 0,
    active: phase === "racing" && !frozen && !manual,
  });
  // Lignes de vitesse au-delà de 75 % de la pointe, éclair du point de contrôle.
  const lines = Math.min(1, Math.max(0, (speedRatio - 0.75) / 0.35)) * 0.55 + (car.turbo > 0 ? 0.25 : 0);
  hudLines.style.opacity = phase === "countdown" ? "0" : lines.toFixed(2);
  flash = Math.max(0, flash - elapsed * 2.2);
  hudFlash.style.opacity = flash.toFixed(2);
  hudSpeed.textContent = `${Math.round(speed * 3.6)} km/h`;
  updateEffects();
  if (!manual) renderer.render(view.scene, camera); // pas à pas (outil de test) : pas de rendu, seulement la simulation et l'interface
  splash?.remove(); // premier rendu fait : on retire l'écran de chargement
  splash = null;
  if (manualWaiters.length) {
    const waiters = manualWaiters;
    manualWaiters = [];
    for (const done of waiters) done();
  }
}

if (demo && track) {
  demoReplay = bestPilotRun(track);
  if (demoReplay) startAttempt();
}
renderer.setAnimationLoop(frame);

// Accès de débogage pour les tests de navigateur (`?debug`) : état de la course, sans effet sur le jeu.
if (params.has("debug")) {
  Object.defineProperty(window, "__cdj", {
    value: {
      get race() {
        return race;
      },
      get car() {
        return car;
      },
      get phase() {
        return phase;
      },
      /** Dernière commande appliquée à la simulation. */
      get input() {
        return lastInput;
      },
      get paused() {
        return paused;
      },
      /** Pas à pas : la simulation n'avance plus qu'avec `advance`. */
      manual(on: boolean) {
        manual = on;
      },
      /** Avance de `n` pas de simulation (mode pas à pas) ; rendu une fois fait, la promesse se résout. */
      advance(n: number) {
        manualTicks += n;
        return new Promise<void>((resolve) => manualWaiters.push(resolve));
      },
      /** Effets : particules émises, qualité, particules vivantes (tests de navigateur). */
      get fx() {
        return { emitted: effects.emitted, quality: effects.quality, particles: effects.particles, enabled: effects.enabled, shake, fovKick, wheelDroop: [...wheelDroop], tel };
      },
      /** Sons : derniers sons joués, contexte démarré, réglages. */
      get audio() {
        return { log: gameAudio.log, running: gameAudio.running, settings: gameAudio.settings };
      },
      get touch() {
        return touchMode;
      },
      get ghost() {
        return session?.ghost?.race.car ?? null;
      },
      /** Joue une rediffusion à la place du clavier (tests de navigateur). */
      autoplay(code: string) {
        const player = new ReplayPlayer(decodeReplay(code));
        startAttempt(); // repart d'un décompte neuf : la rediffusion commence au pas 0
        autoplay = player;
      },
    },
  });
}
