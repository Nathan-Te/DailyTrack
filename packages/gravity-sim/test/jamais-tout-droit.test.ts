import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import {
  CASE,
  CLIGNOTANT,
  ALTERNE_A,
  ALTERNE_B,
  CLIGNOTANT_ALLUME,
  CLIGNOTANT_CYCLE,
  CLIGNOTANT_AVERTISSEMENT,
  LARGEUR_MORCEAU,
  LIGNES,
  META,
  MORCEAUX_PAR_BOUCLE,
  MORCEAUX_PAR_THEME,
  dailyGravity,
  estUnSouffle,
  mesurerLeJour,
  nomDuMotif,
  partieALEntree,
  partPassive,
  planDuJour,
  reglesDuContenu,
  solide,
  survitSansRien,
  terrainDuJour,
  type Morceau,
} from "../src/index";
import { jouerScenario } from "../src/labo";

// Lot GR7 — **« jamais tout droit »** (seed) : aucun passage en rythme (blocs de la Nuit et du Néon, scies, lasers, sols fragiles…) ne se franchit sans rien faire. Un joueur qui ne touche à rien depuis l'entrée du morceau
// **meurt dans le morceau**, et le robot le passe (`franchissabilite*.test.ts`, le laboratoire). Et la part des morceaux qui se passent sans rien faire, hors des passages pour souffler, reste sous 20 % après le 1er thème.
const JOUR = daysFromCivil(2026, 11, 17);
/** Les motifs « en rythme » : un élément qui bouge, s'allume ou tombe. Aucun ne se passe sans rien faire. */
const EN_RYTHME = (nom: string): boolean => /^(special-nuit|special-neon|scie|sciesAlternees|piquesScies|laser|fragile)/.test(nom) || nom.includes("+");

