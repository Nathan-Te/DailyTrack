import { describe, expect, it } from "vitest";
import { blockShape, empreinte, enchainementsCommuns, jaccard, ressemblance, shapesOf } from "../src/index";

// Lot 49 : la mesure de ressemblance entre circuits (ressemblance.ts) — celle qui dit, avant et après le lot, si deux circuits se jouent pareil.
describe("ressemblance entre circuits (lot 49)", () => {
  const a = { spec: "S/n@start S L2 R2 S P S S K GD S S S L2 S@finish", figures: ["s-large", "saut-plat", "virage"] };

  it("un circuit comparé à lui-même vaut 1 ; deux circuits sans rien en commun, 0", () => {
    expect(ressemblance(empreinte(a), empreinte(a)).total).toBe(1);
    const b = { spec: "S/e@start V V V V S/g S/g S/g S/g@finish", figures: ["cuve", "glace"] };
    expect(ressemblance(empreinte(a), empreinte(b)).total).toBe(0);
  });

  it("la forme des blocs ignore la largeur, les repères, les bas-côtés et le sens absolu : un circuit et son miroir se ressemblent entièrement", () => {
    const miroir = { spec: "S/l@start S/~h R2 L2 S P S S K GD S S S R2 S@finish", figures: a.figures };
    expect(shapesOf(miroir.spec)).toEqual(shapesOf(a.spec));
    expect(ressemblance(empreinte(a), empreinte(miroir)).total).toBe(1);
  });

  it("le sens d'un virage se lit par rapport au précédent ; revêtement, relevé, cuve et dénivelé comptent", () => {
    expect(blockShape("L2", null).shape).toBe("V2");
    expect(blockShape("L2", true).shape).toBe("V2+");
    expect(blockShape("R3/b", true).shape).toBe("V3b-");
    expect(blockShape("S/t", null).shape).toBe("S:dirt");
    expect(blockShape("ML", null).shape).toBe("M");
    expect(blockShape("GD2", null).shape).toBe("gap-2");
  });

  it("l'ordre des figures compte : mêmes figures dans un autre ordre = moins semblables", () => {
    const meme = ressemblance(empreinte(a), empreinte({ spec: a.spec, figures: ["s-large", "saut-plat", "virage"] })).figures;
    const autre = ressemblance(empreinte(a), empreinte({ spec: a.spec, figures: ["virage", "s-large", "saut-plat"] })).figures;
    expect(meme).toBe(1);
    expect(autre).toBeLessThan(1);
    expect(autre).toBeGreaterThan(0);
    expect(enchainementsCommuns(["a", "b", "c"], ["c", "a", "b"])).toEqual(["a→b"]);
  });

  it("Jaccard : deux ensembles vides valent 1, l'intersection sur la réunion sinon", () => {
    expect(jaccard(new Set(), new Set())).toBe(1);
    expect(jaccard(new Set(["x", "y"]), new Set(["y", "z"]))).toBeCloseTo(1 / 3, 12);
  });
});
