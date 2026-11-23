import { describe, expect, it } from "vitest";
import { EV_JACKPOT, EV_MISSION, EV_MULTI, EV_MULTI_FIN, EV_NIVEAU, EV_PERDUE, EV_SAUVEE, EV_TROU, EV_VERROU_ALLUME, EV_VERROUILLEE, PINBALL_GENERATOR_VERSION, PERDUE_Y, UNITE, Partie, REGLAGES, copierReglages, dailyPinball, type Reglages, type ThemePinball } from "../src/index";
import { JOUR_ESSAI, avancer, enJeu } from "./aide";

// LE VERROU ET LA MULTIBILLE (lot PBG2) : la mission réussie allume le verrou (le trou du plan) ; une bille qui y entre y reste et une nouvelle arrive au lanceur sans coûter de bille ; la deuxième lance la multibille
// (trois billes en jeu, les deux verrouillées lâchées l'une après l'autre, quelques secondes de bille sauvée) ; une bille perdue pendant la multibille ne coûte rien ; elle finit à une seule bille et la mission revient au niveau suivant.

const partie = (theme: ThemePinball = "ocean", plan = "B", r: Reglages = REGLAGES): Partie => new Partie(dailyPinball(JOUR_ESSAI, PINBALL_GENERATOR_VERSION, theme, plan), r);
/** Le centre du trou du verrou, en pixels. */
const trou = (p: Partie): { x: number; y: number } => {
  const t = p.table.trous[p.table.verrou]!;
  return { x: t.x / UNITE, y: t.y / UNITE };
};
/** Pose la bille principale dans le trou du verrou, lentement : le pas suivant la prend. */
const dansLeTrou = (p: Partie): Partie => {
  const { x, y } = trou(p);
  p.captif = 0;
  p.captifTb = -1;
  p.captifDe = -1;
  p.trouPause.fill(0);
  return enJeu(p, x, y, 0, 10);
};
/** Une partie dont la mission est réussie et le verrou allumé (comme la mission le fait). */
const verrouAllume = (theme: ThemePinball = "ocean", plan = "B", r: Reglages = REGLAGES): Partie => {
  const p = partie(theme, plan, r);
  p.compteur = p.but - 1;
  // le centre du tourbillon : la bille y est gardée, c'est la plongée qui compte
  if (p.table.tourbillons.length > 0) {
    const z = p.table.tourbillons[0]!;
    enJeu(p, z.x / UNITE, z.y / UNITE, 0, 0);
    p.avancer();
    p.captif = 0; // la plongée garde la bille 0,9 s : on la rend
    p.captifTb = -1;
  } else throw new Error("ce thème n'a pas de tourbillon");
  return p;
};
const lancerMulti = (r: Reglages = REGLAGES): Partie => {
  const p = verrouAllume("ocean", "B", r);
  for (let i = 0; i < 2; i++) {
    dansLeTrou(p);
    p.avancer();
  }
  return p;
};

