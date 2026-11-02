import { describe, expect, it } from "vitest";
import { VIBRATION_CHOC_MS, vibrationPermise, vibrer } from "../src/vibration";

// Lot T9 — la vibration du choc d'un taquet : 15 ms sur téléphone, permise par le réglage du joueur (Réglages › Affichage, allumé par défaut) ET par le curseur de `?debug&tune`.
describe("la vibration du choc", () => {
  it("15 ms, quand le réglage et le curseur la permettent et que l'appareil sait vibrer", () => {
    const appels: number[] = [];
    expect(VIBRATION_CHOC_MS).toBe(15);
    expect(vibrer(vibrationPermise(true, 1), VIBRATION_CHOC_MS, { vibrate: (d) => (appels.push(d), true) })).toBe(true);
    expect(appels).toEqual([15]);
  });

  it("coupée par le réglage du joueur, ou par le curseur à zéro : l'appareil n'est pas sollicité", () => {
    const appels: number[] = [];
    const nav = { vibrate: (d: number) => (appels.push(d), true) };
    expect(vibrer(vibrationPermise(false, 1), 15, nav)).toBe(false);
    expect(vibrer(vibrationPermise(true, 0), 15, nav)).toBe(false);
    expect(appels).toEqual([]);
    expect(vibrationPermise(false, 1)).toBe(false);
    expect(vibrationPermise(true, 0)).toBe(false);
  });

  it("sans navigator.vibrate (ordinateur, iPhone) ou s'il lève une erreur : rien, sans exception", () => {
    expect(vibrer(true, 15, {})).toBe(false);
    expect(vibrer(true, 15, undefined)).toBe(false);
    expect(
      vibrer(true, 15, {
        vibrate: () => {
          throw new Error("refusé");
        },
      }),
    ).toBe(false);
  });
});
