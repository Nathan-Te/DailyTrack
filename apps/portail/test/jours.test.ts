import { describe, expect, it } from "vitest";
import { circuitNumber, parseDay } from "@cdj/sim";
import { levelNumber } from "@cdj/jump-sim";
import { cartes } from "../src/jours";

// Lot R4 : le portail recopie les deux premiers jours (il n'importe aucun jeu) ; ses numéros doivent être ceux des jeux, jour après jour.
describe("portail : numéro du jour de chaque jeu", () => {
  it("le même que DailyTrack (`circuitNumber`) et DailyJump (`levelNumber`), sur deux ans", () => {
    const start = parseDay("2026-10-01")!;
    for (let day = start; day < start + 730; day++) {
      const [track, jump] = cartes(day);
      expect(track!.numero, String(day)).toBe(circuitNumber(day));
      expect(jump!.numero, String(day)).toBe(levelNumber(day));
    }
  });

  it("une cartouche par jeu, avec son lien relatif (lot I1 : les textes viennent des catalogues)", () => {
    const [track, jump] = cartes(parseDay("2026-10-20")!);
    expect(track).toEqual({ code: "track", jeu: "cdj", lien: "track/", numero: 8 });
    expect(jump).toEqual({ code: "jump", jeu: "jump", lien: "jump/", numero: 5 });
    expect(cartes(parseDay("2026-10-01")!)[0]!.numero).toBeLessThanOrEqual(0);
  });
});