describe("le verrou", () => {
  it("chaque plan du jour a un verrou : le trou du deuxième emplacement ; le plan d'essai n'en a pas", () => {
    for (const plan of ["A", "B", "C"]) for (const theme of ["foire", "ocean", "espace", "volcan"] as const) expect(partie(theme, plan).table.verrou, `${theme}:${plan}`).toBeGreaterThanOrEqual(0);
    expect(new Partie(dailyPinball(JOUR_ESSAI, PINBALL_GENERATOR_VERSION, "foire", "classique")).table.verrou).toBe(-1);
  });

  it("la mission réussie allume le verrou : la récompense, le cran du multiplicateur, l'événement", () => {
    const p = partie();
    expect(p.verrouAllume).toBe(false);
    p.compteur = p.but - 1;
    const z = p.table.tourbillons[0]!;
    enJeu(p, z.x / UNITE, z.y / UNITE);
    p.avancer();
    expect(p.missionFaite).toBe(true);
    expect(p.verrouAllume).toBe(true);
    expect(p.ev & EV_MISSION).toBeTruthy();
    expect(p.ev & EV_VERROU_ALLUME).toBeTruthy();
    expect(p.mult).toBe(2);
    expect(p.score).toBeGreaterThanOrEqual(10000);
  });

  it("verrou éteint, le trou se comporte comme avant : il garde la bille 0,9 s, 1 500 points, puis la relance ; rien n'est verrouillé", () => {
    const p = partie();
    dansLeTrou(p);
    p.avancer();
    expect(p.ev & EV_TROU).toBeTruthy();
    expect(p.ev & EV_VERROUILLEE).toBe(0);
    expect(p.captif).toBeGreaterThan(0);
    expect(p.score).toBe(1500);
    expect(p.verrouillees).toBe(0);
    expect(p.billes).toBe(3);
    avancer(p, REGLAGES.trouGarde + 2);
    expect(p.captif).toBe(0);
    expect(p.dansLanceur).toBe(false);
  });

  it("verrou allumé : la bille y reste, une nouvelle bille arrive au lanceur, sans coûter de bille", () => {
    const p = verrouAllume();
    const avant = p.score;
    dansLeTrou(p);
    p.avancer();
    expect(p.ev & EV_VERROUILLEE).toBeTruthy();
    expect(p.verrouillees).toBe(1);
    expect(p.billes).toBe(3);
    expect(p.dansLanceur).toBe(true);
    expect(p.charge).toBe(0);
    expect(p.score - avant).toBe(REGLAGES.verrouPoints * p.mult);
    expect(p.verrouAllume).toBe(true); // il reste allumé tant que la deuxième bille n'y est pas
    expect(p.multibille).toBe(false);
    expect(p.surLaTable).toBe(1);
    expect(p.captif).toBe(0); // verrouillée, pas captive : le trou ne la rend pas
    avancer(p, 2000);
    expect(p.verrouillees).toBe(1);
    expect(p.autres.length).toBe(0);
  });

  it("le verrou allumé survit à une bille perdue (et coûte alors une bille, comme toujours)", () => {
    const p = verrouAllume();
    enJeu(p, 184, PERDUE_Y + 5, 0, 100);
    p.sauvee = true; // pas de bille sauvée
    p.avancer();
    expect(p.billes).toBe(2);
    expect(p.verrouAllume).toBe(true);
  });

  it("la partie finit à la dernière bille perdue même avec une bille verrouillée", () => {
    const p = verrouAllume();
    dansLeTrou(p);
    p.avancer();
    p.billes = 1;
    enJeu(p, 184, PERDUE_Y + 5, 0, 100);
    p.sauvee = true;
    p.avancer();
    expect(p.finie).toBe(true);
  });
});

