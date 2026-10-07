import { PerspectiveCamera, Vector3, WebGLRenderer } from "three";
import { HALF_ROAD, WALL_HEIGHT, trackCenterline, type PaletteName, type ThemeName, type Track } from "@cdj/sim";
import { PALETTE_DEFS, SURFACE_COLORS, buildTrackScene } from "./trackMesh";
import { pickFocus, type Focus } from "./thumbFocus";

// Miniatures de circuits (lot 13) : une vue aérienne d'une portion marquante. Présentation seule : on lit un `Track` déjà
// construit, jamais rien n'est écrit dans `sim`. Un seul moteur de rendu, créé à la demande et partagé hors écran.

export const THUMB_W = 320;
export const THUMB_H = 180;

/** Ce qu'il faut pour dessiner un circuit : sa piste, sa palette et son thème (pour choisir la portion à montrer). */
export interface ThumbnailCircuit {
  track: Track;
  palette: PaletteName;
  theme: ThemeName;
}

export interface ThumbnailOptions {
  /** Taille logique (défaut 320 × 180, format 16:9). */
  width?: number;
  height?: number;
  /** Facteur de densité de pixels (1, ou 2 sur écran haute densité) : l'image fait `width × scale` pixels. */
  scale?: number;
  /** Vue : `tilted` (aérienne, un peu inclinée : on lit les reliefs et le décor) ou `top` (d'aplomb). */
  view?: "tilted" | "top";
  /** Faux : dessin 2D sans WebGL (repli ; aussi pour les appareils sans accélération). */
  webgl?: boolean;
  /** Portion imposée (sinon `pickFocus`). */
  focus?: Focus;
  /** Rempli par le rendu 3D : durée de construction de la scène et du dessin (ms), pour les mesures. */
  timing?: { build: number; draw: number };
}

/** Inclinaison de la caméra au-dessus de l'horizontale (degrés) : 90 = d'aplomb. */
export const TILT_DEG = 58;
const FOV = 32;
/** Part de l'image que la portion peut occuper : le reste est de la marge. */
const FILL = 0.92;

// --- Moteur de rendu partagé -------------------------------------------------------------------------

let shared: WebGLRenderer | null | undefined; // undefined : pas encore créé ; null : impossible (pas de WebGL)

function sharedRenderer(): WebGLRenderer | null {
  if (shared !== undefined) return shared;
  try {
    const canvas = document.createElement("canvas");
    const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "low-power" });
    renderer.setPixelRatio(1);
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      if (shared === renderer) shared = undefined; // recréé à la prochaine demande
    });
    shared = renderer;
  } catch {
    shared = null;
  }
  return shared;
}

/** Rend la mémoire graphique des miniatures (le moteur est recréé à la demande). */
export function releaseThumbnailRenderer() {
  if (!shared) return;
  shared.dispose();
  shared.forceContextLoss();
  shared = undefined;
}

export const thumbnailRendererActive = () => !!shared;

// --- Caméra ------------------------------------------------------------------------------------------

const v = new Vector3();

/**
 * Cadre la portion : la caméra regarde le centre du tracé depuis le côté « bas » de l'écran (l'axe principal de la portion est
 * l'horizontale), à l'inclinaison demandée ; on recule jusqu'à ce que tous les points tiennent dans `FILL` de l'image, puis on
 * recentre l'image sur ce que les points occupent vraiment.
 */
