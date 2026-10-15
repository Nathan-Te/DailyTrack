import { describe, expect, it } from "vitest";
import {
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  INPUT_LEFT,
  INPUT_RIGHT,
  TICK_RATE,
  UNITS_PER_TILE,
  initialAttempt,
  isDefaultJumpParams,
  sprintTop,
  parseLevel,
  stepAttempt,
  type AttemptState,
  type JumpParams,
  type Level,
} from "@cdj/jump-sim";
import { EVENT_KINDS, SKID_SPEED, STRIDE_TILES, eventsBetween, type GameEvent } from "../src/events";
import { STEP, animateLook, feetPose, feetTarget, leanTarget, motionOf, onSkid, onStep, restLook, stridePhase, type Look, type Motion } from "../src/look";
import { soundFor } from "../src/audioLogic";
import { Particles, TRAIL_ALPHA, TRAIL_SPRINT_STRENGTH, Trail, feelColors, feelEvent, trailStrength } from "../src/feel";
import { defaultSettings, feelLevels } from "../src/settings";
import { PALETTES } from "../src/palette";
import { SPRINT_SLIDERS, TUNE_SLIDERS, paramsJson, parseTuned, resetParams, setSprint } from "../src/tune";

// Lot 8b : l'animation du personnage (affichage seul : pieds calés sur la distance, rebond, penché, respiration, regard), l'événement
// `derapage` (poussière, son), la traînée plus discrète, et la logique du panneau d'élan.

const R = INPUT_RIGHT;
const L = INPUT_LEFT;
const J = INPUT_JUMP;
const T = UNITS_PER_TILE;
const P = DEFAULT_JUMP_PARAMS;

const FLAT: Level = parseLevel(`
..............................................
..............................................
S............................................F
##############################################`);

/** Joue `script` depuis le départ ; rend les événements (commandes données, comme dans le jeu) et le regard après chaque pas. */
function play(level: Level, script: [number, number][], params: Readonly<JumpParams> = P) {
  let s: AttemptState = initialAttempt(level);
  let look: Look = restLook();
  let prevBits = 0;
  let tick = 0;
  const events: GameEvent[] = [];
  const looks: Look[] = [];
  for (const [bits, n] of script) {
    for (let i = 0; i < n; i++) {
      const next = stepAttempt(s, bits, level, params);
      const ev = eventsBetween(s, next, level, params, tick++, "jeu", { bits, prevBits });
      events.push(...ev);
      look = onStep(look, s.player, next.player, params.fallSpeed);
      for (const e of ev) if (e.kind === "derapage") look = onSkid(look, e.side);
      look = animateLook(look, 1 / TICK_RATE, motionOf(next.player, params.runSpeed, params.fallSpeed));
      looks.push(look);
      prevBits = bits;
      s = next;
    }
  }
  return { events, looks, state: s, look };
}

const skids = (events: GameEvent[]) => events.filter((e): e is Extract<GameEvent, { kind: "derapage" }> => e.kind === "derapage");
const motion = (o: Partial<Motion>): Motion => ({ vx: 0, vyUp: 0, ground: true, slide: 0, runSpeed: 11, fallSpeed: 22, ...o });

