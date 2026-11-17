import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import {
  DROITE, GAUCHE, IDS_PLANS, LANCEUR, REGLAGES, ROBOT_ECART_MIN, ROBOT_IMPRECISION, ROBOT_MAINTIEN_MAX, ROBOT_MAINTIEN_MIN, ROBOT_MARGE, ROBOT_REACTION, THEMES_PINBALL, Partie, chargeDe, dailyPinball, enregistrer, graineDuRobot, jouer, jouerRobot, lireCharge, noterFrappe,
  rejouer, type Coup, type Evenement,
} from "../src/index";

// Lot PB4 — le robot : ses contraintes d'humain, son déterminisme, ses événements (ce sont ceux d'une rediffusion : le serveur les rejoue et retrouve son score), et le fait qu'il vise (la mission du jour).
const JOUR = daysFromCivil(2026, 11, 9);
const COURT = 36000; // une minute de jeu

describe("le robot est déterministe", () => {
  const c = dailyPinball(JOUR);
  it("la même graine donne la même partie, au pas près ; une autre graine, une autre partie", () => {
    const a = jouerRobot(c, 7, { maxTicks: COURT });
    const b = jouerRobot(c, 7, { maxTicks: COURT });
    expect(b.evenements).toEqual(a.evenements);
    expect(b.partie.resultat()).toEqual(a.partie.resultat());
    expect(b.coups).toEqual(a.coups);
    const autre = jouerRobot(c, 8, { maxTicks: COURT });
    expect(autre.evenements).not.toEqual(a.evenements);
  });
  it("jouer en tranches ou d'un trait, avec ou sans suivi, donne la même partie", () => {
    const suivi: number[] = [];
    const a = jouerRobot(c, 3, { maxTicks: 6000 });
    const b = jouerRobot(c, 3, { maxTicks: 6000, surPas: (p) => void suivi.push(p.tick) });
    expect(b.evenements).toEqual(a.evenements);
    expect(suivi.length).toBe(b.partie.tick);
  });
});

describe("ce que le robot joue est une rediffusion", () => {
  it("ses événements sont valides (jamais deux fois la même commande au même pas, appui puis relâchement) et le serveur les rejoue jusqu'à la fin : il retrouve le score du robot", () => {
    // des réglages qui finissent la partie vite (une pente forte, pas de bille sauvée) : le robot la joue jusqu'à sa fin naturelle
    const reglages = { ...REGLAGES, pente: 2200, sauvee: 0 };
    const c = dailyPinball(JOUR + 1);
    const r = jouerRobot(c, 5, { reglages });
    expect(r.partie.finie).toBe(true);
    expect(lireCharge(chargeDe(r.evenements))).toEqual(r.evenements);
    expect(jouer(c, r.evenements, reglages)).toEqual(r.partie.resultat());
  });
  it("sur les réglages du serveur, la partie rejouée jusqu'au pas où le robot s'est arrêté est la sienne", () => {
    const c = dailyPinball(JOUR + 2);
    const r = jouerRobot(c, 2, { maxTicks: COURT });
    const p = new Partie(c);
    let k = 0;
    while (p.tick < r.partie.tick) {
      while (k < r.evenements.length && r.evenements[k]!.tick === p.tick) p.regler(r.evenements[k]!.c, r.evenements[k++]!.enfonce);
      p.avancer();
    }
    expect(p.resultat()).toEqual(r.partie.resultat());
    expect(rejouer(c, enregistrer(c, r.evenements)).score).toBeGreaterThanOrEqual(0); // le serveur accepte la rediffusion
  });
});

