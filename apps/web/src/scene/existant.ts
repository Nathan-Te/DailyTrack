// Lot 43 — **la scène d'avant le palier 1** (palier « existant » : la scène de `main` à la fin du lot 37, celle du lot 39 au pixel près). Elle a quitté
// le premier chargement : ce module est chargé à la demande (`import()`, registre `PAS_DU_JEU` de `socle.ts`) par `?palier=existant` (recette et
// aperçus seulement : comparer l'ancienne scène dans le vrai jeu) et par la vitrine (colonne « Existant »). En se chargeant, il branche son composeur
// (`brancherComposeur("existant", …)`). Code déplacé tel quel de `trackMesh.ts` (route, marquages, cuves, ciel, montagnes, `trackGeometry`), de
// `trackProps.ts` (arches, portes, panneaux sur poteau, bandeaux) et de `socle.ts` (l'assemblage) : mêmes objets, mêmes tirages, même image.
// Lot 44 : le décor d'avant (`decorGeometry`, `addScenery`…) l'a rejoint, sorti de `trackMesh.ts` : le palier 1 a le sien, chargé à la demande par thème.
import {
  AdditiveBlending,
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Float32BufferAttribute as F32,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  Scene,
  SpotLight,
  SRGBColorSpace,
} from "three";
import {
  BOOST_HALF_LENGTH,
  CELL,
  CUT_HALF_LENGTH,
  CUVE_LEFT,
  CUVE_RIGHT,
  FALL_DEPTH,
  KICK_START,
  JUMP_LIP,
  JUMP_RISE,
  KERB_WIDTH,
  SHOULDER_EDGE,
  WALL_HEIGHT,
  blockReachAt,
  blockHeight,
  blockHalfWidth,
  blockPadHalfWidth,
  blockWidth,
  cuveAmplitude,
  cuveRadius,
  cuveTop,
  curveCenter,
  curveSize,
  isCurve,
  isWide,
  trackWorld,
  turnsLeft,
  type Block,
  type PaletteName,
  type SurfaceKind,
  type Track,
  type World,
  NO_GROUND,
  cellKey,
  createSurface,
} from "@cdj/sim";
import { buildHalos } from "../halo";
import { Builder, mix, seeded, shade, world, type Box, type V3 } from "../meshKit";
import { signsFor } from "../signage";
import { CHAPEAU, MARGE_DECOR, placed, type PoseLog } from "../decorPose";
import { fastZones, postFractions } from "../speedFeel";
import { SIGN_STYLES, drawGlyph, poly, rect, signStyleOf, type Plane } from "../trackProps";
import type { SignSpec } from "../signage";
import {
  LOOKS,
  NEAR_CELLS,
  PALETTE_DEFS,
  SURFACE_COLORS,
  arcPoint,
  checkerTexture,
  disposeScene,
  hasCap,
  onBlock,
  onRim,
  roadHeight,
  type Palette,
  type TrackScene,
  type TrackSceneOptions,
} from "../trackMesh";
import { brancherComposeur } from "./socle";

// --- Le décor d'avant (lots 9b, 15, 22, 23, 37), sorti de `trackMesh.ts` au lot 44 : le palier 1 a le sien (`decor/<thème>.ts`) ---------------------

// Des éléments réguliers qui défilent au bord de la piste (décor seulement : aucune collision, rien dans `sim`). Plus serrés
// dans une portion rapide (`fastZones`), où s'ajoutent des arches et des chevrons peints au sol. Rangés dans le décor
// « lourd » : masqués à la qualité basse, absents des miniatures.

/** Poutre entre deux points `a` et `b` (à la même hauteur), épaisse de `y1 - y0`, profonde de `2 × depth` le long de `fwd`. */
export function beam(g: Builder, a: V3, b: V3, fwd: [number, number], depth: number, y0: number, y1: number, color: number) {
  const pt = (e: V3, f: number, y: number): V3 => [e[0] + fwd[0] * f * depth, y, e[2] + fwd[1] * f * depth];
  const c = (f: number, y: number): [V3, V3] => [pt(a, f, y), pt(b, f, y)];
  const [fa0, fb0] = c(1, y0);
  const [fa1, fb1] = c(1, y1);
  const [ba0, bb0] = c(-1, y0);
  const [ba1, bb1] = c(-1, y1);
  g.quad(fa0, fb0, fb1, fa1, color);
  g.quad(bb0, ba0, ba1, bb1, color);
  g.quad(fa1, fb1, bb1, ba1, shade(color, 1.15));
  g.quad(ba0, bb0, fb0, fa0, shade(color, 0.7));
  g.quad(ba0, fa0, fa1, ba1, color);
  g.quad(fb0, bb0, bb1, fb1, color);
}


/**
 * Mobilier de rue de la Ville (lot 37) : un lampadaire sur le chapeau du rebord, un bloc sur deux, un côté puis l'autre. Le pied est sur le chapeau (appui :
 * le rebord), la potence passe au-dessus de la route à 5,9 m, au-dessus du passage et de la caméra ; la lampe est un halo. C'est lui qui habille la rue, à
 * hauteur de voiture ; les lampadaires qui étaient posés au sol, huit mètres plus bas, ne se voyaient pas.
 */
export function addStreetLamps(g: Builder, glow: Builder, pal: Palette, b: Block, log?: PoseLog) {
  if (pal.scenery !== "city" || !hasCap(b) || b.index % 2 === 0) return;
  const cap = pal.wallHeight ?? WALL_HEIGHT;
  const side = b.index % 4 === 1 ? 1 : -1;
  const p = onRim(b, 0.5, side, CHAPEAU / 2, cap);
  const c = onBlock(b, 0, 0.5, 0);
  const len = Math.hypot(c[0] - p[0], c[2] - p[2]) || 1;
  const inward: [number, number] = [(c[0] - p[0]) / len, (c[2] - p[2]) / len];
  const meta = { kind: "lampadaire", block: b.index, style: "", group: log?.group() ?? 0 } as const;
  const top = p[1] + 5.2;
  const reach: V3 = [p[0] + inward[0] * 1.8, top, p[2] + inward[1] * 1.8];
  placed(log, { ...meta, part: "pied", appui: "rebord" }, [g], () => g.box(p[0] - 0.1, p[1], p[2] - 0.1, p[0] + 0.1, top, p[2] + 0.1, 0x3a3f4d));
  placed(log, { ...meta, part: "surplomb", appui: "rebord" }, [g, glow], () => {
    beam(g, [p[0], 0, p[2]], [reach[0], 0, reach[2]], [-inward[1], inward[0]], 0.05, top - 0.1, top + 0.04, 0x3a3f4d);
    glow.box(reach[0] - 0.25, top - 0.2, reach[2] - 0.25, reach[0] + 0.25, top - 0.1, reach[2] + 0.25, 0xf6efd0);
    glow.halo(reach[0], top - 0.15, reach[2], 0xfff0c8, 4.5);
  });
}

/**
 * Front de rue de la Ville (lot 37) : de chaque côté de la piste, des immeubles à des distances (2 à 12 m du rebord) et des hauteurs (8 à 38 m au-dessus de
 * la route) différentes, la plupart dans le champ de vision d'une voiture qui roule. Une suite de nombres à part (le reste du décor ne bouge pas) ;
 * jamais sur la route ni à moins de 1,5 m, jamais l'un dans l'autre. Tirés pour toute la piste ; `near` ne choisit que ceux qu'on construit (miniatures).
 */
export function addCityFront(g: Builder, pal: Palette, track: Track, floorY: number, world: World, near?: (b: Block) => boolean, log?: PoseLog) {
  const rnd = seeded(`${track.id}:${pal.scenery}:rue`);
  const taken: Box[] = [];
  for (const b of track.blocks) {
    if (b.kind === "gap" || b.cuve) continue;
    const curve = isCurve(b.kind);
    const slots = curve ? 2 * curveSize(b.kind) : 2;
    for (const side of [-1, 1] as const) {
      for (let k = 0; k < slots; k++) {
        const t = (k + 0.2 + rnd() * 0.6) / slots;
        const gap = 2 + rnd() * 10;
        const depth = 7 + rnd() * 5;
        const along = 8 + rnd() * 8;
        const above = 8 + rnd() * 30;
        const tint = rnd();
        const hw = curve ? b.w0 / 2 : blockHalfWidth(b, t * CELL);
        const c = onBlock(b, side * (hw + gap + depth / 2), t, 0);
        // Boîte alignée sur les axes : la profondeur suit la perpendiculaire à la piste (carrée dans un virage).
        const alongX = !curve && (b.dir === 1 || b.dir === 3);
        const w = curve ? (along + depth) / 2 : alongX ? along : depth;
        const d = curve ? (along + depth) / 2 : alongX ? depth : along;
        const box: Box = { x0: c[0] - w / 2, x1: c[0] + w / 2, z0: c[2] - d / 2, z1: c[2] + d / 2, y0: floorY, y1: 0 };
        if (!planLibre(world, box, 1.5) || taken.some((o) => box.x0 < o.x1 + 0.5 && box.x1 > o.x0 - 0.5 && box.z0 < o.z1 + 0.5 && box.z1 > o.z0 - 0.5)) continue;
        taken.push(box);
        const roadY = curve ? b.y0 + b.rise / 2 : blockHeight(b, t * CELL);
        const h = roadY - floorY + above;
        g.mute = !!near && !near(b);
        placed(log, { kind: "decor", part: "pied", appui: "sol", group: log?.group() ?? 0, block: -1, style: "city-front" }, [g], () => addBuilding(g, c[0], floorY, c[2], w, d, h, cityWall(tint), roadY - floorY - 2));
        g.mute = false;
      }
    }
  }
}

// --- Décor (lot 9b) : tout est construit une fois, fusionné en un ou deux maillages ; rien ne touche à `sim` -------------

/** Une boîte alignée sur les axes, donnée par ses deux coins dans le repère (p, q) du bloc. */
function blockBox(g: Builder, b: Block, p0: number, p1: number, q0: number, q1: number, y0: number, y1: number, color: number) {
  const a = world(b, p0, q0, y0);
  const c = world(b, p1, q1, y1);
  g.box(Math.min(a[0], c[0]), y0, Math.min(a[2], c[2]), Math.max(a[0], c[0]), y1, Math.max(a[2], c[2]), color);
}

const CROWD = [0xff4b4b, 0xffd22e, 0x4bd0ff, 0xf4f4f4, 0x6bff8a, 0xff8a3d, 0xc084fc] as const;

/**
 * Tribune au départ : trois gradins en escalier, de la foule en petites boîtes de couleur, un toit léger. Lot 37 : elle repose sur un socle plein jusqu'au
 * sol lointain (elle flottait à la hauteur de la route), et ne se pose que là où rien de la piste n'est à moins de `MARGE_DECOR` : du côté opposé à un
 * éventuel virage, sinon de l'autre, sinon pas du tout.
 */
export function addGrandstand(g: Builder, pal: Palette, b: Block, rnd: () => number, floorY: number, world: World, id: string, log?: PoseLog) {
  const meta = { kind: "tribune", part: "pied", appui: "sol", group: log?.group() ?? 0, block: -1, style: "" } as const;
  const first = turnsLeft(b.kind) ? 1 : -1;
  const accepter = (box: Box) => planLibre(world, box, MARGE_DECOR);
  if (placed(log, meta, [g], () => buildGrandstand(g, pal, b, rnd, first, floorY), accepter)) return;
  // L'autre côté : une suite de nombres à part, pour que le reste du décor, tiré de `rnd`, ne bouge pas.
  placed(log, { ...meta, group: log?.group() ?? 0 }, [g], () => buildGrandstand(g, pal, b, seeded(`${id}:tribune`), -first as 1 | -1, floorY), accepter);
}

function buildGrandstand(g: Builder, pal: Palette, b: Block, rnd: () => number, side: 1 | -1, floorY: number) {
  const hw = blockHalfWidth(b, CELL / 2);
  const base = side > 0 ? CELL / 2 + hw + 3.5 : CELL / 2 - hw - 3.5;
  const dir = side > 0 ? 1 : -1;
  const y0 = b.y0;
  const q0 = 5;
  const q1 = 27;
  for (let tier = 0; tier < 3; tier++) {
    const p0 = base + dir * tier * 2.2;
    const p1 = p0 + dir * 2.2;
    blockBox(g, b, Math.min(p0, p1), Math.max(p0, p1), q0, q1, floorY, y0 + 0.9 + tier * 1.0, shade(pal.skirt, 1.1 + tier * 0.08));
    const top = y0 + 0.9 + tier * 1.0;
    const mid = (p0 + p1) / 2;
    for (let q = q0 + 0.6; q < q1 - 0.4; q += 0.9) {
      for (const o of [-0.5, 0.5]) {
        if (rnd() < 0.12) continue; // places vides
        const c = CROWD[Math.floor(rnd() * CROWD.length)]!;
        const pp = mid + o * 0.6;
        blockBox(g, b, pp - 0.22, pp + 0.22, q, q + 0.4, top, top + 0.55 + rnd() * 0.15, c);
      }
    }
  }
  // Toit : une dalle sur quatre poteaux, qui descendent eux aussi jusqu'au sol.
  const pBack = base + dir * 6.6;
  const roof = y0 + 6.2;
  for (const q of [q0 + 0.4, q1 - 0.8]) blockBox(g, b, Math.min(pBack, pBack - dir * 0.4), Math.max(pBack, pBack - dir * 0.4), q, q + 0.4, floorY, roof, 0x3a3f4d);
  blockBox(g, b, Math.min(base, pBack + dir * 0.6), Math.max(base, pBack + dir * 0.6), q0, q1, roof, roof + 0.4, pal.wallA);
}

/** Vrai si le plan de `box`, élargi de `marge` m, ne touche ni route, ni bas-côté, ni paroi de cuve : rien de ce que la voiture roule (lot 37). */
export function planLibre(world: World, box: Box, marge: number): boolean {
  const x0 = box.x0 - marge;
  const x1 = box.x1 + marge;
  const z0 = box.z0 - marge;
  const z1 = box.z1 + marge;
  const hit = (x: number, z: number) => {
    world.sample(x, z, probe);
    return probe.height !== NO_GROUND;
  };
  if (hit((x0 + x1) / 2, (z0 + z1) / 2)) return false;
  const nx = Math.max(1, Math.ceil(x1 - x0));
  const nz = Math.max(1, Math.ceil(z1 - z0));
  for (let i = 0; i <= nx; i++) {
    const x = x0 + ((x1 - x0) * i) / nx;
    if (hit(x, z0) || hit(x, z1)) return false;
  }
  for (let j = 1; j < nz; j++) {
    const z = z0 + ((z1 - z0) * j) / nz;
    if (hit(x0, z) || hit(x1, z)) return false;
  }
  return true;
}
const probe = createSurface();

