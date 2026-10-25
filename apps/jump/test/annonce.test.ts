import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_JUMP_PARAMS,
  INPUT_RIGHT,
  TICK_RATE,
  initialAttempt,
  parseLevel,
  stepAttempt,
  windBlows,
  type AttemptState,
  type Level,
} from "@cdj/jump-sim";
import { Group, Points } from "three";
import { afterEach, describe, expect, it } from "vitest";
import {
  ANNOUNCE,
  ANNOUNCE_DEFAULTS,
  FLICKER_MAX_HZ,
  announceTicks,
  announceWindow,
  blinkGauge,
  blinkPhase,
  gustFeel,
  gustIntensity,
  gustPhase,
} from "../src/announce";
import { blockLooks, vanishing } from "../src/blocks";
import { createDynamicBlocks } from "../src/dynamicArt";
import { CAMERA_SLIDERS, cameraJson, loadCameraTune } from "../src/tune";
import { WIND_ARROW_IDLE, WIND_ARROW_ON, WIND_FLOW, WIND_TREMBLE_RAD, arrowOpacity, flowStep, particleBudget, windLooks } from "../src/wind";
import { createWindArt } from "../src/windArt";

// Lot 18 — l'annonce des éléments à horloge : la jauge des blocs clignotants de la nuit (vide pile à la disparition, pleine pile à la réapparition),
// le ralenti des feuilles des rafales (à l'arrêt exactement quand la rafale cesse), les flèches du mouvement réduit, et **aucun clignotement
// au-dessus de 3 Hz**. L'affichage lit la fonction de l'horloge : il ne montre jamais un état que la simulation n'a pas.

const P = DEFAULT_JUMP_PARAMS;
const VANISH = 72; // 0,6 s
const APPEAR = 48; // 0,4 s
const LEAD = 48;
const TAIL = 48;

/** Une pièce d'un bloc dessiné : 0 face, 1 contour fin, 2 contour épais (ordre de `createDynamicBlocks`). */
function parts(world: Group, block: number, part: number): { scale: { y: number }; material: { opacity: number }; visible: boolean } {
  return world.children[block]!.children[part] as unknown as { scale: { y: number }; material: { opacity: number }; visible: boolean };
}

afterEach(() => {
  Object.assign(ANNOUNCE, ANNOUNCE_DEFAULTS);
});

/** Nombre de maxima locaux par seconde d'une suite échantillonnée à 120 Hz (les plateaux comptent pour un seul point). */
function peaksPerSecond(series: readonly number[]): number {
  const s = series.filter((v, i) => i === 0 || Math.abs(v - series[i - 1]!) > 1e-9);
  let peaks = 0;
  for (let i = 1; i < s.length - 1; i++) if (s[i]! > s[i - 1]! && s[i]! > s[i + 1]!) peaks++;
  return peaks / (series.length / TICK_RATE);
}

