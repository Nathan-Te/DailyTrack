import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ATTEMPT_DEAD,
  ATTEMPT_READY,
  ATTEMPT_RUNNING,
  DEFAULT_JUMP_PARAMS,
  INPUT_JUMP,
  INPUT_RESPAWN,
  INPUT_RIGHT,
  JUMP_SIM_VERSION,
  RESPAWN_TICKS,
  RESTART_VERSION,
  BRIDGE_VERSION,
  TICK_RATE,
  decodeReplay,
  encodeReplay,
  parseLevel,
  replayAttempt,
  type Level,
} from "@cdj/jump-sim";
import { describe, expect, it } from "vitest";
import { Controls, KEYS, padRespawn, padRestart } from "../src/input";
import { JumpSession, START, START_DEFAULTS, decompteDigit, readyTicks } from "../src/session";
import "./francais";

// Lot 27 côté jeu : les commandes de reprise **comme DailyTrack** (R : dernier point de passage, Entrée : recommencer à zéro, Y et X à la manette), la session du niveau en version 11 (une mort avant le
// premier point recommence l'essai à zéro, sans décompte ; la reprise volontaire ne compte pas comme une mort) et le décompte « 3, 2, 1, Partez ! » (1,5 s, jamais après une mort).

const P = { ...DEFAULT_JUMP_PARAMS };

/** Un sol, un départ, un point de passage, puis une fosse avant l'arrivée (`pitBefore` : la fosse est avant le point, on y tombe tout droit sans en avoir franchi aucun). */
function room(version: number, pitBefore = false): Level {
  const floor = pitBefore ? "####....######################" : "################....##########";
  return parseLevel(`
##############################
#............................#
#............................#
#............................#
#............................#
#S.........C..............F..#
${floor}

version ${version}
section a 1-28 phase 11
scie s1 o 120 aller-retour 14,2 18,2
`);
}

describe("lot 27 — les mêmes touches que DailyTrack", () => {
  it("R reprend au dernier point de passage, Entrée recommence à zéro ; à la manette Y et X ; Start la pause", () => {
    expect(KEYS.respawn).toEqual(["KeyR"]);
    expect(KEYS.restart).toEqual(["Enter"]);
    const pad = (pressed: number[]) => ({ buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: pressed.includes(i), value: 0, touched: false })) });
    expect(padRespawn(pad([3]))).toBe(true);
    expect(padRestart(pad([2]))).toBe(true);
  });

  it("parité avec DailyTrack : les touches et boutons de `apps/web/src/input.ts` sont les mêmes (R, Entrée, Y = bouton 3, X = bouton 2)", () => {
    // Lecture seule : DailyTrack n'est pas modifié ; si ses touches changent, ce test dit qu'il faut aligner Jump (ou l'inverse).
    const track = readFileSync(join(import.meta.dirname, "../../web/src/input.ts"), "utf8");
    expect(track).toMatch(/respawn: \["KeyR"\]/);
    expect(track).toMatch(/restart: \["Enter"\]/);
    expect(track).toMatch(/padRespawn = [^;]*buttons\[3\]/);
    expect(track).toMatch(/padRestart = [^;]*buttons\[2\]/);
    expect(track).toMatch(/pause: \["KeyP"\]/);
  });

  const key = (target: EventTarget, code: string, extra: Record<string, unknown> = {}) => {
    const e = Object.assign(new Event("keydown", { cancelable: true }), { code, repeat: false, ...extra });
    target.dispatchEvent(e);
    return e;
  };

  it("Controls : R lève « reprendre », Entrée lève « recommencer » (une fois chacun), les boutons tactiles font de même", () => {
    const target = new EventTarget();
    const c = new Controls(target as unknown as Window);
    expect([c.takeRespawn(), c.takeRestart()]).toEqual([false, false]);
    key(target, "KeyR");
    expect([c.takeRespawn(), c.takeRestart()]).toEqual([true, false]);
    expect(c.takeRespawn()).toBe(false);
    key(target, "Enter");
    expect([c.takeRespawn(), c.takeRestart()]).toEqual([false, true]);
    c.requestRespawn();
    c.requestRestart();
    expect([c.takeRespawn(), c.takeRestart()]).toEqual([true, true]);
  });

  it("menu ouvert : ni R ni Entrée ne commandent la partie ; une demande en attente est oubliée", () => {
    const target = new EventTarget();
    const c = new Controls(target as unknown as Window);
    c.requestRespawn();
    c.setSuspended(true);
    key(target, "KeyR");
    key(target, "Enter");
    expect([c.takeRespawn(), c.takeRestart()]).toEqual([false, false]);
  });

  it("R et Entrée ne font pas défiler la page (comme l'espace et les flèches)", () => {
    const target = new EventTarget();
    new Controls(target as unknown as Window);
    expect(key(target, "KeyR").defaultPrevented).toBe(true);
    expect(key(target, "Enter").defaultPrevented).toBe(true);
  });
});