type Style = Palette["scenery"];

/** Teinte d'un immeuble de la Ville (lot 37) : le béton gris domine, le beige et le bleu-gris le varient. `r` ∈ [0, 1[. */
function cityWall(r: number): number {
  if (r < 0.2) return mix(0xcdbfa8, 0xe0d3bd, r / 0.2);
  if (r < 0.4) return mix(0x9fb0c2, 0xc2cfdc, (r - 0.2) / 0.2);
  return mix(0xa9adb5, 0xcfd2d8, (r - 0.4) / 0.6);
}

/**
 * Un immeuble : une boîte de béton, un acrotère, et des bandes de fenêtres sombres sur les quatre faces. Les fenêtres sont des surfaces à plat (2 triangles
 * chacune) et non des boîtes (12) : pour la même ville, six fois moins de triangles (lot 37).
 */
function addBuilding(g: Builder, x: number, y: number, z: number, w: number, d: number, h: number, wall: number, windowsFrom = 3) {
  g.box(x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2, wall);
  g.box(x - w / 2 - 0.15, y + h, z - d / 2 - 0.15, x + w / 2 + 0.15, y + h + 0.4, z + d / 2 + 0.15, shade(wall, 0.78)); // acrotère
  const glass = shade(0x35506b, 0.95 + ((Math.round(x * 3 + z) % 3) - 1) * 0.08);
  const e = 0.04;
  // Les bandes montent depuis 3 m au-dessus du pied (le rez-de-chaussée est plein), alignées sur le sol lointain ; sous le niveau de la route on ne les voit pas : `windowsFrom`.
  for (let f = 3 + Math.floor(Math.max(0, windowsFrom - 3) / 3.2) * 3.2; f < h - 1.5; f += 3.2) {
    const y0 = y + f;
    const y1 = y + f + 1.4;
    g.quad([x - w / 2 + 0.6, y0, z + d / 2 + e], [x + w / 2 - 0.6, y0, z + d / 2 + e], [x + w / 2 - 0.6, y1, z + d / 2 + e], [x - w / 2 + 0.6, y1, z + d / 2 + e], glass);
    g.quad([x + w / 2 - 0.6, y0, z - d / 2 - e], [x - w / 2 + 0.6, y0, z - d / 2 - e], [x - w / 2 + 0.6, y1, z - d / 2 - e], [x + w / 2 - 0.6, y1, z - d / 2 - e], glass);
    g.quad([x + w / 2 + e, y0, z - d / 2 + 0.6], [x + w / 2 + e, y0, z + d / 2 - 0.6], [x + w / 2 + e, y1, z + d / 2 - 0.6], [x + w / 2 + e, y1, z - d / 2 + 0.6], glass);
    g.quad([x - w / 2 - e, y0, z + d / 2 - 0.6], [x - w / 2 - e, y0, z - d / 2 + 0.6], [x - w / 2 - e, y1, z - d / 2 + 0.6], [x - w / 2 - e, y1, z + d / 2 - 0.6], glass);
  }
}

/** Un élément de décor posé au sol en (x, y, z). `glow` : parties lumineuses (matériau sans éclairage). */
function addProp(g: Builder, glow: Builder, style: Style, pal: Palette, x: number, y: number, z: number, rnd: () => number, roadY = y) {
  const k = rnd();
  const jitter = 0.9 + rnd() * 0.2;
  if (style === "desert") {
    if (k < 0.45) {
      const h = (3 + rnd() * 3) * jitter;
      const green = mix(0x3d7a3a, 0x5aa04a, rnd());
      g.prism(x, y, z, 0.42, 0.34, h, 6, green, shade(green, 1.15));
      for (const s of [-1, 1]) {
        if (rnd() < 0.3) continue;
        const ah = 0.9 + rnd() * 1.2;
        const ay = y + h * (0.35 + rnd() * 0.25);
        g.box(x + s * 0.35, ay, z - 0.17, x + s * 1.05, ay + 0.34, z + 0.17, green);
        g.box(x + s * 0.85, ay, z - 0.17, x + s * 1.2, ay + ah, z + 0.17, green);
      }
    } else if (k < 0.85) {
      const r = (0.9 + rnd() * 1.6) * jitter;
      const rock = mix(0xa86a44, 0xd09a6a, rnd());
      g.prism(x, y, z, r, r * 0.55, r * 0.9, 5, rock, shade(rock, 1.2), rnd() * 3);
    } else {
      const r = 0.8 + rnd() * 0.5;
      g.prism(x, y, z, r, 0.1, 0.7, 6, mix(0x9a8a45, 0xb8a050, rnd()));
    }
  } else if (style === "pine") {
    const h = (5 + rnd() * 4.5) * jitter;
    const green = mix(0x1f5a3c, 0x2f7a50, rnd());
    g.box(x - 0.22, y, z - 0.22, x + 0.22, y + h * 0.22, z + 0.22, 0x5b3d26);
    for (let t = 0; t < 3; t++) {
      const f = t / 3;
      const r = (2.1 - f * 1.0) * jitter;
      g.prism(x, y + h * (0.16 + f * 0.27), z, r, 0.05, h * 0.42, 7, green, 0xf6fbff); // neige sur le sommet
    }
    if (k > 0.8) {
      const r = 0.7 + rnd() * 0.8;
      g.prism(x + 3, y, z + 1, r, r * 0.5, r * 0.8, 5, 0x8a96a8, 0xffffff);
    }
  } else if (style === "lamps") {
    if (k < 0.5) {
      const h = (4.5 + rnd() * 1.5) * jitter;
      g.box(x - 0.1, y, z - 0.1, x + 0.1, y + h, z + 0.1, 0x20243a);
      g.box(x - 0.1, y + h - 0.1, z - 0.1, x + 0.9, y + h + 0.05, z + 0.1, 0x20243a);
      glow.box(x + 0.5, y + h - 0.2, z - 0.25, x + 0.95, y + h - 0.08, z + 0.25, 0xffe9a8);
      glow.prism(x + 0.72, y, z, 0.01, 0.01, 0.01, 3, 0xffe9a8);
      glow.halo(x + 0.72, y + h - 0.15, z, 0xffd98a, 5.5);
    } else {
      const h = (4 + rnd() * 3.5) * jitter;
      const green = mix(0x16303a, 0x20424a, rnd());
      g.box(x - 0.2, y, z - 0.2, x + 0.2, y + h * 0.25, z + 0.2, 0x2a2018);
      for (let t = 0; t < 3; t++) g.prism(x, y + h * (0.18 + t * 0.26), z, (1.8 - t * 0.5) * jitter, 0.05, h * 0.4, 6, green, shade(green, 1.4));
    }
  } else if (style === "trees") {
    if (k < 0.7) {
      const h = (3.6 + rnd() * 2.4) * jitter;
      const leaf = mix(0x2f8f3a, 0x5cbb4a, rnd());
      g.box(x - 0.25, y, z - 0.25, x + 0.25, y + h * 0.5, z + 0.25, 0x6a4528);
      g.prism(x, y + h * 0.35, z, 2.0 * jitter, 1.2, h * 0.45, 7, leaf, shade(leaf, 1.2), rnd());
      g.prism(x, y + h * 0.7, z, 1.4 * jitter, 0.05, h * 0.38, 7, shade(leaf, 1.08), shade(leaf, 1.3), rnd());
    } else if (k < 0.88) {
      const r = (0.9 + rnd() * 0.7) * jitter;
      g.prism(x, y, z, r, r * 0.8, r * 0.9, 8, 0xd8b45a, 0xe9cc7c); // botte de foin
    } else {
      const r = 0.7 + rnd() * 0.6;
      g.prism(x, y, z, r, r * 0.4, r * 0.8, 6, mix(0x3f9a3a, 0x6fc45a, rnd()));
    }
  } else if (style === "flags") {
    // Stade (lot 21) : mâts à drapeaux de couleur, haies taillées, panneaux publicitaires.
    if (k < 0.4) {
      const h = (6 + rnd() * 3) * jitter;
      const flag = [0xe8283a, 0x2e7dff, 0xffd22e, 0x21b35a, 0xffffff][Math.floor(rnd() * 5)]!;
      g.box(x - 0.08, y, z - 0.08, x + 0.08, y + h, z + 0.08, 0xe9edf2);
      g.box(x + 0.08, y + h - 1.4, z - 0.04, x + 2.2, y + h - 0.1, z + 0.04, flag);
    } else if (k < 0.8) {
      const len = (3 + rnd() * 4) * jitter;
      const green = mix(0x2f8a3a, 0x3fa646, rnd());
      g.box(x - len / 2, y, z - 0.6, x + len / 2, y + 1.3, z + 0.6, green);
    } else {
      const w = 4 + rnd() * 2;
      const c = [0xe8283a, 0x2e7dff, 0xffd22e][Math.floor(rnd() * 3)]!;
      g.box(x - w / 2, y, z - 0.15, x + w / 2, y + 1.6, z + 0.15, c);
      g.box(x - w / 2 + 0.3, y + 0.4, z - 0.17, x + w / 2 - 0.3, y + 1.2, z + 0.17, 0xffffff);
    }
  } else if (style === "canyon") {
    // Canyon (lot 22) : mesas et aiguilles de roche rouge à strates, cactus, buissons secs.
    if (k < 0.4) {
      const r = (2.2 + rnd() * 2.6) * jitter;
      const h = (7 + rnd() * 11) * jitter;
      const rock = mix(0xa8452a, 0xc9683c, rnd());
      g.prism(x, y, z, r, r * 0.8, h * 0.55, 7, rock, shade(rock, 0.86), rnd() * 3);
      g.prism(x, y + h * 0.55, z, r * 0.8, r * 0.62, h * 0.45, 7, shade(rock, 1.12), mix(0xe3a86d, rock, 0.3), rnd() * 3);
    } else if (k < 0.62) {
      const h = (2.6 + rnd() * 2.4) * jitter;
      const green = mix(0x4a7a3a, 0x6a9a4a, rnd());
      g.prism(x, y, z, 0.36, 0.3, h, 6, green, shade(green, 1.15));
      if (rnd() < 0.7) g.box(x + 0.3, y + h * 0.45, z - 0.15, x + 0.95, y + h * 0.45 + 0.3, z + 0.15, green);
    } else if (k < 0.88) {
      const r = (0.8 + rnd() * 1.4) * jitter;
      const rock = mix(0xb86a46, 0xdc9a68, rnd());
      g.prism(x, y, z, r, r * 0.5, r * 0.85, 5, rock, shade(rock, 1.18), rnd() * 3);
    } else {
      const r = 0.7 + rnd() * 0.5;
      g.prism(x, y, z, r, 0.1, 0.6, 6, mix(0x8a7a40, 0xa89050, rnd())); // buisson sec
    }
  } else if (style === "alpine") {
    // Col alpin (lot 22) : sapins à sommet enneigé, gros blocs gris, chalets de bois au toit blanc.
    if (k < 0.62) {
      const h = (6 + rnd() * 5) * jitter;
      const green = mix(0x1f5a3c, 0x2d7550, rnd());
      g.box(x - 0.2, y, z - 0.2, x + 0.2, y + h * 0.2, z + 0.2, 0x5b3d26);
      for (let t = 0; t < 3; t++) {
        const f = t / 3;
        g.prism(x, y + h * (0.14 + f * 0.28), z, (2.2 - f) * jitter, 0.05, h * 0.44, 7, green, 0xf6fbff);
      }
    } else if (k < 0.88) {
      const r = (1.2 + rnd() * 2) * jitter;
      g.prism(x, y, z, r, r * 0.45, r * 0.95, 6, 0x7d8896, 0xdfe7ef, rnd() * 3);
    } else {
      const w = (3.4 + rnd() * 1.4) * jitter;
      g.box(x - w / 2, y, z - w / 2, x + w / 2, y + 2.6, z + w / 2, 0x8a5a36);
      g.prism(x, y + 2.6, z, w * 0.82, 0.1, 1.6, 4, 0xe8eef4, 0xffffff, Math.PI / 4);
    }
  } else if (style === "city") {
    // Ville (lot 22, repris au lot 37) : des immeubles de béton, dont le sommet dépasse la route de 6 à 34 m (le sol est à 8 m au moins sous elle : sans cela
    // on ne voyait que des toits derrière le rebord). Le mobilier de rue est sur le rebord (`addStreetLamps`), plus au sol où personne ne le voyait.
    if (k < 0.55) {
      const w = (6 + rnd() * 6) * jitter;
      const d = (6 + rnd() * 6) * jitter;
      const h = roadY - y + (6 + rnd() * 28) * jitter;
      addBuilding(g, x, y, z, w, d, h, cityWall(rnd()), roadY - y - 2);
    } else if (k < 0.85) {
      rnd(); // (l'ancien lampadaire au sol : ses tirages sont gardés, le reste du décor ne bouge pas)
    } else {
      rnd();
      rnd();
    }
  } else {
    // pylônes lumineux : un mât sombre, un tube lumineux, des cubes qui flottent
    const h = (5 + rnd() * 6) * jitter;
    const c = k < 0.5 ? 0x00f0ff : k < 0.8 ? 0xff2bd6 : 0xfff200;
    g.box(x - 0.18, y, z - 0.18, x + 0.18, y + h, z + 0.18, 0x1a0b36);
    glow.box(x - 0.08, y + h * 0.15, z - 0.2, x + 0.08, y + h, z + 0.2, c);
    glow.box(x - 0.2, y + h * 0.15, z - 0.08, x + 0.2, y + h, z + 0.08, c);
    glow.halo(x, y + h * 0.6, z, c, 6);
    if (rnd() < 0.4) glow.box(x + 1.4, y + h * 0.5, z, x + 2.2, y + h * 0.5 + 0.8, z + 0.8, c);
  }
}

/**
 * Décor propre à un thème, seulement dans la passe dense (lot 23) : clôtures et haies de la Campagne, falaises du Canyon, murets de pierre
 * du Col alpin, rangées de sapins de la Banquise. Renvoie vrai si un élément a été posé (sinon l'appelant pose un élément ordinaire).
 */