describe("lot 18 — la jauge des blocs clignotants (pur)", () => {
  const cycle = { cycle: 480, solid: 240, shift: 0 };

  it("les durées retenues : 0,6 s à la disparition, 0,4 s à la réapparition, 0,4 s avant et avant la fin d'une rafale", () => {
    expect(ANNOUNCE).toEqual({ vanish: 0.6, appear: 0.4, gustLead: 0.4, gustTail: 0.4 });
    expect([announceTicks("vanish"), announceTicks("appear"), announceTicks("gustLead"), announceTicks("gustTail")]).toEqual([VANISH, APPEAR, LEAD, TAIL]);
  });

  it("pleine hors annonce ; vide pile au pas de la disparition ; pleine pile au pas de la réapparition", () => {
    for (const group of [0, 1]) {
      for (let p = 0; p < 2 * cycle.cycle; p++) {
        const here = blinkPhase(cycle, group, p);
        const next = blinkPhase(cycle, group, p + 1);
        const g = blinkGauge(here, VANISH, APPEAR);
        if (here.solid && here.left > VANISH) expect(g, `plein p=${p}`).toBe(1);
        if (!here.solid && here.left > APPEAR) expect(g, `absent p=${p}`).toBe(0);
        if (here.solid && !next.solid) {
          expect(g).toBeCloseTo(1 / (VANISH + 1), 12); // le dernier pas plein : presque vide
          expect(blinkGauge(next, VANISH, APPEAR), "le pas de la disparition").toBe(0);
        }
        if (!here.solid && next.solid) {
          expect(g).toBeCloseTo(APPEAR / (APPEAR + 1), 12); // le dernier pas absent : presque plein
          expect(blinkGauge(next, VANISH, APPEAR), "le pas de la réapparition").toBe(1);
        }
      }
    }
  });

  it("l'annonce dure exactement 0,6 s (72 pas) avant la disparition et 0,4 s (48 pas) avant la réapparition, et la jauge est monotone", () => {
    const vanishSeries: number[] = [];
    const appearSeries: number[] = [];
    for (let p = 0; p < cycle.cycle; p++) {
      const here = blinkPhase(cycle, 0, p);
      const g = blinkGauge(here, VANISH, APPEAR);
      if (here.solid && g < 1) vanishSeries.push(g);
      if (!here.solid && g > 0) appearSeries.push(g);
    }
    expect(vanishSeries).toHaveLength(VANISH);
    expect(appearSeries).toHaveLength(APPEAR);
    for (let i = 1; i < vanishSeries.length; i++) expect(vanishSeries[i]!).toBeLessThan(vanishSeries[i - 1]!); // elle descend d'un pas à l'autre…
    for (let i = 1; i < appearSeries.length; i++) expect(appearSeries[i]!).toBeGreaterThan(appearSeries[i - 1]!); // …et monte, jamais l'inverse
    expect(vanishSeries[0]).toBeCloseTo(VANISH / (VANISH + 1), 12); // sans à-coup au début de l'annonce
    expect(appearSeries[0]).toBeCloseTo(1 / (APPEAR + 1), 12);
  });

  it("une phase plus courte que l'annonce : l'annonce couvre au plus la moitié de la phase", () => {
    expect(announceWindow(VANISH, 90)).toBe(45);
    expect(announceWindow(VANISH, 200)).toBe(72);
    expect(announceWindow(APPEAR, 1)).toBe(0);
    const short = { cycle: 100, solid: 40, shift: 0 }; // présent 40 (annonce 20), absent 60 (annonce 30 : 48 > 60 / 2)
    let drainSteps = 0;
    let fillSteps = 0;
    for (let p = 0; p < short.cycle; p++) {
      const here = blinkPhase(short, 0, p);
      const g = blinkGauge(here, VANISH, APPEAR);
      if (here.solid && g < 1) drainSteps++;
      if (!here.solid && g > 0) fillSteps++;
    }
    expect(drainSteps).toBe(20);
    expect(fillSteps).toBe(30);
  });

  it("la durée d'annonce se règle (`?debug&tune`) : la fenêtre suit", () => {
    ANNOUNCE.vanish = 0.3;
    expect(announceTicks("vanish")).toBe(36);
    ANNOUNCE.vanish = 0;
    expect(blinkGauge(blinkPhase(cycle, 0, 239), announceTicks("vanish"), APPEAR)).toBe(1); // 0 : pas d'annonce
    expect(vanishing(cycle, 0, 239)).toBe(false);
  });
});

