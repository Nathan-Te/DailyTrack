import { describe, expect, it } from "vitest";
import { dayLong, dayShort, disambiguateNames, listPlayedDays, loadRanks, parseRank, playedFromRecords, profileStats, rememberRank, streakOf } from "../src/profile";
import { dayLines } from "../src/boardView";
import { applyTransfer, collectTransfer, decodeTransfer, encodeTransfer } from "../src/transfer";

function memory(initial: Record<string, string> = {}) {
  const m = new Map(Object.entries(initial));
  return {
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    dump: () => Object.fromEntries(m),
  };
}
const rec = (ms: number, medal: string | null) => JSON.stringify({ ms, splits: [1000], simVersion: 14, medal });

describe("jours joués, médailles, série", () => {
  const store = memory({
    "cdj:best:jour-2026-10-13-g15": rec(41_000, "silver"),
    "cdj:best:jour-2026-10-14-g15": rec(40_000, "gold"),
    "cdj:best:jour-2026-10-14-g14": rec(39_000, "bronze"), // une autre version du générateur, le même jour : la meilleure médaille reste
    "cdj:best:jour-2026-10-16-g15": rec(45_000, null),
    "cdj:best:essai": rec(5_000, "gold"), // un essai : pas un jour
    "cdj:best:jour-2026-10-17-g15": "pas du json",
  });

  it("liste les jours joués, toutes versions confondues, dans l'ordre", () => {
    expect(listPlayedDays(store)).toEqual([
      { date: "2026-10-13", ms: 41_000, medal: "silver" },
      { date: "2026-10-14", ms: 40_000, medal: "gold" },
      { date: "2026-10-16", ms: 45_000, medal: null },
    ]);
  });

  it("série : jusqu'à aujourd'hui, ou jusqu'à hier si aujourd'hui n'est pas joué", () => {
    const days = ["2026-10-12", "2026-10-13", "2026-10-14"];
    expect(streakOf(days, "2026-10-14")).toBe(3);
    expect(streakOf(days, "2026-10-15")).toBe(3); // hier joué : la série tient encore
    expect(streakOf(days, "2026-10-16")).toBe(0); // avant-hier : perdue
    expect(streakOf(["2026-10-12", "2026-10-14"], "2026-10-14")).toBe(1); // un jour manqué coupe
    expect(streakOf(days, "pas une date")).toBe(0);
    expect(streakOf([], "2026-10-14")).toBe(0);
  });

  it("série : traverse les fins de mois et d'année", () => {
    expect(streakOf(["2026-12-31", "2027-01-01", "2027-01-02"], "2027-01-02")).toBe(3);
    expect(streakOf(["2026-02-28", "2026-03-01"], "2026-03-01")).toBe(2);
  });

  it("statistiques : jours, médailles par type, meilleure place", () => {
    const ranks = new Map([["2026-10-13", { rank: 4, participants: 9 }], ["2026-10-14", { rank: 2, participants: 5 }]]);
    const s = profileStats(listPlayedDays(store), ranks, "2026-10-16");
    expect(s.days).toBe(3);
    expect(s.medals).toEqual({ author: 0, gold: 1, silver: 1, bronze: 0 });
    expect(s.bestRank).toEqual({ rank: 2, participants: 5, date: "2026-10-14" });
    expect(s.streak).toBe(1); // le 16 est joué, le 15 non
  });

  it("sans rien : zéro partout", () => {
    expect(profileStats([], new Map(), "2026-10-13")).toEqual({ days: 0, medals: { author: 0, gold: 0, silver: 0, bronze: 0 }, bestRank: null, streak: 0 });
  });

  it("les records d'un code de transfert donnent les mêmes jours", () => {
    expect(playedFromRecords({ "jour-2026-10-13-g15": { ms: 41_000, medal: "silver" }, "essai": { ms: 1, medal: "gold" } })).toEqual([{ date: "2026-10-13", ms: 41_000, medal: "silver" }]);
  });
});

describe("places gardées", () => {
  it("n'accepte que des places plausibles", () => {
    expect(parseRank({ rank: 3, participants: 12 })).toEqual({ rank: 3, participants: 12 });
    expect(parseRank('{"rank":3,"participants":12}')).toEqual({ rank: 3, participants: 12 });
    expect(parseRank({ rank: 0, participants: 12 })).toBeNull();
    expect(parseRank({ rank: 13, participants: 12 })).toBeNull(); // plus de places que de pilotes
    expect(parseRank({ rank: 1.5, participants: 12 })).toBeNull();
    expect(parseRank("n'importe quoi")).toBeNull();
  });
  it("se retient et se relit par jour", () => {
    const store = memory();
    rememberRank("2026-10-13", { rank: 4, participants: 9 }, store);
    rememberRank("pas-une-date", { rank: 1, participants: 1 }, store);
    rememberRank("2026-10-14", { rank: 99, participants: 5 }, store); // invalide
    expect([...loadRanks(store)]).toEqual([["2026-10-13", { rank: 4, participants: 9 }]]);
  });
});

