import {
  PLAYER_WIDTH,
  TILE_ALT_ON,
  TILE_BLINK_ON,
  cycleMod,
  idiv,
  sectionClock,
  sectionPhases,
  singleClock,
  tileOf,
  type AttemptState,
  type BlinkCycle,
  type Level,
} from "@cdj/jump-sim";
import { announceTicks, announceWindow, blinkGauge, blinkPhase } from "./announce";
import type { EventSource, GameEvent } from "./events";

// Les blocs clignotants (nuit) et alternés (néon) vus par le jeu (lot 12), **logique pure** et testée : ce qui s'affiche (plein, absent,
// jauge qui se vide ou se remplit — lot 18 —, en attente de la sortie du personnage), les couleurs réservées, les événements qu'on en déduit
// (`blocVacille`, `blocApparait`, `blocDisparait`, `bascule`, `metronome`) et le tempo de la section courante. Rien ici ne modifie la simulation :
// on lit des états. Lot 18 : l'annonce d'un changement d'état est une jauge continue (`announce.ts`), plus un vacillement.

// ——— Couleurs ———
// Les mêmes dans tous les thèmes (comme le tapis et la glace). **Jamais le rouge des dangers (`HAZARD`, teinte 0°) ni le jaune du personnage
// (`PLAYER`, teinte 44°)** : teinte à au moins 30° de chacun (règle du lot 9, test `blocks.test.ts`), et l'un et l'autre jeu se distinguent aussi
// par leur repère (barre pour A, losange pour B) : la couleur ne porte pas seule l'information.

export interface BlockStyle {
  /** Face pleine, liseré clair (contour d'un bloc plein et d'un bloc absent) et repère. */
  fill: number;
  edge: number;
}

export const BLOCK_STYLE = {
  /** Clignotant : bleu-violet (teinte 226°). */
  blink: { fill: 0x6a8cff, edge: 0xd2e0ff },
  /** Alterné, jeu A : turquoise (teinte 175°) ; jeu B : violet (teinte 269°). */
  altA: { fill: 0x12b5a8, edge: 0xd2fffa },
  altB: { fill: 0xb066ff, edge: 0xf0dcff },
} as const satisfies Record<string, BlockStyle>;

// ——— État affiché ———

/**
 * Ce qu'on dessine pour un bloc : plein ou absent, le niveau de sa jauge (lot 18 ; 0 vide, 1 pleine : 1 hors annonce pour un bloc plein, 0 pour un
 * absent, `blinkGauge` pendant l'annonce ; un bloc alterné vaut 1 plein et 0 absent), et s'il attend la sortie du personnage.
 */
export interface BlockLook {
  solid: boolean;
  fill: number;
  waiting: boolean;
}

/**
 * Pas restants avant que le groupe `group` du cycle change d'état à la phase `phase` (au moins 1), et son état actuel. Pure ; le même calcul
 * que `blinkIsSolid` de la simulation (`b` : plein pour `q < solide` ; `d` : pour `q ≥ solide`, avec `q = (phase + décalage) mod cycle`).
 */
export function blinkTiming(c: BlinkCycle, group: number, phase: number): { solid: boolean; left: number } {
  // Lot 15 : une phase négative (avant le départ, horloge unique) se lit dans le cycle.
  const q = cycleMod(phase + c.shift, c.cycle);
  const inFirst = q < c.solid;
  const solid = group === 0 ? inFirst : !inFirst;
  return { solid, left: inFirst ? c.solid - q : c.cycle - q };
}

/** Le groupe est-il, à cette phase, dans l'annonce de sa disparition (plein, et il lui reste au plus la fenêtre d'annonce) ? */
export function vanishing(c: BlinkCycle, group: number, phase: number): boolean {
  const p = blinkPhase(c, group, phase);
  const w = announceWindow(announceTicks("vanish"), p.length);
  return p.solid && w > 0 && p.left <= w;
}

