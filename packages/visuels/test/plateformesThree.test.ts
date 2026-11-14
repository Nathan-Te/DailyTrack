import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { restLook, THEMES, type Grille } from "../src/plateformes";
import { Art, buildParallax, buildTileArt, creerPersonnage, insideTiles, layerOffset, visibleLayers, type CodesTuiles } from "../src/plateformesThree";

// Lot DA2 (partie 2) — le dessinateur des plateformes : aucun nom de jeu, aucun code de case en dur, la même chose pour tout jeu qui lui donne une grille.
const DOSSIER = new URL("../src/plateformesThree/", import.meta.url);

describe("le dessinateur ne dépend d'aucun jeu", () => {
  it("n'importe que le module de description, le socle et Three.js ; aucun nom de jeu", () => {
    for (const f of readdirSync(DOSSIER)) {
      const s = readFileSync(new URL(f, DOSSIER), "utf8");
      for (const m of s.matchAll(/^(?:import|export)[^\n]*from "([^"]+)"/gm)) expect(m[1], `${f} : ${m[0]}`).toMatch(/^(\.\/|\.\.\/plateformes$|three$|@cdj\/core$)/);
      expect(s, f).not.toMatch(/\b(jump|tower|blocks|track|gravity|vertige|cibles|rush)\b/i);
      expect(s, f).not.toMatch(/Math\.random|Date\.now|performance\.now/);
    }
  });
});

// Un jeu imaginaire : 1 = plein, 2 = glace, 3 = tapis vers la droite, 4 = pic, 0 = vide.
const CODES: CodesTuiles = { estMatiere: (t) => t === 1 || t === 2 || t === 3, estGlace: (t) => t === 2, estPic: (t) => t === 4, sensTapis: (t) => (t === 3 ? 1 : 0), vide: 0 };
const GRILLE: Grille = { width: 8, height: 4, tiles: Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 3, 3, 1]) };
const LIBRE = new Float32Array(32).fill(9);

describe("les tuiles d'une grille quelconque", () => {
  it("chaque thème dessine, de façon déterministe, et la géométrie reste dans les tuiles pleines", () => {
    for (const nom of Object.keys(THEMES) as (keyof typeof THEMES)[]) {
      const a = buildTileArt(GRILLE, THEMES[nom].tiles, CODES, LIBRE);
      const b = buildTileArt(GRILLE, THEMES[nom].tiles, CODES, LIBRE);
      expect(a.tiles).toBe(8);
      expect(a.chunks.map((c) => c.art.pos)).toEqual(b.chunks.map((c) => c.art.pos));
      for (const c of a.chunks) expect(insideTiles(GRILLE, c.art, CODES.estMatiere)).toBe(true);
    }
  });
  it("la parallaxe : un plan par couche, des couleurs par sommet, un placement qui suit la caméra", () => {
    for (const nom of Object.keys(THEMES) as (keyof typeof THEMES)[]) {
      const t = THEMES[nom];
      const plans = buildParallax(t, 40, "essai");
      expect(plans).toHaveLength(t.parallax.length);
      for (const p of plans) expect(p.art.col.length).toBe(p.art.pos.length);
      expect(layerOffset(t.parallax[0]!, 10, 5, 5).x).toBeCloseTo(10 * (1 - t.parallax[0]!.factor));
      expect(visibleLayers(3, true)).toBe(1);
    }
  });
  it("le tampon Art range les couleurs en linéaire", () => {
    const a = new Art();
    a.rect(0, 0, 1, 1, 0, 0xffffff);
    expect(a.triangles).toBe(2);
    expect(a.col.every((c) => c === 1)).toBe(true);
  });
});

describe("le personnage", () => {
  it("un cube, deux yeux, deux pieds ; au repos, corps et pieds remplissent la boîte", () => {
    const p = creerPersonnage({ couleur: 0xffd23f, largeur: 0.8, hauteur: 1.2 });
    const feet = p.groupe.children[0]!;
    expect(feet.children).toHaveLength(3); // torse, deux pieds
    p.poser({ look: restLook() });
    expect(feet.scale.x).toBeCloseTo(1);
    expect(feet.scale.y).toBeCloseTo(1);
  });
});
