import { describe, expect, it } from "vitest";
import {
  AXIS_MAX,
  MAX_REPLAY_TICKS,
  NO_INPUT,
  ReplayError,
  ReplayPlayer,
  ReplayRecorder,
  SIM_VERSION,
  TICK_RATE,
  copyCar,
  createRace,
  createCar,
  createTestTrack,
  decodeReplay,
  encodeReplay,
  makeInput,
  replayRace,
  replayTicks,
  stepRace,
  type CarInput,
  type Replay,
} from "../src/index";
import { recordAutopilot } from "./helpers/autopilot";

const track = createTestTrack();
const live = recordAutopilot(track, 120, { grip: 0.9 });

describe("enregistrement", () => {
  it("regroupe les pas consécutifs identiques en séries", () => {
    const rec = new ReplayRecorder();
    const a = makeInput(0, 1, 0);
    const b = makeInput(-1, 1, 0);
    for (const i of [a, a, a, b, b, a]) rec.record(i);
    const r = rec.toReplay("essai");
    expect(r.runs.map((x) => [x.count, x.steer])).toEqual([[3, 0], [2, -64], [1, 0]]);
    expect(rec.ticks).toBe(6);
    expect(replayTicks(r)).toBe(6);
  });

  it("restitue exactement les commandes enregistrées, puis plus rien", () => {
    const rec = new ReplayRecorder();
    const inputs: CarInput[] = [makeInput(0.3, 1, 0), makeInput(0.3, 1, 0), makeInput(-1, 0, 1, true), makeInput(0, 0, 0)];
    inputs.forEach((i) => rec.record(i));
    const player = new ReplayPlayer(rec.toReplay("essai"));
    for (const expected of inputs) expect({ ...player.next() }).toEqual(expected);
    expect(player.done).toBe(true);
    expect(player.next()).toBe(NO_INPUT);
  });
});

describe("encodage", () => {
  it("fait l'aller-retour sans perte (steer négatif, reprise, longues séries)", () => {
    const replay: Replay = {
      simVersion: SIM_VERSION,
      trackId: "essai",
      runs: [
        { count: 1, steer: -64, throttle: 0, brake: 64, respawn: 1 },
        { count: 300, steer: 17, throttle: 64, brake: 0, respawn: 0 },
        { count: 60000, steer: 0, throttle: 1, brake: 63, respawn: 0 },
      ],
    };
    expect(decodeReplay(encodeReplay(replay))).toEqual(replay);
  });

  it("est compact : une course complète tient en quelques ko de texte", () => {
    const code = encodeReplay(live.replay);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(code.length).toBeLessThan(10_000); // pilote analogique : le pire cas (un clavier fait bien moins)
    expect(decodeReplay(code)).toEqual(live.replay);
  });

  const valid = (): number[] => {
    // [format, version, longueur id, 'e','s','s','a','i', série (1 pas)]
    return [1, SIM_VERSION, 5, 101, 115, 115, 97, 105, 1, 0, 64, 0];
  };
  const b64 = (bytes: number[]) => {
    // Réencode via la fonction publique : on passe par une rediffusion équivalente quand c'est possible.
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let out = "";
    for (let i = 0; i < bytes.length; i += 3) {
      const a = bytes[i]!, b = bytes[i + 1], c = bytes[i + 2];
      out += alphabet[a >> 2]! + alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)]!;
      if (b !== undefined) out += alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)]!;
      if (c !== undefined) out += alphabet[c & 63]!;
    }
    return out;
  };

  it("accepte l'exemple minimal construit à la main", () => {
    expect(decodeReplay(b64(valid())).runs).toEqual([{ count: 1, steer: 0, throttle: 64, brake: 0, respawn: 0 }]);
  });

  it("refuse les rediffusions mal formées ou hors limites", () => {
    const bad = (mutate: (b: number[]) => number[]) => () => decodeReplay(b64(mutate(valid())));
    expect(() => decodeReplay("ab$c")).toThrow(ReplayError); // caractère invalide
    expect(bad((b) => b.slice(0, 10))).toThrow(/tronquée/);
    expect(bad((b) => [9, ...b.slice(1)])).toThrow(/Format/);
    expect(bad((b) => [...b.slice(0, 2), 0, ...b.slice(3)])).toThrow(ReplayError); // id vide
    expect(bad((b) => { b[9] = 100; return b; })).toThrow(/hors limites/); // steer = 100
    expect(bad((b) => { b[10] = 65; return b; })).toThrow(/hors limites/); // throttle = 65
    expect(bad((b) => { b[11] = 65; return b; })).toThrow(/hors limites/); // brake = 65
    expect(bad((b) => { b[8] = 0; return b; })).toThrow(/vide/); // série de 0 pas
    expect(bad((b) => { b[3] = 65; return b; })).toThrow(/Identifiant/); // majuscule dans l'id
  });

  it("refuse une rediffusion de plus de 10 minutes", () => {
    const long: Replay = {
      simVersion: SIM_VERSION,
      trackId: "essai",
      runs: [{ count: MAX_REPLAY_TICKS, steer: 0, throttle: 0, brake: 0, respawn: 0 }, { count: 1, steer: 0, throttle: 0, brake: 0, respawn: 0 }],
    };
    expect(() => decodeReplay(encodeReplay(long))).toThrow(/trop longue/);
  });
});

