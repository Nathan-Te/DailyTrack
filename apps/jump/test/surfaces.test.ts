import { daysFromCivil } from "@cdj/core";
import {
  ATTEMPT_FINISHED,
  DEFAULT_JUMP_PARAMS,
  JUMP_THEME_NAMES,
  PREMIER_JOUR_JUMP,
  SURFACE_DEFAULTS,
  TILE_BELT_LEFT,
  TILE_BELT_RIGHT,
  TILE_ICE,
  TILE_SOLID,
  groundTile,
  initialAttempt,
  isDefaultJumpParams,
  isSolidTile,
  jumpThemeForDay,
  mechanicOf,
  parseLevel,
  stepAttempt,
  type AttemptState,
  type JumpParams,
  type Level,
} from "@cdj/jump-sim";
import { INPUT_LEFT, INPUT_RIGHT } from "@cdj/jump-sim";
import { describe, expect, it } from "vitest";
import {
  BELT_GAIN,
  BELT_RANGE,
  BELT_VOICES,
  CARNAGE_SOUND_GAIN,
  beltMix,
  soundFor,
  soundGainFor,
} from "../src/audioLogic";
import { depthMap, isMatterTile, neighbourMask } from "../src/autotile";
import { keepouts, placeDecor } from "../src/decor";
import { CarnageFilter, EVENT_KINDS, eventsBetween, ICE_BRAKE_SPEED, type GameEvent } from "../src/events";
import { BELT_EVERY, Particles, beltSpark, feelColors, feelEvent } from "../src/feel";
import { THEMES, THEME_NAMES, type ThemeName } from "../src/themes";
import { MODULES, MODULE_TAGS } from "@cdj/jump-sim";
import { TAG_LABELS, THEME_FILTERS, galleryOrder, matchesFilter, matchesTheme, moduleTheme, type ModuleInfo } from "../src/modulesInfo";
import { feelLevels, defaultSettings } from "../src/settings";
import { stainFor } from "../src/stains";
import {
  BELT_FLOW,
  BELT_FRAGMENT,
  BELT_PERIOD,
  BELT_VERTEX,
  BELT_Z,
  beltDirection,
  beltRuns,
  beltTime,
  buildBeltArt,
  chevronAt,
  hasSurfaces,
  iceRuns,
  topExposed,
} from "../src/surfaceArt";
import { TILE_Z, buildTileArt, insideTiles } from "../src/tileArt";
import { chooseDay, dayLine } from "../src/dailyInfo";
import { mayRecord } from "../src/history";
import { SURFACE_SLIDERS, loadTuned, parseTuned, paramsJson, resetParams, saveTuned, surfaceValue, surfacesChanged } from "../src/tune";
import { galleryHref, moduleHref, readUrlOptions, URL_OPTIONS } from "../src/urlOptions";
import { JumpSession } from "../src/session";

// Lot 11 (partie jeu) : les deux surfaces — tapis roulants `[` `]` et glace `~` — côté affichage : plages, chevrons (un tampon, un matériau),
// auto-tuilage, taches et décor, événements, sons, particules, réglages du panneau, adresse et galerie. Dates fixes, jamais l'heure réelle.

const R = INPUT_RIGHT;
const L = INPUT_LEFT;

/** Un niveau de contrôle : un tapis vers la gauche, un vers la droite, de la glace, avec un bloc au-dessus d'une tuile de tapis. */
const SURF = parseLevel(
  [
    "........................",
    "S.....................F.",
    "###[[[[[###]]]]###~~~~~~",
  ].join("\n") + "\n",
);

/** Un tapis (D), une glace (G) : ce qu'il faut pour jouer les événements. */
function level(row: string, width = row.length): Level {
  const top = ".".repeat(width);
  const mid = `S${".".repeat(width - 3)}F.`;
  return parseLevel([top, mid, row.padEnd(width, "#")].join("\n") + "\n");
}

