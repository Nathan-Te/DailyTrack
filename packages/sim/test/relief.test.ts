import { describe, expect, it } from "vitest";
import {
  CELL,
  FALL_TICKS,
  KICK_START,
  LEVEL,
  NO_GROUND,
  NO_INPUT,
  TICK_RATE,
  blockHeight,
  blockSlope,
  createRace,
  createSurface,
  createWallHit,
  createReliefTrack,
  encodeReplay,
  decodeReplay,
  makeInput,
  parseToken,
  parseTrack,
  replayRace,
  stepRace,
  ReplayRecorder,
  trackWorld,
} from "../src/index";

// Relief (lot 17) : niveaux, descentes et montées raides, rampe de saut, vide, sections sans rebords, chute.

describe("notation du relief", () => {
  it("U2 U3 D2 D3 montent et descendent de deux et trois niveaux ; U et D gardent un niveau", () => {
    expect(parseToken("U")).toEqual({ kind: "up", surface: "road", banked: false });
    expect(parseToken("U2")).toEqual({ kind: "up", surface: "road", banked: false, rise: 2 * LEVEL });
    expect(parseToken("U3")).toEqual({ kind: "up", surface: "road", banked: false, rise: 3 * LEVEL });
    expect(parseToken("D2")).toMatchObject({ kind: "down", rise: -2 * LEVEL });
    expect(parseToken("D3/g")).toMatchObject({ kind: "down", surface: "ice", rise: -3 * LEVEL });
    const t = parseTrack("t", "S@start U3 D2 D S@finish");
    expect(t.blocks.map((b) => b.y0)).toEqual([0, 0, 12, 4, 0]);
    expect(t.blocks.map((b) => b.rise)).toEqual([0, 12, -8, -4, 0]);
  });

  it("une pente de n niveaux monte de n × 4 m sur une cellule (pentes 0,125, 0,25 et 0,375)", () => {
    for (const [letter, slope] of [["U", 0.125], ["U2", 0.25], ["U3", 0.375], ["D", -0.125], ["D2", -0.25], ["D3", -0.375]] as const) {
      const t = parseTrack("t", `S@start ${letter} S@finish`);
      const b = t.blocks[1]!;
      expect(blockSlope(b, CELL / 2), letter).toBe(slope);
      expect(blockHeight(b, CELL) - blockHeight(b, 0), letter).toBe(slope * CELL);
    }
  });

  it("K : plat jusqu'à KICK_START, puis un niveau de plus en pente 0,25 ; G : un vide, GU / GD / GD2 changent de niveau", () => {
    const t = parseTrack("t", "S@start S K G GD G GU GD2 S S@finish");
    const k = t.blocks[2]!;
    expect(k.kind).toBe("kick");
    expect(blockHeight(k, KICK_START - 1)).toBe(0);
    expect(blockHeight(k, CELL)).toBe(LEVEL);
    expect(blockSlope(k, KICK_START + 1)).toBe(0.25);
    expect(blockSlope(k, KICK_START - 1)).toBe(0);
    expect(t.blocks.map((b) => b.y0)).toEqual([0, 0, 0, 4, 4, 0, 0, 4, -4, -4]);
    expect(t.blocks.filter((b) => b.kind === "gap").map((b) => b.rise)).toEqual([0, -4, 0, 4, -8]);
  });

  it("o retire les rebords ; un vide, le départ et l'arrivée ne s'ouvrent pas", () => {
    expect(parseToken("S/o")).toMatchObject({ open: true });
    expect(parseToken("L2/bo")).toMatchObject({ banked: true, open: true });
    expect(parseToken("S")).not.toHaveProperty("open");
    expect(() => parseToken("G/o")).toThrow();
    expect(() => parseTrack("t", "S/o@start S@finish")).toThrow();
    expect(() => parseTrack("t", "S@start S/o@finish")).toThrow();
  });

  it("la route la plus basse fixe le seuil de chute : 4 m en dessous", () => {
    const t = parseTrack("t", "S@start D3 S S@finish");
    expect(t.voidY).toBe(-12 - 4);
  });
});

describe("le vide et les rebords du relief", () => {
  const surf = createSurface();
  const hit = createWallHit();

  it("un vide n'a ni sol ni rebord : la voiture qui y entre tombe", () => {
    const t = parseTrack("t", "S@start K G S S@finish");
    const world = trackWorld(t);
    const g = t.blocks[2]!;
    world.sample(g.cx * CELL + CELL / 2, g.cz * CELL + CELL / 2, surf);
    expect(surf.height).toBe(NO_GROUND);
    expect(world.collide(g.cx * CELL + CELL / 2 + 6, g.cz * CELL + 16, 0, 1, hit)).toBe(false);
  });

  it("sans rebords, la route s'arrête net sur le côté : rien ne retient la voiture", () => {
    const rails = trackWorld(parseTrack("t", "S@start S S S@finish"));
    const open = trackWorld(parseTrack("t", "S@start S/o S S@finish"));
    const x = CELL / 2 + 7 - 0.5; // à 0,5 m du bord d'une route de 14 m
    const z = CELL + 16;
    expect(rails.collide(x, z, 0, 1, hit)).toBe(true);
    expect(open.collide(x, z, 0, 1, hit)).toBe(false);
    open.sample(CELL / 2 + 7.5, z, surf);
    expect(surf.height).toBe(NO_GROUND);
  });
});

