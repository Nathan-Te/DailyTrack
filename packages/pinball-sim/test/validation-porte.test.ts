import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { analyserTable, dailyPinball } from "../src/index";

// LA VALIDATION EXIGE LA PORTE (lot PBG3) : la table doit voir la porte s'ouvrir d'elle-même (la banque de cibles complète, ou l'orbite sur une table sans banque) et être franchie, sur les parties du robot de six minutes
// (`DUREE_PARTIE_ROBOT`) : c'est celles de la validation des 500 tables (`npm run valider:pinball`), qui n'en refuse aucune pour cette raison. **Test long** (≈ 25 s par table) : à ranger en « Régression » avec les autres.
describe("la porte vue par la validation d'une table, parties de six minutes", () => {
  it("la table du 18/11/2026 (volcan, tremplin : le robot ne l'ouvre pas en deux minutes) : porte ouverte et franchie, table valide", () => {
    const c = dailyPinball(daysFromCivil(2026, 11, 18));
    const a = analyserTable(c);
    expect(a.raisons, a.raisons!.join(" ; ")).toEqual([]);
    expect(a.porteOuverte).toBe(true);
    expect(a.porteFranchie).toBe(true);
    expect(a.ok).toBe(true);
  }, 120_000);
});