export function frameCamera(focus: Focus, aspect: number, view: "tilted" | "top" = "tilted"): PerspectiveCamera {
  const camera = new PerspectiveCamera(FOV, aspect, 1, 4000);
  const tilt = view === "top" ? 90 : TILT_DEG;
  // sin et cos de l'inclinaison : le rendu n'est pas de la simulation, on peut utiliser Math.
  const s = Math.sin((tilt * Math.PI) / 180);
  const c = Math.cos((tilt * Math.PI) / 180);
  const [rx, rz] = focus.right;
  // « Vers le fond de l'écran » dans le plan : perpendiculaire à la droite, de sorte que (droite, haut, regard) soit direct.
  const fx = rz;
  const fz = -rx;
  const dir = new Vector3(fx * c, -s, fz * c); // direction du regard
  camera.up.set(view === "top" ? fx : 0, view === "top" ? 0 : 1, view === "top" ? fz : 0);
  const target = new Vector3(focus.center[0], focus.points.reduce((a, p) => a + p[1], 0) / focus.points.length, focus.center[1]);

  const place = (dist: number) => {
    camera.position.copy(target).addScaledVector(dir, -dist);
    camera.lookAt(target);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
  };
  const extent = () => {
    let max = 0;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const p of focus.points) {
      v.set(p[0], p[1], p[2]).project(camera);
      max = Math.max(max, Math.abs(v.x), Math.abs(v.y));
      x0 = Math.min(x0, v.x);
      x1 = Math.max(x1, v.x);
      y0 = Math.min(y0, v.y);
      y1 = Math.max(y1, v.y);
    }
    return { max, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  };
  // Recule jusqu'à ce que tout tienne : bissection sur la distance (l'étendue grandit quand on avance).
  const fit = () => {
    let lo = 20;
    let hi = 3000;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      place(mid);
      if (extent().max > FILL) lo = mid;
      else hi = mid;
    }
    place(hi);
    return hi;
  };
  // Puis recentre l'image sur ce que les points occupent vraiment (déplacement de la cible dans le plan de l'image), et recommence.
  for (let pass = 0; pass < 3; pass++) {
    const dist = fit();
    const e = extent();
    const halfH = Math.tan((FOV * Math.PI) / 360) * dist;
    const right = new Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    target.addScaledVector(right, e.cx * halfH * aspect).addScaledVector(up, e.cy * halfH);
  }
  fit();
  return camera;
}

// --- Rendu 3D ----------------------------------------------------------------------------------------

function render3d(circuit: ThumbnailCircuit, focus: Focus, out: HTMLCanvasElement, view: "tilted" | "top", timing?: { build: number; draw: number }): boolean {
  const renderer = sharedRenderer();
  if (!renderer) return false;
  const t0 = performance.now();
  const { scene, dispose } = buildTrackScene(circuit.track, circuit.palette, { aerial: true, near: { from: focus.from, to: focus.to } });
  const t1 = performance.now();
  try {
    renderer.setSize(out.width, out.height, false);
    const camera = frameCamera(focus, out.width / out.height, view);
    renderer.render(scene, camera);
    const ctx = out.getContext("2d")!;
    // Copie immédiate : le tampon de dessin n'est valable que jusqu'à la fin de la tâche en cours.
    ctx.drawImage(renderer.domElement, 0, 0, out.width, out.height);
    return !renderer.getContext().isContextLost();
  } finally {
    dispose();
    if (timing) {
      timing.build = t1 - t0;
      timing.draw = performance.now() - t1;
    }
  }
}

// --- Repli 2D ----------------------------------------------------------------------------------------

const css = (hex: number) => `#${hex.toString(16).padStart(6, "0")}`;

