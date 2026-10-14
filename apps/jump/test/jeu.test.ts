import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  INPUT_LEFT,
  INPUT_RIGHT,
  JUMP_PARAM_KEYS,
  SANDBOX_LEVEL,
  initialPlayer,
  stepPlayer,
  type PlayerState,
} from "@cdj/jump-sim";
import { describe, expect, it } from "vitest";
import { CAMERA, clampAxis, followCamera, snapCamera, type Frame } from "../src/camera";
import { JumpLatch, directionBits, padDirection, padJump, padRestart } from "../src/input";
import { LOOK, animateLook, onStep, restLook, squashScale } from "../src/look";
import { FixedStepper, MAX_STEPS_PER_FRAME, STEP_SECONDS } from "../src/loop";
import { JumpSession } from "../src/session";
import { TUNE_SLIDERS, TUNE_STORAGE_KEY, formatHuman, jumpHeight, loadTuned, paramsJson, parseTuned, saveTuned, toHuman } from "../src/tune";
import { URL_OPTIONS, readUrlOptions } from "../src/urlOptions";

const SRC = new URL("../src", import.meta.url).pathname;

describe("paramètres d'adresse", () => {
  it("le jeu ne lit aucun paramètre absent de URL_OPTIONS", () => {
    const known = new Set(URL_OPTIONS.map((o) => o.name));
    const files = readdirSync(SRC).filter((f) => f.endsWith(".ts"));
    for (const file of files) {
      const code = readFileSync(join(SRC, file), "utf8");
      // L'adresse ne se lit que dans urlOptions.ts.
      if (file !== "urlOptions.ts") {
        expect(code, `${file} construit un URLSearchParams`).not.toMatch(/URLSearchParams/);
        expect(code.replace(/readUrlOptions\(location\.search\)/g, ""), `${file} lit location.search`).not.toMatch(/location\.(search|hash)/);
      }
      for (const m of code.matchAll(/\.(?:get|has|getAll)\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) {
        if (file === "urlOptions.ts") expect(known.has(m[1]!), `${file} lit ?${m[1]}`).toBe(true);
      }
    }
    // Et chaque paramètre lu par urlOptions.ts est décrit.
    const own = readFileSync(join(SRC, "urlOptions.ts"), "utf8");
    const read = [...own.matchAll(/params\.(?:get|has)\(\s*"([^"]+)"\s*\)/g)].map((m) => m[1]);
    expect(new Set(read)).toEqual(known);
    for (const o of URL_OPTIONS) expect(o.description.length).toBeGreaterThan(10);
  });

  it("lit le scénario, debug et tune (tune seulement avec debug)", () => {
    expect(readUrlOptions("")).toEqual({ scenario: "bac-a-sable", debug: false, tune: false });
    expect(readUrlOptions("?scenario=bac-a-sable&debug")).toEqual({ scenario: "bac-a-sable", debug: true, tune: false });
    expect(readUrlOptions("?scenario=inconnu&debug&tune")).toEqual({ scenario: "bac-a-sable", debug: true, tune: true });
    expect(readUrlOptions("?tune").tune).toBe(false);
  });
});

describe("bouton de saut entre deux pas", () => {
  it("un appui puis un relâchement entre deux pas compte pour un pas tenu", () => {
    const l = new JumpLatch();
    expect(l.sample()).toBe(0);
    l.press();
    l.release();
    expect(l.sample()).toBe(1);
    expect(l.sample()).toBe(0);
  });

  it("tenu : 1 à chaque pas ; relâché puis réappuyé entre deux pas : un pas à 0, puis l'appui", () => {
    const l = new JumpLatch();
    l.press();
    expect([l.sample(), l.sample()]).toEqual([1, 1]);
    l.release();
    l.press();
    expect([l.sample(), l.sample(), l.sample()]).toEqual([0, 1, 1]);
    l.release();
    l.press();
    l.release();
    expect([l.sample(), l.sample(), l.sample()]).toEqual([0, 1, 0]);
  });

  it("la simulation voit chaque appui comme un front montant", () => {
    // Deux appuis rapides entre des pas : deux sauts possibles, aucun perdu.
    const l = new JumpLatch();
    const bits: number[] = [];
    l.press();
    l.release();
    bits.push(l.sample());
    l.press();
    l.release();
    bits.push(l.sample(), l.sample());
    const edges = bits.filter((b, i) => b === 1 && (i === 0 || bits[i - 1] === 0)).length;
    expect(edges).toBe(2);
  });

  it("après « recommencer », un bouton tenu ne compte qu'une fois relâché", () => {
    const l = new JumpLatch();
    l.press();
    l.sample();
    l.reset();
    expect([l.sample(), l.sample()]).toEqual([0, 0]);
    l.release();
    expect(l.sample()).toBe(0);
    l.press();
    expect(l.sample()).toBe(1);
  });
});

describe("manette et directions", () => {
  const pad = (axes: number[], pressed: number[]) => ({ axes, buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: pressed.includes(i) ? 1 : 0, touched: false })) });

  it("stick avec zone morte, croix prioritaire, A/B saut, Start/Select recommencer", () => {
    expect(padDirection(pad([0.2], []))).toBe(0);
    expect(padDirection(pad([0.6], []))).toBe(1);
    expect(padDirection(pad([-0.6], []))).toBe(-1);
    expect(padDirection(pad([0.9], [14]))).toBe(-1);
    expect(padJump(pad([], [0]))).toBe(true);
    expect(padJump(pad([], [1]))).toBe(true);
    expect(padJump(pad([], [2]))).toBe(false);
    expect(padRestart(pad([], [9]))).toBe(true);
    expect(padRestart(pad([], [8]))).toBe(true);
  });

  it("gauche + droite = les deux bits (la simulation les neutralise)", () => {
    expect(directionBits(true, false)).toBe(INPUT_LEFT);
    expect(directionBits(false, true)).toBe(INPUT_RIGHT);
    expect(directionBits(true, true)).toBe(INPUT_LEFT | INPUT_RIGHT);
  });
});

