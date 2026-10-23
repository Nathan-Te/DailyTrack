import { describe, expect, it } from "vitest";
import { CELL, FALL_DEPTH, NO_GROUND, THEMES, cellKey, createSurface, parseTrack, trackWorld, type Block, type ThemeName, type Track } from "@cdj/sim";
import { PAS_TERRAIN, REPLAT_VIDE, TALUS_SOUS_ROUTE, releve, terrainDe } from "../src/scene/decor/commun";
import { circuitsDuTest } from "./decorChecks";

// Lot 44 : le sol relevé près de la piste (`decor/commun.ts`, `terrainDe`), pour qu'on voie le décor depuis la voiture. Il est du décor : un maillage que la
// simulation ne voit pas. Vérifié contre la simulation (`trackWorld`) sur 64 circuits (13/10 → 15/12/2026, chaque thème imposé 8 fois) : il ne touche jamais
// la surface roulante (rien dans une cellule de la piste, rien sous ce que la voiture roule), il reste sous la route, au sol lointain près d'un bloc sans
// rebords et d'un vide de saut (« il ne passe pas sous les ponts ni les sauts »), et il est bien relevé ailleurs.

const out = createSurface();
const bas = (b: Block) => Math.min(b.y0, b.y0 + b.rise);

/** Distance (m) de (x, z) au carré de la cellule (cx, cz). */
function distance(x: number, z: number, cx: number, cz: number): number {
  const dx = Math.max(cx * CELL - x, 0, x - (cx + 1) * CELL);
  const dz = Math.max(cz * CELL - z, 0, z - (cz + 1) * CELL);
  return Math.hypot(dx, dz);
}

/** Les sommets des carrés construits : (x, z, hauteur). */
function sommets(track: Track) {
  const sol = track.voidY - FALL_DEPTH;
  const t = terrainDe(track, sol);
  const vus = new Map<string, [number, number, number]>();
  for (const [i, k] of t.carres) for (const [di, dk] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) vus.set(`${i + di},${k + dk}`, [(i + di) * PAS_TERRAIN, (k + dk) * PAS_TERRAIN, t.sommet(i + di, k + dk)]);
  return { t, sol, sommets: [...vus.values()] };
}

/** Les blocs dont une cellule est à moins de `d` m de (x, z), avec la distance. */
function proches(track: Track, x: number, z: number, d: number): [Block, number][] {
  const r: [Block, number][] = [];
  const cx = Math.floor(x / CELL);
  const cz = Math.floor(z / CELL);
  const n = Math.ceil(d / CELL) + 1;
  for (let i = -n; i <= n; i++) {
    for (let j = -n; j <= n; j++) {
      const b = track.cells.get(cellKey(cx + i, cz + j));
      if (!b) continue;
      const e = distance(x, z, cx + i, cz + j);
      if (e <= d) r.push([b, e]);
    }
  }
  return r;
}

describe("le sol relevé (lot 44) : du décor, que la simulation ne voit pas", () => {
  const circuits = circuitsDuTest(Object.keys(THEMES) as ThemeName[]);

  it("rien dans une cellule de la piste, rien sous ce que la voiture roule (route, bas-côtés, parois de cuve)", () => {
    for (const c of circuits) {
      const { t } = sommets(c.track);
      const world = trackWorld(c.track);
      for (const [i, k] of t.carres) {
        const P = PAS_TERRAIN;
        expect(c.track.cells.has(cellKey(Math.floor((i * P + 1) / CELL), Math.floor((k * P + 1) / CELL))), `${c.jour} carré ${i}, ${k}`).toBe(false);
        // Le carré vu du dessus : ses coins (un peu en dedans) et son centre ne sont sur rien de ce que roule la voiture.
        for (const [u, v] of [[0.5, 0.5], [0.05, 0.05], [0.95, 0.05], [0.05, 0.95], [0.95, 0.95]] as const) {
          world.sample((i + u) * P, (k + v) * P, out);
          expect(out.height, `${c.jour} ${c.theme} : sol relevé sous la surface roulante en ${((i + u) * P).toFixed(1)}, ${((k + v) * P).toFixed(1)}`).toBe(NO_GROUND);
        }
      }
    }
  }, 240_000);

  it("il reste sous la route : 1,5 m au moins sous chaque bloc qui le touche ; au sol lointain près d'un bloc sans rebords ou d'un vide de saut", () => {
    for (const c of circuits) {
      const { sol, sommets: s } = sommets(c.track);
      for (const [x, z, h] of s) {
        for (const [b, d] of proches(c.track, x, z, REPLAT_VIDE)) {
          if (releve(b)) {
            if (d < 1e-6) expect(h, `${c.jour} ${c.theme} : (${x}, ${z}) au bord du bloc ${b.index}`).toBeLessThanOrEqual(bas(b) - TALUS_SOUS_ROUTE + 1e-6);
          } else expect(h, `${c.jour} ${c.theme} : (${x}, ${z}) à ${d.toFixed(1)} m du bloc ${b.index} (${b.open ? "sans rebords" : "vide de saut"})`).toBeLessThanOrEqual(sol);
        }
      }
    }
  }, 240_000);

  it("il est bien relevé : près de la piste, la plupart des sommets sont à 1,5 m sous la route voisine (on voit le décor depuis la voiture)", () => {
    for (const c of circuits) {
      const { sommets: s } = sommets(c.track);
      let pres = 0;
      let releves = 0;
      for (const [x, z, h] of s) {
        const voisins = proches(c.track, x, z, 0.01).filter(([b]) => releve(b));
        if (voisins.length === 0) continue;
        pres++;
        if (h >= Math.min(...voisins.map(([b]) => bas(b))) - TALUS_SOUS_ROUTE - 4.01) releves++;
      }
      expect(pres, c.jour).toBeGreaterThan(20);
      expect(releves / pres, `${c.jour} ${c.theme} : part des bords de piste relevés`).toBeGreaterThan(0.6);
    }
  }, 240_000);

  it("la hauteur en un point suit les triangles construits, et vaut le sol lointain loin de la piste", () => {
    const track = parseTrack("terrain-test", "S/n@start S S L2 S S R S S/o S S@finish");
    const sol = track.voidY - FALL_DEPTH;
    const t = terrainDe(track, sol);
    expect(t.hauteur(5000, 5000)).toBe(sol);
    for (const [i, k] of t.carres.slice(0, 40)) {
      const a = t.sommet(i, k);
      const c = t.sommet(i + 1, k + 1);
      // Le milieu de la diagonale du carré : la moyenne de ses deux bouts (au-dessus du sol lointain).
      expect(t.hauteur((i + 0.5) * PAS_TERRAIN, (k + 0.5) * PAS_TERRAIN)).toBeCloseTo(Math.max(sol, (a + c) / 2), 6);
    }
    // Un bloc sans rebords (`S/o`) : à côté de lui, le sol reste bien sous le vide où la voiture qui tombe disparaît (`voidY`, 4 m sous la route la plus basse).
    const ouvert = track.blocks.find((b) => b.open)!;
    const x = ouvert.cx * CELL + CELL / 2;
    const z = ouvert.cz * CELL + CELL / 2;
    for (const [dx, dz] of [[CELL / 2 + 4, 0], [-CELL / 2 - 4, 0], [0, CELL / 2 + 4], [0, -CELL / 2 - 4]] as const) {
      if (!track.cells.has(cellKey(Math.floor((x + dx) / CELL), Math.floor((z + dz) / CELL)))) expect(t.hauteur(x + dx, z + dz)).toBeLessThan(track.voidY - 3);
    }
  });
});
