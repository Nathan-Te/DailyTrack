import { describe, expect, it } from "vitest";
import { seuilsDuServeur } from "@cdj/ui/src/classementLogique";
import type { Classement, LigneClassement } from "../src/classementDonnees";
import { courseDesGroupes, courseDesJoueurs, type ContexteCourse } from "../src/classementCourse";
import { avanceDuPremier, ecartAuPremier, sensDeLaVue, valeurDeLigne } from "../src/classementEcarts";

// Lot U6 : ce que dit un classement quand on le lit — l'écart de chaque ligne au premier, l'avance du premier, « Ta course » des joueurs et des groupes.
const JEUX = [
  { jeu: "cdj", site: "track", nom: "Track" },
  { jeu: "jump", site: "jump", nom: "Jump" },
];
const res = (rang: number, tempsMs: number) => ({ rang, tempsMs, medaille: null });
const ligne = (rang: number, pseudo: string, t: number, j: number, o: Partial<LigneClassement> = {}): LigneClassement => ({ rang, pseudo, tempsMs: t + j, complet: true, resultats: { cdj: res(rang, t), jump: res(rang, j) }, ...o });
const cumul = (top: LigneClassement[], moi?: LigneClassement): Classement => ({ date: "2026-11-18", journee: 23, ouvert: true, vue: "cumul", jeux: JEUX, classes: top.length, top, ...(moi ? { moi: { ...moi, classes: top.length } } : {}) });
const x: ContexteCourse = { langue: "fr", format: "temps", nomDuJeu: (j) => j.nom, nomMedaille: (t) => ({ diamant: "Diamant", or: "Or", argent: "Argent", bronze: "Bronze" })[t], rangLu: (r) => (r === 1 ? "1er" : `${r}e`), seuils: null, racine: "../" };
const nbsp = " ";

const TOP = [ligne(1, "Biscotte", 31_646, 30_225), ligne(2, "Delta", 31_897, 30_159, { moi: true }), ligne(3, "Gaspard", 32_096, 30_508)];

describe("lot U6 : l'écart au premier", () => {
  it("« +0,185 » sous un temps ; jamais pour le premier, ni sans résultat, ni à égalité", () => {
    const [un, deux] = TOP;
    expect(ecartAuPremier({}, deux!, un, "temps", "fr")).toBe("+0,185");
    expect(ecartAuPremier({}, deux!, un, "temps", "en")).toBe("+0.185");
    expect(ecartAuPremier({}, un!, un, "temps", "fr")).toBeNull();
    expect(ecartAuPremier({}, { ...deux!, tempsMs: null }, un, "temps", "fr")).toBeNull();
    expect(ecartAuPremier({}, { ...deux!, tempsMs: un!.tempsMs }, un, "temps", "fr")).toBeNull();
    // Au-delà d'une minute : « +1:02,345 » (pas d'unité).
    expect(ecartAuPremier({}, { ...deux!, tempsMs: un!.tempsMs! + 62_345 }, un, "temps", "fr")).toBe("+1:02,345");
  });
  it("l'avance du premier sur le deuxième, avec son unité (« 0,185 s ») ; rien sans deuxième ou à égalité", () => {
    expect(avanceDuPremier(TOP[0], TOP[1], "temps", "fr")).toBe(`0,185${nbsp}s`);
    expect(avanceDuPremier(TOP[0], undefined, "temps", "fr")).toBeNull();
    expect(avanceDuPremier(TOP[0], { ...TOP[1]!, tempsMs: TOP[0]!.tempsMs }, "temps", "fr")).toBeNull();
  });
  it("à la hauteur le plus grand gagne : l'écart est un score de moins, signé « - »", () => {
    const h = (rang: number, valeur: number): LigneClassement => ({ rang, pseudo: `H${rang}`, tempsMs: 40_000, score: { unite: "mm", valeur, vies: 2 }, complet: true, resultats: {} });
    expect(sensDeLaVue({ unite: "mm" })).toBe("grand");
    expect(sensDeLaVue({})).toBe("petit");
    expect(valeurDeLigne(h(1, 12_000))).toBe(12_000);
    expect(ecartAuPremier({ unite: "mm" }, h(2, 11_000), h(1, 12_000), "hauteur", "fr")).toMatch(/^-/);
  });
});

