import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { arrondir, BOTS_DE_REFERENCE, dailyBlocks, medailleDe, PART_DU_DIAMANT_MEDIAN, PIECES_DU_DIAMANT, SEUILS_MEDAILLES, seuils, seuilsDuJour, TAILLE_SERIE } from "../src/index";
import { jouerDiamant, partieDuDiamant } from "../src/diamant";
import { jouerGlouton } from "../src/glouton";

// Les médailles (lots B3, B8 et B8b) : quatre constantes, les mêmes tous les jours d'une version de règles ; chacune est la médiane, sur 1 000 jours, du score d'un bot de référence arrêté après un nombre fixe de pièces
// (`BOTS_DE_REFERENCE`) — la mesure complète est `npm run calibrer:medailles` (README du lot B8b) ; ici un échantillon de jours, pour qu'une constante qui s'éloigne de sa mesure fasse échouer le test.
const PREMIER = daysFromCivil(2026, 11, 2);
const mediane = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;

describe("les seuils des médailles", () => {
  it("quatre constantes entières strictement croissantes, les mêmes tous les jours : bronze 1 100, argent 2 200, or 4 900, Diamant 11 500", () => {
    expect(SEUILS_MEDAILLES).toEqual({ bronze: 1100, silver: 2200, gold: 4900, author: 11_500 });
    expect(seuils()).toEqual(SEUILS_MEDAILLES);
    expect(seuils()).not.toBe(SEUILS_MEDAILLES); // une copie : personne ne change la constante
    const s = SEUILS_MEDAILLES;
    expect(s.bronze).toBeGreaterThan(0);
    expect(s.bronze < s.silver && s.silver < s.gold && s.gold < s.author).toBe(true);
    for (let i = 0; i < 40; i++) expect(seuilsDuJour(dailyBlocks(PREMIER + i)), `jour ${i}`).toEqual(SEUILS_MEDAILLES);
  });

  it("arrondis : au plus proche, à 50 près sous 1 000, à 100 près jusqu'à 5 000, à 500 près au-delà", () => {
    expect([0, 24, 25, 949, 975, 999, 1000, 1133, 1149, 1150, 2168, 4921, 5000, 5049, 5251, 11_573, 11_749, 11_750, 12_921].map(arrondir)).toEqual([0, 0, 50, 950, 1000, 1000, 1000, 1100, 1100, 1200, 2200, 4900, 5000, 5000, 5500, 11_500, 11_500, 12_000, 13_000]);
    for (const v of Object.values(SEUILS_MEDAILLES)) expect(arrondir(v), `${v}`).toBe(v);
  });

  it("les rapports entre médailles sont dans la cible du seed : chacun entre 1,5 et 2,5", () => {
    const s = SEUILS_MEDAILLES;
    for (const [nom, r] of [["argent / bronze", s.silver / s.bronze], ["or / argent", s.gold / s.silver], ["Diamant / or", s.author / s.gold]] as const) {
      expect(r, nom).toBeGreaterThanOrEqual(1.5);
      expect(r, nom).toBeLessThanOrEqual(2.5);
    }
  });

  it("chaque seuil est le score médian de son bot de référence arrêté après son nombre de pièces (échantillon de 60 jours, marge de 20 %)", () => {
    const jours = Array.from({ length: 60 }, (_, i) => dailyBlocks(PREMIER + i));
    for (const nom of ["bronze", "silver", "gold", "author"] as const) {
      const { bot, pieces } = BOTS_DE_REFERENCE[nom];
      const scores = jours.map((c) => (bot === "moyen" ? jouerGlouton(c, pieces) : jouerDiamant(c, undefined, pieces)).resultat.score);
      const m = mediane(scores);
      expect(Math.abs(m - SEUILS_MEDAILLES[nom]) / SEUILS_MEDAILLES[nom], `${nom} : médiane ${m}`).toBeLessThanOrEqual(0.2);
    }
  }, 120_000);

  it("les nombres de pièces sont des séries entières et le Diamant s'arrête au nombre de pièces de son seuil", () => {
    for (const { pieces } of Object.values(BOTS_DE_REFERENCE)) expect(pieces % TAILLE_SERIE, `${pieces}`).toBe(0);
    expect(PIECES_DU_DIAMANT).toBe(BOTS_DE_REFERENCE.author.pieces);
    const c = dailyBlocks(PREMIER);
    const { resultat, actions } = partieDuDiamant(c);
    expect(resultat.poses).toBeLessThanOrEqual(PIECES_DU_DIAMANT);
    expect(actions).toHaveLength(resultat.poses);
    if (resultat.raison === "arret") expect(resultat.poses).toBe(PIECES_DU_DIAMANT);
  });

  it("un bot arrêté a le score qu'il avait en continuant : s'arrêter ne change pas une pose, et la partie entière fait au moins autant", () => {
    const c = dailyBlocks(PREMIER + 3);
    const entier = jouerDiamant(c);
    const arrete = jouerDiamant(c, undefined, 90);
    expect(arrete.actions).toEqual(entier.actions.slice(0, arrete.actions.length));
    expect(entier.resultat.score).toBeGreaterThanOrEqual(arrete.resultat.score);
    const glouton = jouerGlouton(c);
    expect(jouerGlouton(c, 45).actions).toEqual(glouton.actions.slice(0, jouerGlouton(c, 45).actions.length));
  });

  it("la médaille d'un score : la plus haute dont le seuil est atteint", () => {
    const s = { author: 1000, gold: 670, silver: 330, bronze: 110 };
    expect([0, 109, 110, 329, 330, 669, 670, 999, 1000, 5000].map((v) => medailleDe([v, 3], s))).toEqual([null, null, "bronze", "bronze", "silver", "silver", "gold", "gold", "author", "author"]);
  });

  it("la fiche ne porte qu'une indication : la part du Diamant que valent les autres médailles (43 %, 19 %, 10 %)", () => {
    expect(PART_DU_DIAMANT_MEDIAN).toEqual({ gold: 43, silver: 19, bronze: 10 });
    expect(Math.round((100 * SEUILS_MEDAILLES.gold) / SEUILS_MEDAILLES.author)).toBe(PART_DU_DIAMANT_MEDIAN.gold);
    expect(Math.round((100 * SEUILS_MEDAILLES.silver) / SEUILS_MEDAILLES.author)).toBe(PART_DU_DIAMANT_MEDIAN.silver);
    expect(Math.round((100 * SEUILS_MEDAILLES.bronze) / SEUILS_MEDAILLES.author)).toBe(PART_DU_DIAMANT_MEDIAN.bronze);
  });
});
