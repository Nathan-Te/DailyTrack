import { describe, expect, it } from "vitest";
import { IDS_PLANS, Partie, REGLAGES, dailyPinball } from "@cdj/pinball-sim";
import { PAS_PORTE, PAS_POTEAU_RENTRE, PAS_POTEAU_SORT, angleVise, boutLibre, couleurAiguillage, geoAiguillage, geoPorte, ouverturePorte, rapprocher, sortiePoteau } from "../src/deblocages";

// Lot PBG3 : ce que les deux rendus lisent de la porte, du poteau sauveur et de l'aiguillage — des fonctions du seul pas, communes à three.js et au rendu à plat.
const table = (plan: string, theme: "foire" | "ocean" | "espace" | "volcan" = "foire") => new Partie(dailyPinball(20800, undefined, theme, plan)).table;
const etat = (o: Partial<{ passageOuvert: number; lampes: [boolean, boolean]; sauveurTick: number; tick: number }>) => ({ passageOuvert: 0, lampes: [false, false] as [boolean, boolean], sauveurTick: -100000, tick: 1000, reglages: REGLAGES, ...o });

describe("la géométrie de la porte", () => {
  it.each(IDS_PLANS)("%s : un battant de 34 px, deux murs de 36 px, une flèche dans le passage", (plan) => {
    const g = geoPorte(table(plan))!;
    expect(Math.hypot(g.b.x - g.a.x, g.b.y - g.a.y)).toBeCloseTo(34, 0);
    expect(g.murs).toHaveLength(2);
    for (const m of g.murs) expect(Math.hypot(m.x1 - m.x0, m.y1 - m.y0)).toBeCloseTo(36, 0);
    // la flèche est entre les deux murs, à mi-profondeur
    expect(Math.hypot(g.fleche.x - g.x, g.fleche.y - g.y)).toBeCloseTo(18, 0);
  });
  it("le plan d'essai n'a ni porte ni aiguillage", () => {
    const t = new Partie({ jour: 0, g: 6, theme: "foire", plan: "classique", modules: ["spinner", "bumpers", "cibles", "cibles", "trou", "mini"] }).table;
    expect(geoPorte(t)).toBeNull();
    expect(geoAiguillage(t)).toBeNull();
  });
  it("le battant ouvert se rabat contre son mur : son bout libre fait un quart de tour (80°) autour du pivot, sans changer de longueur", () => {
    const g = geoPorte(table("bretelle"))!;
    const ferme = boutLibre(g, 0);
    expect([ferme.x, ferme.y]).toEqual([g.b.x, g.b.y]);
    const ouvert = boutLibre(g, 1);
    expect(Math.hypot(ouvert.x - g.a.x, ouvert.y - g.a.y)).toBeCloseTo(34, 3);
    // l'angle entre le battant fermé et ouvert : 1,4 rad
    const a0 = Math.atan2(ferme.y - g.a.y, ferme.x - g.a.x);
    const a1 = Math.atan2(ouvert.y - g.a.y, ouvert.x - g.a.x);
    expect(Math.abs(Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)))).toBeCloseTo(1.4, 3);
  });
});

describe("l'ouverture de la porte, fonction du pas", () => {
  const D = REGLAGES.porteDuree;
  it("fermée : 0 ; elle monte pendant PAS_PORTE pas, reste ouverte, redescend pendant les PAS_PORTE derniers", () => {
    expect(ouverturePorte(etat({ passageOuvert: 0 }))).toBe(0);
    expect(ouverturePorte(etat({ passageOuvert: D }))).toBe(0);
    expect(ouverturePorte(etat({ passageOuvert: D - PAS_PORTE / 2 }))).toBeCloseTo(0.5, 5);
    expect(ouverturePorte(etat({ passageOuvert: D - PAS_PORTE }))).toBe(1);
    expect(ouverturePorte(etat({ passageOuvert: D / 2 }))).toBe(1);
    expect(ouverturePorte(etat({ passageOuvert: PAS_PORTE / 2 }))).toBeCloseTo(0.5, 5);
    expect(ouverturePorte(etat({ passageOuvert: 1 }))).toBeCloseTo(1 / PAS_PORTE, 5);
  });
  it("`?essai=porte` (ouverte pour de bon, bien plus que la durée) : grande ouverte tout de suite", () => {
    expect(ouverturePorte(etat({ passageOuvert: 2_000_000 }))).toBe(1);
  });
});

describe("la sortie du poteau, fonction du pas", () => {
  it("rentré tant qu'il n'est pas armé ; armé, il sort en PAS_POTEAU_SORT pas ; après son sauvetage il rentre en PAS_POTEAU_RENTRE pas", () => {
    expect(sortiePoteau(etat({}))).toBe(0);
    expect(sortiePoteau(etat({ lampes: [true, false] }))).toBe(0); // une lampe seule ne le fait pas sortir
    expect(sortiePoteau(etat({ lampes: [true, true], sauveurTick: 1000, tick: 1000 }))).toBe(0);
    expect(sortiePoteau(etat({ lampes: [true, true], sauveurTick: 1000, tick: 1000 + PAS_POTEAU_SORT / 2 }))).toBeCloseTo(0.5, 5);
    expect(sortiePoteau(etat({ lampes: [true, true], sauveurTick: 1000, tick: 1000 + 10 * PAS_POTEAU_SORT }))).toBe(1);
    expect(sortiePoteau(etat({ lampes: [false, false], sauveurTick: 1000, tick: 1000 }))).toBe(1);
    expect(sortiePoteau(etat({ lampes: [false, false], sauveurTick: 1000, tick: 1000 + PAS_POTEAU_RENTRE / 2 }))).toBeCloseTo(0.5, 5);
    expect(sortiePoteau(etat({ lampes: [false, false], sauveurTick: 1000, tick: 1000 + PAS_POTEAU_RENTRE }))).toBe(0);
  });
});

describe("la lame de l'aiguillage", () => {
  it.each(IDS_PLANS)("%s : trois angles — le long de la rampe, vers le verrou, vers l'élément du thème — et une couleur de flèche par trajet", (plan) => {
    const g = geoAiguillage(table(plan, "ocean"))!;
    expect(g.versVerrou).not.toBeNull();
    expect(g.versElement).not.toBeNull();
    expect(angleVise(g, 0)).toBe(g.defaut);
    expect(angleVise(g, 1)).toBe(g.versVerrou);
    expect(angleVise(g, 2)).toBe(g.versElement);
    expect(couleurAiguillage(0)).toBeNull();
    expect(couleurAiguillage(1)).not.toBeNull();
    expect(couleurAiguillage(2)).not.toBe(couleurAiguillage(1));
  });
  it("elle tourne par le plus court chemin, sans dépasser sa cible", () => {
    expect(rapprocher(0, 1, 0.25)).toBe(0.25);
    expect(rapprocher(0, 0.1, 0.25)).toBe(0.1);
    // de 3 rad à −3 rad : par l'arrière (le plus court), donc en augmentant
    expect(rapprocher(3, -3, 0.2)).toBeCloseTo(3.2, 5);
    expect(rapprocher(-3, 3, 0.2)).toBeCloseTo(-3.2, 5);
  });
});