describe("les surfaces dans la grille (surfaceArt, pur)", () => {
  it("un tapis et la glace sont des blocs pleins pour la simulation et la matière de l'auto-tuilage", () => {
    for (const code of [TILE_BELT_LEFT, TILE_BELT_RIGHT, TILE_ICE]) {
      expect(isSolidTile(code)).toBe(true);
      expect(isMatterTile(code)).toBe(true);
    }
    expect(isMatterTile(TILE_SOLID)).toBe(true);
    expect(isMatterTile(0)).toBe(false);
    expect(isMatterTile(2)).toBe(false); // un friable peut tomber
    expect(isMatterTile(3)).toBe(false); // un ressort est un objet à part
    expect(beltDirection(TILE_BELT_LEFT)).toBe(-1);
    expect(beltDirection(TILE_BELT_RIGHT)).toBe(1);
    expect(beltDirection(TILE_ICE)).toBe(0);
    expect(hasSurfaces(SURF)).toBe(true);
    expect(hasSurfaces(parseLevel("S.F\n###\n"))).toBe(false);
  });

  it("plages exposées : une par suite de tuiles de même sens ; un tapis recouvert n'en fait pas ; deux sens, deux plages", () => {
    expect(beltRuns(SURF)).toEqual([
      { kind: "tapis", row: 2, col0: 3, col1: 7, dir: -1 },
      { kind: "tapis", row: 2, col0: 11, col1: 14, dir: 1 },
    ]);
    expect(iceRuns(SURF)).toEqual([{ kind: "glace", row: 2, col0: 18, col1: 23, dir: 0 }]);
    const mixed = level("[[]]~~");
    expect(beltRuns(mixed).map((r) => [r.col0, r.col1, r.dir])).toEqual([[0, 1, -1], [2, 3, 1]]);
    // Un bloc au-dessus d'une tuile de tapis : la face n'est plus exposée (la plage se coupe), et le haut de la grille n'est pas exposé.
    const covered = parseLevel(["..#..", "S...F", "[[[[["].join("\n") + "\n");
    expect(topExposed(covered, 2, 2)).toBe(true);
    const blocked = parseLevel(["S...F", "..#..", "[[[[["].join("\n") + "\n");
    expect(topExposed(blocked, 2, 2)).toBe(false);
    expect(beltRuns(blocked).map((r) => [r.col0, r.col1])).toEqual([[0, 1], [3, 4]]);
    expect(topExposed(blocked, 2, 0)).toBe(false);
  });

  it("chevrons : un tampon par tronçon de colonnes, des quads par tuile exposée, la profondeur sous les dangers, le sens porté par les sommets", () => {
    const art = buildBeltArt(SURF, 8);
    expect(art.chunks.length).toBe(3);
    expect(art.tiles).toBe(9);
    let tris = 0;
    for (const c of art.chunks) {
      tris += c.triangles;
      expect(c.pos.length / 3).toBe(c.dir.length);
      expect(c.dir.length).toBe(c.band.length);
      expect(c.idx.length / 3).toBe(c.triangles);
      for (let i = 0; i < c.pos.length; i += 3) {
        expect(c.pos[i + 2]).toBe(BELT_Z);
        expect(c.pos[i]!).toBeGreaterThanOrEqual(c.col0);
        expect(c.pos[i]!).toBeLessThanOrEqual(c.col1);
      }
    }
    expect(tris).toBe(art.tiles * 2);
    expect(BELT_Z).toBeGreaterThan(TILE_Z.trim);
    expect(BELT_Z).toBeLessThan(0.05);
    // Le sens : −1 pour les colonnes 3 à 7, 1 pour 11 à 14.
    const left = art.chunks[0]!;
    expect(new Set(left.dir)).toEqual(new Set([-1]));
    expect(new Set(art.chunks[1]!.dir)).toEqual(new Set([1]));
    expect(art.chunks[2]!.triangles).toBe(0);
  });

  it("le défilement suit le sens du tapis, la phase est figée sans mouvement, et le shader dit la même chose", () => {
    for (const dir of [-1, 1]) {
      const a = chevronAt(0, dir, 0.1);
      const b = chevronAt(0, dir, 0.1 + 0.05);
      // Un chevron avance dans le sens du tapis (sauf s'il saute au chevron suivant, de l'autre côté de la période).
      const delta = b - a;
      expect(Math.sign(delta), `sens ${dir}`).toBe(dir);
      expect(Math.abs(delta)).toBeLessThan(BELT_PERIOD);
    }
    expect(beltTime(12.5, false)).toBe(0);
    expect(beltTime(0, true)).toBe(0);
    expect(beltTime(1, true)).toBeCloseTo(BELT_FLOW / BELT_PERIOD, 9);
    // Vitesse d'affichage = la moitié de celle du tapis (5 tuiles/s) : on ne hache pas l'image.
    expect(BELT_FLOW).toBeLessThanOrEqual(5);
    // Le shader lit la phase `uTime` (uniform commun), le sens `aDir` (par sommet) et la période : un seul matériau pour tous les tapis.
    expect(BELT_FRAGMENT).toContain("uniform float uTime");
    expect(BELT_FRAGMENT).toContain("vDir");
    expect(BELT_FRAGMENT).toContain(BELT_PERIOD.toFixed(3));
    expect(BELT_FRAGMENT).toContain("#include <colorspace_fragment>");
    expect(BELT_VERTEX).toContain("attribute float aDir");
  });
});

