import { describe, expect, it } from "vitest";
import { TICK_RATE } from "@cdj/sim";

// Garde-fou : le web consomme bien le paquet sim du monorepo.
describe("web ↔ sim", () => {
  it("résout @cdj/sim", () => {
    expect(TICK_RATE).toBe(120);
  });
});