describe("jamais tout droit : un joueur qui ne fait rien, depuis l'entrée du morceau, meurt dans les morceaux en rythme", () => {
  it("sur 12 jours et deux tours, chaque morceau en rythme tue le joueur passif (les sections à mode : de leur entrée à leur fin)", () => {
    let vus = 0;
    const survivants: string[] = [];
    for (let i = 0; i < 12; i++) {
      const contenu = dailyGravity(JOUR + i);
      const terrain = terrainDuJour(contenu);
      const plan = planDuJour(contenu.jour, reglesDuContenu(contenu), contenu.ordre);
      for (let m = 3; m < 2 * MORCEAUX_PAR_BOUCLE; m++) {
        const mo = terrain.morceau(m);
        const nom = nomDuMotif(mo);
        if (mo.suiteDeSection || !EN_RYTHME(nom)) continue;
        vus++;
        let fin = m;
        while (terrain.morceau(fin + 1).suiteDeSection === true) fin++;
        if (survitSansRien(partieALEntree(terrain, plan, m), fin)) survivants.push(`jour ${i} morceau ${m} ${nom}`);
      }
    }
    expect(vus).toBeGreaterThan(150);
    expect(survivants, `traversés sans rien faire : ${survivants.slice(0, 12).join(" ; ")}`).toEqual([]);
  });

  it("la Nuit : les blocs s'éteignent PENDANT qu'on est dessus, après leur mise en garde ; le chemin sûr quitte le sol à temps", () => {
    let vus = 0;
    for (let i = 0; i < 40 && vus < 12; i++) {
      const contenu = dailyGravity(JOUR + i);
      const terrain = terrainDuJour(contenu);
      for (let m = 3; m < 2 * MORCEAUX_PAR_BOUCLE; m++) {
        const mo = terrain.morceau(m);
        if (nomDuMotif(mo) !== "special-nuit") continue;
        vus++;
        // Les colonnes qui clignotent (la rangée 10 ou 1 selon le miroir).
        const colonnes: number[] = [];
        for (let c = 0; c < LARGEUR_MORCEAU; c++) for (let r = 0; r < LIGNES; r++) if (mo.cases[c * LIGNES + r] === CLIGNOTANT) colonnes.push(c);
        const a = Math.min(...colonnes);
        const b = Math.max(...colonnes);
        const x0 = m * LARGEUR_MORCEAU * CASE;
        const tr = planDuJour(contenu.jour, reglesDuContenu(contenu), contenu.ordre).trajectoire;
        const entre = tr.tickOuLeJoueurArrive(x0 + a * CASE);
        const sort = tr.tickOuLeJoueurArrive(x0 + (b + 1) * CASE);
        const milieu = tr.tickOuLeJoueurArrive(x0 + Math.trunc((a + b + 1) / 2) * CASE);
        // Allumé quand on arrive sur les blocs (on peut s'y poser), éteint avant qu'on en soit parti (on n'y reste pas), avec la mise en garde (le clignotement) juste avant.
        expect(solide(CLIGNOTANT, entre, mo.decalage), `jour ${i}, morceau ${m} : allumé à l'arrivée`).toBe(true);
        expect(solide(CLIGNOTANT, sort - 1, mo.decalage), `jour ${i}, morceau ${m} : éteint avant la sortie des blocs`).toBe(false);
        const phase = (milieu + mo.decalage) % CLIGNOTANT_CYCLE;
        expect(phase, `jour ${i}, morceau ${m} : il s'éteint au milieu des blocs`).toBeGreaterThanOrEqual(CLIGNOTANT_ALLUME - 2);
        expect(phase).toBeLessThanOrEqual(CLIGNOTANT_ALLUME + 2);
        expect(CLIGNOTANT_AVERTISSEMENT).toBeGreaterThan(0);
      }
    }
    expect(vus).toBeGreaterThanOrEqual(6);
  });

  it("le Néon : la couleur sur laquelle on arrive s'éteint pendant qu'on est dessus, la seconde s'allume au même instant", () => {
    let vus = 0;
    for (let i = 0; i < 40 && vus < 8; i++) {
      const contenu = dailyGravity(JOUR + i);
      const terrain = terrainDuJour(contenu);
      const tr = planDuJour(contenu.jour, reglesDuContenu(contenu), contenu.ordre).trajectoire;
      for (let m = 3; m < 2 * MORCEAUX_PAR_BOUCLE; m++) {
        const mo = terrain.morceau(m);
        if (nomDuMotif(mo) !== "special-neon") continue;
        vus++;
        const colonnes = (type: number): number[] => {
          const l: number[] = [];
          for (let c = 0; c < LARGEUR_MORCEAU; c++) for (let r = 0; r < LIGNES; r++) if (mo.cases[c * LIGNES + r] === type) l.push(c);
          return l;
        };
        const a = colonnes(ALTERNE_A);
        const x0 = m * LARGEUR_MORCEAU * CASE;
        const entre = tr.tickOuLeJoueurArrive(x0 + Math.min(...a) * CASE);
        const sort = tr.tickOuLeJoueurArrive(x0 + (Math.max(...a) + 1) * CASE);
        expect(solide(ALTERNE_A, entre, mo.decalage), `jour ${i}, morceau ${m} : la première couleur est solide à l'arrivée`).toBe(true);
        expect(solide(ALTERNE_A, sort, mo.decalage), `jour ${i}, morceau ${m} : elle est éteinte avant la sortie`).toBe(false);
        expect(solide(ALTERNE_B, sort, mo.decalage)).toBe(true);
      }
    }
    expect(vus).toBeGreaterThanOrEqual(4);
  });

  it("la part des morceaux passifs, hors passages pour souffler, reste sous 20 % après le 1er thème (10 jours, deux tours)", () => {
    let passifs = 0;
    let total = 0;
    for (let i = 0; i < 10; i++) {
      const mes = mesurerLeJour(dailyGravity(JOUR + i), 2 * MORCEAUX_PAR_BOUCLE * 16, false);
      const comptes = mes.morceaux.filter((x) => x.m >= MORCEAUX_PAR_THEME && !x.souffle && !x.suite);
      total += comptes.length;
      passifs += comptes.filter((x) => x.passif).length;
      expect(partPassive(mes.morceaux, MORCEAUX_PAR_THEME), `jour ${i}`).toBeLessThan(0.2);
    }
    expect(total).toBeGreaterThan(500);
    expect(passifs / total).toBeLessThan(0.2);
  });

  it("le laboratoire : chaque motif posé du côté d'où l'on arrive tue le joueur passif et laisse passer le robot (un échantillon : deux vitesses)", () => {
    const ids = [...META.keys()].filter((id) => EN_RYTHME(id) || ["trou", "pilier", "pics", "zigzag", "ilots", "couloirPiques", "slalom"].includes(id));
    let n = 0;
    for (const id of ids) {
      for (const vitesse of [10, 14]) {
        for (const entree of [1, -1] as const) {
          const r = jouerScenario({ id, variante: 0, entree, vitesse });
          n++;
          expect(r.robot, `${id} (${entree === 1 ? "du sol" : "du plafond"}, ${vitesse} cases/s) : ${r.detail}`).toBe(true);
          expect(r.passif, `${id} (${entree === 1 ? "du sol" : "du plafond"}, ${vitesse} cases/s) se passe sans rien faire`).toBe(false);
        }
      }
    }
    expect(n).toBeGreaterThan(80);
  });
});
void estUnSouffle;
void (null as unknown as Morceau);
