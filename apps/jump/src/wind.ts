import {
  ATTEMPT_DEAD,
  ATTEMPT_FINISHED,
  WIND_DIR_NAMES,
  WIND_LEFT,
  WIND_RIGHT,
  WIND_UP,
  cycleMod,
  windActive,
  windPhase,
  windZoneOf,
  type AttemptState,
  type Gust,
  type Level,
  type WindZone,
} from "@cdj/jump-sim";
import { announceTicks, gustFeel, gustIntensity, gustPhase } from "./announce";
import type { EventSource, GameEvent } from "./events";

// Les courants d'air (forêt, lot 13) vus par le jeu, **logique pure** et testée : couleurs réservées, état affiché de chaque zone (souffle,
// annonce d'une rafale), événements (`ventDebut`, `ventFin`, `rafale`), souffle spatialisé (`windMix`), feuilles et pollen (positions des
// particules, fonction du temps : rien n'est créé en jeu), flèches fixes du mouvement réduit. Rien ici ne modifie la simulation.
//
// **Une zone de vent se voit toujours** : avec les effets, des feuilles et du pollen circulent dans le sens du vent (densité plafonnée,
// `WIND_PARTICLES_MAX`) et un contour très discret dessine la zone. Lot 18 : une rafale **s'annonce et se termine en douceur** (`announce.ts`) —
// les feuilles frémissent `ANNOUNCE.gustLead` secondes avant le début, vont à pleine vitesse pendant la rafale, ralentissent pendant les
// `ANNOUNCE.gustTail` dernières secondes et sont à l'arrêt exactement quand elle cesse. **Sans particules** (mouvement réduit, effets « aucun »,
// `?fx=off`), des **flèches fixes** dans le sens du vent les remplacent, avec la même logique : elles s'éclaircissent avant le début, sont
// allumées pendant la rafale et s'éteignent progressivement avant la fin, sans jamais clignoter : une information de jeu, jamais coupée.

// ——— Couleurs ———
// Les mêmes dans tous les thèmes (comme les tapis et les blocs). **Jamais le rouge des dangers (teinte 0°) ni le jaune du personnage (44°)** :
// teinte à au moins 30° de chacun, ou presque blanc (le pollen) ; contrastes ≥ 3:1 avec le ciel et chaque plan de chaque thème (test
// `vent.test.ts`). Verts et menthe : la forêt.
export const WIND_STYLE = {
  /** Feuilles (deux verts) et pollen (blanc verdi, peu saturé). */
  leaf: 0x9ad48a,
  leafDark: 0x6fd7a0,
  pollen: 0xe6f5ea,
  /** Flèches du mouvement réduit et contour de la zone. */
  arrow: 0x8de0c0,
  edge: 0xa6f0d4,
} as const;
/** Opacité du contour (très discret) ; des flèches éteintes (la zone ne souffle pas) et allumées. */
export const WIND_EDGE_OPACITY = 0.16;
export const WIND_ARROW_IDLE = 0.22;
export const WIND_ARROW_ON = 0.8;

// ——— État d'une zone ———

/** Pas restants avant que la rafale change d'état à la phase `phase` (au moins 1), et son état. Même calcul que `windBlows` de la simulation. */
export function gustTiming(g: Gust, phase: number): { blowing: boolean; left: number } {
  const q = cycleMod(phase + g.shift, g.cycle); // lot 15 : phase négative avant le départ
  const blowing = q < g.active;
  return { blowing, left: blowing ? g.active - q : g.cycle - q };
}

/**
 * Ce qu'on dessine d'une zone : souffle-t-elle ; `announce`, la part du frémissement qui précède une rafale (0 : rien ; presque 1 : elle part au
 * pas suivant) ; `flow`, la vitesse des feuilles (0 : à l'arrêt, 1 : pleine vitesse, entre les deux pendant la fin d'une rafale) ; `intensity`,
 * ce qui se montre sans bouger (opacité des feuilles et des flèches : monte avant le début, 1 pendant la rafale, descend avant la fin).
 */
export interface WindLook {
  blowing: boolean;
  announce: number;
  flow: number;
  intensity: number;
}

