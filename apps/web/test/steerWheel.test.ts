import { describe, expect, it } from "vitest";
import { HUB_RADIUS_PX, WheelSteerer, angleAround, wheelSteer } from "../src/steerWheel";
import { DEFAULT_TOUCH_SETTINGS, TouchPad, type TouchSettings } from "../src/touch";

// Lot 52 : le volant. L'angle vient de la position du doigt autour du centre ; prise relative ; butoir réglable ; retour au centre.
const settings = (patch: Partial<TouchSettings> = {}): TouchSettings => ({ ...DEFAULT_TOUCH_SETTINGS, steerMode: "wheel", autoThrottle: false, ...patch });
const pad = (patch: Partial<TouchSettings> = {}) => {
  const p = new TouchPad(settings(patch));
  p.setGeometry(844, 390);
  p.steerer = new WheelSteerer(p);
  return p;
};
const wheel = (p: TouchPad) => p.steerer as WheelSteerer;
const C = (p: TouchPad) => {
  const r = p.rect("steer")!;
  return { x: r.x + r.w / 2, y: r.y + r.h / 2, r: r.w / 2 };
};
/** Le point où se trouve un doigt à `deg` degrés autour du centre du volant (0 en haut, horaire), à `rayon` pixels. */
const at = (p: TouchPad, deg: number, rayon = 50) => ({ x: C(p).x + rayon * Math.sin((deg * Math.PI) / 180), y: C(p).y - rayon * Math.cos((deg * Math.PI) / 180) });
const down = (p: TouchPad, id: number, deg: number, rayon?: number) => p.down(id, at(p, deg, rayon).x, at(p, deg, rayon).y);
const move = (p: TouchPad, id: number, deg: number, rayon?: number) => p.move(id, at(p, deg, rayon).x, at(p, deg, rayon).y);

