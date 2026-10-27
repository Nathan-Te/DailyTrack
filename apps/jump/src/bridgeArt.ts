import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";
import type { AttemptState, Level } from "@cdj/jump-sim";
import { BRIDGE_LOOK, bridgeTileLooks, switchLook, type BridgeTileLook } from "./bridge";

// Les ponts à interrupteur (lot 26), **affichage seul** : un pont éteint n'est qu'un contour pointillé discret ; allumé, chaque tuile est une face lumineuse cernée d'un liseré clair, avec un trait
// de crête ; pendant les 0,4 s qui précèdent son extinction elle se vide comme une jauge (`bridge.ts`, `announce.ts`). L'interrupteur est une plaque cerclée posée sur son sol, qui s'enfonce
// quand le personnage s'y pose et qui brille quand le pont est allumé. L'état vient de `AttemptState` (jamais recalculé à part). Aucune secousse de caméra. **Carnage** (lot 17) : le pont est
// dessiné allumé, à 35 % d'opacité (`fade` < 1). Un groupe par tuile, des géométries partagées, construits une fois ; rien n'est créé en jeu.

const FACE = 0.92;
const FRAME = 0.96;
const THIN = 0.05;
const THICK = 0.14;
const DASHES = 5;
const CREST = 0.07;
const LEVEL_LINE = 0.05;
/** Contour pointillé du pont éteint : opacité de repos. */
const DOTTED = 0.45;
/** Plaque de l'interrupteur : largeur (tuiles), hauteur dépassant le sol quand elle est relevée, et de combien elle s'enfonce. */
const PLATE_W = 0.86;
const PLATE_H = 0.26;
const PLATE_RAISED = 0.14;
const PLATE_SUNK = 0.1;

export interface BridgeStats {
  /** Tuiles de pont dessinées, pleines (allumées), pointillées (éteintes), en attente de la sortie du personnage, à la dernière image. */
  tiles: number;
  solid: number;
  dotted: number;
  waiting: number;
  /** Tuiles dont la jauge se vide (pleines, jauge sous 1), et la hauteur de face dessinée de chaque tuile (0 vide … 1 pleine ; ordre de `Level.bridges` puis de leurs tuiles). */
  draining: number;
  fills: number[];
  /** Par interrupteur : enfoncé ? (0 : relevé, 1 : enfoncé), de combien la plaque est descendue (tuiles), et brille-t-elle (pont allumé) ? */
  pressed: number[];
  plateDrop: number[];
  plateLit: boolean[];
  /** L'opacité dessinée (1 : normale ; 0,35 dans le carnage). */
  opacity: number;
}

export interface BridgeArt {
  readonly stats: BridgeStats;
  update(state: Readonly<AttemptState>, fade: number, seconds: number, animate: boolean): void;
}

function frameGeometry(size: number, t: number): BufferGeometry {
  const h = size / 2;
  const i = h - t;
  const rects: [number, number, number, number][] = [
    [-h, h - t, h, h],
    [-h, -h, h, -h + t],
    [-h, -i, -i, i],
    [i, -i, h, i],
  ];
  const pos: number[] = [];
  for (const [x0, y0, x1, y1] of rects) pos.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0);
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  return g;
}

/** Cadre pointillé : `DASHES` tirets par côté, autant de vides moins un. */
function dashedFrameGeometry(size: number, t: number): BufferGeometry {
  const h = size / 2;
  const part = size / (2 * DASHES - 1);
  const pos: number[] = [];
  const rect = (x0: number, y0: number, x1: number, y1: number) => pos.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0);
  for (let i = 0; i < DASHES; i++) {
    const a = -h + 2 * i * part;
    const b = a + part;
    rect(a, h - t, b, h);
    rect(a, -h, b, -h + t);
    rect(-h, a, -h + t, b);
    rect(h - t, a, h, b);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  return g;
}

