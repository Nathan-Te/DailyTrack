import { describe, expect, it } from "vitest";
import { Color } from "three";
import { BLOCS_LOT58, CELL, FX_RESET, NO_GROUND, bankAt, blockPoint, cellKey, createFigureTrack, createSurface, curveCenter, trackWorld, turnsLeft } from "@cdj/sim";
import { DECORS_TEST } from "./decorChecks";
import { Builder } from "../src/meshKit";
import { geometrieP1 } from "../src/scene/composerP1";
import { COULEURS_EFFET } from "../src/scene/palier1";
import { MARQUE } from "../src/scene/pieces";
import { LIVREE, ecartCouleurs } from "../src/voiture/livree";

// Lot 58 : la signalétique des blocs plus complexes — chaque effet a sa couleur, loin de l'orange de la voiture et des autres effets, et chaque
// prototype se dessine au palier 1 avec son portique (rien de la simulation : le rendu seulement).

function couleurs(g: Builder): Set<number> {
  const out = new Set<number>();
  const c = new Color();
  for (let i = 0; i < g.col.length; i += 3) out.add(c.setRGB(g.col[i]!, g.col[i + 1]!, g.col[i + 2]!).getHex());
  return out;
}

describe("couleurs des blocs à effet (lot 58)", () => {
  it("jamais l'orange de la voiture (ΔE 2000 > 12), et chacune à ΔE > 12 des autres", () => {
    const effets = COULEURS_EFFET.slice(1);
    expect(effets.length).toBe(FX_RESET);
    for (const c of effets) expect(ecartCouleurs(LIVREE.orange, c), c.toString(16)).toBeGreaterThan(12);
    for (let i = 0; i < effets.length; i++) for (let j = i + 1; j < effets.length; j++) expect(ecartCouleurs(effets[i]!, effets[j]!)).toBeGreaterThan(12);
  });

  it("chaque prototype se dessine au palier 1 ; un bloc à effet pose la couleur de son portique, et rien n'approche l'orange de la voiture", () => {
    for (const e of BLOCS_LOT58) {
      const track = createFigureTrack(e.name)!;
      const g = geometrieP1(track, "stade", { headless: true });
      const vues = new Set([...couleurs(g.calques.route), ...couleurs(g.calques.solide), ...couleurs(g.calques.lumineux)]);
      for (const b of track.blocks) if (b.fx !== undefined) expect(vues.has(COULEURS_EFFET[b.fx]!), `${e.name} : portique`).toBe(true);
      vues.delete(MARQUE.livree);
      expect([...vues].filter((c) => ecartCouleurs(LIVREE.orange, c) <= 12).map((c) => c.toString(16)), e.name).toEqual([]);
    }
  });
});

describe("virage très relevé : la scène suit la route (retour de Nathan, 08/11/2026)", () => {
  // Le bord intérieur descend 10 m sous la route : un pilier posé sous l'axe perçait la moitié intérieure (« un cube gris plat au milieu de la piste »), et
  // l'herbe du décor, restée à la hauteur de l'axe, recouvrait le bas du virage.
  for (const v of [0, 1]) {
    it(`variante ${v + 1} : rien du palier 1 ni du décor ne flotte au-dessus de la route inclinée ; le sol du décor reste sous son bord intérieur`, () => {
      const track = createFigureTrack("bloc-releve-fort", v)!;
      const world = trackWorld(track);
      const g = geometrieP1(track, "stade", { headless: true, decor: DECORS_TEST.stade });
      const s = createSurface();
      for (const [nom, b] of Object.entries({ route: g.calques.route, solide: g.calques.solide, decor: g.decor!.decor, dense: g.decor!.dense })) {
        let flottent = 0;
        for (let i = 0; i < b.pos.length; i += 9) {
          const x = (b.pos[i]! + b.pos[i + 3]! + b.pos[i + 6]!) / 3;
          const y = (b.pos[i + 1]! + b.pos[i + 4]! + b.pos[i + 7]!) / 3;
          const z = (b.pos[i + 2]! + b.pos[i + 5]! + b.pos[i + 8]!) / 3;
          if (!track.cells.get(cellKey(Math.floor(x / CELL), Math.floor(z / CELL)))?.steep) continue;
          world.sample(x, z, s);
          if (s.height !== NO_GROUND && y - s.height > 0.4 && y - s.height < 12) flottent++;
        }
        expect(flottent, nom).toBe(0);
      }
      const terrain = g.decor!.terrain;
      for (const b of track.blocks.filter((x) => x.steep)) {
        const { cp, r } = curveCenter(b.kind);
        const cote = turnsLeft(b.kind) ? -1 : 1;
        const bord = r - b.w0 / 2;
        for (let i = 1; i < 24; i++) {
          const a = (Math.PI / 2) * (i / 24);
          const pt = { x: 0, z: 0 };
          blockPoint(b, cp + cote * (bord - 1) * Math.cos(a), (bord - 1) * Math.sin(a), pt);
          const h = { h: 0, gp: 0, gq: 0 };
          bankAt(b, cp + cote * bord * Math.cos(a), bord * Math.sin(a), h);
          expect(terrain.hauteur(pt.x, pt.z), `bloc ${b.index}, ${i}/24 de l'arc`).toBeLessThan(b.y0 + h.h);
        }
      }
    });
  }
});