/** L'aspect de chaque zone de vent dans cet état (ordre de `Level.winds`). */
export function windLooks(level: Level, state: Readonly<AttemptState>, out: WindLook[] = []): WindLook[] {
  for (let i = 0; i < level.winds.length; i++) {
    const w = level.winds[i]!;
    const slot = (out[i] ??= { blowing: true, announce: 0, flow: 1, intensity: 1 });
    if (!w.gust) {
      slot.blowing = true;
      slot.announce = 0;
      slot.flow = 1;
      slot.intensity = 1;
      continue;
    }
    const t = gustPhase(w.gust, windPhase(level, state, i));
    const feel = gustFeel(t, announceTicks("gustLead"), announceTicks("gustTail"));
    slot.blowing = t.blowing;
    slot.announce = feel.lead;
    slot.flow = feel.flow;
    slot.intensity = gustIntensity(feel, t.blowing);
  }
  out.length = level.winds.length;
  return out;
}

/** Le nom du sens (`haut`, `gauche`, `droite`). */
export function windDirName(zone: Pick<WindZone, "dir">): "haut" | "gauche" | "droite" {
  return WIND_DIR_NAMES[zone.dir] as "haut" | "gauche" | "droite";
}

/** Le sens d'une zone en vecteur unité du monde affiché (y vers le haut). */
export function windVector(zone: Pick<WindZone, "dir">): { x: number; y: number } {
  return zone.dir === WIND_UP ? { x: 0, y: 1 } : zone.dir === WIND_LEFT ? { x: -1, y: 0 } : { x: 1, y: 0 };
}

/** Centre d'une zone, en tuiles (y vers le bas, comme la simulation). */
export function zoneCenter(z: WindZone): { x: number; y: number } {
  return { x: (z.c0 + z.c1 + 1) / 2, y: (z.r0 + z.r1 + 1) / 2 };
}

// ——— Événements ———

/** Le personnage est-il poussé dans cet état (centre dans une zone qui souffle) ? L'indice de la zone, −1 sinon. */
function pushedBy(level: Level, s: Readonly<AttemptState>): number {
  if (s.status === ATTEMPT_DEAD || s.status === ATTEMPT_FINISHED) return -1;
  const i = windZoneOf(level, s);
  return i >= 0 && windActive(level, s, i) ? i : -1;
}

/**
 * Les événements du vent entre deux états successifs : `ventDebut` / `ventFin` (le personnage entre dans une zone qui souffle, ou la zone où il
 * est se met à souffler ; et l'inverse ; la mort et l'arrivée ferment l'état), `rafale` (une rafale de la section courante part : une par zone,
 * position = centre de la zone). Pure ; rien pour un niveau sans vent.
 */
export function windEvents(prev: Readonly<AttemptState>, cur: Readonly<AttemptState>, level: Level, tick: number, source: EventSource, at: { x: number; y: number }): GameEvent[] {
  const out: GameEvent[] = [];
  if (level.winds.length === 0) return out;
  const a = pushedBy(level, prev);
  const b = pushedBy(level, cur);
  if (a !== b) {
    if (a >= 0) out.push({ kind: "ventFin", zone: a, dir: windDirName(level.winds[a]!), tick, source, ...at });
    if (b >= 0) out.push({ kind: "ventDebut", zone: b, dir: windDirName(level.winds[b]!), tick, source, ...at });
  }
  // Rafales de la section où se trouve le personnage (celles des autres sections ne s'entendent pas).
  if (cur.time === prev.time + 1 && cur.status !== ATTEMPT_DEAD) {
    const col = Math.floor(at.x);
    const section = level.sections.findIndex((s) => col >= s.c0 && col <= s.c1);
    if (section >= 0) {
      for (let i = 0; i < level.winds.length; i++) {
        const w = level.winds[i]!;
        if (!w.gust || w.section !== section) continue;
        if (!windActive(level, prev, i) && windActive(level, cur, i)) out.push({ kind: "rafale", zone: i, dir: windDirName(w), tick, source, ...zoneCenter(w) });
      }
    }
  }
  return out;
}

// ——— Souffle spatialisé (3 voix, comme les scies et les tapis) ———

/** Portée de l'écoute d'une zone (tuiles, depuis son bord), voix, volume au centre d'une zone qui souffle. */
export const WIND_RANGE = 8;
export const WIND_VOICES = 3;
export const WIND_GAIN = 0.05;
/** Volume d'une zone en rafale qui ne souffle pas (un murmure : on l'entend venir) ; stéréo pleine à cet écart. */
export const WIND_IDLE = 0.18;
export const WIND_PAN_SPAN = 7;

export interface WindVoice {
  index: number;
  gain: number;
  pan: number;
  distance: number;
  /** Hauteur du souffle (0 : calme … 1 : rafale) : le filtre s'ouvre avec elle. */
  strength: number;
}