describe("le volant : angle autour du centre", () => {
  it("angleAround : 0 en haut, 90 à droite, 180 en bas, −90 à gauche ; rien au moyeu", () => {
    expect(angleAround(100, 100, 100, 50)).toBeCloseTo(0, 9);
    expect(angleAround(100, 100, 150, 100)).toBeCloseTo(90, 9);
    expect(Math.abs(angleAround(100, 100, 100, 150)!)).toBeCloseTo(180, 9);
    expect(angleAround(100, 100, 50, 100)).toBeCloseTo(-90, 9);
    expect(angleAround(100, 100, 100 + HUB_RADIUS_PX - 1, 100)).toBeNull();
  });

  it("prise relative : le saisir à 3 h ne fait pas sauter le volant ; il tourne de l'angle que le doigt balaie", () => {
    const p = pad();
    down(p, 1, 90);
    expect(wheel(p).angle).toBe(0);
    expect(p.axes().steer).toBe(0);
    move(p, 1, 90 + 45);
    expect(wheel(p).angle).toBeCloseTo(45, 6);
    expect(p.axes().steer).toBeCloseTo(wheelSteer(45, 90, 0.06), 9); // 45° sur 90° : ≈ la moitié
    move(p, 1, 90 - 30);
    expect(wheel(p).angle).toBeCloseTo(-30, 6);
    expect(p.axes().steer).toBeLessThan(0);
  });

  it("la distance au centre ne compte pas : le doigt peut sortir de la jante, même de l'écran", () => {
    const p = pad();
    down(p, 1, 0, 50);
    move(p, 1, 40, 500); // très loin du volant, au même angle
    expect(wheel(p).angle).toBeCloseTo(40, 6);
    move(p, 1, 40, 5000);
    expect(wheel(p).angle).toBeCloseTo(40, 6);
  });

  it("butoir à 90° : le volant s'arrête, le point de prise suit le doigt, le retour est immédiat", () => {
    const p = pad({ wheelAngle: 90 });
    down(p, 1, 0);
    move(p, 1, 60);
    move(p, 1, 120); // 120° balayés, butoir à 90°
    expect(wheel(p).angle).toBe(90);
    expect(p.axes().steer).toBe(1);
    move(p, 1, 100); // le doigt revient de 20° : le volant revient de 20° tout de suite (le point de prise était à 120°, pas à 90°)
    expect(wheel(p).angle).toBeCloseTo(70, 6);
    move(p, 1, 60);
    expect(wheel(p).angle).toBeCloseTo(30, 6);
    for (let a = 40; a >= -120; a -= 20) move(p, 1, a); // de l'autre côté, d'un geste continu
    expect(wheel(p).angle).toBe(-90);
    expect(p.axes().steer).toBe(-1);
  });

  it("butoir à 135° : plus de course, la direction est la même part de l'angle", () => {
    const p = pad({ wheelAngle: 135 });
    down(p, 1, 0);
    for (let a = 0; a <= 160; a += 20) move(p, 1, a);
    expect(wheel(p).angle).toBe(135);
    move(p, 1, 160 - 45); // le doigt revient de 45°
    expect(wheel(p).angle).toBeCloseTo(90, 6);
    expect(p.axes().steer).toBeCloseTo(wheelSteer(90, 135, 0.06), 9);
    expect(wheelSteer(45, 135, 0)).toBeCloseTo(1 / 3, 9);
    expect(wheelSteer(45, 90, 0)).toBeCloseTo(1 / 2, 9);
  });

  it("zone morte : une part de l'angle maximal", () => {
    expect(wheelSteer(4, 90, 0.06)).toBe(0); // 4° < 5,4°
    expect(wheelSteer(6, 90, 0.06)).toBeGreaterThan(0);
    expect(wheelSteer(6, 90, 0.2)).toBe(0);
    expect(wheelSteer(-90, 90, 0.06)).toBe(-1);
  });

  it("passer de 179° à −179° (le bas du volant) est un petit pas, pas un tour entier", () => {
    const p = pad({ wheelAngle: 135 });
    down(p, 1, 170);
    move(p, 1, 185); // = −175°
    expect(wheel(p).angle).toBeCloseTo(15, 6);
  });

  it("au lâcher : retour au centre, la direction retombe à 0 tout de suite", () => {
    const p = pad();
    down(p, 1, 0);
    move(p, 1, 70);
    expect(p.axes().steer).toBeGreaterThan(0.5);
    p.up(1);
    expect(wheel(p).angle).toBe(0);
    expect(wheel(p).finger).toBeNull();
    expect(p.axes().steer).toBe(0);
    down(p, 2, 90); // on le reprend : il repart de 0
    expect(wheel(p).angle).toBe(0);
  });

  it("le moyeu : un doigt posé au centre n'invente pas d'angle", () => {
    const p = pad();
    p.down(1, C(p).x + 2, C(p).y);
    p.move(1, C(p).x - 3, C(p).y + 1);
    expect(wheel(p).angle).toBe(0);
    move(p, 1, 30);
    expect(Math.abs(wheel(p).angle)).toBeLessThanOrEqual(180); // une fois sorti du moyeu, il reprend normalement
  });

  it("on tourne, on accélère et on freine en même temps ; un second doigt de direction est ignoré", () => {
    const p = pad();
    down(p, 1, 0);
    move(p, 1, 40);
    const gas = p.rect("gas")!;
    p.down(2, gas.x + gas.w / 2, gas.y + gas.h / 2);
    expect(p.axes()).toMatchObject({ throttle: 1, brake: 0 });
    expect(p.axes().steer).toBeGreaterThan(0.3);
    down(p, 3, 0);
    move(p, 3, -80);
    expect(wheel(p).angle).toBeCloseTo(40, 6);
  });

  it("disposition inversée : le volant est à droite, l'angle se mesure autour de son centre", () => {
    const p = pad({ mirrored: true });
    expect(C(p).x).toBeGreaterThan(844 * 0.7);
    down(p, 1, 0);
    move(p, 1, -60);
    expect(wheel(p).angle).toBeCloseTo(-60, 6);
  });

  it("le volant tient dans le bord : jamais plus de 30 % de la largeur, ni la moitié de la hauteur", () => {
    for (const buttonSize of ["small", "medium", "large"] as const) {
      const r = pad({ buttonSize }).rect("steer")!;
      expect(r.w).toBeLessThanOrEqual(844 * 0.3);
      expect(r.h).toBeLessThanOrEqual(195);
      expect(r.w).toBeGreaterThanOrEqual(44);
    }
  });
});
