import { describe, expect, it } from "vitest";
import { avancement, type JeuDuJour } from "../src/jour";
import { choixPourDemain, ordonnerArcade, repartir } from "../src/mesJeux";

// Lot F1 : la répartition « Mes jeux / Les autres jeux » de l'accueil et le compte « n fini sur m » sur mes jeux. Pur.
const cartes = [{ code: "track" }, { code: "jump" }, { code: "tower" }];
const codes = (l: { code: string }[]) => l.map((c) => c.code);

describe("répartir les cartouches", () => {
  it("sans favori : tous les jeux en cartouches pleines, comme aujourd'hui", () => {
    const r = repartir(cartes, []);
    expect(r.sansFavori).toBe(true);
    expect(codes(r.mes)).toEqual(["track", "jump", "tower"]);
    expect(r.autres).toEqual([]);
  });
  it("des favoris : eux en haut, dans l'ordre de la plateforme (jamais l'ordre du clic), les autres dessous", () => {
    const r = repartir(cartes, ["tower", "track"]);
    expect(r.sansFavori).toBe(false);
    expect(codes(r.mes)).toEqual(["track", "tower"]);
    expect(codes(r.autres)).toEqual(["jump"]);
  });
  it("tous les jeux épinglés : rien sous « Les autres jeux »", () => {
    const r = repartir(cartes, ["jump", "track", "tower"]);
    expect(codes(r.mes)).toEqual(["track", "jump", "tower"]);
    expect(r.autres).toEqual([]);
    expect(r.sansFavori).toBe(false);
  });
  it("un favori qui n'est pas montré (jeu repassé à off) disparaît sans message ; s'il était le seul, l'accueil est celui d'avant", () => {
    expect(codes(repartir(cartes, ["tower", "puzzle"]).mes)).toEqual(["tower"]);
    expect(repartir([{ code: "track" }, { code: "jump" }], ["tower"]).sansFavori).toBe(true);
  });
});

describe("n fini sur m : mes jeux", () => {
  const jeu = (site: string, fini: boolean, compte = true): JeuDuJour => ({
    jeu: site,
    site,
    numero: 7,
    theme: null,
    seuils: null,
    premierJour: "2026-10-13",
    compte,
    etat: fini ? { statut: "fini", tempsMs: 40_000, medaille: null, rang: 1, classes: 1 } : { statut: "pas_joue" },
  });
  const jeux = [jeu("track", true), jeu("jump", false), jeu("tower", false)];
  it("sans liste : tous les jeux qui comptent (comme avant)", () => {
    expect(avancement(jeux)).toEqual({ finis: 1, total: 3 });
  });
  it("avec les jeux du jour du joueur : eux seuls", () => {
    expect(avancement(jeux, ["track"])).toEqual({ finis: 1, total: 1 });
    expect(avancement(jeux, ["track", "jump"])).toEqual({ finis: 1, total: 2 });
  });
  it("une liste qui ne nomme aucun jeu montré : tous les jeux qui comptent", () => {
    expect(avancement(jeux, ["puzzle"])).toEqual({ finis: 1, total: 3 });
    expect(avancement(jeux, [])).toEqual({ finis: 1, total: 3 });
  });
  it("un jeu qui ne compte pas encore (activé aujourd'hui) n'entre pas dans le compte", () => {
    expect(avancement([jeu("track", true), jeu("tower", false, false)], ["track", "tower"])).toEqual({ finis: 1, total: 1 });
  });
});

describe("« à partir de demain »", () => {
  const comptent = ["track", "jump"];
  it("rien à dire quand mes jeux sont ceux de la journée", () => {
    expect(choixPourDemain(["track"], comptent, ["track"])).toBe(false);
    expect(choixPourDemain([], comptent, ["track", "jump"])).toBe(false);
    expect(choixPourDemain(["track"], comptent, undefined)).toBe(false);
  });
  it("je viens d'épingler (ou de retirer) : la journée n'a pas bougé", () => {
    expect(choixPourDemain(["track"], comptent, ["track", "jump"])).toBe(true);
    expect(choixPourDemain(["track", "jump"], comptent, ["track"])).toBe(true);
    expect(choixPourDemain([], comptent, ["track"])).toBe(true);
  });
  it("un favori éteint (le serveur ne retient aucun jeu montré) : rien à signaler", () => {
    expect(choixPourDemain(["tower"], comptent, [])).toBe(false);
    expect(choixPourDemain(["tower"], comptent, ["track", "jump"])).toBe(false);
  });
});

describe("la section Arcade (lot A3)", () => {
  const arcade = [{ code: "tower" }, { code: "blocks" }, { code: "cibles" }];
  it("les favoris d'arcade montent en tête de leur section, chaque groupe dans l'ordre de la plateforme", () => {
    expect(codes(ordonnerArcade(arcade, []))).toEqual(["tower", "blocks", "cibles"]);
    expect(codes(ordonnerArcade(arcade, ["cibles"]))).toEqual(["cibles", "tower", "blocks"]);
    expect(codes(ordonnerArcade(arcade, ["cibles", "tower"]))).toEqual(["tower", "cibles", "blocks"]);
  });
  it("un favori d'arcade ne change pas « Mes jeux » de la journée : les jeux du jour sont répartis sans lui", () => {
    const duJour = [{ code: "track" }, { code: "jump" }];
    const r = repartir(duJour, ["tower"]);
    expect(r.sansFavori).toBe(true);
    expect(codes(r.mes)).toEqual(["track", "jump"]);
  });
  it("« n fini sur m » ne compte pas un jeu d'arcade (le serveur le marque `compte: false`), épinglé ou non", () => {
    const fini = { statut: "fini", rang: 1, classes: 1, tempsMs: 1, medaille: null } as const;
    const jeux = [
      { jeu: "cdj", site: "track", numero: 1, theme: null, seuils: null, premierJour: "x", etat: fini },
      { jeu: "jump", site: "jump", numero: 1, theme: null, seuils: null, premierJour: "x", etat: { statut: "pas_joue" } },
      { jeu: "tower", site: "tower", numero: 1, theme: null, seuils: null, premierJour: "x", etat: fini, compte: false, categorie: "arcade" },
    ] as unknown as JeuDuJour[];
    expect(avancement(jeux)).toEqual({ finis: 1, total: 2 });
    expect(avancement(jeux, ["tower"])).toEqual({ finis: 1, total: 2 }); // épinglé : il ne compte toujours pas
  });
});