/** Tracé 2D du circuit vu de dessus, aux couleurs du thème, dans le même cadrage que la vue 3D (même portion, même orientation). */
function render2d(circuit: ThumbnailCircuit, focus: Focus, out: HTMLCanvasElement) {
  const ctx = out.getContext("2d")!;
  const pal = PALETTE_DEFS[circuit.palette];
  const W = out.width;
  const H = out.height;
  ctx.fillStyle = pal.floorA;
  ctx.fillRect(0, 0, W, H);

  // Plan → image : l'axe principal à l'horizontale, le « fond » en haut ; échelle commune pour que tout tienne.
  const [rx, rz] = focus.right;
  const fx = rz;
  const fz = -rx;
  const proj = (x: number, z: number): [number, number] => [(x - focus.center[0]) * rx + (z - focus.center[1]) * rz, -((x - focus.center[0]) * fx + (z - focus.center[1]) * fz)];
  let ext = 1;
  let ey = 1;
  for (const p of focus.points) {
    const [a, b] = proj(p[0], p[2]);
    ext = Math.max(ext, Math.abs(a));
    ey = Math.max(ey, Math.abs(b));
  }
  // Mêmes bornes que la caméra : écart centré, 92 % de l'image.
  const k = Math.min((W / 2) * 0.92 / ext, (H / 2) * 0.92 / ey);
  const sx = (x: number, z: number): [number, number] => {
    const [a, b] = proj(x, z);
    return [W / 2 + a * k, H / 2 + b * k];
  };

  const line = trackCenterline(circuit.track);
  const roadPx = HALF_ROAD * 2 * k;
  const stroke = (from: number, to: number, color: string, width: number) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "butt";
    ctx.lineJoin = "round";
    ctx.beginPath();
    let open = false;
    for (let i = from; i <= to; i++) {
      const [x, y] = sx(line.x[i]!, line.z[i]!);
      if (open) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
      open = true;
    }
    ctx.stroke();
  };
  // Un tracé par bloc (couleur du revêtement) : d'abord les rebords, puis la route.
  const ranges: { b: number; from: number; to: number }[] = [];
  for (let i = 0; i < line.block.length; i++) {
    const last = ranges[ranges.length - 1];
    if (last && last.b === line.block[i]) last.to = i;
    else ranges.push({ b: line.block[i]!, from: i, to: i });
  }
  const wallPx = roadPx + Math.max(2, WALL_HEIGHT * k * 1.6);
  for (const r of ranges) stroke(r.from, r.to, css(pal.wallA), wallPx);
  for (const r of ranges) {
    const b = circuit.track.blocks[r.b]!;
    stroke(r.from, r.to, css(b.surface === "road" ? pal.road[b.index % 2]! : SURFACE_COLORS[b.surface][b.index % 2]!), roadPx * 0.98);
  }
  // Blocs à effet et portes : une barre en travers de la route, au milieu du bloc.
  const bar = (i: number, color: string, half: number, width: number) => {
    const j = Math.min(line.x.length - 1, i + 1);
    const i0 = j === i ? i - 1 : i;
    let nx = line.z[j]! - line.z[i0]!;
    let nz = -(line.x[j]! - line.x[i0]!);
    const n = Math.sqrt(nx * nx + nz * nz) || 1;
    nx /= n;
    nz /= n;
    const [a, b] = sx(line.x[i]! - nx * half, line.z[i]! - nz * half);
    const [c, d] = sx(line.x[i]! + nx * half, line.z[i]! + nz * half);
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(2, width * k);
    ctx.beginPath();
    ctx.moveTo(a, b);
    ctx.lineTo(c, d);
    ctx.stroke();
  };
  for (const r of ranges) {
    const b = circuit.track.blocks[r.b]!;
    const mid = Math.floor((r.from + r.to) / 2);
    if (b.kind === "boost") bar(mid, css(pal.boost), HALF_ROAD * 0.5, 6);
    else if (b.kind === "turbo") bar(mid, "#ff3b30", HALF_ROAD * 0.5, 6);
    else if (b.kind === "cut") bar(mid, "#2b1b45", HALF_ROAD * 0.5, 6);
    else if (b.kind === "jump") bar(mid, "#ffd22e", HALF_ROAD * 0.9, 3);
    if (b.mark === "checkpoint") bar(mid, css(pal.checkpoint), HALF_ROAD, 1.6);
    if (b.mark === "finish") bar(mid, css(pal.finish), HALF_ROAD, 2.4);
  }
}

// --- API ---------------------------------------------------------------------------------------------

/**
 * Dessine la miniature d'un circuit : une vue aérienne (un peu inclinée) de sa portion la plus parlante — le passage signature
 * du thème, sinon la zone la plus sinueuse —, avec la palette, les revêtements, les blocs à effet et le décor du thème.
 * Rend un canvas neuf de `width × scale` sur `height × scale` pixels. Sans WebGL (ou avec `webgl: false`) : tracé 2D.
 * Appelée par le service de miniatures (jamais pendant une course) et, plus tard, par le panneau d'admin.
 */
export function renderThumbnail(circuit: ThumbnailCircuit, options: ThumbnailOptions = {}): HTMLCanvasElement {
  const scale = options.scale ?? 1;
  const out = document.createElement("canvas");
  out.width = Math.round((options.width ?? THUMB_W) * scale);
  out.height = Math.round((options.height ?? THUMB_H) * scale);
  const focus = options.focus ?? pickFocus(circuit.track, circuit.theme);
  const drawn = options.webgl !== false && render3d(circuit, focus, out, options.view ?? "tilted", options.timing);
  if (!drawn) render2d(circuit, focus, out);
  return out;
}
