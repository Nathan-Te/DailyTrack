import { PerspectiveCamera, WebGLRenderer } from "three";
import {
  CAR,
  DT,
  FLAT_WORLD,
  SIM_VERSION,
  carSpeed,
  copyCar,
  createCar,
  createTestTrack,
  dailyCircuit,
  ReplayPlayer,
  decodeReplay,
  encodeReplay,
  medalFor,
  parseDay,
  raceElapsedMs,
  stepCar,
  wrapAngle,
  type CarInput,
  type DailyCircuit,
  type Medal,
  type CarState,
  type RaceState,
} from "@cdj/sim";
import { buildFlatArena } from "./arena";
import { createCarMesh } from "./carMesh";
import { formatDelta, formatTime } from "./format";
import type { Leaderboard } from "./api";
import { isValidName, normalizeName } from "./identity";
import { Controls, isTyping } from "./input";
import { Online, ghostModes, nextGhostMode, type GhostMode } from "./online";
import { loadBest, saveBest, type BestRun } from "./records";
import { RunSession } from "./session";
import { PALETTE_DEFS, buildTrackScene } from "./trackMesh";

const params = new URLSearchParams(location.search);
// Scénarios : `jour` (par défaut : le circuit du jour, `?seed=AAAA-MM-JJ` pour une autre date),
// `essai` (le circuit écrit à la main des lots 2-3) et `plat` (le terrain d'essai du lot 1).
const requested = params.get("scenario");
const scenario = requested === "plat" ? "plat" : requested === "essai" ? "essai" : "jour";
const todayUtc = Math.floor(Date.now() / 86_400_000);
const seedParam = params.get("seed");
const seedDay = seedParam === null ? null : parseDay(seedParam);
let daily: DailyCircuit | null = null;
if (scenario === "jour") daily = dailyCircuit(seedDay ?? todayUtc);
const track = scenario === "plat" ? null : daily ? daily.track : createTestTrack();
const COUNTDOWN_S = 3;

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const view = track ? buildTrackScene(track, daily?.palette ?? "desert") : buildFlatArena();
const carMesh = createCarMesh();
view.scene.add(carMesh);
const ghostMesh = createCarMesh(true);
ghostMesh.visible = false;
view.scene.add(ghostMesh);

// Classement : seulement pour le circuit du jour, et si une adresse d'API est configurée (`?api=` ou VITE_API_URL).
const online = new Online(track ? track.id : null, daily ? daily.date : null);
// On ne peut classer que le circuit d'aujourd'hui (un jour passé est figé : le serveur refuse).
const submitAllowed = !!daily && daily.day === todayUtc;
// Outils de test (`?debug`) : accélérer le temps et jouer une rediffusion à la place du clavier.
const timeScale = params.has("debug") ? Math.max(1, Number(params.get("timescale")) || 1) : 1;
let autoplay: ReplayPlayer | null = null;

const camera = new PerspectiveCamera(65, 1, 0.1, 500);
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
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

const MEDAL_ICON: Record<Medal, string> = { author: "🏆", gold: "🥇", silver: "🥈", bronze: "🥉" };
const MEDAL_NAME: Record<Medal, string> = { author: "Meilleur que l'auteur !", gold: "Médaille d'or", silver: "Médaille d'argent", bronze: "Médaille de bronze" };

// Titre du circuit et seuils des médailles.
if (daily) {
  const m = daily.medals;
  const invalidSeed = seedParam !== null && seedDay === null;
  $("meta").textContent = `Circuit du Jour${daily.number >= 1 ? ` #${daily.number}` : ""} · ${daily.date} · ${PALETTE_DEFS[daily.palette].label}${invalidSeed ? " (date invalide : circuit d'aujourd'hui)" : ""}`;
  $("medals").textContent = `${MEDAL_ICON.author} ${formatTime(m.author)}  ${MEDAL_ICON.gold} ${formatTime(m.gold)}  ${MEDAL_ICON.silver} ${formatTime(m.silver)}  ${MEDAL_ICON.bronze} ${formatTime(m.bronze)}`;
} else if (track) {
  $("meta").textContent = "Circuit d'essai";
}
function updateInfo() {
  $("info").textContent = track
    ? `ZQSD/WASD ou flèches · R : point de contrôle · Entrée : départ · manette : Y / Start · G : fantôme${online.enabled ? " · L : classement" : ""}`
    : "scénario « plat » · ZQSD/WASD ou flèches · R ou Entrée : recommencer";
}

