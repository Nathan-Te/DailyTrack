import { describe, expect, it } from "vitest";
import { AnalyseurPanique, HYSTERESIS, inclinaisonDe, longueurCouverte, niveauDe, type Niveau, paniqueDeFacteurs, paniqueDeLActive, SEUILS_PANIQUE } from "../src/panique";
import { piece, vue } from "./_vues";

// Lot T5 — la panique des yeux : une fonction PURE de la vue de la partie (bornes, états, hystérésis), puis l'analyseur sur des vues écrites à la main.
describe("la panique : des facteurs à la valeur", () => {
  it("est toujours dans [0, 1], monte avec chaque facteur et se règle par le gain", () => {
    const zero = { vitesse: 0, inclinaison: 0, porteAFaux: 0, oscillation: 0 };
    expect(paniqueDeFacteurs(zero)).toBe(0);
    expect(paniqueDeFacteurs({ vitesse: 9, inclinaison: 9, porteAFaux: 9, oscillation: 9 })).toBe(1);
    expect(paniqueDeFacteurs({ vitesse: -3, inclinaison: -3, porteAFaux: -3, oscillation: -3 })).toBe(0);
    for (const k of ["vitesse", "inclinaison", "porteAFaux", "oscillation"] as const) {
      let avant = 0;
      for (let x = 0; x <= 1.0001; x += 0.1) {
        const v = paniqueDeFacteurs({ ...zero, [k]: x });
        expect(v).toBeGreaterThanOrEqual(avant);
        expect(v).toBeLessThanOrEqual(1);
        avant = v;
      }
    }
    const moyen = { vitesse: 0.5, inclinaison: 0.5, porteAFaux: 0.5, oscillation: 0.5 };
    expect(paniqueDeFacteurs(moyen, 0)).toBe(0);
    expect(paniqueDeFacteurs(moyen, 2)).toBeGreaterThan(paniqueDeFacteurs(moyen, 1));
    expect(paniqueDeFacteurs(moyen, 100)).toBe(1);
  });

  it("la pièce active panique en approchant du vide et se détend posée à plat (rien sans vide)", () => {
    expect(paniqueDeLActive(0, 0)).toBe(0); // tout est appuyé
    expect(paniqueDeLActive(1, 20)).toBeLessThan(SEUILS_PANIQUE[0]); // loin du vide : calme
    expect(paniqueDeLActive(1, 0.2)).toBeGreaterThan(SEUILS_PANIQUE[2]); // au bord du vide : affolée
    let avant = 0;
    for (let d = 8; d >= 0; d -= 0.5) {
      const v = paniqueDeLActive(1, d);
      expect(v).toBeGreaterThanOrEqual(avant);
      avant = v;
    }
    for (const [vide, d, g] of [[-1, -5, 1], [3, 0, 1], [1, 0, 50], [0.5, 2, 0]] as const) {
      const v = paniqueDeLActive(vide, d, g);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it("les quatre états : seuils, hystérésis (pas de scintillement), jamais hors de 0 à 3", () => {
    expect(niveauDe(0, 0)).toBe(0);
    expect(niveauDe(SEUILS_PANIQUE[0], 0)).toBe(1);
    expect(niveauDe(SEUILS_PANIQUE[1], 0)).toBe(2);
    expect(niveauDe(SEUILS_PANIQUE[2], 0)).toBe(3);
    expect(niveauDe(5, 0)).toBe(3);
    expect(niveauDe(-5, 3)).toBe(0);
    // Juste sous un seuil, on garde le niveau atteint ; en dessous de la marge, on redescend.
    expect(niveauDe(SEUILS_PANIQUE[1] - HYSTERESIS / 2, 2)).toBe(2);
    expect(niveauDe(SEUILS_PANIQUE[1] - HYSTERESIS * 2, 2)).toBe(1);
    // Une valeur qui oscille autour d'un seuil ne change d'état qu'une fois.
    let n: Niveau = 1;
    let changements = 0;
    for (let i = 0; i < 40; i++) {
      const suivant = niveauDe(SEUILS_PANIQUE[1] + (i % 2 ? 0.01 : -0.01), n);
      if (suivant !== n) changements++;
      n = suivant;
    }
    expect(changements).toBe(1);
  });

  it("l'inclinaison est l'écart à un quart de tour : une pièce couchée n'est pas penchée", () => {
    expect(inclinaisonDe(0)).toBeCloseTo(0);
    expect(inclinaisonDe(Math.PI / 2)).toBeCloseTo(0);
    expect(inclinaisonDe(-Math.PI)).toBeCloseTo(0);
    expect(inclinaisonDe(0.3)).toBeCloseTo(0.3);
    expect(inclinaisonDe(Math.PI / 2 + 0.3)).toBeCloseTo(0.3);
    expect(inclinaisonDe(Math.PI / 4)).toBeCloseTo(Math.PI / 4);
    for (let a = -7; a < 7; a += 0.37) expect(inclinaisonDe(a)).toBeLessThanOrEqual(Math.PI / 4 + 1e-9);
  });

  it("longueurCouverte : l'union des appuis, rognée à la largeur de la pièce", () => {
    expect(longueurCouverte(0, 2, [])).toBe(0);
    expect(longueurCouverte(0, 2, [[-5, 5]])).toBe(2);
    expect(longueurCouverte(0, 2, [[0, 1], [0.5, 1.5]])).toBeCloseTo(1.5);
    expect(longueurCouverte(0, 2, [[1, 3], [-1, 0.5]])).toBeCloseTo(1.5);
    expect(longueurCouverte(0, 2, [[3, 4]])).toBe(0);
  });
});

describe("l'analyseur de panique, sur la vue", () => {
  const DEMI8 = 28; // la plateforme couvre de −3,5 à 3,5 m

  it("une tour calme (pièces endormies, bien appuyées) reste calme, tick après tick", () => {
    const a = new AnalyseurPanique(DEMI8);
    let r = a.analyser(vue(1, [piece(0, { y: 1 }), piece(1, { y: 3 })]));
    for (let t = 2; t < 120; t++) r = a.analyser(vue(t, [piece(0, { y: 1 }), piece(1, { y: 3 })]));
    expect(r.get(0)!.niveau).toBe(0);
    expect(r.get(1)!.niveau).toBe(0);
    expect(r.get(1)!.porteAFaux).toBeCloseTo(0, 5);
    expect(a.oscillation).toBe(0);
  });

  it("une pièce qui dépasse de son appui a du porte-à-faux, et une pièce qui tangue affole la tour", () => {
    const a = new AnalyseurPanique(DEMI8);
    // La pièce 1 pend à moitié dans le vide, penchée de 20°, et bouge : elle panique plus que la pièce 0, bien posée.
    let r = a.analyser(vue(1, [piece(0, { y: 1 }), piece(1, { x: 0.2, y: 3 })]));
    for (let t = 2; t < 90; t++) {
      const bouge = Math.sin(t / 3) * 0.04;
      r = a.analyser(vue(t, [piece(0, { y: 1 }), piece(1, { x: 1.2 + bouge, y: 3 + bouge, angle: 0.35, endormie: false })]));
    }
    expect(r.get(1)!.porteAFaux).toBeGreaterThan(0.2);
    expect(r.get(1)!.valeur).toBeGreaterThan(r.get(0)!.valeur);
    expect(r.get(1)!.niveau).toBeGreaterThanOrEqual(1);
    expect(a.oscillation).toBeGreaterThan(0);
  });

  it("monte vite, redescend lentement ; le gain de rendu à 0 coupe la panique ; `nouveauxAffoles` ne le dit qu'une fois", () => {
    let gain = 1;
    const a = new AnalyseurPanique(DEMI8, undefined, () => gain);
    const fou = (t: number): ReturnType<typeof vue> => vue(t, [piece(0, { x: 0.8 * t, y: 1 + t, angle: 0.4, endormie: false })]);
    a.analyser(fou(0));
    let premiersAffoles = 0;
    let n = 0;
    for (let t = 1; t < 30; t++) {
      a.analyser(fou(t));
      premiersAffoles += a.nouveauxAffoles.length;
      n = a.analyser(fou(t)).get(0)!.niveau;
    }
    expect(n).toBe(3);
    expect(premiersAffoles).toBe(1);
    // Au calme, il faut du temps pour redescendre.
    const calme = (t: number): ReturnType<typeof vue> => vue(t, [piece(0, { x: 0, y: 1, endormie: true })]);
    const apres10 = (() => {
      let r = a.analyser(calme(100));
      for (let t = 101; t < 110; t++) r = a.analyser(calme(t));
      return r.get(0)!.niveau;
    })();
    expect(apres10).toBeGreaterThanOrEqual(2);
    gain = 0;
    const b = new AnalyseurPanique(DEMI8, undefined, () => gain);
    b.analyser(fou(0));
    for (let t = 1; t < 30; t++) b.analyser(fou(t));
    expect(b.analyser(fou(30)).get(0)!.niveau).toBe(0);
  });

  it("la pièce active qui approche du vide panique ; au-dessus de la tour, elle reste calme", () => {
    const sur = (x: number, y: number) => vue(1, [piece(0, { y: 1 }), piece(1, { etat: "active", x, y, endormie: false })]);
    const a = new AnalyseurPanique(DEMI8);
    for (let t = 1; t < 60; t++) a.analyser({ ...sur(0, 8), tick: t });
    expect(a.analyser({ ...sur(0, 8), tick: 60 }).get(1)!.niveau).toBe(0); // au-dessus de la plateforme, loin
    const b = new AnalyseurPanique(DEMI8);
    for (let t = 1; t < 60; t++) b.analyser({ ...sur(7, 3.2), tick: t });
    expect(b.analyser({ ...sur(7, 3.2), tick: 60 }).get(1)!.niveau).toBeGreaterThanOrEqual(2); // à côté de la plateforme, près de l'eau
  });

  it("`reinitialiser` oublie tout, et un même tick relu ne change rien", () => {
    const a = new AnalyseurPanique(DEMI8);
    const v = vue(5, [piece(0, { x: 4, y: 3, angle: 0.3, endormie: false })]);
    const r1 = a.analyser(v);
    expect(a.analyser(v)).toBe(r1);
    a.reinitialiser();
    expect(a.analyser(v)).not.toBe(r1);
    expect(a.oscillation).toBe(0);
  });
});
