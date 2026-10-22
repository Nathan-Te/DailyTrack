import { initialAttempt, parseLevel, type AttemptState, type Level } from "@cdj/jump-sim";
import { Group, Mesh, MeshBasicMaterial, LineDashedMaterial } from "three";
import { describe, expect, it } from "vitest";
import { CARNAGE, CARNAGE_DEFAULTS } from "../src/camera";
import { createDynamicBlocks } from "../src/dynamicArt";
import { createSawArt } from "../src/sawArt";
import { CAMERA_SLIDERS } from "../src/tune";
import { createWindArt } from "../src/windArt";

// Lot 17 — le carnage lisible. Pendant le carnage, ce qui suit l'horloge (scies mobiles, clignotants, rafales) est dessiné estompé ; les dangers
// fixes (pics, scies fixes), les blocs alternés et le décor ne changent pas ; hors carnage, tout est à pleine opacité. Le dessin ne fait que lire
// le facteur que la scène lui donne (`scene.clockFade`, 1 par défaut, `CARNAGE.clockOpacity` pendant le carnage : voir `main.ts`).

const ROWS = [
  "##############################",
  "#............................#",
  "#...bb.....dd...AA.....BB....#",
  "#............................#",
  "#..o.........O...............#",
  "#S..........................F#",
  "##############################",
];
const level: Level = parseLevel(
  ROWS.join("\n") +
    "\n\nsection a 1-28\nclignote a 120 60 0\nscie ronde 0.75 120 aller-retour 10,3 14,3\nvent 6-9 1-4 droite 100\nvent 20-26 1-4 haut 100 rafale 120 40 60\n",
);
const running: AttemptState = { ...initialAttempt(level), status: 1, sections: [0], time: 0 };
const COLORS = { body: 0xe03a3a, outline: 0x3a0f0f };
const FADE = 0.35;

/** Les trois pièces d'une scie : son disque, son moyeu et son cerne. */
const parts = (m: Mesh): MeshBasicMaterial[] => [m.material as MeshBasicMaterial, ...m.children.map((c) => (c as Mesh).material as MeshBasicMaterial)];

describe("réglage", () => {
  it("35 % par défaut, dans le panneau ?debug&tune", () => {
    expect(CARNAGE_DEFAULTS.clockOpacity).toBe(0.35);
    expect(CARNAGE.clockOpacity).toBe(0.35);
    const s = CAMERA_SLIDERS.find((x) => x.key === "clockOpacity")!;
    expect(s).toBeDefined();
    expect(s.min).toBeGreaterThan(0);
    expect(s.max).toBe(1);
    expect(CARNAGE.clockOpacity).toBeGreaterThanOrEqual(s.min);
  });
});

describe("scies (sawArt)", () => {
  it("le niveau a une scie mobile et deux fixes", () => {
    expect(level.saws.filter((s) => s.cycle !== 0)).toHaveLength(1);
    expect(level.saws.filter((s) => s.cycle === 0)).toHaveLength(2);
  });

  it("hors carnage (1) : toutes les pièces sont opaques, sans mélange", () => {
    const art = createSawArt(new Group(), level, COLORS);
    art.setFade(1);
    for (const saw of art.saws) for (const m of parts(saw.disc)) expect([m.opacity, m.transparent]).toEqual([1, false]);
    expect(art.opacity.every((o) => o === 1)).toBe(true);
  });

  it("pendant le carnage : la scie mobile (disque, moyeu, cerne) est à 35 %, les scies fixes restent à 100 %", () => {
    const art = createSawArt(new Group(), level, COLORS);
    art.setFade(FADE);
    level.saws.forEach((saw, k) => {
      const mats = parts(art.saws[k]!.disc);
      if (saw.cycle !== 0) {
        for (const m of mats) expect([m.opacity, m.transparent]).toEqual([FADE, true]);
        expect(art.opacity[k]).toBe(FADE);
      } else {
        for (const m of mats) expect([m.opacity, m.transparent]).toEqual([1, false]);
        expect(art.opacity[k]).toBe(1);
      }
    });
  });

  it("l'estompage se lève avec le carnage : retour exact à l'opacité normale", () => {
    const art = createSawArt(new Group(), level, COLORS);
    art.setFade(FADE);
    art.setFade(1);
    for (const saw of art.saws) for (const m of parts(saw.disc)) expect([m.opacity, m.transparent]).toEqual([1, false]);
  });

  it("le trajet de la scie mobile s'estompe avec elle ; les scies fixes n'ont pas de trajet", () => {
    const world = new Group();
    const art = createSawArt(world, level, COLORS);
    const lines = world.children.filter((c) => (c as unknown as { isLine?: boolean }).isLine === true);
    expect(lines).toHaveLength(1);
    const path = (lines[0] as unknown as { material: LineDashedMaterial }).material;
    expect(path.opacity).toBe(0.45);
    art.setFade(FADE);
    expect(path.opacity).toBeCloseTo(0.45 * FADE, 10);
    art.setFade(1);
    expect(path.opacity).toBe(0.45);
  });

  it("les pièces d'une scie mobile ne se recouvrent pas (estompées, le cerne ne transparaît pas sous le disque)", () => {
    // Le cerne est un anneau : aucun de ses sommets n'est au centre ; le disque est troué du moyeu. Les trois pièces ont donc des aires disjointes.
    const art = createSawArt(new Group(), level, COLORS);
    const mobile = level.saws.findIndex((s) => s.cycle !== 0);
    const disc = art.saws[mobile]!.disc;
    const area = (m: Mesh) => {
      const pos = m.geometry.getAttribute("position");
      const idx = m.geometry.index!;
      let a = 0;
      for (let i = 0; i < idx.count; i += 3) {
        const [p, q, r] = [idx.getX(i), idx.getX(i + 1), idx.getX(i + 2)];
        a += Math.abs((pos.getX(q) - pos.getX(p)) * (pos.getY(r) - pos.getY(p)) - (pos.getX(r) - pos.getX(p)) * (pos.getY(q) - pos.getY(p))) / 2;
      }
      return a;
    };
    const hub = disc.children[0] as Mesh;
    const rim = disc.children[1] as Mesh;
    const body = level.saws[mobile]!.radius / 4096;
    // Anneau + disque troué + moyeu = le disque denté complet cerné ; ni plus (recouvrement), ni moins (trou).
    const full = area(disc) + area(hub);
    expect(full).toBeGreaterThan(Math.PI * body * body * 0.9);
    expect(full).toBeLessThan(Math.PI * (body + 0.15) ** 2);
    expect(area(rim)).toBeGreaterThan(0);
    expect(area(hub)).toBeCloseTo((body * 0.45) ** 2, 6);
  });
});

