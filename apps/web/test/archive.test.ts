import { describe, expect, it } from "vitest";
import { LAUNCH_DAY, formatDay } from "@cdj/sim";
import { archiveDays, archiveHref } from "../src/archive";
import { listDayBests, type DayBest } from "../src/records";

describe("archiveDays", () => {
  it("liste les jours d'aujourd'hui au lancement, du plus récent au plus ancien", () => {
    const days = archiveDays(LAUNCH_DAY + 3, new Map());
    expect(days.map((d) => d.date)).toEqual([formatDay(LAUNCH_DAY + 3), formatDay(LAUNCH_DAY + 2), formatDay(LAUNCH_DAY + 1), formatDay(LAUNCH_DAY)]);
    expect(days.map((d) => d.number)).toEqual([4, 3, 2, 1]);
    expect(days.map((d) => d.isToday)).toEqual([true, false, false, false]);
    expect(days.every((d) => d.theme.length > 0)).toBe(true);
  });

  it("le jour du lancement n'a qu'une ligne ; avant le lancement, aucune", () => {
    expect(archiveDays(LAUNCH_DAY, new Map())).toHaveLength(1);
    expect(archiveDays(LAUNCH_DAY - 1, new Map())).toHaveLength(0);
  });

  it("plafonne la liste", () => {
    expect(archiveDays(LAUNCH_DAY + 500, new Map(), 30)).toHaveLength(30);
  });

  it("rattache à chaque jour son meilleur temps local", () => {
    const best: DayBest = { date: formatDay(LAUNCH_DAY + 1), ms: 41000, medal: "gold" };
    const days = archiveDays(LAUNCH_DAY + 2, new Map([[best.date, best]]));
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

describe("listDayBests", () => {
  const store = (entries: Record<string, string>) => ({
    length: Object.keys(entries).length,
    key: (i: number) => Object.keys(entries)[i] ?? null,
    getItem: (k: string) => entries[k] ?? null,
  });

  it("une entrée illisible, même au milieu, ne masque pas les autres", () => {
    const m = listDayBests(
      store({
        "cdj:best:jour-2026-10-05-g1": JSON.stringify({ ms: 50000, splits: [] }),
        "cdj:best:jour-2026-10-06-g1": "pas du json",
        "cdj:best:jour-2026-10-07-g1": JSON.stringify({ ms: 39000, splits: [] }),
      }),
    );
    expect([...m.keys()].sort()).toEqual(["2026-10-05", "2026-10-07"]);
  });

  it("retrouve les records des circuits du jour, et seulement ceux du générateur actuel", () => {
    const m = listDayBests(
      store({
        "cdj:best:jour-2026-10-06-g1": JSON.stringify({ ms: 40123, splits: [], medal: "silver" }),
        "cdj:best:jour-2026-10-07-g1": JSON.stringify({ ms: 39000, splits: [] }),
        "cdj:best:jour-2026-10-08-g99": JSON.stringify({ ms: 1, splits: [] }), // autre générateur : autre circuit
        "cdj:best:essai": JSON.stringify({ ms: 35000, splits: [] }), // circuit d'essai : pas une archive
        "cdj:name": "Alice",
      }),
    );
    expect([...m.keys()].sort()).toEqual(["2026-10-06", "2026-10-07"]);
    expect(m.get("2026-10-06")).toEqual({ date: "2026-10-06", ms: 40123, medal: "silver" });
    expect(m.get("2026-10-07")!.medal).toBeNull();
  });
});