describe("lot 18 — les blocs de la nuit, dans la simulation et au dessin", () => {
  const ROWS = [
    "##########################",
    "#........................#",
    "#...bb.....dd............#",
    "#........................#",
    "#S......................F#",
    "##########################",
  ];
  const level: Level = parseLevel(ROWS.join("\n") + "\n\nsection a 0-25\nclignote a 480 240 0\n");

  /** 960 pas (deux cycles) : l'état, l'aspect de `b` (indice 0) et de `d` (indice 2), et ce que le dessin pose. */
  function play() {
    const world = new Group();
    const art = createDynamicBlocks(world, level, false)!;
    let s = initialAttempt(level);
    const rows: { k: number; solid: boolean[]; fill: number[]; drawn: number[]; opacity: number[]; edge: number[]; dotted: number; thin: boolean[] }[] = [];
    for (let k = 1; k <= 960; k++) {
      s = stepAttempt(s, k === 1 ? INPUT_RIGHT : 0, level, P);
      const looks = blockLooks(level, s);
      art.update(s, k / TICK_RATE, true, { x: 0, y: 0, halfW: 5, halfH: 5 });
      const mat = (i: number) => parts(world, i, 0).material.opacity;
      const edgeMat = (i: number) => parts(world, i, 1).material.opacity;
      rows.push({
        k,
        solid: [looks[0]!.solid, looks[2]!.solid],
        fill: [looks[0]!.fill, looks[2]!.fill],
        drawn: [art.stats.fills[0]!, art.stats.fills[2]!],
        opacity: [mat(0), mat(2)],
        edge: [edgeMat(0), edgeMat(2)],
        dotted: art.stats.dotted,
        thin: [world.children[0]!.children[1]!.visible, world.children[2]!.children[1]!.visible],
      });
    }
    return { rows, art, world };
  }

  it("`b` : la jauge est pleine hors annonce, vide pile au pas de la disparition ; le contour est plein pile à la réapparition", () => {
    const { rows } = play();
    // `b` est plein sur les phases 0 à 239 (pas 1 à 240), absent de 240 à 479 (pas 241 à 480), plein de nouveau à partir du pas 481.
    const at = (k: number) => rows[k - 1]!;
    for (let k = 1; k <= 240 - VANISH; k++) expect(at(k).fill[0], `plein k=${k}`).toBe(1);
    for (let j = 1; j <= VANISH; j++) expect(at(241 - j).fill[0], `annonce j=${j}`).toBeCloseTo(j / (VANISH + 1), 12); // 1 pas avant la disparition : 1/73
    expect(at(241).solid[0]).toBe(false);
    expect(at(241).fill[0], "le pas de la disparition").toBe(0);
    expect(at(241).drawn[0]).toBe(0);
    for (let k = 241; k <= 480 - APPEAR; k++) expect(at(k).fill[0], `absent k=${k}`).toBe(0);
    for (let j = 1; j <= APPEAR; j++) expect(at(481 - j).fill[0], `réapparition j=${j}`).toBeCloseTo(1 - j / (APPEAR + 1), 12);
    expect(at(481).solid[0]).toBe(true);
    expect(at(481).fill[0], "le pas de la réapparition").toBe(1);
    expect(at(481).drawn[0]).toBe(1);
    expect(at(481).opacity[0]).toBe(1);
    expect(at(481).thin[0]).toBe(true);
    // `d` est l'opposé : il revient au pas où `b` disparaît, plein d'un coup.
    expect(at(241).solid[1]).toBe(true);
    expect(at(241).fill[1]).toBe(1);
  });

  it("le dessin ne ment jamais : plein = contour plein et face opaque ; absent = contour pointillé, face au plus translucide ; jamais d'un état que la simulation n'a pas", () => {
    const { rows } = play();
    for (const r of rows) {
      for (const i of [0, 1]) {
        if (r.solid[i]) {
          expect(r.opacity[i], `plein k=${r.k}`).toBe(1); // une face pleine reste opaque pendant que la jauge descend
          expect(r.edge[i]).toBe(1);
          expect(r.thin[i]).toBe(true); // contour franc, pas pointillé
          expect(r.drawn[i]).toBeCloseTo(r.fill[i]!, 12); // le dessin montre exactement la jauge de la simulation
        } else {
          expect(r.opacity[i], `absent k=${r.k}`).toBeLessThanOrEqual(0.5); // jamais une face pleine pour un bloc absent
          expect(r.thin[i]).toBe(false); // contour pointillé (ou épais s'il attend la sortie du personnage)
          expect(r.drawn[i]).toBeCloseTo(r.fill[i]!, 12);
        }
      }
    }
    // Absent et hors annonce : rien à remplir, seulement le contour pointillé.
    const calm = rows[300]!; // pas 301 : `b` absent depuis 60 pas
    expect(calm.solid[0]).toBe(false);
    expect(calm.drawn[0]).toBe(0);
    expect(calm.dotted).toBeGreaterThan(0);
  });

  it("la jauge est la même avec ou sans mouvement réduit ; elle ne dépend pas de l'horloge de l'écran (aucun scintillement entre deux images)", () => {
    const world = new Group();
    const art = createDynamicBlocks(world, level, false)!;
    let s = initialAttempt(level);
    for (let k = 1; k <= 200; k++) s = stepAttempt(s, k === 1 ? INPUT_RIGHT : 0, level, P);
    const face = parts(world, 0, 0);
    const seen = new Set<string>();
    for (const animate of [true, false]) {
      for (let i = 0; i < 60; i++) {
        art.update(s, 5 + i * 0.0137, animate, { x: 0, y: 0, halfW: 5, halfH: 5 });
        seen.add(`${face.scale.y.toFixed(4)}/${face.material.opacity}`);
      }
    }
    expect(seen.size).toBe(1);
  });

  it("aucun clignotement au-dessus de 3 Hz : ni la jauge, ni la face, ni le contour n'oscillent plus de 3 fois par seconde (ni dans l'état, ni dessinés)", () => {
    const { rows } = play();
    for (const i of [0, 1]) {
      expect(peaksPerSecond(rows.map((r) => r.fill[i]!)), `jauge ${i}`).toBeLessThanOrEqual(FLICKER_MAX_HZ);
      expect(peaksPerSecond(rows.map((r) => r.opacity[i]!)), `face ${i}`).toBeLessThanOrEqual(FLICKER_MAX_HZ);
      expect(peaksPerSecond(rows.map((r) => r.edge[i]!)), `contour ${i}`).toBeLessThanOrEqual(FLICKER_MAX_HZ);
    }
    // Et c'est même bien moins : un seul va-et-vient par cycle de 4 s.
    expect(peaksPerSecond(rows.map((r) => r.fill[0]!))).toBeLessThan(1);
  });

  it("le carnage estompe la jauge sans la changer (35 % d'opacité, même hauteur)", () => {
    const world = new Group();
    const art = createDynamicBlocks(world, level, false)!;
    let s = initialAttempt(level);
    for (let k = 1; k <= 200; k++) s = stepAttempt(s, k === 1 ? INPUT_RIGHT : 0, level, P);
    const face = parts(world, 0, 0);
    art.update(s, 5, true, { x: 0, y: 0, halfW: 5, halfH: 5 }, 1);
    const height = face.scale.y;
    expect(height).toBeLessThan(1);
    art.update(s, 5.1, true, { x: 0, y: 0, halfW: 5, halfH: 5 }, 0.35);
    expect(face.scale.y).toBe(height);
    expect(face.material.opacity).toBeCloseTo(0.35, 10);
  });
});

