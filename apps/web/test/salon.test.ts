import { afterEach, describe, expect, it, vi } from "vitest";
import { ReplayRecorder, bestPilotRun, encodeReplay, salonCircuit, salonSessionStart, salonTheme, SIM_VERSION } from "@cdj/sim";
import {
  LAST_TRY_MS,
  MAX_GHOSTS,
  PREPARE_MS,
  SUBMIT_GRACE_MS,
  SalonClock,
  countdownText,
  ghostShown,
  nextSalonGhostMode,
  overtakenBy,
  pickGhostRefs,
  salonShareLine,
  sessionClock,
  sessionLabel,
  sessionMsFromParams,
  submitOpen,
  modeHref,
} from "../src/salon";
import { HttpSalonApi } from "../src/salonApi";
import { createCarMesh, tintedGhostLook } from "../src/carMesh";
import { GHOST_COLORS, MY_GHOST_COLOR } from "../src/salon";
import { Mesh } from "three";
import { demoPlan, plannedRuns } from "../src/salonPlan";
import { DemoSalonApi, myRef } from "../src/salonDemo";
import { loadCircuit, type SalonEngine } from "../src/salonEngine";
import { computeCircuit, computePilotRun, type PilotRunData } from "../src/salonJobs";
import type { SalonBoard, SalonRow } from "../src/salonApi";

const row = (rank: number, ref: string, ms = 30_000 + rank * 500, mine = false): SalonRow => ({ rank, ref, name: `P${rank}`, ms, gap: ms - 30_500, ...(mine ? { mine: true } : {}) });
const board = (rows: SalonRow[]): Pick<SalonBoard, "rows" | "me"> => ({ rows, me: rows.find((r) => r.mine) ?? null });

describe("horloge et déroulé d'une session", () => {
  it("l'horloge se recale sur l'heure du serveur, à la moitié de l'aller-retour", () => {
    let local = 1_000_000;
    const clock = new SalonClock(() => local);
    expect(clock.now()).toBe(1_000_000); // sans serveur : l'horloge locale
    // requête envoyée à 1 000 000, réponse reçue à 1 000 200 : le serveur a répondu vers 1 000 100 (heure locale) et dit 5 000 000
    clock.sync(5_000_000, 1_000_000, 1_000_200);
    local = 1_000_200;
    expect(clock.now()).toBe(5_000_100); // 5 000 000 + 100 de trajet retour
    local += 1000;
    expect(clock.now()).toBe(5_001_100); // elle continue d'avancer
    clock.set(42);
    expect(clock.now()).toBe(42);
    local += 5;
    expect(clock.now()).toBe(47);
  });

  it("compte à rebours, dernier essai, préparation et clôture", () => {
    const session = 1000;
    const len = 600_000;
    const end = (session + 1) * len;
    expect(sessionClock(end - 400_000, session, len)).toMatchObject({ remainingMs: 400_000, lastTry: false, preparing: false, ended: false, closed: false });
    expect(sessionClock(end - PREPARE_MS, session, len).preparing).toBe(true);
    expect(sessionClock(end - LAST_TRY_MS - 1, session, len).lastTry).toBe(false);
    expect(sessionClock(end - LAST_TRY_MS, session, len).lastTry).toBe(true);
    expect(sessionClock(end, session, len)).toMatchObject({ lastTry: false, ended: true, closed: false });
    expect(submitOpen(end + SUBMIT_GRACE_MS, session, len)).toBe(true); // une course commencée avant la fin
    expect(submitOpen(end + SUBMIT_GRACE_MS + 1, session, len)).toBe(false);
  });

  it("formate le temps restant et l'heure UTC de la session", () => {
    expect(countdownText(462_100)).toBe("07:43");
    expect(countdownText(0)).toBe("00:00");
    expect(countdownText(-5)).toBe("00:00");
    const session = Math.floor(Date.UTC(2026, 9, 9, 14, 23) / 600_000);
    expect(sessionLabel(session)).toBe("14:20");
    expect(salonSessionStart(session)).toBe(Date.UTC(2026, 9, 9, 14, 20));
  });

  it("`?salonMinutes=N` raccourcit les sessions (bornes de bon sens)", () => {
    expect(sessionMsFromParams("")).toBe(600_000);
    expect(sessionMsFromParams("?salonMinutes=2")).toBe(120_000);
    expect(sessionMsFromParams("?salonMinutes=0.5")).toBe(30_000);
    expect(sessionMsFromParams("?salonMinutes=0")).toBe(600_000);
    expect(sessionMsFromParams("?salonMinutes=abc")).toBe(600_000);
    expect(sessionMsFromParams("?salonMinutes=999")).toBe(600_000);
  });

  it("la ligne à partager suit le modèle `Salon 14:20 — 31,402 s — 3e/17`", () => {
    expect(salonShareLine("14:20", 31_402, 3, 17)).toBe("Salon 14:20 — 31,402 s — 3e/17");
    expect(salonShareLine("14:20", 31_402, 1, 4)).toBe("Salon 14:20 — 31,402 s — 1er/4");
    expect(salonShareLine("14:20", 31_402)).toBe("Salon 14:20 — 31,402 s");
  });
});

