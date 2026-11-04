import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import {
  CIBLES_GENERATOR_VERSION,
  COLONNES,
  DELAI_BOT,
  DUREE_TICKS,
  ErreurGenerateur,
  LIGNES,
  MAX_TOUCHES,
  NB_CASES,
  NB_CIBLES,
  Partie,
  caseAuPoint,
  dailyCibles,
  decoderRediffusion,
  empreinteContenu,
  encoderRediffusion,
  enregistrer,
  figerJour,
  jouer,
  lireJourFige,
  medailleDe,
  partieDuBot,
  rejouer,
  seuilsDe,
  themeDuJour,
  touchesDuBot,
} from "../src/index";

const J = daysFromCivil(2026, 11, 4);

describe("le contenu du jour", () => {
  it("est déterministe et valide pour 400 jours", () => {
    for (let j = J; j < J + 400; j++) {
      const a = dailyCibles(j);
      expect(empreinteContenu(a)).toBe(empreinteContenu(dailyCibles(j)));
      expect(a.cibles).toHaveLength(NB_CIBLES);
      a.cibles.forEach((x, i) => {
        expect(x.c).toBeGreaterThanOrEqual(0);
        expect(x.c).toBeLessThan(NB_CASES);
        expect(x.f - x.d).toBeGreaterThan(DELAI_BOT + 8); // le bot a toujours le temps, un humain aussi
        expect(x.f).toBeLessThanOrEqual(DUREE_TICKS);
        if (i > 0) {
          expect(x.d).toBeGreaterThanOrEqual(a.cibles[i - 1]!.f); // une seule cible visible à la fois
          expect(x.c).not.toBe(a.cibles[i - 1]!.c);
        }
      });
    }
  });
  it("change d'un jour à l'autre", () => {
    expect(empreinteContenu(dailyCibles(J))).not.toBe(empreinteContenu(dailyCibles(J + 1)));
  });
  it("refuse une version de générateur inconnue", () => {
    expect(() => dailyCibles(J, 99)).toThrow(ErreurGenerateur);
  });
  it("deux thèmes, jamais deux jours de suite le même", () => {
    for (let j = J; j < J + 60; j++) expect(themeDuJour(j)).not.toBe(themeDuJour(j + 1));
  });
});

describe("la partie", () => {
  const c = dailyCibles(J);
  it("compte une cible touchée dans sa fenêtre, ignore le reste", () => {
    const p = new Partie(c);
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
  it("une partie vide finit avec zéro touche et le départage maximal", () => {
    expect(jouer(c, [])).toEqual({ touches: 0, dernier: DUREE_TICKS, ratees: 0, ticks: DUREE_TICKS });
  });
  it("le bot touche tout, 12 ticks après l'apparition de chaque cible", () => {
    const r = partieDuBot(c);
    expect(r.touches).toBe(NB_CIBLES);
    expect(r.dernier).toBe(c.cibles[NB_CIBLES - 1]!.d + DELAI_BOT);
    expect(r.ratees).toBe(0);
  });
  it("une touche après la cible ne compte plus", () => {
    const x = c.cibles[0]!;
    expect(jouer(c, [{ tick: x.f, c: x.c }]).touches).toBe(0);
    expect(jouer(c, [{ tick: x.f - 1, c: x.c }]).touches).toBe(1);
  });
  it("la case sous un point du plateau", () => {
    expect(caseAuPoint(0, 0, 80, 60, LIGNES)).toBe(0);
    expect(caseAuPoint(79, 59, 80, 60, LIGNES)).toBe(COLONNES * LIGNES - 1);
    expect(caseAuPoint(80, 10, 80, 60, LIGNES)).toBe(-1);
  });
});

describe("la rediffusion", () => {
  const c = dailyCibles(J);
  it("fait l'aller-retour et rejoue au bit près", () => {
    const touches = touchesDuBot(c);
    const code = enregistrer(c, touches);
    expect(decoderRediffusion(code).touches).toEqual(touches);
    expect(rejouer(c, code)).toEqual(partieDuBot(c));
  });
  it("refuse tout ce qui est illisible, avec un code", () => {
    const code = (r: Partial<Parameters<typeof encoderRediffusion>[0]>) => encoderRediffusion({ sim: 1, g: 1, contenu: { jour: J }, touches: [], ...r });
    const refus = (f: () => unknown) => {
      try {
        f();
      } catch (e) {
        return (e as { code?: string }).code;
      }
      return "aucun";
    };
    expect(refus(() => decoderRediffusion(""))).toBe("format_illisible");
    expect(refus(() => decoderRediffusion("***"))).toBe("format_illisible");
    expect(refus(() => decoderRediffusion("A".repeat(1500)))).toBe("trop_longue");
    expect(refus(() => decoderRediffusion(code({ sim: 2 })))).toBe("version_inconnue");
    expect(refus(() => decoderRediffusion(code({ g: 2 })))).toBe("version_inconnue");
    expect(refus(() => decoderRediffusion(code({ touches: [{ tick: DUREE_TICKS, c: 0 }] })))).toBe("format_illisible");
    expect(refus(() => decoderRediffusion(code({ touches: [{ tick: 3, c: NB_CASES }] })))).toBe("format_illisible");
    expect(refus(() => decoderRediffusion(code({ touches: Array.from({ length: MAX_TOUCHES + 1 }, () => ({ tick: 5, c: 1 })) })))).toBe("trop_longue");
    expect(refus(() => rejouer(c, code({ contenu: { jour: J + 1 } })))).toBe("contenu_different");
    expect(refus(() => rejouer(c, code({ contenu: { scenario: "essai" } })))).toBe("contenu_different");
  });
  it("une rediffusion de 200 touches tient dans la borne de texte", () => {
    const code = enregistrer(c, Array.from({ length: MAX_TOUCHES }, (_, i) => ({ tick: 300 + (i >> 3), c: (i * 7) % NB_CASES })));
    expect(code.length).toBeLessThanOrEqual(1000);
  });
});

describe("les médailles et les jours figés", () => {
  const c = dailyCibles(J);
  it("le Diamant est la partie du bot, plafonnée ; or, argent et bronze à 50, 30 et 15 %", () => {
    expect(seuilsDe(c)).toEqual({ author: 20, gold: 10, silver: 6, bronze: 3 });
    const s = seuilsDe(c);
    expect([20, 10, 9, 5, 3, 2].map((touches) => medailleDe({ touches }, s))).toEqual(["author", "gold", "silver", "bronze", "bronze", null]);
  });
  it("un jour figé se relit et se régénère à l'identique ; un fichier abîmé est refusé", () => {
    const f = figerJour(J);
    expect(lireJourFige(JSON.parse(JSON.stringify(f)))).toEqual(c);
    expect(lireJourFige({ ...f, g: 2 })).toBeNull();
    expect(lireJourFige({ ...f, contenu: { cibles: f.contenu.cibles.slice(1) } })).toBeNull();
    expect(lireJourFige({ ...f, jeu: "autre" })).toBeNull();
    expect(lireJourFige(null)).toBeNull();
    expect(CIBLES_GENERATOR_VERSION).toBe(1);
  });
});
