import {
  Color,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  WebGLRenderer,
} from "three";
import { PLAYER_HEIGHT, PLAYER_WIDTH, TILE_SOLID, UNITS_PER_TILE, cellOrigin, type Level } from "@cdj/jump-sim";
import { viewHeightTiles, VIEW_TILES_DESKTOP, type Frame } from "./camera";
import { squashScale, type Look } from "./look";
import type { Palette } from "./palette";

// Rendu 2D vue de côté : caméra orthographique, formes géométriques, zéro asset. Monde en tuiles : x vers la droite, y vers le haut,
// la rangée 0 de la grille tout en haut. Aucun calcul de simulation ici : on affiche ce que `jump-sim` a calculé.

/** Ce que le rendu sait du personnage : sa boîte (interpolée), en tuiles, et son allure. */
export interface PlayerPose {
  /** Coin haut-gauche de la boîte, en tuiles, y vers le bas (comme la simulation). */
  x: number;
  y: number;
  look: Look;
}

export interface JumpScene {
  renderer: WebGLRenderer;
  /** Largeur et hauteur de l'image d'après la fenêtre ; à rappeler au redimensionnement. */
  resize(touch?: boolean): void;
  /** Taille du niveau et de l'image, en tuiles (pour la caméra). */
  readonly frame: Frame;
  setView(x: number, y: number): void;
  setPlayer(pose: PlayerPose): void;
  render(): void;
  dispose(): void;
}

const PW = PLAYER_WIDTH / UNITS_PER_TILE;
const PH = PLAYER_HEIGHT / UNITS_PER_TILE;

export function createScene(canvasParent: HTMLElement, level: Level, palette: Palette): JumpScene {
  const renderer = new WebGLRenderer({ antialias: false, powerPreference: "low-power", preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(new Color(palette.background), 1);
  canvasParent.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, -10, 10);
  const world = new Group();
  scene.add(world);

  // Tuiles pleines : une tuile (col, row) occupe [col, col + 1] × [−row − 1, −row].
  const solid = level.tiles.filter((t) => t === TILE_SOLID).length;
  const tiles = new InstancedMesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ color: palette.tile }), Math.max(1, solid));
  const m = new Matrix4();
  let i = 0;
  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      if (level.tiles[row * level.width + col] !== TILE_SOLID) continue;
      tiles.setMatrixAt(i++, m.makeTranslation(col + 0.5, -row - 0.5, 0));
    }
  }
  tiles.count = solid;
  tiles.instanceMatrix.needsUpdate = true;
  world.add(tiles);

  // Arrivée : un drapeau plein de la couleur d'arrivée sur sa tuile (inerte au lot 1).
  const finishCell = cellOrigin(level.finish);
  const finish = new Mesh(new PlaneGeometry(0.6, 0.9), new MeshBasicMaterial({ color: palette.finish }));
  finish.position.set(finishCell.x / UNITS_PER_TILE + 0.5, -(finishCell.y / UNITS_PER_TILE) - 0.55, 0.1);
  world.add(finish);

  // Personnage : un carré (exactement la boîte de collision) et deux yeux. `feet` est posé au milieu du bas de la boîte : l'écrasement
  // s'y applique, les pieds restent au sol.
  const player = new Group();
  const feet = new Group();
  const body = new Mesh(new PlaneGeometry(PW, PH), new MeshBasicMaterial({ color: palette.player }));
  body.position.set(0, PH / 2, 0);
  feet.add(body);
  const eyes = new Group();
  eyes.position.set(0, PH * 0.62, 0.05);
  const eyeWhite = new MeshBasicMaterial({ color: 0xffffff });
  const eyePupil = new MeshBasicMaterial({ color: 0x101820 });
  const pupils: Mesh[] = [];
  for (const dx of [-0.16, 0.16]) {
    const white = new Mesh(new PlaneGeometry(0.2, 0.26), eyeWhite);
    white.position.set(dx, 0, 0);
    const pupil = new Mesh(new PlaneGeometry(0.09, 0.14), eyePupil);
    pupil.position.set(dx, 0, 0.01);
    pupil.userData.baseX = dx;
    pupils.push(pupil);
    eyes.add(white, pupil);
  }
  feet.add(eyes);
  player.add(feet);
  player.position.z = 0.2;
  world.add(player);

  const frame: Frame = { width: level.width, height: level.height, halfW: 1, halfH: VIEW_TILES_DESKTOP / 2 };
  let viewX = 0;
  let viewY = 0;

  const place = () => {
    camera.left = viewX - frame.halfW;
    camera.right = viewX + frame.halfW;
    camera.top = viewY + frame.halfH;
    camera.bottom = viewY - frame.halfH;
    camera.updateProjectionMatrix();
  };

  return {
    renderer,
    frame,
    resize(touch = false) {
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      renderer.setSize(w, h, false);
      const tiles = viewHeightTiles(w, h, touch);
      frame.halfH = tiles / 2;
      frame.halfW = (tiles * (w / h)) / 2;
      place();
    },
    setView(x, y) {
      viewX = x;
      viewY = y;
      place();
    },
    setPlayer(pose) {
      player.position.x = pose.x + PW / 2;
      player.position.y = -(pose.y + PH);
      const { sx, sy } = squashScale(pose.look.squash);
      feet.scale.set(sx, sy, 1);
      const lookX = pose.look.eyeX;
      eyes.position.x = lookX * 0.07;
      for (const p of pupils) {
        p.position.x = (p.userData.baseX as number) + lookX * 0.04;
        p.position.y = pose.look.eyeY * 0.05;
      }
    },
    render() {
      renderer.render(scene, camera);
    },
    dispose() {
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
