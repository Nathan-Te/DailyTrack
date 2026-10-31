import { INPUT_JUMP, INPUT_LEFT, INPUT_RIGHT } from "@cdj/jump-sim";
import { touchDebugLine } from "../src/touchDebug";
import { describe, expect, it } from "vitest";
import { VIEW_MIN_WIDTH_TILES, VIEW_TILES_DESKTOP, VIEW_TILES_PHONE, viewHeightTiles } from "../src/camera";
import { Controls } from "../src/input";
import {
  BAND_PX,
  BUTTON_GAP_PX,
  MIN_TARGET_PX,
  TouchPad,
  ARROWS_EDGE_PX,
  BUTTON_SIZES,
  ZONES,
  buttonRects,
  isMouseEcho,
  MOUSE_ECHO_MS,
  layoutFor,
  wantsTouch,
  zoneAt,
  zoneSpans,
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
  it.each(SCREENS)("%i × %i : les tranches se touchent, de 0 à 1, sans trou ni recouvrement, quelle que soit la taille des boutons", (w, h) => {
    for (const size of BUTTON_SIZES) {
      const spans = zoneSpans(layoutFor(w, h, undefined, size));
      expect(spans.map((s) => s.zone)).toEqual(ZONES);
      expect(spans[0]!.x0).toBe(0);
      expect(spans.at(-1)!.x1).toBe(1);
      for (let i = 1; i < spans.length; i++) expect(spans[i]!.x0).toBe(spans[i - 1]!.x1);
      expect(spans[1]!.x1, "le saut commence toujours à la moitié").toBe(0.5);
    }
  });

  it.each(SCREENS)("%i × %i : chaque point de l'écran est dans une et une seule zone, sans trou, bande haute exclue", (w, h) => {
    const l = layoutFor(w, h);
    for (let x = 0; x <= w; x += 1) {
      for (const y of [l.band, l.band + 1, Math.round(h / 2), h - 1, h]) {
        const z = zoneAt(l, x, y);
        expect(["left", "right", "jump"], `(${x}, ${y})`).toContain(z);
      }
      for (const y of [0, 1, l.band - 1]) expect(zoneAt(l, x, y), `(${x}, ${y})`).toBe("band");
    }
    // Les frontières : celle entre les flèches (au milieu de leur écart) et ½ de la largeur appartiennent à la zone de droite.
    expect(zoneAt(l, l.frontier - 0.01, h - 1)).toBe("left");
    expect(zoneAt(l, l.frontier, h - 1)).toBe("right");
    expect(zoneAt(l, w / 2 - 0.01, h - 1)).toBe("right");
    expect(zoneAt(l, w / 2, h - 1)).toBe("jump");
  });

  it("lot 29 : hors de l'écran, un doigt ne touche aucune zone (`out`), même s'il y est arrivé par une zone", () => {
    const l = layoutFor(800, 400);
    for (const [x, y] of [[-1, 300], [-50, 300], [801, 300], [5000, 300], [100, -1], [100, 401], [100, 9000]] as const) expect(zoneAt(l, x, y), `(${x}, ${y})`).toBe("out");
  });

  it("la bande haute tient compte de la zone sûre (encoche)", () => {
    const l = layoutFor(390, 844, NOTCH);
    expect(l.band).toBe(BAND_PX + 47);
    expect(zoneAt(l, 50, l.band - 1)).toBe("band");
    expect(zoneAt(l, 50, l.band)).toBe("left");
  });
});

