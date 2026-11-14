import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BLOCK_STYLE, LOOK, STEP, STRIDE_TILES, THEMES, THEME_NAMES, WIND_STYLE, animateLook, backdropColors, depthColor, neighbourMask, restLook, solidColors, tileShape, type Grille } from "../src/plateformes";

// Lot DA2 — la DESCRIPTION d'un décor de plateformes : aucun moteur de rendu, aucun nom de jeu, des thèmes bien formés.
const FICHIERS = ["couleurs", "themes", "tuiles", "decor", "personnage", "mecaniques", "index"];
const source = (f: string): string => readFileSync(new URL(`../src/plateformes/${f}.ts`, import.meta.url), "utf8");

describe("la description ne dépend d'aucun moteur de rendu ni d'aucun jeu", () => {
  it("aucun import hors du dossier, rien du navigateur, aucun nom de jeu", () => {
    for (const f of FICHIERS) {
      const s = source(f);
      for (const m of s.matchAll(/^(?:import|export)[^\n]*from "([^"]+)"/gm)) expect(m[1], `${f} : ${m[0]}`).toMatch(/^\.\//);
      expect(s, f).not.toMatch(/\b(document|window|navigator|HTMLCanvasElement|CanvasRenderingContext2D|WebGL)\b|Math\.random|Date\.now|performance\.now/);
      expect(s, f).not.toMatch(/\b(jump|tower|blocks|track|gravity|vertige|cibles|rush)\b/i);
    }
  });
  it("le dossier ne contient que ces fichiers (un dessinateur s'ajoutera à côté, pas dedans)", () => {
    const tous = readdirSync(new URL("../src/plateformes/", import.meta.url)).map((f) => f.replace(/\.ts$/, "")).sort();
    expect(tous).toEqual([...FICHIERS].sort());
  });
});

describe("les cinq thèmes", () => {
  it("forêt, usine, glace, nuit, néon, chacun complet", () => {
    expect([...THEME_NAMES]).toEqual(["foret", "usine", "glace", "nuit", "neon"]);
    for (const n of THEME_NAMES) {
      const t = THEMES[n];
      expect(t.name).toBe(n);
      expect(t.decor.length).toBeGreaterThan(0);
      expect(t.parallax.length).toBeGreaterThan(0);
      expect(t.palette.player).toBe(0xffd23f);
      expect(t.palette.hazard).toBe(0xff3b3b);
      expect(backdropColors(t).length).toBe(1 + 2 * t.parallax.length);
      expect(solidColors(t)).toHaveLength(8);
      expect(depthColor(t.tiles, 0)).toBe(t.tiles.face);
      expect(depthColor(t.tiles, 9)).toBe(t.tiles.deep);
    }
  });
  it("aucune forme de décor pointue : rectangle, disque ou demi-disque", () => {
    for (const n of THEME_NAMES) for (const k of THEMES[n].decor) for (const p of k.parts) expect(["rect", "disque", "demi"]).toContain(p.shape);
  });
});

describe("l'assemblage des tuiles", () => {
  it("256 masques, une forme chacune ; un bloc isolé a quatre faces et quatre coins", () => {
    for (let m = 0; m < 256; m++) expect(tileShape(m)).toBeDefined();
    const seul = tileShape(0);
    expect([seul.top, seul.right, seul.bottom, seul.left]).toEqual([true, true, true, true]);
    expect(seul.outer).toEqual([true, true, true, true]);
    expect(tileShape(255).interior).toBe(true);
  });
  it("le jeu dit ce qui est de la matière ; hors grille, les côtés et le haut sont pleins, le bas est ouvert", () => {
    const g: Grille = { width: 3, height: 2, tiles: Uint8Array.from([0, 0, 0, 1, 1, 1]) };
    const matiere = (t: number) => t === 1;
    expect(neighbourMask(g, 1, 0, matiere)).toBe(neighbourMask(g, 1, 0, matiere));
    const bas = neighbourMask(g, 1, 1, matiere);
    expect(tileShape(bas).bottom).toBe(true);
  });
});

describe("le personnage et les blocs à mécanique", () => {
  it("les réglages gardent leurs valeurs ; les pieds suivent la distance, pas le temps", () => {
    expect(LOOK.takeoff).toBe(-0.36);
    expect(LOOK.landing).toBe(0.55);
    expect(STEP.cycle).toBe(2 * STRIDE_TILES);
    const m = { vx: 8, vyUp: 0, ground: true, slide: 0, runSpeed: 11, fallSpeed: 22 };
    const a = animateLook({ ...restLook(), stride: 0.4 }, 1 / 60, m);
    const b = animateLook({ ...restLook(), stride: 0.4 }, 1 / 30, m);
    expect(a.pose).toBe("course");
    expect(b.pose).toBe("course");
  });
  it("les couleurs des blocs à mécanique ne prennent ni le rouge des dangers ni le jaune du personnage", () => {
    for (const c of [BLOCK_STYLE.blink.fill, BLOCK_STYLE.altA.fill, BLOCK_STYLE.altB.fill, WIND_STYLE.leaf, WIND_STYLE.arrow]) {
      expect(c).not.toBe(0xff3b3b);
      expect(c).not.toBe(0xffd23f);
    }
  });
});
