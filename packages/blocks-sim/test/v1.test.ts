import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseDay } from "@cdj/core";
import { dailyBlocks, decoderRediffusion, empreinteContenu, enregistrer, ErreurRediffusion, figerJour, lireJourFige, PLAFOND_PIECES, rejouer, reglesDe, type Contenu } from "../src/index";
import { jouerV1 } from "../src/v1";
import { actionDe } from "../src/index";
import { activerReglesV1 } from "../src/v1";

activerReglesV1();

// Les RÈGLES V1 (une pièce à la fois, tirage v3) ne servent plus qu'à REJOUER un jour figé avant le lot B8 : le serveur les garde. Les parties ci-dessous sont celles de l'ANCIEN code (le glouton du lot B1 sur deux jours, produites avant
// le lot B8 et jamais régénérées) : la suite du tirage v3, la rediffusion de l'époque et son résultat doivent rester exactement ce qu'ils étaient.
interface Reference {
  date: string;
  g: number;
  empreinte: string;
  debut: number[];
  actions: number[];
  code: string;
  resultat: { score: number; combo: number; poses: number; raison: string };
}
const refs = (JSON.parse(readFileSync(new URL("./fixtures/v1-reference.json", import.meta.url), "utf8")) as { jours: Reference[] }).jours;

describe("les règles v1, pour les jours figés avant le lot B8", () => {
  it.each(refs.map((r) => [r.date, r]))("le tirage v3 du %s est celui d'avant : même empreinte, même début de suite", (_date, r) => {
    const ref = r as Reference;
    const c = dailyBlocks(parseDay(ref.date)!, 3);
    expect(ref.g).toBe(3);
    expect(empreinteContenu(c)).toBe(ref.empreinte);
    expect(c.suite.slice(0, 40)).toEqual(ref.debut);
  });
  it.each(refs.map((r) => [r.date, r]))("la partie v1 du %s se rejoue au bit près : mêmes règles, même score", (_date, r) => {
    const ref = r as Reference;
    const c = dailyBlocks(parseDay(ref.date)!, 3);
    expect(jouerV1(c, ref.actions)).toEqual({ resultat: ref.resultat });
    // La rediffusion d'époque (enveloppe `sim` 1, `g` 3) se décode et se rejoue par le serveur.
    expect(decoderRediffusion(ref.code)).toMatchObject({ sim: 1, g: 3, actions: ref.actions });
    expect(rejouer(c, ref.code)).toEqual(ref.resultat);
    expect(enregistrer(c, ref.actions)).toBe(ref.code);
  });
  it("le rejeu v1 refuse comme avant : une action illégale, après la fin, une partie non terminée, trop longue", () => {
    const ref = refs[0]!;
    const c = dailyBlocks(parseDay(ref.date)!, 3);
    const erreur = (a: number[]): string => {
      const r = jouerV1(c, a);
      return "erreur" in r ? r.erreur : "accepté";
    };
    expect(erreur([...ref.actions.slice(0, 3), ref.actions[2]!])).toBe("action_illegale");
    expect(erreur([...ref.actions, 0])).toBe("apres_la_fin");
    expect(erreur(ref.actions.slice(0, -1))).toBe("non_terminee");
    expect(erreur(Array.from({ length: PLAFOND_PIECES + 1 }, () => 0))).toBe("trop_longue");
    expect(erreur([64])).toBe("action_illegale"); // une action v2 (emplacement 1) n'existe pas en v1
  });
  it("une rediffusion v2 ne se rejoue pas sur un jour v1, et inversement", () => {
    const ref = refs[0]!;
    const v1 = dailyBlocks(parseDay(ref.date)!, 3);
    const v2 = dailyBlocks(parseDay(ref.date)!);
    const refus = (f: () => unknown): string => {
      try {
        f();
      } catch (e) {
        return e instanceof ErreurRediffusion ? e.code : "autre";
      }
      return "accepté";
    };
    expect(refus(() => rejouer(v1, enregistrer(v2, [actionDe(0, 0, 0)])))).toBe("contenu_different");
    expect(refus(() => rejouer(v2, ref.code))).toBe("contenu_different");
  });
  it("un fichier de jour figé en v1 (sim 1, tirage 3, bot 1) se relit avec ses seuils, un v2 aussi ; les règles vont avec le tirage", () => {
    const j = parseDay(refs[0]!.date)!;
    const seuils = { bronze: 100, silver: 400, gold: 1000, author: 3000 };
    const fichier = figerJour(j, seuils, 3, 1);
    expect(fichier).toMatchObject({ format: 2, g: 3, sim: 1, bot: 1, seuils });
    const lu = lireJourFige(JSON.parse(JSON.stringify(fichier))) as Contenu;
    expect(lu).toEqual({ ...dailyBlocks(j, 3), seuilsFiges: seuils });
    expect(reglesDe(3)).toBe(1);
    expect(reglesDe(4)).toBe(2);
    expect(lireJourFige({ ...fichier, sim: 2 })).toBeNull(); // des règles v2 avec une suite v1 : refusé
    expect(lireJourFige({ ...figerJour(j, seuils), sim: 1 })).toBeNull();
  });
});

describe("le jeu n'embarque pas les règles v1 : sans `activerReglesV1`, un tirage v3 et un rejeu v1 sont inconnus", () => {
  it("la séparation tient dans la source : ni le tirage, ni la rediffusion, ni les jours figés n'importent `v1.ts`", () => {
    for (const f of ["generateur", "rediffusion", "jours", "partie", "suite", "index", "diamant", "glouton", "faible"]) {
      expect(readFileSync(new URL(`../src/${f}.ts`, import.meta.url), "utf8"), f).not.toMatch(/from "\.\/v1"/);
    }
  });
});
