import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { arrondir, BOTS_DE_REFERENCE, dailyBlocks, medailleDe, PIECES_DU_DIAMANT, SEUILS_MEDAILLES, seuils, seuilsDuJour, seuilsSontValides, TAILLE_SERIE } from "../src/index";
import { jouerDiamant, partieDuDiamant } from "../src/diamant";
import { jouerGlouton } from "../src/glouton";
import { CALIBRATION } from "./aide";

// Les médailles (lots B3, B8, B8b et B8c) : quatre seuils, les mêmes tous les jours d'une version de règles, **une donnée de la fiche du jeu** (`medailles.seuils`, que Nathan retouche en une ligne) ; au départ, chacun est la médiane,
// sur 1 000 jours, du score d'un bot de référence arrêté après un nombre fixe de pièces (`BOTS_DE_REFERENCE`) — la mesure complète est `npm run calibrer:medailles` (README du lot B8c) ; ici un échantillon de jours, pour qu'un bot ou
// un tirage qui s'éloigne de la calibration (`CALIBRATION`, `aide.ts`) fasse échouer le test. Aucun test ne fige les valeurs de la fiche : les retoucher ne casse rien tant qu'elles restent croissantes et à des rapports sensés.
const PREMIER = daysFromCivil(2026, 11, 2);
const mediane = (a: number[]): number => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)]!;

describe("les seuils des médailles", () => {
  it("les seuils sont ceux de la fiche (`medailles.seuils` : bronze, argent, or, diamant), quatre entiers strictement croissants, les mêmes tous les jours", () => {
    const fiche = JSON.parse(readFileSync(new URL("../../../config/jeux/blocks.json", import.meta.url), "utf8")) as { medailles: { seuils: { bronze: number; argent: number; or: number; diamant: number } } };
    const f = fiche.medailles.seuils;
    expect(SEUILS_MEDAILLES).toEqual({ bronze: f.bronze, silver: f.argent, gold: f.or, author: f.diamant });
    expect(seuils()).toEqual(SEUILS_MEDAILLES);
    expect(seuils()).not.toBe(SEUILS_MEDAILLES); // une copie : personne ne change la constante
    const s = SEUILS_MEDAILLES;
    for (const v of Object.values(s)) expect(Number.isInteger(v)).toBe(true);
    expect(s.bronze).toBeGreaterThan(0);
    expect(s.bronze < s.silver && s.silver < s.gold && s.gold < s.author).toBe(true);
    expect(seuilsSontValides(s)).toBe(true);
    for (let i = 0; i < 40; i++) expect(seuilsDuJour(dailyBlocks(PREMIER + i)), `jour ${i}`).toEqual(SEUILS_MEDAILLES);
  });

  it("des seuils qui ne croissent pas ne sont pas valides (une fiche mal retouchée arrête le jeu et le serveur plutôt que de servir de mauvaises médailles)", () => {
    expect(seuilsSontValides({ bronze: 100, silver: 100, gold: 300, author: 900 })).toBe(false);
    expect(seuilsSontValides({ bronze: 100, silver: 200, gold: 150, author: 900 })).toBe(false);
    expect(seuilsSontValides({ bronze: 0, silver: 200, gold: 300, author: 900 })).toBe(false);
    expect(seuilsSontValides({ bronze: 100.5, silver: 200, gold: 300, author: 900 })).toBe(false);
    expect(seuilsSontValides({ bronze: 100, silver: 200, gold: 300, author: 900 })).toBe(true);
  });

  it("arrondis : au plus proche, à 50 près sous 1 000, à 100 près jusqu'à 5 000, à 500 près au-delà", () => {
    expect([0, 24, 25, 949, 975, 999, 1000, 1133, 1149, 1150, 2168, 4921, 5000, 5049, 5251, 11_573, 11_749, 11_750, 12_921].map(arrondir)).toEqual([0, 0, 50, 950, 1000, 1000, 1000, 1100, 1100, 1200, 2200, 4900, 5000, 5000, 5500, 11_500, 11_500, 12_000, 13_000]);
    for (const v of Object.values(CALIBRATION)) expect(arrondir(v), `${v}`).toBe(v); // la calibration est arrondie comme on retient un seuil
  });

  it("les rapports entre médailles sont dans la cible du lot B8c : chacun entre 1,5 et 2,5 (ceux de la fiche, et ceux de la calibration)", () => {
    for (const s of [SEUILS_MEDAILLES, { bronze: CALIBRATION.bronze, silver: CALIBRATION.silver, gold: CALIBRATION.gold, author: CALIBRATION.author }]) {
    for (const [nom, r] of [["argent / bronze", s.silver / s.bronze], ["or / argent", s.gold / s.silver], ["Diamant / or", s.author / s.gold]] as const) {
      expect(r, nom).toBeGreaterThanOrEqual(1.5);
      expect(r, nom).toBeLessThanOrEqual(2.5);
    }
    }
  });

  it("chaque valeur de la calibration est le score médian de son bot de référence arrêté après son nombre de pièces (échantillon de 60 jours, marge de 20 %)", () => {
    const jours = Array.from({ length: 60 }, (_, i) => dailyBlocks(PREMIER + i));
    for (const nom of ["bronze", "silver", "gold", "author"] as const) {
      const { bot, pieces } = BOTS_DE_REFERENCE[nom];
      const scores = jours.map((c) => (bot === "moyen" ? jouerGlouton(c, pieces) : jouerDiamant(c, undefined, pieces)).resultat.score);
      const m = mediane(scores);
      expect(Math.abs(m - CALIBRATION[nom]) / CALIBRATION[nom], `${nom} : médiane ${m}`).toBeLessThanOrEqual(0.2);
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
});
