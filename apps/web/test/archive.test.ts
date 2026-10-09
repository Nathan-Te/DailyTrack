import { describe, expect, it } from "vitest";
import { GENERATOR_VERSION as G, PREMIER_JOUR, SIM_VERSION, formatDay } from "@cdj/sim";
import { RANDOM_SPAN, archiveDays, archiveHref, nextTheme, randomSeedHref, themeHref } from "../src/archive";
import { listDayBests, type DayBest } from "../src/records";

describe("archiveDays", () => {
  it("liste les jours d'aujourd'hui au lancement, du plus récent au plus ancien", () => {
    const days = archiveDays(PREMIER_JOUR + 3, new Map());
    expect(days.map((d) => d.date)).toEqual([formatDay(PREMIER_JOUR + 3), formatDay(PREMIER_JOUR + 2), formatDay(PREMIER_JOUR + 1), formatDay(PREMIER_JOUR)]);
    expect(days.map((d) => d.number)).toEqual([4, 3, 2, 1]);
    expect(days.map((d) => d.isToday)).toEqual([true, false, false, false]);
    expect(days.every((d) => d.theme.length > 0)).toBe(true);
  });

  it("le jour du lancement n'a qu'une ligne ; avant le lancement, aucune", () => {
    expect(archiveDays(PREMIER_JOUR, new Map())).toHaveLength(1);
    expect(archiveDays(PREMIER_JOUR - 1, new Map())).toHaveLength(0);
  });

  it("plafonne la liste", () => {
    expect(archiveDays(PREMIER_JOUR + 500, new Map(), 30)).toHaveLength(30);
  });

  it("rattache à chaque jour son meilleur temps local", () => {
    const best: DayBest = { date: formatDay(PREMIER_JOUR + 1), ms: 41000, medal: "gold" };
    const days = archiveDays(PREMIER_JOUR + 2, new Map([[best.date, best]]));
    expect(days.find((d) => d.date === best.date)!.best).toEqual(best);
    expect(days.find((d) => d.isToday)!.best).toBeNull();
  });
});

describe("archiveHref", () => {
  it("met la date dans seed et garde les réglages de test", () => {
    expect(archiveHref("?debug&api=http%3A%2F%2Fx", "2026-10-04", false)).toBe("?debug=&api=http%3A%2F%2Fx&seed=2026-10-04");
    expect(archiveHref("?seed=2026-10-01", "2026-10-04", false)).toBe("?seed=2026-10-04");
  });

  it("aujourd'hui : pas de seed, et l'adresse nue s'il ne reste rien", () => {
    expect(archiveHref("?seed=2026-10-01", "2026-10-06", true)).toBe("./");
    expect(archiveHref("?seed=2026-10-01&debug", "2026-10-06", true)).toBe("?debug=");
  });
});

describe("circuits d'essai", () => {
  it("au hasard : une date valide entre le lancement et la borne, réglages conservés", () => {
    expect(randomSeedHref("?debug", () => 0)).toBe(`?debug=&seed=${formatDay(PREMIER_JOUR)}`);
    expect(randomSeedHref("?theme=nuit&seed=2026-10-07", () => 0.9999)).toBe(`?theme=nuit&seed=${formatDay(PREMIER_JOUR + RANDOM_SPAN - 1)}`);
  });
  it("thème : posé, retiré, adresse nue", () => {
    expect(themeHref("?seed=2026-10-07", "nuit")).toBe("?seed=2026-10-07&theme=nuit");
    expect(themeHref("?seed=2026-10-07&theme=nuit", "rallye")).toBe("?seed=2026-10-07&theme=rallye");
    expect(themeHref("?theme=nuit", null)).toBe("./");
  });
  it("thème suivant : fait le tour puis revient au thème du jour", () => {
    const seen: (string | null)[] = [];
    let t: string | null = null;
    for (let i = 0; i < 9; i++) {
      t = nextTheme(t);
      seen.push(t);
    }
    expect(seen).toEqual(["stade", "rallye", "banquise", "nuit", "campagne", "canyon", "col", "ville", null]);
  });
});

describe("listDayBests", () => {
  const store = (entries: Record<string, string>) => ({
    length: Object.keys(entries).length,
    key: (i: number) => Object.keys(entries)[i] ?? null,
    getItem: (k: string) => entries[k] ?? null,
  });

  it("une entrée illisible, même au milieu, ne masque pas les autres", () => {
    const m = listDayBests(
      store({
        [`cdj:best:jour-2026-10-05-g${G}`]: JSON.stringify({ ms: 50000, splits: [], simVersion: SIM_VERSION }),
        [`cdj:best:jour-2026-10-06-g${G}`]: "pas du json",
        [`cdj:best:jour-2026-10-07-g${G}`]: JSON.stringify({ ms: 39000, splits: [], simVersion: SIM_VERSION }),
      }),
    );
    expect([...m.keys()].sort()).toEqual(["2026-10-05", "2026-10-07"]);
  });

  it("retrouve les records des circuits du jour, et seulement ceux du générateur et de la simulation actuels", () => {
    const m = listDayBests(
      store({
        [`cdj:best:jour-2026-10-06-g${G}`]: JSON.stringify({ ms: 40123, splits: [], medal: "silver", simVersion: SIM_VERSION }),
        [`cdj:best:jour-2026-10-07-g${G}`]: JSON.stringify({ ms: 39000, splits: [], simVersion: SIM_VERSION }),
        [`cdj:best:jour-2026-10-08-g${G}`]: JSON.stringify({ ms: 30000, splits: [], simVersion: SIM_VERSION - 1 }), // ancienne physique
        "cdj:best:jour-2026-10-08-g99": JSON.stringify({ ms: 1, splits: [], simVersion: SIM_VERSION }), // autre générateur : autre circuit
        "cdj:best:essai": JSON.stringify({ ms: 35000, splits: [] }), // circuit d'essai : pas une archive
        "cdj:name": "Alice",
      }),
    );
    expect([...m.keys()].sort()).toEqual(["2026-10-06", "2026-10-07"]);
    expect(m.get("2026-10-06")).toEqual({ date: "2026-10-06", ms: 40123, medal: "silver" });
    expect(m.get("2026-10-07")!.medal).toBeNull();
  });
});
