import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineLoop,
  LineSegments,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  Shape,
  ShapeGeometry,
  Vector3,
  WebGLRenderer,
  CanvasTexture,
  Sprite,
  SpriteMaterial,
  AlwaysStencilFunc,
  ReplaceStencilOp,
} from "three";
import {
  ATTEMPT_DEAD,
  CRUMBLE_GONE,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  TILE_SOLID,
  TILE_SPRING,
  UNITS_PER_TILE,
  cellOrigin,
  isSpikeTile,
  sawCenters,
  spikeBox,
  type AttemptState,
  type Level,
} from "@cdj/jump-sim";
import { viewHeightTiles, VIEW_TILES_DESKTOP, type Frame } from "./camera";
import { SOLID_STENCIL } from "./actors";
import { BurstMesh, type BurstPool } from "./fx";
import { squashScale, type Look } from "./look";
import type { Palette } from "./palette";

// Rendu 2D vue de côté : caméra orthographique, formes géométriques, zéro asset. Monde en tuiles : x vers la droite, y vers le haut,
// la rangée 0 de la grille tout en haut. Aucun calcul de simulation ici : on affiche ce que `jump-sim` a calculé (positions des scies,
// minuteries des blocs friables, dernier ressort), en ne faisant que lire l'état.

/** Ce que le rendu sait du personnage : sa boîte (interpolée), en tuiles, et son allure. */
export interface PlayerPose {
  /** Coin haut-gauche de la boîte, en tuiles, y vers le bas (comme la simulation). */
  x: number;
  y: number;
  look: Look;
  visible?: boolean;
  /** Lot 8 : yeux fermés (0 ouverts … 1 fermés) et part de l'écrasement affichée (réglages). */
  blink?: number;
  squashAmount?: number;
}

export interface SceneOptions {
  /** `?debug&hitbox` : boîtes de collision et sections dessinées. */
  hitbox?: boolean;
  /** Éclats de la mort (absent avec `?fx=off`). */
  burst?: BurstPool | null;
  /** Lot 5, `?debug` sur le niveau du jour : limites des morceaux (colonnes, rangée du palier d'entrée) et leur étiquette. */
  pieces?: readonly PieceMark[];
}

/** Un morceau du niveau du jour, dessiné en `?debug`. */
export interface PieceMark {
  col0: number;
  col1: number;
  /** Rangée du sol de son palier d'entrée : l'étiquette se pose au-dessus. */
  row: number;
  label: string;
}

/** Étiquette de texte (sprite, sans éclairage) : `height` tuiles de haut. Affichage de debug seulement. */
function textSprite(text: string, height: number): Sprite {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const font = "600 40px system-ui, sans-serif";
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + 24;
  canvas.width = w;
  canvas.height = 56;
  ctx.font = font;
  ctx.fillStyle = "rgba(11, 16, 32, 0.78)";
  ctx.fillRect(0, 0, w, 56);
  ctx.fillStyle = "#ffd22e";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 12, 29);
  const sprite = new Sprite(new SpriteMaterial({ map: new CanvasTexture(canvas), depthTest: false, transparent: true }));
  sprite.scale.set((height * w) / 56, height, 1);
  return sprite;
}

