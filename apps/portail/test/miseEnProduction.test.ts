import { describe, expect, it } from "vitest";
// @ts-expect-error — module JavaScript du dépôt (scripts/), sans déclarations
import { changesFromLog, changesSummary, frozenOverlay, latestProdTag, prodTag } from "../../../scripts/mise-en-production.mjs";

// Lot R4 : « Mettre en production » — étiquette, dernière mise en production, liste des changements, jours figés ajoutés au déploiement.

describe("étiquette de mise en production", () => {
  it("prod-AAAA-MM-JJ-HHMM à l'heure de Paris (été et hiver)", () => {
    expect(prodTag(Date.parse("2026-10-20T12:05:00Z"))).toBe("prod-2026-10-20-1405");
    expect(prodTag(Date.parse("2026-10-20T22:30:00Z"))).toBe("prod-2026-10-21-0030");
    expect(prodTag(Date.parse("2026-11-03T08:00:00Z"))).toBe("prod-2026-11-03-0900");
  });

  it("la dernière étiquette, et celle d'avant (retour arrière)", () => {
    const tags = ["v1", "prod-2026-10-21-0030", "prod-2026-10-20-1405", "prod-2026-11-03-0900", "prod-mauvaise", ""];
    expect(latestProdTag(tags)).toBe("prod-2026-11-03-0900");
    expect(latestProdTag(tags, "prod-2026-11-03-0900")).toBe("prod-2026-10-21-0030");
    expect(latestProdTag(["v1"])).toBeNull();
  });
});

describe("changements depuis la dernière mise en production", () => {
  const log = [
    "aaa1111\tp1 p2\tMerge pull request #84 from Nathan-Te/claude/lot-r4",
    "bbb2222\tp3\tLot R4 — workflows",
    "ccc3333\tp4\tCorrige le portail (#85)",
    "ddd4444\tp5 p6\tMerge pull request #84 from Nathan-Te/claude/lot-r4",
    "eee5555\tp7\tJours figés <robot>",
    "",
  ];
  it("PR (fusion ou écrasée, sans doublon) et commits ordinaires (hors fusions)", () => {
    const { prs, commits } = changesFromLog(log);
    expect(prs.map((p: { number: number }) => p.number)).toEqual([84, 85]);
    expect(commits.map((c: { sha: string }) => c.sha)).toEqual(["bbb2222", "ccc3333", "eee5555"]);
  });

  it("résumé lisible, liens vers les PR, sans balise", () => {
    const text = changesSummary({ from: "prod-2026-10-20-1405", to: "abcdef0123", repo: "Nathan-Te/DailyTrack", ...changesFromLog(log) });
    expect(text).toContain("depuis `prod-2026-10-20-1405`");
    expect(text).toContain("[#84](https://github.com/Nathan-Te/DailyTrack/pull/84)");
    expect(text).toContain("`ccc3333` Corrige le portail (#85)");
    expect(text).not.toContain("<robot>");
    expect(changesSummary({ from: null, to: "abc", repo: null, prs: [], commits: [] })).toContain("première mise en production");
  });
});

describe("jours figés avec le code en production", () => {
  it("ajoute les jours absents du commit déployé ; un jour identique ne change rien ; un jour différent est refusé", () => {
    const frozen = { "2026-10-16.json": "a", "2026-10-21.json": "b", "2026-10-22.json": "c", "notes.txt": "x" };
    expect(frozenOverlay(frozen, { "2026-10-16.json": "a" })).toEqual({ add: ["2026-10-21.json", "2026-10-22.json"], conflicts: [] });
    expect(frozenOverlay(frozen, { "2026-10-16.json": "AUTRE" }).conflicts).toEqual(["2026-10-16.json"]);
    expect(frozenOverlay({}, { "2026-10-16.json": "a" })).toEqual({ add: [], conflicts: [] });
  });
});