describe("la multibille", () => {
  it("départ : la deuxième bille verrouillée lance la multibille — trois billes en jeu, rien n'est perdu", () => {
    const p = lancerMulti();
    expect(p.multibille).toBe(true);
    expect(p.multibilles).toBe(1);
    expect(p.ev & EV_MULTI).toBeTruthy();
    expect(p.verrouAllume).toBe(false);
    expect(p.billes).toBe(3);
    expect(p.aLacher).toBe(2);
    expect(p.surLaTable).toBe(3);
    expect(p.dansLanceur).toBe(true); // la bille en jeu attend au lanceur
    expect(p.sauveeMulti).toBe(REGLAGES.multibilleSauvee - 1); // le pas du verrou compte déjà
  });

  // lot PBL1 : le lanceur part tout seul pendant la multibille ; ces deux tests suivent les billes lâchées par le trou, la bille du lanceur y attend : sa charge est ralentie à l'extrême (`lanceurCharge` 1 : jamais pleine), `test/lanceur-auto.test.ts` garde le départ automatique
  const SANS_AUTO = (): Reglages => ({ ...copierReglages(), lanceurCharge: 1 });
  it("les deux billes verrouillées sont lâchées l'une après l'autre ; la bille du lanceur reste", () => {
    const p = lancerMulti(SANS_AUTO());
    const idLanceur = p.id;
    const nb: number[] = [];
    for (let i = 0; i < REGLAGES.multibilleDepart + REGLAGES.multibilleLacher + 10; i++) {
      p.avancer();
      nb.push(p.autres.length);
    }
    const premier = nb.indexOf(1);
    const deuxieme = nb.indexOf(2);
    expect(premier).toBe(REGLAGES.multibilleDepart - 2); // le pas du verrou compte déjà
    expect(deuxieme - premier).toBe(REGLAGES.multibilleLacher);
    expect(p.verrouillees).toBe(0);
    expect(p.aLacher).toBe(0);
    expect(p.id).toBe(idLanceur);
    expect(p.dansLanceur).toBe(true);
    expect(p.surLaTable).toBe(3);
    expect(new Set([p.id, ...p.autres.map((b) => b.id)]).size).toBe(3);
    // les billes lâchées partent du trou vers le bas, à la vitesse de sortie du trou
    expect(p.autres.every((b) => b.vy !== 0 || b.vx !== 0)).toBe(true);
  });

  it("bille sauvée au départ : une bille perdue pendant `multibilleSauvee` revient par le trou, sans rien coûter", () => {
    const p = lancerMulti();
    avancer(p, REGLAGES.multibilleDepart + REGLAGES.multibilleLacher + 10);
    expect(p.autres.length).toBe(2);
    const b = p.autres[0]!;
    b.x = 184 * UNITE;
    b.y = (PERDUE_Y + 5) * UNITE;
    b.vy = 100 * UNITE;
    p.avancer();
    expect(p.ev & EV_SAUVEE).toBeTruthy();
    expect(p.autres.length).toBe(1);
    expect(p.aLacher).toBe(1);
    expect(p.surLaTable).toBe(3);
    expect(p.billes).toBe(3);
    expect(p.perduesMulti).toBe(0);
    avancer(p, REGLAGES.multibilleRelance + 5);
    expect(p.autres.length).toBe(2);
    expect(p.aLacher).toBe(0);
    expect(p.multibille).toBe(true);
  });

  it("bille perdue après le délai : elle ne coûte pas de bille de la partie ; la multibille s'arrête quand il n'en reste qu'une, la mission revient au niveau suivant", () => {
    const p = lancerMulti(SANS_AUTO());
    const but = p.but;
    avancer(p, REGLAGES.multibilleDepart + REGLAGES.multibilleLacher + 10);
    p.sauveeMulti = 0;
    // la première bille lâchée est perdue : il reste deux billes, la multibille continue
    p.autres[0]!.y = (PERDUE_Y + 5) * UNITE;
    p.autres[0]!.vy = 100 * UNITE;
    p.avancer();
    expect(p.ev & EV_PERDUE).toBeTruthy();
    expect(p.billes).toBe(3);
    expect(p.perduesMulti).toBe(1);
    expect(p.multibille).toBe(true);
    expect(p.surLaTable).toBe(2);
    // la deuxième aussi : il ne reste que celle du lanceur, la multibille s'arrête
    p.autres[0]!.y = (PERDUE_Y + 5) * UNITE;
    p.autres[0]!.vy = 100 * UNITE;
    p.avancer();
    expect(p.billes).toBe(3);
    expect(p.multibille).toBe(false);
    expect(p.ev & EV_MULTI_FIN).toBeTruthy();
    expect(p.ev & EV_NIVEAU).toBeTruthy();
    expect(p.autres.length).toBe(0);
    expect(p.niveau).toBe(2);
    expect(p.missionFaite).toBe(false);
    expect(p.compteur).toBe(0);
    expect(p.but).toBe(Math.ceil((but * 3) / 2));
    expect(p.dansLanceur).toBe(true);
  });

  it("la bille principale perdue pendant la multibille : une autre prend sa place, rien n'est perdu de la partie", () => {
    const p = lancerMulti();
    avancer(p, REGLAGES.multibilleDepart + REGLAGES.multibilleLacher + 10);
    p.sauveeMulti = 0;
    // la bille du lanceur part en jeu puis est perdue
    enJeu(p, 184, PERDUE_Y + 5, 0, 100);
    const [a, b] = p.autres.map((x) => x.id);
    p.avancer();
    expect(p.billes).toBe(3);
    expect(p.autres.length).toBe(1);
    expect(p.id).toBe(a);
    expect(p.autres[0]!.id).toBe(b);
    expect(p.multibille).toBe(true);
  });

  it("une table sans bille (toutes perdues pendant le délai de bille sauvée) la reprend quand les billes reviennent", () => {
    const p = lancerMulti();
    avancer(p, REGLAGES.multibilleDepart + REGLAGES.multibilleLacher + 10);
    for (let i = 0; i < 2; i++) {
      p.autres[0]!.y = (PERDUE_Y + 5) * UNITE;
      p.autres[0]!.vy = 100 * UNITE;
      p.avancer();
    }
    enJeu(p, 184, PERDUE_Y + 5, 0, 100);
    p.avancer();
    expect(p.vide).toBe(true);
    expect(p.surLaTable).toBe(3);
    expect(p.billesDeLaTable().length).toBe(0);
    expect(p.multibille).toBe(true);
    avancer(p, REGLAGES.multibilleRelance + 5);
    expect(p.vide).toBe(false);
    expect(p.billesDeLaTable().length).toBe(1);
    avancer(p, REGLAGES.multibilleLacher + 5);
    expect(p.billesDeLaTable().length).toBe(2);
    avancer(p, REGLAGES.multibilleLacher + 5);
    expect(p.billesDeLaTable().length).toBe(3);
  });
});