describe("code de transfert : les places voyagent", () => {
  const ID = "0123456789abcdef0123456789abcdef";
  it("copier puis charger ailleurs retrouve pseudo, records et places", () => {
    const a = memory({ "cdj:player": ID, "cdj:name": "Alice", "cdj:best:jour-2026-10-13-g15": rec(41_000, "silver"), "cdj:rank:2026-10-13": JSON.stringify({ rank: 4, participants: 9 }) });
    const code = encodeTransfer(collectTransfer(a)!);
    const decoded = decodeTransfer(code);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const b = memory({ "cdj:rank:2026-09-01": JSON.stringify({ rank: 1, participants: 2 }) }); // une place de l'ancienne identité : effacée
    expect(applyTransfer(decoded.data, b)).toBe(true);
    expect(b.getItem("cdj:name")).toBe("Alice");
    expect(listPlayedDays(b)).toEqual([{ date: "2026-10-13", ms: 41_000, medal: "silver" }]);
    expect([...loadRanks(b)]).toEqual([["2026-10-13", { rank: 4, participants: 9 }]]);
  });
  it("un code sans places (ancien) se charge toujours", () => {
    const a = memory({ "cdj:player": ID, "cdj:best:jour-2026-10-13-g15": rec(41_000, null) });
    const data = collectTransfer(a)!;
    expect(data.ranks).toBeUndefined();
    const decoded = decodeTransfer(encodeTransfer(data));
    expect(decoded.ok && decoded.data.ranks).toBeFalsy();
  });
  it("une place invalide dans un code est ignorée, le reste est gardé", () => {
    const a = memory({ "cdj:player": ID, "cdj:rank:2026-10-13": JSON.stringify({ rank: 4, participants: 9 }) });
    const data = collectTransfer(a)!;
    const bad = encodeTransfer({ ...data, ranks: { "2026-10-13": { rank: 4, participants: 9 }, "2026-10-14": { rank: 0, participants: 1 } } });
    const decoded = decodeTransfer(bad);
    expect(decoded.ok && Object.keys(decoded.data.ranks ?? {})).toEqual(["2026-10-13"]);
  });
});

describe("dates en français", () => {
  it("court et long", () => {
    expect(dayShort("2026-10-13")).toBe("13 oct.");
    expect(dayShort("2026-01-05")).toBe("5 janv.");
    expect(dayLong("2026-10-13")).toBe("13 octobre 2026");
    expect(dayShort("n'importe quoi")).toBe("n'importe quoi");
    expect(dayShort("2026-13-01")).toBe("2026-13-01");
  });
});

describe("pseudos en double", () => {
  it("le premier garde son nom, les suivants prennent un suffixe", () => {
    expect(disambiguateNames(["Nowy", "Alice", "Nowy", "nowy", "Bob"])).toEqual(["Nowy", "Alice", "Nowy·2", "nowy·3", "Bob"]);
    expect(disambiguateNames([])).toEqual([]);
  });
  it("le classement du jour : « toi » marqué, doublons suffixés, ta ligne hors du top après « … »", () => {
    const top = [
      { rank: 1, name: "Nowy", ms: 30_000, medal: "gold" as const },
      { rank: 2, name: "Alice", ms: 31_000, medal: "silver" as const },
      { rank: 3, name: "Nowy", ms: 32_000, medal: null },
    ];
    const me = { rank: 7, name: "Nowy", ms: 40_000, medal: null };
    const lines = dayLines({ top, me });
    expect(lines.map((l) => (l === "gap" ? "…" : `${l.rank}:${l.name}${l.me ? "*" : ""}`))).toEqual(["1:Nowy", "2:Alice", "3:Nowy·2", "…", "7:Nowy·3*"]);
    // ta ligne dans le top : marquée sur place, pas répétée
    const inTop = dayLines({ top, me: top[2]! });
    expect(inTop.map((l) => (l === "gap" ? "…" : `${l.rank}${l.me ? "*" : ""}`))).toEqual(["1", "2", "3*"]);
  });
});
