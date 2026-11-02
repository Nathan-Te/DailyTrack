import { describe, expect, it } from "vitest";
import { daysFromCivil } from "../src";
import { FAVORIS_MAX, NOUVEAU_JOURS, estNouveau, favorisLe, jeuxDeLaBase, jourDEffet, listeApresChoix, listeDeFavoris, mesJeuxDuJour, type PeriodeFavoris } from "../src/favoris";

// Lot F1 : les règles pures de « Mes jeux » (dates fixes, jamais l'horloge).
const T = daysFromCivil(2026, 11, 2);

describe("la liste envoyée par un client", () => {
  it("un tableau de noms de jeux, sans doublon ; tout le reste est refusé", () => {
    expect(listeDeFavoris([])).toEqual([]);
    expect(listeDeFavoris(["track", "jump", "track"])).toEqual(["track", "jump"]);
    expect(listeDeFavoris("track")).toBeNull();
    expect(listeDeFavoris(null)).toBeNull();
    expect(listeDeFavoris([1])).toBeNull();
    expect(listeDeFavoris(["Track"])).toBeNull();
    expect(listeDeFavoris(["../x"])).toBeNull();
    expect(listeDeFavoris([""])).toBeNull();
    expect(listeDeFavoris(Array.from({ length: FAVORIS_MAX + 1 }, (_, i) => `jeu${i}`))).toBeNull();
    expect(listeDeFavoris(Array.from({ length: FAVORIS_MAX }, (_, i) => `jeu${i}`))).toHaveLength(FAVORIS_MAX);
  });

  it("une ligne abîmée de la base ne bloque personne", () => {
    expect(jeuxDeLaBase('["track","jump"]')).toEqual(["track", "jump"]);
    expect(jeuxDeLaBase("pas du json")).toEqual([]);
    expect(jeuxDeLaBase('{"a":1}')).toEqual([]);
    expect(jeuxDeLaBase(null)).toEqual([]);
  });
});

describe("la liste en vigueur un jour donné (historique)", () => {
  const periodes: PeriodeFavoris[] = [
    [T - 10, ["track", "jump"]],
    [T + 1, ["jump"]],
  ];
  it("la dernière période qui a commencé ; aucune : le joueur n'avait rien choisi", () => {
    expect(favorisLe([], T)).toBeNull();
    expect(favorisLe(periodes, T - 11)).toBeNull();
    expect(favorisLe(periodes, T - 10)).toEqual(["track", "jump"]);
    expect(favorisLe(periodes, T)).toEqual(["track", "jump"]);
    expect(favorisLe(periodes, T + 1)).toEqual(["jump"]);
    expect(favorisLe(periodes, T + 30)).toEqual(["jump"]);
  });
});

describe("les jeux de la journée", () => {
  const tous = ["track", "jump", "tower"];
  it("sans favori : tous les jeux qui comptent", () => {
    expect(mesJeuxDuJour(tous, null)).toEqual(tous);
    expect(mesJeuxDuJour(tous, [])).toEqual(tous);
  });
  it("avec des favoris : eux seuls, dans l'ordre de la plateforme", () => {
    expect(mesJeuxDuJour(tous, ["tower", "track"])).toEqual(["track", "tower"]);
  });
  it("un favori qui ne compte plus (jeu éteint) disparaît ; s'ils sont tous éteints, tous les jeux qui comptent", () => {
    expect(mesJeuxDuJour(["track", "jump"], ["jump", "tower"])).toEqual(["jump"]);
    expect(mesJeuxDuJour(["track", "jump"], ["tower"])).toEqual(["track", "jump"]);
  });
});

describe("le jour d'effet d'un changement", () => {
  it("demain ; aujourd'hui seulement pour un profil créé aujourd'hui", () => {
    expect(jourDEffet(T, false)).toBe(T + 1);
    expect(jourDEffet(T, true)).toBe(T);
  });
});

describe("la liste enregistrée après un choix", () => {
  const ouverts = new Set(["track", "jump"]);
  it("ce qui est demandé parmi les jeux ouverts", () => {
    expect(listeApresChoix(["jump"], ["track"], ouverts)).toEqual(["jump"]);
    expect(listeApresChoix([], ["track", "jump"], ouverts)).toEqual([]);
  });
  it("un jeu éteint déjà épinglé reste (il revient avec le jeu) ; un jeu éteint pas épinglé est écarté", () => {
    expect(listeApresChoix(["track"], ["tower"], ouverts)).toEqual(["track", "tower"]);
    expect(listeApresChoix(["track", "tower"], [], ouverts)).toEqual(["track"]);
    expect(listeApresChoix([], ["tower"], ouverts)).toEqual(["tower"]);
  });
});

describe("la pastille « Nouveau »", () => {
  it(`pendant ${NOUVEAU_JOURS} jours à partir de l'ouverture (la veille du premier jour compté)`, () => {
    const ouverture = T;
    const debut = ouverture + 1;
    expect(estNouveau(debut, ouverture - 1)).toBe(false);
    expect(estNouveau(debut, ouverture)).toBe(true);
    expect(estNouveau(debut, ouverture + NOUVEAU_JOURS - 1)).toBe(true);
    expect(estNouveau(debut, ouverture + NOUVEAU_JOURS)).toBe(false);
  });
  it("un jeu d'avant l'interrupteur, ou sans période, n'est jamais nouveau", () => {
    expect(estNouveau(0, T)).toBe(false);
    expect(estNouveau(null, T)).toBe(false);
  });
});
