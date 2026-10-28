import { describe, expect, it } from "vitest";
import { SliderSteerer, sliderCourse, sliderPosition, sliderSteer } from "../src/steerSlider";
import { DEFAULT_TOUCH_SETTINGS, TouchPad, type TouchSettings } from "../src/touch";

// Lot 52 : la glissière. Position absolue : le curseur va sous le doigt ; la direction suit sa position (sensibilité, zone morte) ; au lâcher, retour au centre.
const settings = (patch: Partial<TouchSettings> = {}): TouchSettings => ({ ...DEFAULT_TOUCH_SETTINGS, steerMode: "slider", autoThrottle: false, ...patch });
const pad = (patch: Partial<TouchSettings> = {}) => {
  const p = new TouchPad(settings(patch));
  p.setGeometry(844, 390);
  p.steerer = new SliderSteerer(p);
  return p;
};
const rect = (p: TouchPad) => p.rect("steer")!;
const centre = (p: TouchPad) => rect(p).x + rect(p).w / 2;

describe("la glissière : doigt → direction", () => {
  it("au centre : 0 ; au bout du rail : plein braquage ; au-delà : borné", () => {
    const p = pad();
    const course = sliderCourse(rect(p).w);
    p.down(1, centre(p), 300);
    expect(p.axes().steer).toBe(0);
    p.move(1, centre(p) + course, 300);
    expect(p.axes().steer).toBe(1);
    p.move(1, centre(p) - course, 300);
    expect(p.axes().steer).toBe(-1);
    p.move(1, 5000, 300); // hors de l'écran
    expect(p.axes().steer).toBe(1);
  });

  it("position absolue : poser le doigt à droite braque tout de suite, sans « point de pose »", () => {
    const p = pad();
    p.down(1, centre(p) + sliderCourse(rect(p).w) / 2, 300);
    expect(p.axes().steer).toBeGreaterThan(0.4);
    expect(p.axes().steer).toBeLessThan(0.6);
  });

  it("la hauteur du doigt ne compte pas : il peut quitter le rail sans le lâcher", () => {
    const p = pad();
    p.down(1, centre(p) + 40, 380);
    const a = p.axes().steer;
    p.move(1, centre(p) + 40, 60); // en haut de l'écran
    expect(p.axes().steer).toBe(a);
  });

  it("retour au centre au lâcher, et la position dessinée aussi", () => {
    const p = pad();
    const s = p.steerer as SliderSteerer;
    p.down(1, centre(p) + 60, 300);
    expect(s.position()).toBeGreaterThan(0.5);
    p.up(1);
    expect(p.axes().steer).toBe(0);
    expect(s.position()).toBe(0);
  });

  it("la sensibilité raccourcit la course, la zone morte l'allonge (comme l'ancien joystick)", () => {
    const r = { x: 12, w: 236 };
    const c = 12 + 118;
    const course = sliderCourse(r.w);
    expect(sliderSteer(c + course / 2, r, { sensitivity: 2, deadzone: 0.08 })).toBe(1);
    expect(sliderSteer(c + course / 2, r, { sensitivity: 0.5, deadzone: 0.08 })).toBeLessThan(0.2);
    expect(sliderSteer(c + 10, r, { sensitivity: 1, deadzone: 0.3 })).toBe(0);
    expect(sliderSteer(c + course * 0.08, r, { sensitivity: 1, deadzone: 0.08 })).toBe(0); // pile sur la zone morte
    expect(sliderPosition(c + course * 0.08, r)).toBeCloseTo(0.08, 9); // le curseur, lui, suit le doigt sans zone morte
  });

  it("disposition inversée : le rail est à droite, la direction suit toujours le doigt", () => {
    const p = pad({ mirrored: true });
    expect(rect(p).x).toBeGreaterThan(844 * 0.7);
    p.down(1, centre(p) - sliderCourse(rect(p).w), 300);
    expect(p.axes().steer).toBe(-1);
  });

  it("on dirige, on accélère et on freine en même temps (plusieurs doigts)", () => {
    const p = pad();
    p.down(1, centre(p) + 50, 300);
    const gas = p.rect("gas")!;
    p.down(2, gas.x + gas.w / 2, gas.y + gas.h / 2);
    expect(p.axes()).toMatchObject({ throttle: 1, brake: 0 });
    expect(p.axes().steer).toBeGreaterThan(0.2);
    const brake = p.rect("brake")!;
    p.down(3, brake.x + brake.w / 2, brake.y + brake.h / 2);
    expect(p.axes()).toMatchObject({ throttle: 1, brake: 1 });
    p.down(4, 100, 200); // un second doigt de direction est ignoré
    p.move(4, 20, 200);
    expect(p.axes().steer).toBeGreaterThan(0.2);
  });

  it("le curseur dessiné reste dans la plaque, à tous les bouts", () => {
    for (const w of [170, 236, 241]) expect(w / 2 + sliderCourse(w) + 28).toBeLessThanOrEqual(w);
  });
});