describe("boutons dessinés", () => {
  const cases: [number, number, Insets | undefined][] = [...SCREENS.map(([w, h]) => [w, h, undefined] as [number, number, undefined]), [390, 844, NOTCH], [844, 390, NOTCH_LANDSCAPE]];
  const withSizes = BUTTON_SIZES.flatMap((size) => cases.map(([w, h, insets]) => [size, w, h, insets] as const));
  it.each(withSizes)("%s, %i × %i : au moins 44 px, dans leur zone, écartés des frontières et des bords, sous la bande, sans se toucher", (size, w, h, insets) => {
    const l = layoutFor(w, h, insets, size);
    const rects = buttonRects(l);
    expect(rects.map((r) => r.zone)).toEqual(["left", "right", "jump"]);
    for (const r of rects) {
      const span = zoneSpans(l).find((s) => s.zone === r.zone)!;
      expect(r.w, `${r.zone} largeur`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
      expect(r.h, `${r.zone} hauteur`).toBeGreaterThanOrEqual(MIN_TARGET_PX);
      expect(r.x, `${r.zone} frontière gauche`).toBeGreaterThanOrEqual(span.x0 * w + (r.zone === "left" ? 0 : BUTTON_GAP_PX) - 1e-6);
      expect(r.x + r.w, `${r.zone} frontière droite`).toBeLessThanOrEqual(span.x1 * w - BUTTON_GAP_PX + 1e-6);
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

  // Lot I5 (charte rév. 7, § 9 ; maquette jump-hud.html) : les boutons aux bords — ← et → **calés contre le bord gauche** (en bas à gauche : `ARROWS_EDGE_PX`
  // après la zone sûre), la frontière ← / → au milieu de leur écart ; le gros « SAUT » contre le bord droit — et **jamais devant le personnage** : aucun bouton
  // dans la zone où il se tient (30 à 70 % de la largeur, 20 à 64 % de la hauteur : au sol il est 1,5 tuile sous le centre de l'image, vers 61 % ; e2e :
  // `expectCentreLibre`). Les tailles « petits » et « moyens » ne mordent jamais sur cette zone ; « grands » ne la mord jamais plus que « moyens ».
  it.each(withSizes)("%s, %i × %i : aux bords, hors de la zone du personnage", (size, w, h, insets) => {
    const l = layoutFor(w, h, insets, size);
    const [left, right, jump] = buttonRects(l);
    expect(left!.x).toBe((insets?.left ?? 0) + ARROWS_EDGE_PX);
    expect(right!.x).toBe(left!.x + left!.w + 2 * BUTTON_GAP_PX);
    expect(l.frontier).toBe(left!.x + left!.w + BUTTON_GAP_PX);
    expect(jump!.x + jump!.w).toBeLessThanOrEqual(w - (insets?.right ?? 0) - BUTTON_GAP_PX);
    expect(jump!.x + jump!.w).toBeGreaterThan(w - (insets?.right ?? 0) - BUTTON_GAP_PX - 1);
    expect(jump!.w).toBeGreaterThanOrEqual(left!.w);
    const moyens = buttonRects(layoutFor(w, h, insets, "medium"));
    for (const [i, r] of [left!, right!, jump!].entries()) {
      const dehors = (b: { x: number; y: number; w: number; h: number }) => b.x + b.w <= w * 0.3 || b.x >= w * 0.7 || b.y + b.h <= h * 0.2 || b.y >= h * 0.64;
      expect(dehors(r) || (size === "large" && r.x + r.w <= moyens[i]!.x + moyens[i]!.w), `${r.zone} hors de la zone du personnage`).toBe(true);
    }
  });

  it.each(cases)("%i × %i : petits < moyens < grands, aussi grands que l'écran le permet (jamais moins de 44 px)", (w, h, insets) => {
    const dir = (size: (typeof BUTTON_SIZES)[number]) => buttonRects(layoutFor(w, h, insets, size))[0]!.w;
    const saut = (size: (typeof BUTTON_SIZES)[number]) => buttonRects(layoutFor(w, h, insets, size))[2]!.w;
    expect(dir("small")).toBeLessThanOrEqual(dir("medium"));
    expect(dir("medium")).toBeLessThanOrEqual(dir("large"));
    expect(saut("small")).toBeLessThanOrEqual(saut("medium"));
    expect(saut("medium")).toBeLessThanOrEqual(saut("large"));
    expect(dir("small")).toBeGreaterThanOrEqual(MIN_TARGET_PX);
  });

  it("844 × 390 : les trois tailles ont leurs dimensions (flèches 55 · 76 · 99 px, saut 79 × 66 · 110 × 92 · 143 × 120 px)", () => {
    const at = (size: (typeof BUTTON_SIZES)[number]) => buttonRects(layoutFor(844, 390, undefined, size));
    expect(at("small").map((r) => [r.w, r.h])).toEqual([[55, 55], [55, 55], [79, 66]]);
    expect(at("medium").map((r) => [r.w, r.h])).toEqual([[76, 76], [76, 76], [110, 92]]);
    expect(at("large").map((r) => [r.w, r.h])).toEqual([[99, 99], [99, 99], [143, 120]]);
  });

  it("la frontière ← / → suit les flèches : plus grandes, elle recule vers la droite ; le doigt posé entre les deux flèches commande l'une ou l'autre", () => {
    const petits = layoutFor(844, 390, undefined, "small");
    const grands = layoutFor(844, 390, undefined, "large");
    expect(grands.frontier).toBeGreaterThan(petits.frontier);
    for (const l of [petits, grands]) {
      const [left, right] = buttonRects(l);
      expect(zoneAt(l, left!.x + left!.w + 1, l.height - 40)).toBe("left");
      expect(zoneAt(l, right!.x - 1, l.height - 40)).toBe("right");
    }
  });
});

describe("suivi des doigts (lot 29 : l'état se déduit des doigts posés et de leur position)", () => {
  const L = layoutFor(800, 400);
  const left = [50, 300] as const;
  const right = [300, 300] as const;
  const jump = [600, 300] as const;
  const band = [100, 10] as const;
  const outside = [-30, 300] as const;
  /** Aucune commande tenue, aucun doigt : l'état de repos. */
  const rest = (pad: TouchPad) => {
    expect(pad.bits).toBe(0);
    expect(pad.count).toBe(0);
  };

  it("← puis lever : direction gauche, puis neutre", () => {
    const pad = new TouchPad(L);
    expect(pad.down(1, ...left)).toBe("left");
    expect(pad.bits).toBe(INPUT_LEFT);
    expect(pad.up(1)).toBe(true);
    rest(pad);
  });

  it("glisser de ← à → sans lever : ← se relâche, → s'enfonce aussitôt, et inversement ; lever arrête tout", () => {
    const pad = new TouchPad(L);
    pad.down(1, ...left);
    pad.move(1, L.frontier - 10, 300);
    expect(pad.bits).toBe(INPUT_LEFT);
    pad.move(1, L.frontier + 10, 300);
    expect(pad.bits).toBe(INPUT_RIGHT);
    expect(pad.pressed("right")).toBe(true);
    expect(pad.pressed("left")).toBe(false);
    pad.move(1, L.frontier - 20, 310);
    expect(pad.bits).toBe(INPUT_LEFT);
    expect(pad.count).toBe(1);
    pad.move(1, L.frontier + 20, 310);
    pad.up(1);
    rest(pad);
  });

  it("glisser de → au saut : → se relâche, le saut s'enfonce ; de ← jusqu'au saut sans lever, puis lever : rien n'est tenu", () => {
    const pad = new TouchPad(L);
    pad.down(1, ...left);
    pad.move(1, ...right);
    expect(pad.bits).toBe(INPUT_RIGHT);
    pad.move(1, ...jump);
    expect(pad.bits).toBe(INPUT_JUMP);
    expect(pad.direction).toBe(0);
    pad.move(1, ...left); // et le saut, qui avait suivi son doigt, repart en ←
    expect(pad.bits).toBe(INPUT_LEFT);
    pad.move(1, ...jump);
    pad.up(1);
    rest(pad);
  });

  it("un doigt qui sort d'un bouton le relâche : par la bande haute, par un bord de l'écran, ou loin dehors", () => {
    for (const start of [left, right, jump] as const) {
      for (const away of [band, outside, [900, 300], [300, 450], [5000, 9000]] as const) {
        const pad = new TouchPad(L);
        pad.down(1, start[0], start[1]);
        expect(pad.bits).not.toBe(0);
        pad.move(1, away[0], away[1]);
        expect(pad.bits, `${start} → ${away}`).toBe(0);
        expect(pad.count, "le doigt reste suivi").toBe(1);
        pad.up(1);
        rest(pad);
      }
    }
  });

  it("un doigt qui revient d'en dehors ou de la bande haute dans une zone l'enfonce (il est suivi tant qu'il est posé)", () => {
    const pad = new TouchPad(L);
    expect(pad.down(1, ...band)).toBe("band");
    expect(pad.count).toBe(1);
    expect(pad.bits).toBe(0);
    pad.move(1, ...right);
    expect(pad.bits).toBe(INPUT_RIGHT);
    pad.move(1, ...outside);
    expect(pad.bits).toBe(0);
    pad.move(1, ...left);
    expect(pad.bits).toBe(INPUT_LEFT);
    pad.up(1);
    rest(pad);
    // Un doigt posé hors de l'écran ne commande rien.
    expect(pad.down(2, ...outside)).toBe("out");
    expect(pad.bits).toBe(0);
  });

  it("deux doigts : la direction d'un côté, le saut de l'autre, chacun indépendant ; lever l'un puis l'autre", () => {
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
    rest(pad);
  });

  it("deux doigts, l'un levé puis l'autre : levés dans n'importe quel ordre, rien ne reste tenu", () => {
    for (const order of [[1, 2], [2, 1]] as const) {
      const pad = new TouchPad(L);
      pad.down(1, ...left);
      pad.down(2, ...right);
      pad.move(1, ...jump); // le premier glisse jusqu'au saut
      expect(pad.bits).toBe(INPUT_RIGHT | INPUT_JUMP);
      pad.up(order[0]);
      pad.up(order[1]);
      rest(pad);
    }
  });

  it("plusieurs doigts de direction : le dernier entré dans sa zone l'emporte, le précédent revient quand il est levé", () => {
    const pad = new TouchPad(L);
    pad.down(1, ...left);
    pad.down(2, ...right);
    expect(pad.direction).toBe(1);
    pad.up(2);
    expect(pad.direction).toBe(-1);
    // Le doigt 1 entre dans → après que le doigt 3 est posé en ← : c'est lui le dernier entré.
    pad.down(3, ...left);
    pad.move(1, ...right);
    expect(pad.direction).toBe(1);
    pad.up(1);
    expect(pad.direction).toBe(-1);
  });

  it("un identifiant réutilisé (lever perdu) remplace l'ancien doigt au lieu de s'ajouter", () => {
    const pad = new TouchPad(L);
    pad.down(7, ...left);
    pad.down(7, ...jump);
    expect(pad.count).toBe(1);
    expect(pad.bits).toBe(INPUT_JUMP);
    pad.up(7);
    rest(pad);
    // Un doigt inconnu qu'on lève ou déplace est sans effet.
    expect(pad.up(99)).toBe(false);
    pad.move(99, 1, 1);
    rest(pad);
  });

  it("releaseAll lâche tout (annulation, focus, visibilité, pagehide, rotation)", () => {
    const pad = new TouchPad(L);
    pad.down(1, ...left);
    pad.down(2, ...jump);
    expect(pad.bits).toBe(INPUT_LEFT | INPUT_JUMP);
    pad.releaseAll();
    rest(pad);
  });

  it("un nouvel écran (rotation) recalcule ce que touche chaque doigt, sans le garder de la pose", () => {
    const pad = new TouchPad(layoutFor(844, 390));
    pad.down(1, 300, 300); // zone → en paysage (300 / 844 = 0,36)
    expect(pad.bits).toBe(INPUT_RIGHT);
    pad.layout = layoutFor(390, 844);
    expect(pad.bits).toBe(INPUT_JUMP); // 300 / 390 : désormais dans la moitié du saut
    pad.layout = layoutFor(390, 280); // et un écran trop bas pour que le doigt y soit : dehors
    expect(pad.bits).toBe(0);
    expect(pad.count).toBe(1);
  });

  describe("reconcile : la liste des touchers du système fait foi", () => {
    it("aucun toucher posé : tous les doigts tactiles sont lâchés (un lever s'est perdu)", () => {
      const pad = new TouchPad(L);
      pad.down(1, ...left);
      pad.down(2, ...jump);
      expect(pad.reconcile([])).toBe(2);
      rest(pad);
    });

    it("un toucher de moins : le doigt le plus éloigné des touchers restants est lâché, l'autre reste", () => {
      const pad = new TouchPad(L);
      pad.down(1, ...left);
      pad.down(2, ...jump);
      expect(pad.reconcile([{ x: jump[0] + 2, y: jump[1] - 1 }])).toBe(1);
      expect(pad.bits).toBe(INPUT_JUMP);
      expect(pad.count).toBe(1);
      pad.down(3, ...left);
      expect(pad.reconcile([{ x: left[0], y: left[1] }])).toBe(1); // le saut a perdu son lever
      expect(pad.bits).toBe(INPUT_LEFT);
    });

    it("autant de touchers (ou plus : un doigt sur un bouton du haut) que de doigts suivis : rien n'est lâché", () => {
      const pad = new TouchPad(L);
      pad.down(1, ...left);
      expect(pad.reconcile([{ x: 400, y: 200 }])).toBe(0);
      expect(pad.reconcile([{ x: 50, y: 300 }, { x: 60, y: 20 }])).toBe(0);
      expect(pad.bits).toBe(INPUT_LEFT);
    });

    it("la souris n'est pas un toucher : elle n'est jamais lâchée par la liste des touchers", () => {
      const pad = new TouchPad(L);
      pad.down(1, ...left, false);
      expect(pad.reconcile([])).toBe(0);
      expect(pad.bits).toBe(INPUT_LEFT);
    });
  });
});

describe("événements de souris émulés après un toucher", () => {
  it("une souris qui suit un toucher de moins d'une seconde est un écho ; plus tard, ou sans toucher avant, c'est une vraie souris", () => {
    expect(isMouseEcho("mouse", 1000, 900)).toBe(true);
    expect(isMouseEcho("mouse", 1000 + MOUSE_ECHO_MS - 101, 900)).toBe(true);
    expect(isMouseEcho("mouse", 900 + MOUSE_ECHO_MS, 900)).toBe(false);
    expect(isMouseEcho("mouse", 1000, null)).toBe(false);
    expect(isMouseEcho("touch", 1000, 900)).toBe(false);
    expect(isMouseEcho("pen", 1000, 900)).toBe(false);
  });
});

describe("ligne de vérification de ?debug", () => {
  it("dit les doigts posés et les touches tenues", () => {
    expect(touchDebugLine(0, 0, null)).toBe("doigts 0 · aucune touche tenue");
    expect(touchDebugLine(1, INPUT_LEFT, null)).toBe("doigts 1 · ← tenue");
    expect(touchDebugLine(2, INPUT_RIGHT | INPUT_JUMP, null)).toBe("doigts 2 · → et SAUT tenues");
    expect(touchDebugLine(0, 0, "annulation")).toBe("doigts 0 · aucune touche tenue · dernier relâchement : annulation");
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
