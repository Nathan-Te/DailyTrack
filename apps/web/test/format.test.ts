import { describe, expect, it } from "vitest";
import { formatDelta, formatTime } from "../src/format";

describe("formatTime", () => {
  it("affiche les secondes avec les millièmes, virgule française", () => {
    expect(formatTime(35142)).toBe("35,142 s");
    expect(formatTime(5)).toBe("0,005 s");
    expect(formatTime(0)).toBe("0,000 s");
  });
  it("passe en minutes au-delà de 60 s", () => {
    expect(formatTime(95142)).toBe("1:35,142");
    expect(formatTime(60000)).toBe("1:00,000");
  });
});

describe("formatDelta", () => {
  it("signe l'écart", () => {
    expect(formatDelta(210)).toBe("+0,210");
    expect(formatDelta(-1500)).toBe("−1,500");
    expect(formatDelta(0)).toBe("+0,000");
  });
});