/** Les ponts d'un niveau ; `null` s'il n'en a pas. */
export function createBridgeArt(world: Group, level: Level): BridgeArt | null {
  if (level.bridges.length === 0) return null;
  const thin = frameGeometry(FRAME, THIN);
  const thick = frameGeometry(FRAME, THICK);
  const dashed = dashedFrameGeometry(FRAME, THIN);
  // La face part du bas de la tuile : sa hauteur dessinée est le niveau de la jauge (comme les blocs clignotants).
  const faceGeo = new PlaneGeometry(FACE, FACE).translate(0, FACE / 2, 0);
  const crestGeo = new PlaneGeometry(FACE, CREST);
  const lineGeo = new PlaneGeometry(FACE, LEVEL_LINE);
  const cells = level.bridges.flatMap((b) => b.tiles);
  const tiles = cells.map((c) => {
    const g = new Group();
    g.position.set(c.col + 0.5, -c.row - 0.5, 0.03);
    const faceMat = new MeshBasicMaterial({ color: BRIDGE_LOOK.fill, transparent: true, side: DoubleSide });
    const face = new Mesh(faceGeo, faceMat);
    face.position.y = -FACE / 2;
    const edgeMat = new MeshBasicMaterial({ color: BRIDGE_LOOK.edge, transparent: true, side: DoubleSide });
    const crestMat = new MeshBasicMaterial({ color: BRIDGE_LOOK.crest, transparent: true, side: DoubleSide });
    const frameThin = new Mesh(thin, edgeMat);
    const frameThick = new Mesh(thick, edgeMat);
    const frameDash = new Mesh(dashed, edgeMat);
    for (const m of [frameThin, frameThick, frameDash]) m.position.z = 0.002;
    const crest = new Mesh(crestGeo, crestMat);
    crest.position.set(0, FACE / 2 - CREST / 2 - 0.03, 0.003);
    const line = new Mesh(lineGeo, edgeMat);
    line.position.z = 0.003;
    line.visible = false;
    g.add(face, frameThin, frameThick, frameDash, crest, line);
    world.add(g);
    return { g, face, faceMat, edgeMat, crestMat, frameThin, frameThick, frameDash, crest, line };
  });

  // L'interrupteur : un socle sombre incrusté dans le haut de son sol, une plaque qui dépasse (relevée) ou s'enfonce, une couronne.
  const baseGeo = new PlaneGeometry(PLATE_W + 0.1, 0.24);
  // Deux chevrons sur la plaque, tournés vers la première tuile du pont : l'interrupteur dit où va la lumière.
  const chevronGeo = new BufferGeometry();
  chevronGeo.setAttribute("position", new Float32BufferAttribute([-0.05, -0.07, 0, 0.04, 0, 0, -0.05, 0.07, 0, -0.16, -0.07, 0, -0.07, 0, 0, -0.16, 0.07, 0], 3));
  const plateGeo = new PlaneGeometry(PLATE_W, PLATE_H);
  const ringGeo = frameGeometry(PLATE_W + 0.12, 0.035).scale(1, PLATE_H / (PLATE_W + 0.12) + 0.4, 1);
  const switches = level.bridges.map((b) => {
    const g = new Group();
    // Le haut de la tuile de l'interrupteur : y = −row.
    g.position.set(b.switchCol + 0.5, -b.switchRow, 0.035);
    const baseMat = new MeshBasicMaterial({ color: BRIDGE_LOOK.base, transparent: true, side: DoubleSide });
    const base = new Mesh(baseGeo, baseMat);
    base.position.set(0, -0.08, 0);
    const plateMat = new MeshBasicMaterial({ color: BRIDGE_LOOK.plateOff, transparent: true, side: DoubleSide });
    const plate = new Mesh(plateGeo, plateMat);
    const ringMat = new MeshBasicMaterial({ color: BRIDGE_LOOK.ring, transparent: true, side: DoubleSide });
    const ring = new Mesh(ringGeo, ringMat);
    ring.position.z = 0.001;
    const chevronMat = new MeshBasicMaterial({ color: BRIDGE_LOOK.base, transparent: true, side: DoubleSide });
    const chevrons = new Mesh(chevronGeo, chevronMat);
    chevrons.position.z = 0.002;
    // Tournés vers le pont (à gauche si sa première tuile est à gauche de l'interrupteur).
    if ((b.tiles[0]?.col ?? b.switchCol + 1) < b.switchCol) chevrons.scale.x = -1;
    g.add(base, plate, ring, chevrons);
    world.add(g);
    return { g, base, baseMat, plate, plateMat, ring, ringMat, chevrons, chevronMat };
  });

  const looks: BridgeTileLook[] = [];
  const off = new Color(BRIDGE_LOOK.plateOff);
  const on = new Color(BRIDGE_LOOK.plateOn);
  const n = cells.length;
  const stats: BridgeStats = { tiles: n, solid: 0, dotted: 0, waiting: 0, draining: 0, fills: Array(n).fill(0), pressed: level.bridges.map(() => 0), plateDrop: level.bridges.map(() => 0), plateLit: level.bridges.map(() => false), opacity: 1 };

  return {
    stats,
    update(state, fade, seconds, animate) {
      const v = Math.max(0, Math.min(1, fade));
      const carnage = v < 1;
      bridgeTileLooks(level, state, carnage, looks);
      stats.opacity = v;
      stats.solid = stats.dotted = stats.waiting = stats.draining = 0;
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i]!;
        const look = looks[i]!;
        let faceOpacity = 0;
        let edgeOpacity = DOTTED;
        let lineOn = false;
        if (look.solid) {
          // Allumée : face pleine (une jauge pendant l'annonce), liseré franc ; elle est pleine jusqu'au pas où la simulation l'éteint.
          faceOpacity = 1;
          edgeOpacity = 1;
          stats.solid++;
          if (look.fill < 1) {
            stats.draining++;
            lineOn = true;
          }
        } else if (look.waiting) {
          // Elle devrait être allumée mais le personnage la chevauche : contour épais, pas de face (règle de sortie).
          edgeOpacity = animate ? 0.65 + 0.35 * Math.sin(seconds * 7 + i) : 0.85;
          stats.waiting++;
        } else stats.dotted++;
        stats.fills[i] = look.solid ? look.fill : 0;
        const height = look.solid ? look.fill : 0;
        const dotted = !look.solid && !look.waiting;
        t.face.visible = faceOpacity > 0.01 && height > 0.001;
        t.faceMat.opacity = faceOpacity * v;
        t.face.scale.set(1, Math.max(0.0001, height), 1);
        t.crest.visible = look.solid && look.fill >= 1;
        t.crestMat.opacity = 0.55 * v;
        t.frameThin.visible = look.solid;
        t.frameThick.visible = look.waiting;
        t.frameDash.visible = dotted;
        t.edgeMat.opacity = edgeOpacity * v;
        t.line.visible = lineOn;
        if (lineOn) t.line.position.y = -FACE / 2 + FACE * height;
      }
      level.bridges.forEach((_, i) => {
        const s = switches[i]!;
        const look = switchLook(level, state, i, carnage);
        // La plaque dépasse du sol (relevée) ou s'enfonce quand le personnage s'y pose ; elle brille quand le pont est allumé, et respire doucement tant que le pont dort (1 Hz au plus).
        const drop = look.pressed ? PLATE_RAISED + PLATE_SUNK : 0;
        s.plate.position.y = PLATE_H / 2 - 0.02 - drop + (look.pressed ? 0 : PLATE_RAISED - 0.02);
        s.ring.position.y = s.plate.position.y;
        s.chevrons.position.y = s.plate.position.y;
        s.chevronMat.opacity = v;
        const breathe = !look.lit && animate ? 0.5 + 0.5 * Math.sin(seconds * 2 * Math.PI * 0.9) : 0;
        s.plateMat.color.copy(off).lerp(on, look.lit ? 1 : 0.25 * breathe);
        s.plateMat.opacity = v;
        s.baseMat.opacity = v;
        s.ringMat.opacity = (look.lit ? 1 : 0.55 + 0.3 * breathe) * v;
        stats.pressed[i] = look.pressed ? 1 : 0;
        stats.plateDrop[i] = drop;
        stats.plateLit[i] = look.lit;
      });
    },
  };
}
