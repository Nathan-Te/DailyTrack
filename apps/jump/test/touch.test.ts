import { INPUT_JUMP, INPUT_LEFT, INPUT_RIGHT } from "@cdj/jump-sim";
import { describe, expect, it } from "vitest";
import { VIEW_MIN_WIDTH_TILES, VIEW_TILES_DESKTOP, VIEW_TILES_PHONE, viewHeightTiles } from "../src/camera";
import { Controls } from "../src/input";
import {
  BAND_PX,
  BUTTON_GAP_PX,
  MIN_TARGET_PX,
  TouchPad,
  ZONE_SPANS,
  buttonRects,
  directionAt,
  layoutFor,
  wantsTouch,
  zoneAt,
  type Insets,
} from "../src/touch";

// Commandes tactiles (lot 1b) : logique pure, sans DOM.

/** Téléphones de référence (pixels CSS) : petit, courant, grand, tablette ; paysage et portrait. */
const SCREENS = [
  [320, 568],
  [360, 640],
  [390, 844],
  [412, 915],
  [568, 320],
  [640, 360],
  [844, 390],
  [915, 412],
  [1024, 768],
] as const;
const NOTCH: Insets = { top: 47, bottom: 34, left: 0, right: 0 };
const NOTCH_LANDSCAPE: Insets = { top: 0, bottom: 21, left: 47, right: 47 };

describe("zones", () => {
  it("les tranches se touchent : de 0 à 1, sans trou ni recouvrement", () => {
    expect(ZONE_SPANS[0]!.x0).toBe(0);
    expect(ZONE_SPANS.at(-1)!.x1).toBe(1);
    for (let i = 1; i < ZONE_SPANS.length; i++) expect(ZONE_SPANS[i]!.x0).toBe(ZONE_SPANS[i - 1]!.x1);
    expect(ZONE_SPANS.map((s) => s.zone)).toEqual(["left", "right", "jump"]);
  });

  it.each(SCREENS)("%i × %i : chaque point de l'écran est dans une et une seule zone, sans trou, bande haute exclue", (w, h) => {
    const l = layoutFor(w, h);
    for (let x = -3; x <= w + 3; x += 1) {
      for (const y of [l.band, l.band + 1, Math.round(h / 2), h - 1, h + 3]) {
        const z = zoneAt(l, x, y);
        expect(["left", "right", "jump"], `(${x}, ${y})`).toContain(z);
      }
      for (const y of [-2, 0, 1, l.band - 1]) expect(zoneAt(l, x, y), `(${x}, ${y})`).toBe("band");
    }
    // Les frontières : ¼ et ½ de la largeur appartiennent à la zone de droite.
    expect(zoneAt(l, w / 4 - 0.01, h - 1)).toBe("left");
    expect(zoneAt(l, w / 4, h - 1)).toBe("right");
    expect(zoneAt(l, w / 2 - 0.01, h - 1)).toBe("right");
    expect(zoneAt(l, w / 2, h - 1)).toBe("jump");
    // Hors de l'écran : la zone du bord.
    expect(zoneAt(l, -50, h - 1)).toBe("left");
    expect(zoneAt(l, w + 50, h - 1)).toBe("jump");
  });

  it("la bande haute tient compte de la zone sûre (encoche)", () => {
    const l = layoutFor(390, 844, NOTCH);
    expect(l.band).toBe(BAND_PX + 47);
    expect(zoneAt(l, 50, l.band - 1)).toBe("band");
    expect(zoneAt(l, 50, l.band)).toBe("left");
  });

  it("un doigt de direction hors de la moitié gauche compte pour la zone la plus proche de cette moitié", () => {
    const l = layoutFor(800, 400);
    expect(directionAt(l, -40)).toBe(-1);
    expect(directionAt(l, 199)).toBe(-1);
    expect(directionAt(l, 200)).toBe(1);
    expect(directionAt(l, 399)).toBe(1);
    expect(directionAt(l, 700)).toBe(1); // dans la moitié du saut : toujours →
    expect(directionAt(l, 5000)).toBe(1);
  });
});