describe("auto-tuilage, taches et décor avec les surfaces", () => {
  it("un tapis ou de la glace est de la matière : voisins, profondeur, et le dessin reste dans les tuiles dans tous les thèmes", () => {
    // Un tapis entre deux blocs : ses voisins le voient plein (E et W).
    const m = neighbourMask(SURF, 8, 2);
    expect(m & 4).not.toBe(0);
    const depth = depthMap(SURF);
    for (const col of [3, 8, 18]) expect(depth[2 * SURF.width + col]!).toBeGreaterThanOrEqual(0);
    for (const name of THEME_NAMES) {
      const art = buildTileArt(SURF, THEMES[name].tiles);
      expect(art.tiles).toBe(SURF.tiles.filter((t) => isMatterTile(t)).length);
      for (const c of art.chunks) expect(insideTiles(SURF, c.art), `${name} ${c.col0}`).toBe(true);
      for (const z of Object.values(TILE_Z)) expect(z).toBeLessThan(0.05);
    }
  });

  it("la face d'un tapis (bande sombre, deux liserés) et celle de la glace (dégradé, croûte, éclats) se dessinent ; ni l'un ni l'autre n'ajoute de bosse de garniture", () => {
    const lin = (rgb: number) => [(rgb >> 16) & 255, (rgb >> 8) & 255, rgb & 255].map((c) => (c / 255 <= 0.04045 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4));
    const has = (art: { col: number[] }, rgb: number) => {
      const [r, g, b] = lin(rgb);
      for (let i = 0; i < art.col.length; i += 3) if (Math.abs(art.col[i]! - r!) < 1e-6 && Math.abs(art.col[i + 1]! - g!) < 1e-6 && Math.abs(art.col[i + 2]! - b!) < 1e-6) return true;
      return false;
    };
    for (const name of THEME_NAMES) {
      const t = THEMES[name].tiles;
      const plain = buildTileArt(parseLevel(["........", "S......F", "########"].join("\n") + "\n"), t).chunks[0]!.art;
      const belt = buildTileArt(parseLevel(["........", "S......F", "[[[[[[[["].join("\n") + "\n"), t).chunks[0]!.art;
      const ice = buildTileArt(parseLevel(["........", "S......F", "~~~~~~~~"].join("\n") + "\n"), t).chunks[0]!.art;
      expect(has(belt, t.belt.base), `${name} bande`).toBe(true);
      expect(has(belt, t.belt.rail), `${name} liseré`).toBe(true);
      expect(has(plain, t.belt.base)).toBe(false);
      expect(has(ice, t.ice.glint), `${name} éclat`).toBe(true);
      expect(has(ice, t.ice.edge), `${name} croûte`).toBe(true);
      expect(has(ice, t.ice.sheen)).toBe(true);
      expect(has(plain, t.ice.glint)).toBe(false);
      // Aucune bosse : rien ne dépasse la face du dessus (y = −rangée) des surfaces.
      for (const art of [belt, ice]) for (let i = 1; i < art.pos.length; i += 3) expect(art.pos[i]!).toBeLessThanOrEqual(-2 + 1e-9);
      // Le bloc ordinaire de la même scène garde sa garniture (les bosses de l'herbe, par exemple, montent au-dessus de la face).
    }
  });

  it("les taches de peinture se posent sur un tapis ou de la glace (ce sont des blocs), jamais dans le vide", () => {
    const T = 4096;
    for (const [col] of [[4], [13], [20]] as const) {
      const discs = stainFor(SURF, (col + 0.5) * T, 1.5 * T);
      expect(discs.length, `colonne ${col}`).toBeGreaterThan(0);
      for (const d of discs) expect(d.y).toBeGreaterThanOrEqual(1.99);
    }
  });

  it("le décor ne se pose jamais sur un tapis ni sur de la glace (« dessus »), mais s'ancre à leurs murs ; rien ne dépend d'un niveau sans surface", () => {
    const wide = level("#".repeat(20) + "[".repeat(20) + "~".repeat(20) + "#".repeat(20), 80);
    for (const name of THEME_NAMES) {
      const items = placeDecor(wide, THEMES[name], "controle", keepouts(wide));
      for (const it of items) {
        const kind = THEMES[name].decor[it.kind]!;
        if (kind.anchor !== "dessus") continue;
        const col = Math.floor(it.x);
        expect(wide.tiles[2 * wide.width + col], `${name} ${kind.id} colonne ${col}`).toBe(TILE_SOLID);
      }
    }
  });
});

/** Joue `script` (paires [commande, nombre de pas]) depuis le départ ; rend les événements et l'état final. */
function play(lv: Level, script: [number, number][], inputsOf = false): { events: GameEvent[]; state: AttemptState; states: AttemptState[] } {
  let s = initialAttempt(lv);
  const events: GameEvent[] = [];
  const states: AttemptState[] = [s];
  let tick = 0;
  let prevBits = 0;
  for (const [bits, n] of script) {
    for (let i = 0; i < n; i++) {
      const next = stepAttempt(s, bits, lv, DEFAULT_JUMP_PARAMS);
      events.push(...eventsBetween(s, next, lv, DEFAULT_JUMP_PARAMS, tick++, "jeu", inputsOf ? { bits, prevBits } : undefined));
      prevBits = bits;
      s = next;
      states.push(s);
    }
  }
  return { events, state: s, states };
}
const only = <K extends GameEvent["kind"]>(events: GameEvent[], kind: K) => events.filter((e): e is Extract<GameEvent, { kind: K }> => e.kind === kind);

