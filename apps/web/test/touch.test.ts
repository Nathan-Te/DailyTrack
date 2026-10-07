import { describe, expect, it } from "vitest";
import { makeInput } from "@cdj/sim";
import {
  DEFAULT_TOUCH_SETTINGS,
  FULL_LOCK_PX,
  IMPACT_DROP,
  TouchPad,
  dragSteer,
  impactFelt,
  parseTouchSettings,
  wantsTouch,
  zoneAt,
  type TouchSettings,
} from "../src/touch";

const settings = (patch: Partial<TouchSettings> = {}): TouchSettings => ({ ...DEFAULT_TOUCH_SETTINGS, ...patch });
const W = 800;
const pad = (patch: Partial<TouchSettings> = {}) => {
  const p = new TouchPad(settings(patch));
  p.width = W;
  return p;
};

describe("détection", () => {
  it("l'appareil décide (pointeur grossier), ?touch=1 force, ?touch=0 coupe", () => {
    expect(wantsTouch(new URLSearchParams(""), true)).toBe(true);
    expect(wantsTouch(new URLSearchParams(""), false)).toBe(false);
    expect(wantsTouch(new URLSearchParams("touch=1"), false)).toBe(true);
    expect(wantsTouch(new URLSearchParams("touch=0"), true)).toBe(false);
    expect(wantsTouch(new URLSearchParams("touch=oui"), false)).toBe(false);
  });
});