describe("lot 18 — les rafales de la forêt : les feuilles ralentissent jusqu'à l'arrêt", () => {
  const ROWS = [
    "##############################",
    "#............................#",
    "#............................#",
    "#............................#",
    "#S..........................F#",
    "##############################",
  ];
  const level: Level = parseLevel(ROWS.join("\n") + "\n\nsection a 1-28\nvent 6-12 1-4 droite 100\nvent 16-24 1-4 haut 100 rafale 480 240 0\n");
  const gust = level.winds[1]!.gust!;
  const at = (time: number): AttemptState => ({ ...initialAttempt(level), status: 1, sections: [0], time });
  const look = (time: number) => windLooks(level, at(time))[1]!;

  it("calme : à l'arrêt ; frémissement pendant les 48 pas qui précèdent le début ; pleine vitesse ; ralenti pendant les 48 derniers pas ; à l'arrêt pile quand la rafale cesse", () => {
    // Souffle de 0 à 239, calme de 240 à 479 (windBlows).
    for (let t = 0; t < 240 - TAIL; t++) expect(look(t), `pleine vitesse t=${t}`).toMatchObject({ blowing: true, flow: 1, announce: 0 });
    for (let j = 1; j <= TAIL; j++) expect(look(240 - j).flow, `ralenti j=${j}`).toBeCloseTo(j / (TAIL + 1), 12);
    expect(look(239).flow).toBeCloseTo(1 / (TAIL + 1), 12); // le dernier pas qui souffle : presque à l'arrêt
    expect(windBlows(level.winds[1]!, 239)).toBe(true);
    expect(windBlows(level.winds[1]!, 240)).toBe(false);
    expect(look(240).flow, "le pas où la rafale cesse").toBe(0);
    expect(look(240).blowing).toBe(false);
    for (let t = 240; t < 480; t++) expect(look(t).flow, `à l'arrêt t=${t}`).toBe(0);
    for (let t = 240; t < 480 - LEAD; t++) expect(look(t).announce, `calme t=${t}`).toBe(0);
    for (let j = 1; j <= LEAD; j++) expect(look(480 - j).announce, `frémit j=${j}`).toBeCloseTo(1 - j / (LEAD + 1), 12);
    expect(look(480)).toMatchObject({ blowing: true, flow: 1, announce: 0 }); // la rafale repart à pleine vitesse
  });

  it("le ralenti est continu et monotone, la vitesse des feuilles suit ; la force du vent de la simulation ne change pas", () => {
    const flows = Array.from({ length: 480 }, (_, t) => look(t).flow);
    for (let t = 240 - TAIL; t < 240; t++) expect(flows[t + 1]!).toBeLessThan(flows[t]!);
    const zone = level.winds[1]!;
    expect(flowStep(zone, 1, 1)).toBeCloseTo(WIND_FLOW, 12);
    expect(flowStep(zone, 0, 1)).toBe(0);
    expect(flowStep(zone, 0.5, 1)).toBeCloseTo(WIND_FLOW / 2, 12);
    // La physique du vent (poussée, `windBlows`) est celle de la simulation : le même interrupteur qu'avant, sans rampe.
    expect(windBlows(zone, 239)).toBe(true);
    expect(windBlows(zone, 240)).toBe(false);
  });

  it("les feuilles dessinées : immobiles dès que la rafale cesse, de moins en moins vite pendant le ralenti, pleine vitesse pendant la rafale", () => {
    const world = new Group();
    const art = createWindArt(world, level, false)!;
    const points = (world.children[0] as Group).children.find((c) => c instanceof Points) as Points;
    const pos = points.geometry.getAttribute("position").array as Float32Array;
    const budget = particleBudget(level, 1);
    const from = budget[0]!; // les particules de la zone 1 (la zone 0 souffle toujours)
    const to = from + budget[1]!;
    const len = 4; // rangées de la zone : 1 à 4
    const snapshots: Float32Array[] = [];
    let clock = 1;
    // On pose l'état pas à pas, au rythme de la simulation (120 images par seconde).
    for (let t = 0; t < 960; t++) {
      art.update(at(t % 480), (clock += 1 / TICK_RATE), 1, true, 40);
      snapshots.push(Float32Array.from(pos));
    }
    const moved = (t: number) => {
      let d = 0;
      for (let i = from; i < to; i++) {
        const raw = snapshots[t]![i * 3 + 1]! - snapshots[t - 1]![i * 3 + 1]!;
        const circular = Math.abs(((raw + len / 2 + len) % len) - len / 2); // la particule boucle dans la zone
        d = Math.max(d, circular, Math.abs(snapshots[t]![i * 3]! - snapshots[t - 1]![i * 3]!));
      }
      return d;
    };
    // Pleine vitesse pendant la rafale (hors ralenti) : elles avancent toutes de la même distance à chaque pas.
    const full = moved(100);
    expect(full).toBeGreaterThan(0.01);
    for (let t = 2; t < 240 - TAIL; t++) expect(moved(t), `pleine vitesse t=${t}`).toBeCloseTo(full, 3);
    // Le ralenti : de moins en moins de chemin à chaque pas…
    for (let t = 240 - TAIL + 1; t < 240; t++) expect(moved(t), `ralenti t=${t}`).toBeLessThan(moved(t - 1));
    // …et à l'arrêt exactement quand la rafale cesse (pas 240), jusqu'à ce qu'elle se mette à frémir.
    expect(art.stats.flow[1]).toBeGreaterThanOrEqual(0);
    for (let t = 240; t < 480 - LEAD; t++) expect(moved(t), `à l'arrêt t=${t}`).toBe(0);
    // Le frémissement : elles bougent un peu (sans avancer) avant le début, de plus en plus.
    expect(moved(479)).toBeGreaterThan(0);
    // Et la rafale suivante repart à pleine vitesse.
    expect(moved(480 + 100)).toBeCloseTo(full, 3);
  });

  it("le dessin lit la vitesse de la simulation : `stats.flow` vaut 0 au pas où la rafale cesse", () => {
    const art = createWindArt(new Group(), level, false)!;
    art.update(at(239), 1, 1, true, 40);
    expect(art.stats.flow[1]).toBeCloseTo(1 / (TAIL + 1), 12);
    art.update(at(240), 1.01, 1, true, 40);
    expect(art.stats.flow[1]).toBe(0);
    expect(art.stats.flow[0]).toBe(1); // la zone qui souffle toujours ne change pas
  });

  it("flèches du mouvement réduit (même logique) : éteintes, elles s'éclaircissent avant le début, sont allumées pendant la rafale, s'éteignent avant la fin — éteintes pile à l'arrêt", () => {
    const art = createWindArt(new Group(), level, false)!;
    const series: number[] = [];
    for (let t = 0; t < 480; t++) {
      art.update(at(t), 1 + t / TICK_RATE, 0, false, 40);
      series.push(art.stats.arrowOpacity[1]!);
      expect(art.stats.arrowOpacity[0], "la zone qui souffle toujours reste allumée").toBe(WIND_ARROW_ON);
    }
    for (let t = 0; t < 240 - TAIL; t++) expect(series[t], `allumées t=${t}`).toBe(WIND_ARROW_ON);
    for (let t = 240 - TAIL; t < 239; t++) expect(series[t + 1]!).toBeLessThan(series[t]!); // elles s'éteignent peu à peu
    expect(series[240], "au pas où la rafale cesse").toBe(WIND_ARROW_IDLE);
    for (let t = 240; t < 480 - LEAD; t++) expect(series[t], `éteintes t=${t}`).toBe(WIND_ARROW_IDLE);
    for (let t = 480 - LEAD; t < 479; t++) expect(series[t + 1]!).toBeGreaterThan(series[t]!); // elles s'éclaircissent avant le début
    expect(series[479]!).toBeLessThan(WIND_ARROW_ON);
    expect(arrowOpacity({ intensity: 1 })).toBe(WIND_ARROW_ON); // au pas du début : allumées
  });

  it("les durées d'annonce du vent se règlent ; une phase plus courte que l'annonce n'est annoncée que sur sa moitié", () => {
    ANNOUNCE.gustTail = 0.2;
    expect(look(239).flow).toBeCloseTo(1 / 25, 12);
    expect(look(240 - 25).flow).toBe(1);
    ANNOUNCE.gustTail = 0.4;
    const short = { cycle: 100, active: 40, shift: 0 }; // souffle 40 pas (ralenti sur 20), calme 60 (frémit sur 30)
    let tail = 0;
    let lead = 0;
    for (let p = 0; p < 100; p++) {
      const f = gustFeel(gustPhase(short, p), LEAD, TAIL);
      if (f.flow > 0 && f.flow < 1) tail++;
      if (f.lead > 0) lead++;
    }
    expect(tail).toBe(20);
    expect(lead).toBe(30);
  });

  it("aucun clignotement au-dessus de 3 Hz : vitesse, frémissement, intensité et flèches oscillent au plus une fois par cycle de 4 s", () => {
    const art = createWindArt(new Group(), level, false)!;
    const flow: number[] = [];
    const lead: number[] = [];
    const intensity: number[] = [];
    const arrows: number[] = [];
    for (let t = 0; t < 960; t++) {
      const l = look(t % 480);
      flow.push(l.flow);
      lead.push(l.announce);
      intensity.push(l.intensity);
      art.update(at(t % 480), 1 + t / TICK_RATE, 0, false, 40);
      arrows.push(art.stats.arrowOpacity[1]!);
    }
    for (const [name, series] of Object.entries({ flow, lead, intensity, arrows })) expect(peaksPerSecond(series), name).toBeLessThanOrEqual(FLICKER_MAX_HZ);
    expect(peaksPerSecond(flow)).toBeLessThan(1);
    expect(WIND_TREMBLE_RAD / (2 * Math.PI)).toBeLessThanOrEqual(FLICKER_MAX_HZ); // le frémissement lui-même : 2,9 Hz
    expect(gustIntensity(gustFeel(gustPhase(gust, 100), LEAD, TAIL), true)).toBe(1);
  });
});

