import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { DELAI_BOT, DUREE_TICKS, NB_CASES, NB_CIBLES, Partie, VARIANTE, VARIANTE_NOM, VARIANTES, dailyCibles, jouer, medailleDe, partieDuBot, scoreParColonnes, seuilsDe, touchesDuBot } from "../src/index";

// Les deux variantes de « Cibles » (lot K4g), chacune par ses propres règles : `variante.ts` est le seul endroit qui les distingue. Ces tests passent les DEUX variantes, quelle que soit celle de ce jeu :
// c'est ce qui garde le modèle du générateur (`npm run nouveau-jeu -- --classement score|temps`).
const c = dailyCibles(daysFromCivil(2026, 11, 4));
const { score, temps } = VARIANTES;

describe("variante « score »", () => {
  it("compte une cible touchée dans sa fenêtre, ignore le reste", () => {
    const p = new Partie(c, score);
    const x = c.cibles[0]!;
    while (p.tick < x.d - 1) p.avancer();
    expect(p.toucher(x.c)).toBe(false); // pas encore apparue
    p.avancer();
    expect(p.toucher((x.c + 1) % NB_CASES)).toBe(false); // mauvaise case
    expect(p.toucher(x.c)).toBe(true);
    expect(p.toucher(x.c)).toBe(false); // déjà touchée
    const r = p.resultat();
    expect({ touches: r.touches, dernier: r.dernier, ratees: r.ratees }).toEqual({ touches: 1, dernier: x.d, ratees: 3 });
  });
  it("la partie dure 30 s, le bot touche tout 12 ticks après l'apparition", () => {
    const r = partieDuBot(c, score);
    expect({ touches: r.touches, dernier: r.dernier, ticks: r.ticks }).toEqual({ touches: NB_CIBLES, dernier: c.cibles[NB_CIBLES - 1]!.d + DELAI_BOT, ticks: DUREE_TICKS });
  });
  it("une touche après la cible ne compte plus", () => {
    const x = c.cibles[0]!;
    expect(jouer(c, [{ tick: x.f, c: x.c }], score).touches).toBe(0);
    expect(jouer(c, [{ tick: x.f - 1, c: x.c }], score).touches).toBe(1);
  });
  it("le Diamant est la partie du bot ; or, argent et bronze à 50, 30 et 15 %", () => {
    expect(seuilsDe(c, score)).toEqual({ author: 20, gold: 10, silver: 6, bronze: 3 });
    const s = seuilsDe(c, score);
    expect([20, 10, 9, 5, 3, 2].map((touches) => medailleDe([touches, 0], s, score))).toEqual(["author", "gold", "silver", "bronze", "bronze", null]);
  });
  it("le score : les cibles touchées puis le tick de la dernière touche", () => {
    expect(scoreParColonnes({ touches: 17, dernier: 700 }, score)).toEqual({ touches: 17, dernier: 700 });
    expect(score.formatScore([17, 700], "fr")).toBe("17 / 20");
  });
});

describe("variante « temps »", () => {
  it("la première cible est là dès le tick 0, la suivante le tick d'après la touche, jamais deux touches dans le même tick", () => {
    const p = new Partie(c, temps);
    expect(p.cibleVisible()).toBe(0);
    expect(p.toucher((c.cibles[0]!.c + 1) % NB_CASES)).toBe(false);
    expect(p.toucher(c.cibles[0]!.c)).toBe(true);
    expect(p.cibleVisible()).toBe(-1);
    expect(p.toucher(c.cibles[1]!.c)).toBe(false); // même tick
    p.avancer();
    expect(p.cibleVisible()).toBe(1);
    expect(p.toucher(c.cibles[2]!.c)).toBe(false); // dans l'ordre seulement
  });
  it("la partie finit à la dernière cible ; le score est son temps (le tick compte)", () => {
    const r = partieDuBot(c, temps);
    expect(r).toMatchObject({ touches: NB_CIBLES, ratees: 0, dernier: DELAI_BOT + (NB_CIBLES - 1) * (DELAI_BOT + 1) });
    expect(r.ticks).toBe(r.dernier); // le temps s'arrête avec la partie
    expect(temps.score(r)).toEqual([r.dernier + 1]);
    expect(temps.score(r)[0]).toBe(260);
  });
  it("une partie inachevée vaut 30 s, le pire temps, et ne gagne aucune médaille", () => {
    const r = jouer(c, temps.touchesDuBot(c).slice(0, 5), temps);
    expect(r.ticks).toBe(DUREE_TICKS);
    expect(temps.score(r)).toEqual([DUREE_TICKS]);
    expect(temps.medaille(temps.score(r), seuilsDe(c, temps))).toBeNull();
  });
  it("le Diamant est le temps du bot ; or, argent et bronze à 130, 160 et 200 %", () => {
    const s = seuilsDe(c, temps);
    expect(s).toEqual({ author: 260, gold: 338, silver: 416, bronze: 520 });
    expect([200, 260, 261, 338, 339, 416, 417, 520, 521].map((t) => temps.medaille([t], s))).toEqual(["author", "author", "gold", "gold", "silver", "silver", "bronze", "bronze", null]);
  });
  it("un joueur scripté qui hésite finit quand même, plus tard", () => {
    const vif = jouer(c, temps.joueur(c, () => 15), temps);
    const hesite = jouer(c, temps.joueur(c, () => 15, (i) => i === 3 || i === 7), temps);
    expect(vif.touches).toBe(NB_CIBLES);
    expect(hesite.touches).toBe(NB_CIBLES);
    expect(hesite.dernier).toBe(vif.dernier + 20);
    expect(hesite.ratees).toBe(2);
    expect(temps.formatScore([260], "fr")).toBe("8,67 s");
    expect(temps.formatScore([260], "en")).toBe("8.67 s");
  });
});

describe("la variante de ce jeu et sa fiche", () => {
  const fiche = JSON.parse(readFileSync(new URL("../../../config/jeux/cibles.json", import.meta.url), "utf8")) as {
    classement: { colonnes: { nom: string; sens: string }[]; unite: string; format: string; cumul: boolean };
    medailles: { methode: string; bareme: number[]; plafondDiamant?: number };
  };
  it(`« ${VARIANTE_NOM} » : colonnes, unité, format et barème sont ceux de config/jeux/cibles.json`, () => {
    expect(fiche.classement.colonnes.slice(0, VARIANTE.fiche.colonnes.length)).toEqual(VARIANTE.fiche.colonnes);
    expect(fiche.classement.colonnes.slice(VARIANTE.fiche.colonnes.length).map((k) => k.nom)).toEqual(["submitted_at", "player_id"]);
    expect({ unite: fiche.classement.unite, format: fiche.classement.format }).toEqual({ unite: VARIANTE.fiche.unite, format: VARIANTE.fiche.format });
    expect(fiche.medailles.bareme).toEqual([...VARIANTE.fiche.bareme]);
    expect(fiche.medailles.plafondDiamant).toBe(VARIANTE.fiche.plafondDiamant);
  });
  it("le bot de la variante est celui du jeu", () => {
    expect(touchesDuBot(c)).toEqual(VARIANTE.touchesDuBot(c));
  });
});