describe("fantômes des autres", () => {
  const rows = Array.from({ length: 12 }, (_, i) => row(i + 1, `r${i + 1}`));

  it("trois premiers + devant + derrière (jamais toi), au plus cinq", () => {
    const b = board(rows.map((r) => (r.rank === 7 ? { ...r, mine: true } : r)));
    expect(pickGhostRefs(b).map((r) => r.ref)).toEqual(["r1", "r2", "r3", "r6", "r8"]);
    expect(pickGhostRefs(b).length).toBeLessThanOrEqual(MAX_GHOSTS);
  });

  it("quand tu es sur le podium, ton rang n'est pas compté deux fois", () => {
    const b = board(rows.map((r) => (r.rank === 2 ? { ...r, mine: true } : r)));
    expect(pickGhostRefs(b).map((r) => r.ref)).toEqual(["r1", "r3"]); // 1, 3 + voisins (1 et 3 déjà pris)
  });

  it("sans temps à toi : les cinq premiers", () => {
    expect(pickGhostRefs(board(rows)).map((r) => r.ref)).toEqual(["r1", "r2", "r3", "r4", "r5"]);
    expect(pickGhostRefs(board([]))).toEqual([]);
  });

  it("repère qui t'a dépassé", () => {
    const before = board([row(1, "a"), row(2, "b"), row(3, "me", 31_000, true), row(4, "c")]);
    const after = board([row(1, "a"), row(2, "c", 30_900), row(3, "b"), row(4, "me", 31_000, true)]);
    expect(overtakenBy(before, after)).toBe("P2");
    expect(overtakenBy(after, after)).toBeNull();
    expect(overtakenBy(null, after)).toBeNull();
  });

  it("touche G : tous → premiers seulement → aucun", () => {
    expect(nextSalonGhostMode("all")).toBe("top");
    expect(nextSalonGhostMode("top")).toBe("off");
    expect(nextSalonGhostMode("off")).toBe("all");
    expect(ghostShown("all", 9)).toBe(true);
    expect(ghostShown("all", null)).toBe(true);
    expect(ghostShown("top", 3)).toBe(true);
    expect(ghostShown("top", 4)).toBe(false);
    expect(ghostShown("top", null)).toBe(false);
    expect(ghostShown("off", 1)).toBe(false);
  });
});

describe("joueurs fictifs de la démonstration", () => {
  it("8 à 15 pilotes, déterministes par session, arrivés au fil du temps, dans la durée de la session", () => {
    for (const session of [2_970_000, 2_970_001, 2_970_002, 2_970_003]) {
      const len = 600_000;
      const plan = demoPlan(session, len);
      expect(plan.length).toBeGreaterThanOrEqual(6); // 8 à 15 prévus ; un pilote tardif peut n'avoir aucun envoi avant la fin
      expect(plan.length).toBeLessThanOrEqual(15);
      expect(demoPlan(session, len)).toEqual(plan);
      expect(new Set(plan.map((p) => p.ref)).size).toBe(plan.length);
      for (const p of plan) {
        expect(p.name.startsWith("Démo ")).toBe(true);
        expect(p.attempts.length).toBeGreaterThanOrEqual(1);
        expect(p.attempts.length).toBeLessThanOrEqual(3);
        for (const [k, a] of p.attempts.entries()) {
          expect(a.at).toBeGreaterThan(p.joinAt);
          expect(a.at).toBeLessThan(len);
          if (k > 0) expect(a.skill).toBeGreaterThanOrEqual(p.attempts[k - 1]!.skill - 0.001); // de plus en plus rapides
        }
      }
      const runs = plannedRuns(plan);
      expect(runs.map((r) => r.at)).toEqual([...runs.map((r) => r.at)].sort((a, b) => a - b));
    }
    expect(demoPlan(2_970_000, 600_000)).not.toEqual(demoPlan(2_970_001, 600_000));
  });

  it("une session raccourcie garde la même forme (essais à deux minutes)", () => {
    const plan = demoPlan(2_970_000, 120_000);
    expect(plan.length).toBeGreaterThanOrEqual(1);
    for (const p of plan) for (const a of p.attempts) expect(a.at).toBeLessThan(120_000);
  });
});