describe("le robot a des contraintes d'humain", () => {
  const c = dailyPinball(JOUR + 3);
  const coupsVus: { coup: Coup; avant: Partie }[] = [];
  const r = jouerRobot(c, 11, { maxTicks: 54000, surCoup: (coup, p) => coupsVus.push({ coup, avant: p.copier() }) });
  it("il y a assez de coups pour juger (la partie d'une minute et demie)", () => {
    expect(r.coups.length).toBeGreaterThan(20);
    expect(r.coups.every((k) => k.appui >= 0)).toBe(true);
  });
  it(`un temps de réaction : jamais d'appui moins de ${ROBOT_REACTION} pas après la décision`, () => {
    for (const k of r.coups) expect(k.appui - k.decision, `décision au pas ${k.decision}`).toBeGreaterThanOrEqual(ROBOT_REACTION);
  });
  it(`une imprécision bornée : l'appui tombe à ${ROBOT_IMPRECISION} pas au plus du moment choisi (ou à la réaction minimale)`, () => {
    let ecarts = 0;
    for (const k of r.coups) {
      const ecart = k.appui - k.decision - k.delai;
      if (k.appui - k.decision !== ROBOT_REACTION) expect(Math.abs(ecart)).toBeLessThanOrEqual(ROBOT_IMPRECISION);
      if (ecart !== 0) ecarts++;
    }
    expect(ecarts, "le robot n'appuie pas toujours au pas près : l'erreur vient de sa graine").toBeGreaterThan(r.coups.length / 3);
  });
  it(`un écart d'au moins ${ROBOT_ECART_MIN} pas entre deux appuis du même batteur, et un batteur tenu entre ${ROBOT_MAINTIEN_MIN} et ${ROBOT_MAINTIEN_MAX} pas`, () => {
    for (const b of [GAUCHE, DROITE]) {
      const ev = r.evenements.filter((e) => e.c === b);
      expect(ev.length).toBeGreaterThan(8);
      for (let i = 0; i < ev.length; i++) expect(ev[i]!.enfonce).toBe(i % 2 === 0); // appui, relâchement, appui…
      for (let i = 0; i + 1 < ev.length; i += 2) {
        const tenu = ev[i + 1]!.tick - ev[i]!.tick;
        expect(tenu).toBeGreaterThanOrEqual(ROBOT_MAINTIEN_MIN);
        expect(tenu).toBeLessThanOrEqual(ROBOT_MAINTIEN_MAX);
        if (i + 2 < ev.length) expect(ev[i + 2]!.tick - ev[i]!.tick).toBeGreaterThanOrEqual(ROBOT_ECART_MIN);
      }
    }
  });
  it("le lanceur : une charge qui varie d'une bille à l'autre", () => {
    const ev = r.evenements.filter((e) => e.c === LANCEUR);
    const tenues = ev.filter((e) => !e.enfonce).map((e, i) => e.tick - ev.filter((x) => x.enfonce)[i]!.tick);
    expect(tenues.length).toBeGreaterThan(1);
    expect(new Set(tenues).size).toBeGreaterThan(1);
  });
  it(`un coup n'est choisi que s'il marche encore ${ROBOT_MARGE} pas plus tôt et plus tard, et jamais s'il est pire que ne rien faire`, () => {
    let juges = 0;
    for (const { coup, avant } of coupsVus.slice(0, 25)) {
      for (const decalage of [-ROBOT_MARGE, -ROBOT_MARGE / 2, 0, ROBOT_MARGE / 2, ROBOT_MARGE]) {
        expect(noterFrappe(avant, coup.batteurs, coup.delai + decalage), `coup décidé au pas ${avant.tick}, décalé de ${decalage}`).toBeGreaterThanOrEqual(coup.robuste);
      }
      expect(coup.robuste).toBeGreaterThanOrEqual(coup.rien);
      juges++;
    }
    expect(juges).toBeGreaterThan(15);
  });
});

describe("le robot vise : la mission du jour compte en premier", () => {
  it.each(THEMES_PINBALL)("%s : il réussit la mission en deux minutes de jeu", (theme) => {
    const c = dailyPinball(JOUR + 4, undefined, theme, "doublette"); // lot PBG1 : un plan fixé (la validation éprouve les 500 tables)
    const r = jouerRobot(c, graineDuRobot(0), { maxTicks: 72000 });
    expect(r.partie.missionFaite || r.partie.niveau > 1, `${theme} : mission ${r.partie.compteur} / ${r.partie.but}`).toBe(true); // lot PBG2 : la mission revient après la multibille
    expect(r.partie.score).toBeGreaterThan(20000);
  });
  it("lot PBG1 : il vise les rails — sur chaque plan, ses quatre parties de deux minutes mènent chaque rail à son bout au moins une fois, avec un combo", () => {
    for (const plan of IDS_PLANS) {
      const c = dailyPinball(JOUR + 4, undefined, "foire", plan);
      const faits = new Set<number>();
      let combo = 0;
      for (let k = 0; k < 4; k++) {
        const r = jouerRobot(c, graineDuRobot(k), { maxTicks: 72000 });
        r.partie.railsFaits.forEach((n, i) => n > 0 && faits.add(i));
        combo = Math.max(combo, r.partie.comboMaxPartie);
      }
      expect(faits.size, plan).toBe(new Partie(c).table.rails.length);
      expect(combo, plan).toBeGreaterThanOrEqual(2);
    }
  }, 180_000); // 16 parties de deux minutes
});

