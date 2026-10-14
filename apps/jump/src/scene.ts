import {
  BoxGeometry,
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
import { TILE_SOLID, UNITS_PER_TILE, cellOrigin, type Level } from "@cdj/jump-sim";
import type { Palette } from "./palette";

// Rendu 2D vue de côté : caméra orthographique, formes géométriques, zéro asset. Monde affiché en tuiles : x vers la droite, y vers le haut,
// la rangée 0 de la grille tout en haut. Aucun calcul de simulation ici : on affiche ce que `jump-sim` a lu.

/** Hauteur de l'image, en tuiles (la grille d'essai en fait 18 : toute sa hauteur tient à l'écran). */
export const VIEW_HEIGHT_TILES = 18;
/** Côté du personnage, en tuiles. */
const PLAYER_SIZE = 0.75;

export interface JumpScene {
  renderer: WebGLRenderer;
  /** Largeur et hauteur de l'image d'après la fenêtre ; à rappeler au redimensionnement. */
  resize(): void;
  /** Centre horizontal de la vue, en tuiles (borné aux bords du niveau). */
  scrollTo(centerX: number): void;
  readonly centerX: number;
  render(): void;
  dispose(): void;
}

/** Position du centre de la vue pour que le niveau reste dans l'image (centré s'il est plus étroit que l'écran). */
export function clampCenterX(level: Level, halfWidth: number, centerX: number): number {
  if (halfWidth * 2 >= level.width) return level.width / 2;
  return Math.min(Math.max(centerX, halfWidth), level.width - halfWidth);
}

export function createScene(canvasParent: HTMLElement, level: Level, palette: Palette): JumpScene {
  const renderer = new WebGLRenderer({ antialias: false, powerPreference: "low-power" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(new Color(palette.background), 1);
  canvasParent.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, -10, 10);
  const world = new Group();
  scene.add(world);

  // x = colonne, y = −rangée : une tuile (col, row) occupe [col, col + 1] × [−row − 1, −row].
  const solid = level.tiles.filter((t) => t === TILE_SOLID).length;
  const tileMaterial = new MeshBasicMaterial({ color: palette.tile });
  const tiles = new InstancedMesh(new PlaneGeometry(1, 1), tileMaterial, solid);
  const m = new Matrix4();
  let i = 0;
  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      if (level.tiles[row * level.width + col] !== TILE_SOLID) continue;
      tiles.setMatrixAt(i++, m.makeTranslation(col + 0.5, -row - 0.5, 0));
    }
  }
  tiles.instanceMatrix.needsUpdate = true;
  world.add(tiles);

  // Arrivée : un cadre plein de la couleur d'arrivée sur sa tuile.
  const finishCell = cellOrigin(level.finish);
  const finish = new Mesh(new PlaneGeometry(0.6, 0.9), new MeshBasicMaterial({ color: palette.finish }));
  finish.position.set(finishCell.x / UNITS_PER_TILE + 0.5, -(finishCell.y / UNITS_PER_TILE) - 0.5 - 0.05, 0.1);
  world.add(finish);

  // Personnage : un carré posé sur le sol de la tuile de départ, deux yeux (immobile dans ce lot).
  const startCell = cellOrigin(level.start);
  const player = new Group();
  player.position.set(startCell.x / UNITS_PER_TILE + 0.5, -(startCell.y / UNITS_PER_TILE) - 1 + PLAYER_SIZE / 2, 0.2);
  player.add(new Mesh(new BoxGeometry(PLAYER_SIZE, PLAYER_SIZE, 0.1), new MeshBasicMaterial({ color: palette.player })));
  const eyeWhite = new MeshBasicMaterial({ color: 0xffffff });
  const eyePupil = new MeshBasicMaterial({ color: 0x101820 });
  for (const dx of [-0.17, 0.17]) {
    const white = new Mesh(new PlaneGeometry(0.2, 0.26), eyeWhite);
    white.position.set(dx, 0.1, 0.06);
    const pupil = new Mesh(new PlaneGeometry(0.09, 0.14), eyePupil);
    pupil.position.set(dx + 0.03, 0.09, 0.07);
    player.add(white, pupil);
  }
  world.add(player);

  let centerX = 0;
  let halfWidth = 1;

  const place = () => {
    camera.left = centerX - halfWidth;
    camera.right = centerX + halfWidth;
    camera.top = -level.height / 2 + VIEW_HEIGHT_TILES / 2;
    camera.bottom = -level.height / 2 - VIEW_HEIGHT_TILES / 2;
    camera.updateProjectionMatrix();
  };

  const api: JumpScene = {
    renderer,
    resize() {
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      renderer.setSize(w, h, false);
      halfWidth = (VIEW_HEIGHT_TILES * (w / h)) / 2;
      centerX = clampCenterX(level, halfWidth, centerX);
      place();
    },
    scrollTo(x) {
      centerX = clampCenterX(level, halfWidth, x);
      place();
    },
    get centerX() {
      return centerX;
    },
    render() {
      renderer.render(scene, camera);
    },
    dispose() {
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
  // Première vue : calée sur le départ.
  centerX = startCell.x / UNITS_PER_TILE;
  api.resize();
  return api;
}
