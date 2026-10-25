import type { Catalogues } from "@cdj/ui";
import type { fr } from "./catalogue.course.figures.fr";

// Lot 49 — the new figures page, in English: loaded with the scenarios (both languages travel together); same keys as the French.

export const en: Catalogues<typeof fr>["en"] = {
  "figures.index.aria": "The new figures",
  "figures.index.titre": "New figures",
  "figures.index.intro": "Each figure plays on its own, in a loop. Keep, drop or tweak: tell the agent.",
  "figures.index.essayer": "Try",
  "figures.index.variante": "Variant 2",
  "figures.index.tour": "Drive the figures tour",
  "figures.index.themes": "Themes: {liste}",
  "figures.index.tous": "All themes",
  "figures.sautSortieVirage.titre": "Momentum jump",
  "figures.sautSortieVirage.quoi": "No boost pad: the speed you kept through the corner clears the gap.",
  "figures.tremplinReleve.titre": "Ramp out of a banked turn",
  "figures.tremplinReleve.quoi": "You take off still turning: straighten up before the ramp, or freeze the car with the brake.",
  "figures.chicaneTremplin.titre": "Chicane before the ramp",
  "figures.chicaneTremplin.quoi": "Fast enough for the gap, clean enough to hit the ramp straight.",
  "figures.receptionVirage.titre": "Landing in a corner",
  "figures.receptionVirage.quoi": "You land at the start of a big corner: not too fast, and turn as soon as the wheels touch.",
  "figures.sautGlace.titre": "Jump onto ice",
  "figures.sautGlace.quoi": "You land on ice: the landing slides, the corner is set up off the throttle.",
  "figures.sautFalaise.titre": "Cliff jump",
  "figures.sautFalaise.quoi": "Two cells of void, landing two levels lower.",
  "figures.bossesTerre.titre": "Dirt bumps",
  "figures.bossesTerre.quoi": "Three dirt bumps in a row: keep the car straight to turn at the end.",
  "figures.demiTourMixte.titre": "Road and dirt hairpin",
  "figures.demiTourMixte.quoi": "Grip changes halfway through the hairpin.",
  "figures.demiTourGlace.titre": "Road and ice hairpin",
  "figures.demiTourGlace.quoi": "Lift on the ice, get back on the throttle when the tyres bite.",
  "figures.ruesEnEscalier.titre": "Stepped streets",
  "figures.ruesEnEscalier.quoi": "A corner, a slope, a corner: brake on the slope, accelerate on the flat.",
  "figures.filDuRasoir.titre": "Razor's edge",
  "figures.filDuRasoir.quoi": "A 14 m road with no barriers and a corner halfway: precision first.",
  "figures.deversDescente.titre": "Banked turns downhill",
  "figures.deversDescente.quoi": "The slope pushes, the banking holds: aim well and you stay fast.",
};
