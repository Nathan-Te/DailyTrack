import { describe, expect, it } from "vitest";
import { LIGNES_BILAN_MAX, ecrireBilan, pointsDAide } from "../src/jeu/bilan";
import { CATALOGUE_KIT_EN, CATALOGUE_KIT_FR } from "../src/jeu/catalogue";
import type { BilanPartie, Traduire } from "../src/jeu/types";

// Lot PG2 — le bilan d'une partie (écran de fin) et les pas de « Comment jouer » avec leur dessin : la partie pure. Les écrans eux-mêmes sont essayés sur « Cibles » (`apps/cibles/e2e/fin-et-aide.spec.ts`).
const t: Traduire = (cle, params) => `${cle}${params ? JSON.stringify(params) : ""}`;

describe("le bilan : écrit par le catalogue du jeu", () => {
  it("la cause puis les lignes, libellé traduit, valeur telle que le jeu l'a écrite", () => {
    const bilan: BilanPartie = { cause: { cle: "bilan.cause", params: { piege: 3 } }, lignes: [{ cle: "bilan.distance", valeur: "1 234 m" }, { cle: "bilan.pieces", valeur: "56" }] };
    expect(ecrireBilan(bilan, t)).toEqual({ cause: 'bilan.cause{"piege":3}', lignes: [{ libelle: "bilan.distance", valeur: "1 234 m" }, { libelle: "bilan.pieces", valeur: "56" }] });
  });

  it("sans bilan, ou un bilan vide : rien à montrer (l'écran de fin est celui d'avant)", () => {
    expect(ecrireBilan(null, t)).toBeNull();
    expect(ecrireBilan(undefined, t)).toBeNull();
    expect(ecrireBilan({ lignes: [] }, t)).toBeNull();
    expect(ecrireBilan({ lignes: [{ cle: "x", valeur: "  " }] }, t)).toBeNull();
  });

  it("une cause seule, des lignes seules : l'une ou l'autre suffit ; une valeur vide est ignorée", () => {
    expect(ecrireBilan({ cause: { cle: "c" }, lignes: [] }, t)).toEqual({ cause: "c", lignes: [] });
    expect(ecrireBilan({ lignes: [{ cle: "a", valeur: "1" }, { cle: "b", valeur: "" }] }, t)).toEqual({ cause: null, lignes: [{ libelle: "a", valeur: "1" }] });
  });

  it(`au plus ${LIGNES_BILAN_MAX} lignes (l'écran reste lisible en paysage sur un téléphone)`, () => {
    const lignes = Array.from({ length: 20 }, (_, i) => ({ cle: `l${i}`, valeur: String(i) }));
    expect(ecrireBilan({ lignes }, t)!.lignes).toHaveLength(LIGNES_BILAN_MAX);
    expect(ecrireBilan({ lignes }, t)!.lignes[0]!.libelle).toBe("l0");
  });
});

describe("« Comment jouer » : un dessin à côté d'un pas", () => {
  const dessin = (): SVGElement => ({}) as SVGElement;
  it("sans table de dessins, les pas sont leurs clés (le « Comment jouer » d'avant)", () => {
    expect(pointsDAide(["a", "b"])).toEqual([{ cle: "a" }, { cle: "b" }]);
    expect(pointsDAide(["a", "b"], {})).toEqual([{ cle: "a" }, { cle: "b" }]);
  });
  it("un pas reçoit son dessin par sa clé ; une entrée qui ne nomme aucun pas est ignorée ; l'ordre est celui de l'aide", () => {
    const p = pointsDAide(["a", "b", "c"], { b: dessin, inconnu: dessin });
    expect(p.map((x) => x.cle)).toEqual(["a", "b", "c"]);
    expect(p.map((x) => x.dessin)).toEqual([undefined, dessin, undefined]);
  });
  it("une clé héritée de l'objet (`constructor`, `toString`) n'est jamais prise pour un dessin", () => {
    expect(pointsDAide(["constructor", "toString"], {})).toEqual([{ cle: "constructor" }, { cle: "toString" }]);
  });
});

describe("le vocabulaire du bilan : français et anglais", () => {
  it("la clé du titre existe dans les deux catalogues du kit", () => {
    expect(CATALOGUE_KIT_FR["kit.fin.bilan"]).toBeTruthy();
    expect(CATALOGUE_KIT_EN["kit.fin.bilan"]).toBeTruthy();
  });
});
