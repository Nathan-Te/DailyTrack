import { describe, expect, it } from "vitest";
import { contourDe, enQuads, type PiecePlacee } from "../src/contour";

// Lot T6 — le contour : UN seul trait pour la silhouette de la tour du fantôme (les arêtes intérieures ou collées entre pièces n'en font pas partie), et le contour de l'arrivée de la visée.
const O = (x: number, y: number, angle = 0): PiecePlacee => ({ kind: "O", rot: 0, taille: "normale", x, y, angle });
const longueur = (segs: ReturnType<typeof contourDe>): number => segs.reduce((n, s) => n + Math.hypot(s.x1 - s.x0, s.y1 - s.y0), 0);

describe("le contour d'une silhouette", () => {
  it("un carré de 2 m : un contour de 8 m, quatre côtés", () => {
    const segs = contourDe([O(0, 1)]);
    expect(longueur(segs)).toBeCloseTo(8, 6);
    expect(segs).toHaveLength(4);
  });

  it("deux carrés côte à côte (collés) : le contour du rectangle de 4 × 2, sans l'arête qu'ils partagent (12 m, pas 16)", () => {
    expect(longueur(contourDe([O(-1, 1), O(1, 1)]))).toBeCloseTo(12, 6);
  });

  it("deux carrés collés avec un jour de 4 mm (des pièces posées justes) : le jour ne fait pas de trait", () => {
    expect(longueur(contourDe([O(-1.002, 1), O(1.002, 1)]))).toBeCloseTo(12, 1);
  });

  it("un carré sur un carré : la colonne de 2 × 4, contour de 12 m", () => {
    expect(longueur(contourDe([O(0, 1), O(0, 3)]))).toBeCloseTo(12, 6);
  });

  it("une pièce de plusieurs boîtes (un T) : son contour fait 10 m (le périmètre d'un tétromino en T), sans la jonction de la tête et de la queue", () => {
    const segs = contourDe([{ kind: "T", rot: 0, taille: "normale", x: 0, y: 0.75, angle: 0 }]);
    expect(longueur(segs)).toBeCloseTo(10, 6);
  });

  it("une tour de vingt carrés : un seul contour, moins de segments que de pièces × 4", () => {
    const tour = Array.from({ length: 20 }, (_, i) => O(0, 1 + 2 * i));
    const segs = contourDe(tour);
    expect(longueur(segs)).toBeCloseTo(2 * (2 + 40), 6);
    expect(segs.length).toBeLessThanOrEqual(4 * 20 + 4);
  });

  it("une pièce inclinée reste un contour fermé : le périmètre ne change pas avec l'angle", () => {
    expect(longueur(contourDe([O(0, 1, 0.3)]))).toBeCloseTo(8, 6);
  });
});

describe("les segments deviennent des rectangles d'un seul maillage", () => {
  it("six sommets par segment, trois coordonnées chacun", () => {
    const segs = contourDe([O(0, 1)]);
    expect(enQuads(segs, 0.06)).toHaveLength(segs.length * 6 * 3);
  });
});
