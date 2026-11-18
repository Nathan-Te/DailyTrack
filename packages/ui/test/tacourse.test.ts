import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CATALOGUE_TACOURSE } from "../src/catalogue.tacourse";
import { traducteur } from "../src/i18n";
import { course, phraseDeCourse, sousDeCourse } from "../src/tacourse";
import { installerFauxDom, type FauxElement } from "./fauxDom";

// Lot U6 : « Ta course » (la barre des classements), sur le faux DOM de test.

beforeEach(() => {
  installerFauxDom(vi);
});
afterEach(() => {
  vi.unstubAllGlobals();
});
const faux = <T>(x: T) => x as unknown as FauxElement;
const fr = traducteur("fr", CATALOGUE_TACOURSE);
const en = traducteur("en", CATALOGUE_TACOURSE);

describe("lot U6 : « Ta course »", () => {
  it("la phrase : l'écart en gras puis « pour passer 1er », « pour doubler X », ou « d'avance sur X »", () => {
    expect(phraseDeCourse(fr, { type: "premier", ecart: "0,185 s" })).toEqual({ ecart: "0,185 s", reste: " pour passer 1er" });
    expect(phraseDeCourse(fr, { type: "doubler", ecart: "0,110 s", nom: "Sacha" })).toEqual({ ecart: "0,110 s", reste: " pour doubler Sacha" });
    expect(phraseDeCourse(fr, { type: "avance", ecart: "0,039 s", nom: "Pépin" })).toEqual({ ecart: "0,039 s", reste: " d'avance sur Pépin" });
    expect(phraseDeCourse(en, { type: "premier", ecart: "0.185 s" }).reste).toBe(" to take 1st");
  });
  it("la seconde ligne : le jeu où l'on perd le plus, la médaille suivante, ton temps compte-t-il", () => {
    expect(sousDeCourse(fr, { type: "perte", nom: "Biscotte", ecart: "0,147 s", jeu: "Track" })).toBe("Biscotte te prend 0,147 s sur Track");
    expect(sousDeCourse(fr, { type: "medaille", medaille: "Or", ecart: "0,147 s" })).toBe("Prochaine médaille : Or, à 0,147 s");
    expect(sousDeCourse(fr, { type: "groupeCompte", rangLu: "2e" })).toBe("Ton temps compte : tu es 2e de ton groupe");
    expect(sousDeCourse(en, { type: "groupeNonCompte" })).toContain("doesn't count yet");
  });
  it("la barre : ta place, la phrase, la seconde ligne et « Rejouer <jeu> » (un lien) ; sans jeu : « Jouer » ; sans bouton : aucun", () => {
    const c = faux(course(fr, { rangLu: "2e", phrase: { type: "premier", ecart: "0,185 s" }, sous: { type: "medaille", medaille: "Or", ecart: "0,147 s" }, bouton: { href: "../track/", jeu: "Track" } }));
    expect(c.querySelectorAll(".classement-course__ou")[0]!.textContent).toContain("2");
    expect(c.querySelectorAll(".classement-course__ou sup")[0]!.textContent).toBe("e");
    expect(c.querySelectorAll(".classement-course__texte b")[0]!.textContent).toBe("0,185 s");
    expect(c.querySelectorAll(".classement-course__sous")[0]!.textContent).toBe("Prochaine médaille : Or, à 0,147 s");
    const b = c.querySelectorAll("a")[0]!;
    expect(b.getAttribute("href")).toBe("../track/");
    expect(b.textContent).toBe("Rejouer Track");
    const g = faux(course(fr, { rangLu: "1er", phrase: { type: "avance", ecart: "0,7 s", nom: "Pause Café" }, sous: null, bouton: { href: "../", jeu: null } }));
    expect(g.querySelectorAll("a")[0]!.textContent).toBe("Jouer");
    expect(g.querySelectorAll(".classement-course__sous")).toHaveLength(0);
    expect(faux(course(en, { rangLu: "3rd", phrase: { type: "premier", ecart: "1 s" }, sous: null, bouton: null })).querySelectorAll("a")).toHaveLength(0);
  });
});
