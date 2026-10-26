import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
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
  TILE_SPRING,
  UNITS_PER_TILE,
  cellOrigin,
  isSolidTile,
  isSpikeTile,
  sawCenters,
  spikeBox,
  type AttemptState,
  type Level,
} from "@cdj/jump-sim";
import { viewHeightTiles, VIEW_TILES_DESKTOP, type Frame } from "./camera";
import { SOLID_STENCIL } from "./actors";
import { BurstMesh, type BurstPool } from "./fx";
import { STEP, squashScale, type Look } from "./look";
import { mixColor } from "./feel";
import type { Art } from "./artKit";
import { buildDecorArt, keepouts, placeDecor, type DecorChunk } from "./decor";
import { buildParallax, layerOffset, visibleLayers } from "./parallax";
import { CHUNK_COLUMNS, buildTileArt } from "./tileArt";
import { BELT_FRAGMENT, BELT_VERTEX, beltRuns, beltTime, buildBeltArt, iceRuns } from "./surfaceArt";
import { HAZARD_OUTLINE, backdropColors, type Theme } from "./themes";
import { createDynamicBlocks, type DynamicStats } from "./dynamicArt";
import { createWindArt, type WindStats } from "./windArt";
import { createSawArt } from "./sawArt";
import { createPlatformArt, type PlatformStats } from "./platformArt";
import { SLOW_DEBUG, SLOW_MARK, slowMarkQuads, type SlowDebugPath } from "./slowRoute";

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
  /** Lot 9 : identifiant du niveau (graine du décor et de la parallaxe, avec le thème). */
  levelId?: string;
  /** Lot 9 : allègements du décor et de la parallaxe (réglages du joueur). */
  detail?: SceneDetail;
  /** Lot 16 : les voies lentes du niveau du jour : leur repère d'entrée est toujours dessiné. */
  slowRoutes?: readonly { zone: number; entryRow: number }[];
  /** Lot 16, `?debug` : les deux trajets de chaque portion dure et leurs temps. */
  slowDebug?: readonly SlowDebugPath[];
}

/** Lot 9 : ce que les réglages demandent au décor et au fond (affichage seulement). */
export interface SceneDetail {
  decorLite: boolean;
  parallaxLite: boolean;
  /** 1 : la parallaxe défile ; 0 : figée à l'écran (mouvement réduit). */
  parallaxMotion: number;
}

/** Lot 9 : ce que la scène a construit (mesures, `__jump.theme`). */
export interface SceneStats {
  tileChunks: number;
  tileTriangles: number;
  /** Lot 11 : tuiles de tapis roulant et triangles de leurs chevrons (un tampon par tronçon, un matériau). */
  beltTiles: number;
  beltTriangles: number;
  /** Lot 11 : la phase de défilement des chevrons (0 : figés : mouvement réduit, effets « aucun », ou pas encore d'image). */
  beltPhase: number;
  decorItems: number;
  decorLite: number;
  decorTriangles: number;
  layers: number;
  layersShown: number;
  parallaxTriangles: number;
  buildMs: number;
  /** Lot 17 : l'estompage des dangers qui suivent l'horloge à la dernière image (1 : aucun) et l'opacité dessinée de chaque scie (1 : fixe ou normale). */
  clockFade: number;
  sawOpacity: readonly number[];
}

