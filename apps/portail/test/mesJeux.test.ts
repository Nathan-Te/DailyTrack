import { describe, expect, it } from "vitest";
import { avancement, type JeuDuJour } from "../src/jour";
import { choixPourDemain, epinglesEnTete } from "../src/mesJeux";

// Lot F1 (lot U1 : les épinglés en tête de leur zone, plus de section « Mes jeux ») : l'ordre des cartouches de l'accueil et le compte « n fini sur m » sur mes jeux. Pur.
const cartes = [{ code: "track" }, { code: "jump" }, { code: "tower" }];
const codes = (l: { code: string }[]) => l.map((c) => c.code);

describe("épingler : le jeu passe en tête de sa zone", () => {
  it("sans favori : l'ordre de la plateforme", () => {
    expect(codes(epinglesEnTete(cartes, []))).toEqual(["track", "jump", "tower"]);
  });
  it("des favoris : eux en tête, dans l'ordre de la plateforme (jamais l'ordre du clic), les autres à la suite", () => {
    expect(codes(epinglesEnTete(cartes, ["tower", "jump"]))).toEqual(["jump", "tower", "track"]);
    expect(codes(epinglesEnTete(cartes, ["tower"]))).toEqual(["tower", "track", "jump"]);
  });
  it("tous les jeux épinglés : l'ordre de la plateforme", () => {
    expect(codes(epinglesEnTete(cartes, ["jump", "track", "tower"]))).toEqual(["track", "jump", "tower"]);
  });
  it("un favori qui n'est pas dans la zone (un autre jeu, ou un jeu repassé à off) ne change rien", () => {
    expect(codes(epinglesEnTete(cartes, ["puzzle"]))).toEqual(["track", "jump", "tower"]);
    expect(codes(epinglesEnTete([{ code: "tower" }, { code: "blocks" }, { code: "rush" }], ["rush"]))).toEqual(["rush", "tower", "blocks"]);
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
    expect(codes(epinglesEnTete(arcade, []))).toEqual(["tower", "blocks", "cibles"]);
    expect(codes(epinglesEnTete(arcade, ["cibles"]))).toEqual(["cibles", "tower", "blocks"]);
    expect(codes(epinglesEnTete(arcade, ["cibles", "tower"]))).toEqual(["tower", "cibles", "blocks"]);
  });
  it("un favori d'arcade ne change pas l'ordre des jeux du jour : chaque zone ne lit que ses propres jeux", () => {
    const duJour = [{ code: "track" }, { code: "jump" }];
    expect(codes(epinglesEnTete(duJour, ["tower"]))).toEqual(["track", "jump"]);
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