describe("dérapage (événement, son, poussière)", () => {
  it("un demi-tour au sol à pleine vitesse : un seul dérapage, côté du mouvement, au premier pas du demi-tour", () => {
    const { events } = play(FLAT, [[R, 60], [L, 40]]);
    const s = skids(events);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ side: 1, tick: 60, source: "jeu" });
    expect(s[0]!.speed).toBeCloseTo((P.runSpeed * TICK_RATE) / T, 6);
    expect(EVENT_KINDS).toContain("derapage");
  });

  it("pas de dérapage : à petite vitesse, en lâchant la direction, en l'air, ni sans les commandes", () => {
    // Petite vitesse : à peine lancé (sous `SKID_SPEED` × la course).
    const slowTicks = Math.floor((P.runSpeed * SKID_SPEED) / P.groundAccel) - 1;
    expect(skids(play(FLAT, [[R, slowTicks], [L, 30]]).events)).toHaveLength(0);
    // Lâcher : simple freinage.
    expect(skids(play(FLAT, [[R, 60], [0, 30]]).events)).toHaveLength(0);
    // En l'air : demi-tour pendant le saut (pas au sol).
    expect(skids(play(FLAT, [[R, 60], [R | J, 6], [L | J, 20]]).events)).toHaveLength(0);
    // Sans commandes (héros du carnage) : rien.
    let s = initialAttempt(FLAT);
    const all: GameEvent[] = [];
    for (const bits of [...new Array<number>(60).fill(R), ...new Array<number>(20).fill(L)]) {
      const next = stepAttempt(s, bits, FLAT, P);
      all.push(...eventsBetween(s, next, FLAT, P));
      s = next;
    }
    expect(skids(all)).toHaveLength(0);
  });

  it("deux demi-tours : deux dérapages ; un frottement court ; de la poussière devant (coupée sans effets)", () => {
    const { events } = play(FLAT, [[R, 60], [L, 60], [R, 40]]);
    const s = skids(events);
    expect(s.map((e) => e.side)).toEqual([1, -1]);
    const sound = soundFor(s[0]!);
    expect(sound?.id).toBe("derapage");
    expect(sound!.duration).toBeLessThan(0.25);
    const pool = new Particles();
    const colors = feelColors(PALETTES[0]!);
    feelEvent(s[0]!, pool, colors, feelLevels(defaultSettings()));
    expect(pool.alive).toBeGreaterThan(0);
    // La poussière part devant (dans le sens du mouvement : vers la droite).
    expect(pool.items.filter((p) => p.age < p.life).every((p) => p.x > s[0]!.x && p.vx > 0)).toBe(true);
    const calm = new Particles();
    calm.amount = feelLevels({ ...defaultSettings(), reducedMotion: true }).particles;
    feelEvent(s[0]!, calm, colors, feelLevels({ ...defaultSettings(), reducedMotion: true }));
    expect(calm.alive).toBe(0);
  });

  it("incline le corps en arrière (contre le mouvement), puis s'éteint", () => {
    const { looks } = play(FLAT, [[R, 60], [L, 3]]);
    const skidLook = looks[61]!;
    expect(skidLook.skid).toBeGreaterThan(0.8);
    expect(leanTarget(skidLook, motion({ vx: 9, ground: true }))).toBeLessThan(0);
    let look = skidLook;
    for (let i = 0; i < 30; i++) look = animateLook(look, 1 / 60, motion({}));
    expect(look.skid).toBe(0);
  });
});

describe("pieds : cycle calé sur la distance parcourue", () => {
  it("la distance au sol fait avancer le cycle (un cycle = deux pas), pas le temps", () => {
    const { looks, state } = play(FLAT, [[R, 120]]);
    const last = looks[looks.length - 1]!;
    const start = initialAttempt(FLAT).player;
    expect(last.stride).toBeCloseTo((state.player.x - start.x) / T, 9);
    expect(stridePhase(last.stride)).toBeCloseTo((last.stride / (2 * STRIDE_TILES)) % 1, 9);
    // Immobile, le cycle n'avance pas, quel que soit le temps.
    let still = last;
    for (let i = 0; i < 120; i++) still = animateLook(still, 1 / 60, motion({}));
    expect(still.stride).toBe(last.stride);
    expect(still.pose).toBe("arret");
  });

  it("un cycle de distance plus loin, la même pose ; deux pieds en opposition", () => {
    const a = feetTarget(motion({ vx: 11 }), 1.2);
    const b = feetTarget(motion({ vx: 11 }), 1.2 + 2 * STRIDE_TILES);
    for (let i = 0; i < 4; i++) expect(b.feet[i]).toBeCloseTo(a.feet[i]!, 9);
    // Les deux pieds sont en opposition : quand l'un est levé, l'autre est posé.
    const quarter = feetTarget(motion({ vx: 11 }), STRIDE_TILES / 2);
    expect(quarter.feet[1]).toBeGreaterThan(0.05);
    expect(quarter.feet[3]).toBe(0);
    const three = feetTarget(motion({ vx: 11 }), (3 * STRIDE_TILES) / 2);
    expect(three.feet[3]).toBeGreaterThan(0.05);
    expect(three.feet[1]).toBe(0);
  });

  it("poses : repliés en montée, pendants en chute (plus écartés vite), plaqués au mur, posés à l'arrêt", () => {
    expect(feetPose(motion({ ground: false, vyUp: 6 }))).toBe("montee");
    expect(feetPose(motion({ ground: false, vyUp: -3 }))).toBe("chute");
    expect(feetPose(motion({ ground: false, vyUp: -3, slide: 1 }))).toBe("mur");
    expect(feetPose(motion({ ground: true, vx: 0 }))).toBe("arret");
    expect(feetPose(motion({ ground: true, vx: 6 }))).toBe("course");
    const up = feetTarget(motion({ ground: false, vyUp: 6 }), 0).feet;
    expect(up[1]).toBeGreaterThan(0);
    expect(Math.abs(up[0])).toBeLessThan(STEP.footX);
    const slowFall = feetTarget(motion({ ground: false, vyUp: -4 }), 0).feet;
    const fastFall = feetTarget(motion({ ground: false, vyUp: -22 }), 0).feet;
    expect(fastFall[2] - fastFall[0]).toBeGreaterThan(slowFall[2] - slowFall[0]);
    expect(fastFall[1]).toBeLessThan(0); // sous la boîte
    const wall = feetTarget(motion({ ground: false, vyUp: -3, slide: -1 }), 0).feet;
    expect(wall[0]).toBe(-STEP.wallX);
    expect(wall[2]).toBe(-STEP.wallX);
    expect(feetTarget(motion({}), 5).feet).toEqual([-STEP.footX, 0, STEP.footX, 0]);
  });

  it("au repos, corps et pieds remplissent exactement la boîte de collision", () => {
    expect(STEP.leg).toBeLessThanOrEqual(STEP.footH);
    const look = restLook();
    expect(look.feet[1]).toBe(0);
    expect(look.bob).toBe(0);
    expect(look.breath).toBe(1);
  });
});