describe("Salon de démonstration (DemoSalonApi)", () => {
  const session = 2_970_011;
  const len = 600_000;
  const start = salonSessionStart(session, len);
  const circuit = loadCircuit(computeCircuit(session))!;
  const pilot = bestPilotRun(circuit.track)!;
  const myReplay = encodeReplay(pilot.replay);

  // Moteur factice : les courses des pilotes sont préparées d'avance (aucun calcul lourd ici).
  const fake = (): { engine: SalonEngine; runs: PilotRunData[] } => {
    const plan = demoPlan(session, len);
    const runs: PilotRunData[] = plan.map((p, i) => ({ ref: p.ref, name: p.name, ms: 36_000 + i * 700, splits: [10_000], replay: `x${i}`, at: p.attempts[0]!.at }));
    return {
      runs,
      engine: {
        circuit: async () => circuit,
        pilotRun: async (_s, _l, pi, attempt) => (attempt === 0 ? (runs.find((r) => r.ref === plan.find((p) => p.index === pi)!.ref) ?? null) : null),
      },
    };
  };
  const make = (now: number) => {
    const clock = new SalonClock(() => 0);
    clock.set(now);
    const { engine, runs } = fake();
    return { api: new DemoSalonApi({ clock, sessionMs: len, engine, circuit: async () => circuit }), clock, runs };
  };
  const settle = () => new Promise((r) => setTimeout(r, 20));

  it("`now` donne l'heure, la session, sa fin et le circuit", async () => {
    const { api } = make(start + 123_456);
    const r = await api.now("p1");
    expect(r.ok && r.data).toMatchObject({ serverMs: start + 123_456, session, startMs: start, endMs: start + len, trackId: circuit.id });
  });

  it("les joueurs fictifs arrivent au fil de la session et le classement grossit", async () => {
    const { api, clock, runs } = make(start + 1000);
    await api.now("p1");
    await settle();
    const early = await api.board(session, "p1");
    expect(early.ok && early.data.rows.length).toBe(0);
    clock.set(start + 400_000);
    const mid = await api.board(session, "p1");
    expect(mid.ok).toBe(true);
    if (!mid.ok) return;
    const expected = runs.filter((r) => r.at <= 400_000).length;
    expect(mid.data.rows.length).toBe(expected);
    expect(mid.data.rows.map((r) => r.ms)).toEqual([...mid.data.rows.map((r) => r.ms)].sort((a, b) => a - b));
    expect(mid.data.rows[0]!.gap).toBe(0);
    clock.set(start + len - 1);
    const late = await api.board(session, "p1");
    expect(late.ok && late.data.rows.length).toBeGreaterThanOrEqual(expected);
    // version inchangée : pas de rechargement
    const same = await api.board(session, "p1", late.ok ? late.data.version : 0);
    expect(same.ok && same.data.unchanged).toBe(true);
  });

  it("une course du joueur est rejouée : son temps, son rang, le classement à jour", async () => {
    const { api, clock } = make(start + 300_000);
    await api.now("p1");
    await settle();
    const r = await api.submit(session, "p1", "Moi", myReplay);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.accepted).toBe(true);
    expect(r.data.ms).toBe(pilot.finishMs); // le temps du rejeu
    expect(r.data.board.me?.name).toBe("Moi");
    expect(r.data.board.me?.ref).toBe(myRef(session, "p1"));
    expect(r.data.rank).toBe(r.data.board.me!.rank);
    expect(r.data.improved).toBe(true);
    // le meilleur temps est conservé
    const again = await api.submit(session, "p1", "Moi", myReplay);
    expect(again.ok && again.data.improved).toBe(false);
    // et son fantôme se demande par référence
    const g = await api.ghosts(session, [r.data.board.me!.ref]);
    expect(g.ok && g.data.ghosts[0]).toMatchObject({ name: "Moi", ms: pilot.finishMs, simVersion: SIM_VERSION });
    clock.set(start + len);
  });

  it("refuse une rediffusion falsifiée, d'un autre circuit, et un envoi trop tardif", async () => {
    const { api, clock } = make(start + 300_000);
    const rec = new ReplayRecorder();
    rec.record({ steer: 0, throttle: 64, brake: 0, respawn: 0 });
    const never = await api.submit(session, "p1", "Moi", encodeReplay(rec.toReplay(circuit.id)));
    expect(never.ok).toBe(false); // ne finit pas : aucun temps annoncé ne peut changer ça
    const other = await api.submit(session, "p1", "Moi", encodeReplay(rec.toReplay("salon-1-g1")));
    expect(other.ok).toBe(false);
    const junk = await api.submit(session, "p1", "Moi", "pas-une-rediffusion");
    expect(junk.ok).toBe(false);
    clock.set(start + len + SUBMIT_GRACE_MS - 1);
    expect((await api.submit(session, "p1", "Moi", myReplay)).ok).toBe(true); // commencée avant la fin, finie après
    clock.set(start + len + SUBMIT_GRACE_MS + 1);
    const late = await api.submit(session, "p1", "Moi", myReplay);
    expect(!late.ok && late.code).toBe("session_closed");
  });

  it("pilote fictif réel : sa course est rejouée et son temps vient du rejeu", () => {
    const plan = demoPlan(session, len);
    const p = plan[0]!;
    const run = computePilotRun(session, len, p.index, 0);
    expect(run).not.toBeNull();
    expect(run!.ref).toBe(p.ref);
    expect(run!.ms).toBeGreaterThan(salonCircuit(session).authorMs - 1); // jamais plus vite que l'auteur (pilote bridé)
    expect(run!.at).toBe(p.attempts[0]!.at);
    expect(salonTheme(session)).toBe(circuit.theme);
  }, 60_000);
});

