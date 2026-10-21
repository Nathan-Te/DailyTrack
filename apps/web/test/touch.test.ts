import { describe, expect, it } from "vitest";
import { makeInput } from "@cdj/sim";
import {
  DEFAULT_TOUCH_SETTINGS,
  FULL_LOCK_PX,
  IMPACT_DROP,
  CENTER_FREE,
  EDGE_MARGIN_PX,
  MIN_BUTTON_PX,
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
  type Geometry,
  type Insets,
  type TouchSettings,
} from "../src/touch";

const settings = (patch: Partial<TouchSettings> = {}): TouchSettings => ({ ...DEFAULT_TOUCH_SETTINGS, ...patch });
const W = 800;
const H = 380;
const geo = (width = W, height = H, insets: Insets = { left: 0, right: 0, top: 0, bottom: 0 }): Geometry => ({ width, height, insets });
// Les tests de doigts partent du glissement et de l'accélérateur automatique (les anciens défauts) ; les boutons (défaut depuis la retouche 2 du lot I4) et les deux
// pédales (défaut depuis la 18b) ont leurs propres tests.
const pad = (patch: Partial<TouchSettings> = {}) => {
  const p = new TouchPad(settings({ steerMode: "drag", autoThrottle: true, ...patch }));
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
  it("glisser + accélérateur automatique : moitié gauche = direction, un seul grand frein à droite, rien au milieu", () => {
    const s = settings({ steerMode: "drag", autoThrottle: true });
    expect(zoneAt(10, W, s, geo())).toBe("steer");
    expect(zoneAt(399, W, s, geo())).toBe("steer"); // les zones du glisser (moitié gauche) sont celles du lot 10
    expect(zoneAt(430, W, s, geo())).toBeNull();
    expect(zoneAt(700, W, s, geo())).toBe("brake");
    expect(zoneAt(799, W, s, geo())).toBe("brake");
  });

  it("boutons + deux pédales : ← → à gauche, frein gaz à droite, rien au milieu", () => {
    const s = settings({ steerMode: "buttons", autoThrottle: false });
    const at = (zone: string) => centerOf(zone, s).x;
    expect(["left", "right", "brake", "gas"].map((z) => zoneAt(at(z), W, s, geo()))).toEqual(["left", "right", "brake", "gas"]);
    expect(zoneAt(W * 0.5, W, s, geo())).toBeNull();
  });
});

describe("zones actives et boutons dessinés (10b, refaits à la retouche 2 du lot I4)", () => {
  const combos = [false, true].flatMap((autoThrottle) => (["drag", "buttons"] as const).map((steerMode) => settings({ autoThrottle, steerMode })));
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
        expect(spans[0]!.x0).toBe(0); // le groupe de gauche part du bord
        expect(spans[spans.length - 1]!.x1).toBe(1); // celui de droite va jusqu'au bord
        for (let i = 1; i < spans.length; i++) expect(spans[i]!.x0).toBeGreaterThanOrEqual(spans[i - 1]!.x1); // pas de recouvrement
        // à l'intérieur d'un groupe, les tranches se touchent (← | →, frein | gaz)
        for (const [a, b] of [["left", "right"], ["brake", "gas"]] as const) {
          const sa = spans.find((q) => q.zone === a);
          const sb = spans.find((q) => q.zone === b);
          if (sa && sb) expect(sb.x0).toBe(sa.x1);
        }
        // le milieu : aucune zone dans [40 %, 60 %] de la largeur, sauf le glisser dont la zone de direction va jusqu'à 50 % (lot 10)
        for (let x = Math.round(w * 0.52); x <= Math.round(w * 0.6); x++) expect(zoneAt(x, w, s, geo(w, h, insets)), `${s.steerMode} ${w}×${h} x=${x}`).toBeNull();
        if (s.steerMode === "buttons") for (let x = Math.round(w * 0.36); x <= Math.round(w * 0.64); x++) expect(zoneAt(x, w, s, geo(w, h, insets))).toBeNull();
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

  it("le mode glisser garde sa zone de direction du lot 10 : la moitié gauche, de bord à milieu", () => {
    const spans = zoneSpans(settings({ steerMode: "drag", autoThrottle: false }), geo());
    expect(spans[0]).toEqual({ zone: "steer", x0: 0, x1: 0.5 });
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

  it("accélérateur manuel : gaz sur son bouton, frein sur le sien ; les deux ensemble sont permis", () => {
    const p = pad({ autoThrottle: false });
    tap(p, 1, "gas");
    expect(p.axes()).toMatchObject({ throttle: 1, brake: 0 });
    tap(p, 2, "brake");
    expect(p.axes()).toMatchObject({ throttle: 1, brake: 1 });
    p.up(1);
    expect(p.axes()).toMatchObject({ throttle: 0, brake: 1 });
  });

  it("instantané pour l'affichage : curseur de glissement, boutons enfoncés", () => {
    const p = pad();
    expect(p.snapshot()).toMatchObject({ steer: false, brake: false, drag: null });
    p.down(1, 100, 220);
    p.move(1, 140, 230);
    p.down(2, 700, 100);
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