function addTypedProp(g: Builder, style: Style, x: number, y: number, z: number, rnd: () => number): boolean {
  const k = rnd();
  const jitter = 0.9 + rnd() * 0.2;
  const along = rnd() < 0.5; // le long de x ou de z
  if (style === "trees" && k < 0.45) {
    const len = (7 + rnd() * 9) * jitter;
    const half = len / 2;
    if (k < 0.25) {
      // Clôture de bois : poteaux tous les 2 m, deux lisses.
      for (let t = -half; t <= half; t += 2) along ? g.box(x + t - 0.07, y, z - 0.07, x + t + 0.07, y + 1.15, z + 0.07, 0x7a5230) : g.box(x - 0.07, y, z + t - 0.07, x + 0.07, y + 1.15, z + t + 0.07, 0x7a5230);
      for (const yy of [0.5, 0.95]) along ? g.box(x - half, y + yy, z - 0.04, x + half, y + yy + 0.1, z + 0.04, 0x9a6a3e) : g.box(x - 0.04, y + yy, z - half, x + 0.04, y + yy + 0.1, z + half, 0x9a6a3e);
    } else {
      // Haie taillée.
      const green = mix(0x2f7a32, 0x3f9a3e, rnd());
      along ? g.box(x - half, y, z - 0.55, x + half, y + 1.4, z + 0.55, green) : g.box(x - 0.55, y, z - half, x + 0.55, y + 1.4, z + half, green);
    }
    return true;
  }
  if (style === "canyon" && k < 0.4) {
    // Falaise : un mur de roche à strates, large et haut, qui ferme l'horizon proche.
    const w = (10 + rnd() * 14) * jitter;
    const d = 3 + rnd() * 2.5;
    const h = (9 + rnd() * 10) * jitter;
    const rock = mix(0x9a3f26, 0xc4673a, rnd());
    const bands = 4;
    for (let i = 0; i < bands; i++) {
      const y0 = y + (h * i) / bands;
      const inset = i * 0.35;
      const c = i % 2 === 0 ? rock : shade(rock, 1.15);
      along ? g.box(x - w / 2 + inset, y0, z - d / 2 + inset * 0.5, x + w / 2 - inset, y0 + h / bands, z + d / 2 - inset * 0.5, c) : g.box(x - d / 2 + inset * 0.5, y0, z - w / 2 + inset, x + d / 2 - inset * 0.5, y0 + h / bands, z + w / 2 - inset, c);
    }
    return true;
  }
  if (style === "alpine" && k < 0.3) {
    // Muret de pierre sèche, bas.
    const len = (5 + rnd() * 6) * jitter;
    const stone = mix(0x7d8896, 0x9aa5b2, rnd());
    along ? g.box(x - len / 2, y, z - 0.35, x + len / 2, y + 0.9, z + 0.35, stone) : g.box(x - 0.35, y, z - len / 2, x + 0.35, y + 0.9, z + len / 2, stone);
    return true;
  }
  if (style === "pine" && k < 0.3) {
    // Rangée de trois sapins serrés (forêt).
    for (let t = -1; t <= 1; t++) {
      const px = along ? x + t * 2.6 : x;
      const pz = along ? z : z + t * 2.6;
      const h = (5.5 + rnd() * 3.5) * jitter;
      const green = mix(0x1f5a3c, 0x2f7a50, rnd());
      g.box(px - 0.2, y, pz - 0.2, px + 0.2, y + h * 0.2, pz + 0.2, 0x5b3d26);
      for (let q = 0; q < 3; q++) g.prism(px, y + h * (0.15 + (q / 3) * 0.27), pz, 2 - q * 0.5, 0.05, h * 0.42, 7, green, 0xf6fbff);
    }
    return true;
  }
  return false;
}

/** Hauteur moyenne de la route autour de la cellule (cx, cz), à `span` cellules près ; `floorY` s'il n'y en a pas. */
function roadAround(track: Track, cx: number, cz: number, span: number, floorY: number): number {
  let sum = 0;
  let n = 0;
  for (const b of track.blocks) {
    if (Math.abs(b.cx - cx) <= span && Math.abs(b.cz - cz) <= span) {
      sum += b.y0 + b.rise / 2;
      n++;
    }
  }
  return n > 0 ? sum / n : floorY;
}

/** Décor au bord de la piste : dans les cellules vides à moins de 2 cellules d'un bloc, selon le style de la palette. */
export function addScenery(g: Builder, glow: Builder, pal: Palette, track: Track, floorY: number, world: World, rnd: () => number, keep?: (cx: number, cz: number) => boolean, dense = false, log?: PoseLog, aerial = false) {
  const wanted = new Set<number>();
  const span = 2;
  for (const b of track.blocks) {
    for (let dx = -span; dx <= span; dx++) {
      for (let dz = -span; dz <= span; dz++) {
        const key = cellKey(b.cx + dx, b.cz + dz);
        if (!track.cells.has(key)) wanted.add(key);
      }
    }
  }
  // La cellule est retrouvée par sa clé : on parcourt les blocs voisins pour garder (cx, cz).
  const cells: [number, number][] = [];
  const seen = new Set<number>();
  for (const b of track.blocks) {
    for (let dx = -span; dx <= span; dx++) {
      for (let dz = -span; dz <= span; dz++) {
        const key = cellKey(b.cx + dx, b.cz + dz);
        if (wanted.has(key) && !seen.has(key)) {
          seen.add(key);
          cells.push([b.cx + dx, b.cz + dz]);
        }
      }
    }
  }
  let count = 0;
  // Lot 37 : un élément posé au sol ne touche jamais la route ni un bas-côté (`MARGE_DECOR` m de marge) ; refusé, il disparaît mais a consommé ses tirages au sort.
  const accepter = (box: Box) => planLibre(world, box, MARGE_DECOR);
  for (const [cx, cz] of cells) {
    g.mute = glow.mute = keep ? !keep(cx, cz) : false; // hors du cadre : mêmes tirages au sort, aucune forme
    const n = dense ? 1 + Math.floor(rnd() * 2) : 1 + Math.floor(rnd() * 3);
    const roadY = aerial ? floorY : roadAround(track, cx, cz, span, floorY); // vue aérienne : la ville reste basse, elle ne cache pas la piste
    for (let i = 0; i < n && count < (dense ? 520 : 650); i++, count++) {
      const x = cx * CELL + 3 + rnd() * (CELL - 6);
      const z = cz * CELL + 3 + rnd() * (CELL - 6);
      const meta = { kind: "decor", part: "pied", appui: "sol", group: log?.group() ?? 0, block: -1, style: pal.scenery } as const;
      let typed = false;
      if (dense) placed(log, meta, [g, glow], () => (typed = addTypedProp(g, pal.scenery, x, floorY, z, rnd)), accepter);
      if (typed) continue;
      placed(log, meta, [g, glow], () => addProp(g, glow, pal.scenery, pal, x, floorY, z, rnd, roadY), accepter);
    }
  }
  g.mute = glow.mute = false;
}

/** Le décor de l'existant, séparé de sa route (lot 43) : ce que le palier 1 garde tel quel (« le décor de fond reste celui d'aujourd'hui »). */
export interface DecorGeometry {
  decorG: Builder;
  glowG: Builder;
  denseG: Builder;
  denseGlow: Builder;
}

/**
 * Le décor d'aujourd'hui (lot 37) sans la route : tribune du départ, décor du thème, front de rue et lampadaires de la Ville, passe dense. **Mêmes tirages au
 * sort que l'existant** (`${id}:${palette}`, puis `…:dense`, `…:rue`, `…:tribune`) : le palier 1 pose exactement le même décor. Les lampadaires de la Ville
 * sont sur le chapeau des rebords (le palier 1 garde le muret de 0,8 m et son garde-corps : `scene/route.ts`).
 */
export function decorGeometry(track: Track, paletteName: PaletteName, options: TrackSceneOptions = {}): DecorGeometry {
  const pal = PALETTE_DEFS[paletteName];
  const floorY = track.voidY - FALL_DEPTH;
  const decorG = new Builder();
  const glowG = new Builder();
  const roulant = trackWorld(track);
  if (!options.aerial) for (const b of track.blocks) addStreetLamps(decorG, glowG, pal, b, options.log);
  const rnd = seeded(`${track.id}:${paletteName}`);
  const first0 = track.blocks[0]!;
  const near = options.aerial ? options.near : undefined;
  const windowBlocks = near ? track.blocks.slice(near.from, near.to + 1) : [];
  const nearCell = (cx: number, cz: number) => windowBlocks.some((b) => Math.abs(b.cx - cx) <= NEAR_CELLS && Math.abs(b.cz - cz) <= NEAR_CELLS);
  decorG.mute = !!near && !nearCell(first0.cx, first0.cz);
  addGrandstand(decorG, pal, first0, rnd, floorY, roulant, track.id, options.log);
  decorG.mute = false;
  addScenery(decorG, glowG, pal, track, floorY, roulant, rnd, near ? nearCell : undefined, false, options.log, !!options.aerial);
  if (pal.scenery === "city" && !options.aerial) addCityFront(decorG, pal, track, floorY, roulant, near ? (b) => nearCell(b.cx, b.cz) : undefined, options.log);
  const denseG = new Builder();
  const denseGlow = new Builder();
  if (!options.aerial) addScenery(denseG, denseGlow, pal, track, floorY, roulant, seeded(`${track.id}:${paletteName}:dense`), undefined, true, options.log);
  return { decorG, glowG, denseG, denseGlow };
}

/** Motifs légers par revêtement (traces, éclats, brins) : une teinte plus sombre ou plus claire. */
const SURFACE_MARKS: Record<Exclude<SurfaceKind, "road">, number> = { dirt: 0x5e4328, ice: 0xffffff, grass: 0x2f7a26, gravel: 0x6b5d4a, sand: 0xb8985a, snow: 0xc9d8e8, kerb: 0xffffff };
/** Bas-côtés de l'herbe haute de Campagne : une herbe plus sombre et plus jaune que celle du Stade (lot 21). */
const TALL_GRASS: [number, number] = [0x6f9a3a, 0x668f34];
/** Blocs à effet : couleurs propres, indépendantes de la palette (la lisibilité d'abord). */
const TURBO_COLOR = { base: 0xff3b30, mark: 0xffe14d };
const CUT_COLOR = { base: 0x2b1b45, mark: 0xffd22e };

/** Une « tranche » de route : deux bords (gauche, droite) à une avance donnée. */
interface Row {
  left: V3;
  right: V3;
}

/** Tranches d'un intervalle [q0, q1] du bloc droit, avec `steps` subdivisions. `yOf` donne la hauteur, `half` la demi-largeur (la route par défaut). */
function straightRows(b: Block, q0: number, q1: number, steps: number, yOf: (q: number) => number, half?: number): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i <= steps; i++) {
    const q = q0 + ((q1 - q0) * i) / steps;
    const y = yOf(q);
    const hw = half ?? blockHalfWidth(b, q); // varie dans un bloc de transition
    rows.push({ left: world(b, CELL / 2 + hw, q, y), right: world(b, CELL / 2 - hw, q, y) });
  }
  return rows;
}

/** Tranches d'un virage : la route (demi-largeur `half` par défaut), relevée de `lift` m. */
function curveRows(b: Block, half = b.w0 / 2, lift = 0): Row[] {
  const { r: R } = curveCenter(b.kind);
  const hw = half; // un virage garde sa largeur
  const steps = (curveSize(b.kind) === 1 ? 10 : curveSize(b.kind) === 2 ? 24 : 40) + (b.banked ? 8 : 0);
  const rows: Row[] = [];
  const left = turnsLeft(b.kind);
  for (let i = 0; i <= steps; i++) {
    const a = (Math.PI / 2) * (i / steps);
    const at = (r: number) => arcPoint(b, r, a, b.y0 + lift);
    // Dans le repère canonique p augmente vers la gauche : le bord intérieur d'un virage à gauche est à gauche.
    rows.push(left ? { left: at(R - hw), right: at(R + hw) } : { left: at(R + hw), right: at(R - hw) });
  }
  return rows;
}

// Bandes rouges et blanches, comptées par côté : partagé, le compteur donnerait une seule couleur à chaque rebord
// quand chaque tranche ne fait qu'une bande (virages).
const stripes = { left: 0, right: 0 };

/** Point à la fraction `t` de la largeur de la tranche (0 : bord gauche, 1 : bord droit), relevé de `up`. */
function across(r: Row, t: number, up: number): V3 {
  return [r.left[0] + (r.right[0] - r.left[0]) * t, r.left[1] + (r.right[1] - r.left[1]) * t + up, r.left[2] + (r.right[2] - r.left[2]) * t];
}

/** Largeur d'une tranche de route (m). */
const rowWidth = (r: Row) => Math.hypot(r.left[0] - r.right[0], r.left[2] - r.right[2]) || 1;

/** Au-delà de cette hauteur au-dessus du sol lointain (m), une route repose sur des piliers : une dalle mince, et le vide dessous (lot 17). */
const PILLAR_MIN = 12;
/** Épaisseur de la dalle d'une route sur piliers (m). */
const SLAB = 1.3;

interface RoadStyle {
  /** Sans rebords (modificateur `o`) : à la place, une bordure plate rouge et blanche, pour qu'on voie où la route s'arrête. */
  open?: boolean;
  /** Surface seule (lot 21 : la route posée sur ses bas-côtés) : ni rebords ni bordure. */
  bare?: boolean;
  /** Couleurs du rebord (lot 21 : au bout d'un bas-côté, muret ou clôture du thème) ; sinon le rouge et blanc de la palette. */
  fence?: [number, number];
  /** Bordure lumineuse au bord du vide (lot 21, Nuit) : dessinée dans ce calque sans éclairage. */
  glow?: Builder;
  /** Route sur piliers : dalle mince au lieu d'un remblai plein jusqu'au sol. */
  pillars?: boolean;
}

/** Hauteurs (m) des deux lisses d'un garde-corps, au-dessus du pied du rebord ; la plus haute est la hauteur de la simulation (`WALL_HEIGHT`). */
const GARDE_CORPS_LISSES = [1.02, WALL_HEIGHT - 0.07] as const;
const GARDE_CORPS_ACIER = 0x4b525c;

/**
 * Garde-corps (lot 37) sur le chapeau d'un muret : deux lisses et un montant, des surfaces minces (la route est dessinée des deux côtés) : le regard passe à
 * travers. `at(t, up)` donne le point du pied du rebord à la fraction `t` du tronçon, relevé de `up` ; `ox`, `oz` : le décalage du chapeau (vers l'extérieur, 0,6 m).
 */