describe("événements des surfaces (eventsBetween)", () => {
  it("la liste des noms porte les cinq événements du lot 11", () => {
    for (const k of ["tapisDebut", "tapisFin", "glaceDebut", "glaceFin", "glaceFrein"]) expect(EVENT_KINDS).toContain(k);
    expect(new Set(EVENT_KINDS).size).toBe(EVENT_KINDS.length);
  });

  it("un tapis : un début en s'y posant (avec son sens), une fin en le quittant", () => {
    const lv = level("###]]]]]]###", 40);
    const { events, state } = play(lv, [[R, 260]]);
    const start = only(events, "tapisDebut");
    const end = only(events, "tapisFin");
    expect(start).toHaveLength(1);
    expect(end).toHaveLength(1);
    expect(start[0]!.side).toBe(1);
    expect(end[0]!.side).toBe(1);
    expect(start[0]!.tick).toBeLessThan(end[0]!.tick);
    // Au sol sur le tapis, à la hauteur de ses pieds : bas du personnage = face du dessus (rangée 2).
    expect(start[0]!.y).toBeCloseTo(2, 1);
    expect(state.player.x).toBeGreaterThan(0);
    const left = level("###[[[[[[###", 40);
    const back = play(left, [[R, 260]]);
    expect(only(back.events, "tapisDebut")[0]!.side).toBe(-1);
  });

  it("un tapis de l'autre sens à la suite : une fin puis un début ; sans surface : aucun événement de surface", () => {
    const lv = level("###]]]]###[[[[###", 40);
    const { events } = play(lv, [[R, 300]]);
    const k = events.filter((e) => e.kind === "tapisDebut" || e.kind === "tapisFin").map((e) => `${e.kind}${(e as { side: number }).side}`);
    expect(k).toEqual(["tapisDebut1", "tapisFin1", "tapisDebut-1", "tapisFin-1"]);
    const flat = play(level("#".repeat(40)), [[R, 200]]);
    for (const e of flat.events) expect(["tapisDebut", "tapisFin", "glaceDebut", "glaceFin", "glaceFrein"]).not.toContain(e.kind);
  });

  it("la glace : début et fin ; en l'air au-dessus d'elle, rien", () => {
    const lv = level("###~~~~~~~~###", 40);
    const { events } = play(lv, [[R, 260]]);
    expect(only(events, "glaceDebut")).toHaveLength(1);
    expect(only(events, "glaceFin")).toHaveLength(1);
    expect(only(events, "glaceDebut")[0]!.tick).toBeLessThan(only(events, "glaceFin")[0]!.tick);
  });

  it("la mort et l'arrivée ferment l'état (comme glisseFin) : l'arrivée sur un tapis, la mort sur la glace", () => {
    const belt = parseLevel(["........", "S......F", "]]]]]]]]"].join("\n") + "\n");
    const won = play(belt, [[R, 400]]);
    expect(won.state.status).toBe(ATTEMPT_FINISHED);
    const fin = only(won.events, "tapisFin");
    expect(fin).toHaveLength(1);
    const kinds = won.events.map((e) => e.kind);
    expect(kinds.indexOf("tapisFin")).toBeGreaterThan(-1);
    expect(kinds.indexOf("arrivee")).toBeGreaterThan(-1);
    // Mort sur de la glace : un pic posé sur la glace (le personnage réapparaît ensuite : on lit les événements jusqu'à la mort).
    const die = parseLevel(["..........", "S.....^..F", "~~~~~~~~~~"].join("\n") + "\n");
    const dead = play(die, [[R, 500]]);
    const ev = dead.events.map((e) => e.kind);
    const mort = ev.indexOf("mort");
    expect(mort).toBeGreaterThan(-1);
    // Sur la glace dès le départ : seule la mort peut fermer l'état, et elle le ferme dans le même pas.
    expect(ev.slice(0, mort + 1).filter((k) => k === "glaceFin")).toHaveLength(1);
    expect(ev.indexOf("glaceFin")).toBeLessThan(mort);
    // Le personnage réapparaît et meurt encore : une fin d'état par mort, jamais deux, et jamais à la réapparition.
    expect(ev.filter((k) => k === "glaceFin")).toHaveLength(ev.filter((k) => k === "mort").length);
    expect(ev.filter((k) => k === "glaceDebut")).toHaveLength(0);
  });

  it("freinage sur la glace : des événements au rythme de la distance, seulement vite, seulement en ralentissant", () => {
    const lv = level("####" + "~".repeat(40) + "####", 60);
    // Course sur terre ferme jusqu'à pleine vitesse (la glace accélère très peu), puis on lâche sur la glace.
    const { events, states } = play(lv, [[R, 70], [0, 160]]);
    const brakes = only(events, "glaceFrein");
    expect(brakes.length).toBeGreaterThanOrEqual(2);
    for (const e of brakes) {
      expect(e.side).toBe(1);
      expect(e.speed).toBeGreaterThanOrEqual(DEFAULT_JUMP_PARAMS.runSpeed * ICE_BRAKE_SPEED * (120 / 4096) - 1e-9);
    }
    // Un par tuile parcourue au plus.
    for (let i = 1; i < brakes.length; i++) expect(brakes[i]!.x - brakes[i - 1]!.x).toBeGreaterThan(0.5);
    // Jamais pendant qu'on accélère : à pleine accélération au sol sur la glace, rien.
    const accel = play(lv, [[R, 70], [R, 100]]);
    expect(only(accel.events, "glaceFrein")).toHaveLength(0);
    expect(states.length).toBeGreaterThan(0);
  });

  it("un demi-tour sur la glace est un dérapage marqué « glace » ; sur la terre, il ne l'est pas", () => {
    const ice = level("####" + "~".repeat(40) + "####", 60);
    const a = play(ice, [[R, 70], [L, 6]], true);
    const d = only(a.events, "derapage");
    expect(d.length).toBeGreaterThan(0);
    expect(d[0]!.ice).toBe(true);
    const ground = level("#".repeat(60));
    const b = play(ground, [[R, 70], [L, 6]], true);
    const e = only(b.events, "derapage");
    expect(e.length).toBeGreaterThan(0);
    expect(e[0]!.ice).toBe(false);
  });

  it("le carnage n'en garde rien pour les autres vies ; la lecture ne modifie aucun état", () => {
    const f = new CarnageFilter();
    const base = { tick: 0, x: 0, y: 0, source: "vie" as const };
    for (const e of [
      { ...base, kind: "tapisDebut", side: 1 },
      { ...base, kind: "tapisFin", side: 1 },
      { ...base, kind: "glaceDebut" },
      { ...base, kind: "glaceFin" },
      { ...base, kind: "glaceFrein", side: 1, speed: 9 },
    ] as GameEvent[]) expect(f.admit(e), e.kind).toBe(false);
    const lv = level("###]]]]]]###~~~~~~###", 40);
    let s = Object.freeze(initialAttempt(lv));
    for (let i = 0; i < 300; i++) {
      const next = Object.freeze(stepAttempt(s, R, lv, DEFAULT_JUMP_PARAMS));
      Object.freeze(next.player);
      eventsBetween(s, next, lv, DEFAULT_JUMP_PARAMS);
      s = next;
    }
    expect(groundTile(lv, 0, 0)).toBeGreaterThanOrEqual(0);
  });
});

