import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Mesh, MeshStandardMaterial } from "three";
import { ReplayPlayer, TICK_RATE, bestPilotRun, createTestTrack, encodeReplay, replayRace, salonSessionStart } from "@cdj/sim";
import { createCarMesh } from "../src/carMesh";
import { HttpSalonApi } from "../src/salonApi";
import { DemoSalonApi } from "../src/salonDemo";
import { SalonClock } from "../src/salon";
import { loadCircuit, type SalonEngine } from "../src/salonEngine";
import { computeCircuit } from "../src/salonJobs";
import { RunSession } from "../src/session";
import {
  ORBIT_MAX_DIST,
  ORBIT_MAX_PITCH,
  ORBIT_MIN_DIST,
  ORBIT_MIN_PITCH,
  REWIND_TICKS,
  WATCH_SPEEDS,
  clampOrbit,
  nextWatchCamera,
  orbitOffset,
  progressOf,
  seekTick,
  speedLabel,
  speedShort,
  tickAt,
  unwatchHref,
  wantsWatch,
  watchHref,
  watchHrefFor,
  watchTitle,
} from "../src/watch";
import { archiveHref } from "../src/archive";
import { chargerLangue, setLangue } from "../src/i18n";

// L'anglais est un fichier à part, chargé à la demande (i18n.ts) : on le charge avant les tests qui passent en anglais.
beforeAll(() => chargerLangue("en"));

// Lot I4 : les textes viennent des catalogues ; ces tests sont écrits pour le français, l'anglais a le sien plus bas.
beforeAll(() => setLangue("fr", { ecrire: false }));

afterEach(() => vi.unstubAllGlobals());

describe("règles du mode spectateur (watch.ts)", () => {
  it("retour de 5 s, vitesses, libellés", () => {
    expect(REWIND_TICKS).toBe(5 * TICK_RATE);
    expect([...WATCH_SPEEDS]).toEqual([0.25, 0.5, 1, 2]);
    expect(WATCH_SPEEDS.map(speedLabel)).toEqual(["×0,25", "×0,5", "×1", "×2"]);
    expect(WATCH_SPEEDS.map(speedShort)).toEqual(["¼", "½", "1×", "2×"]);
    expect(watchTitle("Alice", 31_456)).toBe("Rediffusion de Alice — 31,456\u00a0s");
    setLangue("en", { ecrire: false });
    try {
      expect(WATCH_SPEEDS.map(speedLabel)).toEqual(["×0.25", "×0.5", "×1", "×2"]);
      expect(watchTitle("Alice", 31_456)).toBe("Replay of Alice — 31.456\u00a0s");
    } finally {
      setLangue("fr", { ecrire: false });
    }
  });

  it("les sauts restent entre le départ et l'arrivée", () => {
    expect(seekTick(3000, 4800, -REWIND_TICKS)).toBe(2400);
    expect(seekTick(100, 4800, -REWIND_TICKS)).toBe(0);
    expect(seekTick(4700, 4800, REWIND_TICKS)).toBe(4800);
    expect(progressOf(2400, 4800)).toBe(0.5);
    expect(progressOf(9999, 4800)).toBe(1);
    expect(progressOf(0, 0)).toBe(1);
    expect(tickAt(0.5, 4800)).toBe(2400);
    expect(tickAt(-1, 4800)).toBe(0);
    expect(tickAt(2, 4800)).toBe(4800);
  });

  it("adresses : watch=best s'ajoute à la page actuelle, sans rien perdre, et s'enlève", () => {
    expect(watchHref("?api=demo&day=2026-09-30")).toBe("?api=demo&day=2026-09-30&watch=best");
    expect(watchHref("?mode=salon&api=demo&salonMinutes=2")).toBe("?mode=salon&api=demo&salonMinutes=2&watch=best");
    expect(watchHref("?watch=best")).toBe("?watch=best");
    expect(watchHrefFor("./")).toBe("?watch=best");
    expect(watchHrefFor(archiveHref("?api=demo", "2026-09-30", false))).toBe("?api=demo&seed=2026-09-30&watch=best");
    expect(unwatchHref("?api=demo&watch=best&day=2026-09-30")).toBe("?api=demo&day=2026-09-30");
    expect(unwatchHref("?watch=best")).toBe("./");
    expect(wantsWatch(new URLSearchParams("watch=best"))).toBe(true);
    expect(wantsWatch(new URLSearchParams("watch=1"))).toBe(false);
    expect(wantsWatch(new URLSearchParams(""))).toBe(false);
  });

  it("la touche C parcourt proche, loin, capot, puis la caméra libre, puis recommence", () => {
    let c = { index: 0, free: false };
    const seen: string[] = [];
    for (let i = 0; i < 5; i++) {
      c = nextWatchCamera(c.index, c.free, 3);
      seen.push(c.free ? "libre" : String(c.index));
    }
    expect(seen).toEqual(["1", "2", "libre", "0", "1"]);
  });

  it("caméra libre : position sur une sphère autour de la voiture, bornée", () => {
    const o = orbitOffset(0.7, 0.5, 12);
    expect(Math.hypot(o.x, o.y, o.z)).toBeCloseTo(12, 9);
    expect(o.y).toBeCloseTo(12 * Math.sin(0.5), 9);
    expect(orbitOffset(0, 0, 10)).toEqual({ x: 0, y: 0, z: 10 });
    expect(clampOrbit(5, 1000)).toEqual({ pitch: ORBIT_MAX_PITCH, dist: ORBIT_MAX_DIST });
    expect(clampOrbit(-5, 0)).toEqual({ pitch: ORBIT_MIN_PITCH, dist: ORBIT_MIN_DIST });
  });
});