// --- État de la partie ----------------------------------------------------------------------
type Phase = "countdown" | "racing" | "finished";

const controls = new Controls();
let best: BestRun | null = track ? loadBest(track.id) : null;
// Fantôme affiché : son record par défaut (`G` pour passer au premier, au joueur devant, ou à aucun).
let ghostMode: GhostMode = params.get("ghost") === "off" ? "off" : "mine";
let ghostSource: BestRun | null = ghostMode === "mine" ? best : null;
let ghostLabel = "ton record";
let ghostBusy = false;
let session: RunSession | null = track ? new RunSession(track, ghostSource) : null;
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

function startAttempt() {
  if (track) {
    session = new RunSession(track, ghostSource);
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
  autoplay = null;
  accumulator = 0;
  pendingRespawn = false;
  shownSplits = 0;
  lastRespawns = 0;
  snapCamera = true;
  hudSplits.textContent = "";
  hudFinish.hidden = true;
  bannerTimer = 0;
}

function showBanner(text: string, seconds: number, small = false) {
  hudBanner.textContent = text;
  hudBanner.classList.toggle("small", small);
  bannerTimer = seconds;
}

function updateGhostInfo() {
  $("ghostinfo").textContent = session?.ghost && ghostSource ? `Fantôme : ${ghostLabel} · ${formatTime(ghostSource.ms)}` : "";
}

function setGhost(mode: GhostMode, source: BestRun | null, label: string) {
  ghostMode = mode;
  ghostSource = source;
  ghostLabel = label;
  if (phase === "racing") showBanner(`Fantôme : ${label} (au prochain départ)`, 2, true);
  else {
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
  title.textContent = lb.participants === 0 ? "Classement du jour : personne encore" : `Classement du jour · ${lb.participants} pilote${lb.participants > 1 ? "s" : ""}`;
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

window.addEventListener("keydown", (e) => {
  if (e.repeat || isTyping(e)) return;
  if (e.code === "KeyG") void cycleGhost();
  if (e.code === "KeyL") setBoardVisible(!boardVisible);
});

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
    box.replaceChildren(text(`Rang ${rank} / ${participants}${extra}`, "rank"), button("Changer de pseudo", () => nameForm()));
    setBoardVisible(true);
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
        setBoardVisible(true);
      }
    });
    box.replaceChildren(form);
    input.focus();
    input.select();
  };

  if (!submitAllowed) {
    box.replaceChildren(text("Classement figé : ce jour est terminé", "status"));
    setBoardVisible(true);
  } else if (online.needsSubmit(best)) {
    void send();
  } else {
    // Ce temps n'améliore pas le record, déjà classé : on affiche simplement la place actuelle.
    box.replaceChildren(text("Chargement du classement…", "status"));
    void online.leaderboard().then((r) => {
      if (r.ok && r.data.me) showRank(r.data.me.rank, r.data.participants);
      else if (r.ok) box.replaceChildren();
      else box.replaceChildren(text(r.message, "error"));
      if (r.ok) setBoardVisible(true);
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
  const isRecord = !best || ms < best.ms;
  const previousBest = best;
  if (isRecord) {
    best = { ms, splits: [...race.splits], replay: encodeReplay(session.toReplay()), simVersion: SIM_VERSION };
    saveBest(track.id, best);
    if (ghostMode === "mine") ghostSource = best; // le prochain fantôme sera ce nouveau record
  }
  const lines: [string, string][] = [
    ["big", formatTime(ms)],
    ...medalLines(ms),
    [isRecord ? "record" : "", isRecord ? (previousBest ? `Nouveau record ! (${formatDelta(ms - previousBest.ms)})` : "Premier temps enregistré") : `Record : ${formatTime(best!.ms)} (${formatDelta(ms - best!.ms)})`],
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
  hint.textContent = "Entrée : rejouer";
  hudFinish.replaceChildren(...rows, ...(online.enabled ? [onlineBox] : []), hint);
  hudFinish.hidden = false;
  if (online.enabled) startOnlineFlow(onlineBox);
  showBanner("ARRIVÉE", 2.5);
}

// --- Boucle : simulation à pas fixe, rendu interpolé ------------------------------------------
let last = performance.now();
let camYaw = 0;
let camBaseY = 0;
let carPitch = 0;
let snapCamera = true;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function stepOnce(input: CarInput) {
  if (session) {
    session.step(input); // course + enregistrement des commandes + fantôme, ensemble
  } else {
    copyCar(car, previous);
    stepCar(car, input, FLAT_WORLD);
  }
}

function frame(now: number) {
  const elapsed = Math.min((now - last) / 1000, 0.25) * timeScale; // borne : pas de spirale après un onglet en pause
  last = now;

  const { input, restart } = controls.poll();
  if (restart) startAttempt();
  else if (input.respawn) {
    if (race) pendingRespawn = true;
    else startAttempt(); // sol plat : « reprise » = retour au départ
  }

  if (phase === "countdown") {
    countdown -= elapsed;
    if (countdown <= 0) {
      phase = "racing";
      accumulator = 0;
      showBanner("PARTEZ !", 0.9);
    } else {
      showBanner(String(Math.ceil(countdown)), 0.2);
    }
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

  // Voiture : suit la pente (tangage) et s'incline un peu dans les virages.
  const horizontal = Math.hypot(car.vx, car.vz);
  const pitchTarget = horizontal > 1 ? -Math.atan2(car.vy, horizontal) : 0;
  carPitch = snapCamera ? pitchTarget : carPitch + (pitchTarget - carPitch) * (1 - Math.exp(-12 * elapsed));
  carMesh.position.set(x, y, z);
  carMesh.rotation.set(carPitch, yaw, car.steer * (speed / CAR.maxSpeed) * 0.08, "YXZ");

  // Fantôme : la rediffusion du meilleur temps, interpolée comme la voiture.
  const ghost = session?.ghost;
  ghostMesh.visible = !!ghost;
  if (ghost) {
    const gc = ghost.race.car;
    const gp = ghost.previous;
    const gh = Math.hypot(gc.vx, gc.vz);
    ghostMesh.position.set(lerp(gp.x, gc.x, alpha), lerp(gp.y, gc.y, alpha), lerp(gp.z, gc.z, alpha));
    ghostMesh.rotation.set(gh > 1 ? -Math.atan2(gc.vy, gh) : 0, gp.yaw + wrapAngle(gc.yaw - gp.yaw) * alpha, 0, "YXZ");
  }

  // Caméra poursuite : cap et hauteur suivent la voiture avec un peu de retard.
  if (snapCamera) {
    camYaw = yaw;
    camBaseY = y;
    snapCamera = false;
  }
  camYaw += wrapAngle(yaw - camYaw) * (1 - Math.exp(-6 * elapsed));
  camBaseY += (y - camBaseY) * (1 - Math.exp(-8 * elapsed));
  const back = 7.5 + (speed / CAR.maxSpeed) * 1.5;
  camera.position.set(x - Math.sin(camYaw) * back, camBaseY + 3.2, z - Math.cos(camYaw) * back);
  camera.lookAt(x + Math.sin(camYaw) * 6, camBaseY + 1.2, z + Math.cos(camYaw) * 6);
  const fov = 65 + Math.min(speed / CAR.maxSpeed, 1.4) * 22; // l'élargissement donne la sensation de vitesse
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }

  view.followGround(x, z);
  hudSpeed.textContent = `${Math.round(speed * 3.6)} km/h`;
  renderer.render(view.scene, camera);
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
