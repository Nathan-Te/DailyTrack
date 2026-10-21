import { beforeAll, describe, expect, it } from "vitest";
import { MEDAL_ICON, shareLine, shareText, shareUrl } from "../src/share";
import { chargerLangue, setLangue } from "../src/i18n";

// L'anglais est un fichier à part, chargé à la demande (i18n.ts) : on le charge avant les tests qui passent en anglais.
beforeAll(() => chargerLangue("en"));

// Lot I4 : la ligne à partager suit la langue (mêmes émojis) ; le temps et le rang viennent des formats du socle (`31,402 s` avec espace insécable, `14e` / `14th`).
const NBSP = "\u00a0";

describe("shareLine (français)", () => {
  beforeAll(() => setLangue("fr", { ecrire: false }));

  it("reproduit la ligne du seed", () => {
    expect(shareLine({ number: 142, date: "2027-02-24", ms: 47312, medal: "gold", rank: 23, participants: 812 })).toBe(`Du Jour · Track #142 — 47,312${NBSP}s — 🥇 — 23e/812`);
  });

  it("omet ce qu'on ne sait pas : pas de médaille, pas de classement", () => {
    expect(shareLine({ number: 3, date: "2026-10-08", ms: 61000, medal: null })).toBe("Du Jour · Track #3 — 1:01,000");
    expect(shareLine({ number: 3, date: "2026-10-08", ms: 39188, medal: "author", rank: 1, participants: 1 })).toBe(`Du Jour · Track #3 — 39,188${NBSP}s — 🏆 — 1er/1`);
    expect(shareLine({ number: 3, date: "2026-10-08", ms: 39188, medal: "bronze", rank: null, participants: null })).toBe(`Du Jour · Track #3 — 39,188${NBSP}s — 🥉`);
  });

  it("utilise la date pour un circuit d'avant le lancement", () => {
    expect(shareLine({ number: 0, date: "2026-10-05", ms: 40000, medal: null })).toBe(`Du Jour · Track 2026-10-05 — 40,000${NBSP}s`);
    expect(shareLine({ number: -4, date: "2026-10-01", ms: 40000, medal: null })).toContain("2026-10-01");
  });

  it("garde le rang 0 ou sans participants hors de la ligne", () => {
    expect(shareLine({ number: 1, date: "d", ms: 40000, medal: null, rank: 0, participants: 5 })).toBe(`Du Jour · Track #1 — 40,000${NBSP}s`);
    expect(shareLine({ number: 1, date: "d", ms: 40000, medal: null, rank: 2, participants: 0 })).toBe(`Du Jour · Track #1 — 40,000${NBSP}s`);
  });
});

describe("shareLine (anglais)", () => {
  beforeAll(() => setLangue("en", { ecrire: false }));

  it("la même ligne en anglais, mêmes émojis, rang et temps à l'anglaise", () => {
    expect(shareLine({ number: 142, date: "2027-02-24", ms: 47312, medal: "gold", rank: 23, participants: 812 })).toBe(`Du Jour · Track #142 — 47.312${NBSP}s — 🥇 — 23rd/812`);
    expect(shareLine({ number: 3, date: "2026-10-08", ms: 61000, medal: null })).toBe("Du Jour · Track #3 — 1:01.000");
    expect(shareLine({ number: 3, date: "2026-10-08", ms: 39188, medal: "author", rank: 1, participants: 1 })).toBe(`Du Jour · Track #3 — 39.188${NBSP}s — 🏆 — 1st/1`);
    expect(shareLine({ number: 0, date: "2026-10-05", ms: 40000, medal: null })).toBe(`Du Jour · Track 2026-10-05 — 40.000${NBSP}s`);
  });

  it("les émojis des médailles sont les mêmes dans les deux langues", () => {
    expect(MEDAL_ICON).toEqual({ author: "🏆", gold: "🥇", silver: "🥈", bronze: "🥉" });
  });
});

describe("shareText / shareUrl", () => {
  beforeAll(() => setLangue("fr", { ecrire: false }));
  const loc = { origin: "https://nathan-te.github.io", pathname: "/DailyTrack/" };

  it("ajoute l'adresse sur une seconde ligne", () => {
    expect(shareText({ number: 1, date: "2026-10-06", ms: 40000, medal: null }, "https://x.test/")).toBe(`Du Jour · Track #1 — 40,000${NBSP}s\nhttps://x.test/`);
  });

  it("l'adresse du jour n'a pas de réglages ; celle d'une archive porte la date", () => {
    expect(shareUrl(loc, "2026-10-06", true)).toBe("https://nathan-te.github.io/DailyTrack/");
    expect(shareUrl(loc, "2026-10-04", false)).toBe("https://nathan-te.github.io/DailyTrack/?seed=2026-10-04");
    // Lot R4 : le lien est construit sur l'origine courante (playdujour.com/track/, la recette, un aperçu…).
    expect(shareUrl({ origin: "https://playdujour.com", pathname: "/track/" }, "2026-10-04", false)).toBe("https://playdujour.com/track/?seed=2026-10-04");
  });
});
