import { describe, expect, it } from "vitest";
import { diamantOuvert, ghostModes, nextGhostMode } from "../src/online";

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

  it("lot G1 : le Diamant entre dans le cycle avant « aucun » seulement une fois débloqué", () => {
    expect(ghostModes(true, true, false)).toEqual(["mine", "first", "ahead", "off"]); // verrouillé : sauté
    expect(ghostModes(true, true, true)).toEqual(["mine", "first", "ahead", "diamant", "off"]);
    expect(ghostModes(false, false, true)).toEqual(["diamant", "off"]); // sans serveur ni record : le Diamant (jour passé) et aucun
    const modes = ghostModes(true, true, true);
    expect(nextGhostMode("ahead", modes)).toBe("diamant");
    expect(nextGhostMode("diamant", modes)).toBe("off");
    expect(nextGhostMode("off", modes)).toBe("mine");
  });

  it("lot G1 : le Diamant est libre pour un jour passé ; le jour même, il se débloque en finissant le circuit", () => {
    expect(diamantOuvert(100, 101, false)).toBe(true); // archive
    expect(diamantOuvert(101, 101, false)).toBe(false); // aujourd'hui, circuit pas fini
    expect(diamantOuvert(101, 101, true)).toBe(true); // aujourd'hui, un meilleur temps existe (quelle que soit la médaille)
    expect(diamantOuvert(102, 101, false)).toBe(false); // un jour à venir d'essai : verrouillé tant qu'il n'est pas fini
  });
});
