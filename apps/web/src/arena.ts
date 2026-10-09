import type { Look, SceneStats } from "./trackMesh";
import {
  AmbientLight,
  BoxGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  DirectionalLight,
  Fog,
  Group,
  Mesh,
  MeshStandardMaterial,
  NearestFilter,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
} from "three";

const TILE = 5; // mètres
const GROUND_SIZE = 600;

function checkerTexture(a: string, b: string): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 2;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, 2, 2);
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillRect(1, 1, 1, 1);
  const tex = new CanvasTexture(canvas);
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(GROUND_SIZE / (2 * TILE), GROUND_SIZE / (2 * TILE));
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

export interface Arena {
  scene: Scene;
  /** Garde le sol « infini » : à appeler chaque image avec la position de la voiture. */
  followGround(x: number, z: number): void;
  /** Décor allégé (qualité basse) : sans effet ici, il n'y a pas de décor. */
  setLite(on: boolean): void;
  /** Qualité, ambiance, halos, ombres et phares (lot 23) : sans objet ici (pas de décor). */
  setQuality(level: 0 | 1 | 2): void;
  look: Look;
  setView(heightPx: number, fovDeg: number): void;
  followCar(x: number, y: number, z: number, yaw: number): void;
  stats(): SceneStats;
}

/** Scénario `plat` : un grand sol à damier, quelques cônes de repère, aucune collision. */
export function buildFlatArena(): Arena {
  const sky = new Color(0xf2b27a); // thème « désert »
  const scene = new Scene();
  scene.background = sky;
  scene.fog = new Fog(sky, 80, 260);

  scene.add(new AmbientLight(0xfff0e0, 0.9));
  const sun = new DirectionalLight(0xffffff, 2.2);
  sun.position.set(40, 80, -30);
  scene.add(sun);

  const ground = new Mesh(
    new PlaneGeometry(GROUND_SIZE, GROUND_SIZE),
    new MeshStandardMaterial({ map: checkerTexture("#d9a35f", "#c78f4c"), flatShading: true }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const coneGeo = new ConeGeometry(0.6, 1.6, 8);
  const orange = new MeshStandardMaterial({ color: 0xff6a1a, flatShading: true });
  const white = new MeshStandardMaterial({ color: 0xf5f5f5, flatShading: true });
  const props = new Group();
  const cone = (x: number, z: number, m = orange) => {
    const c = new Mesh(coneGeo, m);
    c.position.set(x, 0.8, z);
    props.add(c);
  };
  // Slalom droit devant le départ.
  for (let i = 0; i < 12; i++) cone(i % 2 === 0 ? -5 : 5, 40 + i * 16);
  // Grand cercle de 70 m de rayon.
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * Math.PI * 2;
    cone(Math.sin(a) * 70, 100 + Math.cos(a) * 70 - 70, i % 8 === 0 ? white : orange);
  }
  // Quelques blocs repères pour la vitesse.
  const block = new BoxGeometry(6, 5, 6);
  const blockMat = new MeshStandardMaterial({ color: 0x3a7bd5, flatShading: true });
  for (const [x, z] of [[-30, 60], [32, 120], [-28, 200], [30, 280], [0, -40]] as const) {
    const b = new Mesh(block, blockMat);
    b.position.set(x, 2.5, z);
    props.add(b);
  }
  scene.add(props);

  return {
    scene,
    setLite() {},
    setQuality() {},
    look: { exposure: 1, haze: 1, halo: 0, headlights: 0, shadow: 0 },
    setView() {},
    followCar() {},
    stats: () => ({ quality: 2, shadowMap: 0, headlights: 0, halos: { count: 0, visible: false }, denseDecor: false, hills: false, signs: 0, fog: null }),
    followGround(x, z) {
      // Par pas de deux cases, pour que le damier ne « saute » pas.
      ground.position.x = Math.round(x / (2 * TILE)) * 2 * TILE;
      ground.position.z = Math.round(z / (2 * TILE)) * 2 * TILE;
    },
  };
}