function addGuardRail(g: Builder, at: (t: number, up: number) => V3, t0: number, t1: number, ox: number, oz: number, base: number) {
  const cx = ox / 2; // axe du chapeau
  const cz = oz / 2;
  const lift = (p: V3, dy: number): V3 => [p[0] + cx, p[1] + dy, p[2] + cz];
  for (const top of GARDE_CORPS_LISSES) g.quad(lift(at(t0, 0), top - 0.08), lift(at(t1, 0), top - 0.08), lift(at(t1, 0), top), lift(at(t0, 0), top), GARDE_CORPS_ACIER);
  // Un montant à la fin du tronçon : deux plans croisés, du chapeau à la lisse haute.
  const foot = lift(at(t1, 0), base);
  const head = lift(at(t1, 0), WALL_HEIGHT);
  const w = 0.05;
  g.quad([foot[0] - w, foot[1], foot[2]], [foot[0] + w, foot[1], foot[2]], [head[0] + w, head[1], head[2]], [head[0] - w, head[1], head[2]], GARDE_CORPS_ACIER);
  g.quad([foot[0], foot[1], foot[2] - w], [foot[0], foot[1], foot[2] + w], [head[0], head[1], head[2] + w], [head[0], head[1], head[2] - w], GARDE_CORPS_ACIER);
}

function addRoad(g: Builder, pal: Palette, rows: Row[], color: number, floorY: number, skirt: boolean, paved = false, skirtColor = pal.skirt, style: RoadStyle = {}) {
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i]!;
    const b = rows[i + 1]!;
    g.quad(a.left, a.right, b.right, b.left, color);
    if (paved) {
      // Bitume : deux sillons plus sombres (usure des roues) et deux lignes de rive blanches.
      // Distances en mètres convertis en fractions de la largeur de chaque tranche (la route peut s'élargir d'une tranche à l'autre).
      const worn = shade(color, 0.9);
      const wa = rowWidth(a);
      const wb = rowWidth(b);
      for (const c of [-2.6, 2.6]) {
        const w = 0.9;
        g.quad(across(a, 0.5 + (c - w) / wa, 0.02), across(a, 0.5 + (c + w) / wa, 0.02), across(b, 0.5 + (c + w) / wb, 0.02), across(b, 0.5 + (c - w) / wb, 0.02), worn);
      }
      for (const [d0, d1] of [[0.45, 0.75], [-0.75, -0.45]] as const) {
        // lignes de rive : de 0,45 à 0,75 m de chaque bord (distances négatives : depuis le bord droit)
        const fa = (d: number) => (d >= 0 ? d / wa : 1 + d / wa);
        const fb = (d: number) => (d >= 0 ? d / wb : 1 + d / wb);
        g.quad(across(a, fa(d0), 0.03), across(a, fa(d1), 0.03), across(b, fb(d1), 0.03), across(b, fb(d0), 0.03), shade(pal.dash, 0.92));
      }
    }
    // Jupe : la route repose sur un « remblai » jusqu'au sol, pour qu'on lise qu'au-delà du bord c'est le vide.
    if (skirt) {
      for (const side of ["left", "right"] as const) {
        const p = a[side];
        const q = b[side];
        // Sur piliers : une dalle de `SLAB` m ; sinon un remblai plein jusqu'au sol.
        const lo = (v: V3) => (style.pillars ? v[1] - SLAB : floorY);
        g.quad(p, q, [q[0], lo(q), q[2]], [p[0], lo(p), p[2]], skirtColor);
      }
      // Dessous de la dalle : on le voit en passant dessous (et par les vides).
      if (style.pillars) {
        g.quad([a.left[0], a.left[1] - SLAB, a.left[2]], [a.right[0], a.right[1] - SLAB, a.right[2]], [b.right[0], b.right[1] - SLAB, b.right[2]], [b.left[0], b.left[1] - SLAB, b.left[2]], shade(skirtColor, 0.7));
      }
    }
    if (style.bare) continue;
    if (style.open) {
      // Bordure plate de chaque côté : des bandes alternées de ~4 m larges de 0,5 m, juste au-dessus de la route.
      // Nuit (lot 21) : un néon au bord du vide, dans le calque lumineux.
      const neon = pal.neon && style.glow ? pal.neon : null;
      const target = neon ? style.glow! : g;
      for (const side of ["left", "right"] as const) {
        const p = a[side];
        const q = b[side];
        const mx = (a.left[0] + a.right[0]) / 2;
        const mz = (a.left[2] + a.right[2]) / 2;
        const len = Math.hypot(mx - p[0], mz - p[2]) || 1;
        const ix = ((mx - p[0]) / len) * 0.5; // vers l'axe
        const iz = ((mz - p[2]) / len) * 0.5;
        const pieces = Math.max(1, Math.round(Math.hypot(q[0] - p[0], q[2] - p[2]) / 4));
        for (let k = 0; k < pieces; k++) {
          const at = (t: number, inward: number): V3 => [p[0] + (q[0] - p[0]) * t + ix * inward, p[1] + (q[1] - p[1]) * t + 0.06, p[2] + (q[2] - p[2]) * t + iz * inward];
          const color = neon ? neon[side === "left" ? 0 : 1] : stripes[side]++ % 2 === 0 ? pal.wallA : pal.wallB;
          target.quad(at(k / pieces, 0), at(k / pieces, neon ? 0.5 : 1), at((k + 1) / pieces, neon ? 0.5 : 1), at((k + 1) / pieces, 0), color);
          if (neon && k % 2 === 0) {
            const m = at((k + 0.5) / pieces, 0.25);
            target.halo(m[0], m[1] + 0.25, m[2], color, 3.4); // halo du néon (lot 23)
          }
        }
      }
      continue;
    }
    // Rebords : une face intérieure et un chapeau, en bandes rouges et blanches d'environ 4 m.
    for (const side of ["left", "right"] as const) {
      const p = a[side];
      const q = b[side];
      const mx = (a.left[0] + a.right[0]) / 2;
      const mz = (a.left[2] + a.right[2]) / 2;
      const dx = p[0] - mx;
      const dz = p[2] - mz;
      const len = Math.hypot(dx, dz) || 1;
      const ox = (dx / len) * 0.6; // le chapeau dépasse vers l'extérieur
      const oz = (dz / len) * 0.6;
      const pieces = Math.max(1, Math.round(Math.hypot(q[0] - p[0], q[2] - p[2]) / 4));
      for (let k = 0; k < pieces; k++) {
        const t0 = k / pieces;
        const t1 = (k + 1) / pieces;
        const at = (t: number, up: number): V3 => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t + up, p[2] + (q[2] - p[2]) * t];
        const wallColor = stripes[side]++ % 2 === 0 ? (style.fence?.[0] ?? pal.wallA) : (style.fence?.[1] ?? pal.wallB);
        const wallTop = pal.wallHeight ?? WALL_HEIGHT;
        g.quad(at(t0, 0), at(t1, 0), at(t1, wallTop), at(t0, wallTop), wallColor);
        const c0 = at(t0, wallTop);
        const c1 = at(t1, wallTop);
        g.quad(c0, c1, [c1[0] + ox, c1[1], c1[2] + oz], [c0[0] + ox, c0[1], c0[2] + oz], wallColor);
        if (pal.barrier === "garde-corps") addGuardRail(g, at, t0, t1, ox, oz, wallTop);
      }
    }
  }
}


// --- Bas-côtés et vibreurs (lot 21) -------------------------------------------------------------------------------------------

/** Couleurs d'un bas-côté : l'herbe haute de la Campagne est plus sombre que la pelouse du Stade. */
function shoulderColor(pal: Palette, kind: NonNullable<Block["shoulder"]>, i: number): number {
  if (kind === "grass" && pal.scenery === "trees") return TALL_GRASS[i % 2]!;
  return SURFACE_COLORS[kind][i % 2]!;
}

/** Vibreurs d'un virage (lot 21) : bandes rouges et blanches de `KERB_WIDTH` m aux deux bords de la route, une couleur par tranche. Lot 23 : sans éclairage (`g` est un constructeur « lumineux »), donc vifs de jour comme de nuit. */
function addKerbs(g: Builder, rows: Row[]) {
  for (let i = 0; i + 1 < rows.length; i++) {
    const a = rows[i]!;
    const b = rows[i + 1]!;
    const fa = KERB_WIDTH / rowWidth(a);
    const fb = KERB_WIDTH / rowWidth(b);
    const color = i % 2 === 0 ? 0xff2a3c : 0xffffff;
    g.quad(across(a, 0, 0.07), across(a, fa, 0.07), across(b, fb, 0.07), across(b, 0, 0.07), color);
    g.quad(across(a, 1 - fa, 0.07), across(a, 1, 0.07), across(b, 1, 0.07), across(b, 1 - fb, 0.07), color);
  }
}

/** Brins, cailloux ou congères sur un bas-côté : quelques touches de couleur, tirées du numéro du bloc (aucun hasard partagé). */
function addShoulderMarks(g: Builder, b: Block, rows: Row[], hw: number) {
  const color = SURFACE_MARKS[b.shoulder!];
  for (let k = 0; k < 14; k++) {
    const row = rows[Math.min(rows.length - 1, Math.floor(((k * 7 + b.index * 3) % 14) / 14 * rows.length))]!;
    const width = rowWidth(row);
    const side = k % 2 === 0 ? 0 : 1;
    const off = (hw + 0.6 + ((k * 13 + b.index * 5) % 10) / 10 * (SHOULDER_EDGE - hw - 1.2)) ;
    const t = side === 0 ? 0.5 - off / width : 0.5 + off / width;
    const p = across(row, t, 0.04);
    const s = b.shoulder === "snow" ? 0.9 : 0.35;
    g.tri([p[0] - s, p[1], p[2]], [p[0] + s, p[1], p[2]], [p[0], p[1] + (b.shoulder === "grass" ? 0.5 : 0.12), p[2] + s * 0.4], color);
  }
}

/**
 * Faces de bout (lot 21) : là où un bas-côté s'arrête contre un bloc qui ne porte pas la voiture aussi loin, un mur en travers de la bande,
 * du bord de la route du voisin au rebord de la bande (le même mur que la simulation : `world.ts`).
 */
function addBandEnd(g: Builder, pal: Palette, b: Block, end: 0 | 1, reach: number) {
  const fence = pal.fence;
  for (const side of [1, -1]) {
    if (isCurve(b.kind) && end === 1) {
      const c = curveCenter(b.kind);
      const y = b.y0;
      const p0 = world(b, c.cp, c.r + side * reach, y);
      const p1 = world(b, c.cp, c.r + side * SHOULDER_EDGE, y);
      g.quad(p0, p1, [p1[0], y + WALL_HEIGHT, p1[2]], [p0[0], y + WALL_HEIGHT, p0[2]], fence[0]);
    } else {
      const q = end === 0 ? 0 : CELL;
      const y = blockHeight(b, q);
      const p0 = world(b, CELL / 2 + side * reach, q, y);
      const p1 = world(b, CELL / 2 + side * SHOULDER_EDGE, q, y);
      g.quad(p0, p1, [p1[0], y + WALL_HEIGHT, p1[2]], [p0[0], y + WALL_HEIGHT, p0[2]], fence[0]);
    }
  }
}

/** Étendue de ce qui porte la voiture chez un voisin, à son bout qui touche ce bloc (comme `world.ts`) ; `Infinity` : pas de face. */
function neighborReach(n: Block | undefined, end: 0 | 1): number {
  if (!n || n.open) return Infinity;
  return blockReachAt(n, end);
}

// --- Cuves (lot 18) -----------------------------------------------------------------------------------------------------------

/** Subdivisions d'un côté de cuve : le quart de cercle, puis la paroi verticale (nombre fixe : les tranches successives se raccordent sommet à sommet). */
const CUVE_ARC_SEGMENTS = 6;
const CUVE_WALL_SEGMENTS = 4;
/** Longueur d'une bande de motif le long de la paroi (m). */
const CUVE_BAND = 4;

/**
 * Une tranche de cuve : les points du profil en travers, de la crête de la paroi gauche à celle de la droite, en (écart latéral `lam` positif à gauche,
 * hauteur au-dessus du fond). La paroi de chaque côté a son amplitude (0 : un simple rebord de 1,4 m).
 */
function cuveProfile(W: number, aLeft: number, aRight: number): [number, number][] {
  const side = (a: number, sign: 1 | -1): [number, number][] => {
    const R = cuveRadius(W, a);
    const top = cuveTop(W, a);
    const f = W - R;
    const pts: [number, number][] = [];
    for (let i = CUVE_WALL_SEGMENTS; i >= 0; i--) pts.push([sign * W, R + ((top - R) * i) / CUVE_WALL_SEGMENTS]);
    for (let i = CUVE_ARC_SEGMENTS - 1; i >= 0; i--) {
      const phi = (Math.PI / 2) * (i / CUVE_ARC_SEGMENTS);
      pts.push([sign * (f + R * Math.sin(phi)), R - R * Math.cos(phi)]);
    }
    return pts;
  };
  return [...side(aLeft, 1), ...side(aRight, -1).reverse()];
}

/**
 * Surface d'un bloc de cuve : fond de route à la couleur du revêtement, quarts de cercle et parois en bandes rouges et blanches (damier
 * avec l'avance), crête biseautée, et un remblai derrière chaque paroi jusqu'au sol lointain. Remplace `addRoad` pour ces blocs.
 */
function addCuve(g: Builder, pal: Palette, b: Block, color: number, floorY: number): void {
  const W = b.w0 / 2;
  const curve = isCurve(b.kind);
  const left = curve && turnsLeft(b.kind);
  const { r: Rc } = curveCenter(b.kind);
  const rows = curve ? (curveSize(b.kind) === 1 ? 14 : curveSize(b.kind) === 2 ? 30 : 48) : 24;
  const sections: { pts: V3[]; band: number }[] = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    let amp: (bit: number) => number;
    let at: (lam: number, y: number) => V3;
    let along: number;
    if (curve) {
      const a = (Math.PI / 2) * t;
      amp = (bit) => cuveAmplitude(b, bit, curveCenter(b.kind).cp + (left ? -1 : 1) * Rc * Math.cos(a), Rc * Math.sin(a));
      at = (lam, y) => arcPoint(b, left ? Rc - lam : Rc + lam, a, b.y0 + y);
      along = Rc * a;
    } else {
      const q = CELL * t;
      amp = (bit) => cuveAmplitude(b, bit, CELL / 2, q);
      at = (lam, y) => world(b, CELL / 2 + lam, q, b.y0 + y);
      along = q;
    }
    sections.push({ pts: cuveProfile(W, amp(CUVE_LEFT), amp(CUVE_RIGHT)).map(([lam, y]) => at(lam, y)), band: Math.floor((along + b.index * 7) / CUVE_BAND) });
  }
  for (let i = 0; i < rows; i++) {
    const A = sections[i]!;
    const B = sections[i + 1]!;
    const n = A.pts.length;
    const mid = (n >> 1) - 1; // le segment du fond, entre les deux pieds de paroi
    for (let k = 0; k + 1 < n; k++) {
      const c = k === mid ? color : (k + A.band) % 2 === 0 ? pal.wallA : pal.wallB;
      g.quad(A.pts[k]!, A.pts[k + 1]!, B.pts[k + 1]!, B.pts[k]!, c);
    }
    // Crête : un chapeau qui dépasse vers l'extérieur ; remblai : de la crête au sol lointain.
    for (const k of [0, n - 1]) {
      const a = A.pts[k]!;
      const bb = B.pts[k]!;
      const inner = A.pts[k === 0 ? n - 1 : 0]!; // l'autre crête : la direction vers l'extérieur (la paroi, verticale, ne la donne pas)
      const dx = a[0] - inner[0];
      const dz = a[2] - inner[2];
      const len = Math.hypot(dx, dz) || 1;
      const ox = (dx / len) * 0.6;
      const oz = (dz / len) * 0.6;
      const cap = A.band % 2 === 0 ? pal.wallA : pal.wallB;
      g.quad(a, bb, [bb[0] + ox, bb[1], bb[2] + oz], [a[0] + ox, a[1], a[2] + oz], cap);
      // Remblai : un peu en retrait de la paroi verticale (sinon les deux plans se confondent et scintillent).
      const sx = (ox / 0.6) * 0.15;
      const sz = (oz / 0.6) * 0.15;
      g.quad([a[0] + sx, a[1], a[2] + sz], [bb[0] + sx, bb[1], bb[2] + sz], [bb[0] + sx, floorY, bb[2] + sz], [a[0] + sx, floorY, a[2] + sz], pal.skirt);
    }
  }
}