describe("lot U6 : « Ta course » des joueurs", () => {
  it("au cumul, derrière le premier : « pour passer 1er », le jeu où il te prend le plus de temps, « Rejouer <jeu> »", () => {
    const moi = TOP[1]!;
    const d = courseDesJoueurs(cumul(TOP, moi), x)!;
    expect(d.rangLu).toBe("2e");
    expect(d.phrase).toEqual({ type: "premier", ecart: `0,185${nbsp}s` });
    // Biscotte bat Delta de 251 ms sur Track ; Delta bat Biscotte de 66 ms sur Jump : le jeu perdu est Track.
    expect(d.sous).toEqual({ type: "perte", nom: "Biscotte", ecart: `0,251${nbsp}s`, jeu: "Track" });
    expect(d.bouton).toEqual({ href: "../track/", jeu: "Track" });
  });
  it("derrière un autre joueur : « pour doubler <pseudo> »", () => {
    const moi = ligne(3, "Gaspard", 32_096, 30_508, { moi: true });
    const d = courseDesJoueurs(cumul([TOP[0]!, ligne(2, "Delta", 31_897, 30_159), moi], moi), x)!;
    expect(d.phrase).toEqual({ type: "doubler", ecart: `0,548${nbsp}s`, nom: "Delta" });
  });
  it("premier : « d'avance sur <pseudo> » ; seul sur le classement : rien à dire", () => {
    const moi = ligne(1, "Biscotte", 31_646, 30_225, { moi: true });
    const d = courseDesJoueurs(cumul([moi, ligne(2, "Delta", 31_897, 30_159)], moi), x)!;
    expect(d.phrase).toEqual({ type: "avance", ecart: `0,185${nbsp}s`, nom: "Delta" });
    expect(d.sous).toBeNull();
    expect(courseDesJoueurs(cumul([moi], moi), x)).toBeNull();
  });
  it("pas classé dans la vue (pas de ligne, ou pas tous les jeux au cumul) : pas de barre", () => {
    expect(courseDesJoueurs(cumul(TOP), x)).toBeNull();
    const moi = ligne(4, "Moi", 1, 1, { moi: true, tempsMs: null, complet: false });
    expect(courseDesJoueurs(cumul(TOP, moi), x)).toBeNull();
  });
  it("hors du haut du classement : l'écart est celui au premier", () => {
    const moi = ligne(120, "Loin", 50_000, 50_000, { moi: true });
    const d = courseDesJoueurs(cumul(TOP, moi), x)!;
    expect(d.phrase.type).toBe("premier");
    expect(d.rangLu).toBe("120e");
  });
  it("dans la vue d'un jeu : l'écart à la médaille suivante, « Rejouer <jeu> » mène à ce jeu", () => {
    const moi = { ...TOP[1]!, tempsMs: 31_897 };
    const c: Classement = { ...cumul(TOP, moi), vue: "track", top: TOP.map((l) => ({ ...l, tempsMs: l.resultats.cdj!.tempsMs })), moi: { ...moi, tempsMs: 31_897, classes: 3 } };
    const seuils = seuilsDuServeur({ author: 31_750, gold: 32_000, silver: 34_000, bronze: 38_500 });
    const d = courseDesJoueurs(c, { ...x, seuils })!;
    expect(d.sous).toEqual({ type: "medaille", medaille: "Diamant", ecart: `0,147${nbsp}s` });
    expect(d.bouton).toEqual({ href: "../track/", jeu: "Track" });
    // Sans seuils (jeu sans médaille, niveau pas prêt, jour passé) : pas de seconde ligne.
    expect(courseDesJoueurs(c, x)!.sous).toBeNull();
  });
});

describe("lot U6 : « Ta course » des groupes", () => {
  const G = [
    { id: "g1", nom: "Les Tontons", rang: 1, score: 30_977, trio: [{ pseudo: "Biscotte" }, { pseudo: "Delta" }, { pseudo: "Lenka" }] },
    { id: "g2", nom: "Pause Café", rang: 2, score: 31_683, trio: [{ pseudo: "Gaspard" }, { pseudo: "Marlou" }, { pseudo: "Pépin" }] },
    { id: "g3", nom: "Turbo", rang: 3, score: 32_410, trio: [] },
  ];
  const cg = { langue: "fr" as const, format: "temps" as const, vue: "cumul", nomDuJeu: null, rangLu: x.rangLu, racine: "../" };
  it("ton groupe premier : « d'avance sur <groupe> » et ton temps compte (tu es 2e de ton groupe)", () => {
    const d = courseDesGroupes(G, { ...cg, monGroupe: "g1", pseudo: "Delta" })!;
    expect(d.rangLu).toBe("1er");
    expect(d.phrase).toEqual({ type: "avance", ecart: `0,706${nbsp}s`, nom: "Pause Café" });
    expect(d.sous).toEqual({ type: "groupeCompte", rangLu: "2e" });
    expect(d.bouton).toEqual({ href: "../", jeu: null });
  });
  it("ton temps ne compte pas (pas dans les trois) ; derrière un groupe : « pour doubler » ; dans un jeu : « Rejouer <jeu> »", () => {
    const d = courseDesGroupes(G, { ...cg, monGroupe: "g3", pseudo: "Zadig", vue: "track", nomDuJeu: "Track" })!;
    expect(d.phrase).toEqual({ type: "doubler", ecart: `0,727${nbsp}s`, nom: "Pause Café" });
    expect(d.sous).toEqual({ type: "groupeNonCompte" });
    expect(d.bouton).toEqual({ href: "../track/", jeu: "Track" });
    expect(courseDesGroupes(G, { ...cg, monGroupe: "g2", pseudo: null })!.phrase.type).toBe("premier");
  });
  it("sans groupe, ou si ton groupe n'est pas classé : pas de barre", () => {
    expect(courseDesGroupes(G, { ...cg, monGroupe: null, pseudo: "Delta" })).toBeNull();
    expect(courseDesGroupes(G, { ...cg, monGroupe: "inconnu", pseudo: "Delta" })).toBeNull();
    expect(courseDesGroupes([G[0]!], { ...cg, monGroupe: "g1", pseudo: "Delta" })).toBeNull(); // seul : personne à devancer
  });
});