describe("lot 18 — garde-fous", () => {
  it("aucune fréquence de scintillement dans le dessin des blocs et du vent : les sinus de l'horloge restent sous 3 Hz et aucune face ne bascule à l'horloge", () => {
    for (const file of ["dynamicArt.ts", "windArt.ts", "wind.ts", "blocks.ts"]) {
      const text = readFileSync(join(import.meta.dirname, "../src", file), "utf8");
      for (const m of text.matchAll(/Math\.sin\(\s*clock\s*\*\s*([0-9.]+)/g)) expect(Number(m[1]) / (2 * Math.PI), `${file} : sin(clock * ${m[1]})`).toBeLessThanOrEqual(FLICKER_MAX_HZ);
      expect(text, `${file} : un va-et-vient de l'horloge`).not.toMatch(/Math\.floor\(\s*clock\s*\*[^)]*\)\s*%\s*2/);
    }
  });

  it("`?debug&tune` : quatre curseurs de durée d'annonce, mémorisés comme les autres réglages de la caméra", () => {
    const keys = ["vanish", "appear", "gustLead", "gustTail"] as const;
    for (const k of keys) {
      const slider = CAMERA_SLIDERS.find((x) => x.key === k)!;
      expect(slider, k).toBeDefined();
      expect(slider.unit).toBe("s");
      expect(ANNOUNCE_DEFAULTS[k]).toBeGreaterThanOrEqual(slider.min);
      expect(ANNOUNCE_DEFAULTS[k]).toBeLessThanOrEqual(slider.max);
    }
    const store = { getItem: () => JSON.stringify({ vanish: 0.9, appear: 0.25, gustLead: 0, gustTail: 0.7, clockOpacity: 0.5, inconnue: 3 }) };
    loadCameraTune(store);
    expect(ANNOUNCE).toEqual({ vanish: 0.9, appear: 0.25, gustLead: 0, gustTail: 0.7 });
    expect(JSON.parse(cameraJson())).toMatchObject({ vanish: 0.9, appear: 0.25, gustLead: 0, gustTail: 0.7 });
    // Hors bornes : ignoré.
    Object.assign(ANNOUNCE, ANNOUNCE_DEFAULTS);
    loadCameraTune({ getItem: () => JSON.stringify({ vanish: 9 }) });
    expect(ANNOUNCE.vanish).toBe(ANNOUNCE_DEFAULTS.vanish);
  });
});