describe("direction au glissement", () => {
  it("zone morte, puis linéaire jusqu'au plein braquage à FULL_LOCK_PX", () => {
    const s = settings();
    expect(dragSteer(0, s)).toBe(0);
    expect(dragSteer(FULL_LOCK_PX * s.deadzone, s)).toBe(0); // pile sur la zone morte
    expect(dragSteer(FULL_LOCK_PX, s)).toBe(1);
    expect(dragSteer(-FULL_LOCK_PX, s)).toBe(-1);
    expect(dragSteer(10_000, s)).toBe(1);
    const mid = dragSteer(FULL_LOCK_PX / 2, s);
    expect(mid).toBeGreaterThan(0.4);
    expect(mid).toBeLessThan(0.55);
    expect(dragSteer(-20, s)).toBeCloseTo(-dragSteer(20, s), 12); // symétrique
  });

  it("la sensibilité raccourcit ou allonge le débattement", () => {
    expect(dragSteer(FULL_LOCK_PX / 2, settings({ sensitivity: 2 }))).toBe(1);
    expect(dragSteer(FULL_LOCK_PX / 2, settings({ sensitivity: 0.5 }))).toBeLessThan(0.2);
    expect(dragSteer(10, settings({ deadzone: 0.3, sensitivity: 1 }))).toBe(0);
  });

  it("monotone : plus le doigt va loin, plus on braque", () => {
    let last = -1;
    for (let dx = 0; dx <= FULL_LOCK_PX; dx += 2) {
      const v = dragSteer(dx, settings());
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });
});

describe("zones", () => {
  it("glisser + accélérateur automatique : moitié gauche = direction, moitié droite = frein", () => {
    const s = settings();
    expect(zoneAt(10, W, s)).toBe("steer");
    expect(zoneAt(399, W, s)).toBe("steer");
    expect(zoneAt(400, W, s)).toBe("brake");
    expect(zoneAt(790, W, s)).toBe("brake");
  });

  it("boutons + accélérateur manuel : quarts ← → frein gaz", () => {
    const s = settings({ steerMode: "buttons", autoThrottle: false });
    expect([50, 250, 500, 700].map((x) => zoneAt(x, W, s))).toEqual(["left", "right", "brake", "gas"]);
  });
});

describe("doigts", () => {
  it("sans doigt : plein gaz, tout droit, pas de frein (accélérateur automatique)", () => {
    expect(pad().axes()).toEqual({ steer: 0, throttle: 1, brake: 0 });
    expect(pad({ autoThrottle: false }).axes()).toEqual({ steer: 0, throttle: 0, brake: 0 });
  });

  it("le glissement est relatif au point de pose", () => {
    const p = pad();
    p.down(1, 300, 200);
    expect(p.axes().steer).toBe(0); // posé, pas encore glissé
    p.move(1, 330, 210);
    const right = p.axes().steer;
    expect(right).toBeGreaterThan(0.2);
    p.move(1, 270, 190);
    expect(p.axes().steer).toBeLessThan(-0.2);
    p.up(1);
    expect(p.axes().steer).toBe(0);
  });

  it("au-delà du plein braquage, le point de pose suit le doigt : un petit retour suffit à redresser", () => {
    const p = pad();
    p.down(1, 100, 200);
    p.move(1, 100 + 300, 200);
    expect(p.axes().steer).toBe(1);
    p.move(1, 100 + 300 - FULL_LOCK_PX / 2, 200);
    const v = p.axes().steer;
    expect(v).toBeGreaterThan(0.3);
    expect(v).toBeLessThan(0.7);
    p.move(1, 100 + 300 - FULL_LOCK_PX * 1.5, 200);
    expect(p.axes().steer).toBeLessThan(0); // revenu de l'autre côté sans avoir refait 300 px
  });

  it("un glissement de la moitié gauche vers la droite reste une direction, il ne devient pas un frein", () => {
    const p = pad();
    p.down(1, 380, 200);
    p.move(1, 700, 200);
    expect(p.axes()).toMatchObject({ steer: 1, brake: 0, throttle: 1 });
  });

  it("multi-doigts : on dirige et on freine en même temps ; l'accélérateur automatique se coupe au frein", () => {
    const p = pad();
    p.down(1, 100, 200);
    p.move(1, 150, 200);
    p.down(2, 700, 200);
    const a = p.axes();
    expect(a.steer).toBeGreaterThan(0.3);
    expect(a.brake).toBe(1);
    expect(a.throttle).toBe(0);
    p.up(2);
    expect(p.axes()).toMatchObject({ brake: 0, throttle: 1 });
    expect(p.axes().steer).toBeGreaterThan(0.3); // le premier doigt tient toujours
  });

  it("un second doigt à gauche est ignoré (un seul doigt dirige)", () => {
    const p = pad();
    p.down(1, 100, 200);
    p.move(1, 150, 200);
    const before = p.axes().steer;
    p.down(2, 200, 200);
    p.move(2, 50, 200);
    expect(p.axes().steer).toBe(before);
    p.up(2);
    expect(p.axes().steer).toBe(before);
  });

  it("boutons ← → : plein braquage, et on peut glisser de l'un à l'autre sans lever le doigt", () => {
    const p = pad({ steerMode: "buttons" });
    p.down(1, 80, 200);
    expect(p.axes().steer).toBe(-1);
    p.move(1, 300, 200);
    expect(p.axes().steer).toBe(1);
    p.move(1, 700, 200); // sorti de sa famille de boutons : reste → (il ne devient pas un frein)
    expect(p.axes()).toMatchObject({ steer: 1, brake: 0 });
  });

  it("accélérateur manuel : gaz au quart droit, frein au troisième quart ; les deux ensemble sont permis", () => {
    const p = pad({ autoThrottle: false });
    p.down(1, 700, 200);
    expect(p.axes()).toMatchObject({ throttle: 1, brake: 0 });
    p.down(2, 500, 200);
    expect(p.axes()).toMatchObject({ throttle: 1, brake: 1 });
    p.up(1);
    expect(p.axes()).toMatchObject({ throttle: 0, brake: 1 });
  });

  it("instantané pour l'affichage : curseur de glissement, boutons enfoncés", () => {
    const p = pad();
    expect(p.snapshot()).toMatchObject({ steer: false, brake: false, drag: null });
    p.down(1, 100, 220);
    p.move(1, 140, 230);
    p.down(2, 600, 100);
    const s = p.snapshot();
    expect(s.drag).toEqual({ originX: 100, originY: 220, x: 140, y: 230 });
    expect(s.brake).toBe(true);
    p.releaseAll();
    expect(p.active).toBe(false);
    expect(p.touched).toBe(true);
  });

  it("mêmes commandes entières que le clavier et la manette : makeInput(axes) est quantifié, jamais −0", () => {
    const p = pad();
    p.down(1, 300, 200);
    p.move(1, 300 + 23, 200);
    const a = p.axes();
    const input = makeInput(a.steer, a.throttle, a.brake);
    expect(Number.isInteger(input.steer)).toBe(true);
    expect(input.throttle).toBe(64);
    expect(input.brake).toBe(0);
    const zero = makeInput(pad().axes().steer, 1, 0);
    expect(Object.is(zero.steer, 0)).toBe(true);
    const left = pad();
    left.down(1, 300, 200);
    left.move(1, 300 - 2, 200); // dans la zone morte : 0, pas −0
    expect(Object.is(makeInput(left.axes().steer, 1, 0).steer, 0)).toBe(true);
  });
});

describe("réglages", () => {
  it("valeurs par défaut quand rien n'est gardé ou que le texte est illisible", () => {
    expect(parseTouchSettings(null)).toEqual(DEFAULT_TOUCH_SETTINGS);
    expect(parseTouchSettings("pas du json")).toEqual(DEFAULT_TOUCH_SETTINGS);
    expect(parseTouchSettings("42")).toEqual(DEFAULT_TOUCH_SETTINGS);
  });

  it("relit ce qui est valide, borne les nombres, ignore le reste", () => {
    const s = parseTouchSettings(JSON.stringify({ steerMode: "buttons", sensitivity: 99, deadzone: -1, autoThrottle: false, vibration: "oui", inconnu: 1 }));
    expect(s).toEqual({ steerMode: "buttons", sensitivity: 2, deadzone: 0, autoThrottle: false, vibration: true });
    expect(parseTouchSettings(JSON.stringify({ steerMode: "volant", sensitivity: "x" }))).toEqual(DEFAULT_TOUCH_SETTINGS);
  });
});

describe("vibration au choc", () => {
  it("un choc est une chute de vitesse brutale en un pas ; le freinage à fond n'en est pas un", () => {
    const hardBraking = 40 / 120; // 40 m/s² pendant un pas
    expect(impactFelt(30, 30 - hardBraking)).toBe(false);
    expect(impactFelt(30, 30 - IMPACT_DROP - 0.01)).toBe(true);
    expect(impactFelt(30, 31)).toBe(false); // accélération
  });
});
