import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { TABLES_REFUSEES, TICKS_PAR_SECONDE, analyserTable, cleDeTable, dailyPinball, seuilsValides, type AnalyseTable } from "../src/index";

// Lot PB4 — **chaque table servie pendant 30 jours est validée et a ses seuils** : aucune bille coincée, chaque module touché, la mission réussie, et des seuils valides tirés des parties du robot. **Ce test est long**
// (une table : de 4 à 6 secondes ; une trentaine de tables différentes : de 2 à 3 minutes de calcul en tout) : il est coupé en trois fichiers (dix jours chacun, un jour par test pour que chacun ait son délai) que Vitest
// joue en parallèle, et il est proposé à la suite « Régression » (README du lot PB4).
export const PREMIER_JOUR = daysFromCivil(2026, 11, 2);
const vues = new Map<string, AnalyseTable>();
/** Lot PBG2 : ces tests valident chaque table servie avec des parties du robot de 2 minutes (leur durée d'avant la boucle : ≈ 4 s par table) ; les seuils de 6 minutes (≈ 13 s par table) sont éprouvés par `seuils.test.ts`, le golden et la validation des 500 tables. */
const DUREE = 120 * TICKS_PAR_SECONDE;

export function valider30Jours(du: number, n: number): void {
  describe(`les jours ${du + 1} à ${du + n} de la période de 30 jours : chaque table servie est validée et a ses seuils`, () => {
    for (let i = 0; i < n; i++) {
      const jour = PREMIER_JOUR + du + i;
      it(`${formatDay(jour)}`, () => {
        const c = dailyPinball(jour);
        expect(TABLES_REFUSEES, "une table refusée n'est jamais servie").not.toContain(cleDeTable(c));
        const cle = cleDeTable(c);
        const a = vues.get(cle) ?? analyserTable(c, undefined, DUREE);
        vues.set(cle, a);
        // lot PBG3 : « la porte s'ouvre d'elle-même et est franchie » se juge sur les parties de six minutes (la validation des 500 tables, `test/validation-porte.test.ts`) : en deux minutes le robot n'a pas toujours fait tomber la banque ou mené l'orbite
        const raisons = a.raisons!.filter((r) => !r.startsWith("porte jamais"));
        expect(raisons, `${formatDay(jour)} (${c.theme}) : ${raisons.join(" ; ")}`).toEqual([]);
        expect(a.billes!.coincee).toBeNull();
        expect(a.manquants).toEqual([]);
        expect(a.mission).toBe(true);
        expect(seuilsValides(a.seuils)).toBe(true);
      });
    }
  });
}
