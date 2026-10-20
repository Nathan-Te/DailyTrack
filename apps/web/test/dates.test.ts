import { beforeAll, describe, expect, it } from "vitest";
import { boardTitle } from "../src/boardView";
import { dayLong, dayShort } from "../src/dates";
import { chargerLangue, setLangue } from "../src/i18n";

// L'anglais est un fichier à part, chargé à la demande (i18n.ts) : on le charge avant les tests qui passent en anglais.
beforeAll(() => chargerLangue("en"));

// Lot I4 : les dates et les titres de classement sont écrits dans la langue du jeu, avec les formats du socle (plus de mois écrits à la main).
beforeAll(() => setLangue("fr", { ecrire: false }));

describe("dates dans la langue du jeu", () => {
  it("français : court et long", () => {
    setLangue("fr", { ecrire: false });
    expect(dayShort("2026-10-13")).toBe("mar. 13 oct.");
    expect(dayShort("2026-01-05")).toBe("lun. 5 janv.");
    expect(dayLong("2026-10-13")).toBe("mardi 13 octobre");
    expect(dayShort("n'importe quoi")).toBe("n'importe quoi");
    expect(dayShort("2026-13-01")).toBe("2026-13-01");
  });
  it("anglais : court et long", () => {
    setLangue("en", { ecrire: false });
    expect(dayShort("2026-10-13")).toBe("Tue, Oct 13");
    expect(dayLong("2026-10-13")).toBe("Tuesday, October 13");
    setLangue("fr", { ecrire: false });
  });
});

describe("titre d'un classement", () => {
  it("du jour ou figé, avec le nombre de pilotes (pluriel de la langue)", () => {
    setLangue("fr", { ecrire: false });
    expect(boardTitle({ date: "2026-10-13", participants: 1 }, true)).toBe("Classement du jour · 1 pilote");
    expect(boardTitle({ date: "2026-10-13", participants: 212 }, true)).toBe("Classement du jour · 212 pilotes");
    expect(boardTitle({ date: "2026-10-13", participants: 5 }, false)).toBe("Classement figé · mar. 13 oct. · 5 pilotes");
    expect(boardTitle({ date: "2026-10-13", participants: 0 }, true)).toBe("Classement du jour : personne");
    setLangue("en", { ecrire: false });
    expect(boardTitle({ date: "2026-10-13", participants: 1 }, true)).toBe("Today's leaderboard · 1 driver");
    expect(boardTitle({ date: "2026-10-13", participants: 1284 }, false)).toBe("Frozen leaderboard · Tue, Oct 13 · 1,284 drivers");
    setLangue("fr", { ecrire: false });
  });
});
