import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GENERATOR_VERSION, PREMIER_JOUR, SIM_VERSION, dailyCircuit, decodeReplay, formatDay, medalFor, medalsFor, parseDay, replayRace } from "@cdj/sim";
import { DEMO_DAYS, DEMO_TODAY, DemoApi, demoProblem, rankAmong, withMe, type DemoDayData, type DemoIndex } from "../src/demo";
import { ordinal } from "../src/archive";

// Le jeu de données du mode `?api=demo` (apps/web/public/demo/) est fabriqué par `npm run history:seed`. Ces tests le
// vérifient tel qu'il est dans le dépôt : si une version change, ils disent de le régénérer.
const DIR = join(import.meta.dirname, "..", "public", "demo");
const index = JSON.parse(readFileSync(join(DIR, "index.json"), "utf8")) as DemoIndex;
const dayData = (date: string) => JSON.parse(readFileSync(join(DIR, `${date}.json`), "utf8")) as DemoDayData;

describe("jeu de données de démonstration", () => {
  it("correspond aux versions actuelles de la simulation et du générateur (sinon : relancer history:seed)", () => {
    expect(demoProblem(index), "jeu de données périmé : relancer npm run history:seed").toBeNull();
    expect(index.simVersion).toBe(SIM_VERSION);
    expect(index.generatorVersion).toBe(GENERATOR_VERSION);
  });

  it("le message de péremption dit quoi faire", () => {
    const stale = demoProblem({ ...index, simVersion: SIM_VERSION - 1 });
    expect(stale).toContain("history:seed");
    expect(demoProblem({ ...index, generatorVersion: GENERATOR_VERSION + 1 })).toContain("history:seed");
  });

  it("couvre quatorze jours consécutifs depuis le premier jour, et « aujourd'hui » vaut le lendemain", () => {
    expect(index.days).toHaveLength(DEMO_DAYS);
    expect(index.days.map((d) => d.date)).toEqual(Array.from({ length: DEMO_DAYS }, (_, i) => formatDay(PREMIER_JOUR + i)));
    expect(index.days.map((d) => d.number)).toEqual(Array.from({ length: DEMO_DAYS }, (_, i) => i + 1));
    expect(index.premierJour).toBe(formatDay(PREMIER_JOUR));
    expect(parseDay(index.demoToday)).toBe(DEMO_TODAY);
    expect(readdirSync(DIR).filter((f) => f !== "index.json")).toHaveLength(DEMO_DAYS);
  });

  it("chaque jour : 8 à 15 pilotes manifestement fictifs, classés du plus rapide au plus lent", () => {
    for (const d of index.days) {
      const day = dayData(d.date);
      expect(day.participants).toBe(day.top.length);
      expect(day.top.length).toBeGreaterThanOrEqual(8);
      expect(day.top.length).toBeLessThanOrEqual(15);
      expect(day.top.every((r) => r.name.startsWith("Démo "))).toBe(true);
      expect(new Set(day.top.map((r) => r.name)).size).toBe(day.top.length);
      day.top.forEach((r, i) => {
        expect(r.rank).toBe(i + 1);
        if (i > 0) expect(r.ms).toBeGreaterThanOrEqual(day.top[i - 1]!.ms);
      });
      expect(d.participants).toBe(day.top.length);
      expect(d.firstMs).toBe(day.top[0]!.ms);
    }
  });

  it("les temps s'étalent autour des médailles (de quoi voir or, argent et bronze)", () => {
    const seen = new Set<string | null>();
    for (const d of index.days) {
      const medals = medalsFor(d.authorMs);
      for (const r of dayData(d.date).top) {
        expect(r.medal).toBe(medalFor(r.ms, medals));
        seen.add(r.medal);
      }
    }
    for (const m of ["gold", "silver", "bronze"] as const) expect(seen.has(m), `aucune médaille ${m} dans les données`).toBe(true);
  });

  it("le fantôme de chaque premier se rejoue exactement : même temps que le classement (rien n'est cru sur parole)", () => {
    for (const d of index.days) {
      const day = dayData(d.date);
      const ghost = day.ghost!;
      expect(ghost.simVersion).toBe(SIM_VERSION);
      expect(ghost.ms).toBe(day.top[0]!.ms);
      const circuit = dailyCircuit(parseDay(d.date)!);
      expect(circuit.authorMs).toBe(d.authorMs);
      const result = replayRace(circuit.track, decodeReplay(ghost.replay));
      expect(result.finished).toBe(true);
      expect(result.finishMs, `${d.date} : le rejeu ne redonne pas le temps annoncé`).toBe(ghost.ms);
    }
  }, 60_000);

  it("reste léger : moins de 300 ko en tout (chargé jour par jour, seulement quand on ouvre une archive)", () => {
    const total = readdirSync(DIR).reduce((n, f) => n + readFileSync(join(DIR, f)).length, 0);
    expect(total).toBeLessThan(300_000);
  });
});

