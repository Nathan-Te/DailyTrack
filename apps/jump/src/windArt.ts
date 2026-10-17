import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  Points,
  ShaderMaterial,
} from "three";
import type { AttemptState, Level } from "@cdj/jump-sim";
import {
  WIND_EDGE_OPACITY,
  WIND_STYLE,
  arrowLayout,
  arrowOpacity,
  flowStep,
  particleBudget,
  windLooks,
  windParticle,
  windVector,
  type WindLook,
  type WindParticle,
} from "./wind";

// Le dessin des courants d'air (forêt, lot 13) — **affichage seul** : il ne lit que l'état de l'essai (`windLooks`).
//   - un **contour** très discret (pointillés pâles) dessine chaque zone ;
//   - avec les effets : des **feuilles et du pollen** circulent dans le sens du vent (un seul `Points`, tampons préalloués, au plus
//     `WIND_PARTICLES_MAX` ; leur position est une fonction pure du temps : rien n'est créé en jeu) ; ils s'agitent pendant les 0,25 s qui
//     précèdent une rafale ;
//   - **sans particules** (mouvement réduit, effets « aucun », `?fx=off`) : des **flèches fixes** dans le sens du vent, allumées quand la zone
//     souffle, qui s'éclaircissent pendant l'annonce (sans clignoter) : une information, jamais coupée ;
//   - `?debug&hitbox` : le rectangle de chaque zone (plein quand elle souffle, sombre sinon) et une flèche dans son sens.

const LEAF_VERTEX = /* glsl */ `
attribute float aAlpha;
attribute float aSize;
attribute float aAngle;
attribute float aKind;
uniform float uPixels;
varying float vAlpha;
varying float vAngle;
varying float vKind;
varying vec3 vColor;
void main() {
  vAlpha = aAlpha;
  vAngle = aAngle;
  vKind = aKind;
  vColor = color;
  gl_PointSize = max(2.0, aSize * uPixels);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const LEAF_FRAGMENT = /* glsl */ `
