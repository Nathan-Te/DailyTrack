import { describe, expect, it } from "vitest";
import { makeInput } from "@cdj/sim";
import {
  DEFAULT_TOUCH_SETTINGS,
  FULL_LOCK_PX,
  IMPACT_DROP,
  GESTURE_MARGIN_PX,
  TouchPad,
  buttonRects,
  dragSteer,
  impactFelt,
  loadTouchSettings,
  parseTouchSettings,
  saveTouchSettings,
  TOUCH_SETTINGS_VERSION,
  wantsTouch,
  zoneAt,
  zoneSpans,
  type TouchSettings,
} from "../src/touch";

const settings = (patch: Partial<TouchSettings> = {}): TouchSettings => ({ ...DEFAULT_TOUCH_SETTINGS, ...patch });
const W = 800;
// Les tests de doigts partent de l'accélérateur automatique (l'ancien défaut) ; les deux pédales, défaut depuis la 18b, ont leurs propres tests.
const pad = (patch: Partial<TouchSettings> = {}) => {
  const p = new TouchPad(settings({ autoThrottle: true, ...patch }));
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
    const s = settings({ autoThrottle: true });
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

describe("zones actives et boutons dessinés (10b)", () => {
  const combos = [false, true].flatMap((autoThrottle) => (["drag", "buttons"] as const).map((steerMode) => settings({ autoThrottle, steerMode })));

  it("les zones couvrent l'écran de bord à bord, sans trou ni recouvrement", () => {
    for (const s of combos) {
      const spans = zoneSpans(s);
      expect(spans[0]!.x0).toBe(0);
      expect(spans[spans.length - 1]!.x1).toBe(1);
      for (let i = 1; i < spans.length; i++) expect(spans[i]!.x0).toBe(spans[i - 1]!.x1);
      // chaque pixel (bords compris) tombe dans une zone, et zoneAt en est cohérent
      for (let x = 0; x <= W; x++) {
        const f = x / W;
        const expected = spans.find((sp) => f < sp.x1) ?? spans[spans.length - 1]!;
        expect(zoneAt(x, W, s)).toBe(expected.zone);
      }
    }
  });

  it("chaque bouton dessiné est dans sa zone active et loin des bords (zones sûres + gestes système)", () => {
    const insets = { left: 47, right: 47, top: 0, bottom: 21 };
    for (const [w, h] of [[844, 390], [851, 393], [667, 375]] as const) {
      for (const s of combos) {
        for (const size of ["small", "medium", "large"] as const) {
          const spans = zoneSpans(s);
          for (const r of buttonRects(w, h, { ...s, buttonSize: size }, insets)) {
            const sp = spans.find((q) => q.zone === r.zone)!;
            expect(r.x).toBeGreaterThanOrEqual(sp.x0 * w);
            expect(r.x + r.w).toBeLessThanOrEqual(sp.x1 * w);
            expect(r.x).toBeGreaterThanOrEqual(insets.left + GESTURE_MARGIN_PX);
            expect(r.x + r.w).toBeLessThanOrEqual(w - insets.right - GESTURE_MARGIN_PX);
            expect(r.y + r.h).toBeLessThanOrEqual(h - insets.bottom);
            expect(r.y).toBeGreaterThan(0);
            // le centre du bouton tombe dans la bonne zone
            expect(zoneAt(r.x + r.w / 2, w, s)).toBe(r.zone);
          }
        }
      }
    }
  });

  it("la taille change le visuel : petits < moyens < grands", () => {
    const s = settings({ steerMode: "buttons" });
    const w = (size: "small" | "medium" | "large") => buttonRects(844, 390, { ...s, buttonSize: size })[0]!.w;
    expect(w("small")).toBeLessThan(w("medium"));
    expect(w("medium")).toBeLessThan(w("large"));
  });

  it("la taille est mémorisée ; valeur inconnue : moyenne", () => {
    expect(parseTouchSettings('{"buttonSize":"large"}').buttonSize).toBe("large");
    expect(parseTouchSettings('{"buttonSize":"énorme"}').buttonSize).toBe("medium");
  });

  it("glisser de ← à → sans lever le doigt change la direction ; de frein à gaz aussi", () => {
    const p = pad({ steerMode: "buttons", autoThrottle: false });
    p.down(1, 100, 300);
    expect(p.axes().steer).toBe(-1);
    p.move(1, 300, 300);
    expect(p.axes().steer).toBe(1);
    p.move(1, 395, 300);
    expect(p.axes().steer).toBe(1);
    p.up(1);
    p.down(2, 450, 300);
    expect(p.axes()).toMatchObject({ brake: 1, throttle: 0 });
    p.move(2, 700, 300);
    expect(p.axes()).toMatchObject({ brake: 0, throttle: 1 });
  });

  it("diriger et accélérer / freiner en même temps (deux doigts)", () => {
    const p = pad({ steerMode: "buttons", autoThrottle: false });
    p.down(1, 100, 300);
    p.down(2, 780, 300);
    expect(p.axes()).toEqual({ steer: -1, throttle: 1, brake: 0 });
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
    expect(s).toEqual({ steerMode: "buttons", sensitivity: 2, deadzone: 0, autoThrottle: false, vibration: true, buttonSize: "medium" });
    expect(parseTouchSettings(JSON.stringify({ steerMode: "volant", sensitivity: "x" }))).toEqual(DEFAULT_TOUCH_SETTINGS);
  });
});

describe("deux pédales par défaut (retouche 18b)", () => {
  it("le défaut est l'accélérateur manuel : gaz et frein à droite, rien sans doigt", () => {
    expect(DEFAULT_TOUCH_SETTINGS.autoThrottle).toBe(false);
    const p = new TouchPad({ ...DEFAULT_TOUCH_SETTINGS });
    p.width = W;
    expect(p.axes()).toEqual({ steer: 0, throttle: 0, brake: 0 });
    p.down(1, 700, 200); // dernier quart = gaz
    expect(p.axes()).toMatchObject({ throttle: 1, brake: 0 });
    p.down(2, 450, 200); // troisième quart = frein
    expect(p.axes()).toMatchObject({ throttle: 1, brake: 1 });
  });

  it("un réglage enregistré avant la version 2 retrouve une fois le nouveau défaut ; un choix fait depuis est gardé", () => {
    const old = parseTouchSettings(JSON.stringify({ steerMode: "buttons", sensitivity: 1.5, autoThrottle: true }));
    expect(old.autoThrottle).toBe(false);
    expect(old.steerMode).toBe("buttons"); // le reste est conservé
    expect(old.sensitivity).toBe(1.5);
    // Le joueur repasse en automatique : la sauvegarde porte la version, le choix tient.
    const chosen = parseTouchSettings(JSON.stringify({ autoThrottle: true, version: TOUCH_SETTINGS_VERSION }));
    expect(chosen.autoThrottle).toBe(true);
    // Un réglage d'une version future inconnue n'est pas pris pour acquis.
    expect(parseTouchSettings(JSON.stringify({ autoThrottle: true, version: TOUCH_SETTINGS_VERSION + 1 })).autoThrottle).toBe(false);
  });

  it("l'enregistrement porte la version (le choix du joueur survit au rechargement)", () => {
    const store = new Map<string, string>();
    const real = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    try {
      saveTouchSettings({ ...DEFAULT_TOUCH_SETTINGS, autoThrottle: true });
      expect(loadTouchSettings().autoThrottle).toBe(true);
      saveTouchSettings({ ...DEFAULT_TOUCH_SETTINGS, autoThrottle: false });
      expect(loadTouchSettings().autoThrottle).toBe(false);
    } finally {
      (globalThis as { localStorage?: unknown }).localStorage = real;
    }
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
