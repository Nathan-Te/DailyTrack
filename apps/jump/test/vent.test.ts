import {
  DEFAULT_JUMP_PARAMS,
  INPUT_RIGHT,
  MODULES,
  MODULE_ENTRIES,
  buildModuleDef,
  decodeReplay,
  fromRuns,
  initialAttempt,
  moduleSolutions,
  moduleStart,
  parseLevel,
  stepAttempt,
  windActive,
  windBlows,
  type AttemptState,
  type Level,
  variantUsable,
} from "@cdj/jump-sim";
import { Group } from "three";
import { describe, expect, it } from "vitest";
import { soundFor } from "../src/audioLogic";
import { contrastRatio, hueDistance, hueOf } from "../src/contrast";
import { EVENT_KINDS, eventsBetween, type GameEvent } from "../src/events";
import { announceTicks, announceWindow } from "../src/announce";
import { Particles, feelColors, feelEvent } from "../src/feel";
import { defaultSettings, feelLevels } from "../src/settings";
import { HAZARD, PLAYER, THEMES, THEME_NAMES, backdropColors } from "../src/themes";
import { SCENARIOS, URL_OPTIONS, readUrlOptions } from "../src/urlOptions";
import {
  WIND_ARROW_IDLE,
  WIND_ARROW_ON,
  WIND_PARTICLES_MAX,
  WIND_RANGE,
  WIND_STYLE,
  WIND_VOICES,
  arrowLayout,
  arrowOpacity,
  gustTiming,
  particleBudget,
  windLooks,
  windMix,
  windParticle,
  type WindParticle,
} from "../src/wind";
import { createWindArt } from "../src/windArt";
import { hiddenWindDangers } from "../src/windSafety";

// Lot 13 : les courants d'air (forêt) vus par le jeu — couleurs réservées, aspect (souffle, annonce), événements, souffle spatialisé,
// particules plafonnées, flèches du mouvement réduit, et la règle « jamais poussé vers un danger qu'on ne voit pas » sur tout le catalogue.

const P = DEFAULT_JUMP_PARAMS;
const ROWS = [
  "##############################",
  "#............................#",
  "#............................#",
  "#............................#",
  "#S..........................F#",
  "##############################",
];
const level: Level = parseLevel(ROWS.join("\n") + "\n\nsection a 1-28\nvent 6-12 1-4 droite 100\nvent 16-24 1-4 haut 100 rafale 120 40 60\n");
const step = (s: AttemptState, bits: number) => stepAttempt(s, bits, level, P);

describe("couleurs réservées", () => {
  it("ni le rouge des dangers ni le jaune du personnage : teinte à au moins 30° de chacun (feuilles, pollen, flèches, contour)", () => {
    for (const c of Object.values(WIND_STYLE)) {
      expect(hueDistance(c, HAZARD), c.toString(16)).toBeGreaterThanOrEqual(30);
      expect(hueDistance(c, PLAYER), c.toString(16)).toBeGreaterThanOrEqual(30);
    }
    // Le pollen est presque blanc (peu de chroma) : il ne se confond avec rien de coloré.
    expect(hueOf(WIND_STYLE.pollen).chroma).toBeLessThan(0.1);
  });

  it("contrastes : feuilles, pollen, flèches et contour ≥ 3:1 avec le ciel et chaque plan de chaque thème", () => {
    for (const name of THEME_NAMES) {
      for (const b of backdropColors(THEMES[name])) {
        for (const c of Object.values(WIND_STYLE)) expect(contrastRatio(c, b), `${name} ${c.toString(16)} / ${b.toString(16)}`).toBeGreaterThanOrEqual(3);
      }
    }
  });
});