export interface JumpScene {
  renderer: WebGLRenderer;
  /** Le monde (tuiles, y vers le haut) : le lot 3 y ajoute fantôme, foule du carnage et taches (`actors.ts`). */
  readonly world: Group;
  /** Recul de la caméra (1 = normal ; le carnage dézoome un peu). Prend effet au prochain `resize`. */
  zoom: number;
  /** Largeur et hauteur de l'image d'après la fenêtre ; à rappeler au redimensionnement. */
  resize(touch?: boolean): void;
  /** Taille du niveau et de l'image, en tuiles (pour la caméra). */
  readonly frame: Frame;
  setView(x: number, y: number): void;
  setPlayer(pose: PlayerPose): void;
  /** Le niveau dans l'état de l'essai : scies (interpolées entre `prev` et `state`), blocs friables, ressorts. `clock` : secondes. */
  setWorld(prev: Readonly<AttemptState>, state: Readonly<AttemptState>, alpha: number, clock: number): void;
  /** Lot 8 : traînée à pleine vitesse (coins haut-gauche en tuiles, y vers le bas, et opacité). */
  setTrail(points: readonly { x: number; y: number; alpha: number }[]): void;
  /** Lot 8 : animations douces (fanion qui se lève, ressort qui rebondit) ; faux : posées tout de suite (mouvement réduit, effets aucun). */
  animate: boolean;
  render(): void;
  dispose(): void;
}

const T = UNITS_PER_TILE;
const PW = PLAYER_WIDTH / T;
const PH = PLAYER_HEIGHT / T;

/** Disque denté : `teeth` dents, corps de rayon `body`, pointes à `tip` (tuiles). */
function sawShape(body: number, tip: number, teeth: number): ShapeGeometry {
  const s = new Shape();
  const n = teeth * 2;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = i % 2 === 0 ? body : tip;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  return new ShapeGeometry(s);
}

/** Pics : un triangle franc par tuile, pointe selon l'orientation (coordonnées du monde, y vers le haut). */
function spikeTriangles(level: Level): BufferGeometry {
  const pos: number[] = [];
  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < level.width; col++) {
      const t = level.tiles[row * level.width + col]!;
      if (!isSpikeTile(t)) continue;
      const x0 = col;
      const x1 = col + 1;
      const yTop = -row;
      const yBot = -row - 1;
      const xm = col + 0.5;
      const ym = -row - 0.5;
      // Codes : 4 haut, 5 bas, 6 gauche, 7 droite.
      if (t === 4) pos.push(x0, yBot, 0, x1, yBot, 0, xm, yTop, 0);
      else if (t === 5) pos.push(x0, yTop, 0, xm, yBot, 0, x1, yTop, 0);
      else if (t === 6) pos.push(x1, yTop, 0, x0, ym, 0, x1, yBot, 0);
      else pos.push(x0, yBot, 0, x1, ym, 0, x0, yTop, 0);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  return g;
}

/** Boîte [x, x + w] × [y, y + h] de la simulation (unités, y vers le bas) → quatre segments (tuiles, y vers le haut). */
function boxSegments(out: number[], x: number, y: number, w: number, h: number): void {
  const a = x / T;
  const b = (x + w) / T;
  const c = -y / T;
  const d = -(y + h) / T;
  out.push(a, c, 0, b, c, 0, b, c, 0, b, d, 0, b, d, 0, a, d, 0, a, d, 0, a, c, 0);
}

function circlePoints(r: number, n = 40): Vector3[] {
  const pts: Vector3[] = [];
  for (let i = 0; i < n; i++) pts.push(new Vector3(Math.cos((i / n) * Math.PI * 2) * r, Math.sin((i / n) * Math.PI * 2) * r, 0));
  return pts;
}

