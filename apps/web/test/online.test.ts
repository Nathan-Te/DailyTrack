import { describe, expect, it } from "vitest";
import { ghostModes, nextGhostMode } from "../src/online";

describe("modes de fantôme", () => {
  it("ne propose que ce qui existe : son record, le premier, le joueur devant, aucun", () => {
    expect(ghostModes(true, true)).toEqual(["mine", "first", "ahead", "off"]);
    expect(ghostModes(false, true)).toEqual(["first", "ahead", "off"]);
    expect(ghostModes(true, false)).toEqual(["mine", "off"]);
    expect(ghostModes(false, false)).toEqual(["off"]);
  });

  it("les parcourt en boucle", () => {
    const modes = ghostModes(true, true);
    expect(nextGhostMode("mine", modes)).toBe("first");
    expect(nextGhostMode("first", modes)).toBe("ahead");
    expect(nextGhostMode("ahead", modes)).toBe("off");
    expect(nextGhostMode("off", modes)).toBe("mine");
    expect(nextGhostMode("mine", ["off"])).toBe("off"); // mode courant absent de la liste : on retombe sur le premier
  });
});