describe("lot 27 — la session d'un niveau en version 11", () => {
  const level = room(RESTART_VERSION);
  const pit = room(RESTART_VERSION, true);

  it("mort avant le premier point : l'essai recommence à zéro tout de suite, sans décompte, le chrono et l'horloge à 0 ; l'essai d'avant est clos (mort)", () => {
    const s = new JumpSession(pit, P, "essai");
    s.go();
    let ev = null as ReturnType<JumpSession["step"]>;
    // On court tout droit : la fosse (colonnes 4 à 7) tue avant le point de passage.
    while (s.state.status !== ATTEMPT_DEAD) ev = s.step(INPUT_RIGHT);
    expect(ev?.kind).toBe("death");
    expect(s.state.checkpoint).toBe(-1);
    const deaths = s.deaths;
    const closed = s.takeEssai();
    expect(closed?.essai.end).toBe("mort");
    let again = null as ReturnType<JumpSession["step"]>;
    for (let i = 0; i < RESPAWN_TICKS; i++) again = s.step(0);
    expect(again).toEqual({ kind: "respawn", checkpoint: false });
    expect(s.state.status).toBe(ATTEMPT_READY);
    expect(s.state.time).toBe(0);
    expect(s.ready, "pas de décompte après une mort").toBe(false);
    expect(s.countdown).toBe(0);
    expect(s.deaths).toBe(deaths);
    expect(s.attemptDeaths).toBe(0);
    // Le pas suivant est le pas 1 de l'essai neuf, enregistré à part.
    s.step(INPUT_RIGHT);
    expect(s.state.time).toBe(1);
    expect(s.recorder!.recording).toBe(true);
    expect(s.recorder!.ticks).toBe(1);
  });

  it("mort après le premier point : reprise sur le point, le chrono continue (v11 comme avant)", () => {
    const s = new JumpSession(level, P, "essai");
    s.go();
    while (s.state.checkpoint < 0) s.step(INPUT_RIGHT);
    const at = s.state.time;
    s.state = { ...s.state, status: ATTEMPT_DEAD, deathTicks: 0, deathCause: 2 };
    let ev = null as ReturnType<JumpSession["step"]>;
    for (let i = 0; i < RESPAWN_TICKS; i++) ev = s.step(0);
    expect(ev).toEqual({ kind: "respawn", checkpoint: true });
    expect(s.state.status).toBe(ATTEMPT_RUNNING);
    expect(s.state.time).toBe(at + RESPAWN_TICKS);
    expect(s.countdown).toBe(0);
  });

  it("canResume : seulement vivant, un point franchi, niveau en version 11, hors décompte et hors lecture", () => {
    const s = new JumpSession(level, P, "essai");
    expect(s.canResume, "décompte en cours").toBe(false);
    s.go();
    expect(s.canResume, "avant le premier point").toBe(false);
    while (s.state.checkpoint < 0) s.step(INPUT_RIGHT);
    expect(s.canResume).toBe(true);
    expect(new JumpSession(level, P, null).canResume, "une lecture n'enregistre rien").toBe(false);
    const old = room(BRIDGE_VERSION);
    const o = new JumpSession(old, P, "essai");
    o.go();
    while (o.state.checkpoint < 0) o.step(INPUT_RIGHT);
    expect(o.canResume, "un niveau d'avant la version 11 ne sait pas enregistrer une reprise").toBe(false);
  });

  it("la reprise volontaire : au point, le chrono continue, ce n'est pas une mort, elle est enregistrée et rejouée", () => {
    const s = new JumpSession(level, P, "essai");
    s.go();
    while (s.state.checkpoint < 0) s.step(INPUT_RIGHT);
    for (let i = 0; i < 30; i++) s.step(INPUT_RIGHT);
    const beforeX = s.state.player.x;
    const beforeTime = s.state.time;
    const ev = s.step(INPUT_RIGHT | INPUT_RESPAWN);
    expect(ev).toEqual({ kind: "resume", checkpoint: 0 });
    expect(s.state.player.x).toBeLessThan(beforeX);
    expect(s.state.time).toBe(beforeTime + 1);
    expect(s.deaths, "pas une mort").toBe(0);
    expect(s.attemptDeaths).toBe(0);
    expect(s.lastDeath).toBeNull();
    expect(s.prev, "pas d'interpolation depuis l'ancienne position").toBe(s.state);
    for (let i = 0; i < 10; i++) s.step(INPUT_RIGHT);
    // Rien n'est clos : l'essai continue ; sa rediffusion porte le bit de reprise et le rejeu retrouve l'état vécu.
    const replay = s.recorder!.peek()!;
    expect(replay.simVersion).toBe(RESTART_VERSION);
    expect(replay.runs.some((r) => r.bits & INPUT_RESPAWN)).toBe(true);
    const r = replayAttempt(level, decodeReplay(encodeReplay(replay)), "essai");
    expect(r.final).toEqual(s.state);
    expect(r.deaths).toHaveLength(0);
  });

  it("« recommencer à zéro » relance le décompte (et abandonne l'essai en cours) ; un saut tenu à l'instant du départ ne fait pas sauter", () => {
    const s = new JumpSession(level, P, "essai");
    expect(s.countdown).toBe(readyTicks());
    s.go();
    for (let i = 0; i < 40; i++) s.step(INPUT_RIGHT);
    s.restart();
    expect(s.ready).toBe(true);
    expect(s.countdown).toBe(readyTicks());
    expect(s.state.time).toBeLessThan(0); // le chrono négatif : les dangers bougent déjà
    expect(s.takeEssai()?.essai.end).toBe("abandon");
    let go = null as ReturnType<JumpSession["step"]>;
    for (let i = 0; i < readyTicks(); i++) go = s.step(i === readyTicks() - 1 ? INPUT_JUMP : 0);
    expect(go).toEqual({ kind: "go" });
    expect(s.state.player.held).toBe(1);
  });
});

