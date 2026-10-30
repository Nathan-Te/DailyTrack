import { describe, expect, it } from "vitest";
import { GRANDES_TABLES, PARCOURS_PERMIS, analyserPlan, parcoursDuPlan } from "../src/plans";
import { expliquer } from "./enregistreur";

// Lot R14 : Turso compte les lignes parcourues. Un `SCAN` d'une grande table est refusé tant qu'il n'est pas justifié ; un `SEARCH` par index ne l'est jamais.
describe("lecture d'un plan", () => {
  it("reconnaît un parcours complet", () => {
    expect(parcoursDuPlan(["SCAN results", "SEARCH players USING INDEX players_by_ref (ref=?)"])).toEqual(["results"]);
    expect(parcoursDuPlan(["SCAN jump_results USING COVERING INDEX jump_results_by_inputs"])).toEqual(["jump_results"]);
    expect(parcoursDuPlan(["SEARCH results USING INDEX results_by_time (day=?)"])).toEqual([]);
  });

  it("une requête sans index sur une grande table est refusée, avec l'index elle passe", () => {
    // `results.ms` n'a pas d'index de tête : filtrer dessus lit toute la table.
    const sans = expliquer("SELECT player_id FROM results WHERE ms = ?", [60000])!;
    expect(sans.plan.join(" ")).toMatch(/SCAN results/);
    expect(sans.verdict.injustifies.map((p) => p.table)).toEqual(["results"]);
    // Le jour d'abord : l'index (day, ms, submitted_at) répond.
    const avec = expliquer("SELECT player_id FROM results WHERE day = ? AND ms = ?", [1, 60000])!;
    expect(avec.plan.join(" ")).toMatch(/SEARCH results USING/);
    expect(avec.verdict.injustifies).toEqual([]);
  });

  it("un parcours justifié est accepté, avec sa raison", () => {
    const v = expliquer("DELETE FROM rate WHERE bucket < ?", [5])!;
    expect(v.verdict.parcours[0]!.raison).toMatch(/fenêtre/);
    expect(v.verdict.injustifies).toEqual([]);
  });

  it("les petites tables fixes ne comptent pas", () => {
    expect(analyserPlan("SELECT * FROM planning", ["SCAN planning"]).injustifies).toEqual([]);
    expect(GRANDES_TABLES).not.toContain("planning");
  });

  it("chaque parcours permis dit pourquoi", () => {
    for (const p of PARCOURS_PERMIS) expect(p.raison.length, p.motif.source).toBeGreaterThan(30);
  });
});