/** Le bloc de cet indice (clignotants puis alternés, dans l'ordre de `Level.blinks` puis `Level.alts`) : son aspect dans cet état. */
export function blockLooks(level: Level, state: Readonly<AttemptState>, out: BlockLook[] = []): BlockLook[] {
  const phases = sectionPhases(level, state);
  let k = 0;
  const set = (solid: boolean, fill: number, waiting: boolean) => {
    const slot = (out[k] ??= { solid: false, fill: 0, waiting: false });
    slot.solid = solid;
    slot.fill = fill;
    slot.waiting = waiting;
    k++;
  };
  const vanishTicks = announceTicks("vanish");
  const appearTicks = announceTicks("appear");
  for (const b of level.blinks) {
    const cycle = level.blinkCycles[b.section]!;
    const t = blinkPhase(cycle, b.group, phases[b.section]!);
    const solid = state.tiles[b.row * level.width + b.col] === TILE_BLINK_ON;
    // Il devrait être plein et ne l'est pas : le personnage le chevauche, il redeviendra plein dès qu'il en sera sorti (contour épais, pas de face).
    const waiting = t.solid && !solid;
    // Lot 18 : la jauge de l'annonce (plein : elle descend ; absent : elle monte) ; un bloc qui attend la sortie du personnage n'a pas de face.
    set(solid, waiting || solid !== t.solid ? 0 : blinkGauge(t, vanishTicks, appearTicks), waiting);
  }
  const alt = state.alt ?? 0;
  for (const a of level.alts) {
    const solid = state.tiles[a.row * level.width + a.col] === TILE_ALT_ON;
    set(solid, solid ? 1 : 0, a.set === alt && !solid);
  }
  out.length = k;
  return out;
}

// ——— Tempo de la section courante ———

/** La section où se trouve le centre du personnage, si elle est en marche et porte un cycle de clignotement ; sinon −1. */
export function currentBlinkSection(level: Level, state: Readonly<AttemptState>): number {
  if (level.blinks.length === 0) return -1;
  const col = tileOf(state.player.x + idiv(PLAYER_WIDTH, 2));
  for (let i = 0; i < level.sections.length; i++) {
    const s = level.sections[i]!;
    // Lot 15 : à une seule horloge (v4), toute section est en marche.
    if (col >= s.c0 && col <= s.c1) return (singleClock(level) || state.sections[i]! >= 0) && level.blinkCycles[i] ? i : -1;
  }
  return -1;
}

/**
 * Les quatre temps d'un cycle (positions `q`, accent sur les deux bascules) : `q = 0` (`b` s'allume, accent), le milieu de sa fenêtre pleine,
 * `q = solide` (`b` s'éteint, accent), le milieu de l'autre fenêtre. C'est le tempo que la section fait entendre.
 */
export function metronomeBeats(c: BlinkCycle): { q: number; accent: boolean }[] {
  return [
    { q: 0, accent: true },
    { q: idiv(c.solid, 2), accent: false },
    { q: c.solid, accent: true },
    { q: c.solid + idiv(c.cycle - c.solid, 2), accent: false },
  ];
}

/** Le temps du métronome franchi entre deux états successifs (le chrono a avancé d'un pas dans la section courante), sinon null. */
export function metronomeTick(level: Level, prev: Readonly<AttemptState>, cur: Readonly<AttemptState>): { accent: boolean; beat: number; section: number } | null {
  if (cur.time !== prev.time + 1) return null;
  const section = currentBlinkSection(level, cur);
  if (section < 0 || (!singleClock(level) && prev.sections[section]! < 0)) return null;
  const cycle = level.blinkCycles[section]!;
  const q = cycleMod(sectionClock(level, cur.sections, cur.time, section) + cycle.shift, cycle.cycle);
  const beats = metronomeBeats(cycle);
  const beat = beats.findIndex((b) => b.q === q);
  return beat < 0 ? null : { accent: beats[beat]!.accent, beat, section };
}

