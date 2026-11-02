import { describe, expect, it } from "vitest";
import { adresseDuFiltre, filtreDeLAdresse, lireClassementAmis, ouvreUneFeuille, sansAmi } from "../src/amisLogique";

// Lot F2 — « Les amis » dans le classement de Tower : la logique pure (lecture de la réponse du serveur, lignes touchables, filtre dans l'adresse).
const ref = (n: number): string => n.toString(16).padStart(12, "0");

const REPONSE = {
  filtre: "amis",
  date: "2026-11-06",
  open: true,
  participants: 96,
  classes: 3,
  amis: 3,
  generation: 0,
  top: [
    { rank: 1, rang: 1, rangGeneral: 2, ref: ref(5), name: "Eva", hauteurMm: 50_000, vies: 3, ticks: 4000, medal: "author" },
    { rank: 2, rang: 2, rangGeneral: 7, ref: ref(1), moi: true, name: "Alice", hauteurMm: 42_700, vies: 2, ticks: 3500, medal: "gold" },
    { rank: 3, rang: 3, rangGeneral: 30, ref: ref(2), name: "Bruno", hauteurMm: 12_345, vies: 1, ticks: 3600, medal: null },
  ],
  absents: [{ ref: ref(3), pseudo: "Chloé" }],
};

describe("le classement « Amis » de Tower (lot F2)", () => {
  it("lit le contrat : rang entre amis, rang général, référence, ta ligne, hauteur en millimètres, absents", () => {
    const c = lireClassementAmis(REPONSE)!;
    expect(c).not.toBeNull();
    expect(c.lignes.map((l) => [l.rank, l.rangGeneral, l.name, l.hauteurMm, l.vies, l.medal, l.moi])).toEqual([
      [1, 2, "Eva", 50_000, 3, "author", false],
      [2, 7, "Alice", 42_700, 2, "gold", true],
      [3, 30, "Bruno", 12_345, 1, null, false],
    ]);
    expect(c.absents).toEqual([{ ref: ref(3), pseudo: "Chloé" }]);
    expect(c).toMatchObject({ classes: 3, amis: 3, participants: 96, date: "2026-11-06" });
    expect(sansAmi(c)).toBe(false);
  });

  it("sans ami : seule ta ligne (ou rien), et le classement dit « Tu n'as pas encore d'ami »", () => {
    const c = lireClassementAmis({ ...REPONSE, amis: 0, classes: 1, top: [REPONSE.top[1]], absents: [] })!;
    expect(c.lignes).toHaveLength(1);
    expect(sansAmi(c)).toBe(true);
    expect(sansAmi(lireClassementAmis({ ...REPONSE, amis: 0, classes: 0, top: [], absents: [] })!)).toBe(true);
  });

  it("une réponse mal formée est refusée ou nettoyée, sans rien casser", () => {
    expect(lireClassementAmis(null)).toBeNull();
    expect(lireClassementAmis({ ...REPONSE, filtre: "tous" })).toBeNull(); // c'est « Tous »
    expect(lireClassementAmis({ ...REPONSE, top: "x" })).toBeNull();
    const c = lireClassementAmis({
      ...REPONSE,
      top: [{ ...REPONSE.top[0], ref: "pas-une-ref" }, { ...REPONSE.top[1], hauteurMm: "haut" }, { ...REPONSE.top[2], medal: "platine" }],
      absents: [{ ref: "x", pseudo: "Z" }, { ref: ref(4), pseudo: 3 }],
    })!;
    expect(c.lignes.map((l) => [l.name, l.medal])).toEqual([["Bruno", null]]); // la ligne sans référence et celle sans hauteur sont écartées, une médaille inconnue n'est pas une médaille
    expect(c.absents).toEqual([]);
  });

  it("un pseudo piégé reste du texte (jamais interprété) et ne change pas la forme des lignes", () => {
    const c = lireClassementAmis({ ...REPONSE, top: [{ ...REPONSE.top[0], name: "<img src=x onerror=alert(1)>" }] })!;
    expect(c.lignes[0]!.name).toBe("<img src=x onerror=alert(1)>");
  });

  it("seul un autre joueur qui a une référence ouvre une feuille ; ta ligne n'ouvre rien", () => {
    expect(ouvreUneFeuille({ ref: ref(2), pseudo: "Bruno", moi: false })).toBe(true);
    expect(ouvreUneFeuille({ ref: ref(1), pseudo: "Alice", moi: true })).toBe(false);
    expect(ouvreUneFeuille({ pseudo: "Sans référence", moi: false })).toBe(false); // un serveur d'avant le lot F2
    expect(ouvreUneFeuille({ ref: "abc", pseudo: "Faux", moi: false })).toBe(false);
    expect(ouvreUneFeuille(undefined)).toBe(false);
  });
});

describe("le filtre dans l'adresse de Tower (lot F2)", () => {
  const lieu = (search: string, hash = "") => ({ pathname: "/tower/", search, hash });
  it("`?filtre=amis` se lit, tout le reste est « Tous »", () => {
    expect(filtreDeLAdresse("?filtre=amis")).toBe("amis");
    expect(filtreDeLAdresse("?seed=2026-11-06&filtre=amis")).toBe("amis");
    expect(filtreDeLAdresse("")).toBe("tous");
    expect(filtreDeLAdresse("?filtre=tous")).toBe("tous");
    expect(filtreDeLAdresse("?filtre=n-importe-quoi")).toBe("tous");
  });
  it("le choix s'écrit dans l'adresse sans toucher aux autres paramètres ni au fragment ; « Tous » retire le paramètre", () => {
    expect(adresseDuFiltre(lieu(""), "amis")).toBe("/tower/?filtre=amis");
    expect(adresseDuFiltre(lieu("?seed=2026-11-06&api=http://localhost:8791"), "amis")).toBe("/tower/?seed=2026-11-06&api=http%3A%2F%2Flocalhost%3A8791&filtre=amis");
    expect(adresseDuFiltre(lieu("?seed=2026-11-06&filtre=amis", "#haut"), "tous")).toBe("/tower/?seed=2026-11-06#haut");
    expect(adresseDuFiltre(lieu("?filtre=amis"), "tous")).toBe("/tower/");
  });
});
