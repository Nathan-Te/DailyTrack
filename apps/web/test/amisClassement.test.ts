import { describe, expect, it } from "vitest";
import { adresseDuFiltre, cheminClassementAmis, classementVide, filtreAuChargement, lireClassementAmis, sansAmi } from "../src/amisLignes";

// Lot F2 : le filtre « Amis » du classement du jour de Track — la logique pure (lecture de la réponse du serveur, ordre, absents, moi, adresse du filtre).
const REF = (n: number): string => n.toString(16).padStart(12, "0");
const ligne = (n: number, extra: Record<string, unknown> = {}) => ({ rank: n, rang: n, rangGeneral: n * 10, ref: REF(n), name: `Ami${n}`, ms: 30_000 + n * 100, medal: null, ...extra });

describe("le classement « Amis » de Track (lecture de la réponse du serveur)", () => {
  it("garde l'ordre du rang entre amis, ta ligne marquée, le rang général, les absents en bas", () => {
    const c = lireClassementAmis({
      filtre: "amis",
      date: "2026-11-02",
      classes: 3,
      amis: 3,
      participants: 412,
      absents: [{ ref: REF(9), pseudo: "Gaston" }],
      top: [ligne(2, { moi: true, name: "Moi" }), ligne(1, { medal: "gold" }), ligne(3)],
    })!;
    expect(c.lignes.map((l) => [l.rang, l.nom, l.moi])).toEqual([
      [1, "Ami1", false],
      [2, "Moi", true],
      [3, "Ami3", false],
    ]);
    expect(c.lignes[0]).toMatchObject({ rangGeneral: 10, medal: "gold", ref: REF(1) });
    expect(c.lignes.filter((l) => l.moi)).toHaveLength(1);
    expect(c.absents).toEqual([{ ref: REF(9), nom: "Gaston" }]);
    expect(c).toMatchObject({ classes: 3, amis: 3, participants: 412, date: "2026-11-02" });
  });

  it("n'a pas de limite de 50 : toutes les lignes sont gardées", () => {
    const top = Array.from({ length: 80 }, (_, i) => ligne(i + 1));
    expect(lireClassementAmis({ top, absents: [], classes: 80, amis: 79 })!.lignes).toHaveLength(80);
  });

  it("écarte ce qui est mal formé : référence invalide, doublon, temps absent, médaille inconnue ; un absent qui a une ligne n'est pas absent", () => {
    const c = lireClassementAmis({
      top: [ligne(1), ligne(1, { name: "Doublon" }), { ...ligne(2), ref: "pas-une-ref" }, { ...ligne(3), ms: "vite" }, ligne(4, { medal: "platine" })],
      absents: [{ ref: REF(1), pseudo: "Ami1" }, { ref: REF(7), pseudo: "Gaston" }, { ref: REF(7), pseudo: "Encore" }, { ref: "x", pseudo: "Mauvais" }],
    })!;
    expect(c.lignes.map((l) => l.nom)).toEqual(["Ami1", "Ami4"]);
    expect(c.lignes[1]!.medal).toBeNull();
    expect(c.absents).toEqual([{ ref: REF(7), nom: "Gaston" }]);
  });

  it("une réponse illisible rend null (le classement retombe sur « Tous »)", () => {
    expect(lireClassementAmis(null)).toBeNull();
    expect(lireClassementAmis({})).toBeNull();
    expect(lireClassementAmis({ top: "non" })).toBeNull();
    expect(lireClassementAmis("{}")).toBeNull();
  });

  it("sans ami : l'invitation ; avec des amis sans temps ni absent : un classement vide ; un pseudo piégé reste du texte", () => {
    const aucun = lireClassementAmis({ top: [], absents: [], amis: 0, classes: 0 })!;
    expect(sansAmi(aucun)).toBe(true);
    const masques = lireClassementAmis({ top: [], absents: [], amis: 2, classes: 0 })!;
    expect(sansAmi(masques)).toBe(false);
    expect(classementVide(masques)).toBe(true);
    const piege = lireClassementAmis({ top: [ligne(1, { name: "<img src=x onerror=alert(1)>" })], absents: [] })!;
    expect(piege.lignes[0]!.nom).toBe("<img src=x onerror=alert(1)>"); // donné tel quel : la page le pose en textContent
    expect(classementVide(piege)).toBe(false);
  });
});

describe("le filtre dans l'adresse", () => {
  it("l'adresse choisit le filtre au chargement, le choix de la page l'emporte ensuite", () => {
    expect(filtreAuChargement("", null)).toBe("tous");
    expect(filtreAuChargement("?filtre=amis", null)).toBe("amis");
    expect(filtreAuChargement("?filtre=n-importe-quoi", null)).toBe("tous");
    expect(filtreAuChargement("?filtre=amis", "tous")).toBe("tous");
    expect(filtreAuChargement("", "amis")).toBe("amis");
  });

  it("?filtre=amis s'ajoute et se retire sans toucher aux autres paramètres ni au fragment", () => {
    const page = { pathname: "/track/", search: "?api=/&today=2026-11-02", hash: "#classement" };
    expect(adresseDuFiltre(page, "amis")).toBe("/track/?api=%2F&today=2026-11-02&filtre=amis#classement");
    expect(adresseDuFiltre({ ...page, search: "?filtre=amis&debug" }, "tous")).toBe("/track/?debug=#classement");
    expect(adresseDuFiltre({ pathname: "/track/", search: "", hash: "" }, "amis")).toBe("/track/?filtre=amis");
    expect(adresseDuFiltre({ pathname: "/track/", search: "?filtre=amis", hash: "" }, "tous")).toBe("/track/");
  });

  it("la requête « Amis » : le chemin du contrat, jamais l'identifiant du joueur ni une limite", () => {
    expect(cheminClassementAmis("2026-11-02")).toBe("/api/day/2026-11-02/leaderboard?filtre=amis");
  });
});
