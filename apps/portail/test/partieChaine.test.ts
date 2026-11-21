import { fichePartieDeTest } from "@cdj/core/testing/fiche-party";
import { lireFiche, projectionCI, projectionServeur, type FicheJeu } from "@cdj/core/fiche";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHAINE, chaineDesFiches, FICHES_CI } from "../../../scripts/fiches-lecture.mjs";

// Lot PA1 — **un jeu Party n'a pas de jours à figer** : la chaîne de « Mettre en production » (le garde-fou des jours R6, l'étape `figer`, `preparer`, les empreintes) lit les fiches (`jours.fabrication`) et
// ignore un jeu sans `jours`. Aucun jeu Party n'est versé au dépôt : la preuve passe par une fiche Party de test, ajoutée aux fiches réelles.

const fiches = (): FicheJeu[] => {
  const dossier = new URL("../../../config/jeux/", import.meta.url);
  const reelles = ["track", "jump", "tower"].map((id) => lireFiche(JSON.parse(readFileSync(new URL(`${id}.json`, dossier), "utf8")), id));
  return [...reelles, lireFiche(fichePartieDeTest("fete"), "fete")];
};

describe("la chaîne de production ignore un jeu Party (lot PA1)", () => {
  it("la chaîne ne garde que les jeux qui ont des jours : un jeu Party n'y entre pas", () => {
    const f = fiches();
    const chaine = chaineDesFiches(projectionCI(f).jeux as never, projectionServeur(f).jeux as never);
    expect(chaine.map((j) => j.id)).toEqual(["track", "jump", "tower"]);
    expect(chaine.find((j) => j.id === "fete")).toBeUndefined();
  });
  it("sa fiche n'a ni script `figer`, ni module d'empreinte à copier, ni dossier de jours", () => {
    const f = fiches();
    const ci = projectionCI(f).jeux.find((j) => j.id === "fete")!;
    expect(ci.jours).toBeUndefined();
    expect(projectionServeur(f).jeux.find((j) => j.id === "fete")!.jours).toBeUndefined();
  });
  it("la chaîne du dépôt est celle de la fonction pure, pour les fiches du dépôt", () => {
    expect(CHAINE.map((j) => j.id)).toEqual(chaineDesFiches(FICHES_CI, JSON.parse(readFileSync(new URL("../../../config/jeux/projections/serveur.json", import.meta.url), "utf8")).jeux).map((j) => j.id));
  });
});