/** Tirets blancs au centre de la route : ils donnent l'échelle et la sensation de vitesse. */
function addDashes(g: Builder, pal: Palette, b: Block) {
  const w = 0.25;
  if (isCurve(b.kind)) {
    const { r: R } = curveCenter(b.kind);
    const at = (r: number, a: number) => arcPoint(b, r, a, b.y0 + 0.04);
    const n = isWide(b.kind) ? 12 : 4; // un tiret tous les ~6 m
    for (let k = 0; k < n; k++) {
      const a0 = ((k + 0.2) / n) * (Math.PI / 2);
      const a1 = ((k + 0.65) / n) * (Math.PI / 2);
      g.quad(at(R - w, a0), at(R + w, a0), at(R + w, a1), at(R - w, a1), pal.dash);
    }
    return;
  }
  for (let k = 0; k < 4; k++) {
    const q0 = k * 8 + 2;
    const q1 = q0 + 4;
    const y0 = blockHeight(b, q0) + 0.04;
    const y1 = blockHeight(b, q1) + 0.04;
    g.quad(world(b, CELL / 2 - w, q0, y0), world(b, CELL / 2 + w, q0, y0), world(b, CELL / 2 + w, q1, y1), world(b, CELL / 2 - w, q1, y1), pal.dash);
  }
}

function addBoostPad(g: Builder, pal: Palette, b: Block) {
  const y = b.y0 + 0.04;
  const ph = blockPadHalfWidth(b); // la plaque suit la largeur de la route (la moitié)
  const p0 = CELL / 2 - ph;
  const p1 = CELL / 2 + ph;
  const q0 = CELL / 2 - BOOST_HALF_LENGTH;
  const q1 = CELL / 2 + BOOST_HALF_LENGTH;
  g.quad(world(b, p0, q0, y), world(b, p1, q0, y), world(b, p1, q1, y), world(b, p0, q1, y), pal.boost);
  // Deux chevrons dans le sens de la marche.
  for (const dq of [-1.6, 1.4]) {
    const qc = CELL / 2 + dq;
    const h = y + 0.02;
    g.tri(world(b, CELL / 2, qc + 1.3, h), world(b, p1 - 0.6, qc - 0.9, h), world(b, CELL / 2, qc - 0.2, h), pal.boostMark);
    g.tri(world(b, CELL / 2, qc + 1.3, h), world(b, CELL / 2, qc - 0.2, h), world(b, p0 + 0.6, qc - 0.9, h), pal.boostMark);
  }
}

/** Plaque de super turbo : rouge, trois chevrons jaunes (la plaque d'accélération normale en a deux, sur fond jaune). */
function addTurboPad(g: Builder, b: Block) {
  const y = b.y0 + 0.04;
  const ph = blockPadHalfWidth(b);
  const p0 = CELL / 2 - ph;
  const p1 = CELL / 2 + ph;
  const q0 = CELL / 2 - BOOST_HALF_LENGTH;
  const q1 = CELL / 2 + BOOST_HALF_LENGTH;
  g.quad(world(b, p0, q0, y), world(b, p1, q0, y), world(b, p1, q1, y), world(b, p0, q1, y), TURBO_COLOR.base);
  for (const dq of [-2.6, -0.1, 2.4]) {
    const qc = CELL / 2 + dq;
    const h = y + 0.02;
    g.tri(world(b, CELL / 2, qc + 1.4, h), world(b, p1 - 0.5, qc - 0.9, h), world(b, CELL / 2, qc - 0.2, h), TURBO_COLOR.mark);
    g.tri(world(b, CELL / 2, qc + 1.4, h), world(b, CELL / 2, qc - 0.2, h), world(b, p0 + 0.5, qc - 0.9, h), TURBO_COLOR.mark);
  }
}

/** Marques d'un tremplin : chevrons, bande d'alerte au bord, face de chute rayée. */
function addJumpMarks(g: Builder, b: Block) {
  const WARN = [0xffc21a, 0x16181f] as const;
  const y = (q: number) => blockHeight(b, q) + 0.05;
  for (const qc of [2.6, 5.6, 8.6]) {
    for (const s of [-1, 1]) {
      // Un chevron « ^ » vers l'avant : deux bras épais.
      const p0 = CELL / 2;
      const p1 = CELL / 2 + s * 4;
      g.quad(world(b, p0, qc + 1.4, y(qc + 1.4)), world(b, p0, qc + 0.5, y(qc + 0.5)), world(b, p1, qc - 0.9, y(qc - 0.9)), world(b, p1, qc, y(qc)), 0xf4f1e6);
    }
  }
  const cols = Math.round(blockWidth(b, JUMP_LIP)); // une colonne de 1 m par mètre de route
  const q0 = JUMP_LIP - 1.4;
  for (let i = 0; i < cols; i++) {
    const pa = CELL / 2 - cols / 2 + i;
    g.quad(world(b, pa, q0, y(q0) + 0.01), world(b, pa + 1, q0, y(q0) + 0.01), world(b, pa + 1, JUMP_LIP, y(JUMP_LIP) + 0.01), world(b, pa, JUMP_LIP, y(JUMP_LIP) + 0.01), WARN[i % 2]!);
    const top = b.y0 + JUMP_RISE;
    g.quad(world(b, pa, JUMP_LIP, top), world(b, pa + 1, JUMP_LIP, top), world(b, pa + 1, JUMP_LIP + 0.01, b.y0), world(b, pa, JUMP_LIP + 0.01, b.y0), WARN[(i + 1) % 2]!);
  }
}

/** Marques d'une rampe de saut (bloc K) : chevrons sur la pente, bande d'alerte au bord, face de départ rayée. */
function addKickMarks(g: Builder, b: Block) {
  const WARN = [0xffc21a, 0x16181f] as const;
  const y = (q: number) => blockHeight(b, q) + 0.05;
  for (const qc of [KICK_START + 2.2, KICK_START + 5.4, KICK_START + 8.6]) {
    for (const s of [-1, 1]) {
      const p0 = CELL / 2;
      const p1 = CELL / 2 + s * 4;
      g.quad(world(b, p0, qc + 1.4, y(qc + 1.4)), world(b, p0, qc + 0.5, y(qc + 0.5)), world(b, p1, qc - 0.9, y(qc - 0.9)), world(b, p1, qc, y(qc)), 0xf4f1e6);
    }
  }
  const cols = Math.round(blockWidth(b, CELL)); // une colonne de 1 m par mètre de route
  const q0 = CELL - 1.4;
  for (let i = 0; i < cols; i++) {
    const pa = CELL / 2 - cols / 2 + i;
    g.quad(world(b, pa, q0, y(q0) + 0.01), world(b, pa + 1, q0, y(q0) + 0.01), world(b, pa + 1, CELL, y(CELL) + 0.01), world(b, pa, CELL, y(CELL) + 0.01), WARN[i % 2]!);
    // La tranche du bord : une face rayée d'un mètre sous la lèvre, pour qu'on lise « ici, c'est le vide ».
    g.quad(world(b, pa, CELL, y(CELL) - 0.05), world(b, pa + 1, CELL, y(CELL) - 0.05), world(b, pa + 1, CELL + 0.01, y(CELL) - 1.2), world(b, pa, CELL + 0.01, y(CELL) - 1.2), WARN[(i + 1) % 2]!);
  }
}

/** Réception d'un saut : un damier vert et blanc au bord du premier bloc après le vide, et des chevrons vers l'avant. */
function addLandingMarks(g: Builder, b: Block) {
  const y = (q: number) => blockHeight(b, q) + 0.05;
  const cols = Math.round(blockWidth(b, 0));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < 2; j++) {
      const pa = CELL / 2 - cols / 2 + i;
      const qa = j * 1.2;
      g.quad(world(b, pa, qa, y(qa)), world(b, pa + 1, qa, y(qa)), world(b, pa + 1, qa + 1.2, y(qa + 1.2)), world(b, pa, qa + 1.2, y(qa + 1.2)), (i + j) % 2 === 0 ? 0x2fd37b : 0xf4f1e6);
    }
  }
  for (const qc of [6, 10, 14]) {
    for (const s of [-1, 1]) {
      const p0 = CELL / 2;
      const p1 = CELL / 2 + s * 3.2;
      g.quad(world(b, p0, qc + 1.2, y(qc + 1.2)), world(b, p0, qc + 0.4, y(qc + 0.4)), world(b, p1, qc - 0.8, y(qc - 0.8)), world(b, p1, qc, y(qc)), 0x2fd37b);
    }
  }
}

/** Face verticale qui ferme le bout d'un bloc au bord d'un vide : elle va de la route jusqu'au sol (ou sous la dalle). */
function addEndFace(g: Builder, row: Row, floorY: number, color: number, pillars: boolean) {
  const lo = (v: V3) => (pillars ? v[1] - SLAB : floorY);
  g.quad(row.left, row.right, [row.right[0], lo(row.right), row.right[2]], [row.left[0], lo(row.left), row.left[2]], color);
}

/** Piliers sous une route surélevée : un fût central et un chapiteau en T, au milieu du bloc. */
function addPillar(g: Builder, pal: Palette, b: Block, floorY: number) {
  const mid = onBlock(b, 0, 0.5, 0);
  const half = blockHalfWidth(b, CELL / 2);
  const color = shade(pal.skirt, 1.15);
  const top = mid[1] - SLAB;
  const fwd = onBlock(b, 0, 0.56, 0);
  const back = onBlock(b, 0, 0.44, 0);
  const dx = fwd[0] - back[0];
  const dz = fwd[2] - back[2];
  const len = Math.hypot(dx, dz) || 1;
  // Fût : 2,2 m de côté ; chapiteau : en travers de la route, aux deux tiers de sa largeur, sous la dalle.
  g.box(mid[0] - 1.1, floorY, mid[2] - 1.1, mid[0] + 1.1, top - 1.4, mid[2] + 1.1, color);
  const ax = Math.abs(dx / len) > 0.7 ? 1.6 : half * 0.66;
  const az = Math.abs(dx / len) > 0.7 ? half * 0.66 : 1.6;
  g.box(mid[0] - ax, top - 1.4, mid[2] - az, mid[0] + ax, top, mid[2] + az, shade(color, 0.85));
}

/** Bande de moteur coupé : en travers de toute la route, damier sombre et jaune (un avertissement, pas un bonus). */
function addCutStrip(g: Builder, b: Block) {
  const y = b.y0 + 0.04;
  const q0 = CELL / 2 - CUT_HALF_LENGTH;
  const cols = Math.round(blockWidth(b, CELL / 2));
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < 2; j++) {
      const color = (i + j) % 2 === 0 ? CUT_COLOR.base : CUT_COLOR.mark;
      const pa = CELL / 2 - cols / 2 + i;
      const qa = q0 + 2 * j;
      g.quad(world(b, pa, qa, y), world(b, pa + 1, qa, y), world(b, pa + 1, qa + 2, y), world(b, pa, qa + 2, y), color);
    }
  }
}

/**
 * Bornes de la rive et arches de vitesse (lot 15, repris au lot 37) : rien que dans une **portion rapide** (`fastZones`), où elles font lire la vitesse ;
 * ailleurs elles n'avaient aucun rôle. Les bornes se posent sur le chapeau d'un rebord plein (`onRim`), tous les 16 m ; une arche tous les quatre blocs,
 * ses deux pieds descendent jusqu'au sol lointain, de l'autre côté du rebord. Rien sur un bas-côté, une cuve ou une section sans rebords.
 */
