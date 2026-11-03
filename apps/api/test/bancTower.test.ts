import { describe, expect, it } from "vitest";
import { comparerALaReference } from "../scripts/banc";
import { scenarioTower } from "../scripts/banc-tower";
import { TEST_DB } from "./helpers";

// Lot K2 — le banc de réponses de Tower : le même scénario, joué sur SQLite et sur libSQL (`file:`, jamais Turso), doit rendre exactement la référence versée (`fixtures/banc-tower.json`, produite par le code
// d'AVANT le refactor du module des jeux). Voir `scripts/banc.ts`. Régénérer la référence (`UPDATE_BANC=1`) n'est permis que pour une différence voulue, justifiée dans le README du lot.
describe(`banc de réponses de Tower (${TEST_DB})`, () => {
  it("toutes les réponses sont identiques à la référence", { timeout: 300_000 }, async () => {
    const traces = await scenarioTower();
    expect(traces.length).toBeGreaterThan(150);
    const differences = comparerALaReference(new URL("./fixtures/banc-tower.json", import.meta.url), traces);
    expect(differences, differences.join("\n")).toEqual([]);
  });
});