describe("chute et reprise automatique", () => {
  // Une section surélevée sans rebords à 12 m au-dessus d'un creux : sortir de la route, c'est tomber.
  const spec = "S@start S S@cp D3 S U3 S/o S/o S/o S S@finish";
  const track = parseTrack("chute", spec);
  const OPEN_FROM = 6 * CELL;

  /** Roule droit, puis braque à fond à droite sur la section ouverte, jusqu'à la première reprise. */
  const driveOff = (race: ReturnType<typeof createRace>, rec?: ReplayRecorder) => {
    let steps = 0;
    while (race.respawns === 0 && steps < 20 * TICK_RATE) {
      const input = makeInput(race.car.z > OPEN_FROM + 8 ? 1 : 0, 1, 0);
      rec?.record(input);
      stepRace(race, input);
      steps++;
    }
    return steps;
  };

  it("le creux est à 12 m sous la route ouverte : le seuil de chute est 4 m sous le creux", () => {
    expect(track.voidY).toBe(-16);
    expect(track.blocks[6]!.open).toBe(true);
    expect(track.blocks[6]!.y0).toBe(0);
  });

  it("sortie d'une section sans rebords : la voiture tombe, puis reprend au dernier point de contrôle, chrono qui continue", () => {
    const race = createRace(track);
    const steps = driveOff(race);
    expect(race.respawns).toBe(1);
    expect(race.fallTicks).toBe(0);
    expect(race.splits).toHaveLength(1);
    const cp = race.checkpoints[0]!;
    expect(race.car.x).toBe(cp.x);
    expect(race.car.z).toBe(cp.z);
    expect(race.car.tick).toBe(steps + 1); // un par pas, plus un pour la reprise : le chrono ne s'arrête jamais
  });

  it("le délai entre le franchissement du seuil et la reprise vaut FALL_TICKS pas (0,5 s), la voiture tombe sans commande", () => {
    const race = createRace(track);
    let fallStart = -1;
    let steps = 0;
    let lastFallY = 0;
    while (race.respawns === 0 && steps < 20 * TICK_RATE) {
      stepRace(race, makeInput(race.car.z > OPEN_FROM + 8 ? 1 : 0, 1, 0));
      steps++;
      if (race.fallTicks === 1) fallStart = steps;
      if (race.fallTicks > 1) expect(race.car.y).toBeLessThan(lastFallY); // elle continue de tomber
      if (race.fallTicks > 0) lastFallY = race.car.y;
    }
    expect(fallStart).toBeGreaterThan(0);
    expect(steps - fallStart + 1).toBe(FALL_TICKS);
    expect(FALL_TICKS / TICK_RATE).toBe(0.5);
  });

  it("une chute se rejoue à l'identique : même reprise, même état final", () => {
    const race = createRace(track);
    const rec = new ReplayRecorder();
    driveOff(race, rec);
    for (let i = 0; i < 90; i++) {
      const input = makeInput(0, 1, 0);
      rec.record(input);
      stepRace(race, input);
    }
    const replay = decodeReplay(encodeReplay(rec.toReplay(track.id)));
    const result = replayRace(track, replay);
    expect(result.respawns).toBe(race.respawns);
    expect(result.ticks).toBe(race.car.tick - race.respawns); // chaque reprise ajoute un pas de chrono
    for (const k of Object.keys(race.car) as (keyof typeof race.car)[]) expect(result.finalCar[k], k).toBe(race.car[k]);
  });

  it("la touche de reprise ramène tout de suite, sans attendre le délai", () => {
    const race = createRace(track);
    while (race.fallTicks === 0 && race.car.tick < 20 * TICK_RATE) stepRace(race, makeInput(race.car.z > OPEN_FROM + 8 ? 1 : 0, 1, 0));
    expect(race.fallTicks).toBe(1);
    stepRace(race, makeInput(0, 0, 0, true));
    expect(race.respawns).toBe(1);
    expect(race.fallTicks).toBe(0);
    stepRace(race, NO_INPUT);
    expect(race.respawns).toBe(1);
  });
});

describe("scénario relief", () => {
  const track = createReliefTrack();

  it("monte de deux niveaux, descend, saute deux fois, passe une section sans rebords surélevée", () => {
    expect(track.blocks.filter((b) => b.kind === "kick")).toHaveLength(2);
    expect(track.blocks.filter((b) => b.kind === "gap")).toHaveLength(3);
    expect(track.blocks.some((b) => b.open)).toBe(true);
    const ys = track.blocks.flatMap((b) => [b.y0, b.y0 + b.rise]);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThanOrEqual(24);
    const open = track.blocks.filter((b) => b.open);
    expect(Math.min(...open.map((b) => b.y0)) - Math.min(...ys)).toBeGreaterThanOrEqual(6);
  });
});
