import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { actionDe, contenuDeScenario, dailyBlocks, emplacementDe, jouer, Partie, PLAFOND_PIECES, SCENARIOS, TAILLE_SERIE } from "../src/index";
import { coupDuDiamant, jouerDiamant, LARGEUR_FAISCEAU, piecesSansPlace, planDuDiamant, POIDS_DIAMANT, seuilsDe } from "../src/diamant";
import { jouerGlouton } from "../src/glouton";

// Le bot Diamant (lots B3 et B8) : une recherche en faisceau série par série. Pur, déterministe, ne joue que des actions légales, rejoué par le code du serveur, plus fort que le bot moyen, et rapide.
const PREMIER = daysFromCivil(2026, 11, 2);
const jours = (n: number): number[] => Array.from({ length: n }, (_, i) => PREMIER + i);

describe("le bot Diamant (recherche en faisceau)", () => {
  it("est déterministe : deux parties du même jour jouent les mêmes poses, dans n'importe quel ordre de jours", () => {
    const a = jours(6).map((j) => jouerDiamant(dailyBlocks(j)));
    const b = jours(6).reverse().map((j) => jouerDiamant(dailyBlocks(j))).reverse();
    expect(b).toEqual(a);
  });

  it("ne joue que des actions légales : chaque pose est acceptée par la partie, jusqu'à la fin", () => {
    for (const j of jours(8)) {
      const partie = new Partie(dailyBlocks(j));
      let n = 0;
      while (!partie.finie) {
        const coup = coupDuDiamant(partie);
        expect(coup, `jour ${j}, pose ${n}`).not.toBeNull();
        expect(partie.legale(coup!.emplacement, coup!.col, coup!.ligne), `jour ${j}, pose ${n}`).toBe(true);
        expect(partie.poser(coup!.emplacement, coup!.col, coup!.ligne)).not.toBeNull();
        n++;
      }
      expect(coupDuDiamant(partie)).toBeNull(); // la partie est finie : rien à jouer
    }
  });

  it("sa partie est une rediffusion valide : le rejeu du serveur (`jouer`) rend le même résultat, une action par pose, de 0 à 191", () => {
    for (const j of jours(8)) {
      const contenu = dailyBlocks(j);
      const bot = jouerDiamant(contenu);
      expect(jouer(contenu, bot.actions)).toEqual(bot.resultat);
      expect(bot.actions.every((a) => Number.isInteger(a) && a >= 0 && a < 192)).toBe(true);
      expect(bot.actions.length).toBe(bot.resultat.poses);
    }
  });

  it("joue aussi les scénarios d'essai (grille de départ non vide, pièces grisées au départ)", () => {
    for (const nom of SCENARIOS) {
      const contenu = contenuDeScenario(nom);
      const bot = jouerDiamant(contenu);
      expect(jouer(contenu, bot.actions)).toEqual(bot.resultat);
    }
  });

  it("CHERCHE L'ORDRE : dans le scénario « ordre », il joue le seul ordre qui s'en sort (le carré, le domino, le coin) et efface deux lignes", () => {
    const contenu = contenuDeScenario("ordre");
    const plan = planDuDiamant(new Partie(contenu));
    expect(plan.map(emplacementDe)).toEqual([2, 1, 0]);
    const partie = new Partie(contenu);
    const poses = plan.map((a) => partie.jouerAction(a)!);
    expect(poses.every((p) => p !== null)).toBe(true);
    expect(poses.reduce((n, p) => n + p.n, 0)).toBe(2);
    expect(partie.serie).toBe(1); // la série suivante est arrivée : il ne s'est pas bloqué
  });

  it("le plan couvre toutes les pièces restantes d'une série entamée", () => {
    const partie = new Partie(dailyBlocks(PREMIER + 2));
    expect(planDuDiamant(partie)).toHaveLength(TAILLE_SERIE);
    const coup = coupDuDiamant(partie)!;
    partie.poser(coup.emplacement, coup.col, coup.ligne);
    expect(planDuDiamant(partie)).toHaveLength(TAILLE_SERIE - 1);
  });

  it("ne change pas la partie qu'il regarde (le choix est pur)", () => {
    const partie = new Partie(dailyBlocks(PREMIER + 3));
    partie.poser(0, 0, 0);
    const photo = (): string => JSON.stringify([partie.grille, partie.serie, partie.poses, partie.score, partie.combo, partie.sansEffacement, partie.pieces.map((p) => p?.id ?? null)]);
    const avant = photo();
    coupDuDiamant(partie);
    planDuDiamant(partie);
    expect(photo()).toBe(avant);
  });

  it("la largeur du faisceau est réglable : K = 1 à 24 jouent des parties valides, et le faisceau par défaut est celui du jeu", () => {
    expect(LARGEUR_FAISCEAU).toBeGreaterThanOrEqual(1);
    const c = dailyBlocks(PREMIER + 5);
    for (const k of [1, 4, LARGEUR_FAISCEAU, 24]) {
      const bot = jouerDiamant(c, k);
      expect(jouer(c, bot.actions)).toEqual(bot.resultat);
    }
    expect(jouerDiamant(c)).toEqual(jouerDiamant(c, LARGEUR_FAISCEAU));
  }, 60000);

  it("vaut plus que le bot moyen sur au moins 85 % de 40 jours (il meurt parfois tôt d'un hasard de la suite : ~10 % des jours, README du lot B8)", () => {
    const n = 40;
    let perdus = 0;
    for (const j of jours(n)) {
      const c = dailyBlocks(j);
      if (jouerDiamant(c).resultat.score < jouerGlouton(c).resultat.score) perdus++;
    }
    expect(1 - perdus / n).toBeGreaterThanOrEqual(0.85);
  }, 60000);

  it("la partie du bot s'arrête presque toujours avant le plafond de pièces (au plus 2 jours sur 40)", () => {
    let plafond = 0;
    for (const j of jours(40)) if (jouerDiamant(dailyBlocks(j)).resultat.poses >= PLAFOND_PIECES) plafond++;
    expect(plafond).toBeLessThanOrEqual(2);
  }, 60000);

  it("les poids sont des entiers (aucun flottant dans l'évaluation)", () => {
    for (const [nom, v] of Object.entries(POIDS_DIAMANT)) expect(Number.isInteger(v), nom).toBe(true);
  });

  it("piecesSansPlace : toutes les pièces tiennent sur une grille vide, aucune sur une grille pleine", () => {
    expect(piecesSansPlace(new Uint8Array(8))).toBe(0);
    expect(piecesSansPlace(new Uint8Array(8).fill(0xff))).toBe(40);
  });

  it("calcule les seuils d'un jour vite : médiane de 40 jours sous 2 s ici (les tests de tous les paquets tournent en parallèle sur quelques cœurs : la mesure de référence, seule, est dans le README du lot B8 — 53 ms en médiane, 152 ms au pire sur 1 000 jours, sous les 200 ms demandés)", () => {
    const temps = jours(40).map((j) => {
      const c = dailyBlocks(j);
      const t0 = performance.now();
      seuilsDe(c);
      return performance.now() - t0;
    });
    temps.sort((a, b) => a - b);
    expect(temps[20]!).toBeLessThan(2000); // l'ordre de grandeur seulement (la CI est partagée et lente : 425 ms mesurés pour 53 seuls) ; la barre des 200 ms est celle de `calibrer:medailles`
    expect(temps[39]!).toBeLessThan(6000); // le pire cas (une partie très longue) sur une machine chargée
  }, 60000);

  it("actionDe(2, 7, 7) est la dernière action possible", () => {
    expect(actionDe(2, 7, 7)).toBe(191);
  });
});
