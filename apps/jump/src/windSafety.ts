import { PLAYER_HEIGHT, PLAYER_WIDTH, UNITS_PER_TILE, WIND_RIGHT, WIND_UP, isSpikeTile, sawCenter, windZoneOf, type AttemptState, type Level, type WindZone } from "@cdj/jump-sim";
import { VIEW_TILES_PHONE, followCamera, snapCamera, type CameraView, type Frame } from "./camera";

// Lot 13 — **une zone ne pousse jamais vers un danger qu'on ne voit pas** : au moment où le centre du personnage entre dans une zone de vent,
// tout danger (pic, scie sur tout son trajet) **dans le sens du vent** — dans la zone et jusqu'à `WIND_REACH` tuiles au-delà de son bord, sur
// la bande de la zone élargie d'une tuile — doit être **à l'écran**, avec le cadrage du lot 1b (téléphone en paysage : `VIEW_TILES_PHONE` tuiles
// de haut ; écran 16:9, le plus étroit des écrans de téléphone courants) et la vraie caméra du jeu (`camera.ts` : avance, lissage, zone morte),
// suivie pas à pas sur la partie jouée. Logique pure : le test l'applique aux solutions de tout le catalogue (`vent.test.ts`).

/** Au-delà du bord sous le vent d'une zone, la vitesse acquise porte encore jusqu'à cette distance (tuiles). */
export const WIND_REACH = 3;
/** Le cadrage vérifié : téléphone en paysage, 16:9. */
export const SAFETY_FRAME_ASPECT = 16 / 9;

/** Un danger qui n'était pas à l'écran à l'entrée d'une zone. */
export interface HiddenDanger {
  /** Indice de la zone, pas de l'entrée, tuile du danger (centre, y vers le bas). */
  zone: number;
  tick: number;
  x: number;
  y: number;
  kind: "pic" | "scie";
}

/** Le cadre de la caméra du téléphone en paysage pour un niveau. */
export function phoneFrame(level: Pick<Level, "width" | "height">): Frame {
  const halfH = VIEW_TILES_PHONE / 2;
  return { width: level.width, height: level.height, halfW: halfH * SAFETY_FRAME_ASPECT, halfH };
}

/** Les dangers (centres, tuiles, y vers le bas) de la région sous le vent d'une zone, depuis le point d'entrée (`ex`, `ey` : la tuile du centre). */
export function downwindDangers(level: Level, zone: WindZone, ex: number, ey: number): { x: number; y: number; kind: "pic" | "scie" }[] {
  let c0: number;
  let c1: number;
  let r0: number;
  let r1: number;
  if (zone.dir === WIND_UP) {
    [c0, c1, r0, r1] = [zone.c0 - 1, zone.c1 + 1, zone.r0 - WIND_REACH, ey];
  } else if (zone.dir === WIND_RIGHT) {
    [c0, c1, r0, r1] = [ex, zone.c1 + WIND_REACH, zone.r0 - 1, zone.r1 + 1];
  } else {
    [c0, c1, r0, r1] = [zone.c0 - WIND_REACH, ex, zone.r0 - 1, zone.r1 + 1];
  }
  const out: { x: number; y: number; kind: "pic" | "scie" }[] = [];
  for (let r = Math.max(0, r0); r <= Math.min(level.height - 1, r1); r++) {
    for (let c = Math.max(0, c0); c <= Math.min(level.width - 1, c1); c++) if (isSpikeTile(level.tiles[r * level.width + c]!)) out.push({ x: c + 0.5, y: r + 0.5, kind: "pic" });
  }
  const T = UNITS_PER_TILE;
  for (const saw of level.saws) {
    const n = saw.cycle === 0 ? 1 : saw.cycle;
    for (let t = 0; t < n; t += 6) {
      const p = sawCenter(saw, t);
      const x = p.x / T;
      const y = p.y / T;
      if (x >= c0 && x < c1 + 1 && y >= r0 && y < r1 + 1) out.push({ x, y, kind: "scie" });
    }
  }
  return out;
}

/** Le personnage vu par la caméra (y vers le haut). */
function follow(s: Readonly<AttemptState>) {
  const T = UNITS_PER_TILE;
  return { cx: (s.player.x + PLAYER_WIDTH / 2) / T, cy: -(s.player.y + PLAYER_HEIGHT / 2) / T, vx: (s.player.vx * 120) / T, ground: s.player.ground === 1 };
}

/**
 * Suit une partie (les états successifs d'un essai, le premier compris) avec la caméra du jeu, et rend les dangers qui n'étaient pas à l'écran
 * à l'instant où le centre du personnage est entré dans une zone de vent (une marge d'une demi-tuile au bord de l'image). Vide : la règle tient.
 */
export function hiddenWindDangers(level: Level, states: readonly Readonly<AttemptState>[], frame: Frame = phoneFrame(level)): HiddenDanger[] {
  const out: HiddenDanger[] = [];
  if (states.length === 0 || level.winds.length === 0) return out;
  let view: CameraView = snapCamera(follow(states[0]!), frame);
  let prevZone = windZoneOf(level, states[0]!);
  const T = UNITS_PER_TILE;
  for (let k = 1; k < states.length; k++) {
    const s = states[k]!;
    view = followCamera(view, follow(s), frame, 1 / 120);
    const z = windZoneOf(level, s);
    if (z >= 0 && z !== prevZone) {
      const ex = Math.floor((s.player.x + PLAYER_WIDTH / 2) / T);
      const ey = Math.floor((s.player.y + PLAYER_HEIGHT / 2) / T);
      for (const d of downwindDangers(level, level.winds[z]!, ex, ey)) {
        const dx = Math.abs(d.x - view.x);
        const dy = Math.abs(-d.y - view.y);
        if (dx > frame.halfW - 0.5 || dy > frame.halfH - 0.5) out.push({ zone: z, tick: k, x: d.x, y: d.y, kind: d.kind });
      }
    }
    prevZone = z;
  }
  return out;
}

