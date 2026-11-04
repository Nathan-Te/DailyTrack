import { describe, expect, it } from "vitest";
import { PIECES } from "@cdj/blocks-sim";
import { PALETTE_PORT } from "@cdj/visuels/blocs";
import { boitesDeCases, boitesDePiece, casesDe } from "../src/boites";
import { couleurDeFamille } from "../src/couleurs";

describe("les boîtes du dessin", () => {
  it("une boîte par suite de cases d'une ligne ; l'aire des boîtes est celle de la pièce, centrée sur la boîte englobante", () => {
    for (const p of PIECES) {
      const b = boitesDePiece(p);
      expect(b.reduce((n, x) => n + (x.hw * 2 * (x.hh * 2)) / 64, 0), p.nom).toBe(p.cases);
      expect(casesDe(p)).toHaveLength(p.cases);
      const x0 = Math.min(...b.map((x) => x.cx - x.hw));
      const x1 = Math.max(...b.map((x) => x.cx + x.hw));
      const y0 = Math.min(...b.map((x) => x.cy - x.hh));
      const y1 = Math.max(...b.map((x) => x.cy + x.hh));
      expect([x0, x1, y0, y1], p.nom).toEqual([(-p.largeur * 8) / 2, (p.largeur * 8) / 2, (-p.hauteur * 8) / 2, (p.hauteur * 8) / 2]);
    }
  });
  it("le coin de 3 cases a 2 boîtes (une par ligne), le carré 3 × 3 en a 3, la barre horizontale 1", () => {
    expect(boitesDePiece(PIECES.find((p) => p.nom === "coin-0")!)).toHaveLength(2);
    expect(boitesDePiece(PIECES.find((p) => p.nom === "carre3-0")!)).toHaveLength(3);
    expect(boitesDePiece(PIECES.find((p) => p.nom === "barre5-0")!)).toHaveLength(1);
    expect(boitesDeCases([{ col: 0, ligne: 0 }, { col: 2, ligne: 0 }], 0, 0)).toHaveLength(2); // deux cases séparées : deux boîtes
  });
  it("chaque famille a une couleur de la palette de Tower (le rectangle, un mélange de deux d'entre elles : voir palettes.test.ts)", () => {
    for (const p of PIECES.filter((x) => x.famille !== "rectangle")) expect(Object.values(PALETTE_PORT.pieces)).toContain(couleurDeFamille(PALETTE_PORT, p.famille));
  });
});