describe("boucle à pas fixe", () => {
  it("découpe le temps en pas de 1/120 s et garde le reste pour interpoler", () => {
    const s = new FixedStepper();
    expect(s.advance(STEP_SECONDS * 2.5)).toBe(2);
    expect(s.alpha).toBeCloseTo(0.5, 6);
    expect(s.advance(STEP_SECONDS * 0.5)).toBe(1);
    expect(s.alpha).toBeCloseTo(0, 6);
    expect(s.advance(0)).toBe(0);
    expect(s.advance(-1)).toBe(0);
  });

  it("plafonne le rattrapage (pas de spirale après une longue pause)", () => {
    const s = new FixedStepper();
    expect(s.advance(10)).toBe(MAX_STEPS_PER_FRAME);
    expect(s.advance(STEP_SECONDS / 2)).toBeLessThanOrEqual(1);
  });
});

describe("session", () => {
  it("avance la simulation, garde l'état précédent, recommence au départ", () => {
    const session = new JumpSession(SANDBOX_LEVEL, { ...DEFAULT_JUMP_PARAMS });
    for (let i = 0; i < 30; i++) session.step(INPUT_RIGHT);
    expect(session.ticks).toBe(30);
    expect(session.prev).not.toBe(session.state);
    expect(session.state.x).toBeGreaterThan(initialPlayer(SANDBOX_LEVEL).x);
    session.restart();
    expect(session.state).toEqual(initialPlayer(SANDBOX_LEVEL));
    expect(session.prev).toBe(session.state);
    expect(session.ticks).toBe(0);
  });

  it("une partie aux réglages modifiés est marquée `tuned`, même remise aux défauts en route", () => {
    const params = { ...DEFAULT_JUMP_PARAMS };
    const session = new JumpSession(SANDBOX_LEVEL, params);
    expect(session.tuned).toBe(false);
    params.gravity += 1;
    expect(session.tuned).toBe(true);
    session.step(0);
    params.gravity -= 1;
    expect(session.tuned).toBe(true); // la partie a été jouée avec un autre réglage
    session.restart();
    expect(session.tuned).toBe(false);
  });

  it("joue exactement stepPlayer (le jeu n'ajoute rien à la simulation)", () => {
    const session = new JumpSession(SANDBOX_LEVEL, { ...DEFAULT_JUMP_PARAMS });
    let s: PlayerState = initialPlayer(SANDBOX_LEVEL);
    const inputs = [INPUT_RIGHT, INPUT_RIGHT | INPUT_JUMP, INPUT_JUMP, 0, INPUT_LEFT, INPUT_LEFT | INPUT_RIGHT];
    for (let i = 0; i < 300; i++) {
      const input = inputs[i % inputs.length]!;
      s = stepPlayer(s, input, SANDBOX_LEVEL, DEFAULT_JUMP_PARAMS);
      session.step(input);
    }
    expect(session.state).toEqual(s);
  });
});

