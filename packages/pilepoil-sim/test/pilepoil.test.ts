import { describe, expect, it } from "vitest";
import { daysFromCivil, graineDuJour } from "@cdj/core";
import {
  ErreurGenerateur,
  JAUGES,
  LONGUEUR,
  MAX_APPUIS,
  PILEPOIL_GENERATOR_VERSION,
  Partie,
  REGLAGES,
  dailyPilepoil,
  decoderRediffusion,
  empreinteContenu,
  encoderRediffusion,
  enregistrer,
  jouer,
  joueurScripte,
  maxPas,
  reglagesDe,
  rejouer,
  sinus,
  tirerJauges,
} from "../src/index";
import { MAQUETTE } from "./maquette";

// « Pile poil » (lot PA2) : la simulation reprise de la maquette. Les jauges, les points et les scores doivent être ceux de la maquette (lue telle quelle, `maquette.ts`).
const J = daysFromCivil(2026, 11, 22);
const c = dailyPilepoil(J);
/** Un joueur qui appuie à 25 000 du centre au plus (un quart de demi-cible au début), et laisse filer la 4e jauge à la fin de son attente. */
const moyen = joueurScripte(c.jauges, (i) => (i === 3 ? null : 25000));
const refus = (f: () => unknown): string => {
  try {
    f();
  } catch (e) {
    return (e as { code?: string }).code ?? String(e);
  }
  return "aucun";
};

describe("la maquette fait foi", () => {
  it("les réglages de départ sont les valeurs DEFAUT de la maquette (plus la fin de jauge sans appui)", () => {
    const { attenteMax, ...reste } = REGLAGES;
    expect(reste).toEqual(MAQUETTE.DEFAUT);
    expect(attenteMax).toBe(1800);
  });
  it("le sinus en table est celui de la maquette, pour les 1 000 pas", () => {
    expect(Array.from({ length: 1000 }, (_, a) => sinus(a))).toEqual(MAQUETTE.SINUS);
  });
  it("les dix jauges d'une graine sont celles de la maquette", () => {
    for (let j = J; j < J + 30; j++) {
      const g = graineDuJour("pilepoil", j);
      expect(tirerJauges(g)).toEqual(MAQUETTE.tirerJauges(g, MAQUETTE.DEFAUT));
    }
  });
  it("le centre de la cible qui bouge suit celui de la maquette, pas à pas", () => {
    const e = MAQUETTE.nouvellePartie(c.graine, MAQUETTE.DEFAUT);
    MAQUETTE.entrerJauge(e);
    const p = new Partie(c.jauges);
    const appuis = joueurScripte(c.jauges, () => 30000);
    let k = 0;
    while (!p.fini) {
      expect(p.x).toBe(e.x);
      if (p.enJeu) expect(p.centreCible()).toBe(MAQUETTE.centreCible(e, e.jauges[e.i]));
      if (appuis[k] === p.pas) {
        p.appuyer();
        MAQUETTE.appuyer(e);
        k++;
      }
      p.avancer();
      MAQUETTE.pas(e);
    }
    expect(p.score).toBe(e.score);
    expect(p.resultats.map((r) => [r.points, r.bonus, r.sorte])).toEqual(e.resultats.map((r) => [r.points, r.bonus, r.sorte]));
  });
  it("une graine connue donne un score connu, le même que la maquette", () => {
    const appuis = joueurScripte(c.jauges, (i) => 4000 + 9000 * (i % 4)); // appuie à 4 000, 13 000, 22 000 ou 31 000 du centre au plus : toujours à temps (la maquette n'a pas de fin de jauge)
    const r = jouer(c.jauges, appuis);
    expect(MAQUETTE.rejouer(c.graine, MAQUETTE.DEFAUT, appuis)).toBe(r.score);
    expect({ graine: c.graine, appuis, score: r.score, piles: r.piles, ratees: r.ratees }).toEqual(SCORE_CONNU);
  });
});
// Le 22/11/2026 et ce joueur : relevé une fois sur la maquette (le test vérifie aussi l'accord avec elle) ; un changement de règle le fait bouger.
const SCORE_CONNU = { graine: 3804009562, appuis: [118, 516, 642, 724, 1020, 1121, 1205, 1358, 1451, 1547], score: 1167, piles: 5, ratees: 0 };