describe("boutons dessinés", () => {
  const cases: [number, number, Insets | undefined][] = [...SCREENS.map(([w, h]) => [w, h, undefined] as [number, number, undefined]), [390, 844, NOTCH], [844, 390, NOTCH_LANDSCAPE]];
  it.each(cases)("%i × %i : au moins 44 px, dans leur zone, écartés des frontières et des bords, sous la bande, sans se toucher", (w, h, insets) => {
    const l = layoutFor(w, h, insets);
    const rects = buttonRects(l);
    expect(rects.map((r) => r.zone)).toEqual(["left", "right", "jump"]);
    for (const r of rects) {
      const span = ZONE_SPANS.find((s) => s.zone === r.zone)!;
      expect(r.w, `${r.zone} largeur`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
      expect(r.h, `${r.zone} hauteur`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
      expect(r.x, `${r.zone} frontière gauche`).toBeGreaterThanOrEqual(span.x0 * w + BUTTON_GAP_PX);
      expect(r.x + r.w, `${r.zone} frontière droite`).toBeLessThanOrEqual(span.x1 * w - BUTTON_GAP_PX);
      expect(r.y, `${r.zone} sous la bande`).toBeGreaterThanOrEqual(l.band);
      expect(r.y + r.h, `${r.zone} dans l'écran`).toBeLessThanOrEqual(h - (insets?.bottom ?? 0));
      if (insets) {
        expect(r.x).toBeGreaterThanOrEqual(insets.left);
        expect(r.x + r.w).toBeLessThanOrEqual(w - insets.right);
      }
      // Le centre du bouton tombe bien dans sa zone active.
      expect(zoneAt(l, r.x + r.w / 2, r.y + r.h / 2)).toBe(r.zone);
    }
    for (let i = 1; i < rects.length; i++) expect(rects[i]!.x).toBeGreaterThan(rects[i - 1]!.x + rects[i - 1]!.w);
  });
});

describe("suivi des doigts", () => {
  const L = layoutFor(800, 400);
  const left = [50, 300] as const;
  const right = [300, 300] as const;
  const jump = [600, 300] as const;

  it("← puis lever : direction gauche, puis neutre", () => {
    const pad = new TouchPad(L);
    expect(pad.down(1, ...left)).toBe("left");
    expect(pad.bits).toBe(INPUT_LEFT);
    pad.up(1);
    expect(pad.bits).toBe(0);
  });

  it("glisser de ← à → sans lever change aussitôt de direction, et inversement", () => {
    const pad = new TouchPad(L);
    pad.down(1, ...left);
    expect(pad.direction).toBe(-1);
    pad.move(1, 150, 300);
    expect(pad.direction).toBe(-1);
    pad.move(1, 220, 300);
    expect(pad.direction).toBe(1);
    expect(pad.pressed("right")).toBe(true);
    expect(pad.pressed("left")).toBe(false);
    pad.move(1, 90, 310);
    expect(pad.direction).toBe(-1);
    expect(pad.count).toBe(1);
    pad.up(1);
    expect(pad.direction).toBe(0);
  });

  it("un doigt qui sort de la moitié gauche compte pour la zone la plus proche, et seul le lever l'arrête", () => {
    const pad = new TouchPad(L);
    pad.down(1, ...right);
    pad.move(1, 700, 300); // dans la moitié du saut
    expect(pad.direction).toBe(1);
    expect(pad.jump).toBe(false);
    pad.move(1, 5000, 9000); // très loin, hors de l'écran
    expect(pad.direction).toBe(1);
    pad.move(1, 700, 10); // et même dans la bande haute
    expect(pad.direction).toBe(1);
    pad.move(1, -200, 300); // par la gauche
    expect(pad.direction).toBe(-1);
    pad.up(1);
    expect(pad.direction).toBe(0);
  });

  it("deux doigts : la direction d'un côté, le saut de l'autre, chacun indépendant", () => {
    const pad = new TouchPad(L);
    pad.down(1, ...right);
    pad.down(2, ...jump);
    expect(pad.bits).toBe(INPUT_RIGHT | INPUT_JUMP);
    pad.up(2); // le saut se lâche, la direction reste
    expect(pad.bits).toBe(INPUT_RIGHT);
    pad.down(3, ...jump);
    pad.up(1); // la direction se lâche, le saut reste
    expect(pad.bits).toBe(INPUT_JUMP);
    pad.up(3);
    expect(pad.bits).toBe(0);
  });

  it("le doigt de saut suit son propre doigt : il reste un saut même s'il glisse sur la moitié gauche", () => {
    const pad = new TouchPad(L);
    pad.down(1, ...jump);
    pad.move(1, 40, 300);
    expect(pad.jump).toBe(true);
    expect(pad.direction).toBe(0);
    pad.up(1);
    expect(pad.jump).toBe(false);
  });

  it("plusieurs doigts de direction : le plus récent l'emporte, le précédent revient quand il est levé", () => {
    const pad = new TouchPad(L);
    pad.down(1, ...left);
    pad.down(2, ...right);
    expect(pad.direction).toBe(1);
    pad.up(2);
    expect(pad.direction).toBe(-1);
  });

  it("un doigt posé dans la bande haute (ou hors zone) ne commande rien, même s'il glisse ensuite dans le jeu", () => {
    const pad = new TouchPad(L);
    expect(pad.down(1, 100, 10)).toBe("band");
    expect(pad.count).toBe(0);
    pad.move(1, 100, 300);
    expect(pad.bits).toBe(0);
    pad.move(1, 600, 300);
    expect(pad.bits).toBe(0);
    pad.up(1);
    // Un doigt inconnu qu'on lève ou déplace est sans effet.
    pad.up(99);
    pad.move(99, 1, 1);
    expect(pad.bits).toBe(0);
  });

  it("un doigt posé hors de l'écran compte pour la zone du bord ; releaseAll lâche tout", () => {
    const pad = new TouchPad(L);
    pad.down(1, -20, 300);
    pad.down(2, 900, 300);
    expect(pad.bits).toBe(INPUT_LEFT | INPUT_JUMP);
    pad.releaseAll();
    expect(pad.bits).toBe(0);
    expect(pad.count).toBe(0);
  });

  it("un nouvel écran (rotation) change les zones sans casser le suivi", () => {
    const pad = new TouchPad(layoutFor(844, 390));
    pad.down(1, 300, 300); // zone → en paysage (300 / 844 = 0,36)
    expect(pad.direction).toBe(1);
    pad.layout = layoutFor(390, 844);
    expect(pad.direction).toBe(1); // 300 / 390 : désormais dans la moitié du saut, toujours →
  });
});

describe("appui bref mémorisé (même mémorisation que le clavier)", () => {
  const controls = () => new Controls(new EventTarget() as unknown as Window);

  it("un toucher de saut levé avant le pas suivant compte pour un pas tenu", () => {
    const c = controls();
    expect(c.sample()).toBe(0);
    c.setTouch(0, true);
    c.setTouch(0, false);
    expect(c.sample() & INPUT_JUMP).toBe(INPUT_JUMP);
    expect(c.sample() & INPUT_JUMP).toBe(0);
  });

  it("la direction tactile donne les mêmes bits que le clavier", () => {
    const c = controls();
    c.setTouch(-1, false);
    expect(c.sample()).toBe(INPUT_LEFT);
    c.setTouch(1, true);
    expect(c.sample()).toBe(INPUT_RIGHT | INPUT_JUMP);
    c.setTouch(0, false);
    c.sample(); // un appui tenu puis relâché : le pas suivant est relâché
    expect(c.sample()).toBe(0);
  });

  it("le bouton « recommencer » donne le même événement que la touche R, une seule fois", () => {
    const c = controls();
    expect(c.takeRestart()).toBe(false);
    c.requestRestart();
    expect(c.takeRestart()).toBe(true);
    expect(c.takeRestart()).toBe(false);
  });
});

describe("tactile imposé ou coupé", () => {
  it("?touch=1 force, ?touch=0 coupe, sinon l'appareil décide", () => {
    expect(wantsTouch("1", false)).toBe(true);
    expect(wantsTouch("0", true)).toBe(false);
    expect(wantsTouch(null, true)).toBe(true);
    expect(wantsTouch(null, false)).toBe(false);
  });
});

describe("cadrage de la caméra", () => {
  it("téléphone en paysage : de 12 à 14 tuiles de haut ; ordinateur : 18", () => {
    for (const [w, h] of [[844, 390], [915, 412], [640, 360], [568, 320]] as const) {
      const tiles = viewHeightTiles(w, h, true);
      expect(tiles, `${w}×${h}`).toBeGreaterThanOrEqual(12);
      expect(tiles, `${w}×${h}`).toBeLessThanOrEqual(14);
    }
    expect(viewHeightTiles(1280, 720, false)).toBe(VIEW_TILES_DESKTOP);
    expect(VIEW_TILES_PHONE).toBe(13);
  });

  it("portrait : au moins 10 tuiles de large, la hauteur s'agrandit", () => {
    for (const [w, h] of [[320, 568], [390, 844], [412, 915], [600, 1024]] as const) {
      for (const touch of [true, false]) {
        const tiles = viewHeightTiles(w, h, touch);
        expect(tiles * (w / h), `${w}×${h}`).toBeGreaterThanOrEqual(VIEW_MIN_WIDTH_TILES - 1e-9);
      }
    }
    expect(viewHeightTiles(390, 844, true)).toBeCloseTo(21.64, 1);
  });

  it("une fenêtre sans taille garde la valeur de base", () => {
    expect(viewHeightTiles(0, 0, true)).toBe(VIEW_TILES_PHONE);
  });
});