describe("sons des surfaces (audioLogic, pur)", () => {
  const E = { tick: 0, x: 0, y: 0, source: "jeu" as const };

  it("un son bref pour le contact d'un tapis (clac) et de la glace (souffle), un crissement pour le freinage et le dérapage sur la glace", () => {
    const ids = [
      soundFor({ ...E, kind: "tapisDebut", side: 1 }),
      soundFor({ ...E, kind: "glaceDebut" }),
      soundFor({ ...E, kind: "glaceFrein", side: 1, speed: 10 }),
      soundFor({ ...E, kind: "derapage", side: 1, speed: 12, ice: true }),
    ];
    expect(ids.map((s) => s?.id)).toEqual(["tapisDebut", "glaceDebut", "glaceFrein", "derapage"]);
    for (const s of ids) {
      expect(s!.layers.length).toBeGreaterThan(0);
      expect(s!.duration).toBeLessThan(0.3);
      for (const l of s!.layers) expect(l.gain).toBeLessThan(0.12); // sobres : sous le saut
    }
    // Aucun son pour la fin d'un contact.
    expect(soundFor({ ...E, kind: "tapisFin", side: 1 })).toBeNull();
    expect(soundFor({ ...E, kind: "glaceFin" })).toBeNull();
    // Le crissement dure plus et sonne plus fort quand on va vite ; sur la glace, le dérapage n'est pas le frottement de la terre.
    const slow = soundFor({ ...E, kind: "glaceFrein", side: 1, speed: 4 })!;
    const fast = soundFor({ ...E, kind: "glaceFrein", side: 1, speed: 15 })!;
    expect(fast.duration).toBeGreaterThan(slow.duration);
    const earth = soundFor({ ...E, kind: "derapage", side: 1, speed: 12, ice: false })!;
    const iceSkid = soundFor({ ...E, kind: "derapage", side: 1, speed: 12, ice: true })!;
    expect(iceSkid.layers).not.toEqual(earth.layers);
    // Les autres vies du carnage sont atténuées (et filtrées en amont).
    expect(soundGainFor({ ...E, source: "vie", kind: "glaceFrein", side: 1, speed: 9 })).toBe(CARNAGE_SOUND_GAIN);
  });

  const runs = [
    { row: 5, col0: 10, col1: 17 }, // 8 tuiles
    { row: 5, col0: 30, col1: 31 },
    { row: 9, col0: 12, col1: 20 },
    { row: 2, col0: 0, col1: 3 },
    { row: 5, col0: 60, col1: 70 },
  ];

  it("le volume baisse avec la distance au point le plus proche de la plage et tombe à zéro à la portée", () => {
    const at = (x: number, y: number) => beltMix([{ row: 5, col0: 10, col1: 17 }], { x, y });
    const near = at(13, 5)[0]!;
    const mid = at(13, 9)[0]!;
    expect(near.gain).toBeCloseTo(BELT_GAIN, 9); // collé à la plage, plage d'au moins 8 tuiles : volume plein
    expect(mid.gain).toBeLessThan(near.gain);
    expect(mid.gain).toBeCloseTo(BELT_GAIN * (1 - 4 / BELT_RANGE) ** 2, 9);
    expect(at(13, 5 + BELT_RANGE)).toEqual([]);
    expect(at(13, 5 + BELT_RANGE - 0.01)).toHaveLength(1);
    // Une plage longue s'entend de partout où elle passe : la distance se prend au point le plus proche, pas au centre.
    expect(at(10, 5)[0]!.distance).toBeCloseTo(0, 9);
    expect(at(20, 5)[0]!.distance).toBeCloseTo(2, 9); // à 2 tuiles de la fin (col 18)
    // Plus la plage est courte, plus elle est discrète.
    const short = beltMix([{ row: 5, col0: 10, col1: 11 }], { x: 10, y: 5 })[0]!;
    expect(short.gain).toBeLessThan(near.gain);
    expect(short.gain).toBeGreaterThan(near.gain * 0.5);
  });

  it("stéréo : au-dessus du tapis le son est au centre, à gauche il vient de la droite et inversement, borné à ±1", () => {
    const run = [{ row: 5, col0: 10, col1: 17 }];
    expect(beltMix(run, { x: 13, y: 5 })[0]!.pan).toBe(0);
    expect(beltMix(run, { x: 6, y: 5 })[0]!.pan).toBeGreaterThan(0); // le tapis est à droite
    expect(beltMix(run, { x: 22, y: 5 })[0]!.pan).toBeLessThan(0);
    for (const x of [-50, 0, 6, 22, 40]) expect(Math.abs(beltMix(run, { x, y: 5 }, 3, 80)[0]!.pan)).toBeLessThanOrEqual(1);
    expect(beltMix(run, { x: 8, y: 5 })[0]!.pan).toBeCloseTo(2 / 7, 9);
  });

  it("au plus trois voix (les plus proches), rien au-delà de la portée, ordre stable à distance égale ; aucune plage, aucune voix", () => {
    const mix = beltMix(runs, { x: 14, y: 5 });
    expect(BELT_VOICES).toBe(3);
    expect(mix.length).toBeLessThanOrEqual(BELT_VOICES);
    expect(mix.map((v) => v.index)).toEqual([0, 2].filter((i) => mix.some((v) => v.index === i)));
    for (let i = 1; i < mix.length; i++) expect(mix[i]!.distance).toBeGreaterThanOrEqual(mix[i - 1]!.distance);
    // Les plages au-delà de la portée (colonne 60, rangée 2…) ne s'entendent pas.
    expect(mix.every((v) => v.index !== 4)).toBe(true);
    const crowd = Array.from({ length: 10 }, (_, i) => ({ row: 5, col0: 10 + i, col1: 10 + i }));
    expect(beltMix(crowd, { x: 12, y: 5 })).toHaveLength(3);
    expect(beltMix([], { x: 0, y: 0 })).toEqual([]);
  });
});