describe("le tirage du jour : la graine, rien d'autre", () => {
  it("est déterministe, change d'un jour à l'autre, et ne dépend que de la graine", () => {
    for (let j = J; j < J + 20; j++) {
      const a = dailyPilepoil(j);
      expect(empreinteContenu(a)).toBe(empreinteContenu(dailyPilepoil(j)));
      expect(a.graine).toBe(graineDuJour("pilepoil", j));
      expect(a.jauges).toEqual(tirerJauges(a.graine));
      expect(a.jauges).toHaveLength(JAUGES);
    }
    expect(empreinteContenu(dailyPilepoil(J))).not.toBe(empreinteContenu(dailyPilepoil(J + 1)));
  });
  it("de jauge en jauge ça accélère et la cible rétrécit ; les trois dernières bougent ; tout tient dans la jauge", () => {
    for (let j = J; j < J + 60; j++) {
      const { jauges } = dailyPilepoil(j);
      jauges.forEach((g, i) => {
        expect(g.bouge).toBe(i >= 7);
        expect(g.centre - g.demi).toBeGreaterThan(0);
        expect(g.centre + g.demi).toBeLessThan(LONGUEUR);
        expect(g.depart).toBeLessThan(LONGUEUR);
        if (i > 0) {
          expect(g.demi).toBeLessThan(jauges[i - 1]!.demi);
          expect(g.vitesse).toBeGreaterThan(jauges[i - 1]!.vitesse - 400);
        }
      });
      expect(jauges[9]!.vitesse).toBeGreaterThan(jauges[0]!.vitesse + 3000);
    }
  });
  it("refuse une version inconnue du tirage", () => {
    expect(() => dailyPilepoil(J, 99)).toThrow(ErreurGenerateur);
    expect(PILEPOIL_GENERATOR_VERSION).toBe(1);
  });
});

describe("la partie", () => {
  it("est déterministe : les mêmes appuis donnent le même résultat", () => {
    expect(jouer(c.jauges, moyen)).toEqual(jouer(dailyPilepoil(J).jauges, [...moyen]));
  });
  it("sans appui, chaque jauge est ratée à la fin de son attente : la partie finit toujours", () => {
    const r = jouer(c.jauges, []);
    expect(r).toEqual({ score: 0, piles: 0, enchaineMax: 0, ratees: JAUGES, ticks: maxPas() });
  });
  it("les points suivent l'écart au centre ; « pile » vaut 100 plus un bonus qui grimpe quand on enchaîne", () => {
    const fixe = reglagesDe({ bougeDes: 11 });
    const jauges = tirerJauges(c.graine, fixe);
    const p = new Partie(jauges, fixe);
    const sortes: string[] = [];
    const appuis = joueurScripte(jauges, () => fixe.parfait, fixe);
    expect(appuis).toHaveLength(JAUGES);
    const r = jouer(jauges, appuis, fixe);
    expect(r.piles).toBe(JAUGES);
    // 10 × 100, et 50 + 75 + 100 + … + 275 de bonus.
    expect(r.score).toBe(1000 + Array.from({ length: JAUGES }, (_, k) => 50 + 25 * k).reduce((a, b) => a + b));
    expect(r.enchaineMax).toBe(JAUGES);
    // Un arrêt au bord de la cible : « touche », peu de points ; hors de la cible : 0.
    while (!p.fini) {
      if (p.enJeu && p.i === 0 && Math.abs(p.x - p.centreCible()) > jauges[0]!.demi * 0.8 && Math.abs(p.x - p.centreCible()) <= jauges[0]!.demi) sortes.push(p.appuyer()!.sorte);
      if (p.enJeu && p.i === 1 && Math.abs(p.x - p.centreCible()) > jauges[1]!.demi + 10000) sortes.push(p.appuyer()!.sorte);
      p.avancer();
    }
    expect(sortes).toEqual(["touche", "rate"]);
    expect(p.resultats[0]!.points).toBeLessThan(30);
    expect(p.resultats[1]!.points).toBe(0);
  });
  it("un appui pendant la pause ne compte pas", () => {
    const p = new Partie(c.jauges);
    expect(p.appuyer()).not.toBeNull();
    expect(p.appuyer()).toBeNull();
    expect(p.appuis).toHaveLength(1);
  });
});