export function createScene(canvasParent: HTMLElement, level: Level, palette: Palette, options: SceneOptions = {}): JumpScene {
  // Pochoir (lot 3) : les blocs pleins l'écrivent, les taches de peinture ne se dessinent que là (`actors.ts`).
  const renderer = new WebGLRenderer({ antialias: false, powerPreference: "low-power", preserveDrawingBuffer: false, stencil: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(new Color(palette.background), 1);
  canvasParent.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new OrthographicCamera(-1, 1, 1, -1, -10, 10);
  const world = new Group();
  scene.add(world);
  const W = level.width;

  // ——— Tuiles pleines : une tuile (col, row) occupe [col, col + 1] × [−row − 1, −row] ———
  const solid = level.tiles.filter((t) => t === TILE_SOLID).length;
  const tileMat = new MeshBasicMaterial({ color: palette.tile });
  tileMat.stencilWrite = true;
  tileMat.stencilRef = SOLID_STENCIL;
  tileMat.stencilFunc = AlwaysStencilFunc;
  tileMat.stencilZPass = ReplaceStencilOp;
  const tiles = new InstancedMesh(new PlaneGeometry(1, 1), tileMat, Math.max(1, solid));
  const m = new Matrix4();
  let i = 0;
  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < W; col++) {
      if (level.tiles[row * W + col] !== TILE_SOLID) continue;
      tiles.setMatrixAt(i++, m.makeTranslation(col + 0.5, -row - 0.5, 0));
    }
  }
  tiles.count = solid;
  tiles.instanceMatrix.needsUpdate = true;
  world.add(tiles);

  // ——— Pics : triangles francs ———
  const spikes = new Mesh(spikeTriangles(level), new MeshBasicMaterial({ color: palette.hazard }));
  spikes.position.z = 0.05;
  world.add(spikes);

  // ——— Blocs friables : aspect distinct (plus clair, fendu, quatre éclats aux coins), ils tremblent pendant leur minuterie ———
  const crumbleColor = new Color(palette.crumble);
  const crackMat = new MeshBasicMaterial({ color: crumbleColor.clone().multiplyScalar(0.55) });
  const crumbleMat = new MeshBasicMaterial({ color: crumbleColor });
  const crumbleGeo = new PlaneGeometry(0.92, 0.92);
  const crackGeo = new PlaneGeometry(0.08, 0.62);
  const chipGeo = new PlaneGeometry(0.16, 0.16);
  const crumbles = level.crumbles.map((cell) => {
    const g = new Group();
    g.add(new Mesh(crumbleGeo, crumbleMat));
    const crack1 = new Mesh(crackGeo, crackMat);
    crack1.rotation.z = 0.6;
    crack1.position.set(-0.08, 0.04, 0.01);
    const crack2 = new Mesh(crackGeo, crackMat);
    crack2.rotation.z = -0.9;
    crack2.scale.y = 0.6;
    crack2.position.set(0.14, -0.12, 0.01);
    g.add(crack1, crack2);
    for (const [dx, dy] of [[-0.34, 0.34], [0.34, 0.34], [-0.34, -0.34], [0.34, -0.34]] as const) {
      const chip = new Mesh(chipGeo, crackMat);
      chip.position.set(dx, dy, 0.01);
      g.add(chip);
    }
    g.position.set(cell.col + 0.5, -cell.row - 0.5, 0.02);
    g.userData.home = { x: g.position.x, y: g.position.y };
    world.add(g);
    return g;
  });

  // ——— Ressorts : socle sombre, ressort en zigzag, plateau de couleur qui se comprime à l'impact ———
  const springMat = new MeshBasicMaterial({ color: palette.spring });
  const springBase = new MeshBasicMaterial({ color: new Color(palette.tile).multiplyScalar(0.6) });
  const springs = new Map<number, { pad: Mesh; coil: Group }>();
  for (let row = 0; row < level.height; row++) {
    for (let col = 0; col < W; col++) {
      if (level.tiles[row * W + col] !== TILE_SPRING) continue;
      const g = new Group();
      g.position.set(col + 0.5, -row - 1, 0.03); // origine : bas de la tuile
      const base = new Mesh(new PlaneGeometry(1, 0.3), springBase);
      base.position.y = 0.15;
      const coil = new Group();
      for (let k = 0; k < 4; k++) {
        const bar = new Mesh(new PlaneGeometry(0.7, 0.07), springMat);
        bar.rotation.z = k % 2 ? 0.35 : -0.35;
        bar.position.y = 0.38 + k * 0.13;
        coil.add(bar);
      }
      const pad = new Mesh(new PlaneGeometry(1, 0.16), springMat);
      pad.position.y = 0.92;
      g.add(base, coil, pad);
      world.add(g);
      springs.set(row * W + col, { pad, coil });
    }
  }

  // ——— Scies : disques dentés qui tournent (affichage), trajets des scies mobiles en pointillés discrets ———
  const sawMat = new MeshBasicMaterial({ color: palette.hazard });
  const hubMat = new MeshBasicMaterial({ color: palette.background });
  const saws = level.saws.map((saw) => {
    const body = saw.radius / T;
    const tip = body + Math.min(0.14, body * 0.25);
    const g = new Group();
    const disc = new Mesh(sawShape(body, tip, Math.max(8, Math.round(body * 18))), sawMat);
    const hub = new Mesh(new PlaneGeometry(body * 0.45, body * 0.45), hubMat);
    hub.position.z = 0.01;
    disc.add(hub);
    g.add(disc);
    g.position.z = 0.15;
    world.add(g);
    return { g, disc };
  });
  const pathMat = new LineDashedMaterial({ color: palette.hazard, dashSize: 0.25, gapSize: 0.3, transparent: true, opacity: 0.45 });
  for (const saw of level.saws) {
    if (saw.cycle === 0) continue;
    const pts = saw.points.map((p) => new Vector3(p.x / T, -p.y / T, 0.01));
    if (saw.mode === "boucle") pts.push(pts[0]!.clone());
    const line = new Line(new BufferGeometry().setFromPoints(pts), pathMat);
    line.computeLineDistances();
    world.add(line);
  }

  // ——— Arrivée : une tuile cerclée qui pulse, un mât et un grand drapeau en damier ———
  const finishCell = cellOrigin(level.finish);
  const fx = finishCell.x / T;
  const fy = -finishCell.y / T;
  const finish = new Group();
  const glow = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ color: palette.finish, transparent: true, opacity: 0.25 }));
  glow.position.set(fx + 0.5, fy - 0.5, 0.01);
  const ring = new LineLoop(new BufferGeometry().setFromPoints([new Vector3(fx, fy, 0.02), new Vector3(fx + 1, fy, 0.02), new Vector3(fx + 1, fy - 1, 0.02), new Vector3(fx, fy - 1, 0.02)]), new LineBasicMaterial({ color: palette.finish }));
  const pole = new Mesh(new PlaneGeometry(0.1, 2.2), new MeshBasicMaterial({ color: palette.player }));
  pole.position.set(fx + 0.2, fy + 0.1, 0.05);
  const flag = new Group();
  flag.position.set(fx + 0.25, fy + 1.2, 0.06);
  const flagW = 0.9;
  const flagH = 0.6;
  const dark = new MeshBasicMaterial({ color: new Color(palette.finish).multiplyScalar(0.35) });
  const bright = new MeshBasicMaterial({ color: palette.finish });
  for (let a = 0; a < 3; a++) {
    for (let b = 0; b < 2; b++) {
      const sq = new Mesh(new PlaneGeometry(flagW / 3, flagH / 2), (a + b) % 2 ? dark : bright);
      sq.position.set((a + 0.5) * (flagW / 3), -(b + 0.5) * (flagH / 2), 0);
      flag.add(sq);
    }
  }
  finish.add(glow, ring, pole, flag);
  world.add(finish);

  // ——— Points de passage (lot 2b) : un mât et un fanion, pâles tant qu'on ne les a pas pris, colorés quand c'est le point de reprise.
  // Lot 4 : un point se prend en franchissant sa colonne, à n'importe quelle hauteur ; il se dessine donc aussi comme une **porte discrète** :
  // une bande translucide sur toute la hauteur libre de sa colonne, et un trait pointillé sur le seuil (le bord gauche de la colonne, que le
  // centre du personnage doit passer).
  const cpIdle = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 });
  const cpOn = new MeshBasicMaterial({ color: palette.spring });
  const cpPole = new MeshBasicMaterial({ color: palette.player, transparent: true, opacity: 0.8 });
  const doorIdle = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.05, depthWrite: false });
  const doorOn = new MeshBasicMaterial({ color: palette.spring, transparent: true, opacity: 0.1, depthWrite: false });
  const doorLine = new LineDashedMaterial({ color: 0xffffff, dashSize: 0.3, gapSize: 0.3, transparent: true, opacity: 0.35 });
  const solidAt = (col: number, row: number) => row >= 0 && row < level.height && level.tiles[row * level.width + col]! >= TILE_SOLID && level.tiles[row * level.width + col]! <= TILE_SPRING;
  const doors: Mesh[] = [];
  const checkpoints = level.checkpoints.map((cell) => {
    // Hauteur libre de la colonne autour du point : vers le haut jusqu'au premier bloc (ou le haut du niveau), vers le bas jusqu'au sol.
    let top = cell.row;
    while (top > 0 && !solidAt(cell.col, top - 1)) top--;
    let bottom = cell.row;
    while (bottom < level.height - 1 && !solidAt(cell.col, bottom + 1)) bottom++;
    const span = bottom - top + 1;
    const door = new Mesh(new PlaneGeometry(1, span), doorIdle);
    door.position.set(cell.col + 0.5, -top - span / 2, 0.02);
    world.add(door);
    doors.push(door);
    const sill = new Line(new BufferGeometry().setFromPoints([new Vector3(cell.col, -top, 0.03), new Vector3(cell.col, -bottom - 1, 0.03)]), doorLine);
    sill.computeLineDistances();
    world.add(sill);
    const g = new Group();
    g.position.set(cell.col + 0.5, -cell.row - 1, 0.04); // origine : bas de la tuile
    const pole = new Mesh(new PlaneGeometry(0.08, 1.3), cpPole);
    pole.position.set(-0.2, 0.65, 0);
    const pennant = new Mesh(new PlaneGeometry(0.55, 0.36), cpIdle);
    pennant.position.set(0.08, 1.12, 0.01);
    const base = new Mesh(new PlaneGeometry(0.7, 0.08), cpPole);
    base.position.set(0, 0.04, 0);
    g.add(pole, pennant, base);
    world.add(g);
    return pennant;
  });
  let shownCheckpoint = -2;
  // Lot 8 : le fanion est en bas du mât tant que le point n'est pas franchi, il se lève quand on le franchit (et redescend au départ).
  const FLAG_LOW = 0.3;
  const FLAG_HIGH = 1.12;
  const flagLift = checkpoints.map(() => 0);
  let lastClock = 0;

  // ——— Personnage : un carré (exactement la boîte de collision) et deux yeux ———
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

  // ——— Lot 8 : traînée à pleine vitesse, quelques carrés pâles (un matériau chacun pour son opacité ; pool fixe) ———
  const trailMeshes: Mesh[] = [];
  for (let k = 0; k < 5; k++) {
    const t = new Mesh(new PlaneGeometry(PW, PH), new MeshBasicMaterial({ color: palette.player, transparent: true, opacity: 0, depthWrite: false }));
    t.position.z = 0.18 - k * 0.001;
    t.visible = false;
    world.add(t);
    trailMeshes.push(t);
  }

  const burst = options.burst ? new BurstMesh(options.burst, palette.player, world) : null;

  // ——— ?debug&hitbox : boîtes « justes » (personnage, pics réduits, disques mortels), sections ———
  const debugColor = 0x00ff66;
  let hitPlayer: LineSegments | null = null;
  const hitSaws: LineLoop[] = [];
  if (options.hitbox) {
    const seg: number[] = [];
    for (let row = 0; row < level.height; row++) {
      for (let col = 0; col < W; col++) {
        const t = level.tiles[row * W + col]!;
        if (!isSpikeTile(t)) continue;
        const b = spikeBox(t, col, row);
        boxSegments(seg, b.x, b.y, b.w, b.h);
      }
    }
    for (const s of level.sections) {
      seg.push(s.c0, 0, 0, s.c0, -level.height, 0);
      if (s.c1 + 1 < W) seg.push(s.c1 + 1, 0, 0, s.c1 + 1, -level.height, 0);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(seg, 3));
    const hb = new LineSegments(g, new LineBasicMaterial({ color: debugColor }));
    hb.position.z = 0.5;
    world.add(hb);
    const pg = new BufferGeometry();
    const ps: number[] = [];
    boxSegments(ps, 0, 0, PLAYER_WIDTH, PLAYER_HEIGHT);
    pg.setAttribute("position", new Float32BufferAttribute(ps, 3));
    hitPlayer = new LineSegments(pg, new LineBasicMaterial({ color: debugColor }));
    hitPlayer.position.z = 0.5;
    world.add(hitPlayer);
    for (const saw of level.saws) {
      const loop = new LineLoop(new BufferGeometry().setFromPoints(circlePoints(saw.radius / T)), new LineBasicMaterial({ color: debugColor }));
      loop.position.z = 0.5;
      world.add(loop);
      hitSaws.push(loop);
    }
  }

  // ——— Lot 5, ?debug : limites des morceaux du niveau du jour, avec leur identifiant, leur variante et leur exigence ———
  if (options.pieces && options.pieces.length > 0) {
    const seg: number[] = [];
    for (const p of options.pieces) seg.push(p.col0, 0, 0, p.col0, -level.height, 0, p.col1 + 1, 0, 0, p.col1 + 1, -level.height, 0);
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(seg, 3));
    const lines = new LineSegments(g, new LineBasicMaterial({ color: 0xffd22e, transparent: true, opacity: 0.7 }));
    lines.position.z = 0.55;
    world.add(lines);
    for (const p of options.pieces) {
      const label = textSprite(p.label, 0.8);
      label.position.set(p.col0 + 0.2 + label.scale.x / 2, -(p.row - 4.6), 0.6);
      world.add(label);
    }
  }

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
    world,
    zoom: 1,
    animate: true,
    frame,
    resize(touch = false) {
      const w = Math.max(1, window.innerWidth);
      const h = Math.max(1, window.innerHeight);
      renderer.setSize(w, h, false);
      const tilesHigh = viewHeightTiles(w, h, touch) * this.zoom;
      frame.halfH = tilesHigh / 2;
      frame.halfW = (tilesHigh * (w / h)) / 2;
      place();
    },
    setView(x, y) {
      viewX = x;
      viewY = y;
      place();
    },
    setPlayer(pose) {
      player.visible = pose.visible !== false;
      player.position.x = pose.x + PW / 2;
      player.position.y = -(pose.y + PH);
      const { sx, sy } = squashScale(pose.look.squash, pose.squashAmount ?? 1);
      feet.scale.set(sx, sy, 1);
      eyes.scale.y = 1 - 0.88 * (pose.blink ?? 0);
      const lookX = pose.look.eyeX;
      eyes.position.x = lookX * 0.07;
      for (const p of pupils) {
        p.position.x = (p.userData.baseX as number) + lookX * 0.04;
        p.position.y = pose.look.eyeY * 0.05;
      }
      if (hitPlayer) {
        hitPlayer.visible = player.visible;
        hitPlayer.position.set(pose.x, -pose.y, 0.5);
      }
    },
    setTrail(points) {
      for (let k = 0; k < trailMeshes.length; k++) {
        const m = trailMeshes[k]!;
        const p = points[k];
        m.visible = !!p && p.alpha > 0.01;
        if (!p) continue;
        m.position.x = p.x + PW / 2;
        m.position.y = -(p.y + PH / 2);
        (m.material as MeshBasicMaterial).opacity = p.alpha;
      }
    },
    setWorld(prev, state, alpha, clock) {
      const dt = Math.max(0, Math.min(0.1, clock - lastClock));
      lastClock = clock;
      const animate = this.animate;
      // Scies : positions de la simulation, interpolées ; rotation au rythme du chrono de l'essai (immobiles tant que le monde attend).
      const a = sawCenters(level, prev);
      const b = sawCenters(level, state);
      const time = prev.time + (state.time - prev.time) * alpha;
      for (let k = 0; k < saws.length; k++) {
        const pa = a[k]!;
        const pb = b[k]!;
        // Pas d'interpolation à travers un saut de position (début de cycle d'une section, réapparition).
        const far = Math.abs(pb.x - pa.x) + Math.abs(pb.y - pa.y) > T;
        const x = (far ? pb.x : pa.x + (pb.x - pa.x) * alpha) / T;
        const y = -(far ? pb.y : pa.y + (pb.y - pa.y) * alpha) / T;
        saws[k]!.g.position.x = x;
        saws[k]!.g.position.y = y;
        saws[k]!.disc.rotation.z = -time * 0.12;
        if (hitSaws[k]) hitSaws[k]!.position.set(x, y, 0.5);
      }
      // Blocs friables : tremblement pendant la minuterie, disparus une fois tombés.
      for (let k = 0; k < crumbles.length; k++) {
        const g = crumbles[k]!;
        const v = state.crumbles[k]!;
        const home = g.userData.home as { x: number; y: number };
        g.visible = v !== CRUMBLE_GONE;
        if (v > 0) {
          const amp = 0.04 + 0.05 * (1 - Math.min(1, v / 30));
          g.position.x = home.x + Math.sin(clock * 90 + k) * amp;
          g.position.y = home.y + Math.cos(clock * 77 + k * 2) * amp * 0.6;
        } else {
          g.position.x = home.x;
          g.position.y = home.y;
        }
      }
      // Ressorts : compression brève puis détente au déclenchement ; lot 8 : la détente dépasse et rebondit (oscillation amortie).
      for (const [cell, s] of springs) {
        let press = 0;
        if (cell === state.springCell && state.status !== ATTEMPT_DEAD) {
          const ago = time - state.springTime;
          if (animate) {
            if (ago >= 0 && ago < 4) press = ago / 4;
            else if (ago >= 4 && ago < 60) press = Math.exp(-(ago - 4) / 12) * Math.cos((ago - 4) * 0.3);
          } else if (ago >= 0 && ago < 18) press = ago < 4 ? ago / 4 : 1 - (ago - 4) / 14;
        }
        s.pad.position.y = 0.92 - 0.38 * press;
        s.coil.scale.y = 1 - 0.55 * press;
      }
      // Points de passage : le point de reprise est coloré ; les fanions des points franchis sont levés (lot 8).
      if (state.checkpoint !== shownCheckpoint) {
        shownCheckpoint = state.checkpoint;
        checkpoints.forEach((m, k) => (m.material = k === state.checkpoint ? cpOn : cpIdle));
        doors.forEach((m, k) => (m.material = k === state.checkpoint ? doorOn : doorIdle));
      }
      for (let k = 0; k < checkpoints.length; k++) {
        const target = k <= state.checkpoint ? 1 : 0;
        const v = flagLift[k]!;
        // Levé en ≈ 0,35 s (un peu d'élan au départ), descendu tout de suite (recommencer).
        flagLift[k] = !animate || target === 0 ? target : Math.min(1, v + dt * (1.2 + 6 * v));
        checkpoints[k]!.position.y = FLAG_LOW + (FLAG_HIGH - FLAG_LOW) * flagLift[k]!;
      }
      // Arrivée : elle pulse doucement.
      const pulse = 0.5 + 0.5 * Math.sin(clock * 4);
      (glow.material as MeshBasicMaterial).opacity = 0.15 + 0.25 * pulse;
      flag.scale.y = 0.92 + 0.08 * pulse;
      burst?.sync();
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
