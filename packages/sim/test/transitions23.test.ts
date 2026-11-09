import { describe, expect, it } from "vitest";
import { CELL, NO_GROUND, TRANSITIONS_LOT57, blockPoint, buildFigure, createSurface, curveCenter, isCurve, parseTrack, trackWorld, type Block, type Track, type WidthLetter } from "../src/index";

// Lot 57b : chaque transition de la grammaire est une surface continue — en suivant la ligne médiane de la route, bloc après bloc, la hauteur du sol ne fait jamais de marche (la
// pente de la route la plus forte du jeu est 0,375 ; on tolère 0,6) et il y a toujours du sol : la transition (crête, creux, dévers, virage en pente, S relevé, rétrécissement,
// revêtement en appui) se pilote, elle ne saute pas.
const WIDTHS: readonly WidthLetter[] = ["e", "n", "l"];
const PAS = 0.25;
const PENTE_MAX = 0.6;

/** Points de la ligne médiane d'un bloc, de l'entrée à la sortie, tous les `PAS` mètres. */
function ligne(b: Block): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [];
  const pt = { x: 0, z: 0 };
  if (isCurve(b.kind)) {
    const { cp, r } = curveCenter(b.kind);
    const side = cp > CELL / 2 ? -1 : 1;
    const n = Math.ceil((r * Math.PI) / 2 / PAS);
    for (let i = 0; i <= n; i++) {
      const a = (Math.PI / 2) * (i / n);
      blockPoint(b, cp + side * r * Math.cos(a), r * Math.sin(a), pt);
      out.push({ x: pt.x, z: pt.z });
    }
  } else {
    const n = Math.ceil(CELL / PAS);
    for (let i = 0; i <= n; i++) {
      blockPoint(b, CELL / 2, (CELL * i) / n, pt);
      out.push({ x: pt.x, z: pt.z });
    }
  }
  return out;
}

function hauteurs(track: Track): { h: number; ds: number }[] {
  const world = trackWorld(track);
  const surf = createSurface();
  const out: { h: number; ds: number }[] = [];
  let prev: { x: number; z: number } | null = null;
  for (const [k, b] of track.blocks.entries()) {
    // Le dernier point du dernier bloc est sur le bord de la cellule d'après (il n'y en a pas) : pas de sol à y lire.
    for (const p of k === track.blocks.length - 1 ? ligne(b).slice(0, -1) : ligne(b)) {
      world.sample(p.x, p.z, surf);
      out.push({ h: surf.height, ds: prev ? Math.hypot(p.x - prev.x, p.z - prev.z) : 0 });
      prev = p;
    }
  }
  return out;
}

describe("lot 57b : la surface de chaque transition est continue", () => {
  for (const e of TRANSITIONS_LOT57) {
    it(`${e.name} : du sol partout et aucune marche (pente ≤ ${PENTE_MAX}) le long de la ligne médiane, chaque variante, deux sens, trois largeurs`, () => {
      let mesures = 0;
      for (let v = 0; v < e.variants; v++)
        for (const left of [true, false])
          for (const w of WIDTHS) {
            const body = buildFigure(e, left, w, v);
            if (!body) continue;
            const spec = [`S/${w}@start`, "S", "S", ...(body[0] === "S" ? body.slice(1) : body), "S", "S@finish"].join(" ");
            const hs = hauteurs(parseTrack(`t-${e.name}`, spec));
            for (let i = 0; i < hs.length; i++) {
              expect(hs[i]!.h, `${e.name} v${v} ${left ? "L" : "R"} ${w} point ${i} : pas de sol`).not.toBe(NO_GROUND);
              if (i > 0 && hs[i]!.ds > 0) {
                const pente = Math.abs(hs[i]!.h - hs[i - 1]!.h) / hs[i]!.ds;
                expect(pente, `${e.name} v${v} ${left ? "L" : "R"} ${w} point ${i} : marche de ${(hs[i]!.h - hs[i - 1]!.h).toFixed(2)} m`).toBeLessThanOrEqual(PENTE_MAX);
              }
              mesures++;
            }
          }
      expect(mesures).toBeGreaterThan(100);
    });
  }
});