describe("passer du Salon au circuit du jour", () => {
  it("garde les réglages d'affichage et de test, jamais le choix d'un circuit", () => {
    expect(modeHref("?api=demo&seed=2026-10-07&theme=nuit&debug", true)).toBe("?api=demo&debug&mode=salon");
    expect(modeHref("?mode=salon&api=demo&salonMinutes=2&debug&salonAt=5", false)).toBe("?api=demo&salonMinutes=2&debug");
    expect(modeHref("?scenario=pilotage&spec=S", true)).toBe("?mode=salon");
    expect(modeHref("?mode=salon", false)).toBe("?");
  });
});

describe("client de l'API du Salon", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("appelle les quatre routes du contrat, avec l'identifiant en paramètre et les références publiques", async () => {
    const calls: { url: string; method: string; body?: string }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? "GET", body: init?.body as string | undefined });
      return new Response(JSON.stringify({ ok: 1 }), { status: 200 });
    });
    const api = new HttpSalonApi("http://api.test");
    await api.now("abc");
    await api.board(42, "abc", 7);
    await api.board(42, "abc");
    await api.ghosts(42, ["r1", "r2"]);
    await api.submit(42, "abc", "Moi", "CODE");
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "GET http://api.test/api/salon/now?player=abc",
      "GET http://api.test/api/salon/42/board?player=abc&since=7",
      "GET http://api.test/api/salon/42/board?player=abc",
      "GET http://api.test/api/salon/42/ghosts?refs=r1,r2",
      "POST http://api.test/api/salon/42/submit",
    ]);
    expect(JSON.parse(calls[4]!.body!)).toEqual({ playerId: "abc", name: "Moi", replay: "CODE" });
  });

  it("un serveur sans Salon répond 404 : l'erreur est lisible, rien ne plante", async () => {
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: "not_found", message: "Pas de Salon ici" }), { status: 404 }));
    const r = await new HttpSalonApi("http://api.test").now("abc");
    expect(r).toMatchObject({ ok: false, status: 404, code: "not_found" });
  });
});

describe("voitures des fantômes du Salon", () => {
  const meshes = (g: { traverse(f: (o: unknown) => void): void }) => {
    let n = 0;
    g.traverse((o) => {
      if (o instanceof Mesh) n++;
    });
    return n;
  };

  it("le fantôme allégé tient en un seul objet dessiné (la voiture du joueur en compte plus de quarante)", () => {
    const full = createCarMesh();
    const light = createCarMesh(true, GHOST_COLORS[0], true);
    expect(meshes(full.group)).toBeGreaterThan(40);
    expect(meshes(light.group)).toBe(1);
    light.update({ forward: 20, steerAngle: 0.2, braking: true, droop: [0, 0, 0, 0], dt: 1 / 60 }); // sans roues séparées : rien à animer, rien ne plante
  });

  it("chaque fantôme a sa couleur, distincte de celle des autres et de ton propre tour", () => {
    expect(new Set([...GHOST_COLORS, MY_GHOST_COLOR]).size).toBe(GHOST_COLORS.length + 1);
    const look = tintedGhostLook(0xff4fa3);
    expect(look.body).toBe(0xff4fa3);
    expect(look.stripe).not.toBe(look.body);
    expect(look.trim).not.toBe(look.body);
  });
});