describe("la rediffusion", () => {
  it("fait l'aller-retour, rejoue au score près, et reste courte", () => {
    const code = enregistrer(c, moyen);
    expect(decoderRediffusion(code).appuis).toEqual(moyen);
    expect(rejouer(c, code)).toEqual(jouer(c.jauges, moyen));
    const plein = joueurScripte(c.jauges, () => 30000);
    expect(plein).toHaveLength(MAX_APPUIS);
    expect(enregistrer(c, plein).length).toBeLessThanOrEqual(60);
  });
  it("refuse une rediffusion impossible : appui pendant une pause, plus de dix appuis, pas qui recule", () => {
    const code = (appuis: number[], plus: Partial<Parameters<typeof encoderRediffusion>[0]> = {}) => encoderRediffusion({ sim: 1, g: 1, contenu: { jour: J }, appuis, ...plus });
    const p = moyen[0]!;
    expect(refus(() => rejouer(c, code([p, p + 1])))).toBe("appui_impossible"); // pendant la pause qui suit le premier appui
    expect(refus(() => rejouer(c, code([p, p + REGLAGES.pauseResultat - 1])))).toBe("appui_impossible");
    expect(refus(() => rejouer(c, code([p, p + REGLAGES.pauseResultat])))).toBe("aucun"); // la jauge suivante vient de commencer
    expect(refus(() => decoderRediffusion(code(Array.from({ length: MAX_APPUIS + 1 }, (_, i) => 100 + i * 200))))).toBe("trop_longue");
    expect(refus(() => decoderRediffusion(code([500, 300])))).toBe("appui_impossible");
    expect(refus(() => decoderRediffusion(code([300, 300])))).toBe("appui_impossible");
    expect(refus(() => decoderRediffusion(code([maxPas()])))).toBe("appui_impossible");
    // après la fin de la partie (dix jauges jouées) : impossible aussi
    const fin = jouer(c.jauges, moyen).ticks; // le joueur « moyen » a laissé filer une jauge : neuf appuis, la partie finit au pas `fin`
    expect(moyen).toHaveLength(9);
    expect(refus(() => rejouer(c, code([...moyen, fin + 10])))).toBe("appui_impossible");
  });
  it("refuse tout ce qui est illisible, avec un code", () => {
    const code = (r: Partial<Parameters<typeof encoderRediffusion>[0]>) => encoderRediffusion({ sim: 1, g: 1, contenu: { jour: J }, appuis: [], ...r });
    expect(refus(() => decoderRediffusion(""))).toBe("format_illisible");
    expect(refus(() => decoderRediffusion("***"))).toBe("format_illisible");
    expect(refus(() => decoderRediffusion("A".repeat(300)))).toBe("trop_longue");
    expect(refus(() => decoderRediffusion(code({ sim: 2 })))).toBe("version_inconnue");
    expect(refus(() => decoderRediffusion(code({ g: 2 })))).toBe("version_inconnue");
    expect(refus(() => rejouer(c, code({ contenu: { jour: J + 1 } })))).toBe("contenu_different");
    expect(refus(() => rejouer(c, code({ contenu: { scenario: "essai" } })))).toBe("contenu_different");
  });
});
