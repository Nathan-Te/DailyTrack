import { describe, expect, it } from "vitest";
import { BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial, Scene, Vector3 } from "three";
import { PALETTES, dailyCircuit, daysFromCivil, type PaletteName, type Track } from "@cdj/sim";
import { geometrieP1 } from "../src/scene/composerP1";
import { GROUPE_VIE_CIEL, PAS_DU_PALIER, pasVoulus } from "../src/scene/socle";
import { FINITION } from "../src/scene/finitionJeu";
import { VIE } from "../src/scene/vieJeu";
import { CIEL } from "../src/scene/cielJeu";
import type { AnimationPas, Calques, PasScene } from "../src/scene/types";
import { DECORS_TEST } from "./decorChecks";

// Lot 45 : le palier 2 en jeu (le pas « finition » : géométrie, variété, matière sobre, traces, reflets ciblés), sans carte graphique. Les appels de rendu d'une
// scène du palier 1 sont ses calques (un maillage chacun) : le palier 2 n'en ajoute aucun s'il ne laisse aucun calque de plus et ne pose aucun maillage.
// Dans le vrai jeu : `e2e/qualite.spec.ts` (appels du palier 2 = palier 1, sur chaque thème).

const theme = (p: PaletteName) => ({ stade: "stade", desert: "rallye", neige: "banquise", nuit: "nuit", campagne: "campagne", canyon: "canyon", alpin: "col", ville: "ville", neon: "nuit" })[p];
function circuit(palette: PaletteName): { track: Track; palette: PaletteName } {
  const c = dailyCircuit(daysFromCivil(2026, 10, 14), 0, theme(palette) as never);
  return { track: c.track, palette: c.palette };
}
const THEMES = PALETTES.filter((p) => p !== "neon");

/** Les calques qui deviennent un maillage (un appel de rendu) dans `composerP1`, et ce qu'ils ont. */
function calquesDessines(c: Calques) {
  return {
    builders: (["route", "solide", "lumineux"] as const).filter((k) => c[k].pos.length > 0),
    affiches: c.affiches.pos.length > 0,
    bandeaux: c.bandeaux.length,
    rebords: c.rebords !== undefined,
    drapeaux: c.drapeaux !== undefined,
    ecrans: c.ecrans !== undefined,
  };
}
const triangles = (c: Calques) => (c.route.pos.length + c.solide.pos.length + c.lumineux.pos.length) / 9;

function scene(c: { track: Track; palette: PaletteName }, pas: readonly PasScene[], coupes: readonly string[] = []) {
  const geo = geometrieP1(c.track, c.palette, { headless: true, pas, coupes, decor: DECORS_TEST[c.palette] });
  const s = new Scene();
  const animations = pas.map((p) => p.poser?.({ scene: s, calques: geo.calques, x: geo.x, soleil: new Vector3(0.3, 0.9, -0.2).normalize(), coupes: new Set(coupes), sansDom: true }) as AnimationPas | undefined);
  return { geo, scene: s, animations };
}

describe("lot 45 : le palier 2 du jeu", () => {
  it("les paliers : le 2 prend la finition, le 3 la finition, la vie, le ciel et les ombres ; le jeu donne au palier 2 la vie et le ciel", () => {
    expect(PAS_DU_PALIER.P2).toEqual(["finition"]);
    expect(PAS_DU_PALIER.P3).toEqual(["finition", "vie", "ciel", "ombres"]);
    expect(pasVoulus("P2", GROUPE_VIE_CIEL)).toEqual(["finition", "vie", "ciel"]);
    expect(pasVoulus("P2", [], ["finition"])).toEqual([]);
  });

  it.each(THEMES)("aucun appel de rendu de plus que le palier 1 : %s (les mêmes calques ; aucun maillage posé)", (p) => {
    {
      const c = circuit(p);
      const p1 = scene(c, []);
      const p2 = scene(c, [FINITION]);
      expect(calquesDessines(p2.geo.calques), p).toEqual(calquesDessines(p1.geo.calques));
      expect(p2.scene.children, `${p} : la finition ne pose aucun maillage`).toHaveLength(0);
      // Le décor : les mêmes maillages (décor, lumières, remplissage), varié.
      expect(Object.keys(p2.geo.decor!).sort()).toEqual(Object.keys(p1.geo.decor!).sort());
      // La géométrie ajoute des triangles (rebords complets, virages deux fois plus fins, pièces des portiques), dans les calques existants.
      expect(triangles(p2.geo.calques), p).toBeGreaterThan(triangles(p1.geo.calques));
    }
  }, 30_000);

  it("avec la vie et le ciel (le palier 2 du téléphone) : les mêmes familles que sans la finition, un appel chacune", () => {
    const c = circuit("stade");
    const sans = scene(c, [VIE, CIEL]);
    const avec = scene(c, [FINITION, VIE, CIEL]);
    expect(calquesDessines(avec.geo.calques)).toEqual(calquesDessines(sans.geo.calques));
    expect(avec.scene.children.length).toBe(sans.scene.children.length);
    // Les drapeaux des portiques : ceux de la vie, au même endroit (la finition n'en pose plus).
    expect(avec.geo.calques.drapeaux!.pos).toEqual(sans.geo.calques.drapeaux!.pos);
  });

  it("chaque partie se coupe : `-geometrie` garde les rebords légers, `-traces` et `-variete` aussi ; tout coupé = le palier 1", () => {
    const c = circuit("desert");
    const p1 = triangles(scene(c, []).geo.calques);
    const tout = scene(c, [FINITION], ["geometrie", "variete", "traces", "matiere", "reflets"]);
    expect(triangles(tout.geo.calques)).toBe(p1);
    expect(tout.geo.x.finition).toBeUndefined();
    const sansGeo = scene(c, [FINITION], ["geometrie"]);
    expect(sansGeo.geo.x.finition).toBeUndefined();
    expect(triangles(sansGeo.geo.calques)).toBeGreaterThan(p1); // les traces
    expect(triangles(scene(c, [FINITION], ["geometrie", "traces"]).geo.calques)).toBe(p1); // la variété ne fait que teinter
  });

  it("la variété ne déplace pas le décor : le même nombre de sommets, posés autrement (une autre suite que celle du décor)", () => {
    const c = circuit("campagne");
    const sans = scene(c, [FINITION], ["variete"]).geo.decor!.decor.pos;
    const avec = scene(c, [FINITION]).geo.decor!.decor.pos;
    expect(avec.length).toBe(sans.length);
    expect(avec).not.toEqual(sans);
  });

  it("reflets ciblés : le métal (calque `solide`) les reçoit, la route non ; jamais `scene.environment`", () => {
    const { animations, scene: s } = scene(circuit("stade"), [FINITION]);
    const a = animations[0]!;
    const maillage = (calque: string) => {
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 0, 1], 3));
      const m = new Mesh(g, new MeshStandardMaterial());
      m.userData.calque = calque;
      return m;
    };
    const route = maillage("route");
    const solide = maillage("solide");
    a.habiller!(route);
    a.habiller!(solide);
    expect([solide.material.metalness, solide.material.roughness]).toEqual([0.35, 0.42]);
    expect([route.material.metalness, route.material.roughness]).toEqual([0, 1]);
    expect(s.environment).toBeNull();
    expect(a.stats!()).toMatchObject({ geometrie: true, variete: true, traces: true, reflets: false });
  });
});
