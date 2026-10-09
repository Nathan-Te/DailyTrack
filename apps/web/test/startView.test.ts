import { describe, expect, it } from "vitest";
import { parseTrack, trackCenterline } from "@cdj/sim";
import { PLUNGE_END, PLUNGE_HOLD, PLUNGE_LOOK_BLOCK, plungeMix, plungeTarget } from "../src/startView";

// Lot 25 : vue de départ plongeante du Col alpin (présentation seule).
describe("vue de départ plongeante", () => {
  it("entière au début du décompte, nulle au départ, sans saut entre les deux", () => {
    expect(plungeMix(3)).toBe(1);
    expect(plungeMix(PLUNGE_HOLD)).toBe(1);
    expect(plungeMix(PLUNGE_END)).toBe(0);
    expect(plungeMix(0)).toBe(0);
    let prev = 1;
    for (let t = 3; t >= 0; t -= 0.01) {
      const m = plungeMix(t);
      expect(m).toBeLessThanOrEqual(prev + 1e-12);
      expect(prev - m).toBeLessThan(0.02); // glisse, pas de coupure
      prev = m;
    }
  });

  it("regarde la descente : la route quelques blocs plus loin, en contrebas", () => {
    const t = parseTrack("col", "S@start D D2 D3 D3 D3 D2 D L2/d D D2 D D D D D S S@finish");
    const [, y] = plungeTarget(trackCenterline(t));
    expect(t.blocks[PLUNGE_LOOK_BLOCK]!.y0).toBeLessThan(-30);
    expect(y).toBeCloseTo(t.blocks[PLUNGE_LOOK_BLOCK]!.y0, 0);
    // circuit court : le dernier point
    const short = trackCenterline(parseTrack("c", "S@start D S@finish"));
    expect(plungeTarget(short)).toEqual([short.x.at(-1), short.y.at(-1), short.z.at(-1)]);
  });
});