/**
 * Les zones qu'on entend depuis `listener` (tuiles, y vers le bas). **Plus fort au centre de la zone** : dedans, le volume va de 0,6 au bord à
 * 1 au centre ; dehors, il décroît avec la distance au bord, (1 − d / portée)² × 0,6. Une zone qui ne souffle pas murmure (`WIND_IDLE`) ;
 * l'annonce d'une rafale fait monter le souffle. Les `max` plus proches. Pur.
 */
export function windMix(level: Pick<Level, "winds">, looks: readonly WindLook[], listener: { x: number; y: number }, max = WIND_VOICES, range = WIND_RANGE): WindVoice[] {
  const near: WindVoice[] = [];
  for (let i = 0; i < level.winds.length; i++) {
    const z = level.winds[i]!;
    const look = looks[i] ?? { blowing: true, announce: 0, flow: 1, intensity: 1 };
    const nx = Math.min(Math.max(listener.x, z.c0), z.c1 + 1);
    const ny = Math.min(Math.max(listener.y, z.r0), z.r1 + 1);
    const dx = nx - listener.x;
    const dy = ny - listener.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= range) continue;
    let k: number;
    if (d === 0) {
      // Dedans : 1 au centre, 0,6 au bord (distance normalisée au centre, la plus grande des deux).
      const c = zoneCenter(z);
      const hx = (z.c1 + 1 - z.c0) / 2;
      const hy = (z.r1 + 1 - z.r0) / 2;
      const u = Math.max(Math.abs(listener.x - c.x) / hx, Math.abs(listener.y - c.y) / hy);
      k = 1 - 0.4 * Math.min(1, u);
    } else {
      const f = 1 - d / range;
      k = 0.6 * f * f;
    }
    const strength = look.blowing ? 1 : WIND_IDLE + (0.6 - WIND_IDLE) * look.announce;
    const force = 0.6 + 0.4 * Math.min(1.5, z.force / 100);
    const c = zoneCenter(z);
    const pdx = d === 0 ? (c.x - listener.x) * 0.3 : dx;
    near.push({ index: i, gain: WIND_GAIN * k * strength * force, pan: Math.max(-1, Math.min(1, pdx / WIND_PAN_SPAN)), distance: d, strength });
  }
  near.sort((a, b) => a.distance - b.distance || a.index - b.index);
  return near.slice(0, max);
}

// ——— Feuilles et pollen ———

/** Particules du vent, au plus (tous les niveaux), et par zone ; densité visée (par tuile de zone). */
export const WIND_PARTICLES_MAX = 160;
export const WIND_PARTICLES_ZONE = 40;
export const WIND_DENSITY = 0.45;
/**
 * Vitesse d'affichage des particules (tuiles/s) quand la zone souffle à pleine vitesse. Lot 18 : sans souffle, elles sont **à l'arrêt** (plus de
 * dérive lente) : un arrêt net était la gêne ; elles ralentissent jusqu'à l'arrêt pendant la fin de la rafale.
 */
export const WIND_FLOW = 5;
/** Le frémissement d'avant une rafale (pulsation, rad/s) : 18 rad/s = 2,9 Hz, sous `FLICKER_MAX_HZ`. */
export const WIND_TREMBLE_RAD = 18;

/** Combien de particules pour chaque zone (`amount` : part gardée par les réglages, 0 à 1), le total sous `WIND_PARTICLES_MAX`. */
export function particleBudget(level: Pick<Level, "winds">, amount = 1): number[] {
  const want = level.winds.map((z) => Math.min(WIND_PARTICLES_ZONE, Math.max(3, Math.round((z.c1 - z.c0 + 1) * (z.r1 - z.r0 + 1) * WIND_DENSITY * amount))));
  const total = want.reduce((s, n) => s + n, 0);
  if (amount <= 0) return want.map(() => 0);
  if (total <= WIND_PARTICLES_MAX) return want;
  const k = WIND_PARTICLES_MAX / total;
  return want.map((n) => Math.max(1, Math.floor(n * k)));
}