describe("rejeu", () => {
  it("redonne exactement la course jouée : même temps, mêmes intermédiaires, même état final", () => {
    const result = replayRace(track, decodeReplay(encodeReplay(live.replay)));
    expect(result.finished).toBe(true);
    expect(result.finishMs).toBe(live.race.finishMs);
    expect(result.splits).toEqual(live.race.splits);
    expect(result.respawns).toBe(0);
    expect(result.finalCar.x).toBe(live.race.car.x);
    expect(result.finalCar.z).toBe(live.race.car.z);
    expect(result.finalCar.vx).toBe(live.race.car.vx);
    expect(result.ticks).toBe(replayTicks(live.replay));
  });

  it("rejoue aussi les reprises au point de contrôle (la commande respawn est enregistrée)", () => {
    // Course scriptée : on roule, on reprend au départ, on reroule, on tombe dans le vide…
    const rec = new ReplayRecorder();
    const race = createRace(track);
    const script: [CarInput, number][] = [
      [makeInput(0, 1, 0), 400],
      [makeInput(0.5, 1, 0, true), 1],
      [makeInput(-0.2, 1, 0), 500],
      [makeInput(1, 1, 0), 300],
    ];
    for (const [input, n] of script) {
      for (let i = 0; i < n; i++) {
        rec.record(input);
        stepRace(race, input);
      }
    }
    expect(race.respawns).toBeGreaterThanOrEqual(1);
    const result = replayRace(track, rec.toReplay(track.id));
    expect(result.respawns).toBe(race.respawns);
    expect(result.finalCar).toEqual(snapshot(race.car));
  });

  it("ne trouve pas d'arrivée dans une rediffusion coupée", () => {
    const half: Replay = { ...live.replay, runs: live.replay.runs.slice(0, Math.floor(live.replay.runs.length / 2)) };
    const r = replayRace(track, half);
    expect(r.finished).toBe(false);
    expect(r.finishMs).toBe(-1);
  });

  it("une commande falsifiée ne donne pas le temps annoncé", () => {
    // Un grand coup de volant pendant l'une des plus longues séries de commandes de la moitié centrale de la course. Pas n'importe
    // laquelle : en l'air le volant ne fait rien (lot 19), une série de vol falsifiée redonnerait le même temps.
    const n = live.replay.runs.length;
    const candidates: number[] = [];
    for (let i = Math.floor(n / 4); i < Math.floor((3 * n) / 4); i++) if (live.replay.runs[i]!.count > 10) candidates.push(i);
    candidates.sort((a, b) => live.replay.runs[b]!.count - live.replay.runs[a]!.count);
    expect(candidates.length).toBeGreaterThan(0);
    let changed = 0;
    for (const target of candidates.slice(0, 5)) {
      const tampered: Replay = { ...live.replay, runs: live.replay.runs.map((r) => ({ ...r })) };
      const run = tampered.runs[target]!;
      run.steer = run.steer > 0 ? -AXIS_MAX : AXIS_MAX;
      if (replayRace(track, tampered).finishMs !== live.race.finishMs) changed++;
    }
    expect(changed).toBeGreaterThan(0);
  });

  it("refuse une rediffusion d'un autre circuit ou d'une autre version de la simulation", () => {
    expect(() => replayRace(track, { ...live.replay, trackId: "autre" })).toThrow(/autre circuit/);
    expect(() => replayRace(track, { ...live.replay, simVersion: SIM_VERSION + 1 })).toThrow(/Version/);
  });

  it("dure au plus quelques millisecondes par seconde de course (le serveur rejouera chaque course)", () => {
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) replayRace(track, live.replay);
    const perReplay = (performance.now() - t0) / 20;
    expect(perReplay).toBeLessThan(250); // large marge : un rejeu de 35 s ≈ 10 ms en pratique
    expect(live.race.finishMs).toBeGreaterThan(TICK_RATE);
  });
});

function snapshot(car: ReturnType<typeof createCar>) {
  const c = createCar();
  copyCar(car, c);
  return c;
}