/** Une `BufferGeometry` d'un tampon pur (positions, couleurs par sommet, indices). */
function artGeometry(art: Art): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(art.pos, 3));
  g.setAttribute("color", new Float32BufferAttribute(art.col, 3));
  g.setIndex(art.idx);
  g.computeBoundingSphere();
  return g;
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
  /** Lot 12 : un éclat bref sur les blocs alternés (bascule, remise à A) : 1 = plein, il s'éteint tout seul ; sans effet sans mouvement. */
  flashBlocks(amount: number): void;
  /** Lot 12 : état des blocs clignotants et alternés à la dernière image (null : le niveau n'en a pas). */
  readonly blocks: DynamicStats | null;
  /** Lot 20 : les plateformes mobiles à la dernière image (position dessinée, vitesse et sens du chevron, opacité) ; null : le niveau n'en a pas. */
  readonly platforms: PlatformStats | null;
  /**
   * Lot 17 : l'opacité des éléments qui suivent l'horloge (scies mobiles, blocs clignotants, rafales), 1 = normal. Le carnage la baisse : on lit
   * les morts avant les dangers, dont la phase est celle du héros seul. Les dangers fixes (pics, scies fixes) et le décor ne changent jamais.
   */
  clockFade: number;
  /** Lot 13 : part des particules du vent (réglages : 0 = flèches fixes à la place), et l'état du vent à la dernière image (null : aucune zone). */
  windParticles: number;
  readonly wind: WindStats | null;
  /** Lot 8 : animations douces (fanion qui se lève, ressort qui rebondit) ; faux : posées tout de suite (mouvement réduit, effets aucun). */
  animate: boolean;
  /** Lot 9 : le thème dessiné, ses couleurs de fond (ciel et plans : la sonde des pixels les compte comme du fond), ce qui est construit. */
  readonly theme: Theme;
  readonly backdrop: readonly number[];
  readonly stats: SceneStats;
  /** Lot 9 : allègements du décor et de la parallaxe (réglages), tout de suite. */
  setDetail(d: SceneDetail): void;
  render(): void;
  dispose(): void;
}

const T = UNITS_PER_TILE;
const PW = PLAYER_WIDTH / T;
const PH = PLAYER_HEIGHT / T;

