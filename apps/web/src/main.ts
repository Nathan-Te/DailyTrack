import { PerspectiveCamera, WebGLRenderer } from "three";
import {
  CAR,
  DT,
  FLAT_WORLD,
  carSpeed,
  copyCar,
  createCar,
  createRace,
  createTestTrack,
  raceElapsedMs,
  stepCar,
  stepRace,
  wrapAngle,
  type CarInput,
  type CarState,
  type RaceState,
} from "@cdj/sim";
import { buildFlatArena } from "./arena";
import { createCarMesh } from "./carMesh";
import { formatDelta, formatTime } from "./format";
import { Controls } from "./input";
import { loadBest, saveBest, type BestRun } from "./records";
import { buildTrackScene } from "./trackMesh";

const params = new URLSearchParams(location.search);
const scenario = params.get("scenario") === "plat" ? "plat" : "essai";
const track = scenario === "essai" ? createTestTrack() : null;
const COUNTDOWN_S = 3;

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const view = track ? buildTrackScene(track) : buildFlatArena();
const carMesh = createCarMesh();
view.scene.add(carMesh);

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
$("info").textContent = track
  ? "ZQSD/WASD ou flèches · R : point de contrôle · Entrée : départ · manette : Y / Start"
  : "scénario « plat » · ZQSD/WASD ou flèches · R ou Entrée : recommencer";

// --- État de la partie ----------------------------------------------------------------------
type Phase = "countdown" | "racing" | "finished";

const controls = new Controls();
let race: RaceState | null = track ? createRace(track) : null;
let car: CarState = race ? race.car : createCar();
const previous: CarState = createCar();
copyCar(car, previous); // sinon la voiture s'afficherait à l'origine pendant le décompte
let phase: Phase = track ? "countdown" : "racing";
let countdown = COUNTDOWN_S;
let bannerTimer = 0;
let accumulator = 0;
let pendingRespawn = false;
let best: BestRun | null = track ? loadBest(track.id) : null;
let shownSplits = 0;
let lastRespawns = 0;

function startAttempt() {
  if (track) {
    race = createRace(track);
    car = race.car;
    phase = "countdown";
    countdown = COUNTDOWN_S;
  } else {
    car = createCar();
  }
  copyCar(car, previous);
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

function renderSplits() {
  if (!race) return;
  hudSplits.replaceChildren(
    ...race.splits.map((ms, i) => {
      const line = document.createElement("div");
      line.textContent = `CP${i + 1}  ${formatTime(ms)}`;
      const ref = best?.splits[i];
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

function finishRun() {
  if (!race || !track) return;
  phase = "finished";
  const ms = race.finishMs;
  const isRecord = !best || ms < best.ms;
  const previousBest = best;
  if (isRecord) {
    best = { ms, splits: [...race.splits] };
    saveBest(track.id, best);
  }
  const lines: [string, string][] = [
    ["big", formatTime(ms)],
    [isRecord ? "record" : "", isRecord ? (previousBest ? `Nouveau record ! (${formatDelta(ms - previousBest.ms)})` : "Premier temps enregistré") : `Record : ${formatTime(best!.ms)} (${formatDelta(ms - best!.ms)})`],
    ["", race.respawns > 0 ? `${race.respawns} reprise${race.respawns > 1 ? "s" : ""} au point de contrôle` : "Sans reprise"],
    ["hint", "Entrée : rejouer"],
  ];
  hudFinish.replaceChildren(
    ...lines.map(([cls, text]) => {
      const d = document.createElement("div");
      d.className = cls;
      d.textContent = text;
      return d;
    }),
  );
  hudFinish.hidden = false;
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
  if (race) stepRace(race, input);
  else stepCar(car, input, FLAT_WORLD);
}

function frame(now: number) {
  const elapsed = Math.min((now - last) / 1000, 0.25); // borne : pas de spirale après un onglet en pause
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
      copyCar(car, previous);
      stepOnce(pendingRespawn ? input : { ...input, respawn: 0 });
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
      const ref = best?.splits[shownSplits - 1];
      showBanner(ref !== undefined ? `CP${shownSplits}  ${formatDelta(ms - ref)}` : `CP${shownSplits}  ${formatTime(ms)}`, 1.6, true);
    }
    if (race.respawns !== lastRespawns) {
      lastRespawns = race.respawns;
      copyCar(car, previous); // pas d'interpolation à travers une téléportation
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
    },
  });
}
