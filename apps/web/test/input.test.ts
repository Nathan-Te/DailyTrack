import { describe, expect, it } from "vitest";
import { gamepadAxes, keyboardAxes } from "../src/input";

describe("clavier", () => {
  it("ZQSD (AZERTY) et WASD (QWERTY) sont la même touche physique", () => {
    expect(keyboardAxes(new Set(["KeyW"]))).toEqual({ steer: 0, throttle: 1, brake: 0 });
    expect(keyboardAxes(new Set(["KeyA", "KeyW"])).steer).toBe(-1);
    expect(keyboardAxes(new Set(["ArrowRight", "ArrowDown"]))).toEqual({ steer: 1, throttle: 0, brake: 1 });
  });

  it("gauche + droite s'annulent", () => {
    expect(keyboardAxes(new Set(["ArrowLeft", "ArrowRight"])).steer).toBe(0);
  });
});

describe("manette", () => {
  const pad = (axes: number[], pressed: Record<number, number> = {}) =>
    ({
      axes,
      buttons: Array.from({ length: 17 }, (_, i) => ({ value: pressed[i] ?? 0, pressed: !!pressed[i], touched: false })),
    }) as unknown as Pick<Gamepad, "axes" | "buttons">;

  it("applique une zone morte au stick", () => {
    expect(gamepadAxes(pad([0.05])).steer).toBe(0);
    expect(gamepadAxes(pad([1])).steer).toBe(1);
    expect(gamepadAxes(pad([-0.56])).steer).toBeCloseTo(-0.5, 2);
  });

  it("lit les gâchettes analogiques", () => {
    const a = gamepadAxes(pad([0], { 7: 0.6, 6: 0.25 }));
    expect(a.throttle).toBeCloseTo(0.6);
    expect(a.brake).toBeCloseTo(0.25);
  });
});