/** Petit hasard fixe (affichage seul) : un nombre dans [0, 1) tiré de deux entiers. */
export function hash01(a: number, b: number): number {
  let h = (Math.imul(a + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}

export interface WindParticle {
  /** Position (tuiles, monde affiché : y vers le haut), angle (rad), opacité, taille (tuiles), feuille (0, 1) ou pollen (2). */
  x: number;
  y: number;
  angle: number;
  alpha: number;
  size: number;
  kind: number;
}

/**
 * La particule `k` d'une zone : sa position est une fonction pure de `travel` (tuiles parcourues dans le sens du vent par le flux de la zone,
 * cumulées par le rendu), `swing` (s de « mouvement » cumulées au rythme du flux : l'ondulation et la rotation s'arrêtent avec lui, lot 18),
 * `clock` (s réelles, pour le seul frémissement), `intensity` (0 … 1 : l'opacité) et `lead` (0 … 1 : la part du frémissement qui précède une
 * rafale). Elle boucle dans la zone et s'efface aux deux bouts : rien n'est créé ni détruit.
 */
export function windParticle(zone: WindZone, index: number, k: number, travel: number, swing: number, clock: number, intensity: number, lead: number, out: WindParticle): WindParticle {
  const up = zone.dir === WIND_UP;
  const sign = zone.dir === WIND_LEFT ? -1 : 1;
  const len = up ? zone.r1 - zone.r0 + 1 : zone.c1 - zone.c0 + 1;
  const across = up ? zone.c1 - zone.c0 + 1 : zone.r1 - zone.r0 + 1;
  const r0 = hash01(index * 977 + k, 1);
  const r1 = hash01(index * 977 + k, 2);
  const r2 = hash01(index * 977 + k, 3);
  const speed = 0.7 + 0.6 * r2;
  const u = (((r0 * len + travel * speed) % len) + len) % len; // le long du vent
  const wave = Math.sin(swing * (1.6 + r2 * 1.2) + r1 * 6.28) * 0.18 + Math.sin(clock * WIND_TREMBLE_RAD + k) * 0.12 * lead;
  const v = 0.15 + r1 * (across - 0.3) + wave; // en travers
  const edge = Math.min(u, len - u);
  const fade = Math.min(1, edge / 0.8);
  const kind = r2 < 0.35 ? 2 : r2 < 0.7 ? 0 : 1;
  if (up) {
    out.x = zone.c0 + v;
    out.y = -(zone.r1 + 1) + u;
  } else {
    out.x = sign > 0 ? zone.c0 + u : zone.c1 + 1 - u;
    out.y = -zone.r0 - v;
  }
  out.angle = swing * (kind === 2 ? 0 : 1.5 + r1 * 2) * (r0 < 0.5 ? -1 : 1) + r0 * 6.28;
  out.alpha = fade * (0.35 + 0.5 * intensity);
  out.size = kind === 2 ? 0.13 + 0.05 * r1 : 0.32 + 0.1 * r1;
  out.kind = kind;
  return out;
}

/** Tuiles parcourues par le flux d'une zone pendant `dt` (s) à la vitesse `flow` (0 à 1, `WindLook.flow`) : pleine vitesse, ralentie, ou à l'arrêt. */
export function flowStep(zone: Pick<WindZone, "force">, flow: number, dt: number): number {
  return WIND_FLOW * Math.min(2, zone.force / 100) * flow * dt;
}

// ——— Flèches fixes (mouvement réduit, effets « aucun ») ———

/** Écart entre deux flèches (tuiles) dans une zone ; au moins une flèche par zone. */
export const ARROW_SPACING = 3;

/** Centres des flèches d'une zone (tuiles, monde affiché : y vers le haut), en grille régulière, et leur sens. */
export function arrowLayout(zone: WindZone): { x: number; y: number; dx: number; dy: number }[] {
  const w = zone.c1 - zone.c0 + 1;
  const h = zone.r1 - zone.r0 + 1;
  const nx = Math.max(1, Math.round(w / ARROW_SPACING));
  const ny = Math.max(1, Math.round(h / ARROW_SPACING));
  const d = windVector(zone);
  const out: { x: number; y: number; dx: number; dy: number }[] = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) out.push({ x: zone.c0 + ((i + 0.5) * w) / nx, y: -(zone.r0 + ((j + 0.5) * h) / ny), dx: d.x, dy: d.y });
  }
  return out;
}

/**
 * Opacité des flèches d'une zone (lot 18, la même logique que les feuilles) : éteintes hors de la rafale, elles s'éclaircissent pendant l'annonce du
 * début, sont allumées pendant la rafale et s'éteignent progressivement pendant les derniers instants, sans jamais clignoter.
 */
export function arrowOpacity(look: Pick<WindLook, "intensity">): number {
  return WIND_ARROW_IDLE + (WIND_ARROW_ON - WIND_ARROW_IDLE) * look.intensity;
}

export { WIND_LEFT, WIND_RIGHT, WIND_UP };