describe("particules des surfaces (feel, plafonnées, coupées par ?fx=off)", () => {
  const colors = feelColors(THEMES.usine.palette);
  const levels = feelLevels(defaultSettings(false), true);
  const E = { tick: 0, x: 5, y: -3, source: "jeu" as const };

  it("givre au freinage et au dérapage sur la glace, étincelles à la pose sur un tapis ; rien pour les autres vies", () => {
    const pool = new Particles();
    feelEvent({ ...E, kind: "glaceFrein", side: 1, speed: 10 }, pool, colors, levels);
    const frost = pool.emitted;
    expect(frost).toBeGreaterThan(0);
    expect(pool.items.filter((p) => p.age < p.life).every((p) => colors.frost.includes(p.color))).toBe(true);
    pool.clear();
    const before = pool.emitted;
    feelEvent({ ...E, kind: "derapage", side: 1, speed: 12, ice: true }, pool, colors, levels);
    const iceCount = pool.emitted - before;
    pool.clear();
    const b2 = pool.emitted;
    feelEvent({ ...E, kind: "derapage", side: 1, speed: 12, ice: false }, pool, colors, levels);
    const dustCount = pool.emitted - b2;
    expect(iceCount).toBeGreaterThan(0);
    expect(dustCount).toBeGreaterThan(0);
    // La couleur du givre n'est pas celle de la poussière.
    pool.clear();
    feelEvent({ ...E, kind: "derapage", side: 1, speed: 12, ice: true }, pool, colors, levels);
    expect(pool.items.filter((p) => p.age < p.life).every((p) => colors.frost.includes(p.color))).toBe(true);
    pool.clear();
    feelEvent({ ...E, kind: "tapisDebut", side: -1 }, pool, colors, levels);
    expect(pool.alive).toBeGreaterThan(0);
    expect(pool.items.filter((p) => p.age < p.life).every((p) => colors.gear.includes(p.color))).toBe(true);
    pool.clear();
    for (const e of [{ ...E, kind: "glaceFrein", side: 1, speed: 10 }, { ...E, kind: "tapisDebut", side: 1 }] as GameEvent[]) {
      feelEvent({ ...e, source: "vie" }, pool, colors, levels);
    }
    expect(pool.alive).toBe(0);
  });

  it("le pool ne grandit jamais ; ?fx=off (part de particules nulle) ne laisse rien partir ; les fins de contact n'émettent rien", () => {
    const pool = new Particles();
    const size = pool.items.length;
    for (let i = 0; i < 400; i++) {
      feelEvent({ ...E, kind: "glaceFrein", side: 1, speed: 12 }, pool, colors, levels);
      beltSpark(pool, colors, 5, -3, i % 2 ? 1 : -1);
    }
    expect(pool.items.length).toBe(size);
    expect(pool.alive).toBeLessThanOrEqual(size);
    const off = new Particles();
    off.amount = feelLevels(defaultSettings(false), false).particles;
    expect(off.amount).toBe(0);
    feelEvent({ ...E, kind: "glaceFrein", side: 1, speed: 12 }, off, colors, feelLevels(defaultSettings(false), false));
    beltSpark(off, colors, 0, 0, 1);
    expect(off.emitted).toBe(0);
    const quiet = new Particles();
    for (const k of ["tapisFin", "glaceDebut", "glaceFin"] as const) feelEvent({ ...E, kind: k, side: 1 } as GameEvent, quiet, colors, levels);
    expect(quiet.emitted).toBe(0);
    expect(BELT_EVERY).toBeGreaterThan(0.05);
  });
});

