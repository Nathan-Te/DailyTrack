import { Group, type Mesh } from "three";
import { describe, expect, it } from "vitest";
import { boitesDeForme, centreDesYeux, COTES_DISQUE, decrirePiece, disposerYeux, ENCRE, expressionDe, PAPIER } from "../src/blocs";
import { dessinerCouches, dessinerPiece, dessinerYeux, placer } from "../src/blocs/canvas";
import { cercle, poserCouches, rect, Yeux } from "../src/blocs/three";

// Lot DA1 — les DEUX dessinateurs lisent la même description. Un faux contexte Canvas enregistre ce qu'on lui demande ; on le compare à ce que le dessinateur Three.js pose (maillages) : mêmes rectangles, mêmes couleurs,
// mêmes yeux. Le pixel, lui, se compare dans la vitrine (`/ui/` › Blocs) et dans les captures de Tower.
type Op = [string, ...unknown[]];
function fauxContexte(): { ctx: CanvasRenderingContext2D; ops: Op[] } {
  const ops: Op[] = [];
  const noter = (nom: string) => (...a: unknown[]) => void ops.push([nom, ...a]);
  const cible: Record<string, unknown> = {};
  const ctx = new Proxy(cible, {
    get: (_, nom: string) => (nom === "fillStyle" ? cible.fillStyle : noter(nom)),
    set: (_, nom: string, v) => {
      if (nom === "fillStyle") ops.push(["fillStyle", v]);
      cible[nom] = v;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return { ctx, ops };
}

describe("le dessinateur Canvas 2D", () => {
  const bs = boitesDeForme("L");
  const couches = decrirePiece(bs, { couleur: "#F07FB0", encre: ENCRE, halo: "#5DBB63" });

  it("un chemin par couche, rempli une fois, de bas en haut : l'encre, le liseré, la couleur", () => {
    const { ctx, ops } = fauxContexte();
    dessinerCouches(ctx, couches);
    expect(ops.filter((o) => o[0] === "fillStyle").map((o) => o[1])).toEqual([ENCRE, "#5DBB63", "#F07FB0"]);
    expect(ops.filter((o) => o[0] === "fill")).toHaveLength(3);
    expect(ops.filter((o) => o[0] === "rect")).toHaveLength(couches.reduce((n, c) => n + c.rects.length, 0));
    expect(ops.filter((o) => o[0] === "fillRect")).toHaveLength(0); // jamais un rectangle à la fois : un filet clair marquerait l'arête
  });
  it("les rectangles sont ceux de la description (centre et dimensions → coin et dimensions)", () => {
    const { ctx, ops } = fauxContexte();
    dessinerCouches(ctx, couches);
    const vus = ops.filter((o) => o[0] === "rect").map((o) => o.slice(1) as number[]);
    const attendus = couches.flatMap((c) => c.rects.map((r) => [r.cx - r.w / 2, r.cy - r.h / 2, r.w, r.h]));
    expect(vus).toEqual(attendus);
  });
  it("placer met le contexte en mètres, y vers le haut ; dessinerPiece restaure le contexte", () => {
    const { ctx, ops } = fauxContexte();
    placer(ctx, { x: 10, y: 20, pxParMetre: 30, angle: 0.5 });
    expect(ops).toEqual([["translate", 10, 20], ["scale", 30, -30], ["rotate", 0.5]]);
    const b = fauxContexte();
    dessinerPiece(b.ctx, { x: 0, y: 0, pxParMetre: 10 }, couches, disposerYeux(0, 0, 1, expressionDe({ niveau: 1, genre: "normal", regard: { x: 0, y: 0 }, clignement: 0, t: 0 }), 0));
    expect(b.ops.filter((o) => o[0] === "save")).toHaveLength(b.ops.filter((o) => o[0] === "restore").length);
  });
  it("un disque est un polygone de 20 côtés, comme celui de Three.js ; un sourcil caché ne se dessine pas", () => {
    const x = expressionDe({ niveau: 0, genre: "normal", regard: { x: 0, y: 0 }, clignement: 0, t: 0 });
    const { ctx, ops } = fauxContexte();
    dessinerYeux(ctx, disposerYeux(0, 0, 1, x, 0));
    expect(ops.filter((o) => o[0] === "moveTo")).toHaveLength(2 * 3);
    expect(ops.filter((o) => o[0] === "lineTo")).toHaveLength(2 * 3 * (COTES_DISQUE - 1));
    expect(ops.filter((o) => o[0] === "fillRect")).toHaveLength(0); // pas de sourcil au repos
    expect(ops.filter((o) => o[0] === "fillStyle").map((o) => o[1])).toEqual([ENCRE, ENCRE, PAPIER, PAPIER, ENCRE, ENCRE]); // couche par couche, comme Three.js : un œil écarquillé recouvre l'autre, sa pupille reste dessus
    const b = fauxContexte();
    dessinerYeux(b.ctx, disposerYeux(0, 0, 1, expressionDe({ niveau: 3, genre: "normal", regard: { x: 0, y: 0 }, clignement: 0, t: 0 }), 0));
    expect(b.ops.filter((o) => o[0] === "fillRect")).toHaveLength(2);
  });
});

describe("les deux dessinateurs posent la même chose", () => {
  it("les couches : un maillage par rectangle, au même centre, aux mêmes dimensions, à la profondeur de sa couche", () => {
    const couches = decrirePiece(boitesDeForme("S", 1), { couleur: "#5DBB63", encre: ENCRE, halo: "#9ED9BE", bord: 0.1, lisere: 0.2 });
    const g = new Group();
    poserCouches(g, couches);
    const vus = (g.children as Mesh[]).map((m) => [m.position.x, m.position.y, m.position.z, m.scale.x, m.scale.y]);
    const attendus = couches.flatMap((c) => c.rects.map((r) => [r.cx, r.cy, c.profondeur, r.w, r.h]));
    expect(vus).toEqual(attendus);
  });
  it("les yeux : les mêmes centres, échelles, pupilles et sourcils, pour chaque expression", () => {
    const bs = boitesDeForme("T", 2);
    const c = centreDesYeux(bs);
    for (const genre of ["normal", "chute", "figee", "soulage", "glissante", "plisse"] as const) {
      for (const niveau of [0, 1, 2, 3] as const) {
        const x = expressionDe({ niveau, genre, regard: { x: 0.4, y: -0.3 }, clignement: 0.2, t: 1.7 });
        const g = new Group();
        const yeux = new Yeux(g, c.x, c.y, 1.3, 2.6);
        yeux.appliquer(x, 1.7);
        const poses = disposerYeux(c.x, c.y, 1.3, x, 1.7, 2.6);
        poses.forEach((p, i) => {
          const gr = g.children[2 * i] as Group;
          expect(gr.position.x).toBe(p.x);
          expect(gr.position.y).toBe(p.y);
          expect([gr.scale.x, gr.scale.y]).toEqual([p.sx, p.sy]);
          const [encre, blanc, pupille] = gr.children as Mesh[];
          expect(encre!.scale.x).toBe(p.rEncre);
          expect(blanc!.scale.x).toBe(p.rBlanc);
          expect([pupille!.position.x, pupille!.position.y, pupille!.scale.x]).toEqual([p.pupille.x, p.pupille.y, p.pupille.r]);
          const s = g.children[2 * i + 1] as Mesh;
          expect(s.visible).toBe(p.sourcil.visible);
          if (p.sourcil.visible) expect([s.position.x, s.position.y, s.scale.x, s.scale.y, s.rotation.z]).toEqual([p.sourcil.x, p.sourcil.y, p.sourcil.w, p.sourcil.h, p.sourcil.rot]);
        });
      }
    }
  });
  it("les formes de base : un rectangle et un disque centrés, à l'échelle demandée", () => {
    const r = rect("#FF0000", 1, 2, 3, 4, 0.5);
    expect([r.position.x, r.position.y, r.position.z, r.scale.x, r.scale.y]).toEqual([1, 2, 0.5, 3, 4]);
    const d = cercle("#00FF00", 1, 2, 0.5, 0.1);
    expect([d.scale.x, d.scale.y]).toEqual([0.5, 0.5]);
  });
});
