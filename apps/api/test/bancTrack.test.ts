import { describe, expect, it } from "vitest";
import { comparerALaReference } from "../scripts/banc";
import { scenarioTrack } from "../scripts/banc-track";
import { TEST_DB } from "./helpers";

// Lot K2c — le banc de réponses de Track : le même scénario, joué sur SQLite et sur libSQL (`file:`, jamais Turso), doit rendre exactement la référence versée (`fixtures/banc-track.json`, produite par le code
// d'AVANT la migration vers le module des jeux). Voir `scripts/banc.ts`. Régénérer la référence (`UPDATE_BANC=1`) n'est permis que pour une différence voulue, justifiée dans le README du lot.
describe(`banc de réponses de Track (${TEST_DB})`, () => {
  it("toutes les réponses sont identiques à la référence", { timeout: 600_000 }, async () => {
    const traces = await scenarioTrack();
    expect(traces.length).toBeGreaterThan(200);
    const differences = comparerALaReference(new URL("./fixtures/banc-track.json", import.meta.url), traces);
    expect(differences, differences.join("\n")).toEqual([]);
  });
});