describe("la lecture rejoue la rediffusion avec le même code (aucun changement de sim)", () => {
  const track = createTestTrack();
  const pilot = bestPilotRun(track)!;
  const replay = pilot.replay;
  const announced = replayRace(track, replay).finishMs;

  /** Ce que fait `restartWatch` (main.ts) : une session neuve, rejouée en silence jusqu'au pas voulu. */
  const seek = (tick: number) => {
    const session = new RunSession(track, null);
    const player = new ReplayPlayer(replay);
    for (let i = 0; i < tick && session.race.finishMs < 0; i++) session.step(player.next());
    return { session, player };
  };
  const finish = (s: { session: RunSession; player: ReplayPlayer }) => {
    while (s.session.race.finishMs < 0 && !s.player.done) s.session.step(s.player.next());
    return s.session.race.finishMs;
  };

  it("de bout en bout : exactement le temps du rejeu du serveur", () => {
    expect(announced).toBe(pilot.finishMs);
    expect(finish(seek(0))).toBe(announced);
  });

  it("revenir de 5 s (ou sauter n'importe où) puis finir donne le même temps, au pas près", () => {
    const total = pilot.replay.runs.reduce((n, r) => n + r.count, 0);
    for (const at of [1, 600, Math.floor(total / 3), total - 700, total - 1]) {
      const s = seek(at);
      const back = seek(Math.max(0, at - REWIND_TICKS));
      expect(finish(back)).toBe(announced);
      expect(finish(s)).toBe(announced);
    }
  });

  it("l'état après un saut est identique à celui d'une lecture continue (même voiture, mêmes temps intermédiaires)", () => {
    const total = pilot.replay.runs.reduce((n, r) => n + r.count, 0);
    const at = Math.floor(total * 0.6);
    const jumped = seek(at).session.race;
    const straight = new RunSession(track, null);
    const player = new ReplayPlayer(replay);
    for (let i = 0; i < at; i++) straight.step(player.next());
    expect(jumped.car).toEqual(straight.race.car);
    expect(jumped.splits).toEqual(straight.race.splits);
  });

  it("coût d'un retour en arrière (rejeu depuis le départ) : de l'ordre de la dizaine de millisecondes", () => {
    const total = pilot.replay.runs.reduce((n, r) => n + r.count, 0);
    const t0 = performance.now();
    const runs = 5;
    for (let i = 0; i < runs; i++) seek(total - 1);
    const ms = (performance.now() - t0) / runs;
    console.log(`[watch] retour en arrière d'un tour de ${(total / TICK_RATE).toFixed(1)} s (${total} pas) : ${ms.toFixed(1)} ms`);
    expect(ms).toBeLessThan(250); // large marge (machine de CI lente) : l'image où l'on revient ne se fait pas remarquer
  });
});