varying float vAlpha;
varying float vAngle;
varying float vKind;
varying vec3 vColor;
void main() {
  vec2 p = gl_PointCoord - 0.5;
  float c = cos(vAngle);
  float s = sin(vAngle);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  // Feuille : une ellipse allongée ; pollen : un disque.
  float d = vKind > 1.5 ? length(p) * 2.0 : length(vec2(p.x * 2.0, p.y * 4.4));
  if (d > 1.0) discard;
  gl_FragColor = vec4(vColor, vAlpha * (1.0 - smoothstep(0.7, 1.0, d)));
  #include <colorspace_fragment>
}
`;

export interface WindStats {
  zones: number;
  /** « particules » ou « fleches » : ce qui montre le vent à la dernière image. */
  mode: "particules" | "fleches";
  /** Particules dessinées (opacité > 0), et la capacité du tampon. */
  particles: number;
  capacity: number;
  /** Flèches visibles, zones aux flèches allumées. */
  arrows: number;
  lit: number;
  /** Par zone : souffle-t-elle, part de l'annonce, opacité de ses flèches (−1 : pas de flèches dessinées). */
  blowing: boolean[];
  announce: number[];
  arrowOpacity: number[];
}

export interface WindArt {
  /**
   * Pose le vent d'après l'état. `particles` : part des particules gardées par les réglages (0 : flèches) ; `motion` : faux avec le mouvement
   * réduit (flèches) ; `pixelsPerTile` : taille d'une tuile à l'écran (pixels du tampon de dessin).
   */
  update(state: Readonly<AttemptState>, clock: number, particles: number, motion: boolean, pixelsPerTile: number): void;
  readonly stats: WindStats;
}

const leafColors = [WIND_STYLE.leaf, WIND_STYLE.leafDark, WIND_STYLE.pollen].map((c) => new Color(c));

/** Une flèche (chevron épais) centrée en (x, y), dans le sens (dx, dy) : quatre triangles. */
function pushArrow(pos: number[], x: number, y: number, dx: number, dy: number): void {
  // Repère de la flèche : u le long du vent, v en travers.
  const ux = dx;
  const uy = dy;
  const vx = -dy;
  const vy = dx;
  const at = (u: number, v: number) => [x + ux * u + vx * v, y + uy * u + vy * v, 0];
  const t = 0.13;
  const quad = (a: number[], b: number[], c: number[], d: number[]) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  // Deux branches : de (−0,25, ±0,35) à la pointe (0,25, 0).
  quad(at(-0.25, 0.35), at(-0.25 + t, 0.35), at(0.25 + t / 2, 0), at(0.25 - t / 2, 0));
  quad(at(-0.25, -0.35), at(-0.25 + t, -0.35), at(0.25 + t / 2, 0), at(0.25 - t / 2, 0));
}

/** Le vent d'un niveau ; null s'il n'a pas de zone (rien n'est construit). */
export function createWindArt(world: Group, level: Level, hitbox: boolean): WindArt | null {
  const zones = level.winds;
  if (zones.length === 0) return null;
  const group = new Group();
  group.position.z = 0.012; // devant le décor, derrière les dangers et le personnage
  world.add(group);

  // ——— Contour discret ———
  const edgePos: number[] = [];
  for (const z of zones) {
    const a = z.c0;
    const b = z.c1 + 1;
    const c = -z.r0;
    const d = -(z.r1 + 1);
    edgePos.push(a, c, 0, b, c, 0, b, c, 0, b, d, 0, b, d, 0, a, d, 0, a, d, 0, a, c, 0);
  }
  const edgeGeo = new BufferGeometry();
  edgeGeo.setAttribute("position", new Float32BufferAttribute(edgePos, 3));
  const edges = new LineSegments(edgeGeo, new LineDashedMaterial({ color: WIND_STYLE.edge, dashSize: 0.35, gapSize: 0.35, transparent: true, opacity: WIND_EDGE_OPACITY, depthWrite: false }));
  edges.computeLineDistances();
  group.add(edges);

  // ——— Feuilles et pollen : un `Points`, tampons préalloués (la plus grande quantité possible), réécrits à chaque image ———
  const budget = particleBudget(level, 1);
  const capacity = budget.reduce((s, n) => s + n, 0);
  const pPos = new Float32Array(capacity * 3);
  const pCol = new Float32Array(capacity * 3);
  const pAlpha = new Float32Array(capacity);
  const pSize = new Float32Array(capacity);
  const pAngle = new Float32Array(capacity);
  const pKind = new Float32Array(capacity);
  const leafGeo = new BufferGeometry();
  leafGeo.setAttribute("position", new BufferAttribute(pPos, 3));
  leafGeo.setAttribute("color", new BufferAttribute(pCol, 3));
  leafGeo.setAttribute("aAlpha", new BufferAttribute(pAlpha, 1));
  leafGeo.setAttribute("aSize", new BufferAttribute(pSize, 1));
  leafGeo.setAttribute("aAngle", new BufferAttribute(pAngle, 1));
  leafGeo.setAttribute("aKind", new BufferAttribute(pKind, 1));
  const leafMat = new ShaderMaterial({
    uniforms: { uPixels: { value: 40 } },
    vertexShader: LEAF_VERTEX,
    fragmentShader: LEAF_FRAGMENT,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: NormalBlending,
  });
  const leaves = new Points(leafGeo, leafMat);
  leaves.frustumCulled = false;
  group.add(leaves);

  // ——— Flèches fixes : un maillage par zone (son opacité dit si elle souffle) ———
  const arrows = zones.map((z) => {
    const pos: number[] = [];
    for (const a of arrowLayout(z)) pushArrow(pos, a.x, a.y, a.dx, a.dy);
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    const mat = new MeshBasicMaterial({ color: WIND_STYLE.arrow, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false });
    const mesh = new Mesh(g, mat);
    mesh.visible = false;
    mesh.position.z = 0.001;
    group.add(mesh);
    return { mesh, mat, count: arrowLayout(z).length };
  });

  // ——— ?debug&hitbox : le rectangle de chaque zone (vert menthe quand elle souffle, gris-bleu sinon) et une flèche de son sens ———
  const debug = hitbox
    ? zones.map((z) => {
        const a = z.c0;
        const b = z.c1 + 1;
        const c = -z.r0;
        const d = -(z.r1 + 1);
        const v = windVector(z);
        const cx = (a + b) / 2;
        const cy = (c + d) / 2;
        const L = 0.8;
        const seg = [a, c, 0, b, c, 0, b, c, 0, b, d, 0, b, d, 0, a, d, 0, a, d, 0, a, c, 0];
        const tx = cx + v.x * L;
        const ty = cy + v.y * L;
        seg.push(cx - v.x * L, cy - v.y * L, 0, tx, ty, 0);
        seg.push(tx, ty, 0, tx - v.x * 0.35 - v.y * 0.3, ty - v.y * 0.35 + v.x * 0.3, 0);
        seg.push(tx, ty, 0, tx - v.x * 0.35 + v.y * 0.3, ty - v.y * 0.35 - v.x * 0.3, 0);
        const g = new BufferGeometry();
        g.setAttribute("position", new Float32BufferAttribute(seg, 3));
        const mat = new LineBasicMaterial({ color: 0x7dffd4 });
        const lines = new LineSegments(g, mat);
        lines.position.z = 0.5;
        world.add(lines);
        return mat;
      })
    : null;

  const looks: WindLook[] = [];
  const travel = zones.map(() => 0);
  const p: WindParticle = { x: 0, y: 0, angle: 0, alpha: 0, size: 0, kind: 0 };
  let lastClock = 0;
  const stats: WindStats = { zones: zones.length, mode: "particules", particles: 0, capacity, arrows: 0, lit: 0, blowing: [], announce: [], arrowOpacity: [] };
  // Couleurs des particules : fixées une fois (la sorte de chaque particule ne change pas).
  {
    let k = 0;
    for (let i = 0; i < zones.length; i++) {
      for (let j = 0; j < budget[i]!; j++, k++) {
        windParticle(zones[i]!, i, j, 0, 0, true, 0, p);
        const col = leafColors[p.kind]!;
        pCol.set([col.r, col.g, col.b], k * 3);
      }
    }
    leafGeo.getAttribute("color")!.needsUpdate = true;
  }

  return {
    stats,
    update(state, clock, amount, motion, pixelsPerTile) {
      const dt = Math.max(0, Math.min(0.1, clock - lastClock));
      lastClock = clock;
      windLooks(level, state, looks);
      const useParticles = amount > 0 && motion;
      stats.mode = useParticles ? "particules" : "fleches";
      stats.blowing = looks.map((l) => l.blowing);
      stats.announce = looks.map((l) => l.announce);
      leaves.visible = useParticles;
      leafMat.uniforms.uPixels!.value = pixelsPerTile;
      let drawn = 0;
      let k = 0;
      for (let i = 0; i < zones.length; i++) {
        const z = zones[i]!;
        const look = looks[i]!;
        travel[i] = travel[i]! + (motion ? flowStep(z, look.blowing, dt) : 0);
        const keep = Math.round(budget[i]! * Math.min(1, amount));
        for (let j = 0; j < budget[i]!; j++, k++) {
          if (!useParticles || j >= keep) {
            pAlpha[k] = 0;
            continue;
          }
          windParticle(z, i, j, travel[i]!, clock, look.blowing, look.announce, p);
          pPos[k * 3] = p.x;
          pPos[k * 3 + 1] = p.y;
          pPos[k * 3 + 2] = 0;
          pAlpha[k] = p.alpha;
          pSize[k] = p.size;
          pAngle[k] = p.angle;
          pKind[k] = p.kind;
          if (p.alpha > 0.01) drawn++;
        }
        // Flèches : seulement sans particules.
        const a = arrows[i]!;
        a.mesh.visible = !useParticles;
        a.mat.opacity = useParticles ? 0 : arrowOpacity(look);
        if (debug) debug[i]!.color.setHex(look.blowing ? 0x7dffd4 : 0x4a6680);
      }
      if (useParticles) {
        for (const name of ["position", "aAlpha", "aSize", "aAngle", "aKind"]) leafGeo.getAttribute(name)!.needsUpdate = true;
      }
      stats.particles = drawn;
      stats.arrows = useParticles ? 0 : arrows.reduce((s, a) => s + a.count, 0);
      stats.lit = useParticles ? 0 : looks.filter((l) => l.blowing).length;
      stats.arrowOpacity = arrows.map((a) => (a.mesh.visible ? a.mat.opacity : -1));
    },
  };
}

