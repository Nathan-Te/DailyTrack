import { describe, expect, it } from "vitest";
import { adresseClassementFiltre, adresseDuFiltre, filtreDeLAdresse, lireClassementAmis, ouvreUneFeuille, sansAmi } from "../src/amis";

// Lot K4c — la lecture générique du classement « Amis » / « Mon groupe » : le score d'une ligne est la suite des colonnes de classement de la fiche, par leur nom.
const REF = "0123456789ab";
const ligne = (o: Record<string, unknown> = {}) => ({ rank: 1, name: "Nowy", points: 120, octets: 3, medal: "gold", ref: REF, rangGeneral: 8, moi: false, ...o });
const corps = (o: Record<string, unknown> = {}) => ({ filtre: "amis", date: "2026-11-10", classes: 2, amis: 1, participants: 412, top: [ligne(), ligne({ rank: 2, name: "Moi", moi: true, ref: "ba9876543210" })], absents: [{ ref: "aaaaaaaaaaaa", pseudo: "Absent" }], ...o });

describe("la colle des amis d'un jeu neuf — partie pure (lot K4c)", () => {
  it("lit les lignes avec les colonnes de la fiche, les absents et les compteurs", () => {
    const c = lireClassementAmis(corps(), ["points", "octets"])!;
    expect(c.lignes[0]).toMatchObject({ rank: 1, name: "Nowy", score: { points: 120, octets: 3 }, medal: "gold", ref: REF, rangGeneral: 8, moi: false });
    expect(c.lignes[1]!.moi).toBe(true);
    expect(c.absents).toEqual([{ ref: "aaaaaaaaaaaa", pseudo: "Absent" }]);
    expect(c).toMatchObject({ date: "2026-11-10", amis: 1, classes: 2, participants: 412 });
  });
  it("refuse une réponse qui n'a pas la forme du contrat, sans rien casser", () => {
    expect(lireClassementAmis(null, ["points"])).toBeNull();
    expect(lireClassementAmis(corps({ filtre: "groupe" }), ["points"])).toBeNull();
    expect(lireClassementAmis(corps({ top: "x" }), ["points"])).toBeNull();
    expect(lireClassementAmis(corps({ filtre: "groupe" }), ["points"], "groupe")).not.toBeNull();
    const abimee = lireClassementAmis(corps({ top: [ligne({ ref: "pas-une-ref" }), ligne({ points: "x" }), ligne({ name: 5 }), ligne({ medal: "diamant" })] }), ["points", "octets"])!;
    expect(abimee.lignes).toHaveLength(1);
    expect(abimee.lignes[0]!.medal).toBeNull(); // médaille inconnue : aucune
  });
  it("sans ami : le message d'invitation ; les lignes touchables sont celles des autres joueurs", () => {
    expect(sansAmi(lireClassementAmis(corps({ amis: 0, top: [ligne({ moi: true })], absents: [] }), ["points", "octets"])!)).toBe(true);
    expect(ouvreUneFeuille({ ref: REF, pseudo: "A", moi: false })).toBe(true);
    expect(ouvreUneFeuille({ ref: REF, pseudo: "A", moi: true })).toBe(false);
    expect(ouvreUneFeuille({ pseudo: "A", moi: false })).toBe(false);
    expect(ouvreUneFeuille(undefined)).toBe(false);
  });
  it("l'adresse de la route ne porte jamais l'identifiant ; le filtre se lit et s'écrit dans l'adresse de la page", () => {
    expect(adresseClassementFiltre("cibles", "2026-11-10", "amis")).toBe("/api/cibles/day/2026-11-10/board?filtre=amis");
    expect(filtreDeLAdresse("?filtre=amis")).toBe("amis");
    expect(filtreDeLAdresse("?filtre=n-importe-quoi")).toBe("tous");
    expect(adresseDuFiltre({ pathname: "/cibles/", search: "?seed=2026-11-10", hash: "" }, "amis")).toBe("/cibles/?seed=2026-11-10&filtre=amis");
  });
});