describe("réglages (?debug&tune)", () => {
  it("un curseur par réglage, défauts dans les bornes", () => {
    expect(TUNE_SLIDERS.map((s) => s.key).sort()).toEqual([...JUMP_PARAM_KEYS].sort());
    for (const s of TUNE_SLIDERS) {
      const v = DEFAULT_JUMP_PARAMS[s.key];
      expect(v, s.key).toBeGreaterThanOrEqual(s.min);
      expect(v, s.key).toBeLessThanOrEqual(s.max);
      expect(Number.isInteger(s.min) && Number.isInteger(s.max)).toBe(true);
    }
  });

  it("convertit en unités humaines", () => {
    expect(toHuman("speed", DEFAULT_JUMP_PARAMS.runSpeed)).toBeCloseTo(10.99, 2);
    expect(toHuman("ticks", 12)).toBeCloseTo(0.1, 6);
    expect(toHuman("length", 1024)).toBe(0.25);
    expect(toHuman("accel", 19)).toBeCloseTo(66.8, 1);
    expect(formatHuman("speed", 375)).toBe("11,0 tuiles/s");
    expect(jumpHeight(DEFAULT_JUMP_PARAMS.jumpSpeed, DEFAULT_JUMP_PARAMS.gravity)).toBeCloseTo(4.21, 2);
  });

  it("garde, relit et oublie les réglages (`jump:tune`) ; refuse les valeurs hors bornes", () => {
    expect(TUNE_STORAGE_KEY).toBe("jump:tune");
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) };
    const p = { ...DEFAULT_JUMP_PARAMS, gravity: 25, coyote: 4 };
    saveTuned(p, storage);
    expect(loadTuned(storage)).toEqual(p);
    saveTuned({ ...DEFAULT_JUMP_PARAMS }, storage);
    expect(mem.has("jump:tune")).toBe(false);
    expect(parseTuned('{"gravity": 1.5, "coyote": -3, "jumpSpeed": 99999, "runSpeed": 400, "inconnu": 3}')).toEqual({ ...DEFAULT_JUMP_PARAMS, runSpeed: 400 });
    expect(parseTuned("pas du json")).toEqual({ ...DEFAULT_JUMP_PARAMS });
    expect(JSON.parse(paramsJson(p))).toEqual(p);
  });
});

describe("caméra", () => {
  const frame: Frame = { width: 200, height: 30, halfW: 16, halfH: 9 };

  it("reste dans le niveau, ou le centre s'il tient à l'écran", () => {
    expect(clampAxis(0, 200, 16, -5)).toBe(16);
    expect(clampAxis(0, 200, 16, 1000)).toBe(184);
    expect(clampAxis(0, 200, 16, 40)).toBe(40);
    expect(clampAxis(0, 20, 16, 3)).toBe(10);
    const cam = snapCamera({ cx: 2, cy: -26, vx: 0, ground: true }, frame);
    expect(cam.x).toBe(16);
    expect(cam.y).toBe(-21); // bas du niveau : −30 + 9
  });

  it("prend de l'avance dans la direction du mouvement, lissée", () => {
    let cam = snapCamera({ cx: 100, cy: -15, vx: 0, ground: true }, frame);
    const x0 = cam.x;
    for (let i = 0; i < 120; i++) cam = followCamera(cam, { cx: 100, cy: -15, vx: CAMERA.runSpeed, ground: true }, frame, 1 / 60);
    expect(cam.ahead).toBeGreaterThan(CAMERA.lookAhead * 0.9);
    expect(cam.x - x0).toBeGreaterThan(CAMERA.lookAhead * 0.8);
    const one = followCamera(cam, { cx: 100, cy: -15, vx: -CAMERA.runSpeed, ground: true }, frame, 1 / 60);
    expect(Math.abs(one.ahead - cam.ahead)).toBeLessThan(1); // pas de saut d'image au demi-tour
  });

  it("zone morte verticale : un petit saut ne bouge pas l'image, une grande montée oui", () => {
    const cam = { x: 100, y: -15, ahead: 0 };
    const hop = followCamera(cam, { cx: 100, cy: -14, vx: 0, ground: false }, frame, 1 / 60);
    expect(hop.y).toBe(cam.y);
    let up = cam;
    for (let i = 0; i < 120; i++) up = followCamera(up, { cx: 100, cy: -8, vx: 0, ground: false }, frame, 1 / 60);
    expect(up.y).toBeCloseTo(-8 - CAMERA.deadZone, 1);
  });
});

describe("allure du personnage (affichage)", () => {
  const rest = initialPlayer(SANDBOX_LEVEL);

  it("s'étire au décollage, s'écrase à l'atterrissage, revient à sa forme", () => {
    const air = stepPlayer(rest, INPUT_JUMP, SANDBOX_LEVEL, DEFAULT_JUMP_PARAMS);
    let look = onStep(restLook(), rest, air, DEFAULT_JUMP_PARAMS.fallSpeed);
    expect(look.squash).toBe(LOOK.takeoff);
    expect(squashScale(look.squash).sy).toBeGreaterThan(1);
    const falling = { ...air, ground: 0, vy: DEFAULT_JUMP_PARAMS.fallSpeed };
    look = onStep(restLook(), falling, { ...rest }, DEFAULT_JUMP_PARAMS.fallSpeed);
    expect(look.squash).toBeCloseTo(LOOK.landing, 6);
    expect(squashScale(look.squash).sx).toBeGreaterThan(1);
    for (let i = 0; i < 60; i++) look = animateLook(look, 1 / 60, 0);
    expect(Math.abs(look.squash)).toBeLessThan(0.02);
  });

  it("regarde dans la direction du mouvement, et à l'opposé du mur en glissant", () => {
    let look = onStep(restLook(), rest, { ...rest, vx: -50 }, 751);
    expect(look.facing).toBe(-1);
    look = onStep(look, rest, { ...rest, vx: 0 }, 751);
    expect(look.facing).toBe(-1); // gardé à l'arrêt
    look = onStep(look, rest, { ...rest, slide: -1, vx: 0 }, 751);
    expect(look.facing).toBe(1);
  });
});
