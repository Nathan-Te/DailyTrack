import { describe, expect, it } from "vitest";
import { BufferAttribute, BufferGeometry } from "three";
import { CELL, cellKey, parseTrack } from "@cdj/sim";
import { Builder, seeded } from "../src/meshKit";
import { placesDeDecor } from "../src/scene/composer";
import { THEMES_C, occlusionSommets, uvMonde } from "../src/scene/directionC";
import { THEMES_A } from "../src/scene/directionA";
import { REBORDS_B } from "../src/scene/directionB";
import { HORIZONS } from "../src/scene/types";
import { STYLE_ORIGINE, construireRoute, type TronconRebord } from "../src/scene/route";
import { PALETTE_DEFS } from "../src/trackMesh";

// Lot 38 : le code des directions de la scène (src/scene), repris tel quel par les lots de mise en œuvre. Ce qui se teste sans carte graphique :
// les règles de pose du décor, la route paramétrable, l'occlusion par sommets, les palettes (Stade et Nuit ne se ressemblent plus). Le rendu de
// chaque direction se vérifie dans la vitrine (e2e/vitrine.spec.ts).

const PISTE = "S/n@start S S L2 S S R S S L S S R3 S S S@finish";

/** Luminance relative (0–1) d'une couleur 0xRRGGBB. */
const lum = (c: number) => (0.2126 * ((c >> 16) & 255) + 0.7152 * ((c >> 8) & 255) + 0.0722 * (c & 255)) / 255;

describe("règles de pose du décor (lot 37, reprises par le lot 38)", () => {
  const track = parseTrack("vitrine-test", PISTE);
  const places = placesDeDecor(track, seeded("vitrine-test:stade"), () => 2);

  it("rien sur la piste : aucune place dans une cellule de la piste", () => {
    expect(places.length).toBeGreaterThan(20);
    for (const p of places) {
      expect(track.cells.has(cellKey(Math.floor(p.x / CELL), Math.floor(p.z / CELL))), `${p.x}, ${p.z}`).toBe(false);
      // À 3 m au moins du bord de sa cellule.
      expect(p.x - p.cx * CELL).toBeGreaterThanOrEqual(3);
      expect((p.cx + 1) * CELL - p.x).toBeGreaterThanOrEqual(3);
    }
  });

  it("rien dans le passage : une cellule voisine entourée par la piste (trois cellules de piste ou plus) reste vide", () => {
    for (const p of places) {
      if (p.anneau !== 1) continue;
      let voisines = 0;
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if ((i || j) && track.cells.has(cellKey(p.cx + i, p.cz + j))) voisines++;
      expect(voisines, `cellule ${p.cx}, ${p.cz}`).toBeLessThan(3);
    }
  });

  it("le même décor pour tout le monde : même graine, mêmes places", () => {
    const b = placesDeDecor(track, seeded("vitrine-test:stade"), () => 2);
    expect(b).toEqual(places);
  });
});

describe("route paramétrable (lot 38)", () => {
  it("le style reçoit chaque tronçon de rebord, des deux côtés, bandes alignées sur la distance parcourue", () => {
    const track = parseTrack("vitrine-test", PISTE);
    const troncons: TronconRebord[] = [];
    const style = { ...STYLE_ORIGINE, rebord: (_g: Builder, t: TronconRebord) => void troncons.push(t) };
    construireRoute(track, PALETTE_DEFS.stade, style, { route: new Builder(), lumineux: new Builder() }, track.voidY - 4);
    const gauche = troncons.filter((t) => t.cote === "left");
    const droite = troncons.filter((t) => t.cote === "right");
    expect(gauche.length).toBeGreaterThan(10);
    expect(droite.length).toBe(gauche.length);
    // La distance parcourue le long d'un bord ne fait que croître, d'un tronçon au suivant, et vaut la somme des longueurs.
    for (let i = 1; i < gauche.length; i++) expect(gauche[i]!.s).toBeCloseTo(gauche[i - 1]!.s + gauche[i - 1]!.longueur, 6);
    for (const t of troncons) expect(Math.hypot(t.dehors[0], t.dehors[1])).toBeCloseTo(1, 6);
  });
});

