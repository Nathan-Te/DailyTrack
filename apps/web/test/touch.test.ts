import { describe, expect, it } from "vitest";
import { makeInput } from "@cdj/sim";
import {
  DEFAULT_TOUCH_SETTINGS,
  IMPACT_DROP,
  CENTER_FREE,
  EDGE_MARGIN_PX,
  MIN_BUTTON_PX,
  TouchPad,
  buttonRects,
  impactFelt,
  loadTouchSettings,
  parseTouchSettings,
  saveTouchSettings,
  TOUCH_SETTINGS_VERSION,
  wantsTouch,
  zoneAt,
  zoneSpans,
  type Geometry,
  type Insets,
  type TouchSettings,
} from "../src/touch";

const settings = (patch: Partial<TouchSettings> = {}): TouchSettings => ({ ...DEFAULT_TOUCH_SETTINGS, ...patch });
const W = 800;
const H = 380;
const geo = (width = W, height = H, insets: Insets = { left: 0, right: 0, top: 0, bottom: 0 }): Geometry => ({ width, height, insets });
// Les tests de doigts partent des boutons et de l'accélérateur automatique ; les deux pédales (défaut depuis la 18b) ont leurs propres tests ; la glissière, le volant et le
// gyroscope (lot 52) ont les leurs : `steerSlider.test.ts`, `steerWheel.test.ts`, `steerGyro.test.ts`.
const pad = (patch: Partial<TouchSettings> = {}) => {
  const p = new TouchPad(settings({ steerMode: "buttons", autoThrottle: true, ...patch }));
  p.setGeometry(W, H);
  return p;
};
/** Le centre du bouton dessiné d'une zone (là où tombe un pouce). */
const centerOf = (zone: string, s: TouchSettings, g: Geometry = geo()) => {
  const r = buttonRects(g.width, g.height, s, g.insets).find((q) => q.zone === zone)!;
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
};
/** Un pad en mode boutons dont les doigts tombent sur le centre des boutons. */
const tap = (p: TouchPad, id: number, zone: string) => {
  const c = centerOf(zone, p.settings, p.geometry);
  p.down(id, c.x, c.y);
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

describe("zones", () => {
  it("glissière + accélérateur automatique : le tiers gauche = direction, un seul grand frein à droite, rien au milieu", () => {
    const s = settings({ steerMode: "slider", autoThrottle: true });
    expect(zoneAt(10, W, s, geo())).toBe("steer");
    expect(zoneAt(W * CENTER_FREE.x0 - 1, W, s, geo())).toBe("steer"); // la zone de la glissière va jusqu'à 30 % de la largeur (maquette du lot 52)
    expect(zoneAt(W * 0.35, W, s, geo())).toBeNull();
    expect(zoneAt(700, W, s, geo())).toBe("brake");
    expect(zoneAt(799, W, s, geo())).toBe("brake");
  });

  it("disposition inversée : la direction à droite (de 70 % à 100 %), les pédales à gauche, ← toujours à gauche de →", () => {
    const g = geo();
    const slider = settings({ steerMode: "slider", autoThrottle: false, mirrored: true });
    expect(zoneAt(W - 10, W, slider, g)).toBe("steer");
    expect(zoneAt(W * (1 - CENTER_FREE.x0) + 1, W, slider, g)).toBe("steer");
    expect(zoneAt(W * 0.65, W, slider, g)).toBeNull();
    const at = (z: string, s: TouchSettings) => centerOf(z, s, g).x;
    expect(at("gas", slider)).toBeLessThan(at("brake", slider)); // le gaz au bord, le frein à côté : l'image dans un miroir
    expect(at("brake", slider)).toBeLessThan(W * CENTER_FREE.x0);
    const arrows = settings({ steerMode: "buttons", autoThrottle: false, mirrored: true });
    expect(["left", "right", "gas", "brake"].map((z) => zoneAt(at(z, arrows), W, arrows, g))).toEqual(["left", "right", "gas", "brake"]);
    expect(at("left", arrows)).toBeLessThan(at("right", arrows));
    expect(at("left", arrows)).toBeGreaterThan(W * CENTER_FREE.x1);
  });

  it("gyroscope : le frein sous le pouce gauche, le gaz sous le droit (inversé : le gaz à gauche, le frein à droite), pas de commande de direction", () => {
    const g = geo();
    const rects = (m: boolean, auto = false) => buttonRects(W, H, settings({ steerMode: "gyro", autoThrottle: auto, mirrored: m }), g.insets);
    expect(rects(false).map((r) => r.zone)).toEqual(["brake", "gas"]);
    expect(rects(false)[0]!.x).toBe(EDGE_MARGIN_PX);
    expect(rects(false)[1]!.x + rects(false)[1]!.w).toBe(W - EDGE_MARGIN_PX);
    expect(rects(true)[0]!.x).toBeGreaterThan(W * CENTER_FREE.x1); // le frein à droite
    expect(rects(true)[1]!.x).toBe(EDGE_MARGIN_PX); // le gaz à gauche
    expect(rects(false, true).map((r) => r.zone)).toEqual(["brake"]); // accélérateur automatique : un seul grand frein, sous le pouce gauche
    expect(zoneAt(40, W, settings({ steerMode: "gyro" }), g)).toBe("brake");
    expect(zoneAt(W - 40, W, settings({ steerMode: "gyro" }), g)).toBe("gas");
  });

  it("boutons + deux pédales : ← → à gauche, frein gaz à droite, rien au milieu", () => {
    const s = settings({ steerMode: "buttons", autoThrottle: false });
    const at = (zone: string) => centerOf(zone, s).x;
    expect(["left", "right", "brake", "gas"].map((z) => zoneAt(at(z), W, s, geo()))).toEqual(["left", "right", "brake", "gas"]);
    expect(zoneAt(W * 0.5, W, s, geo())).toBeNull();
  });
});

describe("zones actives et boutons dessinés (10b, refaits à la retouche 2 du lot I4)", () => {
  const combos = [false, true].flatMap((autoThrottle) => [false, true].flatMap((mirrored) => (["slider", "wheel", "gyro", "buttons"] as const).map((steerMode) => settings({ autoThrottle, steerMode, mirrored }))));
  const SCREENS: [number, number, Insets][] = [
    [844, 390, { left: 0, right: 0, top: 0, bottom: 0 }],
    [740, 360, { left: 0, right: 0, top: 0, bottom: 0 }],
    [667, 375, { left: 0, right: 0, top: 0, bottom: 0 }],
    [851, 393, { left: 0, right: 0, top: 0, bottom: 0 }],
    [844, 390, { left: 44, right: 44, top: 0, bottom: 21 }],
    [740, 360, { left: 44, right: 44, top: 0, bottom: 21 }],
    [667, 375, { left: 47, right: 47, top: 0, bottom: 21 }],
  ];

  it("les zones vont de bord à bord, sans recouvrement ; sans trou dans un groupe ; le milieu de l'écran n'en a aucune", () => {
    for (const s of combos) {
      for (const [w, h, insets] of SCREENS) {
        const spans = zoneSpans(s, geo(w, h, insets));
        if (!(s.steerMode === "gyro" && s.autoThrottle)) {
          // (gyroscope + accélérateur automatique : un seul grand frein, d'un seul côté ; l'autre bord n'a aucune commande)
          expect(spans[0]!.x0).toBe(0); // le groupe de gauche part du bord
          expect(spans[spans.length - 1]!.x1).toBe(1); // celui de droite va jusqu'au bord
        }
        for (let i = 1; i < spans.length; i++) expect(spans[i]!.x0).toBeGreaterThanOrEqual(spans[i - 1]!.x1); // pas de recouvrement
        // à l'intérieur d'un groupe, les tranches se touchent (← | →, frein | gaz)
        for (const [a, b] of [["left", "right"], ["brake", "gas"], ["gas", "brake"]] as const) {
          const sa = spans.find((q) => q.zone === a);
          const sb = spans.find((q) => q.zone === b);
          if (sa && sb && s.steerMode !== "gyro" && sa.x1 <= sb.x0 + 1e-9 && sb.x0 - sa.x1 < 0.02) expect(sb.x0).toBe(sa.x1);
        }
        // le milieu : aucune zone dans [36 %, 64 %] de la largeur (lot 52 : la zone de la glissière et du volant s'arrête à 30 %)
        for (let x = Math.round(w * 0.36); x <= Math.round(w * 0.64); x++) expect(zoneAt(x, w, s, geo(w, h, insets)), `${s.steerMode} ${w}×${h} x=${x}`).toBeNull();
      }
    }
  });

  it("chaque bouton dessiné est dans sa zone active, dans l'écran, dans les zones sûres, à 44 px au moins de côté, hors du centre libre", () => {
    for (const [w, h, insets] of SCREENS) {
      for (const s of combos) {
        for (const size of ["small", "medium", "large"] as const) {
          const st = { ...s, buttonSize: size };
          const g = geo(w, h, insets);
          const spans = zoneSpans(st, g);
          for (const r of buttonRects(w, h, st, insets)) {
            const label = `${w}×${h} ${JSON.stringify(insets)} ${s.steerMode}/${s.autoThrottle ? "auto" : "pédales"}/${size} ${r.zone}`;
            const sp = spans.find((q) => q.zone === r.zone)!;
            expect(r.x, label).toBeGreaterThanOrEqual(sp.x0 * w - 0.5);
            expect(r.x + r.w, label).toBeLessThanOrEqual(sp.x1 * w + 0.5);
            // dans l'écran et dans les zones sûres, avec la marge des bords
            expect(r.x, label).toBeGreaterThanOrEqual(insets.left + EDGE_MARGIN_PX);
            expect(r.x + r.w, label).toBeLessThanOrEqual(w - insets.right - EDGE_MARGIN_PX);
            expect(r.y + r.h, label).toBeLessThanOrEqual(h - insets.bottom - EDGE_MARGIN_PX + 0.5);
            expect(r.y, label).toBeGreaterThan(0);
            // au moins 44 px de côté, quelle que soit la taille
            expect(r.w, label).toBeGreaterThanOrEqual(MIN_BUTTON_PX);
            expect(r.h, label).toBeGreaterThanOrEqual(MIN_BUTTON_PX);
            // jamais devant la voiture : le rectangle central (x de 32 % à 68 %, y de 20 % à 88 %) reste libre
            const inCentre = r.x < w * 0.68 && r.x + r.w > w * 0.32 && r.y < h * 0.88 && r.y + r.h > h * 0.2;
            expect(inCentre, `${label} dans le rectangle central`).toBe(false);
            expect(r.x + r.w <= w * CENTER_FREE.x0 + 0.5 || r.x >= w * CENTER_FREE.x1 - 0.5, `${label} dans le tiers central`).toBe(true);
            // toucher le centre du bouton (et ses coins, rentrés de 4 px) = sa commande
            for (const [px, py] of [[r.x + r.w / 2, r.y + r.h / 2], [r.x + 4, r.y + 4], [r.x + r.w - 4, r.y + r.h - 4]] as const) {
              void py;
              expect(zoneAt(px, w, st, g), `${label} touché en x=${Math.round(px)}`).toBe(r.zone);
            }
          }
        }
      }
    }
  });

  it("par défaut, les boutons : ← → en bas à gauche, frein et gaz en bas à droite (maquette track-hud-paysage)", () => {
    expect(DEFAULT_TOUCH_SETTINGS.steerMode).toBe("buttons");
    const r = Object.fromEntries(buttonRects(844, 390, settings(), { left: 0, right: 0, top: 0, bottom: 0 }).map((b) => [b.zone, b]));
    expect([r.left!.w, r.left!.h, r.right!.w, r.gas!.w, r.gas!.h, r.brake!.w, r.brake!.h]).toEqual([72, 72, 72, 84, 84, 64, 56]); // taille « normale » : celle de la maquette
    expect(r.left!.x).toBe(EDGE_MARGIN_PX);
    expect(r.right!.x - (r.left!.x + r.left!.w)).toBe(8);
    expect(r.gas!.x + r.gas!.w).toBe(844 - EDGE_MARGIN_PX);
    for (const b of Object.values(r)) expect(b.y + b.h).toBe(390 - EDGE_MARGIN_PX);
    // accélérateur automatique : un seul grand frein à droite
    const auto = buttonRects(844, 390, settings({ autoThrottle: true }));
    expect(auto.map((b) => b.zone)).toEqual(["left", "right", "brake"]);
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

  it("la glissière et le volant : la zone de direction est le tiers du bord ; la commande dessinée est dedans, jamais plus large que 30 % de l'écran", () => {
    for (const steerMode of ["slider", "wheel"] as const) {
      expect(zoneSpans(settings({ steerMode, autoThrottle: false }), geo())[0]).toEqual({ zone: "steer", x0: 0, x1: CENTER_FREE.x0 });
      expect(zoneSpans(settings({ steerMode, mirrored: true }), geo()).at(-1)).toEqual({ zone: "steer", x0: 1 - CENTER_FREE.x0, x1: 1 });
    }
    const slider = buttonRects(844, 390, settings({ steerMode: "slider" }), { left: 0, right: 0, top: 0, bottom: 0 }).find((r) => r.zone === "steer")!;
    expect([slider.w, slider.h]).toEqual([236, 64]); // taille « normale » : la maquette
    const wheel = buttonRects(844, 390, settings({ steerMode: "wheel" }), { left: 0, right: 0, top: 0, bottom: 0 }).find((r) => r.zone === "steer")!;
    expect([wheel.w, wheel.h]).toEqual([140, 140]);
    const taille = (steerMode: "slider" | "wheel", size: "small" | "medium" | "large") => buttonRects(844, 390, settings({ steerMode, buttonSize: size }), { left: 0, right: 0, top: 0, bottom: 0 }).find((r) => r.zone === "steer")!;
    expect(taille("wheel", "small").w).toBe(101);
    expect(taille("wheel", "large").w).toBe(182);
    expect([taille("slider", "small").w, taille("slider", "small").h]).toEqual([170, 46]);
    expect([taille("slider", "large").w, taille("slider", "large").h]).toEqual([239, 83]); // la largeur est plafonnée à 30 % de l'écran moins la marge
  });

  it("un toucher au milieu de l'écran est ignoré (le centre reste libre)", () => {
    const p = pad({ steerMode: "buttons", autoThrottle: false });
    p.down(1, W * 0.5, 200);
    expect(p.active).toBe(false);
    expect(p.axes()).toEqual({ steer: 0, throttle: 0, brake: 0 });
    expect(p.touched).toBe(true); // c'est tout de même un appui (la première aide s'efface)
  });

  it("glisser de ← à → sans lever le doigt change la direction ; de frein à gaz aussi", () => {
    const p = pad({ steerMode: "buttons", autoThrottle: false });
    tap(p, 1, "left");
    expect(p.axes().steer).toBe(-1);
    const r = centerOf("right", p.settings, p.geometry);
    p.move(1, r.x, r.y);
    expect(p.axes().steer).toBe(1);
    p.move(1, W * 0.45, r.y); // sorti de sa famille de boutons : reste → (il ne devient pas un frein)
    expect(p.axes().steer).toBe(1);
    p.up(1);
    tap(p, 2, "brake");
    expect(p.axes()).toMatchObject({ brake: 1, throttle: 0 });
    const g = centerOf("gas", p.settings, p.geometry);
    p.move(2, g.x, g.y);
    expect(p.axes()).toMatchObject({ brake: 0, throttle: 1 });
  });

  it("diriger et accélérer / freiner en même temps (deux doigts)", () => {
    const p = pad({ steerMode: "buttons", autoThrottle: false });
    tap(p, 1, "left");
    tap(p, 2, "gas");
    expect(p.axes()).toEqual({ steer: -1, throttle: 1, brake: 0 });
  });
});

describe("doigts", () => {
  it("sans doigt : plein gaz, tout droit, pas de frein (accélérateur automatique)", () => {
    expect(pad().axes()).toEqual({ steer: 0, throttle: 1, brake: 0 });
    expect(pad({ autoThrottle: false }).axes()).toEqual({ steer: 0, throttle: 0, brake: 0 });
  });

  it("multi-doigts : on dirige et on freine en même temps ; l'accélérateur automatique se coupe au frein", () => {
    const p = pad();
    tap(p, 1, "right");
    tap(p, 2, "brake");
    const a = p.axes();
    expect(a.steer).toBe(1);
    expect(a.brake).toBe(1);
    expect(a.throttle).toBe(0);
    p.up(2);
    expect(p.axes()).toMatchObject({ brake: 0, throttle: 1 });
    expect(p.axes().steer).toBe(1); // le premier doigt tient toujours
  });

  it("un second doigt sur les flèches est ignoré (un seul doigt dirige)", () => {
    const p = pad();
    tap(p, 1, "left");
    tap(p, 2, "right");
    expect(p.axes().steer).toBe(-1);
    const r = centerOf("left", p.settings, p.geometry);
    p.move(2, r.x, r.y);
    p.up(2);
    expect(p.axes().steer).toBe(-1);
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

  it("accélérateur manuel : gaz sur son bouton, frein sur le sien ; les deux ensemble sont permis", () => {
    const p = pad({ autoThrottle: false });
    tap(p, 1, "gas");
    expect(p.axes()).toMatchObject({ throttle: 1, brake: 0 });
    tap(p, 2, "brake");
    expect(p.axes()).toMatchObject({ throttle: 1, brake: 1 });
    p.up(1);
    expect(p.axes()).toMatchObject({ throttle: 0, brake: 1 });
  });

  it("instantané pour l'affichage : boutons enfoncés", () => {
    const p = pad();
    expect(p.snapshot()).toMatchObject({ left: false, brake: false });
    tap(p, 1, "left");
    tap(p, 2, "brake");
    const s = p.snapshot();
    expect(s).toMatchObject({ left: true, brake: true, gas: false });
    p.releaseAll();
    expect(p.active).toBe(false);
    expect(p.touched).toBe(true);
  });

  it("mêmes commandes entières que le clavier et la manette : makeInput(axes) est quantifié, jamais −0", () => {
    const p = pad();
    tap(p, 1, "right");
    const a = p.axes();
    const input = makeInput(a.steer, a.throttle, a.brake);
    expect(input.steer).toBe(64);
    expect(Number.isInteger(input.steer)).toBe(true);
    expect(input.throttle).toBe(64);
    expect(input.brake).toBe(0);
    const zero = makeInput(pad().axes().steer, 1, 0);
    expect(Object.is(zero.steer, 0)).toBe(true);
  });

  it("lot 52 : une direction chargée à la demande donne la direction ; sans elle, ces modes ne tournent pas ; elle reçoit les doigts de sa zone et eux seuls", () => {
    const p = pad({ steerMode: "slider" });
    p.down(1, 100, 200); // sans module chargé : un doigt dans la zone de direction ne fait rien
    expect(p.axes().steer).toBe(0);
    p.up(1);
    const log: string[] = [];
    let valeur = 0.5;
    p.steerer = { steer: () => valeur, down: (id) => log.push(`down${id}`), move: (id) => log.push(`move${id}`), up: (id) => log.push(`up${id}`), release: () => log.push("release"), begin: () => log.push("begin"), go: () => log.push("go") };
    p.down(1, 100, 200);
    p.down(2, 150, 200); // un seul doigt dirige
    p.move(1, 110, 200);
    expect(p.axes().steer).toBe(0.5);
    tap(p, 3, "brake");
    p.move(3, 700, 100); // un doigt de pédale ne va pas à la direction
    p.up(1);
    valeur = -2;
    expect(p.axes().steer).toBe(-1); // bornée
    p.begin();
    p.go();
    p.releaseAll();
    expect(log).toEqual(["down1", "move1", "up1", "begin", "go", "release"]);
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
    expect(s).toEqual({ ...DEFAULT_TOUCH_SETTINGS, steerMode: "buttons", sensitivity: 2, deadzone: 0, autoThrottle: false, vibration: true, buttonSize: "medium" });
    expect(parseTouchSettings(JSON.stringify({ steerMode: "volant", sensitivity: "x" }))).toEqual(DEFAULT_TOUCH_SETTINGS);
  });

  it("lot 52 : un ancien choix « joystick » (drag) devient « glissière », avec sa sensibilité et sa zone morte ; les trois autres modes sont relus", () => {
    const ancien = parseTouchSettings(JSON.stringify({ steerMode: "drag", sensitivity: 1.5, deadzone: 0.12, autoThrottle: true, version: TOUCH_SETTINGS_VERSION }));
    expect(ancien).toMatchObject({ steerMode: "slider", sensitivity: 1.5, deadzone: 0.12, autoThrottle: true });
    for (const mode of ["buttons", "slider", "wheel", "gyro"] as const) expect(parseTouchSettings(JSON.stringify({ steerMode: mode })).steerMode).toBe(mode);
    expect(parseTouchSettings(JSON.stringify({ steerMode: "joystick" })).steerMode).toBe("buttons"); // inconnu : le défaut
  });

  it("lot 52 : les réglages du volant, du gyroscope et de la disposition sont relus et bornés", () => {
    const s = parseTouchSettings(JSON.stringify({ wheelAngle: 135, wheelDeadzone: 9, gyroSensitivity: 0.1, gyroDeadzone: 0.2, gyroGauge: false, mirrored: true }));
    expect(s).toMatchObject({ wheelAngle: 135, wheelDeadzone: 0.3, gyroSensitivity: 0.5, gyroDeadzone: 0.2, gyroGauge: false, mirrored: true });
    expect(parseTouchSettings(JSON.stringify({ wheelAngle: 100 })).wheelAngle).toBe(90); // 90° ou 135° seulement
    expect(DEFAULT_TOUCH_SETTINGS).toMatchObject({ wheelAngle: 90, wheelDeadzone: 0.06, gyroSensitivity: 1, gyroDeadzone: 0.05, gyroGauge: true, mirrored: false });
  });
});

describe("deux pédales par défaut (retouche 18b)", () => {
  it("le défaut est l'accélérateur manuel : gaz et frein à droite, rien sans doigt", () => {
    expect(DEFAULT_TOUCH_SETTINGS.autoThrottle).toBe(false);
    expect(DEFAULT_TOUCH_SETTINGS.steerMode).toBe("buttons"); // retouche 2 du lot I4 : les boutons, plus le joystick
    const p = new TouchPad({ ...DEFAULT_TOUCH_SETTINGS });
    p.setGeometry(W, H);
    expect(p.axes()).toEqual({ steer: 0, throttle: 0, brake: 0 });
    tap(p, 1, "gas"); // le bouton GAZ, tout à droite
    expect(p.axes()).toMatchObject({ throttle: 1, brake: 0 });
    tap(p, 2, "brake"); // le bouton FREIN, à sa gauche
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