describe("aspect d'une zone", () => {
  it("`gustTiming` suit `windBlows` de la simulation au pas près, et compte les pas restants", () => {
    const z = level.winds[1]!;
    for (let p = 0; p < 360; p++) {
      const t = gustTiming(z.gust!, p);
      expect(t.blowing).toBe(windBlows(z, p));
      expect(windBlows(z, p + t.left - 1)).toBe(t.blowing);
      expect(windBlows(z, p + t.left)).toBe(!t.blowing);
    }
  });

  it("une zone sans rafale souffle toujours ; une rafale frémit pendant les pas qui précèdent son départ (de 0 à presque 1, sans à-coup)", () => {
    let s: AttemptState = { ...initialAttempt(level), status: 1, sections: [0], time: 0 };
    const seen: number[] = [];
    for (let t = 0; t < 240; t++) {
      const looks = windLooks(level, s);
      expect(looks[0]).toEqual({ blowing: true, announce: 0, flow: 1, intensity: 1 });
      const g = gustTiming(level.winds[1]!.gust!, s.time);
      // Lot 18 : 0,4 s (48 pas) avant le début, au plus la moitié de la phase calme (80 pas ici : 40).
      if (!g.blowing && g.left <= announceWindow(announceTicks("gustLead"), 80)) expect(looks[1]!.announce).toBeGreaterThan(0);
      else expect(looks[1]!.announce).toBe(0);
      seen.push(looks[1]!.announce);
      s = { ...s, time: s.time + 1 };
    }
    // L'annonce monte d'un pas à l'autre (jamais de retour en arrière avant la rafale).
    for (let k = 1; k < seen.length; k++) if (seen[k]! > 0 && seen[k - 1]! > 0) expect(seen[k]!).toBeGreaterThan(seen[k - 1]!);
    expect(Math.max(...seen)).toBeCloseTo(40 / 41, 10); // au dernier pas calme ; la rafale souffle au pas suivant
  });
});

describe("événements", () => {
  it("`ventDebut` à l'entrée d'une zone qui souffle, `ventFin` à la sortie ; trois noms de plus dans la liste", () => {
    for (const k of ["ventDebut", "ventFin", "rafale"] as const) expect(EVENT_KINDS).toContain(k);
    let s = initialAttempt(level);
    const events: GameEvent[] = [];
    for (let t = 0; t < 120; t++) {
      const n = step(s, INPUT_RIGHT);
      events.push(...eventsBetween(s, n, level, P, t));
      s = n;
    }
    const kinds = events.filter((e) => e.kind.startsWith("vent")).map((e) => `${e.kind}:${(e as { zone: number }).zone}`);
    expect(kinds.slice(0, 2)).toEqual(["ventDebut:0", "ventFin:0"]);
  });

  it("`rafale` : au pas exact où la rafale de la section courante part ; la mort ferme `ventDebut` (une `ventFin`)", () => {
    let s: AttemptState = { ...initialAttempt(level), status: 1 };
    const events: GameEvent[] = [];
    for (let t = 0; t < 400; t++) {
      const n = step(s, 0);
      events.push(...eventsBetween(s, n, level, P, t));
      s = n;
    }
    const gusts = events.filter((e) => e.kind === "rafale");
    expect(gusts.length).toBeGreaterThanOrEqual(2);
    for (const g of gusts) expect(g.tick % 120).toBe(60); // (phase + 60) mod 120 = 0 : la rafale part au pas 60 de chaque cycle
  });
});

describe("souffle spatialisé (trois voix, plus fort au centre d'une zone)", () => {
  const looks = windLooks(level, { ...initialAttempt(level), status: 1, sections: [0], time: 0 });
  it("au centre plus fort qu'au bord, au bord plus fort que dehors, rien au-delà de la portée ; trois voix au plus", () => {
    const at = (x: number, y: number) => windMix(level, looks, { x, y }).find((v) => v.index === 0)?.gain ?? 0;
    const center = at(9.5, 2.5);
    const edge = at(6.1, 2.5);
    const out = at(3, 2.5);
    expect(center).toBeGreaterThan(edge);
    expect(edge).toBeGreaterThan(out);
    expect(out).toBeGreaterThan(0);
    expect(at(6 - WIND_RANGE - 0.5, 2.5)).toBe(0);
    const many = parseLevel(ROWS.join("\n") + "\n\nvent 1-2 1-4 haut 100\nvent 3-4 1-4 haut 100\nvent 5-6 1-4 haut 100\nvent 7-8 1-4 haut 100\nvent 9-10 1-4 haut 100\n");
    expect(windMix(many, windLooks(many, initialAttempt(many)), { x: 5, y: 2 }).length).toBe(WIND_VOICES);
  });

  it("une rafale qui ne souffle pas murmure ; elle monte pendant l'annonce", () => {
    const quiet = { ...initialAttempt(level), status: 1, sections: [0], time: 0 } as AttemptState; // phase 0 : (0 + 60) mod 120 = 60 ≥ 40, ne souffle pas
    const l0 = windLooks(level, quiet);
    expect(l0[1]!.blowing).toBe(false);
    const a = windMix(level, l0, { x: 20, y: 2.5 }).find((v) => v.index === 1)!;
    const on = windMix(level, [l0[0]!, { blowing: true, announce: 0, flow: 1, intensity: 1 }], { x: 20, y: 2.5 }).find((v) => v.index === 1)!;
    const near = windMix(level, [l0[0]!, { blowing: false, announce: 0.8, flow: 0, intensity: 0.8 }], { x: 20, y: 2.5 }).find((v) => v.index === 1)!;
    expect(a.gain).toBeLessThan(near.gain);
    expect(near.gain).toBeLessThan(on.gain);
  });

  it("des sons pour `ventDebut` et `rafale`, discrets (sous le saut)", () => {
    const peak = (e: GameEvent) => Math.max(...(soundFor(e)?.layers.map((l) => l.gain) ?? [0]));
    const base = { tick: 0, source: "jeu" as const, x: 0, y: 0 };
    const jump = peak({ ...base, kind: "saut" });
    for (const e of [{ ...base, kind: "ventDebut" as const, zone: 0, dir: "haut" as const }, { ...base, kind: "rafale" as const, zone: 0, dir: "droite" as const }]) {
      expect(soundFor(e)).not.toBeNull();
      expect(peak(e)).toBeLessThan(jump);
    }
  });
});

