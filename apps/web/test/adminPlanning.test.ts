import { afterEach, describe, expect, it } from "vitest";
import { PREMIER_JOUR, dailyCircuit, createCuvesTrack, createLargeursTrack, createReliefTrack, createSurfacesTrack, formatDay, parseDay, themeForDay, THEME_NAMES } from "@cdj/sim";
import { CANDIDATES, candidateVariants, hasMoreCandidates, histogram, imposedTheme, planningDays, relativeLabel, replaceProblem } from "../src/adminPlan";
import { circuitStats, cuvesText, effectsText, figuresText, reliefText, widthsText } from "../src/circuitStats";
import { DemoAdmin, TOKEN_KEY, loadToken, parseOverview, saveToken } from "../src/adminBackend";
import { DEMO_PLAN_KEY, NO_PLAN, isReplaced, loadDemoPlan, parseDemoPlan, parsePlanEntry, saveDemoPlan } from "../src/planning";
import { DEFAULT_ADMIN, buildQuery, parseAdmin } from "../src/adminLogic";
import { planHref } from "../src/adminPlanning";

const memory = () => {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};

describe("dates du planning", () => {
  it("les 14 prochains jours, de demain à J+14", () => {
    const days = planningDays(100);
    expect(days).toHaveLength(14);
    expect(days[0]).toBe(101);
    expect(days[13]).toBe(114);
    expect(relativeLabel(101, 100)).toBe("demain");
    expect(relativeLabel(102, 100)).toBe("J+2");
  });
  it("variantes proposées : 1 à 5, puis 6 à 10 ; celle en vigueur est sautée", () => {
    expect(candidateVariants(0, 0)).toEqual([1, 2, 3, 4, 5]);
    expect(candidateVariants(1, 0)).toEqual([6, 7, 8, 9, 10]);
    expect(candidateVariants(0, 3)).toEqual([1, 2, 4, 5, 6]);
    expect(candidateVariants(0, 0)).toHaveLength(CANDIDATES);
    expect(hasMoreCandidates(0)).toBe(true);
    expect(hasMoreCandidates(30)).toBe(false);
    for (const p of [0, 5, 19, 40]) for (const n of candidateVariants(p, 0)) expect(n).toBeLessThanOrEqual(99);
  });
  it("le thème de la date n'est pas « imposé »", () => {
    const day = parseDay("2026-10-14")!;
    const natural = themeForDay(day).name;
    expect(imposedTheme(day, natural)).toBeNull();
    expect(imposedTheme(day, null)).toBeNull();
    const other = THEME_NAMES.find((t) => t !== natural)!;
    expect(imposedTheme(day, other)).toBe(other);
  });
  it("règle de remplacement : jamais aujourd'hui ni le passé", () => {
    const today = PREMIER_JOUR + 20;
    expect(replaceProblem(today, today, { variant: 1, theme: null })).toMatch(/commencé/);
    expect(replaceProblem(today, today - 3, { variant: 1, theme: null })).toMatch(/commencé/);
    expect(replaceProblem(today, today + 1, { variant: 1, theme: null })).toBeNull();
    expect(replaceProblem(today, today + 100, { variant: 1, theme: null })).toMatch(/jours à l'avance/);
    expect(replaceProblem(today, today + 1, { variant: 500, theme: null })).toMatch(/Variante/);
  });
});

describe("histogramme des temps", () => {
  it("compte chaque temps dans une case, du plus rapide au plus lent", () => {
    const times = [30_000, 30_500, 31_000, 33_000, 40_000];
    const h = histogram(times, 5);
    expect(h.counts).toHaveLength(5);
    expect(h.counts.reduce((a, b) => a + b, 0)).toBe(times.length);
    expect(h.counts[0]).toBe(3);
    expect(h.counts[4]).toBe(1);
    expect(h.edges).toHaveLength(6);
    expect(h.edges[0]).toBe(30_000);
    expect(h.edges[5]).toBe(40_000);
  });
  it("cas limites : aucun temps, un seul temps, temps égaux", () => {
    expect(histogram([]).counts).toEqual([]);
    expect(histogram([31_000]).counts).toEqual([1]);
    expect(histogram([31_000, 31_000, 31_000]).counts).toEqual([3]);
  });
});

describe("chiffres d'un circuit", () => {
  it("le circuit des surfaces : revêtements, effets, virages", () => {
    const s = circuitStats(createSurfacesTrack());
    expect(s.surfaces).toEqual(expect.arrayContaining(["road", "dirt", "ice", "grass"]));
    expect(s.pads).toBeGreaterThan(0);
    expect(s.turbos).toBeGreaterThan(0);
    expect(s.cuts).toBeGreaterThan(0);
    expect(s.banked).toBeGreaterThan(0);
    expect(effectsText(s)).toMatch(/plaque.*super turbo.*moteur/);
  });
  it("le circuit des largeurs : les trois largeurs", () => {
    const s = circuitStats(createLargeursTrack());
    expect(s.widths).toEqual([14, 20, 26]);
    expect(widthsText(s.widths)).toBe("14 · 20 · 26 m");
    expect(effectsText({ pads: 0, turbos: 0, cuts: 0 })).toBe("aucun");
  });
  it("le circuit du relief (lot 17) : dénivelé, sauts, blocs sans rebords", () => {
    const s = circuitStats(createReliefTrack());
    expect(s.relief).toBe(24);
    expect(s.jumps).toBe(2);
    expect(s.open).toBe(4);
    expect(reliefText(s)).toBe("24 m de dénivelé · 2 sauts · 4 blocs sans rebords");
    expect(reliefText({ relief: 12, jumps: 0, open: 0 })).toBe("12 m de dénivelé");
  });
});

describe("chiffres d'un circuit : cuves (lot 18)", () => {
  it("le scénario des cuves : cuve droite, mur latéral, virages en cuve", () => {
    const s = circuitStats(createCuvesTrack());
    expect([s.cuves, s.walls, s.cuveTurns]).toEqual([4, 4, 2]);
    expect(cuvesText(s)).toBe("4 blocs de cuve droite · 4 blocs de mur latéral · 2 virages en cuve");
    expect(cuvesText({ cuves: 0, walls: 0, cuveTurns: 1 })).toBe("1 virage en cuve");
    expect(cuvesText({ cuves: 0, walls: 0, cuveTurns: 0 })).toBe("aucune");
  });
});

describe("planning : lecture prudente", () => {
  it("une entrée valide ou rien", () => {
    expect(parsePlanEntry({ variant: 2, theme: "nuit" })).toEqual({ variant: 2, theme: "nuit" });
    expect(parsePlanEntry({ variant: 0, theme: null })).toEqual(NO_PLAN);
    expect(parsePlanEntry({ variant: 0 })).toEqual(NO_PLAN);
    for (const bad of [null, "x", { variant: -1 }, { variant: 1.2 }, { variant: 1, theme: "lave" }, { variant: 1, theme: 5 }, { theme: "nuit" }]) expect(parsePlanEntry(bad)).toBeNull();
    expect(isReplaced({ variant: 0, theme: null })).toBe(false);
    expect(isReplaced({ variant: 0, theme: "nuit" })).toBe(true);
  });
  it("planning de démonstration : aller-retour, entrées invalides ignorées", () => {
    const store = memory();
    const plan = new Map([["2026-10-08", { variant: 2, theme: null }], ["2026-10-09", { variant: 1, theme: "banquise" as const }]]);
    saveDemoPlan(plan, store);
    expect(store.m.has(DEMO_PLAN_KEY)).toBe(true);
    expect(loadDemoPlan(store)).toEqual(plan);
    saveDemoPlan(new Map(), store);
    expect(store.m.has(DEMO_PLAN_KEY)).toBe(false);
    const dirty = parseDemoPlan(JSON.stringify({ "2026-10-08": { variant: 1 }, demain: { variant: 1 }, "2026-10-09": { variant: 999 }, "2026-10-10": { variant: 0 } }));
    expect([...dirty.keys()]).toEqual(["2026-10-08"]);
    expect(parseDemoPlan("pas du json").size).toBe(0);
    expect(parseDemoPlan(null).size).toBe(0);
  });
});

describe("vue d'ensemble du serveur", () => {
  it("lue prudemment", () => {
    expect(parseOverview({})).toBeNull();
    const o = parseOverview({
      today: "2026-10-13",
      plan: [{ date: "2026-10-14", variant: 2, theme: null, chosenAt: 5 }, { date: "x", variant: -3 }],
      days: [{ date: "2026-10-13", number: 22, participants: 3, bestMs: 31_000, authorMs: 33_000, trackId: "jour-2026-10-13-g5", variant: 0, theme: null }],
      times: [31_000, "x", 32_000],
    })!;
    expect(o.plan).toEqual([{ date: "2026-10-14", variant: 2, theme: null, chosenAt: 5 }]);
    expect(o.days[0]).toMatchObject({ participants: 3, bestMs: 31_000 });
    expect(o.times).toEqual([31_000, 32_000]);
  });
  it("jeton d'admin gardé à part des données du jeu", () => {
    const store = memory();
    saveToken("secret-secret-secret", store);
    expect(loadToken(store)).toBe("secret-secret-secret");
    saveToken("", store);
    expect(loadToken(store)).toBe("");
    expect(TOKEN_KEY.startsWith("cdj:admin")).toBe(true);
  });
});

describe("administration en démonstration (sans serveur)", () => {
  const store = memory();
  const g = globalThis as unknown as { localStorage?: unknown };
  const saved = g.localStorage;
  g.localStorage = store;
  afterEach(() => store.m.clear());

  const today = PREMIER_JOUR + 14;
  const admin = new DemoAdmin(today);

  it("remplace un jour futur, le garde dans ce navigateur, puis revient à l'original", async () => {
    const date = formatDay(today + 2);
    expect((await admin.replace(date, { variant: 3, theme: null })).ok).toBe(true);
    expect(loadDemoPlan(store).get(date)).toEqual({ variant: 3, theme: null });
    const o = await admin.overview();
    expect(o.ok && o.data.plan).toEqual([{ date, variant: 3, theme: null, chosenAt: null }]);
    expect((await admin.revert(date)).ok).toBe(true);
    expect(loadDemoPlan(store).size).toBe(0);
  });
  it("refuse aujourd'hui, le passé et les variantes invalides", async () => {
    for (const day of [today, today - 1, PREMIER_JOUR]) {
      const r = await admin.replace(formatDay(day), { variant: 1, theme: null });
      expect(r.ok).toBe(false);
    }
    expect((await admin.replace(formatDay(today + 1), { variant: 1000, theme: null })).ok).toBe(false);
    expect((await admin.replace("demain", { variant: 1, theme: null })).ok).toBe(false);
    expect(loadDemoPlan(store).size).toBe(0);
  });
  it("lien vers le jeu pour essayer une variante", () => {
    expect(planHref("2026-10-08", { variant: 2, theme: null })).toBe("../?seed=2026-10-08&variant=2");
    expect(planHref("2026-10-08", { variant: 1, theme: "nuit" }, true)).toBe("../?seed=2026-10-08&variant=1&theme=nuit&demo");
  });
  it("(fin)", () => {
    g.localStorage = saved;
  });
});

describe("outils : option variante", () => {
  it("devient ?variant=N, seulement pour le circuit du jour", () => {
    expect(buildQuery({ ...DEFAULT_ADMIN, date: "2026-10-20", variant: "3" })).toBe("seed=2026-10-20&variant=3");
    expect(buildQuery({ ...DEFAULT_ADMIN, scenario: "surfaces", variant: "3" })).toBe("scenario=surfaces");
    expect(parseAdmin('{"variant":"12"}').variant).toBe("12");
    expect(parseAdmin('{"variant":"abc"}').variant).toBe("");
  });
});

describe("carte d'un jour : les figures du circuit (lot 20)", () => {
  it("figuresText liste les figures dans l'ordre, avec leur catégorie ; un nom inconnu reste tel quel", () => {
    expect(figuresText(["pincement", "saut-releve"])).toBe("Rétrécissement et virage (technique) · Saut vers un virage relevé (saut)");
    expect(figuresText(["inconnue"])).toBe("inconnue");
    expect(figuresText([])).toBe("");
  });
  it("le circuit du jour donne ses figures, que la carte peut afficher", () => {
    const c = dailyCircuit(PREMIER_JOUR + 20);
    expect(c.figures.length).toBeGreaterThanOrEqual(5);
    expect(figuresText(c.figures.map((f) => f.name)).split(" · ")).toHaveLength(c.figures.length);
  }, 20_000);
});