describe("classement figé avec toi dedans", () => {
  const day: DemoDayData = {
    date: "2026-09-30",
    participants: 3,
    top: [
      { rank: 1, name: "Démo A", ms: 40_000, medal: "gold" },
      { rank: 2, name: "Démo B", ms: 42_000, medal: "silver" },
      { rank: 3, name: "Démo C", ms: 45_000, medal: null },
    ],
    ghost: null,
  };
  it("sans temps : le classement tel quel", () => {
    expect(withMe(day, 10, null)).toEqual({ date: day.date, participants: 3, top: day.top, me: null });
  });
  it("avec un temps : placé parmi les pilotes, les rangs sont recalculés", () => {
    const lb = withMe(day, 10, { ms: 41_000, name: "Toi", medal: "silver" });
    expect(lb.participants).toBe(4);
    expect(lb.top.map((r) => [r.rank, r.name])).toEqual([[1, "Démo A"], [2, "Toi"], [3, "Démo B"], [4, "Démo C"]]);
    expect(lb.me).toMatchObject({ rank: 2, name: "Toi" });
  });
  it("à égalité, il passe derrière ; hors du top, il est donné à part", () => {
    expect(withMe(day, 10, { ms: 40_000, name: "Toi", medal: "gold" }).me!.rank).toBe(2);
    const lb = withMe(day, 2, { ms: 50_000, name: "Toi", medal: null });
    expect(lb.top).toHaveLength(2);
    expect(lb.me!.rank).toBe(4);
  });
  it("rankAmong : place qu'aurait un temps parmi les pilotes, sur n + 1", () => {
    expect(rankAmong(day, 39_000)).toEqual({ rank: 1, participants: 4 });
    expect(rankAmong(day, 43_000)).toEqual({ rank: 3, participants: 4 });
    expect(ordinal(1)).toBe("1ᵉʳ");
    expect(ordinal(4)).toBe("4ᵉ");
  });
});

describe("DemoApi (lecture seule)", () => {
  afterEach(() => vi.unstubAllGlobals());
  const stub = (files: Record<string, unknown>) =>
    vi.stubGlobal("fetch", async (url: string) => {
      const name = String(url).split("/demo/")[1]!;
      return name in files ? new Response(JSON.stringify(files[name]), { status: 200 }) : new Response("", { status: 404 });
    });
  const real = (name: string) => JSON.parse(readFileSync(join(DIR, name), "utf8"));

  it("sert le classement et le fantôme du premier, rien d'autre", async () => {
    stub({ "index.json": index, "2026-09-30.json": real("2026-09-30.json") });
    const api = new DemoApi();
    const lb = await api.leaderboard("2026-09-30", "p".repeat(32), 5);
    expect(lb.ok && lb.data.top).toHaveLength(5);
    const first = await api.ghost("2026-09-30", "first", "p");
    expect(first.ok && first.data.rank).toBe(1);
    const ahead = await api.ghost("2026-09-30", "ahead", "p");
    expect(ahead.ok).toBe(false);
    const sent = await api.submit();
    expect(sent.ok).toBe(false); // jamais d'envoi : le mode démo ne peut rien polluer
    expect(!sent.ok && sent.code).toBe("demo");
  });

  it("un jour sans données donne un classement vide ; un jeu de données périmé donne un message clair", async () => {
    stub({ "index.json": index });
    const empty = await new DemoApi().leaderboard(index.demoToday, "p");
    expect(empty).toEqual({ ok: true, data: { date: index.demoToday, participants: 0, top: [], me: null } });
    stub({ "index.json": { ...index, simVersion: SIM_VERSION - 1 } });
    const stale = await new DemoApi().leaderboard("2026-09-30", "p");
    expect(!stale.ok && stale.message).toContain("history:seed");
  });

  it("place ton meilleur temps local parmi les pilotes", async () => {
    stub({ "index.json": index, "2026-09-30.json": real("2026-09-30.json") });
    const api = new DemoApi(() => ({ ms: 1, medal: "author" }));
    const lb = await api.leaderboard("2026-09-30", "p");
    expect(lb.ok && lb.data.me!.rank).toBe(1);
  });
});
