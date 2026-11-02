import { readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { deplier } from "../src/frozen";
import { enPlages } from "../src/plagesJours";

// Les dates des niveaux figés sont écrites dans le premier chargement en plages de jours consécutifs (`vite.config.ts`) et dépliées par le jeu (`frozen.ts`) :
// l'aller-retour doit rendre exactement la liste, trous, changements de mois et d'année compris.
describe("dates figées en plages", () => {
  it("plages de jours consécutifs, puis dépliées à l'identique", () => {
    const dates = ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-03", "2026-12-31", "2027-01-01", "2028-02-28", "2028-02-29", "2028-03-01"];
    expect(enPlages([...dates].reverse())).toEqual([
      ["2026-10-30", "2026-11-01"],
      ["2026-11-03", "2026-11-03"],
      ["2026-12-31", "2027-01-01"],
      ["2028-02-28", "2028-03-01"],
    ]);
    expect(deplier(enPlages(dates))).toEqual(dates);
    expect(enPlages([])).toEqual([]);
    expect(deplier([])).toEqual([]);
  });

  it("les niveaux figés publiés : une plage par trou, dépliée à l'identique", () => {
    const publies = readdirSync(new URL("../public/levels", import.meta.url)).map((f) => f.slice(0, 10)).sort();
    expect(deplier(enPlages(publies))).toEqual(publies);
  });
});