describe("lot 27 — le décompte « 3, 2, 1, Partez ! »", () => {
  it("1,5 s par défaut (180 pas), réglable ; trois chiffres, un par tiers", () => {
    expect(START_DEFAULTS.pret).toBe(1.5);
    expect(START.pret).toBe(1.5);
    expect(readyTicks()).toBe(Math.round(1.5 * TICK_RATE));
    expect(readyTicks()).toBe(180);
    const total = readyTicks();
    const seen: number[] = [];
    for (let left = total; left >= 1; left--) {
      const d = decompteDigit(left, total);
      if (seen[seen.length - 1] !== d) seen.push(d);
    }
    expect(seen).toEqual([3, 2, 1]);
    // Chaque chiffre dure 60 pas (0,5 s).
    expect([180, 121, 120, 61, 60, 1].map((n) => decompteDigit(n, total))).toEqual([3, 3, 2, 2, 1, 1]);
    expect(decompteDigit(0, total)).toBe(0);
    START.pret = 0.3;
    expect(readyTicks()).toBe(36);
    START.pret = START_DEFAULTS.pret;
  });

  it("le décompte se joue au premier départ : le chrono part à son dernier pas, que le joueur bouge ou non ; les dangers tournent déjà (chrono négatif)", () => {
    const s = new JumpSession(room(RESTART_VERSION), P, "essai");
    expect(s.countdown).toBe(180);
    expect(s.state.time).toBe(-180);
    let ev = null as ReturnType<JumpSession["step"]>;
    for (let i = 0; i < 179; i++) ev = s.step(0);
    expect(ev).toBeNull();
    expect(s.countdown).toBe(1);
    ev = s.step(0);
    expect(ev).toEqual({ kind: "go" });
    expect(s.ready).toBe(false);
    expect(s.state.time).toBe(0);
  });

  it("un niveau d'avant la version 11 (essai en v3, jour figé en v10) garde son départ : v3 attend la première commande, v10 compte le même décompte", () => {
    const v3 = new JumpSession(parseLevel("#####\n#S.F#\n#####\n"), P, "essai");
    expect(v3.ready).toBe(false);
    const v10 = new JumpSession(room(BRIDGE_VERSION), P, "essai");
    expect(v10.countdown).toBe(readyTicks());
  });

  it("les versions : JUMP_SIM_VERSION est celle des niveaux de la version 11", () => {
    expect(JUMP_SIM_VERSION).toBe(RESTART_VERSION);
  });
});
