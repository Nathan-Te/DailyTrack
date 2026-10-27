import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Group, Line, LineDashedMaterial, Mesh, MeshBasicMaterial, Vector3 } from "three";
import { LASER_THICKNESS, UNITS_PER_TILE, laserBarAt, sectionClock, type AttemptState, type Level } from "@cdj/jump-sim";
import { laserBarLook, laserGlow, laserLook } from "./announce";
import type { Art } from "./artKit";
import {
  AIM_GROW,
  AIM_OPACITY,
  GUIDE_OPACITY,
  HALO_GROW,
  HALO_OPACITY,
  LASER_LOOK,
  barGlow,
  barOrbRadius,
  barTrack,
  buildAimArt,
  buildEmitterArt,
  buildFlashArt,
  buildHaloArt,
  buildLensArt,
  buildOrbArt,
  buildRayArt,
  coreColor,
  lensColor,
  orbLook,
  rayLayout,
} from "./laser";

// Les lasers (lot 25), **affichage seul** : le rayon allumé (rouge des dangers, cœur clair, exactement la bande mortelle), la visée neutre qui s'intensifie pendant les 0,5 s qui
// précèdent l'allumage, les émetteurs du néon (museau et lentille posés sur les tuiles pleines qui bornent un rayon fixe, ou à chaque bout d'une barre coulissante) et le trajet
// d'une barre en pointillés neutres. L'état vient de la simulation (`sectionClock`, `laserLook`, `laserBarAt`) : jamais recalculé à part. Aucune secousse de caméra.
//   - **Carnage** (lot 17) : élément à horloge, donc estompé à `fade` (35 %) ; ses pièces **ne se recouvrent pas** (bandes du rayon, boîtier, lentille), opaques et sans mélange tant
//     qu'on n'estompe pas (la visée et le trajet sont déjà translucides).

const T = UNITS_PER_TILE;
const RAIL_OPACITY = 0.6;
const DASH = 0.22;
/** Profondeurs : le boîtier au-dessus des tuiles, la visée sous le rayon, le rayon sous le personnage (z 0,2). */
const Z_EMITTER = 0.06;
const Z_AIM = 0.125;
const Z_RAY = 0.13;
/** L'aura et l'éclair, additifs, derrière le rayon (le rayon opaque les masque : aucune surcharge sur la bande mortelle). */
const Z_HALO = 0.12;
const Z_ORB = 0.065;
const Z_RAIL = 0.011;

export interface LaserStats {
  /** Pour chaque laser fixe (ordre de `level.lasers`) : le rayon rouge est-il dessiné, l'annonce (0 à 1), l'opacité du rayon rouge et celle de la visée (0 : cachée). */
  on: boolean[];
  warn: number[];
  rayOpacity: number[];
  aimOpacity: number[];
  /** Pour chaque barre (ordre de `level.laserBars`) : où elle est dessinée (coin haut-gauche de sa première tuile, tuiles, y vers le bas), sa vitesse en part de sa pointe, son sens, la lueur de ses lentilles. */
  barX: number[];
  barY: number[];
  barSpeed: number[];
  barDir: number[];
  barGlow: number[];
  /** Pour chaque laser fixe puis chaque barre : la lueur des lentilles (0 à 1). */
  glow: number[];
  /** Pour chaque laser fixe : l'éclair de l'allumage et la retombée de l'extinction (0 à 1), l'opacité du fil qui montre le trajet éteint ; l'épaisseur de la visée (× l'épaisseur de base). */
  flash: number[];
  cool: number[];
  guideOpacity: number[];
  aimScale: number[];
  /** Pour chaque laser fixe puis chaque barre : le rayon (tuiles) de la lueur posée sur ses émetteurs (0 : cachée). */
  orb: number[];
  /** L'opacité dessinée (1 : normale ; 0,35 dans le carnage). */
  opacity: number;
}

/** Un laser posé : son groupe, son rayon rouge, sa visée, ses lentilles. */
export interface LaserUnit {
  group: Group;
  ray: Group;
  /** La visée (neutre) ; absente d'une barre, toujours allumée. */
  aim: Mesh | null;
  lenses: Mesh[];
  lensMat: MeshBasicMaterial;
  /** L'aura additive du rayon allumé (toujours pour une barre), l'éclair de l'allumage et le fil du trajet éteint (laser fixe seulement), les lueurs des deux émetteurs. */
  halo: Mesh;
  flash: Mesh | null;
  guide: Mesh | null;
  orbs: Mesh[];
  orbMat: MeshBasicMaterial;
}

