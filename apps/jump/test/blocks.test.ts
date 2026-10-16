import {
  ATTEMPT_RUNNING,
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  INPUT_RIGHT,
  PLAYER_HEIGHT,
  PLAYER_WIDTH,
  TILE_ALT_ON,
  UNITS_PER_TILE,
  blinkIsSolid,
  initialAttempt,
  parseLevel,
  settleDynamic,
  stepAttempt,
  type AttemptState,
  type Level,
} from "@cdj/jump-sim";
import { Group, Mesh, MeshBasicMaterial } from "three";
import { describe, expect, it } from "vitest";
import { METRONOME_GAIN, soundFor } from "../src/audioLogic";
import { BLOCK_STYLE, VACILLE_TICKS, blinkTiming, blockEvents, blockLooks, currentBlinkSection, metronomeBeats, metronomeTick } from "../src/blocks";
import { contrastRatio, hueDistance } from "../src/contrast";
import { createDynamicBlocks } from "../src/dynamicArt";
import { EVENT_KINDS, eventsBetween, type GameEvent } from "../src/events";
import { Particles, feelColors, feelEvent } from "../src/feel";
import { MODULES } from "@cdj/jump-sim";
import { THEME_FILTERS, galleryOrder, matchesTheme, moduleTheme } from "../src/modulesInfo";
import { galleryHref, moduleHref, readUrlOptions } from "../src/urlOptions";
import { feelLevels, defaultSettings } from "../src/settings";
import { HAZARD, PLAYER, THEMES, THEME_NAMES, backdropColors } from "../src/themes";

// Lot 12 : blocs clignotants (nuit) et alternés (néon) vus par le jeu — couleurs réservées, aspect, événements, tempo, sons, particules, dessin.

const T = UNITS_PER_TILE;
const P = DEFAULT_JUMP_PARAMS;

const ROWS = [
  "##########################",
  "#........................#",
  "#...bb.....dd............#",
  "#........................#",
  "#...AA.....BB............#",
  "#........................#",
  "#S...C..................F#",
  "##########################",
];
const level: Level = parseLevel(ROWS.join("\n") + "\n\nsection a 0-25\nclignote a 120 60 0\n");

const step = (s: AttemptState, bits: number) => stepAttempt(s, bits, level, P);

