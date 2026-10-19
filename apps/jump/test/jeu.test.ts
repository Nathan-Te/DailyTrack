import { readFileSync, readdirSync } from "node:fs";
import { parseDay } from "@cdj/core";
import { join } from "node:path";
import {
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  INPUT_LEFT,
  INPUT_RIGHT,
  JUMP_PARAM_KEYS,
  DEATH_SPIKE,
  RESPAWN_TICKS,
  SANDBOX_LEVEL,
  initialAttempt,
  initialPlayer,
  parseLevel,
  stepPlayer,
  type PlayerState,
} from "@cdj/jump-sim";
import { describe, expect, it } from "vitest";
import { CAMERA, clampAxis, followCamera, snapCamera, type Frame } from "../src/camera";
import { JumpLatch, directionBits, padDirection, padJump, padMenu, padRestart } from "../src/input";
import { LOOK, animateLook, onStep, restLook, squashScale } from "../src/look";
import { FixedStepper, MAX_STEPS_PER_FRAME, STEP_SECONDS } from "../src/loop";
import { JumpSession, formatTicks } from "../src/session";
import { TUNE_SLIDERS, TUNE_STORAGE_KEY, formatHuman, jumpHeight, loadTuned, paramsJson, parseTuned, saveTuned, toHuman } from "../src/tune";
import { URL_OPTIONS, archiveHref, dailyHref, galleryHref, moduleHref, readUrlOptions } from "../src/urlOptions";

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
    const none = { debug: false, tune: false, sprint: false, touch: null, zones: false, hitbox: false, fx: true, ghostOff: false, carnageDemo: false, watchBest: false, gallery: false, module: null, daily: false, seed: null, solution: false, theme: null, metronome: true, home: null, archives: false, api: null };
    // Lot 5 : sans paramètre, le niveau du jour.
    expect(readUrlOptions("")).toEqual({ ...none, scenario: null, daily: true });
    expect(readUrlOptions("?scenario=bac-a-sable&debug")).toEqual({ ...none, scenario: "bac-a-sable", debug: true });
    expect(readUrlOptions("?scenario=inconnu&debug&tune")).toEqual({ ...none, scenario: "essai", debug: true, tune: true });
    expect(readUrlOptions("?scenario=dangers").scenario).toBe("dangers");
    expect(readUrlOptions("?tune").tune).toBe(false);
    // Lot 8b : l'essai d'élan, seulement avec debug et tune.
    expect(readUrlOptions("?scenario=bac-a-sable&debug&tune&sprint=1")).toEqual({ ...none, scenario: "bac-a-sable", debug: true, tune: true, sprint: true });
    expect(readUrlOptions("?scenario=bac-a-sable&debug&sprint=1").sprint).toBe(false);
    expect(readUrlOptions("?sprint=1").sprint).toBe(false);
    expect(readUrlOptions("?debug&tune&sprint=2").sprint).toBe(false);
  });

  it("lot P1 : ?api= (adresse du classement ou « demo ») ; les liens internes le gardent", () => {
    expect(readUrlOptions("").api).toBeNull();
    expect(readUrlOptions("?api=demo").api).toBe("demo");
    expect(readUrlOptions("?api=https%3A%2F%2Fexemple.test").api).toBe("https://exemple.test");
    const from = readUrlOptions("?api=demo&debug");
    expect(dailyHref(from)).toBe("?debug&api=demo");
    expect(archiveHref("2026-10-20", from)).toBe("?seed=2026-10-20&debug&api=demo");
  });

  it("lot 12 : ?metronome=off coupe le tempo de la nuit (rien d'autre) ; les liens internes le gardent", () => {
    expect(readUrlOptions("").metronome).toBe(true);
    expect(readUrlOptions("?metronome=off").metronome).toBe(false);
    expect(readUrlOptions("?metronome=on").metronome).toBe(true);
    const from = readUrlOptions("?metronome=off&debug");
    expect(galleryHref(from)).toBe("?modules&debug&metronome=off");
    expect(dailyHref(from)).toBe("?debug&metronome=off");
  });

  it("lot 9 : ?theme= impose un thème (nom avec ou sans accent), un nom inconnu est ignoré ; les liens internes le gardent", () => {
    expect(readUrlOptions("?theme=neon").theme).toBe("neon");
    expect(readUrlOptions("?theme=for%C3%AAt").theme).toBe("foret");
    expect(readUrlOptions("?theme=lave").theme).toBeNull();
    expect(readUrlOptions("?seed=2026-10-20&theme=glace")).toMatchObject({ daily: true, theme: "glace" });
    const from = readUrlOptions("?theme=nuit&debug");
    expect(galleryHref(from)).toBe("?modules&debug&theme=nuit");
    expect(dailyHref(from)).toBe("?debug&theme=nuit");
  });

  it("lot 4 : lit la galerie, le morceau, sa variante, son entrée et la lecture de sa solution ; construit les liens", () => {
    expect(readUrlOptions("?modules").gallery).toBe(true);
    expect(readUrlOptions("?module=inconnu").gallery).toBe(true);
    expect(readUrlOptions("?module=inconnu").module).toBeNull();
    expect(readUrlOptions("?module=cheminee").module).toEqual({ id: "cheminee", variant: 0, entry: "arret", solution: false });
    expect(readUrlOptions("?module=cheminee&variante=2&entree=elan&solution").module).toEqual({ id: "cheminee", variant: 2, entry: "elan", solution: true });
    expect(readUrlOptions("?module=cheminee&variante=9").module!.variant).toBe(0);
    expect(readUrlOptions("?module=cheminee&variante=-1").module!.variant).toBe(0);
    expect(readUrlOptions("?module=cheminee&entree=n'importe").module!.entry).toBe("arret");
    const from = readUrlOptions("?modules&debug&touch=1&fx=off");
    expect(moduleHref({ id: "cheminee", variant: 1, entry: "elan", solution: true }, from)).toBe("?module=cheminee&variante=1&entree=elan&solution&debug&touch=1&fx=off");
    expect(moduleHref({ id: "plaine", variant: 0, entry: "arret" }, readUrlOptions(""))).toBe("?module=plaine&variante=0");
    expect(galleryHref(from)).toBe("?modules&debug&touch=1&fx=off");
    expect(readUrlOptions(moduleHref({ id: "puits", variant: 2, entry: "elan" }, from)).module).toEqual({ id: "puits", variant: 2, entry: "elan", solution: false });
  });

  it("lot 5 : le niveau du jour (page par défaut), ?seed=AAAA-MM-JJ et &solution ; le lien du passage de minuit", () => {
    expect(readUrlOptions("?seed=2026-10-20")).toMatchObject({ daily: true, scenario: null, seed: parseDay("2026-10-20"), solution: false });
    expect(readUrlOptions("?seed=2026-10-20&solution&debug")).toMatchObject({ daily: true, seed: parseDay("2026-10-20"), solution: true, debug: true });
    expect(readUrlOptions("?seed=2026-02-30").seed).toBeNull(); // illisible : le niveau du jour
    expect(readUrlOptions("?seed=demain").seed).toBeNull();
    expect(readUrlOptions("?solution").solution).toBe(true);
    // Un scénario ou un morceau n'est pas le niveau du jour : `seed` et `solution` ne s'y appliquent pas (le morceau a sa propre solution).
    expect(readUrlOptions("?scenario=essai&seed=2026-10-20")).toMatchObject({ daily: false, seed: null });
    expect(readUrlOptions("?module=cheminee&solution")).toMatchObject({ daily: false, solution: false, module: { id: "cheminee", solution: true } });
    expect(readUrlOptions("?modules").daily).toBe(false);
    expect(dailyHref(readUrlOptions("?seed=2026-10-20&solution&debug&touch=1"))).toBe("?debug&touch=1");
    expect(dailyHref(readUrlOptions(""))).toBe("?");
  });

  it("lit touch (1, 0, ou l'appareil décide) et zones", () => {
    expect(readUrlOptions("?touch=1").touch).toBe("1");
    expect(readUrlOptions("?touch=0").touch).toBe("0");
    expect(readUrlOptions("?touch=oui").touch).toBeNull();
    expect(readUrlOptions("?zones").zones).toBe(true);
  });

  it("lit hitbox (seulement avec debug) et fx=off", () => {
    expect(readUrlOptions("?hitbox").hitbox).toBe(false);
    expect(readUrlOptions("?debug&hitbox").hitbox).toBe(true);
    expect(readUrlOptions("?fx=off").fx).toBe(false);
    expect(readUrlOptions("?fx=on").fx).toBe(true);
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

  it("stick avec zone morte, croix prioritaire, A/B saut, Select recommencer, Start ouvre le menu (lot 8)", () => {
    expect(padDirection(pad([0.2], []))).toBe(0);
    expect(padDirection(pad([0.6], []))).toBe(1);
    expect(padDirection(pad([-0.6], []))).toBe(-1);
    expect(padDirection(pad([0.9], [14]))).toBe(-1);
    expect(padJump(pad([], [0]))).toBe(true);
    expect(padJump(pad([], [1]))).toBe(true);
    expect(padJump(pad([], [2]))).toBe(false);
    // Lot 8 : Start ouvre le menu ⏸ (il recommençait aux lots 1 à 7), Select reste « recommencer ».
    expect(padRestart(pad([], [9]))).toBe(false);
    expect(padRestart(pad([], [8]))).toBe(true);
    expect(padMenu(pad([], [9]))).toBe(true);
    expect(padMenu(pad([], [8]))).toBe(false);
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
    expect(session.state.player.x).toBeGreaterThan(initialPlayer(SANDBOX_LEVEL).x);
    session.restart();
    expect(session.state).toEqual(initialAttempt(SANDBOX_LEVEL));
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

  it("sur le bac à sable (sans danger), l'essai joue exactement stepPlayer (le jeu n'ajoute rien à la simulation)", () => {
    const session = new JumpSession(SANDBOX_LEVEL, { ...DEFAULT_JUMP_PARAMS });
    let s: PlayerState = initialPlayer(SANDBOX_LEVEL);
    const inputs = [INPUT_RIGHT, INPUT_RIGHT | INPUT_JUMP, INPUT_JUMP, 0, INPUT_LEFT, INPUT_LEFT | INPUT_RIGHT];
    for (let i = 0; i < 300; i++) {
      const input = inputs[i % inputs.length]!;
      s = stepPlayer(s, input, SANDBOX_LEVEL, DEFAULT_JUMP_PARAMS);
      session.step(input);
    }
    expect(session.state.player).toEqual(s);
  });

  // Un couloir : départ, un pic, l'arrivée ; on meurt en courant, on arrive en sautant.
  const corridor = parseLevel([...Array(5).fill("#.............#"), "#S.....^.....F#", "###############"].join("\n"));
  const dieOnce = (session: JumpSession) => {
    let event = null;
    for (let i = 0; i < 400 && !event; i++) event = session.step(INPUT_RIGHT);
    return event;
  };

  it("compte les morts et garde la dernière ; la réapparition est un nouvel essai ; recommencer n'est pas une mort", () => {
    const session = new JumpSession(corridor, { ...DEFAULT_JUMP_PARAMS });
    const death = dieOnce(session);
    expect(death).toMatchObject({ kind: "death", cause: DEATH_SPIKE });
    expect(session.deaths).toBe(1);
    expect(session.lastDeath?.cause).toBe(DEATH_SPIKE);
    let respawn = null;
    let waited = 0;
    while (!respawn && waited < 100) {
      respawn = session.step(INPUT_RIGHT);
      waited++;
    }
    expect(respawn).toEqual({ kind: "respawn", checkpoint: false });
    expect(waited).toBe(RESPAWN_TICKS);
    expect(session.state).toEqual(initialAttempt(corridor));
    expect(session.prev).toBe(session.state); // pas d'interpolation depuis le lieu de la mort
    expect(session.attempts).toBe(2);
    // Recommencer en pleine course : nouvel essai, pas une mort.
    for (let i = 0; i < 10; i++) session.step(INPUT_RIGHT);
    session.restart();
    expect(session.deaths).toBe(1);
    expect(session.attempts).toBe(3);
    expect(session.state).toEqual(initialAttempt(corridor));
  });

  it("l'arrivée fige le temps et donne le meilleur temps de la session (un essai aux réglages modifiés ne compte pas)", () => {
    const finish = (session: JumpSession, jumpAt: number) => {
      let event = null;
      for (let t = 0; t < 600 && event?.kind !== "finish"; t++) event = session.step(t >= jumpAt && t < jumpAt + 45 ? INPUT_RIGHT | INPUT_JUMP : INPUT_RIGHT);
      return event;
    };
    const params = { ...DEFAULT_JUMP_PARAMS };
    const session = new JumpSession(corridor, params);
    let jumpAt = 0;
    for (; jumpAt < 120; jumpAt++) {
      const probe = new JumpSession(corridor, { ...DEFAULT_JUMP_PARAMS });
      if (finish(probe, jumpAt)?.kind === "finish") break;
    }
    const first = finish(session, jumpAt);
    expect(first).toMatchObject({ kind: "finish", best: true });
    expect(session.best).toBe(session.state.time);
    const frozen = session.state;
    session.step(INPUT_RIGHT);
    expect(session.state).toBe(frozen);
    // Moins bien (on attend avant de partir : le chrono ne tourne pas, donc même temps) : pas un nouveau meilleur.
    session.restart();
    for (let i = 0; i < 30; i++) session.step(0);
    expect(finish(session, jumpAt)).toMatchObject({ kind: "finish", best: false });
    expect(session.best).toBe(frozen.time);
    // Réglages modifiés (gravité plus faible : le même saut va plus loin, l'arrivée est plus tôt) : pas un meilleur temps.
    params.gravity -= 2;
    let tuned = null;
    for (let j = 0; j < 120 && tuned?.kind !== "finish"; j++) {
      session.restart();
      tuned = finish(session, j);
    }
    expect(tuned?.kind).toBe("finish");
    expect(session.tuned).toBe(true);
    expect(session.best).toBe(frozen.time);
  });

  it("point de passage : signalé une fois ; mourir après fait reprendre dessus dans le même essai (pas un nouvel essai), chrono qui continue", () => {
    const lv = parseLevel([...Array(5).fill("#...............#"), "#S...C......F...#", "#########.#######"].join("\n"));
    const session = new JumpSession(lv, { ...DEFAULT_JUMP_PARAMS });
    const events: string[] = [];
    let respawned = null;
    for (let t = 0; t < 600 && !respawned; t++) {
      const e = session.step(INPUT_RIGHT);
      if (e) events.push(e.kind);
      if (e?.kind === "respawn") respawned = e;
    }
    expect(events).toEqual(["checkpoint", "death", "respawn"]);
    expect(respawned).toEqual({ kind: "respawn", checkpoint: true });
    expect(session.attempts).toBe(1);
    expect(session.deaths).toBe(1);
    expect(session.attemptDeaths).toBe(1);
    expect(session.state.time).toBeGreaterThan(session.lastDeath!.time);
    expect(session.prev).toBe(session.state);
    // Recommencer oublie le point : départ, chrono à zéro, nouvel essai.
    session.restart();
    expect(session.state).toEqual(initialAttempt(lv));
    expect(session.attempts).toBe(2);
    expect(session.attemptDeaths).toBe(0);
  });

  it("formate un temps en secondes à 3 décimales", () => {
    expect(formatTicks(0)).toBe("0,000 s");
    expect(formatTicks(1)).toBe("0,008 s");
    expect(formatTicks(120)).toBe("1,000 s");
    expect(formatTicks(3601)).toBe("30,008 s");
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