describe("réglages « Tapis et glace » du panneau (?debug&tune)", () => {
  it("trois curseurs, avec défaut, bornes et indication ; la valeur montrée est le défaut tant qu'elle est absente", () => {
    expect(SURFACE_SLIDERS.map((s) => s.key)).toEqual(["beltSpeed", "iceAccel", "iceDecel"]);
    const p: JumpParams = { ...DEFAULT_JUMP_PARAMS };
    for (const s of SURFACE_SLIDERS) {
      expect(surfaceValue(p, s.key)).toBe(SURFACE_DEFAULTS[s.key]);
      expect(s.min).toBeLessThanOrEqual(SURFACE_DEFAULTS[s.key]);
      expect(s.max).toBeGreaterThanOrEqual(SURFACE_DEFAULTS[s.key]);
      expect(s.hint!(p).length).toBeGreaterThan(0);
    }
    expect(surfacesChanged(p)).toBe(0);
  });

  it("modifier un réglage rend la partie `tuned` (jamais enregistrée) ; le remettre au défaut, ou réinitialiser, la rend ordinaire", () => {
    const p: JumpParams = { ...DEFAULT_JUMP_PARAMS };
    expect(isDefaultJumpParams(p)).toBe(true);
    p.beltSpeed = 200;
    expect(surfacesChanged(p)).toBe(1);
    expect(isDefaultJumpParams(p)).toBe(false);
    p.beltSpeed = SURFACE_DEFAULTS.beltSpeed;
    expect(isDefaultJumpParams(p)).toBe(true); // la valeur écrite égale au défaut
    p.iceDecel = 9;
    expect(isDefaultJumpParams(p)).toBe(false);
    resetParams(p);
    expect(p.iceDecel).toBeUndefined();
    expect(isDefaultJumpParams(p)).toBe(true);
    // La session le voit : `tuned` suit les réglages en cours de partie.
    const lv = level("#".repeat(10));
    const params: JumpParams = { ...DEFAULT_JUMP_PARAMS };
    const session = new JumpSession(lv, params, "essai");
    expect(session.tuned).toBe(false);
    params.iceAccel = 8;
    expect(session.tuned).toBe(true);
  });

  it("« Copier les valeurs » : les réglages des surfaces n'y sont que s'ils diffèrent du défaut ; mémorisés et relus par `?tune`", () => {
    const p: JumpParams = { ...DEFAULT_JUMP_PARAMS };
    expect(JSON.parse(paramsJson(p))).not.toHaveProperty("beltSpeed");
    p.beltSpeed = 240;
    p.iceAccel = SURFACE_DEFAULTS.iceAccel;
    const json = JSON.parse(paramsJson(p)) as Record<string, number>;
    expect(json.beltSpeed).toBe(240);
    expect(json).not.toHaveProperty("iceAccel");
    const store = new Map<string, string>();
    const fake = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
    saveTuned(p, fake);
    expect(loadTuned(fake).beltSpeed).toBe(240);
    saveTuned({ ...DEFAULT_JUMP_PARAMS }, fake);
    expect(store.size).toBe(0);
    // Hors bornes ou pas entier : ignoré.
    expect(parseTuned(JSON.stringify({ beltSpeed: 99999 })).beltSpeed).toBeUndefined();
    expect(parseTuned(JSON.stringify({ iceAccel: 1.5 })).iceAccel).toBeUndefined();
    expect(parseTuned(JSON.stringify({ iceDecel: 6 })).iceDecel).toBe(6);
  });

  it("un réglage de surface change réellement le jeu : tapis plus rapide, glace qui freine plus fort (lecture seule du panneau, la sim fait le reste)", () => {
    const lv = level("####]]]]]]]]]]]]]]]]####", 40);
    const x = (params: JumpParams) => {
      let s = initialAttempt(lv);
      for (let i = 0; i < 160; i++) s = stepAttempt(s, R, lv, params);
      return s.player.x;
    };
    expect(x({ ...DEFAULT_JUMP_PARAMS, beltSpeed: 300 })).toBeGreaterThan(x({ ...DEFAULT_JUMP_PARAMS }));
    expect(x({ ...DEFAULT_JUMP_PARAMS, beltSpeed: 0 })).toBeLessThan(x({ ...DEFAULT_JUMP_PARAMS }));
  });
});