describe("le jackpot et les niveaux de la mission", () => {
  /** Une prise de l'élément du thème (la plongée dans le tourbillon) : le tourbillon est ensuite en pause, on la lève. */
  const prise = (p: Partie): void => {
    const z = p.table.tourbillons[0]!;
    p.tourbillonPause.fill(0);
    p.captif = 0;
    p.captifTb = -1;
    enJeu(p, z.x / UNITE, z.y / UNITE);
    p.avancer();
  };

  it("pendant la multibille chaque prise de l'élément du thème rapporte un jackpot de plus en plus gros, au multiplicateur", () => {
    const p = lancerMulti();
    const compteur = p.compteur;
    const vus: number[] = [];
    for (let k = 1; k <= 4; k++) {
      const avant = p.score;
      const prochain = p.prochainJackpot;
      prise(p);
      expect(p.ev & EV_JACKPOT).toBeTruthy();
      vus.push(p.dernierJackpot);
      expect(p.score - avant).toBe(2000 * p.mult + p.dernierJackpot);
      expect(p.dernierJackpot).toBe(prochain);
    }
    expect(vus).toEqual([5000, 7500, 10000, 12500].map((v) => v * p.mult));
    expect(p.jackpots).toBe(4);
    expect(p.compteur).toBe(compteur); // la mission ne bouge pas pendant la multibille
    expect(p.niveau).toBe(1);
  });

  it("le jackpot sans le multiplicateur (réglage) vaut la valeur brute", () => {
    const r = copierReglages();
    r.jackpotMultiplie = 0;
    const p = lancerMulti(r);
    const avant = p.score;
    prise(p);
    expect(p.score - avant).toBe(2000 * p.mult + 5000);
    expect(p.dernierJackpot).toBe(5000);
  });

  it("les jackpots repartent de zéro à chaque multibille", () => {
    const p = lancerMulti();
    prise(p);
    prise(p);
    expect(p.jackpots).toBe(2);
    p.sauveeMulti = 0;
    avancer(p, REGLAGES.multibilleDepart + REGLAGES.multibilleLacher + 10);
    for (let i = 0; i < 2; i++) {
      p.autres[0]!.y = (PERDUE_Y + 5) * UNITE;
      p.autres[0]!.vy = 100 * UNITE;
      p.avancer();
    }
    expect(p.multibille).toBe(false);
    expect(p.jackpots).toBe(0);
    expect(p.jackpotsPartie).toBe(2);
  });

  it("le niveau suivant : un but plus haut (×1,5 arrondi au-dessus), une récompense plus grosse, la boucle sans limite", () => {
    const p = partie();
    const buts = [p.but];
    const recompenses = [p.recompenseMission(1)];
    expect(buts[0]).toBe(REGLAGES.butTourbillon);
    for (let niveau = 1; niveau <= 4; niveau++) {
      // la mission du niveau
      p.tourbillonPause.fill(0);
      p.compteur = p.but - 1;
      const avant = p.score;
      const mult = p.mult;
      const z = p.table.tourbillons[0]!;
      enJeu(p, z.x / UNITE, z.y / UNITE);
      p.avancer();
      expect(p.missionFaite).toBe(true);
      expect(p.verrouAllume).toBe(true);
      expect(p.score - avant).toBe((2000 + p.recompenseMission(niveau)) * mult);
      // deux billes verrouillées, la multibille, deux billes perdues
      for (let i = 0; i < 2; i++) {
        p.trouPause.fill(0);
        dansLeTrou(p);
        p.avancer();
      }
      expect(p.multibille).toBe(true);
      p.sauveeMulti = 0;
      avancer(p, REGLAGES.multibilleDepart + REGLAGES.multibilleLacher + 10);
      for (let i = 0; i < 2; i++) {
        p.autres[0]!.y = (PERDUE_Y + 5) * UNITE;
        p.autres[0]!.vy = 100 * UNITE;
        p.avancer();
      }
      expect(p.niveau).toBe(niveau + 1);
      buts.push(p.but);
      recompenses.push(p.recompenseMission(niveau + 1));
    }
    expect(buts).toEqual([3, 5, 8, 12, 18]);
    expect(recompenses).toEqual([10000, 15000, 20000, 25000, 30000]);
    expect(p.billes).toBe(3);
    expect(p.multibilles).toBe(4);
  });

  it("le plan d'essai (sans verrou) ne rejoue pas la mission : elle reste faite", () => {
    const p = new Partie(dailyPinball(JOUR_ESSAI, PINBALL_GENERATOR_VERSION, "ocean", "classique"));
    p.compteur = p.but - 1;
    const z = p.table.tourbillons[0]!;
    enJeu(p, z.x / UNITE, z.y / UNITE);
    p.avancer();
    expect(p.missionFaite).toBe(true);
    expect(p.verrouAllume).toBe(false);
  });
});
