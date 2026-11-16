import { createHash } from "node:crypto";
import { DANGERS_LEVEL, ESSAI_LEVEL, SANDBOX_LEVEL, parseLevel, type Level } from "@cdj/jump-sim";
import { PALETTES } from "../src/palette";
import { STEP } from "../src/look";
import { creerPersonnage } from "@cdj/visuels/plateformes/three";
import { describe, expect, it } from "vitest";
import { mixColor } from "../src/feel";
import { buildParallax } from "../src/parallax";
import { buildBeltArt } from "../src/surfaceArt";
import { THEMES, THEME_NAMES } from "../src/themes";
import { buildTileArt, sensDuPic } from "../src/tileArt";
import { PIQUE, trianglesDePiques } from "@cdj/visuels/plateformes";

// Lot DA2 (partie 2) : le dessin de Jump est le même qu'avant l'extraction du dessinateur dans `@cdj/visuels/plateformes/three`. Il n'y a pas de capture en
// pixels de référence : la preuve est l'empreinte de la **géométrie** dessinée (positions, couleurs par sommet, indices) des tuiles, de la parallaxe et des
// chevrons des tapis, sur quatre niveaux fixes × cinq thèmes. Elle ne change que si l'apparence de Jump change : c'est alors une décision de Nathan, qui se
// voit dans tous les jeux qui lisent le module (l'empreinte se remesure alors ici ; la valeur actuelle est celle du code d'avant l'extraction).
const h = (x: unknown) => createHash("sha1").update(JSON.stringify(x)).digest("hex");
const art = (a: { pos: number[]; col: number[]; idx: number[]; triangles: number }) => [a.pos, a.col, a.idx, a.triangles];

const SURF = parseLevel(["........................", "S.....................F.", "###[[[[[###]]]]###~~~~~~"].join("\n") + "\n");
const NIVEAUX: [string, Level][] = [["essai", ESSAI_LEVEL], ["dangers", DANGERS_LEVEL], ["sandbox", SANDBOX_LEVEL], ["surf", SURF]];

describe("le dessin de Jump n'a pas bougé", () => {
  it("tuiles, parallaxe et chevrons : même géométrie, au bit près (4 niveaux × 5 thèmes)", () => {
    const tout: unknown[] = [];
    for (const [id, level] of NIVEAUX) {
      for (const n of THEME_NAMES) {
        const t = buildTileArt(level, THEMES[n].tiles);
        tout.push([id, n, t.tiles, t.interior, t.hazardFaces, t.chunks.map((c) => [c.col0, c.col1, art(c.art)])]);
        tout.push(buildParallax(THEMES[n], level.width, id).map((l) => art(l.art)));
      }
      tout.push(buildBeltArt(level, 32).chunks.map((c) => [c.col0, c.col1, c.pos, c.dir, c.band, c.idx]));
    }
    expect(h(tout)).toBe("c55ca2344221a12435236c339e7af9caf7994ea3");
  });

  // Lot PG1 : les piques (avec cerne) sont un dessin commun de `@cdj/visuels`. L'empreinte est celle des triangles que Jump calculait lui-même avant de les lui confier (scene.ts, `spikeTriangles`), sur les niveaux de
  // Jump et un niveau qui a les quatre sens : la forme et le cerne n'ont pas bougé d'un bit.
  it("les piques : même triangles, même cerne, au bit près (quatre niveaux)", () => {
    const TOUS = parseLevel(["S...^..F", "..<..>..", "...v....", "########"].join("\n") + "\n");
    const f32 = (a: number[]) => Array.from(new Float32Array(a));
    const tout = [ESSAI_LEVEL, DANGERS_LEVEL, SANDBOX_LEVEL, TOUS].map((l) => [f32(trianglesDePiques(l, sensDuPic)), f32(trianglesDePiques(l, sensDuPic, PIQUE.cerne))]);
    expect(h(tout)).toBe("e47601db6664f759c1123f512c3110958ae71d71");
  });

  it("le personnage : les pieds sont la couleur du corps assombrie de 45 %, comme avant (toutes les palettes)", () => {
    for (const p of Object.values(PALETTES)) {
      const perso = creerPersonnage({ couleur: p.player, largeur: 0.8, hauteur: 1.2 });
      const feet = perso.groupe.children[0]!;
      const pied = feet.children[1] as unknown as { material: { color: { getHex(): number } } };
      expect(pied.material.color.getHex()).toBe(mixColor(p.player, 0x000000, 0.45));
      expect(feet.children).toHaveLength(3);
      expect(STEP.leg).toBeGreaterThan(0);
    }
  });
});