describe("occlusion par sommets et coordonnées « monde » (direction C)", () => {
  /** Un mur vertical de 1,4 m (deux triangles) et un sol (deux triangles), en blanc. */
  function murEtSol(): BufferGeometry {
    const b = new Builder();
    b.quad([0, 0, 0], [4, 0, 0], [4, 1.4, 0], [0, 1.4, 0], 0xffffff);
    b.quad([0, 0, 0], [0, 0, 4], [4, 0, 4], [4, 0, 0], 0xffffff);
    return b.geometry();
  }

  it("le pied d'un mur s'assombrit, son haut presque pas, le sol pas du tout", () => {
    const g = murEtSol();
    occlusionSommets(g, 1);
    const pos = g.getAttribute("position") as BufferAttribute;
    const col = g.getAttribute("color") as BufferAttribute;
    for (let i = 0; i < 6; i++) {
      const y = pos.getY(i);
      expect(col.getX(i), `mur, y = ${y}`).toBeCloseTo(y === 0 ? 0.5 : 1 - 0.5 * (1 - 1.4 / 1.6), 5);
    }
    for (let i = 6; i < 12; i++) expect(col.getX(i)).toBe(1);
  });

  it("chaque face reçoit des coordonnées de texture, projetées sur son plan", () => {
    const g = murEtSol();
    uvMonde(g, 4);
    const uv = g.getAttribute("uv") as BufferAttribute;
    expect(uv.count).toBe(12);
    // Le mur (plan x, y) : u = x / 4, v = y / 4 ; le sol (plan x, z) : u = x / 4, v = z / 4.
    expect(uv.getX(2)).toBeCloseTo(1, 6);
    expect(uv.getY(2)).toBeCloseTo(1.4 / 4, 6);
    expect(uv.getX(8)).toBeCloseTo(1, 6);
    expect(uv.getY(8)).toBeCloseTo(1, 6);
  });
});

describe("palettes et lumière par thème (lot 38)", () => {
  it("chaque palette a sa ligne dans A et C, un rebord de B et un horizon", () => {
    for (const nom of Object.keys(PALETTE_DEFS)) {
      expect(THEMES_A, nom).toHaveProperty(nom);
      expect(THEMES_C, nom).toHaveProperty(nom);
      expect(REBORDS_B, nom).toHaveProperty(nom);
      expect(HORIZONS, nom).toHaveProperty(nom);
    }
  });

  it("Stade et Nuit ne se ressemblent plus : ciel, lumière, horizon, rebords", () => {
    const s = THEMES_C.stade;
    const n = THEMES_C.nuit;
    expect(lum(s.ciel[2]) - lum(n.ciel[2]), "horizon du ciel").toBeGreaterThan(0.6);
    expect(s.soleil[1] / n.soleil[1], "soleil contre lune").toBeGreaterThan(5);
    expect(s.hemi[2] / n.hemi[2], "lumière du ciel").toBeGreaterThan(3);
    expect(n.lampes, "la nuit, des lampes éclairent la piste").toBeDefined();
    expect(HORIZONS.stade).not.toBe(HORIZONS.nuit);
    expect(THEMES_A.stade.rebord).not.toEqual(THEMES_A.nuit.rebord);
  });

  it("la route reste un gris, jamais brun ni vert : on ne la confond pas avec la terre, le sable ou l'herbe d'un bloc", () => {
    for (const [nom, t] of Object.entries(THEMES_A)) {
      for (const c of t.route) {
        const r = (c >> 16) & 255;
        const g = (c >> 8) & 255;
        const b = c & 255;
        // Chaleur (rouge − bleu) sous 24 : la terre `8f6b43` en a 76, le sable `f2d690` 98 ; un gris froid (Banquise, Nuit) est permis.
        expect(r - b, `${nom} ${c.toString(16)} : brun`).toBeLessThan(24);
        // Vert sous 15 : l'herbe `58a340` en a 85.
        expect(g - (r + b) / 2, `${nom} ${c.toString(16)} : vert`).toBeLessThan(15);
      }
    }
  });
});