describe("corps : penché, rebond, respiration ; mouvement réduit", () => {
  it("penché dans le sens de l'accélération, rebond à chaque pas en course, respiration à l'arrêt", () => {
    const { looks } = play(FLAT, [[R, 10]]);
    expect(looks[9]!.accel).toBeGreaterThan(0);
    expect(looks[9]!.lean).toBeGreaterThan(0);
    const braking = play(FLAT, [[R, 60], [0, 6]]).looks;
    expect(braking[64]!.accel).toBeLessThan(0);
    expect(leanTarget(braking[64]!, motion({ vx: 5 }))).toBeLessThan(0);
    // Rebond : jamais négatif, au plus `STEP.bob`, et il varie au fil des pas.
    const run = play(FLAT, [[R, 160]]).looks.slice(40);
    const bobs = run.map((l) => l.bob);
    expect(Math.max(...bobs)).toBeGreaterThan(STEP.bob * 0.6);
    expect(Math.min(...bobs)).toBeLessThan(STEP.bob * 0.4);
    expect(bobs.every((b) => b >= 0 && b <= STEP.bob + 1e-9)).toBe(true);
    // Respiration : immobile depuis un moment, l'échelle varie autour de 1.
    let look = restLook();
    const breaths: number[] = [];
    for (let i = 0; i < 300; i++) breaths.push((look = animateLook(look, 1 / 60, motion({}))).breath);
    expect(Math.max(...breaths)).toBeGreaterThan(1.01);
    expect(Math.min(...breaths)).toBeLessThan(0.99);
  });

  it("mouvement réduit (corps à 0) : ni rebond, ni penché, ni respiration ; les pieds et les yeux restent animés", () => {
    const calm = feelLevels({ ...defaultSettings(), reducedMotion: true });
    expect(calm.body).toBe(0);
    expect(feelLevels(defaultSettings()).body).toBe(1);
    expect(feelLevels({ ...defaultSettings(), effects: "reduit" }).body).toBe(0.6);
    expect(feelLevels(defaultSettings(), false).body).toBe(0);
    let look = restLook();
    const seen: Look[] = [];
    let stride = 0;
    for (let i = 0; i < 200; i++) {
      stride += 11 / 60;
      look = animateLook({ ...look, stride, accel: i < 20 ? 60 : 0 }, 1 / 60, motion({ vx: 11 }), calm.body);
      seen.push(look);
    }
    expect(seen.every((l) => l.bob === 0 && l.lean === 0 && l.breath === 1)).toBe(true);
    // Les pieds bougent, les yeux suivent le regard.
    const lifts = seen.map((l) => l.feet[1]);
    expect(Math.max(...lifts) - Math.min(...lifts)).toBeGreaterThan(0.05);
    look = animateLook({ ...restLook(), facing: -1 }, 1 / 60, motion({ ground: false, vyUp: 12 }), 0);
    for (let i = 0; i < 30; i++) look = animateLook(look, 1 / 60, motion({ ground: false, vyUp: 12 }), 0);
    expect(look.eyeX).toBeLessThan(-0.9);
    expect(look.eyeY).toBeGreaterThan(0.7); // vers le haut au saut
    for (let i = 0; i < 30; i++) look = animateLook(look, 1 / 60, motion({ ground: false, vyUp: -15 }), 0);
    expect(look.eyeY).toBeLessThan(-0.7); // vers le bas à la chute
  });

  it("en glisse, le corps reste un peu écrasé contre le mur tant qu'elle dure", () => {
    let look = restLook();
    for (let i = 0; i < 120; i++) look = animateLook(look, 1 / 60, motion({ ground: false, vyUp: -5, slide: 1 }));
    expect(look.squash).toBeCloseTo(-0.08, 2);
    expect(look.pose).toBe("mur");
    for (let i = 0; i < 120; i++) look = animateLook(look, 1 / 60, motion({}));
    expect(Math.abs(look.squash)).toBeLessThan(0.01);
  });
});