describe("blocs (dynamicArt)", () => {
  const face = (world: Group, i: number) => ((world.children[i]!.children[0] as Mesh).material as MeshBasicMaterial).opacity;
  const edge = (world: Group, i: number) => ((world.children[i]!.children[1] as Mesh).material as MeshBasicMaterial).opacity;
  const view = { x: 0, y: 0, halfW: 5, halfH: 5 };

  it("hors carnage : un clignotant plein est à 100 %", () => {
    const world = new Group();
    const d = createDynamicBlocks(world, level, false)!;
    d.update(running, 1, true, view);
    expect(face(world, 0)).toBe(1);
    expect(d.stats.clockFade).toBe(1);
    expect(d.stats.blinkFace).toBe(1);
  });

  it("pendant le carnage : les clignotants (face et contour) sont à 35 %, les alternés restent à 100 %", () => {
    const world = new Group();
    const d = createDynamicBlocks(world, level, false)!;
    d.update(running, 1, true, view, FADE);
    expect(d.stats.clockFade).toBe(FADE);
    expect(d.stats.blinkFace).toBe(FADE);
    expect(face(world, 0)).toBe(FADE); // `b` plein
    expect(edge(world, 0)).toBe(FADE);
    expect(d.stats.altFace).toBe(1);
    // Les alternés sont les blocs 4 à 7 (`A` plein au départ).
    expect(face(world, 4)).toBe(1);
    expect(edge(world, 4)).toBe(1);
    d.update(running, 2, true, view); // le carnage est fini
    expect(face(world, 0)).toBe(1);
    expect(d.stats.blinkFace).toBe(1);
  });

  it("un clignotant absent garde son contour discret, estompé lui aussi", () => {
    const world = new Group();
    const d = createDynamicBlocks(world, level, false)!;
    d.update(running, 1, true, view);
    const normal = edge(world, 2); // `d` absent
    d.update(running, 1, true, view, FADE);
    expect(edge(world, 2)).toBeCloseTo(normal * FADE, 10);
  });
});

describe("vent (windArt)", () => {
  it("pendant le carnage : la rafale (flèches, contour) est à 35 %, la zone qui souffle toujours reste à 100 %", () => {
    const world = new Group();
    const art = createWindArt(world, level, false)!;
    art.update(running, 0.5, 0, false, 40); // flèches fixes
    const normal = [...art.stats.arrowOpacity];
    expect(art.stats.fade).toEqual([1, 1]);
    art.update(running, 0.6, 0, false, 40, FADE);
    expect(art.stats.fade).toEqual([1, FADE]);
    expect(art.stats.arrowOpacity[0]).toBe(normal[0]);
    expect(art.stats.arrowOpacity[1]).toBeCloseTo(normal[1]! * FADE, 10);
    art.update(running, 0.7, 0, false, 40); // hors carnage
    expect(art.stats.arrowOpacity).toEqual(normal);
    expect(art.stats.fade).toEqual([1, 1]);
  });

  it("les particules de la rafale s'estompent aussi, celles de la zone fixe non", () => {
    const art = createWindArt(new Group(), level, false)!;
    art.update(running, 0.5, 1, true, 40);
    const normal = art.stats.particles;
    art.update(running, 0.6, 1, true, 40, FADE);
    expect(art.stats.particles).toBeGreaterThan(0);
    expect(art.stats.particles).toBeLessThanOrEqual(normal);
  });
});
