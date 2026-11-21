import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { BUDGET_PAS_PAR_MILLE, TABLES_REFUSEES, TICKS_PAR_SECONDE, analyserTable, cleDeTable, dailyPinball, seuilsValides, toutesLesTables, type AnalyseTable } from "../src/index";

// Lot PB4 — **chaque table servie est validée et a ses seuils** : aucune bille coincée, chaque module touché, la mission réussie, et des seuils valides tirés des parties du robot. **Lot PBT1 : les tables sont dessinées, il y
// en a 24** (trois tables, de face et en miroir, dans quatre thèmes : `toutesLesTables`) — plus la trentaine de tables tirées par la période de 30 jours d'avant. **Ce test est long** (une table : de 4 à 6 secondes ; 24 tables : plus de
// 2 minutes de calcul en tout) : il est coupé en trois fichiers (une table dessinée chacun, ses huit versions : un test par table pour que chacun ait son délai) que Vitest joue en parallèle, et il est proposé à la suite
// « Régression » (README du lot PB4).
export const PREMIER_JOUR = daysFromCivil(2026, 11, 2);
const vues = new Map<string, AnalyseTable>();
/** Lot PBG2 : ces tests valident chaque table servie avec des parties du robot de 2 minutes (leur durée d'avant la boucle : ≈ 4 s par table) ; les seuils de 6 minutes (≈ 13 s par table) sont éprouvés par `seuils.test.ts`, le golden et la validation des 500 tables. */
const DUREE = 120 * TICKS_PAR_SECONDE;

export function validerTables(plan: string): void {
  describe(`la table ${plan} (de face et en miroir, dans les quatre thèmes) : chaque table servie est validée et a ses seuils`, () => {
    for (const c of toutesLesTables().filter((q) => q.plan === plan)) {
      it(`${cleDeTable(c)}`, () => {
        expect(TABLES_REFUSEES, "une table refusée n'est jamais servie").not.toContain(cleDeTable(c));
        const cle = cleDeTable(c);
        let a = vues.get(cle) ?? analyserTable(c, undefined, DUREE);
        // lot PBL1 : « chaque module touché » se juge sur les parties de six minutes, comme la validation des 24 tables (`valider:pinball`) : en deux minutes le robot n'a parfois pas encore touché un module d'une table valide
        if (a.raisons!.some((r) => r.startsWith("module jamais touché")) || (a.manquants ?? []).length > 0) a = analyserTable(c);
        vues.set(cle, a);
        // lot PBG3 : « la porte s'ouvre d'elle-même et est franchie » se juge sur les parties de six minutes (`test/validation-porte.test.ts`) : en deux minutes le robot n'a pas toujours fait tomber la banque ou mené l'orbite
        const raisons = a.raisons!.filter((r) => !r.startsWith("porte jamais"));
        expect(raisons, `${cle} : ${raisons.join(" ; ")}`).toEqual([]);
        expect(a.billes!.coincee).toBeNull();
        expect(a.manquants).toEqual([]);
        expect(a.mission).toBe(true);
        expect(seuilsValides(a.seuils)).toBe(true);
        // lot PBT1 : la fenêtre de tir humaine et la zone de tir libre sont exigées par la validation (aucune raison de les relâcher ici)
        expect(a.fenetres!.manquants, `${cle} : ${JSON.stringify(a.fenetres!.ms)}`).toEqual([]);
        expect(a.obstacles).toEqual([]);
        // lot PBR1 : le budget de pas du robot (`BUDGET_PAS_PAR_MILLE`, en pas simulés pour 1 000 pas joués : aucune seconde, rien qui dépende de la machine)
        expect(a.pasSimules * 1000, `${cle} : le robot simule trop de pas pour décider`).toBeLessThanOrEqual(BUDGET_PAS_PAR_MILLE * a.ticks.reduce((n, t) => n + t, 0));
      }, 120_000); // un jour qui refait son analyse à six minutes (voir plus haut) y met jusqu'à 30 s
    }
  });
}

/** Les jours d'une période de 30 jours servent chacun l'une des 24 tables, jamais deux jours de suite la même disposition. */
export function validerLes30Jours(): void {
  describe("la période de 30 jours : chaque jour sert une table dessinée valide", () => {
    it("les 30 jours depuis le 02/11/2026", () => {
      const cles = new Set(toutesLesTables().map(cleDeTable));
      let avant = "";
      for (let i = 0; i < 30; i++) {
        const c = dailyPinball(PREMIER_JOUR + i);
        expect(cles.has(cleDeTable(c)), formatDay(PREMIER_JOUR + i)).toBe(true);
        expect(TABLES_REFUSEES).not.toContain(cleDeTable(c));
        const d = `${c.plan}${c.miroir ? "'" : ""}`;
        expect(d).not.toBe(avant);
        avant = d;
      }
    });
  });
}