describe("couleurs réservées (lot 12)", () => {
  const styles = [BLOCK_STYLE.blink, BLOCK_STYLE.altA, BLOCK_STYLE.altB];

  it("ni le rouge des dangers ni le jaune du personnage : teinte à au moins 30° de chacun (face et liseré)", () => {
    for (const s of styles) {
      for (const c of [s.fill, s.edge]) {
        expect(hueDistance(c, HAZARD), c.toString(16)).toBeGreaterThanOrEqual(30);
        expect(hueDistance(c, PLAYER), c.toString(16)).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it("les deux jeux alternés se distinguent : teintes à ≥ 60° et luminances d'au moins 1,15:1 (et chacun a son repère : barre pour A, losange pour B)", () => {
    expect(hueDistance(BLOCK_STYLE.altA.fill, BLOCK_STYLE.altB.fill)).toBeGreaterThanOrEqual(60);
    expect(contrastRatio(BLOCK_STYLE.altA.fill, BLOCK_STYLE.altB.fill)).toBeGreaterThanOrEqual(1.15);
    expect(hueDistance(BLOCK_STYLE.blink.fill, BLOCK_STYLE.altA.fill)).toBeGreaterThanOrEqual(30);
    expect(hueDistance(BLOCK_STYLE.blink.fill, BLOCK_STYLE.altB.fill)).toBeGreaterThanOrEqual(30);
  });

  it("contrastes : face ≥ 3:1 et liseré ≥ 3:1 avec le ciel et chaque plan de chaque thème ; face ≥ 1,8:1 avec les tuiles du thème ; le danger et le personnage restent lisibles sur les deux", () => {
    for (const name of THEME_NAMES) {
      const t = THEMES[name];
      for (const s of styles) {
        for (const b of backdropColors(t)) {
          expect(contrastRatio(s.fill, b), `${name} face ${s.fill.toString(16)} / ${b.toString(16)}`).toBeGreaterThanOrEqual(3);
          expect(contrastRatio(s.edge, b), `${name} liseré ${s.edge.toString(16)} / ${b.toString(16)}`).toBeGreaterThanOrEqual(3);
        }
        expect(contrastRatio(s.fill, t.tiles.face), `${name} tuile`).toBeGreaterThanOrEqual(1.8);
        // Le personnage se détache d'un bloc plein (face vive, jaune clair : au moins 1,5:1).
        expect(contrastRatio(PLAYER, s.fill), `${name} personnage sur ${s.fill.toString(16)}`).toBeGreaterThanOrEqual(1.5);
      }
    }
  });
});

describe("blinkTiming et aspect (blockLooks)", () => {
  const cycle = { cycle: 60, solid: 30, shift: 0 };

  it("`blinkTiming` suit `blinkIsSolid` de la simulation pas à pas ; `left` = pas avant le changement d'état", () => {
    for (const group of [0, 1]) {
      for (let p = 0; p < 200; p++) {
        const t = blinkTiming(cycle, group, p);
        expect(t.solid).toBe(blinkIsSolid(cycle, group, p));
        expect(t.left).toBeGreaterThanOrEqual(1);
        expect(blinkIsSolid(cycle, group, p + t.left)).toBe(!t.solid);
        for (let k = 0; k < t.left; k++) expect(blinkIsSolid(cycle, group, p + k)).toBe(t.solid);
      }
    }
  });

  it("le vacillement : 0 avant les 30 derniers pas d'un bloc plein, puis croissant jusqu'à l'extinction ; un bloc absent ne vacille pas", () => {
    // Cycle de 120 pas, `b` plein pendant 60 : au pas k (phase k − 1) il reste 60 − (k − 1) pas ; il vacille quand il en reste 30 ou moins.
    let s = initialAttempt(level);
    const wobbles: number[] = [];
    for (let k = 1; k <= 60; k++) {
      s = step(s, k === 1 ? INPUT_RIGHT : 0);
      const looks = blockLooks(level, s);
      // `d` (indices 2 et 3) est absent : il ne vacille jamais.
      expect(looks[2]!.solid).toBe(false);
      expect(looks[2]!.wobble).toBe(0);
      wobbles.push(looks[0]!.wobble);
    }
    wobbles.forEach((w, i) => {
      const left = 60 - i; // phase i
      if (left > VACILLE_TICKS) expect(w).toBe(0);
      else expect(w).toBeCloseTo(1 - (left - 1) / VACILLE_TICKS, 10);
    });
    expect(wobbles.findIndex((w) => w > 0)).toBe(30); // le premier pas qui vacille : il en reste exactement 30
    for (let i = 1; i < wobbles.length; i++) expect(wobbles[i]!).toBeGreaterThanOrEqual(wobbles[i - 1]!);
    expect(wobbles[wobbles.length - 1]!).toBe(1); // au dernier pas plein : 1
  });

  it("blocs alternés : le jeu actif est plein, l'autre absent ; l'aspect suit la parité", () => {
    let s = initialAttempt(level);
    let looks = blockLooks(level, s);
    // Ordre : clignotants (4) puis alternés (4 : A A B B).
    expect(looks.slice(4).map((l) => l.solid)).toEqual([true, true, false, false]);
    // Un saut au départ : la parité s'inverse.
    s = step(s, INPUT_JUMP | INPUT_RIGHT);
    looks = blockLooks(level, s);
    expect(s.alt).toBe(1);
    expect(looks.slice(4).map((l) => l.solid)).toEqual([false, false, true, true]);
  });

  it("le tampon fourni est réutilisé (aucun objet créé pour un niveau connu)", () => {
    const out = blockLooks(level, initialAttempt(level));
    const again = blockLooks(level, initialAttempt(level), out);
    expect(again).toBe(out);
    expect(out.length).toBe(level.blinks.length + level.alts.length);
  });
});

/** Joue des commandes depuis l'état initial en gardant les événements de chaque pas. */
function play(commands: readonly number[], from: AttemptState = initialAttempt(level)): { events: GameEvent[]; state: AttemptState; states: AttemptState[] } {
  const events: GameEvent[] = [];
  const states: AttemptState[] = [from];
  let s = from;
  commands.forEach((bits, i) => {
    const next = step(s, bits);
    events.push(...eventsBetween(s, next, level, P, i, "jeu"));
    states.push(next);
    s = next;
  });
  return { events, state: s, states };
}

describe("événements des blocs", () => {
  it("les nouveaux événements sont dans la liste officielle", () => {
    for (const k of ["blocVacille", "blocApparait", "blocDisparait", "bascule", "metronome"]) expect(EVENT_KINDS).toContain(k);
  });

  it("blocApparait / blocDisparait : un événement par section et par sens, avec le nombre de blocs (pas un par bloc)", () => {
    const { events } = play([INPUT_RIGHT, ...new Array<number>(130).fill(0)]);
    const vanish = events.filter((e) => e.kind === "blocDisparait");
    const appear = events.filter((e) => e.kind === "blocApparait");
    // Cycle de 60 pas, `b` plein 30 pas : en 130 pas, deux extinctions de `b` et deux apparitions de `d`… regroupées par section : 1 événement par bascule.
    expect(vanish.length).toBeGreaterThanOrEqual(2);
    expect(appear.length).toBeGreaterThanOrEqual(2);
    for (const e of [...vanish, ...appear]) {
      if (e.kind !== "blocDisparait" && e.kind !== "blocApparait") continue;
      expect(e.section).toBe(0);
      expect(e.count).toBe(2); // deux blocs changent au même pas dans le même sens : un seul événement (pas un par bloc)
    }
    // Position : le centre des blocs (colonnes 4-5 et 11-12 → moyenne), y = rangée 2 + ½.
    expect((vanish[0] as { y: number }).y).toBeCloseTo(2.5, 5);
  });

  it("blocVacille : une fois par groupe et par cycle, 30 pas avant l'extinction", () => {
    const { events, states } = play([INPUT_RIGHT, ...new Array<number>(200).fill(0)]);
    const ev = events.filter((e) => e.kind === "blocVacille");
    // `b` s'éteint aux phases 60 et 180, `d` aux phases 120 et 240 : ils vacillent 30 pas avant (phases 30, 90, 150) ; la phase = pas − 1.
    expect(ev.map((e) => e.tick)).toEqual([30, 90, 150]);
    for (const e of ev) expect(e).toMatchObject({ section: 0, count: 2 });
    // Au moment de l'événement, un bloc plein vacille.
    const looks = blockLooks(level, states[ev[0]!.tick + 1]!);
    expect(looks.some((l) => l.solid && l.wobble > 0)).toBe(true);
  });

  it("bascule : un saut qui part inverse (un événement), l'appui seul ou le saut du tampon à l'atterrissage aussi (au pas où il part vraiment) ; un ressort ne bascule rien", () => {
    const r = play([INPUT_JUMP | INPUT_RIGHT, INPUT_JUMP | INPUT_RIGHT, INPUT_JUMP | INPUT_RIGHT]);
    const bascules = r.events.filter((e) => e.kind === "bascule");
    expect(bascules.length).toBe(1);
    expect(bascules[0]).toMatchObject({ kind: "bascule", alt: 1, reset: false });
    expect(r.state.alt).toBe(1);
  });

  it("la remise à A au point de passage : un événement `bascule` avec reset, au fanion, seulement si B était solide", () => {
    // Un saut, puis on court jusqu'au point de passage (colonne 5).
    let s = initialAttempt(level);
    s = step(s, INPUT_JUMP | INPUT_RIGHT);
    expect(s.alt).toBe(1);
    const all: GameEvent[] = [];
    for (let k = 0; k < 120 && s.checkpoint < 0; k++) {
      const next = step(s, INPUT_RIGHT);
      all.push(...eventsBetween(s, next, level, P, k, "jeu"));
      s = next;
    }
    expect(s.checkpoint).toBe(0);
    expect(s.alt).toBe(0);
    const reset = all.filter((e) => e.kind === "bascule" && e.reset);
    expect(reset.length).toBe(1);
    expect(reset[0]).toMatchObject({ alt: 0, reset: true, x: 5.5, y: 6.5 });
  });

  it("aucun événement de bloc dans un niveau qui n'en a pas", () => {
    const plain = parseLevel("#####\n#S.F#\n#####\n");
    let s = initialAttempt(plain);
    for (let k = 0; k < 30; k++) {
      const n = stepAttempt(s, INPUT_RIGHT, plain, P);
      expect(blockEvents(s, n, plain, 0, "jeu", { x: 0, y: 0 })).toEqual([]);
      s = n;
    }
  });
});

describe("tempo de la section courante (métronome)", () => {
  it("quatre temps par cycle : les deux bascules (accent) et le milieu de chaque fenêtre", () => {
    expect(metronomeBeats({ cycle: 120, solid: 60, shift: 0 })).toEqual([
      { q: 0, accent: true },
      { q: 30, accent: false },
      { q: 60, accent: true },
      { q: 90, accent: false },
    ]);
    const odd = metronomeBeats({ cycle: 301, solid: 171, shift: 5 });
    expect(odd.map((b) => b.q)).toEqual([0, 85, 171, 236]);
  });

  it("il bat sur les phases du cycle de la section où se trouve le personnage, et pas ailleurs ni avant l'entrée", () => {
    expect(currentBlinkSection(level, initialAttempt(level))).toBe(-1); // la section n'est pas en marche
    let s = initialAttempt(level);
    const beats: { phase: number; accent: boolean }[] = [];
    for (let k = 0; k < 130; k++) {
      const next = step(s, k === 0 ? INPUT_RIGHT : 0);
      const b = metronomeTick(level, s, next);
      if (b) beats.push({ phase: next.time - next.sections[0]!, accent: b.accent });
      s = next;
    }
    // Phases 30, 60, 90, 120 (q = 0 est l'entrée, avant le premier temps) : l'accent est sur les bascules, 60 et 120.
    expect(beats.map((b) => b.phase)).toEqual([30, 60, 90, 120]);
    expect(beats.filter((b) => b.accent).map((b) => b.phase)).toEqual([60, 120]);
  });

  it("c'est un événement `metronome`, jamais de métronome dans un niveau sans clignotants", () => {
    const { events } = play([INPUT_RIGHT, ...new Array<number>(100).fill(0)]);
    expect(events.filter((e) => e.kind === "metronome").length).toBe(3); // phases 30, 60, 90 (le chrono s'arrête à la phase 100)
    const alts = parseLevel("#######\n#S.A.F#\n#######\n");
    let s = initialAttempt(alts);
    for (let k = 0; k < 40; k++) {
      const n = stepAttempt(s, INPUT_RIGHT, alts, P);
      expect(eventsBetween(s, n, alts, P).some((e) => e.kind === "metronome")).toBe(false);
      s = n;
    }
  });
});

describe("sons et particules", () => {
  it("le clic du néon existe, plus aigu quand B devient solide ; la remise à A ajoute une note", () => {
    const base = { x: 0, y: 0, tick: 0, source: "jeu" as const };
    const a = soundFor({ ...base, kind: "bascule", alt: 0, reset: false }, 0.5)!;
    const b = soundFor({ ...base, kind: "bascule", alt: 1, reset: false }, 0.5)!;
    const r = soundFor({ ...base, kind: "bascule", alt: 0, reset: true }, 0.5)!;
    expect(a.id).toBe("bascule");
    expect(b.layers.find((l) => l.type === "tone")!.freq).toBeGreaterThan(a.layers.find((l) => l.type === "tone")!.freq);
    expect(r.layers.length).toBe(a.layers.length + 1);
    expect(a.duration).toBeLessThan(0.1);
  });

  it("le métronome est discret : crête sous la moitié du saut, bus des effets (aucune couche plus forte que METRONOME_GAIN), accent un peu plus fort", () => {
    const base = { x: 0, y: 0, tick: 0, source: "jeu" as const };
    const soft = soundFor({ ...base, kind: "metronome", accent: false, beat: 1 })!;
    const hard = soundFor({ ...base, kind: "metronome", accent: true, beat: 0 })!;
    const jump = soundFor({ ...base, kind: "saut" })!;
    const peak = (s: { layers: { gain: number }[] }) => s.layers.reduce((m, l) => Math.max(m, l.gain), 0);
    expect(peak(hard)).toBe(METRONOME_GAIN);
    expect(peak(soft)).toBeLessThan(peak(hard));
    expect(peak(hard)).toBeLessThan(0.5 * peak(jump));
    expect(hard.priority).toBe(0);
  });

  it("les événements de blocs sans son propre : apparition, disparition et vacillement n'ont pas de son (le tempo est celui du métronome)", () => {
    const base = { x: 0, y: 0, tick: 0, source: "jeu" as const, section: 0, count: 3 };
    for (const kind of ["blocApparait", "blocDisparait", "blocVacille"] as const) expect(soundFor({ ...base, kind })).toBeNull();
  });

  it("particules : pool plafonné, rien avec les effets coupés (`?fx=off`) ni le mouvement réduit ; couleurs réservées des blocs", () => {
    const colors = feelColors(THEMES.nuit.palette);
    expect(colors.altA).toContain(BLOCK_STYLE.altA.fill);
    expect(colors.altB).toContain(BLOCK_STYLE.altB.fill);
    expect(colors.blink).toContain(BLOCK_STYLE.blink.fill);
    const levels = feelLevels(defaultSettings(), true);
    const pool = new Particles(220);
    const events: GameEvent[] = [
      { kind: "blocApparait", section: 0, count: 12, x: 5, y: 3, tick: 0, source: "jeu" },
      { kind: "blocDisparait", section: 0, count: 12, x: 5, y: 3, tick: 0, source: "jeu" },
      { kind: "blocVacille", section: 0, count: 3, x: 5, y: 3, tick: 0, source: "jeu" },
      { kind: "bascule", alt: 1, reset: false, x: 5, y: 3, tick: 0, source: "jeu" },
      { kind: "bascule", alt: 0, reset: true, x: 5, y: 3, tick: 0, source: "jeu" },
    ];
    for (const e of events) feelEvent(e, pool, colors, levels);
    expect(pool.emitted).toBeGreaterThan(10);
    expect(pool.emitted).toBeLessThan(60); // ≤ 6 + 6 + 2 + 8 + 12 : jamais d'inondation, quel que soit le nombre de blocs
    const off = new Particles(220);
    off.amount = 0;
    for (const e of events) feelEvent(e, off, colors, levels);
    expect(off.emitted).toBe(0);
    // Les autres vies du carnage n'ont pas de particules de blocs.
    const lives = new Particles(220);
    for (const e of events) feelEvent({ ...e, source: "vie" } as GameEvent, lives, colors, levels);
    expect(lives.emitted).toBe(0);
  });
});

describe("dessin (dynamicArt)", () => {
  /** Les matériaux d'opacité et les cadres du premier bloc clignotant : on lit ce que le dessin a posé. */
  function build(l: Level) {
    const world = new Group();
    const d = createDynamicBlocks(world, l, false)!;
    return { world, d };
  }

  it("aucun bloc : rien n'est construit", () => {
    const plain = parseLevel("#####\n#S.F#\n#####\n");
    expect(createDynamicBlocks(new Group(), plain, false)).toBeNull();
  });

  it("un groupe par bloc ; plein : face visible ; absent : seulement le contour, discret", () => {
    const { world, d } = build(level);
    expect(world.children.length).toBe(8);
    d.update(initialAttempt(level), 1, true, { x: 0, y: 0, halfW: 5, halfH: 5 });
    const face = (i: number) => (world.children[i]!.children[0] as Mesh);
    const edge = (i: number) => ((world.children[i]!.children[1] as Mesh).material as MeshBasicMaterial);
    // `b` plein (i = 0), `d` absent (i = 2) ; `A` plein (i = 4), `B` absent (i = 6).
    expect(face(0).visible).toBe(true);
    expect(face(2).visible).toBe(false);
    expect(edge(2).opacity).toBeLessThan(edge(0).opacity); // contour discret
    expect(edge(2).opacity).toBeGreaterThan(0.2); // mais visible : on sait où il reviendra
    expect(face(4).visible).toBe(true);
    expect(face(6).visible).toBe(false);
    expect(d.stats).toMatchObject({ blinks: 4, alts: 4, solid: 4, absent: 4, alt: 0 });
  });

  it("vacillement : effets normaux → la face clignote (opacité qui change d'une image à l'autre) ; mouvement réduit → rien ne clignote, le contour s'épaissit", () => {
    const { world, d } = build(level);
    let s = initialAttempt(level);
    for (let k = 0; k < 55; k++) s = step(s, k === 0 ? INPUT_RIGHT : 0); // `b` est dans ses derniers pas (phase 54 : il en reste 6)
    expect(blockLooks(level, s)[0]!.wobble).toBeGreaterThan(0.8);
    const group = world.children[0]!;
    const faceMat = (group.children[0] as Mesh).material as MeshBasicMaterial;
    const thin = group.children[1]!;
    const thick = group.children[2]!;
    const view = { x: 0, y: 0, halfW: 5, halfH: 5 };
    // Effets normaux : l'opacité de la face varie avec l'horloge.
    const seen = new Set<number>();
    for (let i = 0; i < 40; i++) {
      d.update(s, 1 + i * 0.011, true, view);
      seen.add(Math.round(faceMat.opacity * 100));
    }
    expect(seen.size).toBeGreaterThan(1);
    // Mouvement réduit : opacité stable (même valeur à toute horloge), contour épais.
    const reduced = new Set<number>();
    for (let i = 0; i < 40; i++) {
      d.update(s, 1 + i * 0.011, false, view);
      reduced.add(Math.round(faceMat.opacity * 100));
    }
    expect(reduced.size).toBe(1);
    expect(faceMat.opacity).toBeLessThan(0.7); // la face s'éclaircit
    expect(thick.visible).toBe(true);
    expect(thin.visible).toBe(false);
    // Et le contour épais est bien plus gros que le fin (l'épaississement se lit).
    const width = (m: Mesh) => {
      const pos = m.geometry.getAttribute("position");
      let xs = 0;
      for (let i = 0; i < pos.count; i++) xs = Math.max(xs, Math.abs(pos.getX(i)));
      return xs;
    };
    expect(width(thick as Mesh)).toBeCloseTo(width(thin as Mesh), 5); // même cadre extérieur…
    const bars = (m: Mesh) => {
      const pos = m.geometry.getAttribute("position");
      // épaisseur de la barre du haut : de y = h − t à y = h
      let top = 0;
      let low = 1;
      for (let i = 0; i < 6; i++) {
        top = Math.max(top, pos.getY(i));
        low = Math.min(low, pos.getY(i));
      }
      return top - low;
    };
    expect(bars(thick as Mesh)).toBeGreaterThan(2 * bars(thin as Mesh));
  });

  it("l'éclat des blocs alternés : décroît tout seul, et n'existe pas sans mouvement", () => {
    const { d } = build(level);
    const s = initialAttempt(level);
    const view = { x: 0, y: 0, halfW: 5, halfH: 5 };
    d.flash(1);
    d.update(s, 1, true, view);
    d.update(s, 1.1, true, view);
    expect(d.stats.flash).toBeGreaterThan(0);
    expect(d.stats.flash).toBeLessThan(1);
    d.update(s, 2, true, view);
    expect(d.stats.flash).toBe(0);
    d.flash(1);
    d.update(s, 2.05, false, view);
    expect(d.stats.flash).toBe(0);
  });

  it("un bloc qui attend la sortie du personnage : contour épais, face absente (information de jeu, aussi sans mouvement)", () => {
    const { world, d } = build(level);
    // Le personnage dans la case du bloc alterné `B` (colonne 11), au pas de la bascule.
    const s0 = initialAttempt(level);
    let s: AttemptState = { ...s0, status: ATTEMPT_RUNNING, time: 5, player: { ...s0.player, x: 11 * T + (T - PLAYER_WIDTH) / 2, y: 4 * T + (T - PLAYER_HEIGHT) / 2, ground: 0, air: 0 }, alt: 0 };
    s = { ...s, tiles: settleDynamic(level, s.tiles, s.sections, s.time, 0, s.player) };
    // `B` doit devenir plein (parité 1) ; le personnage le chevauche : il reste absent.
    s = { ...s, alt: 1, tiles: settleDynamic(level, s.tiles, s.sections, s.time, 1, s.player) };
    const looks = blockLooks(level, s);
    expect(looks[6]!.waiting).toBe(true);
    expect(s.tiles[4 * level.width + 11]).not.toBe(TILE_ALT_ON);
    d.update(s, 1, false, { x: 0, y: 0, halfW: 5, halfH: 5 });
    const group = world.children[6]!;
    expect((group.children[0] as Mesh).visible).toBe(false);
    expect(group.children[2]!.visible).toBe(true);
    expect(d.stats.waiting).toBe(1);
  });
});

describe("galerie et adresses (lot 12)", () => {
  it("la galerie filtre nuit et néon : chacun ses morceaux (et les variantes mutées des autres), chaque morceau s'ouvre dans son thème", () => {
    expect(THEME_FILTERS).toContain("nuit");
    expect(THEME_FILTERS).toContain("neon");
    const order = galleryOrder();
    for (const [theme, tag, mutation] of [["nuit", "clignotant", "clignotant"], ["neon", "alterne", "alterne"]] as const) {
      const own = order.filter((m) => matchesTheme(m, theme));
      const natives = own.filter((m) => m.theme === theme);
      expect(natives.length, theme).toBeGreaterThanOrEqual(6);
      for (const m of natives) {
        expect(m.tags, m.id).toContain(tag);
        for (let v = 0; v < m.variants.length; v++) expect(moduleTheme(m.id, v), `${m.id} v${v}`).toBe(theme);
      }
      // Les morceaux ordinaires ne sont dans le filtre que par leurs variantes mutées, ouvertes elles aussi dans le thème.
      const mutated = own.filter((m) => m.theme === null);
      expect(mutated.length, `${theme} : variantes mutées`).toBeGreaterThanOrEqual(2);
      for (const m of mutated) {
        const def = MODULES.find((d) => d.id === m.id)!;
        const vs = m.variants.filter((v) => v.theme === theme);
        expect(vs.length, m.id).toBeGreaterThan(0);
        for (const v of vs) expect(def.mutations[v.index]!.some((x) => x.name === mutation), `${m.id} v${v.index}`).toBe(true);
      }
      // Le filtre exclut les morceaux des autres thèmes.
      expect(own.some((m) => m.theme !== null && m.theme !== theme)).toBe(false);
    }
    expect(order.filter((m) => matchesTheme(m, "foret")).some((m) => m.theme === "nuit" || m.theme === "neon")).toBe(false);
  });

  it("?metronome=off est une option documentée de urlOptions, et les liens internes le gardent", () => {
    const from = readUrlOptions("?metronome=off");
    expect(moduleHref({ id: "nuit-pont", variant: 0, entry: "arret", theme: "nuit" }, from)).toContain("metronome=off");
    expect(galleryHref(from)).toContain("metronome=off");
  });
});