function addSpeedMarks(g: Builder, pal: Palette, b: Block, fast: boolean, floorY: number, log?: PoseLog) {
  if (!fast || b.kind === "jump" || b.kind === "gap" || b.cuve) return;
  const cap = pal.wallHeight ?? WALL_HEIGHT;
  const meta = { part: "pied", appui: "rebord", block: b.index, style: "" } as const;
  if (hasCap(b)) {
    for (const t of postFractions(false)) {
      for (const side of [-1, 1] as const) {
        const p = onRim(b, t, side, CHAPEAU / 2, cap);
        placed(log, { ...meta, kind: "poteau", group: log?.group() ?? 0 }, [g], () => g.prism(p[0], p[1], p[2], 0.16, 0.12, 3.4, 4, shade(pal.wallB, 0.95), pal.boostMark, 0.78));
      }
    }
  }
  // Arche : deux piliers et une poutre en travers, haute de 7 m, un bloc sur quatre.
  if (b.index % 4 === 0 && !b.banked) {
    const hw = (b.shoulder ? SHOULDER_EDGE : isCurve(b.kind) ? b.w0 / 2 : blockHalfWidth(b, CELL / 2)) + CHAPEAU + 0.1 + 0.34; // au-delà du bord de la route, ou de la bande
    const l = onBlock(b, hw, 0.5, 0);
    const r = onBlock(b, -hw, 0.5, 0);
    const ahead = onBlock(b, 0, 0.52, 0);
    const behind = onBlock(b, 0, 0.48, 0);
    const len = Math.hypot(ahead[0] - behind[0], ahead[2] - behind[2]) || 1;
    const fwd: [number, number] = [(ahead[0] - behind[0]) / len, (ahead[2] - behind[2]) / len];
    const h = 7.2;
    const group = log?.group() ?? 0;
    for (const e of [l, r]) {
      placed(log, { ...meta, kind: "arche-vitesse", appui: "sol", group }, [g], () => {
        g.prism(e[0], floorY, e[2], 0.34, 0.34, e[1] - floorY, 4, shade(pal.wallB, 0.7), shade(pal.wallB, 0.7), 0.78); // le fût, jusqu'au sol
        g.prism(e[0], e[1], e[2], 0.34, 0.26, h, 4, shade(pal.wallB, 0.85), pal.wallA, 0.78);
      });
    }
    placed(log, { ...meta, kind: "arche-vitesse", part: "surplomb", appui: "sol", group }, [g], () => {
      beam(g, [l[0], 0, l[2]], [r[0], 0, r[2]], fwd, 0.4, l[1] + h - 0.5, l[1] + h + 0.3, pal.wallA);
      beam(g, [l[0], 0, l[2]], [r[0], 0, r[2]], fwd, 0.42, l[1] + h - 0.12, l[1] + h + 0.06, pal.boostMark);
    });
  }
  // Chevrons peints au centre, tous les 8 m, entre les tirets (route droite ou pente, sans effet de piste).
  if (b.surface === "road" && !isCurve(b.kind) && (b.kind === "straight" || b.kind === "down" || b.kind === "up")) {
    const hw = Math.min(3.2, blockHalfWidth(b, CELL / 2) * 0.35);
    for (const qc of [8, 16, 24]) {
      const y = blockHeight(b, qc) + 0.05;
      g.tri(world(b, CELL / 2, qc + 1.5, y), world(b, CELL / 2 + hw, qc - 1, y), world(b, CELL / 2 + hw * 0.55, qc - 1.2, y), pal.dash);
      g.tri(world(b, CELL / 2, qc + 1.5, y), world(b, CELL / 2 + hw * 0.55, qc - 1.2, y), world(b, CELL / 2, qc + 0.1, y), pal.dash);
      g.tri(world(b, CELL / 2, qc + 1.5, y), world(b, CELL / 2, qc + 0.1, y), world(b, CELL / 2 - hw * 0.55, qc - 1.2, y), pal.dash);
      g.tri(world(b, CELL / 2, qc + 1.5, y), world(b, CELL / 2 - hw * 0.55, qc - 1.2, y), world(b, CELL / 2 - hw, qc - 1, y), pal.dash);
    }
  }
}

/** Motif léger d'un revêtement : traces de roues (terre), éclats (glace), brins (herbe). Pas de texture. */
function addSurfaceMarks(g: Builder, b: Block) {
  if (b.surface === "road") return;
  const color = SURFACE_MARKS[b.surface];
  const lift = 0.05;
  if (b.surface === "dirt") {
    for (const lat of [-2.6, 2.6]) {
      for (let k = 0; k < 6; k++) {
        const t0 = (k + 0.1) / 6;
        const t1 = (k + 0.8) / 6;
        g.quad(onBlock(b, lat - 0.3, t0, lift), onBlock(b, lat + 0.3, t0, lift), onBlock(b, lat + 0.3, t1, lift), onBlock(b, lat - 0.3, t1, lift), color);
      }
    }
  } else if (b.surface === "ice") {
    for (let k = 0; k < 5; k++) {
      const t0 = (k + 0.2) / 5;
      const t1 = t0 + 0.06;
      const lat = (k % 2 === 0 ? -1 : 1) * (2.5 + (k % 3));
      g.quad(onBlock(b, lat, t0, lift), onBlock(b, lat + 0.4, t0, lift), onBlock(b, lat + 1.8, t1, lift), onBlock(b, lat + 1.4, t1, lift), color);
    }
  } else {
    for (let k = 0; k < 9; k++) {
      const lat = (((k * 5 + b.index * 3) % 11) - 5) * 1.1;
      const t = (k + 0.5) / 9;
      g.tri(onBlock(b, lat - 0.35, t, lift), onBlock(b, lat + 0.35, t, lift), onBlock(b, lat, t + 0.01, 0.65), color);
    }
  }
}

/** Dégradé du ciel : de l'horizon (couleur du brouillard) au zénith. Fond d'écran de la scène : une seule passe, bien moins chère qu'un dôme. */
export function skyGradient(pal: Palette): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, hex(pal.zenith));
  grad.addColorStop(0.5, hex(mix(pal.zenith, pal.sky, 0.78)));
  grad.addColorStop(0.62, hex(pal.sky)); // l'horizon, un peu sous le milieu de l'écran
  grad.addColorStop(1, hex(pal.sky));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** Ciel : disque de soleil / lune et étoiles pour les nuits (le dégradé est le fond de la scène). */
