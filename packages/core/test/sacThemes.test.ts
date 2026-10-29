import { describe, expect, it } from "vitest";
import { Rng, mixSeed, ordreDuCycle, themeDuSac, themeDuSacBrut, type ReglesSac } from "../src/index";

// Lot V1 : le sac de thèmes commun aux deux jeux. Les propriétés se vérifient pour n = 5 (Jump) et n = 8 (Track), sur 365 jours, pour toutes les graines essayées
// et pour **chaque position possible du premier jour du sac** (la bascule tombe n'importe quand), l'ancienne règle étant ici un tirage quelconque (jamais deux
// fois le même thème de suite n'est pas garanti avant le sac : on le force à se tromper au pire).

const NOMBRES = [5, 8];
const SELS = [0x74686d39, 0x70a1, 1, 987654321];
const DEPART = 20_000;

/** Une ancienne règle quelconque : un tirage par jour, avec des répétitions possibles (le pire cas pour la jonction). */
const ancienne = (n: number, sel: number) => (jour: number) => new Rng(mixSeed(jour, sel ^ 0xabc)).int(n);

/** Les règles d'un jeu dont le sac commence au jour `bascule` (les jours d'avant sont à l'ancienne règle). */
const regles = (n: number, sel: number, bascule: number): ReglesSac => ({ n, sel, ancien: ancienne(n, sel), estAncien: (j) => j < bascule });

const suite = (r: ReglesSac, depuis: number, jours: number): number[] => Array.from({ length: jours }, (_, i) => themeDuSac(depuis + i, r));

/** Écart maximal entre deux apparitions consécutives d'un même thème dans la suite. */
function ecartMax(s: readonly number[], n: number): number {
  let max = 0;
  for (let t = 0; t < n; t++) {
    let dernier = -1;
    s.forEach((x, i) => {
      if (x !== t) return;
      if (dernier >= 0) max = Math.max(max, i - dernier);
      dernier = i;
    });
  }
  return max;
}

const repetitions = (s: readonly number[]): number => s.filter((x, i) => i > 0 && x === s[i - 1]).length;
const alternances = (s: readonly number[]): number => s.filter((x, i) => i > 1 && x === s[i - 2]).length;

describe("le sac de thèmes (lot V1)", () => {
  for (const n of NOMBRES) {
    describe(`${n} thèmes`, () => {
      it("chaque cycle de n jours est une permutation des thèmes (chacun une fois)", () => {
        for (const sel of SELS) {
          for (let k = -3; k < 400; k++) {
            const ordre = ordreDuCycle(k, n, sel);
            expect([...ordre].sort((a, b) => a - b), `cycle ${k}`).toEqual(Array.from({ length: n }, (_, i) => i));
          }
        }
      });

      it("365 jours : 0 répétition d'un jour à l'autre, 0 alternance A B A, aucun thème ne tarde plus de 2n − 1 jours", () => {
        for (const sel of SELS) {
          const s = Array.from({ length: 365 }, (_, i) => themeDuSacBrut(DEPART + i, n, sel));
          expect(repetitions(s), `sel ${sel}`).toBe(0);
          expect(alternances(s), `sel ${sel}`).toBe(0);
          expect(ecartMax(s, n), `sel ${sel}`).toBeLessThanOrEqual(2 * n - 1);
          expect(new Set(s).size).toBe(n);
        }
      });

      it("la jonction de deux cycles : le dernier du cycle d'avant ne revient pas avant le 3ᵉ jour, l'avant-dernier pas le 1ᵉʳ ; les deux dernières places sont celles du tirage", () => {
        for (const sel of SELS) {
          for (let k = -50; k < 2_000; k++) {
            const avant = ordreDuCycle(k - 1, n, sel);
            const apres = ordreDuCycle(k, n, sel);
            expect(apres.indexOf(avant[n - 1]!), `cycle ${k}`).toBeGreaterThanOrEqual(2);
            expect(apres[0]).not.toBe(avant[n - 2]);
            expect(apres.slice(n - 2)).toEqual(new Rng(mixSeed(k, sel)).shuffle(Array.from({ length: n }, (_, i) => i)).slice(n - 2));
          }
        }
      });

      it("la jonction avec un jour figé : à chaque position possible du premier jour du sac, ni répétition ni A B A, et le calcul d'un jour ne dépend pas de ce qui suit", () => {
        for (const sel of SELS) {
          for (let decalage = 0; decalage < 3 * n; decalage++) {
            for (let essai = 0; essai < 12; essai++) {
              const bascule = DEPART + decalage + essai * 7 * n;
              const r = regles(n, sel, bascule);
              // La veille et l'avant-veille (anciennes) puis 365 jours du sac.
              const s = suite(r, bascule - 2, 367);
              expect(s[0]).toBe(r.ancien(bascule - 2));
              expect(s[1]).toBe(r.ancien(bascule - 1));
              const dessous = s.slice(1);
              expect(dessous[1], `bascule ${bascule} : le premier jour du sac répète la veille`).not.toBe(dessous[0]);
              expect(s[2], `bascule ${bascule} : A B A`).not.toBe(s[0]);
              expect(s[3], `bascule ${bascule} : le deuxième jour répète le premier`).not.toBe(s[2]);
              expect(s[3], `bascule ${bascule} : A B A au deuxième jour`).not.toBe(s[1]);
              const sac = s.slice(2);
              expect(repetitions(sac), `bascule ${bascule}`).toBe(0);
              expect(alternances(sac), `bascule ${bascule}`).toBe(0);
              expect(ecartMax(sac, n), `bascule ${bascule}`).toBeLessThanOrEqual(2 * n - 1);
              // Hors des deux premiers jours, le sac est celui du tirage seul.
              for (let i = 2; i < sac.length; i++) expect(sac[i]).toBe(themeDuSacBrut(bascule + i, n, sel));
            }
          }
        }
      });

      it("est direct et déterministe : un jour se calcule seul, dans n'importe quel ordre", () => {
        const r = regles(n, SELS[0]!, DEPART + 3);
        const suivie = suite(r, DEPART, 200);
        const melange = new Rng(7).shuffle(Array.from({ length: 200 }, (_, i) => i));
        for (const i of melange) expect(themeDuSac(DEPART + i, r)).toBe(suivie[i]);
      });
    });
  }

  it("un jour déjà servi garde son ancien thème, quoi que dise le sac", () => {
    const r = regles(5, SELS[0]!, DEPART);
    for (let j = DEPART - 100; j < DEPART; j++) expect(themeDuSac(j, r)).toBe(r.ancien(j));
  });
});
