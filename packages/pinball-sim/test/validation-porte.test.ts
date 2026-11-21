import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { analyserTable, dailyPinball } from "../src/index";

// LA VALIDATION EXIGE LA PORTE (lot PBG3) : la table doit voir la porte s'ouvrir d'elle-même (la banque de cibles complète, ou l'orbite sur une table sans banque) et être franchie, sur les parties du robot de six minutes
// (`DUREE_PARTIE_ROBOT`) : c'est celles de la validation des 24 tables (`npm run valider:pinball`), qui n'en refuse aucune pour cette raison. **Test long** (≈ 25 s par table) : à ranger en « Régression » avec les autres.
describe("la porte vue par la validation d'une table, parties de six minutes", () => {
  it("les tables A et B du Volcan, de face et en miroir (la banque de cibles ouvre la porte de l'orbite) : porte ouverte et franchie par les parties du robot de six minutes, table valide", () => {
    for (const [plan, miroir] of [["A", false], ["A", true], ["B", false], ["B", true]] as const) {
      const a = analyserTable(dailyPinball(daysFromCivil(2026, 11, 18), undefined, "volcan", plan, miroir));
      expect(a.raisons, `${plan}${miroir ? "'" : ""} : ${a.raisons!.join(" ; ")}`).toEqual([]);
      expect(a.porteOuverte).toBe(true);
      expect(a.porteFranchie).toBe(true);
      expect(a.ok).toBe(true);
    }
  }, 240_000);
});