export function buildSky(pal: Palette, rnd: () => number): Group {
  const group = new Group();
  if (pal.disc !== null) {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const c = new Color(pal.disc);
    const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
    const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
    grad.addColorStop(0, `rgba(${rgb},1)`);
    grad.addColorStop(0.18, `rgba(${rgb},0.95)`);
    grad.addColorStop(0.2, `rgba(${rgb},0.35)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    if (pal.scenery === "pylons") {
      // soleil rétro : bandes horizontales qui s'élargissent vers le bas
      ctx.globalCompositeOperation = "destination-out";
      for (let k = 0; k < 6; k++) ctx.fillRect(0, 66 + k * 9, size, 1 + k * 1.3);
    }
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    const sprite = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: tex, transparent: true, fog: false, depthWrite: false, blending: AdditiveBlending }));
    const night = pal.scenery === "lamps" || pal.scenery === "pylons";
    const scale = night ? 70 : 110;
    sprite.scale.set(scale, scale, 1);
    // Dans une direction fixe du monde ; sa hauteur suit l'heure du thème (lot 21 : haut pour le Stade, bas pour la Campagne).
    sprite.position.set(-90, night ? 170 : 40 + 280 * pal.sunHeight, 380);
    sprite.renderOrder = -2;
    sprite.userData.heavy = true;
    sprite.lookAt(0, 0, 0);
    group.add(sprite);
  }
  if (pal.scenery === "lamps" || pal.scenery === "pylons") {
    const stars: number[] = [];
    for (let i = 0; i < 160; i++) {
      const a = rnd() * Math.PI * 2;
      const e = 0.12 + rnd() * 0.85;
      const r = 400;
      stars.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new F32(stars, 3));
    const points = new Points(g, new PointsMaterial({ color: pal.scenery === "pylons" ? 0xffd9fb : 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, depthWrite: false, transparent: true, opacity: 0.85 }));
    points.renderOrder = -2;
    points.userData.heavy = true;
    group.add(points);
  }
  return group;
}

/**
 * Silhouettes lointaines (lot 23) en trois couches : un anneau de pics (comme avant) ; derrière, une couche plus pâle et plus haute
 * (la brume la fond dans l'horizon) ; devant, des collines basses et sombres (qualité 2). Teintées vers la couleur de l'horizon, sans
 * brouillard dessus : plus c'est loin, plus c'est pâle. Ville : des immeubles à toit plat.
 */
export function buildMountains(pal: Palette, rnd: () => number): Group {
  const group = new Group();
  const horizon = pal.sky;
  const city = pal.scenery === "city";
  const layer = (n: number, rMin: number, rSpan: number, hMin: number, hSpan: number, wMin: number, wSpan: number, fadeTo: number, darker: number, twoPeaks: boolean) => {
    const g = new Builder();
    const body = mix(pal.mountain, horizon, fadeTo);
    const tip = mix(pal.mountainTop, horizon, fadeTo - 0.08);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.12;
      const r = rMin + rnd() * rSpan;
      const h = hMin + rnd() * hSpan;
      const w = wMin + rnd() * wSpan;
      if (city) {
        // Ville (lot 22) : des immeubles lointains à toit plat plutôt que des pics (les tirages restent les mêmes).
        const bw = w * 0.45;
        const bh = h * 1.2;
        const wall = shade(body, (0.9 + rnd() * 0.2) * darker);
        g.box(Math.cos(a) * r - bw, -10, Math.sin(a) * r - bw, Math.cos(a) * r + bw, bh, Math.sin(a) * r + bw, wall);
        g.box(Math.cos(a) * r - bw * 1.05, bh, Math.sin(a) * r - bw * 1.05, Math.cos(a) * r + bw * 1.05, bh + 2, Math.sin(a) * r + bw * 1.05, tip);
        continue;
      }
      g.prism(Math.cos(a) * r, -10, Math.sin(a) * r, w, 0.5, h, 5 + Math.floor(rnd() * 2), shade(body, (0.85 + rnd() * 0.25) * darker), tip, rnd() * 3);
      // un second pic, plus petit, devant
      if (twoPeaks && rnd() < 0.6) g.prism(Math.cos(a + 0.09) * (r - 28), -10, Math.sin(a + 0.09) * (r - 28), w * 0.6, 0.5, h * 0.55, 5, shade(body, (0.95 + rnd() * 0.2) * darker), tip, rnd() * 3);
    }
    const mesh = new Mesh(g.geometry(), new MeshBasicMaterial({ vertexColors: true, fog: false, side: DoubleSide }));
    mesh.renderOrder = -1;
    mesh.userData.heavy = true;
    return mesh;
  };
  // Couche d'origine (mêmes tirages que les lots précédents), puis la lointaine, puis les collines proches.
  group.add(layer(34, 300, 70, 38, 70, 55, 60, 0.38, 1, true));
  group.add(layer(26, 440, 40, 60, 80, 90, 80, 0.66, 1.05, false));
  const hills = layer(22, 205, 40, 9, 16, 38, 40, 0.14, 0.78, false);
  hills.userData.level = 2;
  group.add(hills);
  return group;
}

/** Ce que `trackGeometry` construit : les maillages de la scène, avant d'être posés dans une `Scene`. */
export interface TrackGeometry {
  g: Builder;
  speedG: Builder;
  neonG: Builder;
  props: ReturnType<typeof createProps>;
  decorG: Builder;
  glowG: Builder;
  denseG: Builder;
  denseGlow: Builder;
  signCount: number;
  /** Suite de nombres du circuit : le ciel et les montagnes la poursuivent là où le décor l'a laissée. */
  rnd: () => number;
}

/**
 * Les formes d'un circuit, sans rien de la scène (ni lumière, ni ciel, ni texture : de quoi les mesurer dans un test). `buildTrackScene` les pose
 * ensuite dans une `Scene`. Rien ne dépend de l'ordre des fonctions que celui des tirages au sort de `rnd`, gardé tel qu'il était.
 */
export function trackGeometry(track: Track, paletteName: PaletteName = "desert", options: TrackSceneOptions = {}): TrackGeometry {
  const pal = PALETTE_DEFS[paletteName];
  const floorY = track.voidY - FALL_DEPTH; // le sol lointain : sous la route la plus basse (8 m) ; la voiture qui tombe n'y arrive jamais
  const g = new Builder();
  const speedG = new Builder();
  const neonG = new Builder(); // bordures néon au bord du vide (lot 21, Nuit) : lisibles, jamais masquées par la qualité
  const fast = fastZones(track);
  const decorG = new Builder(); // décor « lourd » : masqué à la qualité basse, avec ses parties lumineuses (`glowG`)
  const glowG = new Builder();
  const roulant = trackWorld(track); // ce que la voiture roule : le décor n'y touche jamais (lot 37)
  const props = createProps(floorY, !!options.aerial || !!options.headless, options.log); // panneaux, arches, portes (lot 23)
  let signCount = 0;
  if (!options.aerial) {
    for (const sign of signsFor(track)) addSign(props, track.blocks[sign.block]!, sign);
    signCount = signsFor(track).length;
  }

  for (const b of track.blocks) {
    const color = b.surface === "road" ? pal.road[b.index % 2]! : SURFACE_COLORS[b.surface][b.index % 2]!;
    // Route sur piliers (lot 17) : très au-dessus du sol lointain, une dalle mince et des piliers, au lieu d'un remblai plein.
    const pillars = Math.min(b.y0, b.y0 + b.rise) - floorY > PILLAR_MIN;
    const style: RoadStyle = { open: b.open, pillars, glow: neonG };
    const prev = track.blocks[b.index - 1];
    const next = track.blocks[b.index + 1];
    let rows: Row[] = [];
    if (b.cuve) {
      addCuve(g, pal, b, color, floorY); // les parois sont dans la surface : ni rebords ni jupe de `addRoad`
    } else if (b.kind === "gap") {
      // Le vide d'un saut : ni route ni rebords. On ne voit que le sol lointain, loin en dessous.
    } else if (isCurve(b.kind)) {
      if (b.shoulder) {
        const band = curveRows(b, SHOULDER_EDGE);
        addRoad(g, pal, band, shoulderColor(pal, b.shoulder, b.index), floorY, true, false, pal.skirt, { pillars, fence: pal.fence });
        addShoulderMarks(g, b, band, b.w0 / 2);
        rows = curveRows(b, b.w0 / 2, 0.03);
        addRoad(g, pal, rows, color, floorY, false, b.surface === "road", pal.skirt, { bare: true });
      } else {
        rows = curveRows(b);
        addRoad(g, pal, rows, color, floorY, true, b.surface === "road", pal.skirt, style);
      }
      // Vibreurs (lot 21) : aux deux bords d'un virage sur route.
      if (b.surface === "road") addKerbs(props.glow, rows);
    } else if (b.kind === "jump") {
      // Rampe jusqu'au bord, face verticale, puis route plate.
      // Le tremplin se lit comme un tremplin : rampe plus claire, flancs clairs (pas un mur brun), chevrons blancs,
      // bande d'alerte jaune et noire au bord, face de chute rayée jaune et noire.
      const swell = b.w0 !== b.w1 ? 8 : 1; // un bloc de transition : rebords en courbe, donc plusieurs tranches
      addRoad(g, pal, straightRows(b, 0, JUMP_LIP, swell, (q) => blockHeight(b, q)), shade(color, 1.18), floorY, true, false, shade(pal.skirt, 1.9), style);
      addJumpMarks(g, b);
      rows = straightRows(b, JUMP_LIP, CELL, swell, () => b.y0);
      addRoad(g, pal, rows, color, floorY, true, b.surface === "road", pal.skirt, style);
    } else if (b.kind === "kick") {
      // Rampe de saut : plate, puis une pente de 0,25 jusqu'au bord ; plus claire, avec ses chevrons et sa bande d'alerte.
      rows = straightRows(b, 0, CELL, 16, (q) => blockHeight(b, q));
      addRoad(g, pal, rows.slice(0, 9), color, floorY, true, b.surface === "road", pal.skirt, style);
      addRoad(g, pal, rows.slice(8), shade(color, 1.18), floorY, true, false, shade(pal.skirt, 1.5), style);
      addKickMarks(g, b);
    } else if (b.shoulder) {
      // Bas-côtés (lot 21) : la bande (jusqu'au rebord du bout) porte la jupe et le rebord ; la route est posée dessus, sans rebord.
      const steps = b.bumpy ? 48 : b.kind === "bump" || b.w0 !== b.w1 ? 16 : 1;
      const band = straightRows(b, 0, CELL, steps, (q) => roadHeight(b, q), SHOULDER_EDGE);
      addRoad(g, pal, band, shoulderColor(pal, b.shoulder, b.index), floorY, true, false, pal.skirt, { pillars, fence: pal.fence });
      addShoulderMarks(g, b, band, b.w0 / 2);
      rows = straightRows(b, 0, CELL, steps, (q) => roadHeight(b, q) + 0.03);
      addRoad(g, pal, rows, color, floorY, false, b.surface === "road", pal.skirt, { bare: true });
    } else {
      // 16 tranches : bosse, ou rebords d'une transition de largeur ; 48 : la tôle ondulée d'une route bosselée (lot 21).
      const steps = b.bumpy ? 48 : b.kind === "bump" || b.w0 !== b.w1 ? 16 : 1;
      rows = straightRows(b, 0, CELL, steps, (q) => roadHeight(b, q));
      addRoad(g, pal, rows, color, floorY, true, b.surface === "road", pal.skirt, style);
    }
    if (b.shoulder) {
      const ein = neighborReach(prev, 1);
      const eout = neighborReach(next, 0);
      if (ein < SHOULDER_EDGE) addBandEnd(g, pal, b, 0, ein);
      if (eout < SHOULDER_EDGE) addBandEnd(g, pal, b, 1, eout);
    }
    // Au bord d'un vide : la route se termine par une face pleine (jusqu'au sol, ou la dalle d'une route sur piliers).
    if (rows.length > 0 && next?.kind === "gap") addEndFace(g, rows[rows.length - 1]!, floorY, shade(pal.skirt, 1.25), pillars);
    if (rows.length > 0 && prev?.kind === "gap") {
      addEndFace(g, rows[0]!, floorY, shade(pal.skirt, 1.25), pillars);
      addLandingMarks(g, b);
    }
    if (pillars && b.kind !== "gap") addPillar(g, pal, b, floorY);
    const effect = b.kind === "boost" || b.kind === "turbo" || b.kind === "cut";
    if (b.surface === "road" && !effect && !b.bumpy && b.kind !== "jump" && b.kind !== "bump" && b.kind !== "kick" && b.kind !== "gap") addDashes(g, pal, b);
    addSurfaceMarks(g, b);
    if (b.kind === "boost") addBoostPad(g, pal, b);
    if (b.kind === "turbo") addTurboPad(g, b);
    if (b.kind === "cut") addCutStrip(g, b);
    // Halo sur les plaques et les bandes de moteur coupé (lot 23) : on les repère de loin, de nuit surtout.
    if (b.kind === "boost" || b.kind === "turbo" || b.kind === "cut") {
      const c = world(b, CELL / 2, CELL / 2, b.y0 + 0.6);
      props.glow.halo(c[0], c[1], c[2], b.kind === "boost" ? pal.boost : b.kind === "turbo" ? TURBO_COLOR.base : CUT_COLOR.mark, b.kind === "turbo" ? 9 : 7);
    }
    if (!options.aerial) {
      addSpeedMarks(speedG, pal, b, fast[b.index] ?? false, floorY, options.log);
      addStreetLamps(speedG, glowG, pal, b, options.log);
    }
    if (b.mark === "checkpoint") addCheckpointGate(props, pal, b);
    if (b.mark === "finish") addFinishArch(props, pal, b);
    if (b.mark === "start") addStartArch(props, pal, b);
  }

  // Bouts fermés : un mur en travers de la route au départ et derrière l'arrivée.
  const first = track.blocks[0]!;
  const last = track.blocks[track.blocks.length - 1]!;
  for (const [b, q] of [[first, 0], [last, CELL]] as const) {
    const y = blockHeight(b, q);
    const hw = blockHalfWidth(b, q);
    const l = world(b, CELL / 2 + hw, q, y);
    const r = world(b, CELL / 2 - hw, q, y);
    g.quad(l, r, [r[0], y + WALL_HEIGHT, r[2]], [l[0], y + WALL_HEIGHT, l[2]], pal.wallA);
  }

  const rnd = seeded(`${track.id}:${paletteName}`);
  const first0 = track.blocks[0]!;
  const near = options.aerial ? options.near : undefined;
  const windowBlocks = near ? track.blocks.slice(near.from, near.to + 1) : [];
  const nearCell = (cx: number, cz: number) => windowBlocks.some((b) => Math.abs(b.cx - cx) <= NEAR_CELLS && Math.abs(b.cz - cz) <= NEAR_CELLS);
  decorG.mute = !!near && !nearCell(first0.cx, first0.cz);
  addGrandstand(decorG, pal, first0, rnd, floorY, roulant, track.id, options.log);
  decorG.mute = false;
  addScenery(decorG, glowG, pal, track, floorY, roulant, rnd, near ? nearCell : undefined, false, options.log, !!options.aerial);
  if (pal.scenery === "city" && !options.aerial) addCityFront(decorG, pal, track, floorY, roulant, near ? (b) => nearCell(b.cx, b.cz) : undefined, options.log);
  // Décor dense (lot 23) : une seconde passe, tirée d'une autre suite de nombres (le décor d'origine ne bouge pas), réservée à la qualité 2.
  const denseG = new Builder();
  const denseGlow = new Builder();
  if (!options.aerial) addScenery(denseG, denseGlow, pal, track, floorY, roulant, seeded(`${track.id}:${paletteName}:dense`), undefined, true, options.log);
  return { g, speedG, neonG, props, decorG, glowG, denseG, denseGlow, signCount, rnd };
}


// --- Accessoires de l'existant (lot 23, déplacés de trackProps.ts) ---

export interface Props {
  solid: Builder;
  glow: Builder;
  curtain: Builder;
  /** Bandeaux de texte (départ, arrivée) : un maillage par bandeau, créés à la volée. */
  banners: Mesh[];
  /** Vue aérienne (miniatures) : pas de bandeaux de texte (une texture de plus par arche pour rien). */
  aerial: boolean;
  /** Relevé de la pose (lot 37) : les tests y lisent ce qui est planté et où ; absent dans le jeu. */
  log?: PoseLog;
  /** Le sol lointain (lot 37) : les pieds des panneaux, des arches et des portes y descendent, jamais dans le vide. */
  floorY: number;
}

export function createProps(floorY: number, aerial = false, log?: PoseLog): Props {
  return { solid: new Builder(), glow: new Builder(), curtain: new Builder(), banners: [], aerial, log, floorY };
}

/** Couleurs de la palette dont les accessoires ont besoin. */
export interface PropColors {
  checkpoint: number;
  finish: number;
  finishDark: number;
  wallA: number;
}

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const unit = (a: V3): V3 => {
  const n = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / n, a[1] / n, a[2] / n];
};

// --- Panneaux ----------------------------------------------------------------------------------------------
/**
 * Plante un panneau : poteau au bord de la route, plaque tournée vers la voiture qui arrive. Le poteau descend jusqu'au sol lointain (lot 37 : il ne
 * flotte plus au-delà du rebord) ; il est planté assez loin du bord pour que la plaque, haute de 2,5 m, ne surplombe jamais la route ni un bas-côté.
 */
export function addSign(p: Props, host: Block, s: SignSpec) {
  const y = blockHeight(host, s.q);
  const pBase = CELL / 2 + s.side * s.offset;
  const base = world(host, pBase, s.q, y);
  const left = unit(sub(world(host, pBase + 1, s.q, y), base)); // vers les p croissants
  const fwd = unit(sub(world(host, pBase, s.q + 1, y), base));
  const pole = 2.6;
  const half = 1.25;
  const style = SIGN_STYLES[signStyleOf(s.kind, s.severity)]!;
  // Poteau (deux petits montants, le panneau est large) : boîtes alignées sur les axes, assez fines pour qu'on n'y voie rien d'oblique.
  const group = p.log?.group() ?? 0;
  const meta = { kind: "panneau", group, block: host.index, style: "" } as const;
  placed(p.log, { ...meta, part: "pied", appui: "sol" }, [p.solid], () => p.solid.box(base[0] - 0.07, p.floorY, base[2] - 0.07, base[0] + 0.07, y + pole + half * 2, base[2] + 0.07, 0x4a4f5c));
  const center: V3 = [base[0], y + pole + half, base[2]];
  const pl: Plane = { c: center, right: [-left[0], 0, -left[2]], up: [0, 1, 0], toward: [-fwd[0], 0, -fwd[2]] };
  placed(p.log, { ...meta, part: "surplomb", appui: "sol" }, [p.glow, p.solid], () => {
    poly(p.glow, pl, rect(-half - 0.1, -half - 0.1, half + 0.1, half + 0.1), -0.03, style.border); // liseré, légèrement en retrait
    poly(p.glow, pl, rect(-half + 0.06, -half + 0.06, half - 0.06, half - 0.06), -0.015, style.plate);
    drawGlyph(p.glow, pl, s.kind, s.severity, s.cuve, 0.02, style.ink);
    // Dos de la plaque : gris, pour qu'elle ne soit pas vue « de l'autre côté » comme un fantôme jaune.
    poly(p.solid, pl, rect(-half - 0.1, -half - 0.1, half + 0.1, half + 0.1), -0.06, 0x5a606e);
  });
}

// --- Bandeaux de texte --------------------------------------------------------------------------------------

function bannerTexture(text: string, colors: { bg: string; fg: string; checker?: [string, string] }): CanvasTexture {
  const w = 512;
  const h = 128;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, w, h);
  if (colors.checker) {
    const n = 16;
    const cs = 16;
    for (let i = 0; i < n * 2; i++) {
      for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 === 0 ? colors.checker[0] : colors.checker[1];
        ctx.fillRect(i * cs, j * cs, cs, cs);
        ctx.fillRect(i * cs, h - (j + 1) * cs, cs, cs);
      }
    }
  }
  ctx.fillStyle = colors.fg;
  ctx.font = "800 64px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, w / 2, h / 2 + 2);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/** Un quadrilatère texturé : coins bas-gauche, bas-droite, haut-droite, haut-gauche (du point de vue de qui le lit). `flip` : texte à l'endroit pour l'autre côté. */
function bannerMesh(tex: CanvasTexture, bl: V3, br: V3, tr: V3, tl: V3): Mesh {
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute([...bl, ...br, ...tr, ...tl], 3));
  geo.setAttribute("uv", new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
  const mesh = new Mesh(geo, new MeshBasicMaterial({ map: tex, side: DoubleSide }));
  mesh.userData.banner = true;
  return mesh;
}

// --- Arches et portes ---------------------------------------------------------------------------------------

/**
 * Demi-écartement (m) des pieds d'une arche ou d'une porte : au-delà du bord de la route, ou de la bande avec des bas-côtés, et du chapeau du
 * rebord (lot 37 : les pieds descendent jusqu'au sol, ils ne se posent ni sur la route ni sur la bande, ni dans le vide).
 */
function postSpan(b: Block, q: number, half: number): number {
  return (b.shoulder ? SHOULDER_EDGE : blockHalfWidth(b, q)) + CHAPEAU + 0.1 + half;
}

/** Arche du départ : deux poteaux, une poutre rouge et blanche portant « DÉPART ». */
export function addStartArch(p: Props, pal: PropColors, b: Block, q = 26) {
  buildArch(p, pal, b, q, "DÉPART", { bg: "#c8202f", fg: "#ffffff" }, pal.wallA, 0xf4f4f4, 9, false);
}

/** Arche d'arrivée : poutre à damier portant « ARRIVÉE », plus haute que les portes de contrôle. */
export function addFinishArch(p: Props, pal: PropColors, b: Block, q = CELL / 2) {
  buildArch(p, pal, b, q, "ARRIVÉE", { bg: "#f4f4f4", fg: "#14161c", checker: ["#14161c", "#f4f4f4"] }, pal.finishDark, pal.finish, 9, true);
}

function buildArch(p: Props, pal: PropColors, b: Block, q: number, text: string, tex: { bg: string; fg: string; checker?: [string, string] }, postA: number, postB: number, h: number, finish: boolean) {
  const y = blockHeight(b, q);
  const span = postSpan(b, q, 0.55);
  const beam = 2.4;
  const meta = { kind: finish ? "arche-arrivee" : "arche-depart", group: p.log?.group() ?? 0, block: b.index, style: "" } as const;
  for (const side of [-1, 1]) {
    const c = world(b, CELL / 2 + side * span, q, y);
    placed(p.log, { ...meta, part: "pied", appui: "sol" }, [p.solid], () => {
      // Le pied descend jusqu'au sol lointain (un fût plein, à la couleur du poteau) ; au-dessus de la route, poteaux rayés : on les repère de loin.
      p.solid.box(c[0] - 0.55, p.floorY, c[2] - 0.55, c[0] + 0.55, y, c[2] + 0.55, shade(postA, 0.8));
      const seg = 1.5;
      for (let k = 0, yy = y; yy < y + h; k++, yy += seg) {
        const top = Math.min(y + h, yy + seg);
        p.solid.box(c[0] - 0.55, yy, c[2] - 0.55, c[0] + 0.55, top, c[2] + 0.55, k % 2 === 0 ? postA : postB);
      }
    });
    p.glow.halo(c[0], y + h + 0.3, c[2], finish ? 0xffffff : 0xff6a5a, 5);
  }
  const l = world(b, CELL / 2 + span, q, y + h);
  const r = world(b, CELL / 2 - span, q, y + h);
  placed(p.log, { ...meta, part: "surplomb", appui: "sol" }, [p.solid], () =>
    p.solid.box(Math.min(l[0], r[0]) - 0.6, y + h - 0.4, Math.min(l[2], r[2]) - 0.6, Math.max(l[0], r[0]) + 0.6, y + h + beam, Math.max(l[2], r[2]) + 0.6, shade(postA, 0.7)),
  );
  // Bandeau de texte sur les deux faces de la poutre (l'avant lit « DÉPART », l'arrière aussi).
  const t = p.aerial ? null : bannerTexture(text, tex);
  const fwd = unit(sub(world(b, CELL / 2, q + 1, y), world(b, CELL / 2, q, y)));
  const off = 0.75;
  const f = (pt: V3, k: number): V3 => [pt[0] + fwd[0] * k, pt[1], pt[2] + fwd[2] * k];
  const lo = y + h - 0.1;
  const hi = y + h + beam - 0.2;
  const L = (yy: number): V3 => [l[0], yy, l[2]];
  const R = (yy: number): V3 => [r[0], yy, r[2]];
  // Face avant (vue par qui arrive) : gauche du conducteur = côté p croissant.
  if (t) {
    p.banners.push(bannerMesh(t, f(L(lo), -off), f(R(lo), -off), f(R(hi), -off), f(L(hi), -off)));
    p.banners.push(bannerMesh(t, f(R(lo), off), f(L(lo), off), f(L(hi), off), f(R(hi), off)));
  }
  // Damier au sol (arrivée) ou trait blanc (départ), sur toute la largeur.
  const hw = blockHalfWidth(b, q);
  if (finish) {
    const cols = Math.round(hw * 2);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < 2; j++) {
        const col = (i + j) % 2 === 0 ? pal.finish : pal.finishDark;
        const p0 = CELL / 2 - hw + i;
        const q0 = q - 1 + j;
        p.solid.quad(world(b, p0, q0, y + 0.04), world(b, p0 + 1, q0, y + 0.04), world(b, p0 + 1, q0 + 1, y + 0.04), world(b, p0, q0 + 1, y + 0.04), col);
      }
    }
  } else {
    p.solid.quad(world(b, CELL / 2 - hw, q - 0.3, y + 0.04), world(b, CELL / 2 + hw, q - 0.3, y + 0.04), world(b, CELL / 2 + hw, q + 0.3, y + 0.04), world(b, CELL / 2 - hw, q + 0.3, y + 0.04), 0xf4f4f4);
  }
}

/** Porte d'un point de contrôle : poteaux à bandes, poutre lumineuse, voile translucide sous la poutre, halo aux deux coins. */
export function addCheckpointGate(p: Props, pal: PropColors, b: Block) {
  const q = CELL / 2;
  const y = blockHeight(b, q);
  const span = postSpan(b, q, 0.5);
  const h = 7.5;
  const color = pal.checkpoint;
  const meta = { kind: "porte", group: p.log?.group() ?? 0, block: b.index, style: "" } as const;
  for (const side of [-1, 1]) {
    const c = world(b, CELL / 2 + side * span, q, y);
    placed(p.log, { ...meta, part: "pied", appui: "sol" }, [p.solid], () => {
      p.solid.box(c[0] - 0.5, p.floorY, c[2] - 0.5, c[0] + 0.5, y, c[2] + 0.5, shade(color, 0.55));
      const seg = 1.25;
      for (let k = 0, yy = y; yy < y + h; k++, yy += seg) p.solid.box(c[0] - 0.5, yy, c[2] - 0.5, c[0] + 0.5, Math.min(y + h, yy + seg), c[2] + 0.5, k % 2 === 0 ? color : 0xf4f4f4);
    });
    p.glow.halo(c[0], y + h, c[2], color, 7);
  }
  const l = world(b, CELL / 2 + span, q, y + h);
  const r = world(b, CELL / 2 - span, q, y + h);
  const x0 = Math.min(l[0], r[0]);
  const x1 = Math.max(l[0], r[0]);
  const z0 = Math.min(l[2], r[2]);
  const z1 = Math.max(l[2], r[2]);
  const top = y + h - 0.9;
  const drop = 1.8; // lot 37 : le voile s'arrête à 4,8 m au-dessus de la route, au-dessus du passage et de la caméra
  placed(p.log, { ...meta, part: "surplomb", appui: "sol" }, [p.solid, p.glow, p.curtain], () => {
    p.solid.box(x0 - 0.5, y + h - 0.9, z0 - 0.5, x1 + 0.5, y + h + 0.3, z1 + 0.5, shade(color, 0.55));
    // Bande lumineuse sur la poutre (sans éclairage : elle s'allume la nuit) et voile translucide qui pend dessous.
    p.glow.box(x0 - 0.52, y + h - 0.55, z0 - 0.52, x1 + 0.52, y + h - 0.2, z1 + 0.52, mix(color, 0xffffff, 0.35));
    p.curtain.quad(world(b, CELL / 2 + span, q, top), world(b, CELL / 2 - span, q, top), world(b, CELL / 2 - span, q, top - drop), world(b, CELL / 2 + span, q, top - drop), color);
  });
  // Bande au sol, plus large et plus claire qu'avant.
  const hw = blockHalfWidth(b, q);
  p.glow.quad(world(b, CELL / 2 - hw, q - 0.5, y + 0.05), world(b, CELL / 2 + hw, q - 0.5, y + 0.05), world(b, CELL / 2 + hw, q + 0.5, y + 0.05), world(b, CELL / 2 - hw, q + 0.5, y + 0.05), mix(color, 0xffffff, 0.25));
}


// --- L'assemblage de l'existant (lot 39, déplacé de socle.ts) ---

/** Demi-largeur (m) de la carte d'ombres autour de la voiture. */
const SHADOW_HALF = 42;
/** Intensité des phares (candelas) : à régler à l'œil (capture de nuit). */
const HEADLIGHT_POWER = 900;
/** Part de la puissance des phares gardée en vue capot. */
const HOOD_HEADLIGHT = 0.1;


export function composerExistant(track: Track, paletteName: PaletteName, options: TrackSceneOptions): TrackScene {
  const pal = PALETTE_DEFS[paletteName];
  const floorY = track.voidY - FALL_DEPTH; // le sol lointain : sous la route la plus basse (8 m) ; la voiture qui tombe n'y arrive jamais
  const look = LOOKS[paletteName];
  const { g, speedG, neonG, props, decorG, glowG, denseG, denseGlow, signCount, rnd } = trackGeometry(track, paletteName, options);

  const sky = new Color(pal.sky);
  const scene = new Scene();
  if (!options.aerial) {
    scene.background = skyGradient(pal);
    // Brume (lot 23) : sa densité est un trait du thème (voile de ville, air limpide du col, jour blanc de la banquise).
    scene.fog = new Fog(sky, pal.fogNear / look.haze, pal.fogFar / look.haze);
  }
  // Lumière : hémisphérique (ciel au-dessus, sol en dessous : les faces hautes sont plus claires que les flancs) + soleil.
  // Miniatures des thèmes de nuit : lues en petit, elles doivent rester lisibles (le jeu, lui, garde sa nuit).
  const lift = options.aerial && new Color(pal.floorA).getHSL({ h: 0, s: 0, l: 0 }).l < 0.25 ? 2.2 : 1;
  scene.add(new HemisphereLight(mix(pal.ambient[0], pal.zenith, 0.35), new Color(pal.floorB).getHex(), pal.ambient[1] * 0.45 * lift));
  scene.add(new AmbientLight(pal.ambient[0], pal.ambient[1] * 0.12 * lift));
  const sun = new DirectionalLight(pal.sun[0], pal.sun[1] * 0.85 * (lift > 1 ? 1.4 : 1));
  // Soleil (lot 21) : plus il est haut, plus la lumière vient d'en haut (ombres courtes) ; bas, elle rase les flancs.
  sun.position.set(40 * (1.2 - pal.sunHeight) * 1.4, 30 + 110 * pal.sunHeight, -30 * (1.2 - pal.sunHeight) * 1.4);
  const sunOffset = sun.position.clone().normalize().multiplyScalar(150);
  scene.add(sun, sun.target);
  // Ombres portées (lot 23, qualité ≥ 1) : une carte d'ombres qui suit la voiture (±SHADOW_HALF m) ; voir `setQuality`.
  sun.shadow.camera.left = -SHADOW_HALF;
  sun.shadow.camera.right = SHADOW_HALF;
  sun.shadow.camera.top = SHADOW_HALF;
  sun.shadow.camera.bottom = -SHADOW_HALF;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 320;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.06;
  sun.shadow.intensity = look.shadow;
  // Phares (lot 23) : un projecteur devant la voiture sur les thèmes sombres ; intensité 0 le jour (la lampe existe toujours : pas de recompilation).
  const head = new SpotLight(0xfff1d0, 0, 110, 0.62, 0.8, 1.2);
  scene.add(head, head.target);

  const mat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, side: DoubleSide });
  const roadMesh = new Mesh(g.geometry(), mat);
  roadMesh.receiveShadow = true;
  scene.add(roadMesh);
  const decorMesh = new Mesh(decorG.geometry(), mat);
  const glowMesh = new Mesh(glowG.geometry(), new MeshBasicMaterial({ vertexColors: true }));
  const speedMesh = new Mesh(speedG.geometry(), mat);
  const denseMesh = new Mesh(denseG.geometry(), mat);
  const denseGlowMesh = new Mesh(denseGlow.geometry(), new MeshBasicMaterial({ vertexColors: true }));
  decorMesh.userData.heavy = glowMesh.userData.heavy = speedMesh.userData.heavy = true;
  denseMesh.userData.level = denseGlowMesh.userData.level = 2;
  decorMesh.receiveShadow = denseMesh.receiveShadow = true;
  // Le décor reçoit les ombres mais n'en projette pas : le dessiner une seconde fois dans la carte d'ombres coûtait +6 à +12 ms par image
  // (processeur ×4, Ville et Nuit en qualité 2) pour des ombres lointaines que personne ne regarde ; la voiture et les accessoires en projettent.
  scene.add(decorMesh, glowMesh, speedMesh, denseMesh, denseGlowMesh);
  if (neonG.pos.length > 0) scene.add(new Mesh(neonG.geometry(), new MeshBasicMaterial({ vertexColors: true })));

  // Accessoires (lot 23) : panneaux, arches, portes. Toujours visibles (c'est de la lisibilité, pas du décor).
  const solidMesh = new Mesh(props.solid.geometry(), mat);
  solidMesh.castShadow = solidMesh.receiveShadow = true;
  scene.add(solidMesh, new Mesh(props.glow.geometry(), new MeshBasicMaterial({ vertexColors: true, side: DoubleSide })));
  if (props.curtain.pos.length > 0) {
    const curtain = new Mesh(props.curtain.geometry(), new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.2, side: DoubleSide, depthWrite: false, blending: AdditiveBlending }));
    curtain.renderOrder = 4;
    scene.add(curtain);
  }
  for (const banner of props.banners) scene.add(banner);

  // Halos (lot 23) : néons, turbos, lampadaires, portes. Un seul `Points` additif ; qualité ≥ 1.
  const halos = options.aerial ? null : buildHalos([...g.halos, ...glowG.halos, ...neonG.halos, ...denseGlow.halos, ...props.glow.halos], look.halo);
  if (halos) scene.add(halos.points);

  // Ciel et silhouettes lointaines suivent la caméra (donc la voiture) : toujours à l'horizon.
  const backdrop = new Group();
  if (!options.aerial) backdrop.add(buildSky(pal, rnd), buildMountains(pal, rnd));
  scene.add(backdrop);

  const size = 1200;
  const tile = 8;
  const floor = new Mesh(
    new PlaneGeometry(size, size),
    new MeshStandardMaterial({ map: checkerTexture(pal.floorA, pal.floorB, size / (2 * tile)), flatShading: true }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  floor.receiveShadow = true;
  scene.add(floor);

  let shadowSize = 0;
  const setQuality = (level: 0 | 1 | 2, shadows = true) => {
    currentLevel = level;
    scene.traverse((o) => {
      // Seuls les objets marqués (`level`, ou `heavy` = niveau 1) sont touchés : les effets, la voiture et le fantôme gèrent leur visibilité eux-mêmes.
      const min = (o.userData.level as number | undefined) ?? (o.userData.heavy ? 1 : undefined);
      if (min !== undefined) o.visible = level >= min;
      const casts = o.userData.casts as number | undefined;
      if (casts !== undefined) o.castShadow = level >= casts;
    });
    // Ombres : carte de 512 (qualité 1) ou 1024 (qualité 2) ; coupées à la qualité 0 (reste l'ombre douce posée sous la voiture).
    const want = options.aerial || !shadows ? 0 : level === 2 ? 1024 : level === 1 ? 512 : 0; // `shadows` : le réglage « ombres » du joueur (lot 29)
    if (want !== shadowSize) {
      shadowSize = want;
      sun.castShadow = want > 0;
      if (want > 0) {
        sun.shadow.mapSize.set(want, want);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
    }
    head.visible = level >= 1 && look.headlights > 0;
    head.intensity = head.visible ? HEADLIGHT_POWER * look.headlights : 0;
  };
  let currentLevel: 0 | 1 | 2 = 2;
  setQuality(2);

  return {
    scene,
    look,
    dispose: () => {
      // Cartes d'ombres des lumières (le Salon change de scène toutes les dix minutes : rien ne doit s'accumuler côté carte graphique).
      scene.traverse((o) => ((o as { shadow?: { map?: { dispose(): void } | null } }).shadow?.map?.dispose()));
      disposeScene(scene);
    },
    setQuality,
    setLite(on) {
      setQuality(on ? 0 : 2);
    },
    setView(heightPx, fovDeg) {
      halos?.setView(heightPx, fovDeg);
    },
    stats() {
      let hills = false;
      backdrop.traverse((o) => {
        if (o.userData.level === 2 && o.visible) hills = true;
      });
      const fog = scene.fog as Fog | null;
      return { quality: currentLevel, shadowMap: sun.castShadow ? shadowSize : 0, headlights: head.visible ? head.intensity : 0, halos: { count: halos ? halos.points.geometry.getAttribute("position").count : 0, visible: !!halos?.points.visible }, denseDecor: denseMesh.visible, hills, signs: signCount, fog: fog ? { near: fog.near, far: fog.far } : null };
    },
    followGround(x, z) {
      backdrop.position.set(x, floorY, z);
      floor.position.x = Math.round(x / (2 * tile)) * 2 * tile;
      floor.position.z = Math.round(z / (2 * tile)) * 2 * tile;
    },
    followCar(x, y, z, yaw, hood = false, phare) {
      // Ombres : la fenêtre de la carte suit la voiture (pas d'un mètre : les bords ne scintillent pas).
      const tx = Math.round(x);
      const ty = Math.round(y);
      const tz = Math.round(z);
      sun.target.position.set(tx, ty, tz);
      sun.position.set(tx + sunOffset.x, ty + sunOffset.y, tz + sunOffset.z);
      if (head.visible) {
        const s = Math.sin(yaw);
        const c = Math.cos(yaw);
        head.position.set(x + s * (phare?.z ?? 1.2), y + (phare?.y ?? 0.75), z + c * (phare?.z ?? 1.2));
        head.target.position.set(x + s * 24, y - 0.4, z + c * 24);
        head.intensity = HEADLIGHT_POWER * look.headlights * (hood ? HOOD_HEADLIGHT : 1);
      }
    },
  };
}


brancherComposeur("existant", composerExistant);
