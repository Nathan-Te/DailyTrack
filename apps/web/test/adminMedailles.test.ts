import { describe, expect, it } from "vitest";
import { MEDAL_TARGETS, parseMedalReport, pct, targetState, vsPilot } from "../src/adminMedailles";

// Lot 35 : la section « Médailles » de la page d'admin (formats et lecture de la réponse).

describe("adminMedailles", () => {
  it("formats : part, écart au pilote", () => {
    expect(pct(0.125)).toBe("12,5 %");
    expect(pct(null)).toBe("—");
    expect(vsPilot(1.052)).toBe("+5,2 %");
    expect(vsPilot(0.97)).toBe("−3,0 %");
    expect(vsPilot(undefined)).toBe("—");
  });

  it("cibles du lot 35 : auteur 5–10 %, or 25–35 %, argent 50–60 %, bronze 85–90 %", () => {
    expect(MEDAL_TARGETS).toEqual({ author: [0.05, 0.1], gold: [0.25, 0.35], silver: [0.5, 0.6], bronze: [0.85, 0.9] });
    expect(targetState("author", 0.6)).toBe("over");
    expect(targetState("author", 0.07)).toBe("in");
    expect(targetState("bronze", 0.8)).toBe("under");
  });

  it("une réponse sans la forme attendue est refusée", () => {
    expect(parseMedalReport(null)).toBeNull();
    expect(parseMedalReport({ today: "2026-10-21", days: [] })).toBeNull();
    expect(parseMedalReport({ today: "2026-10-21", days: [], themes: [], all: { days: 0 } })).not.toBeNull();
  });
});
