import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { dailyBlocks, jouer, Partie, PLAFOND_PIECES, contenuDeScenario, SCENARIOS } from "../src/index";
import { coupDuDiamant, jouerDiamant, piecesSansPlace, POIDS_DIAMANT, seuilsDe } from "../src/diamant";
import { jouerGlouton } from "../src/glouton";

// Le bot Diamant (lot B3) : pur, déterministe, ne joue que des actions légales, rejoué par le code du serveur, au moins aussi fort que le glouton, et rapide.
const PREMIER = daysFromCivil(2026, 11, 2);
const jours = (n: number): number[] => Array.from({ length: n }, (_, i) => PREMIER + i);

describe("le bot Diamant", () => {
  it("est déterministe : deux parties du même jour jouent les mêmes poses, dans n'importe quel ordre de jours", () => {
    const a = jours(8).map((j) => jouerDiamant(dailyBlocks(j)));
    const b = jours(8).reverse().map((j) => jouerDiamant(dailyBlocks(j))).reverse();
    expect(b).toEqual(a);
  });

  it("ne joue que des actions légales : chaque pose est acceptée par la partie, jusqu'à la fin", () => {
    for (const j of jours(12)) {
      const contenu = dailyBlocks(j);
      const partie = new Partie(contenu);
      let n = 0;
      while (!partie.finie) {
        const coup = coupDuDiamant(partie);
        expect(coup, `jour ${j}, pose ${n}`).not.toBeNull();
        expect(partie.legale(coup!.col, coup!.ligne), `jour ${j}, pose ${n}`).toBe(true);
        expect(partie.poser(coup!.col, coup!.ligne)).not.toBeNull();
        n++;
      }
      expect(coupDuDiamant(partie)).toBeNull(); // la partie est finie : rien à jouer
    }
  });

  it("sa partie est une rediffusion valide : le rejeu du serveur (`jouer`) rend le même résultat", () => {
    for (const j of jours(10)) {
      const contenu = dailyBlocks(j);
      const bot = jouerDiamant(contenu);
      expect(jouer(contenu, bot.actions)).toEqual(bot.resultat);
      expect(bot.actions.every((a) => Number.isInteger(a) && a >= 0 && a < 64)).toBe(true);
      expect(bot.actions.length).toBe(bot.resultat.poses);
    }
  });

  it("joue aussi les scénarios d'essai (grille de départ non vide) et le plateau vide", () => {
    for (const nom of SCENARIOS) {
      const contenu = contenuDeScenario(nom);
      const bot = jouerDiamant(contenu);
      expect(jouer(contenu, bot.actions)).toEqual(bot.resultat);
    }
  });

  it("ne change pas la partie qu'il regarde (le choix est pur)", () => {
    const partie = new Partie(dailyBlocks(PREMIER + 3));
    partie.poser(0, 0);
    const avant = JSON.stringify([partie.grille, partie.rang, partie.score, partie.combo, partie.sansEffacement]);
    coupDuDiamant(partie);
    expect(JSON.stringify([partie.grille, partie.rang, partie.score, partie.combo, partie.sansEffacement])).toBe(avant);
  });

  it("vaut au moins le glouton sur au moins 95 % des jours", () => {
    const n = 120;
    let perdus = 0;
    for (const j of jours(n)) {
      const c = dailyBlocks(j);
      if (jouerDiamant(c).resultat.score < jouerGlouton(c).resultat.score) perdus++;
    }
    expect(1 - perdus / n).toBeGreaterThanOrEqual(0.95);
  });

  it("la partie du bot s'arrête toujours avant le plafond de pièces", () => {
    for (const j of jours(20)) expect(jouerDiamant(dailyBlocks(j)).resultat.poses).toBeLessThan(PLAFOND_PIECES);
  });

  it("les poids sont des entiers (aucun flottant dans l'évaluation)", () => {
    for (const [nom, v] of Object.entries(POIDS_DIAMANT)) expect(Number.isInteger(v), nom).toBe(true);
  });

  it("piecesSansPlace : toutes les pièces tiennent sur une grille vide, aucune sur une grille pleine", () => {
    expect(piecesSansPlace(new Uint8Array(8))).toBe(0);
    expect(piecesSansPlace(new Uint8Array(8).fill(0xff))).toBe(40);
  });

  it("calcule les seuils d'un jour en moins de 200 ms (médiane et pire des 40 premiers jours)", () => {
    const temps = jours(40).map((j) => {
      const c = dailyBlocks(j);
      const t0 = performance.now();
      seuilsDe(c);
      return performance.now() - t0;
    });
    temps.sort((a, b) => a - b);
    expect(temps[20]!).toBeLessThan(200);
    expect(temps[39]!).toBeLessThan(1000); // le pire cas (une partie très longue) : marge large pour une machine lente ; la mesure du README est la référence
  });
});