describe("feuilles, pollen et flèches", () => {
  it("le nombre de particules est plafonné (par zone et en tout) ; aucune avec les particules coupées", () => {
    const big = parseLevel(["#".repeat(202), ...Array.from({ length: 40 }, (_, r) => (r === 38 ? `#S${".".repeat(198)}F#` : `#${".".repeat(200)}#`)), "#".repeat(202)].join("\n") + "\n\n" + Array.from({ length: 10 }, (_, k) => `vent ${1 + k * 20}-${18 + k * 20} 1-39 haut 100`).join("\n") + "\n");
    const b = particleBudget(big, 1);
    expect(b.reduce((s, n) => s + n, 0)).toBeLessThanOrEqual(WIND_PARTICLES_MAX);
    expect(particleBudget(big, 0).every((n) => n === 0)).toBe(true);
  });

  it("une particule reste dans sa zone, circule dans le sens du vent, et sa position est une fonction pure du flux", () => {
    const z = level.winds[0]!; // droite
    const p: WindParticle = { x: 0, y: 0, angle: 0, alpha: 0, size: 0, kind: 0 };
    const q: WindParticle = { ...p };
    for (let k = 0; k < 10; k++) {
      windParticle(z, 0, k, 1.3, 2, 3, 1, 0, p);
      windParticle(z, 0, k, 1.3, 2, 3, 1, 0, q);
      expect(p).toEqual(q);
      expect(p.x).toBeGreaterThanOrEqual(z.c0);
      expect(p.x).toBeLessThanOrEqual(z.c1 + 1);
      const before = p.x;
      windParticle(z, 0, k, 1.4, 2, 3, 1, 0, p);
      if (Math.abs(p.x - before) < 1) expect(p.x).toBeGreaterThan(before);
    }
  });

  it("flèches : une au moins par zone, dans le sens du vent ; allumées quand la zone souffle, éteintes sinon, plus claires pendant l'annonce", () => {
    for (const z of level.winds) {
      const a = arrowLayout(z);
      expect(a.length).toBeGreaterThan(0);
      for (const f of a) expect([f.dx, f.dy]).toEqual(z.dir === 1 ? [0, 1] : z.dir === 2 ? [-1, 0] : [1, 0]);
    }
    expect(arrowOpacity({ intensity: 1 })).toBe(WIND_ARROW_ON);
    expect(arrowOpacity({ intensity: 0 })).toBe(WIND_ARROW_IDLE);
    expect(arrowOpacity({ intensity: 0.5 })).toBeGreaterThan(WIND_ARROW_IDLE);
    expect(arrowOpacity({ intensity: 0.5 })).toBeLessThan(WIND_ARROW_ON);
  });

  it("le dessin : particules avec les effets, flèches sans (mouvement réduit, effets « aucun ») ; rien pour un niveau sans vent", () => {
    const art = createWindArt(new Group(), level, false)!;
    const s: AttemptState = { ...initialAttempt(level), status: 1, sections: [0], time: 0 };
    art.update(s, 0.5, 1, true, 40);
    expect(art.stats.mode).toBe("particules");
    expect(art.stats.particles).toBeGreaterThan(0);
    expect(art.stats.arrows).toBe(0);
    art.update(s, 0.6, 0, false, 40);
    expect(art.stats.mode).toBe("fleches");
    expect(art.stats.particles).toBe(0);
    expect(art.stats.arrows).toBeGreaterThan(0);
    expect(art.stats.arrowOpacity[0]).toBe(WIND_ARROW_ON);
    expect(art.stats.arrowOpacity[1]).toBe(WIND_ARROW_IDLE);
    // `?fx=off` et « effets : aucun » : pas de particules, donc les flèches.
    const off = feelLevels(defaultSettings(), false);
    art.update(s, 0.7, off.particles, off.animate, 40);
    expect(art.stats.mode).toBe("fleches");
    expect(createWindArt(new Group(), parseLevel(ROWS.join("\n")), false)).toBeNull();
  });

  it("`ventDebut` et `rafale` lancent quelques feuilles (et rien avec les particules coupées)", () => {
    const colors = feelColors(THEMES.foret.palette);
    const levels = feelLevels(defaultSettings());
    const pool = new Particles(64);
    feelEvent({ kind: "rafale", zone: 0, dir: "droite", tick: 0, source: "jeu", x: 3, y: 2 }, pool, colors, levels);
    expect(pool.alive).toBeGreaterThan(0);
    const none = new Particles(64);
    none.amount = 0;
    feelEvent({ kind: "ventDebut", zone: 0, dir: "haut", tick: 0, source: "jeu", x: 3, y: 2 }, none, colors, levels);
    expect(none.alive).toBe(0);
  });
});

