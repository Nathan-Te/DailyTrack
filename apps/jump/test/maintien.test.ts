import { DEFAULT_JUMP_PARAMS, JUMP_MICRO_MAX, JUMP_MIN_HOLD, isDefaultJumpParams } from "@cdj/jump-sim";
import { describe, expect, it } from "vitest";
import { HOLD_SLIDERS, holdChanged, holdValue, microValue, paramsJson, parseTuned, resetParams, smallJumpHeight } from "../src/tune";

// Lot 30 — le réglage « Maintien du saut » du panneau `?debug&tune`.

describe("maintien du saut dans ?debug&tune (lot 30)", () => {
  it("deux curseurs (maintien de 0 à 30 pas, micro-saut de 0 à 10 pas), qui valent ceux des niveaux de la version 13 tant qu'ils n'ont pas bougé", () => {
    expect(HOLD_SLIDERS.map((s) => s.key)).toEqual(["jumpMinHold", "jumpMicroMax"]);
    expect(microValue(DEFAULT_JUMP_PARAMS)).toBe(JUMP_MICRO_MAX);
    expect(microValue({ ...DEFAULT_JUMP_PARAMS, jumpMicroMax: 0 })).toBe(0);
    expect(holdChanged({ ...DEFAULT_JUMP_PARAMS, jumpMicroMax: 0 })).toBe(1);
    expect(isDefaultJumpParams({ ...DEFAULT_JUMP_PARAMS, jumpMicroMax: 0 })).toBe(false);
    expect(HOLD_SLIDERS[0]!.min).toBe(0);
    expect(HOLD_SLIDERS[0]!.max).toBe(30);
    expect(holdValue(DEFAULT_JUMP_PARAMS)).toBe(JUMP_MIN_HOLD);
    expect(holdChanged(DEFAULT_JUMP_PARAMS)).toBe(0);
    expect(holdValue({ ...DEFAULT_JUMP_PARAMS, jumpMinHold: 20 })).toBe(20);
    expect(holdChanged({ ...DEFAULT_JUMP_PARAMS, jumpMinHold: 20 })).toBe(1);
  });

  it("le réglage donné rend la partie « tuned » ; absent, non ; il n'est jamais dans les défauts", () => {
    expect("jumpMinHold" in DEFAULT_JUMP_PARAMS).toBe(false);
    expect(isDefaultJumpParams(DEFAULT_JUMP_PARAMS)).toBe(true);
    expect(isDefaultJumpParams({ ...DEFAULT_JUMP_PARAMS, jumpMinHold: 6 })).toBe(false);
    expect(isDefaultJumpParams({ ...DEFAULT_JUMP_PARAMS, jumpMinHold: 0 })).toBe(false);
  });

  it("la hauteur du petit saut : celle de l'appui de 10 pas d'avant (2,53 tuiles), contre 0,98 tuile pour un appui de 1 pas", () => {
    const p = DEFAULT_JUMP_PARAMS;
    expect(smallJumpHeight(p, JUMP_MIN_HOLD)).toBeCloseTo(2.53, 1);
    expect(smallJumpHeight(p, 1)).toBeCloseTo(0.98, 1);
    expect(smallJumpHeight(p, 5)).toBeCloseTo(1.71, 1);
    expect(smallJumpHeight(p, 24)).toBeCloseTo(4.19, 1);
    expect(HOLD_SLIDERS[0]!.hint!({ ...p, jumpMinHold: 10 })).toMatch(/tout appui de 5 à 10 pas donne le même petit saut, ≈ 2,5/);
    expect(HOLD_SLIDERS[1]!.hint!(p)).toMatch(/appui de 1 à 4 pas coupe le saut au relâchement/);
    expect(HOLD_SLIDERS[1]!.hint!({ ...p, jumpMicroMax: 0 })).toMatch(/aucun micro-saut/);
    expect(HOLD_SLIDERS[0]!.hint!({ ...p, jumpMinHold: 0 })).toMatch(/aucun maintien/);
  });

  it("gardé, relu, copié et réinitialisé comme les autres réglages optionnels", () => {
    const tuned = parseTuned(JSON.stringify({ jumpMinHold: 14, jumpMicroMax: 2 }));
    expect(tuned.jumpMinHold).toBe(14);
    expect(tuned.jumpMicroMax).toBe(2);
    expect(JSON.parse(paramsJson(tuned)).jumpMicroMax).toBe(2);
    expect(parseTuned(JSON.stringify({ jumpMinHold: 99 })).jumpMinHold).toBeUndefined();
    expect(parseTuned(JSON.stringify({ jumpMinHold: 1.5 })).jumpMinHold).toBeUndefined();
    expect(JSON.parse(paramsJson(tuned)).jumpMinHold).toBe(14);
    expect("jumpMinHold" in JSON.parse(paramsJson(DEFAULT_JUMP_PARAMS))).toBe(false);
    expect("jumpMinHold" in JSON.parse(paramsJson({ ...DEFAULT_JUMP_PARAMS, jumpMinHold: JUMP_MIN_HOLD }))).toBe(false);
    resetParams(tuned);
    expect(tuned.jumpMinHold).toBeUndefined();
    expect(tuned.jumpMicroMax).toBeUndefined();
    expect(isDefaultJumpParams(tuned)).toBe(true);
  });
});
