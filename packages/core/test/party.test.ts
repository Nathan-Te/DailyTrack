// Lot PA1 — la catégorie « Party » dans la fiche : hors cumul, ni thèmes ni jours figés, identité allégée (police et motif de la catégorie, seule l'illustration reste à choisir).
import { describe, expect, it } from "vitest";
import { fichePartieDeTest } from "../testing/fichePartie";
import { A_CHOISIR, etatPermis, identiteAChoisir, identiteComplete, lireFiche, projectionCI, projectionPortail, projectionServeur, validerFiche } from "../src/fiche";
import { categorieLe, compteDansLaJournee, horsJournee } from "../src/jeux";

const fichePartie = () => fichePartieDeTest();
const probleme = (modif: (f: Record<string, any>) => void) => {
  const f = fichePartie();
  modif(f);
  return validerFiche(f, "fete").join(" | ");
};

describe("catégorie party (lot PA1)", () => {
  it("une fiche Party sans thèmes ni jours figés est valide", () => {
    expect(validerFiche(fichePartie(), "fete")).toEqual([]);
  });
  it("la police et le motif sont ceux de la catégorie ; pas de panneau « Aujourd'hui »", () => {
    expect(probleme((f) => (f.identite.police = "Bungee"))).toContain("identite.police");
    expect(probleme((f) => (f.identite.motif = "rayures"))).toContain("identite.motif");
    expect(probleme((f) => (f.identite.aujourdhui = true))).toContain("identite.aujourdhui");
  });
  it("un jeu Party n'a ni thèmes ni jours à figer, n'entre pas au cumul et garde sa catégorie", () => {
    expect(probleme((f) => (f.themes = ["clair"]))).toContain("themes");
    expect(probleme((f) => (f.jours = { mode: "fichier-par-jour" }))).toContain("jours : un jeu Party n'a pas de jours");
    expect(probleme((f) => (f.classement.cumul = true))).toContain("classement.cumul");
    expect(probleme((f) => (f.categorieDepuis = "2026-12-01"))).toContain("categorieDepuis");
  });
  it("un jeu qui n'est pas Party garde l'obligation d'avoir des jours et des thèmes", () => {
    const f = fichePartie();
    f.categorie = "arcade";
    const p = validerFiche(f, "fete").join(" | ");
    expect(p).toContain("jours : objet attendu");
    expect(p).toContain("themes");
  });
  it("identité allégée : seule l'illustration bloque preview et on", () => {
    const f = lireFiche(fichePartie(), "fete");
    expect(identiteAChoisir(f)).toEqual(["identite.illustration"]);
    expect(etatPermis(f, "preview")).toBe(false);
    expect(etatPermis(f, "off")).toBe(true);
    f.identite.illustration = "apps/fete/public/illustration.svg";
    expect(identiteComplete(f)).toBe(true);
    expect(etatPermis(f, "on")).toBe(true);
    // Un jeu d'une autre catégorie doit encore choisir sa police et son motif.
    expect(identiteAChoisir({ categorie: "jour", identite: { police: A_CHOISIR, motif: A_CHOISIR, illustration: A_CHOISIR, aujourdhui: false } })).toEqual(["identite.police", "identite.motif", "identite.illustration"]);
  });
  it("les projections : catégorie dite au portail et au serveur, pas de jours pour la chaîne de production", () => {
    const f = lireFiche(fichePartie(), "fete");
    expect(projectionPortail([f]).jeux[0]).toMatchObject({ categorie: "party", cumul: false });
    const s = projectionServeur([f]).jeux[0]!;
    expect(s.categorie).toBe("party");
    expect(s).not.toHaveProperty("jours");
    expect(projectionCI([f]).jeux[0]).not.toHaveProperty("jours");
  });
  it("hors journée, hors cumul ; la catégorie Party ne se change pas", () => {
    expect(horsJournee("party")).toBe(true);
    expect(horsJournee("arcade")).toBe(true);
    expect(horsJournee("jour")).toBe(false);
    expect(categorieLe("party", 100, 50)).toBe("party");
    expect(compteDansLaJournee("party", null, 50)).toBe(false);
  });
});

import { graineDuJour } from "../src/graine";
describe("graine du jour (lot PA1)", () => {
  it("est déterministe, propre au jeu et au jour, et tient sur 32 bits", () => {
    expect(graineDuJour("fete", 20500)).toBe(graineDuJour("fete", 20500));
    expect(graineDuJour("fete", 20500)).not.toBe(graineDuJour("fete", 20501));
    expect(graineDuJour("fete", 20500)).not.toBe(graineDuJour("autre", 20500));
    for (const j of [0, 1, 20500, 99999]) expect(Number.isInteger(graineDuJour("fete", j)) && graineDuJour("fete", j) >= 0 && graineDuJour("fete", j) < 2 ** 32).toBe(true);
    // Valeur fixée : un changement de la fonction changerait la graine de tous les jours déjà joués.
    expect(graineDuJour("fete", 20500)).toBe(1006564898);
  });
});