describe("thème et mécanique (adresse, galerie, essai)", () => {
  const first = PREMIER_JOUR_JUMP;
  const dayOf = (theme: ThemeName) => {
    for (let d = first; d < first + 60; d++) if (jumpThemeForDay(d) === theme) return d;
    throw new Error(`pas de jour ${theme}`);
  };

  it("chaque thème à mécanique a une date du calendrier ; usine → tapis, glace → glace, nuit → clignotant et néon → alterné (lot 12), forêt → vent (lot 13)", () => {
    expect(mechanicOf(THEMES.usine.name)).toBe("tapis");
    expect(mechanicOf(THEMES.glace.name)).toBe("glace");
    expect(mechanicOf(THEMES.nuit.name)).toBe("clignotant");
    expect(mechanicOf(THEMES.neon.name)).toBe("alterne");
    expect(mechanicOf("foret")).toBe("vent");
    for (const n of ["usine", "glace", "nuit", "neon", "foret"] as const) expect(jumpThemeForDay(dayOf(n))).toBe(n);
    expect(daysFromCivil(2026, 10, 16)).toBe(first);
  });

  it("?theme= est une option documentée : essai sur le niveau du jour (non enregistré), cosmétique sur un morceau ; nom inconnu ignoré, accents permis", () => {
    const o = URL_OPTIONS.find((x) => x.name === "theme")!;
    expect(o.values).toEqual([...JUMP_THEME_NAMES]);
    expect(o.description).toMatch(/essai/i);
    expect(o.description).toMatch(/rien n'est enregistré/);
    expect(readUrlOptions("?theme=usine").theme).toBe("usine");
    expect(readUrlOptions("?theme=forêt").theme).toBe("foret");
    expect(readUrlOptions("?theme=lave").theme).toBeNull();
    expect(readUrlOptions("?module=cheminee&theme=glace").theme).toBe("glace");
  });

  it("un lien de morceau porte son thème (&theme=<nom>), qui remplace celui de l'adresse actuelle ; sans thème, on garde celui de l'adresse", () => {
    const from = readUrlOptions("?modules&debug&theme=neon");
    expect(moduleHref({ id: "cheminee", variant: 1, entry: "arret", theme: "glace" }, from)).toBe("?module=cheminee&variante=1&theme=glace&debug");
    expect(moduleHref({ id: "cheminee", variant: 1, entry: "arret" }, from)).toBe("?module=cheminee&variante=1&debug&theme=neon");
    expect(moduleHref({ id: "cheminee", variant: 0, entry: "elan", solution: true, theme: "usine" }, readUrlOptions("?modules"))).toBe("?module=cheminee&variante=0&entree=elan&solution&theme=usine");
    expect(galleryHref(readUrlOptions("?theme=usine"))).toBe("?modules&theme=usine");
  });

  it("étiquettes : chacune a son libellé ; filtre par thème d'un morceau (variantes réservées / de tous les thèmes)", () => {
    for (const t of MODULE_TAGS) expect(TAG_LABELS[t], t).toBeTruthy();
    expect(TAG_LABELS.tapis).toBe("tapis roulant");
    expect(TAG_LABELS.glace).toBe("glace");
    const info = (theme: ThemeName | null, ...variantThemes: (ThemeName | null)[]): ModuleInfo => ({
      id: "x",
      intention: "",
      tags: [],
      theme,
      family: "x",
      long: false,
      variants: variantThemes.map((t, i) => ({ index: i, label: "", mutations: "", theme: t, exigence: 3, ticks: { arret: 100, elan: 100 } })),
      min: 3,
      max: 3,
    });
    const generic = info(null, null, null);
    const usine = info("usine", "usine", "usine");
    const mutated = info(null, null, "glace"); // une variante à mutateur `surface:glace`
    expect(THEME_FILTERS).toEqual([...JUMP_THEME_NAMES, "sans"]);
    expect(matchesTheme(generic, null)).toBe(true);
    expect(matchesTheme(generic, "sans")).toBe(true);
    expect(matchesTheme(generic, "foret")).toBe(false); // lot 13 : la forêt a sa mécanique (le vent)
    expect(matchesTheme(generic, "usine")).toBe(false);
    expect(matchesTheme(usine, "usine")).toBe(true);
    expect(matchesTheme(usine, "glace")).toBe(false);
    expect(matchesTheme(usine, "sans")).toBe(false);
    expect(matchesTheme(mutated, "glace")).toBe(true);
    expect(matchesTheme(mutated, "sans")).toBe(true);
    expect(matchesFilter(usine, { tag: null, family: null, theme: "usine" })).toBe(true);
    expect(matchesFilter(usine, { tag: null, family: null })).toBe(true);
  });

  it("le catalogue : chaque morceau d'une mécanique (et chaque variante à mutateur surface) s'ouvre dans son thème", () => {
    const order = galleryOrder();
    const mech = MODULES.filter((m) => m.theme !== null || m.mutations.some((ms) => ms.some((x) => x.name === "surface")));
    expect(mech.length).toBeGreaterThan(0);
    for (const def of mech) {
      const info = order.find((m) => m.id === def.id)!;
      expect(info, def.id).toBeDefined();
      info.variants.forEach((v, i) => {
        expect(v.theme, `${def.id} v${i}`).toBe(moduleTheme(def.id, i));
        if (def.theme) expect(v.theme, `${def.id} v${i}`).toBe(def.theme);
        if (def.mutations[i]!.some((x) => x.name === "surface")) expect(v.theme, `${def.id} v${i}`).not.toBeNull();
      });
      // Les morceaux étiquetés `tapis` / `glace` sont du thème qui porte leur mécanique.
      if (def.tags.includes("tapis")) expect(def.theme).toBe("usine");
      if (def.tags.includes("glace")) expect(def.theme).toBe("glace");
    }
    expect(moduleTheme("inconnu", 0)).toBeNull();
  });

  it("deux jours de thèmes à mécanique donnent un niveau avec ses surfaces ; un thème forcé est un essai au même niveau que celui qu'on obtient par ?theme=", async () => {
    const { dailyLevel } = await import("@cdj/jump-sim");
    const u = dailyLevel(dayOf("usine"));
    const g = dailyLevel(dayOf("glace"));
    expect(u.theme).toBe("usine");
    expect(g.theme).toBe("glace");
    expect(u.pieces.some((p) => p.mechanic === "tapis")).toBe(true);
    expect(g.pieces.some((p) => p.mechanic === "glace")).toBe(true);
    expect(hasSurfaces(u.level)).toBe(true);
    expect(hasSurfaces(g.level)).toBe(true);
    const trial = dailyLevel(dayOf("foret"), "glace");
    expect(trial.forcedTheme).toBe(true);
    expect(trial.id).toMatch(/-tglace$/);
  });

  it("un essai de thème : `mayRecord` refuse (jamais d'historique ni de série), la ligne du HUD le dit, ouvrir une date n'en fait pas un essai tout seul", async () => {
    const { dailyLevel } = await import("@cdj/jump-sim");
    const day = dayOf("foret");
    const trial = dailyLevel(day, "usine");
    const choice = { ...chooseDay(day, day, false), mode: "essai" as const };
    expect(mayRecord({ mode: "essai", levelDay: day, today: day, watching: false, tuned: false })).toBe(false);
    expect(mayRecord({ mode: "jour", levelDay: day, today: day, watching: false, tuned: false })).toBe(true);
    const line = dayLine(trial, choice, false, null);
    expect(line).toContain("essai de thème");
    expect(line).toContain("rien n'est enregistré");
    expect(chooseDay(day, day, false).mode).toBe("jour");
  });
});