describe("la copie d'une partie", () => {
  const c = dailyPinball(JOUR + 5, undefined, "espace"); // l'astéroïde : sa position vit dans la table
  const ev: Evenement[] = [{ tick: 20, c: LANCEUR, enfonce: true }, { tick: 400, c: LANCEUR, enfonce: false }, { tick: 900, c: GAUCHE, enfonce: true }, { tick: 1000, c: GAUCHE, enfonce: false }];
  const jusqua = (p: Partie, n: number): void => {
    let k = 0;
    while (p.tick < n && !p.finie) {
      while (k < ev.length && ev[k]!.tick === p.tick) p.regler(ev[k]!.c, ev[k++]!.enfonce);
      p.avancer();
    }
  };
  it("joue exactement comme l'original, pas à pas (l'astéroïde compris), sans le modifier", () => {
    const p = new Partie(c);
    jusqua(p, 3000);
    const copie = p.copier();
    const avant = JSON.stringify(p);
    for (let i = 0; i < 2000; i++) {
      p.avancer();
      copie.avancer();
      expect(copie.x).toBe(p.x);
      expect(copie.y).toBe(p.y);
      expect(copie.score).toBe(p.score);
    }
    expect(copie.table.bumpers.map((b) => b.x)).toEqual(p.table.bumpers.map((b) => b.x));
    // une copie jouée plus loin que l'original ne change pas l'original
    const dehors = new Partie(c);
    jusqua(dehors, 3000);
    const seule = JSON.stringify(dehors);
    const d = dehors.copier();
    for (let i = 0; i < 5000; i++) d.avancer();
    expect(JSON.stringify(dehors)).toBe(seule);
    expect(avant).not.toBe(JSON.stringify(p));
  });
  it("une copie sans gains marque les mêmes points", () => {
    const p = new Partie(c);
    jusqua(p, 2500);
    const a = p.copier();
    const b = p.copier(true);
    for (let i = 0; i < 3000; i++) {
      a.avancer();
      b.avancer();
    }
    expect(b.score).toBe(a.score);
    expect(b.gains).toHaveLength(0);
  });
});

describe("lot PBG2 : le robot en multibille", () => {
  const c = dailyPinball(JOUR + 3, undefined, "espace", "doublette");
  it("il vise le verrou allumé, lance la multibille et y joue la bille la plus menacée : des frappes tant que plusieurs billes sont en jeu, un jackpot au moins ; rejouée, c'est la même partie", () => {
    let pasMulti = 0;
    let maxBilles = 0;
    let frappesMulti = 0;
    let avant = 0;
    const r = jouerRobot(c, graineDuRobot(0), {
      maxTicks: 216000,
      surPas: (p) => {
        if (p.autres.length > 0) pasMulti++;
        maxBilles = Math.max(maxBilles, p.autres.length + (p.vide ? 0 : 1));
        const n = (p.tenue(0) ? 1 : 0) + (p.tenue(1) ? 1 : 0);
        if (p.autres.length > 0 && n > avant) frappesMulti++;
        avant = n;
      },
    });
    expect(r.partie.verrouTotal, "des billes verrouillées").toBeGreaterThanOrEqual(2);
    expect(r.partie.multibilles).toBeGreaterThanOrEqual(1);
    expect(r.partie.jackpotsPartie).toBeGreaterThanOrEqual(1);
    expect(maxBilles).toBe(3);
    expect(pasMulti).toBeGreaterThan(2000);
    expect(frappesMulti, "le robot frappe pendant la multibille").toBeGreaterThanOrEqual(10);
    expect(r.partie.billes, "les billes perdues pendant la multibille ne coûtent rien").toBeGreaterThanOrEqual(1);
    const encore = jouerRobot(c, graineDuRobot(0), { maxTicks: 216000 });
    expect(encore.evenements).toEqual(r.evenements);
    expect(encore.partie.resultat()).toEqual(r.partie.resultat());
  }, 60000);
});