describe("spectateur du Salon : aucune présence, aucune session finie", () => {
  it("sans identifiant de joueur, la requête n'en porte pas (le serveur n'écrit donc aucune présence)", async () => {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      calls.push(String(url));
      return new Response(JSON.stringify({ ok: 1 }), { status: 200 });
    });
    const api = new HttpSalonApi("http://api.test");
    await api.now(null);
    await api.board(42, null);
    await api.board(42, null, 7);
    await api.now("abc");
    expect(calls).toEqual([
      "http://api.test/api/salon/now",
      "http://api.test/api/salon/42/board",
      "http://api.test/api/salon/42/board?since=7",
      "http://api.test/api/salon/now?player=abc",
    ]);
  });

  it("le Salon de démonstration oublie une session finie : plus de classement, de fantômes ni de course", async () => {
    const len = 600_000;
    const session = 2_970_011;
    const start = salonSessionStart(session, len);
    const circuit = loadCircuit(computeCircuit(session))!;
    const pilot = bestPilotRun(circuit.track)!;
    const clock = new SalonClock(() => 0);
    clock.set(start + 300_000);
    const engine: SalonEngine = { circuit: async () => circuit, pilotRun: async () => null };
    const api = new DemoSalonApi({ clock, sessionMs: len, engine, circuit: async () => circuit });
    const sent = await api.submit(session, "p1", "Moi", encodeReplay(pilot.replay));
    expect(sent.ok).toBe(true);
    const ref = sent.ok ? sent.data.board.me!.ref : "";
    // La session est finie mais la fenêtre de lecture (20 s) court : classement et fantôme encore servis (le podium s'en sert).
    clock.set(start + len + 19_000);
    const during = await api.board(session, "p1");
    expect(during.ok && during.data.rows.map((r) => r.name)).toContain("Moi");
    expect((await api.ghosts(session, [ref])).ok).toBe(true);
    // La fenêtre écoulée : plus rien.
    clock.set(start + len + 20_001);
    const after = await api.board(session, "p1");
    expect(!after.ok && after.status).toBe(404);
    const gone = await api.ghosts(session, [ref]);
    expect(!gone.ok && gone.status).toBe(404);
    // La session suivante repart de zéro : ni course ni classement de la précédente.
    const next = await api.board(session + 1, "p1");
    expect(next.ok && next.data.rows.filter((r) => r.mine)).toEqual([]);
    expect(next.ok && next.data.me).toBeNull();
  });
});

describe("voiture regardée en rediffusion", () => {
  it("pleine (pas translucide) et à la couleur du fantôme ; le fantôme reste translucide", () => {
    const solid = (g: ReturnType<typeof createCarMesh>["group"]) => {
      const mats: MeshStandardMaterial[] = [];
      g.traverse((o) => {
        if (o instanceof Mesh && o.material instanceof MeshStandardMaterial) mats.push(o.material);
      });
      return mats;
    };
    const watched = solid(createCarMesh(true, 0xff4fa3, false, true).group);
    expect(watched.length).toBeGreaterThan(10);
    expect(watched.every((m) => !m.transparent && m.opacity === 1)).toBe(true);
    const ghost = solid(createCarMesh(true, 0xff4fa3).group);
    expect(ghost.every((m) => m.transparent)).toBe(true);
  });
});