describe("règle : jamais poussé vers un danger qu'on ne voit pas", () => {
  it("la règle voit un danger caché : une rafale qui pousse vers des pics à 20 tuiles", () => {
    const rows = Array.from({ length: 8 }, () => `#${".".repeat(60)}#`);
    rows[0] = "#".repeat(62);
    rows[6] = `#S${".".repeat(30)}^^^^${".".repeat(24)}F#`;
    rows[7] = "#".repeat(62);
    const bad = parseLevel(rows.join("\n") + "\n\nvent 4-50 1-6 droite 100\n");
    const states: AttemptState[] = [initialAttempt(bad)];
    for (let t = 0; t < 60; t++) states.push(stepAttempt(states[states.length - 1]!, INPUT_RIGHT, bad, P));
    expect(hiddenWindDangers(bad, states).length).toBeGreaterThan(0);
  });

  it("sur tout le catalogue : chaque variante à zone de vent, ses deux solutions, caméra du téléphone en paysage", () => {
    let checked = 0;
    for (const def of MODULES) {
      for (let v = 0; v < def.variants.length; v++) {
        const m = buildModuleDef(def, v);
        if (m.level.winds.length === 0) continue;
        // Lot 30 : les variantes écartées du catalogue (sans solution qui tienne la règle des appuis) n'ont rien à vérifier.
        if (!variantUsable(def.id, v)) continue;
        const sol = moduleSolutions(def.id, v);
        for (const entry of MODULE_ENTRIES) {
          const s = sol?.[entry];
          expect(s, `${def.id} v${v} ${entry}`).toBeTruthy();
          const inputs = fromRuns(decodeReplay(s!.code).runs);
          const states: AttemptState[] = [moduleStart(m, entry)];
          for (const bits of inputs) states.push(stepAttempt(states[states.length - 1]!, bits, m.level, P));
          const hidden = hiddenWindDangers(m.level, states);
          expect(hidden, `${def.id} v${v} ${entry} : ${JSON.stringify(hidden.slice(0, 3))}`).toEqual([]);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(2 * 20);
  });
});

describe("adresse", () => {
  it("`?scenario=vent` (galerie des courants d'air) est une option documentée", () => {
    expect(SCENARIOS).toContain("vent");
    expect(URL_OPTIONS.find((o) => o.name === "scenario")!.description).toMatch(/vent/);
    expect(readUrlOptions("?scenario=vent").scenario).toBe("vent");
  });

  it("une zone se lit dans la simulation au même pas que l'aspect dessiné", () => {
    let s: AttemptState = { ...initialAttempt(level), status: 1, sections: [0], time: 0 };
    for (let t = 0; t < 200; t++) {
      expect(windLooks(level, s)[1]!.blowing).toBe(windActive(level, s, 1));
      s = step(s, 0);
    }
  });
});
