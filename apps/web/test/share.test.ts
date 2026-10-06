import { describe, expect, it } from "vitest";
import { ordinal, shareLine, shareText, shareUrl } from "../src/share";

describe("ordinal", () => {
  it("écrit les rangs à la française", () => {
    expect([1, 2, 3, 10, 23, 101].map(ordinal)).toEqual(["1er", "2e", "3e", "10e", "23e", "101e"]);
  });
});

describe("shareLine", () => {
  it("reproduit la ligne du seed", () => {
    expect(shareLine({ number: 142, date: "2027-02-24", ms: 47312, medal: "gold", rank: 23, participants: 812 })).toBe("Circuit du Jour #142 — 47,312 s — 🥇 — 23e/812");
  });

  it("omet ce qu'on ne sait pas : pas de médaille, pas de classement", () => {
    expect(shareLine({ number: 3, date: "2026-10-08", ms: 61000, medal: null })).toBe("Circuit du Jour #3 — 1:01,000");
    expect(shareLine({ number: 3, date: "2026-10-08", ms: 39188, medal: "author", rank: 1, participants: 1 })).toBe("Circuit du Jour #3 — 39,188 s — 🏆 — 1er/1");
    expect(shareLine({ number: 3, date: "2026-10-08", ms: 39188, medal: "bronze", rank: null, participants: null })).toBe("Circuit du Jour #3 — 39,188 s — 🥉");
  });

  it("utilise la date pour un circuit d'avant le lancement", () => {
    expect(shareLine({ number: 0, date: "2026-10-05", ms: 40000, medal: null })).toBe("Circuit du Jour 2026-10-05 — 40,000 s");
    expect(shareLine({ number: -4, date: "2026-10-01", ms: 40000, medal: null })).toContain("2026-10-01");
  });

  it("garde le rang 0 ou sans participants hors de la ligne", () => {
    expect(shareLine({ number: 1, date: "d", ms: 40000, medal: null, rank: 0, participants: 5 })).toBe("Circuit du Jour #1 — 40,000 s");
    expect(shareLine({ number: 1, date: "d", ms: 40000, medal: null, rank: 2, participants: 0 })).toBe("Circuit du Jour #1 — 40,000 s");
  });
});

describe("shareText / shareUrl", () => {
  const loc = { origin: "https://nathan-te.github.io", pathname: "/DailyTrack/" };

  it("ajoute l'adresse sur une seconde ligne", () => {
    expect(shareText({ number: 1, date: "2026-10-06", ms: 40000, medal: null }, "https://x.test/")).toBe("Circuit du Jour #1 — 40,000 s\nhttps://x.test/");
  });

  it("l'adresse du jour n'a pas de réglages ; celle d'une archive porte la date", () => {
    expect(shareUrl(loc, "2026-10-06", true)).toBe("https://nathan-te.github.io/DailyTrack/");
    expect(shareUrl(loc, "2026-10-04", false)).toBe("https://nathan-te.github.io/DailyTrack/?seed=2026-10-04");
  });
});
