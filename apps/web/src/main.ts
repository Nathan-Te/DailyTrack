import { PerspectiveCamera, WebGLRenderer } from "three";
import { CAR, DT, carSpeed, copyCar, createCar, wrapAngle, stepCar, type CarState } from "@cdj/sim";
import { buildFlatArena } from "./arena";
import { createCarMesh } from "./carMesh";
import { Controls } from "./input";

const params = new URLSearchParams(location.search);
const scenario = params.get("scenario") ?? "plat"; // seul « plat » existe au lot 1

const renderer = new WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const arena = buildFlatArena();
const carMesh = createCarMesh();
arena.scene.add(carMesh);

const camera = new PerspectiveCamera(65, 1, 0.1, 400);
function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

const hudSpeed = document.getElementById("speed")!;
const hudInfo = document.getElementById("info")!;
hudInfo.textContent = `scénario « ${scenario} » · ZQSD/WASD ou flèches · R recommencer · manette OK`;

// --- Simulation à pas fixe, rendu interpolé -------------------------------------------------
const controls = new Controls();
const current: CarState = createCar();
const previous: CarState = createCar();
let accumulator = 0;
let last = performance.now();

let camYaw = 0;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function frame(now: number) {
  const elapsed = Math.min((now - last) / 1000, 0.25); // borne : pas de spirale après un onglet en pause
  last = now;

  const { input, restart } = controls.poll();
  if (restart) {
    Object.assign(current, createCar());
    copyCar(current, previous);
    camYaw = 0;
  }

  accumulator += elapsed;
  while (accumulator >= DT) {
    copyCar(current, previous);
    stepCar(current, input);
    accumulator -= DT;
  }
  const alpha = accumulator / DT;

  const x = lerp(previous.x, current.x, alpha);
  const z = lerp(previous.z, current.z, alpha);
  const yaw = previous.yaw + wrapAngle(current.yaw - previous.yaw) * alpha;
  const speed = carSpeed(current);

  // Voiture : légère inclinaison dans les virages, pour la sensation.
  carMeshUpdate(x, z, yaw, current.steer * (speed / CAR.maxSpeed));

  // Caméra poursuite : le cap de la caméra suit celui de la voiture avec un peu de retard.
  camYaw += wrapAngle(yaw - camYaw) * (1 - Math.exp(-6 * elapsed));
  const back = 7.5 + (speed / CAR.maxSpeed) * 1.5;
  camera.position.set(x - Math.sin(camYaw) * back, 3.2, z - Math.cos(camYaw) * back);
  camera.lookAt(x + Math.sin(camYaw) * 6, 1.2, z + Math.cos(camYaw) * 6);
  const fov = 65 + (speed / CAR.maxSpeed) * 22; // l'élargissement donne la sensation de vitesse
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }

  arena.followGround(x, z);
  hudSpeed.textContent = `${Math.round(speed * 3.6)} km/h`;
  renderer.render(arena.scene, camera);
}

function carMeshUpdate(x: number, z: number, yaw: number, roll: number) {
  carMesh.position.set(x, 0, z);
  carMesh.rotation.set(0, yaw, roll * 0.08, "YXZ");
}

renderer.setAnimationLoop(frame);