/** Pics : un triangle franc par tuile, pointe selon l'orientation (coordonnées du monde, y vers le haut). */
function spikeTriangles(level: Level, grow = 0): BufferGeometry {
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
      if (grow > 0) {
        // Cerne : le triangle agrandi autour de son centre de gravité.
        const k = pos.length - 9;
        const cx = (pos[k]! + pos[k + 3]! + pos[k + 6]!) / 3;
        const cy = (pos[k + 1]! + pos[k + 4]! + pos[k + 7]!) / 3;
        for (let v = 0; v < 3; v++) {
          const dx = pos[k + v * 3]! - cx;
          const dy = pos[k + v * 3 + 1]! - cy;
          const len = Math.hypot(dx, dy) || 1;
          pos[k + v * 3] = cx + dx * (1 + (grow * 2) / len);
          pos[k + v * 3 + 1] = cy + dy * (1 + (grow * 2) / len);
        }
      }
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

export function createScene(canvasParent: HTMLElement, level: Level, theme: Theme, options: SceneOptions = {}): JumpScene {
  const t0 = performance.now();
  const palette = theme.palette;
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

  // ——— Lot 9 : blocs pleins auto-tuilés (`tileArt.ts`), fusionnés par tronçons de colonnes (un appel de dessin chacun, écarté hors champ).
  // Ils écrivent le pochoir (lot 3) : les taches de peinture ne se dessinent que sur eux (`actors.ts`), coins arrondis compris.
  const list = keepouts(level);
  // Double face : les tampons purs ne garantissent pas le sens des triangles (un contour de tuile tourne dans le sens horaire).
  const tileMat = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  tileMat.stencilWrite = true;
  tileMat.stencilRef = SOLID_STENCIL;
  tileMat.stencilFunc = AlwaysStencilFunc;
  tileMat.stencilZPass = ReplaceStencilOp;
  const tileArt = buildTileArt(level, theme.tiles, list);
  let tileTriangles = 0;
  for (const c of tileArt.chunks) {
    if (c.art.triangles === 0) continue;
    tileTriangles += c.art.triangles;
    world.add(new Mesh(artGeometry(c.art), tileMat));
  }

  // ——— Lot 11 : les chevrons des tapis roulants, un tampon par tronçon et **un seul matériau** : le défilement est un décalage de phase dans le
  // shader (`uTime`, mis à jour par `setWorld`), jamais un objet créé en jeu. Figés (temps 0) avec le mouvement réduit et les effets « aucun ».
  const beltArt = buildBeltArt(level, CHUNK_COLUMNS);
  const beltMat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new Color(theme.tiles.belt.chevron) } },
    vertexShader: BELT_VERTEX,
    fragmentShader: BELT_FRAGMENT,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });
  let beltTriangles = 0;
  for (const c of beltArt.chunks) {
    if (c.triangles === 0) continue;
    beltTriangles += c.triangles;
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(c.pos, 3));
    g.setAttribute("aDir", new Float32BufferAttribute(c.dir, 1));
    g.setAttribute("aBand", new Float32BufferAttribute(c.band, 1));
    g.setIndex(c.idx);
    g.computeBoundingSphere();
    const mesh = new Mesh(g, beltMat);
    mesh.renderOrder = 1;
    world.add(mesh);
  }

  // ——— Lot 9 : décor (sans collision), derrière tout ce qui compte ; les `lite` d'abord, seuls dessinés avec les effets réduits ———
  const levelId = options.levelId ?? "niveau";
  const decorItems = placeDecor(level, theme, levelId, list);
  const decorMat = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const decorMeshes: { mesh: Mesh; chunk: DecorChunk }[] = [];
  let decorTriangles = 0;
  for (const chunk of buildDecorArt(theme, decorItems, W, CHUNK_COLUMNS)) {
    if (chunk.art.triangles === 0) continue;
    decorTriangles += chunk.art.triangles;
    const mesh = new Mesh(artGeometry(chunk.art), decorMat);
    world.add(mesh);
    decorMeshes.push({ mesh, chunk });
  }

  // ——— Lot 9 : fond en parallaxe, deux ou trois plans (hors du monde : leur position suit la caméra, `setView`) ———
  const layerMat = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  let parallaxTriangles = 0;
  const layers = buildParallax(theme, W, levelId).map((l) => {
    parallaxTriangles += l.art.triangles;
    const mesh = new Mesh(artGeometry(l.art), layerMat);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { layer: l.layer, mesh };
  });
  let detail: SceneDetail = options.detail ?? { decorLite: false, parallaxLite: false, parallaxMotion: 1 };
  const applyDetail = () => {
    for (const d of decorMeshes) d.mesh.geometry.setDrawRange(0, detail.decorLite ? d.chunk.liteIndices : Infinity);
    const shown = visibleLayers(layers.length, detail.parallaxLite);
    layers.forEach((l, i) => (l.mesh.visible = i < shown));
  };
  applyDetail();

  // ——— Pics : triangles francs ———
  const spikes = new Mesh(spikeTriangles(level), new MeshBasicMaterial({ color: palette.hazard }));
  spikes.position.z = 0.05;
  world.add(spikes);
  // Lot 9 : un cerne sombre autour de chaque pic (le même dans tous les thèmes) : il le détache d'un contour clair, d'un friable, du décor.
  const spikeRim = new Mesh(spikeTriangles(level, 0.09), new MeshBasicMaterial({ color: HAZARD_OUTLINE }));
  spikeRim.position.z = 0.045;
  world.add(spikeRim);

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

  // ——— Lot 12 : blocs clignotants (nuit) et alternés (néon), dessinés d'après l'état de l'essai (`dynamicArt.ts`) ———
  const dynamic = createDynamicBlocks(world, level, !!options.hitbox);
  // ——— Lot 13 : courants d'air (forêt) : contour discret, feuilles et pollen, ou flèches fixes (`windArt.ts`) ———
  const windArt = createWindArt(world, level, !!options.hitbox);

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

  // ——— Scies : disques dentés qui tournent (affichage), trajets des scies mobiles en pointillés discrets (`sawArt.ts`) ———
  const sawArt = createSawArt(world, level, { body: palette.hazard, outline: HAZARD_OUTLINE });
  const saws = sawArt.saws;
  // ——— Lot 20 : plateformes mobiles (dalle crème, chevrons qui s'effacent avec la vitesse, trajet en pointillés neutres) ———
  const platformArt = createPlatformArt(world, level);

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
  const solidAt = (col: number, row: number) => row >= 0 && row < level.height && isSolidTile(level.tiles[row * level.width + col]!);
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

  // ——— Personnage : un carré et deux yeux ; lot 8b : deux pieds sous le corps (corps + pieds remplissent exactement la boîte au repos) ———
  // `player` : bas-milieu de la boîte ; `feet` : l'écrasement (ancré en bas) ; `torso` : corps et yeux (rebond, penché, respiration).
  const player = new Group();
  const feet = new Group();
  const torso = new Group();
  const bodyH = PH - STEP.leg;
  const body = new Mesh(new PlaneGeometry(PW, bodyH), new MeshBasicMaterial({ color: palette.player }));
  body.position.set(0, bodyH / 2, 0);
  torso.add(body);
  torso.position.y = STEP.leg;
  const eyes = new Group();
  eyes.position.set(0, PH * 0.62 - STEP.leg, 0.05);
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
  torso.add(eyes);
  feet.add(torso);
  const footMat = new MeshBasicMaterial({ color: mixColor(palette.player, 0x000000, 0.45) });
  const footGeo = new PlaneGeometry(STEP.footW, STEP.footH);
  const footMeshes = [new Mesh(footGeo, footMat), new Mesh(footGeo, footMat)];
  for (const f of footMeshes) {
    f.position.z = 0.02; // devant le corps : un pied replié se voit
    feet.add(f);
  }
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
    // Lot 11 : les surfaces en surimpression — tapis roulants (cadre de la face du dessus et un chevron par tuile, dans le sens du tapis) et
    // glace (liseré le long de la face du dessus et un losange par tuile). Cyan et bleu pâle : jamais le vert des boîtes ni le rouge des dangers.
    const beltSeg: number[] = [];
    for (const r of beltRuns(level)) {
      const x0 = r.col0;
      const x1 = r.col1 + 1;
      const y = -r.row;
      beltSeg.push(x0, y, 0, x1, y, 0, x1, y, 0, x1, y - 0.2, 0, x1, y - 0.2, 0, x0, y - 0.2, 0, x0, y - 0.2, 0, x0, y, 0);
      for (let c = r.col0; c <= r.col1; c++) beltSeg.push(c + 0.5 - r.dir * 0.12, y - 0.19, 0, c + 0.5 + r.dir * 0.12, y - 0.1, 0, c + 0.5 + r.dir * 0.12, y - 0.1, 0, c + 0.5 - r.dir * 0.12, y - 0.01, 0);
    }
    const iceSeg: number[] = [];
    for (const r of iceRuns(level)) {
      const y = -r.row;
      iceSeg.push(r.col0, y, 0, r.col1 + 1, y, 0, r.col0, y - 0.06, 0, r.col1 + 1, y - 0.06, 0);
      for (let c = r.col0; c <= r.col1; c++) iceSeg.push(c + 0.5, y - 0.02, 0, c + 0.6, y - 0.12, 0, c + 0.6, y - 0.12, 0, c + 0.5, y - 0.22, 0, c + 0.5, y - 0.22, 0, c + 0.4, y - 0.12, 0, c + 0.4, y - 0.12, 0, c + 0.5, y - 0.02, 0);
    }
    for (const [seg, color] of [[beltSeg, 0x00e5ff], [iceSeg, 0xb0f0ff]] as const) {
      if (seg.length === 0) continue;
      const sg = new BufferGeometry();
      sg.setAttribute("position", new Float32BufferAttribute(seg, 3));
      const lines = new LineSegments(sg, new LineBasicMaterial({ color }));
      lines.position.z = 0.5;
      world.add(lines);
    }
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

  // ——— Lot 16 : le repère d'entrée de chaque voie lente (cadre et chevrons crème cernés d'encre, jamais rouge, sans texte) ———
  if (options.slowRoutes && options.slowRoutes.length > 0) {
    const face = new MeshBasicMaterial({ color: SLOW_MARK.face });
    const edge = new MeshBasicMaterial({ color: SLOW_MARK.edge });
    for (const r of options.slowRoutes) {
      const g = new Group();
      for (const q of slowMarkQuads(r)) {
        const back = new Mesh(new PlaneGeometry(q.w + 0.08, q.h + 0.08), edge);
        back.position.set(q.x, -q.y, 0.07);
        back.rotation.z = q.angle;
        const front = new Mesh(new PlaneGeometry(q.w, q.h), face);
        front.position.set(q.x, -q.y, 0.08);
        front.rotation.z = q.angle;
        g.add(back, front);
      }
      world.add(g);
    }
  }
  // ——— Lot 16, ?debug : les deux trajets de chaque portion dure (rapide en cyan, lent en crème) et leurs temps ———
  if (options.slowDebug) {
    for (const d of options.slowDebug) {
      for (const [points, color] of [
        [d.fast, SLOW_DEBUG.fast],
        [d.slow, SLOW_DEBUG.slow],
      ] as const) {
        if (points.length < 2) continue;
        const line = new Line(new BufferGeometry().setFromPoints(points.map((p) => new Vector3(p.x, -p.y, 0.58))), new LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
        world.add(line);
      }
      const label = textSprite(d.label, 0.7);
      label.position.set(d.at.x + label.scale.x / 2, -d.at.y, 0.6);
      world.add(label);
    }
  }

  const frame: Frame = { width: level.width, height: level.height, halfW: 1, halfH: VIEW_TILES_DESKTOP / 2 };
  let viewX = 0;
  let viewY = 0;

  const mid = -level.height / 2;
  const place = () => {
    for (const l of layers) {
      const o = layerOffset(l.layer, viewX, viewY, mid, detail.parallaxMotion);
      l.mesh.position.set(o.x, o.y, 0);
    }
    camera.left = viewX - frame.halfW;
    camera.right = viewX + frame.halfW;
    camera.top = viewY + frame.halfH;
    camera.bottom = viewY - frame.halfH;
    camera.updateProjectionMatrix();
  };

  const stats: SceneStats = {
    tileChunks: tileArt.chunks.length,
    tileTriangles,
    beltTiles: beltArt.tiles,
    beltTriangles,
    beltPhase: 0,
    decorItems: decorItems.length,
    decorLite: decorItems.filter((d) => d.lite).length,
    decorTriangles,
    layers: layers.length,
    layersShown: visibleLayers(layers.length, detail.parallaxLite),
    parallaxTriangles,
    buildMs: performance.now() - t0,
    clockFade: 1,
    sawOpacity: sawArt.opacity,
  };

  return {
    renderer,
    world,
    zoom: 1,
    clockFade: 1,
    animate: true,
    frame,
    theme,
    flashBlocks(amount) {
      dynamic?.flash(amount);
    },
    get blocks() {
      return dynamic ? dynamic.stats : null;
    },
    get platforms() {
      return platformArt ? platformArt.stats : null;
    },
    windParticles: 1,
    get wind() {
      return windArt ? windArt.stats : null;
    },
    backdrop: backdropColors(theme),
    stats,
    setDetail(d) {
      detail = { ...d };
      applyDetail();
      stats.layersShown = visibleLayers(layers.length, detail.parallaxLite);
      place();
    },
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
      const look = pose.look;
      const { sx, sy } = squashScale(look.squash, pose.squashAmount ?? 1);
      feet.scale.set(sx, sy, 1);
      // Lot 8b : rebond, penché (autour du bas du corps) et respiration ; les pieds, eux, restent où l'animation les pose.
      torso.position.y = STEP.leg + look.bob;
      torso.rotation.z = -look.lean;
      torso.scale.y = look.breath;
      for (let i = 0; i < 2; i++) footMeshes[i]!.position.set(look.feet[i * 2]!, look.feet[i * 2 + 1]! + STEP.footH / 2, 0.02);
      eyes.scale.y = 1 - 0.88 * (pose.blink ?? 0);
      const lookX = look.eyeX;
      eyes.position.x = lookX * 0.07;
      for (const p of pupils) {
        p.position.x = (p.userData.baseX as number) + lookX * 0.045;
        p.position.y = look.eyeY * 0.055;
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
      // Lot 11 : phase des chevrons des tapis (figée sans mouvement).
      const phase = beltTime(clock, animate);
      beltMat.uniforms.uTime!.value = phase;
      stats.beltPhase = phase;
      // Scies : positions de la simulation, interpolées ; rotation au rythme du chrono de l'essai (immobiles tant que le monde attend).
      const fade = this.clockFade;
      sawArt.setFade(fade);
      stats.clockFade = fade;
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
      // Lot 20 : plateformes mobiles (estompées dans le carnage, comme les scies mobiles).
      platformArt?.update(prev, state, alpha, fade);
      // Lot 12 : blocs clignotants et alternés.
      dynamic?.update(state, clock, animate, { x: viewX, y: viewY, halfW: frame.halfW, halfH: frame.halfH }, fade);
      // Lot 13 : le vent (particules si les réglages en gardent et que le mouvement n'est pas réduit, sinon flèches fixes).
      windArt?.update(state, clock, this.windParticles, animate, renderer.domElement.height / Math.max(1, 2 * frame.halfH), fade);
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