export interface LaserArt {
  readonly stats: LaserStats;
  /** Les lasers fixes puis les barres, dans l'ordre de `level.lasers` puis `level.laserBars` (pour les tests et le débogage). */
  readonly units: readonly LaserUnit[];
  update(prev: Readonly<AttemptState>, state: Readonly<AttemptState>, alpha: number, fade: number): void;
}

const geometryOf = (art: Art): BufferGeometry => {
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(art.pos, 3));
  g.setAttribute("color", new Float32BufferAttribute(art.col, 3));
  g.setIndex(art.idx);
  return g;
};

/** Les lasers d'un niveau ; `null` s'il n'en a pas. `colors.hazard` : le rouge du thème. */
export function createLaserArt(world: Group, level: Level, colors: { hazard: number }): LaserArt | null {
  if (level.lasers.length === 0 && level.laserBars.length === 0) return null;
  const rayMat = new MeshBasicMaterial({ vertexColors: true });
  const emitterMat = new MeshBasicMaterial({ vertexColors: true });
  const solidMats = [rayMat, emitterMat];
  // L'aura, l'éclair et les lueurs sont additifs (le noir n'ajoute rien) : toujours « transparents » pour le moteur, leur opacité suit l'estompage du carnage.
  const additive = (opacity: number): MeshBasicMaterial => new MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, blending: AdditiveBlending, opacity });
  const haloMat = additive(HALO_OPACITY);
  const guideMat = new MeshBasicMaterial({ color: LASER_LOOK.aim, transparent: true, opacity: GUIDE_OPACITY, depthWrite: false });
  const flashMats: MeshBasicMaterial[] = [];
  const orbMats: MeshBasicMaterial[] = [];
  const haloGeometries = new Map<number, BufferGeometry>();
  const flashGeometries = new Map<number, BufferGeometry>();
  const orbGeometry = geometryOf(buildOrbArt());
  const emitterGeometry = geometryOf(buildEmitterArt());
  const lensGeometry = geometryOf(buildLensArt());
  const lensMats: MeshBasicMaterial[] = [];
  // Un laser (fixe ou barre) : le rayon, la visée et deux émetteurs, dans le repère de sa première tuile.
  const unit = (axis: "h" | "v", length: number, withAim: boolean): LaserUnit => {
    const lay = rayLayout(axis, length);
    const group = new Group();
    const ray = new Group();
    ray.position.set(lay.ray.x, lay.ray.y, Z_RAY);
    ray.rotation.z = lay.ray.rotation;
    ray.add(new Mesh(geometryOf(buildRayArt(length, colors.hazard)), rayMat));
    const haloGroup = new Group();
    haloGroup.position.set(lay.ray.x, lay.ray.y, Z_HALO);
    haloGroup.rotation.z = lay.ray.rotation;
    let haloGeometry = haloGeometries.get(length);
    if (!haloGeometry) haloGeometries.set(length, (haloGeometry = geometryOf(buildHaloArt(length, colors.hazard))));
    const halo = new Mesh(haloGeometry, haloMat);
    halo.visible = !withAim;
    haloGroup.add(halo);
    let flash: Mesh | null = null;
    if (withAim) {
      let flashGeometry = flashGeometries.get(length);
      if (!flashGeometry) flashGeometries.set(length, (flashGeometry = geometryOf(buildFlashArt(length))));
      const flashMat = additive(0);
      flashMats.push(flashMat);
      flash = new Mesh(flashGeometry, flashMat);
      flash.position.z = 0.001;
      flash.visible = false;
      haloGroup.add(flash);
    }
    const aimGroup = new Group();
    aimGroup.position.set(lay.ray.x, lay.ray.y, Z_AIM);
    aimGroup.rotation.z = lay.ray.rotation;
    // Une visée par laser fixe, avec son propre matériau (son opacité est celle de son annonce) ; une barre est toujours allumée, elle n'en a pas.
    let aim: Mesh | null = null;
    let guide: Mesh | null = null;
    if (withAim) {
      guide = new Mesh(geometryOf(buildAimArt(length)), guideMat);
      guide.position.z = -0.001;
      aimGroup.add(guide);
      aim = new Mesh(geometryOf(buildAimArt(length)), new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0 }));
      aim.visible = false;
      aimGroup.add(aim);
    }
    // La lentille a son propre matériau : sa couleur suit la lueur.
    const lensMat = new MeshBasicMaterial({ color: lensColor(0) });
    lensMats.push(lensMat);
    const orbMat = additive(1);
    orbMat.color.setHex(0xffffff);
    orbMats.push(orbMat);
    const orbs: Mesh[] = [];
    const lenses: Mesh[] = [];
    for (const e of lay.emitters) {
      const pod = new Group();
      pod.position.set(e.x, e.y, Z_EMITTER);
      pod.rotation.z = e.rotation;
      const lens = new Mesh(lensGeometry, lensMat);
      lens.position.z = 0.001;
      lenses.push(lens);
      const orb = new Mesh(orbGeometry, orbMat);
      orb.position.z = Z_ORB - Z_EMITTER;
      orb.visible = false;
      orbs.push(orb);
      pod.add(new Mesh(emitterGeometry, emitterMat), lens, orb);
      group.add(pod);
    }
    group.add(haloGroup, ray, aimGroup);
    world.add(group);
    return { group, ray, aim, lenses, lensMat, halo, flash, guide, orbs, orbMat };
  };
  const nF = level.lasers.length;
  const nB = level.laserBars.length;
  const stats: LaserStats = {
    on: Array(nF).fill(false),
    warn: Array(nF).fill(0),
    rayOpacity: Array(nF).fill(0),
    aimOpacity: Array(nF).fill(0),
    barX: level.laserBars.map((b) => b.a.col),
    barY: level.laserBars.map((b) => b.a.row),
    barSpeed: Array(nB).fill(0),
    barDir: Array(nB).fill(0),
    barGlow: Array(nB).fill(0),
    glow: Array(nF + nB).fill(0),
    flash: Array(nF).fill(0),
    cool: Array(nF).fill(0),
    guideOpacity: Array(nF).fill(0),
    aimScale: Array(nF).fill(1),
    orb: Array(nF + nB).fill(0),
    opacity: 1,
  };
  const fixed = level.lasers.map((l) => {
    const u = unit(l.axis, l.length, true);
    u.group.position.set(l.col, -l.row, 0);
    u.ray.visible = false;
    return u;
  });
  const bars = level.laserBars.map((b) => unit(b.axis, b.length, false));
  // Le trajet d'une barre : deux rails et l'empreinte de chaque extrémité, en deux pointillés qui alternent (crème et encre).
  const lineMats = [
    new LineDashedMaterial({ color: LASER_LOOK.rail, dashSize: DASH, gapSize: DASH, transparent: true, opacity: RAIL_OPACITY }),
    new LineDashedMaterial({ color: LASER_LOOK.railInk, dashSize: DASH, gapSize: DASH, transparent: true, opacity: RAIL_OPACITY }),
  ];
  const dashed = (pts: readonly [number, number][]) => {
    lineMats.forEach((mat, k) => {
      const line = new Line(new BufferGeometry().setFromPoints(pts.map(([x, y]) => new Vector3(x, y, Z_RAIL))), mat);
      line.computeLineDistances();
      if (k === 1) {
        const dist = line.geometry.getAttribute("lineDistance");
        for (let i = 0; i < dist.count; i++) dist.setX(i, dist.getX(i) + DASH);
      }
      world.add(line);
    });
  };
  for (const b of level.laserBars) {
    const track = barTrack(b);
    for (const r of [...track.rails, ...track.prints]) dashed(r);
  }
  let fade = 1;
  return {
    stats,
    units: [...fixed, ...bars],
    update(prev, state, alpha, nextFade) {
      const v = Math.max(0, Math.min(1, nextFade));
      if (v !== fade) {
        fade = v;
        for (const m of solidMats) {
          // Opaque et sans mélange tant qu'on n'estompe pas : le dessin d'une partie ordinaire est celui de toujours.
          m.transparent = v < 1;
          m.opacity = v;
        }
        for (const m of lensMats) {
          m.transparent = v < 1;
          m.opacity = v;
        }
        haloMat.opacity = HALO_OPACITY * v;
        guideMat.opacity = GUIDE_OPACITY * v;
        orbMats.forEach((m) => (m.opacity = v));
        lineMats[0]!.opacity = lineMats[1]!.opacity = RAIL_OPACITY * v;
        stats.opacity = v;
      }
      level.lasers.forEach((l, i) => {
        const u = fixed[i]!;
        const look = laserLook(l, sectionClock(level, state.sections, state.time, l.section));
        u.ray.visible = look.on;
        // La visée : un fin rayon neutre dont l'opacité croît avec l'annonce, cachée tant qu'elle vaut 0 et dès que le rayon rouge est allumé.
        const aim = look.on ? 0 : look.warn * AIM_OPACITY;
        u.aim!.visible = aim > 0;
        stats.on[i] = look.on;
        stats.warn[i] = look.warn;
        stats.rayOpacity[i] = look.on ? v : 0;
        stats.aimOpacity[i] = aim * v;
        (u.aim!.material as MeshBasicMaterial).opacity = aim * v;
        const glow = look.on ? 1 : look.warn;
        stats.glow[i] = glow;
        u.lensMat.color.setHex(lensColor(glow));
        // L'allumage et l'extinction : l'aura gonfle et un éclair blanc retombe à l'allumage ; la lueur des émetteurs se charge avec la visée, explose, puis retombe. Le fil discret montre le trajet éteint.
        const g = laserGlow(l, sectionClock(level, state.sections, state.time, l.section));
        u.halo.visible = look.on;
        u.halo.scale.y = 1 + HALO_GROW * g.flash;
        u.flash!.visible = g.flash > 0;
        (u.flash!.material as MeshBasicMaterial).opacity = g.flash * v;
        u.guide!.visible = !look.on;
        u.aim!.scale.y = 1 + AIM_GROW * look.warn;
        const orb = orbLook(look.on, look.warn, g.flash, g.cool);
        u.orbMat.color.setHex(orb.hot ? coreColor(colors.hazard) : LASER_LOOK.lens);
        for (const m of u.orbs) {
          m.visible = orb.radius > 0;
          m.scale.set(orb.radius, orb.radius, 1);
        }
        stats.flash[i] = g.flash;
        stats.cool[i] = g.cool;
        stats.guideOpacity[i] = look.on ? 0 : GUIDE_OPACITY * v;
        stats.aimScale[i] = u.aim!.scale.y;
        stats.orb[i] = orb.radius;
      });
      level.laserBars.forEach((b, i) => {
        const u = bars[i]!;
        const phase = sectionClock(level, state.sections, state.time, b.section);
        const pa = laserBarAt(level, prev.sections, prev.time, i);
        const pb = laserBarAt(level, state.sections, state.time, i);
        // Pas d'interpolation à travers un saut de position (la boîte mortelle garde la même taille : x, y de son coin).
        const far = Math.abs(pb.x - pa.x) + Math.abs(pb.y - pa.y) > T;
        const x = (far ? pb.x : pa.x + (pb.x - pa.x) * alpha) / T;
        const y = (far ? pb.y : pa.y + (pb.y - pa.y) * alpha) / T;
        // `laserBarAt` rend la boîte mortelle : on en retire le décalage qui centre la bande dans sa tuile pour retrouver le coin de la première tuile du rayon.
        const gap = (T - LASER_THICKNESS) / 2 / T;
        const cx = b.axis === "v" ? x - gap : x;
        const cy = b.axis === "h" ? y - gap : y;
        u.group.position.set(cx, -cy, 0);
        stats.barX[i] = cx;
        stats.barY[i] = cy;
        const look = laserBarLook(b, phase);
        stats.barSpeed[i] = look.speed;
        stats.barDir[i] = look.dir;
        const g = barGlow(look.speed);
        stats.barGlow[i] = g;
        stats.glow[nF + i] = g;
        u.lensMat.color.setHex(lensColor(g));
        const r = barOrbRadius(g);
        u.orbMat.color.setHex(coreColor(colors.hazard));
        for (const m of u.orbs) {
          m.visible = true;
          m.scale.set(r, r, 1);
        }
        stats.orb[nF + i] = r;
      });
    },
  };
}