describe("traînée plus discrète", () => {
  it("plus pâle qu'au lot 8 (0,24) à la course ; lot 8c : elle s'intensifie avec l'élan, jusqu'à `TRAIL_SPRINT_STRENGTH` fois en élan plein", () => {
    expect(TRAIL_ALPHA).toBeLessThan(0.24);
    const t = new Trail();
    for (let i = 0; i < 30; i++) t.update(1 / 60, i * 0.2, 0, true);
    expect(t.points[0]!.alpha).toBeCloseTo(TRAIL_ALPHA, 6);
    for (let i = 0; i < 30; i++) t.update(1 / 60, i * 0.2, 0, true, 9);
    expect(t.points[0]!.alpha).toBeCloseTo(TRAIL_ALPHA * TRAIL_SPRINT_STRENGTH, 6);
    const top = sprintTop(P);
    expect(trailStrength(P.runSpeed - 1, P.runSpeed, top)).toBe(0);
    expect(trailStrength(P.runSpeed, P.runSpeed, top)).toBe(1);
    expect(trailStrength(top, P.runSpeed, top)).toBe(TRAIL_SPRINT_STRENGTH);
    const mid = trailStrength((P.runSpeed + top) / 2, P.runSpeed, top);
    expect(mid).toBeGreaterThan(1);
    expect(mid).toBeLessThan(TRAIL_SPRINT_STRENGTH);
    expect(TRAIL_SPRINT_STRENGTH).toBeGreaterThan(1.5); // plus marquée qu'au lot 8b
  });
});

describe("panneau : l'élan, section normale (lot 8c)", () => {
  it("trois curseurs d'élan à côté des 20 réglages ; actif par défaut ; l'éteindre rend la partie « réglages modifiés » ; réinitialiser le rallume", () => {
    expect(TUNE_SLIDERS).toHaveLength(20);
    expect(SPRINT_SLIDERS.map((s) => s.key)).toEqual(["sprintSpeed", "sprintDelay", "sprintAccel"]);
    for (const s of SPRINT_SLIDERS) {
      const v = P[s.key];
      expect(v >= s.min && v <= s.max, s.key).toBe(true);
    }
    const p: JumpParams = { ...P };
    expect(p.sprintMode).toBe(1);
    expect(JSON.parse(paramsJson(p))).toMatchObject({ sprintMode: 1, sprintSpeed: 614, sprintDelay: 42, sprintAccel: 3 });
    setSprint(p, false);
    expect(p.sprintMode).toBe(0);
    expect(isDefaultJumpParams(p)).toBe(false);
    p.sprintSpeed = 700;
    setSprint(p, true);
    expect(p.sprintSpeed).toBe(700); // le réglage choisi est gardé
    expect(isDefaultJumpParams(p)).toBe(false);
    resetParams(p);
    expect(p).toEqual({ ...P });
    expect(isDefaultJumpParams(p)).toBe(true);
  });

  it("relit l'élan gardé (`jump:tune`) : seulement des valeurs entières dans les bornes", () => {
    const p = parseTuned(JSON.stringify({ sprintMode: 1, sprintSpeed: 600, sprintDelay: 30, sprintAccel: 3 }));
    expect(p).toMatchObject({ sprintMode: 1, sprintSpeed: 600, sprintDelay: 30, sprintAccel: 3 });
    const bad = parseTuned(JSON.stringify({ sprintMode: 1, sprintSpeed: 99_999, sprintDelay: 1.5 }));
    expect(bad).toMatchObject({ sprintMode: 1, sprintSpeed: P.sprintSpeed, sprintDelay: P.sprintDelay, sprintAccel: P.sprintAccel });
    expect(parseTuned(JSON.stringify({ sprintMode: 0 })).sprintMode).toBe(0);
    expect(isDefaultJumpParams(parseTuned(JSON.stringify({ sprintSpeed: 614 })))).toBe(true);
  });
});