// ——— Événements ———

/** Centre moyen (tuiles) d'un groupe de blocs. */
function centerOf(cells: readonly { col: number; row: number }[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const c of cells) {
    x += c.col + 0.5;
    y += c.row + 0.5;
  }
  return { x: x / cells.length, y: y / cells.length };
}

/**
 * Les événements des blocs entre deux états successifs d'un essai : `blocApparait` / `blocDisparait` (un événement **par section et par
 * sens**, avec le nombre de blocs et leur centre), `blocVacille` (le groupe de la section commence à vaciller : un événement par groupe),
 * `bascule` (les blocs alternés s'inversent : un saut est parti, ou remise à A par un point de passage), `metronome` (un temps du cycle de la
 * section courante). Pure ; sans blocs, rien (et aucun coût : un niveau sans blocs n'entre pas ici).
 */
export function blockEvents(prev: Readonly<AttemptState>, cur: Readonly<AttemptState>, level: Level, tick: number, source: EventSource, at: { x: number; y: number }): GameEvent[] {
  const out: GameEvent[] = [];
  if (level.blinks.length === 0 && level.alts.length === 0) return out;
  if (level.blinks.length > 0) {
    if (cur.tiles !== prev.tiles) {
      // Apparus et disparus, par section.
      const appear = new Map<number, { col: number; row: number }[]>();
      const vanish = new Map<number, { col: number; row: number }[]>();
      for (const b of level.blinks) {
        const k = b.row * level.width + b.col;
        const was = prev.tiles[k] === TILE_BLINK_ON;
        const is = cur.tiles[k] === TILE_BLINK_ON;
        if (was === is) continue;
        const map = is ? appear : vanish;
        const list = map.get(b.section) ?? [];
        list.push({ col: b.col, row: b.row });
        map.set(b.section, list);
      }
      for (const [section, cells] of appear) out.push({ kind: "blocApparait", section, count: cells.length, tick, source, ...centerOf(cells) });
      for (const [section, cells] of vanish) out.push({ kind: "blocDisparait", section, count: cells.length, tick, source, ...centerOf(cells) });
    }
    // Annonce de la disparition (lot 18) : le groupe plein d'une section entre dans la fenêtre où sa jauge se vide.
    const before = sectionPhases(level, prev);
    const after = sectionPhases(level, cur);
    for (let s = 0; s < level.sections.length; s++) {
      const cycle = level.blinkCycles[s];
      if (!cycle || before[s] === after[s]) continue;
      for (const group of [0, 1]) {
        if (!vanishing(cycle, group, after[s]!) || vanishing(cycle, group, before[s]!)) continue;
        const cells = level.blinks.filter((x) => x.section === s && x.group === group && cur.tiles[x.row * level.width + x.col] === TILE_BLINK_ON);
        if (cells.length > 0) out.push({ kind: "blocVacille", section: s, count: cells.length, tick, source, ...centerOf(cells) });
      }
    }
    const beat = metronomeTick(level, prev, cur);
    if (beat) out.push({ kind: "metronome", accent: beat.accent, beat: beat.beat, tick, source, ...at });
  }
  if (level.alts.length > 0) {
    const a = prev.alt ?? 0;
    const b = cur.alt ?? 0;
    // Un point de passage franchi remet A solide (le fanion le signale) ; sinon, un saut qui part inverse les jeux.
    const was = tileOf(prev.player.x + idiv(PLAYER_WIDTH, 2));
    const now = tileOf(cur.player.x + idiv(PLAYER_WIDTH, 2));
    const crossed = now > was ? level.checkpoints.find((c) => was < c.col && c.col <= now) : undefined;
    if (crossed && a === 1) out.push({ kind: "bascule", alt: 0, reset: true, tick, source, x: crossed.col + 0.5, y: crossed.row + 0.5 });
    else if (a !== b) out.push({ kind: "bascule", alt: b, reset: false, tick, source, ...at });
  }
  return out;
}
