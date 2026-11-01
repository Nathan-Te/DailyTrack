import { readFileSync } from "node:fs";
import { parseDay } from "@cdj/core";
import { beforeAll, describe, expect, it } from "vitest";
import {
  aDoublon,
  aEcartMaximal,
  dailyTower,
  decoderRediffusion,
  empreinteContenu,
  empreinteVue,
  encoderRediffusion,
  rejouerComplet,
  type Rapier,
  type Scenario,
  scenarioNomme,
  TOWER_GENERATOR_VERSION,
  TOWER_SIM_VERSION,
} from "../src";
import { chargerRapier } from "../src/rapier";

// Lot T2 — le golden de Tower (`fixtures/golden-tower.json`) : l'empreinte du contenu du jour sur dix dates, et trois rediffusions de référence (le scénario d'essai, un jour avec
// paliers, une partie qui finit à 0 vie) avec leur Resultat et l'empreinte de l'état final. Les navigateurs doivent retrouver EXACTEMENT les mêmes résultats
// (apps/tower/e2e/determinisme.spec.ts, étiqueté @navigateurs).
//
// **On ne le régénère jamais sans monter la version concernée** : `TOWER_SIM_VERSION` pour les rediffusions, `TOWER_GENERATOR_VERSION` pour le contenu du jour (et alors le générateur
// de l'ancienne version RESTE appelable : ce test continue d'appeler la version nommée par le golden). Régénérer : `npm run golden:tower -w @cdj/tower-sim` (voir tools/references.ts).
interface Golden {
  versions: { sim: number; g: number };
  contenus: { date: string; empreinte: string }[];
  tirages: { date: string; tirage: number; empreinte: string }[];
  anciennes: { g: number; contenus: { date: string; empreinte: string }[] }[];
  /** Lot T6 : les rediffusions de la simulation 3, gardées telles quelles. */
  anciennesSim: { sim: number; rediffusions: Golden["rediffusions"] }[];
  rediffusions: { nom: string; contenu: { scenario: string } | { date: string; g: number; tirage?: number }; code: string; resultat: unknown; empreinteFinale: string; ticks: number; paliers: number }[];
}
const golden = JSON.parse(readFileSync(new URL("./fixtures/golden-tower.json", import.meta.url), "utf8")) as Golden;

let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});

const contenuDe = (c: Golden["rediffusions"][number]["contenu"]): Scenario => ("scenario" in c ? scenarioNomme(c.scenario)! : dailyTower(parseDay(c.date)!, c.g, c.tirage ?? 0));

describe("golden-tower.json", () => {
  it("les versions du golden sont celles du code : sinon il faut le régénérer EN MONTANT la version (jamais l'inverse)", () => {
    expect(golden.versions).toEqual({ sim: TOWER_SIM_VERSION, g: TOWER_GENERATOR_VERSION });
  });

  it("dix dates : l'empreinte de dailyTower est celle du golden", () => {
    expect(golden.contenus).toHaveLength(10);
    for (const c of golden.contenus) expect(empreinteContenu(dailyTower(parseDay(c.date)!, golden.versions.g)), c.date).toBe(c.empreinte);
  });

  it("lot T3b : les versions 1 et 2 du générateur sont inchangées (leurs empreintes du golden des lots T2 et T3 sont gardées, sur leurs dix dates) et la version 3 s'y ajoute", () => {
    expect(golden.anciennes.map((a) => a.g)).toEqual([1, 2]);
    for (const a of golden.anciennes) {
      expect(a.contenus).toHaveLength(10);
      for (const c of a.contenus) expect(empreinteContenu(dailyTower(parseDay(c.date)!, a.g)), `g${a.g} ${c.date}`).toBe(c.empreinte);
    }
    // La version 2 ne diffère de la version 1 que par le thème (les empreintes de l'une et de l'autre se calculent sur les mêmes dates).
    expect(golden.anciennes[1]!.contenus.map((c) => c.date)).toEqual(golden.anciennes[0]!.contenus.map((c) => c.date));
    expect(new Set(golden.anciennes[1]!.contenus.map((c) => dailyTower(parseDay(c.date)!, 2).theme)).size).toBeGreaterThanOrEqual(4);
    // La version 3 : ses dix dates, le tirage 0 ; ses empreintes ne sont celles d'aucune version passée.
    const passees = new Set(golden.anciennes.flatMap((a) => a.contenus.map((c) => c.empreinte)));
    for (const c of golden.contenus) expect(passees.has(c.empreinte)).toBe(false);
  });

  it("lot T3b : des tirages non nuls de la version 3, chacun avec son empreinte (le tirage est dans l'empreinte) ; ils diffèrent du tirage 0", () => {
    expect(golden.tirages.length).toBeGreaterThanOrEqual(6);
    expect(new Set(golden.tirages.map((t) => t.tirage))).toEqual(new Set([1, 2, 3]));
    for (const t of golden.tirages) {
      const jour = parseDay(t.date)!;
      expect(empreinteContenu(dailyTower(jour, golden.versions.g, t.tirage)), `${t.date} t${t.tirage}`).toBe(t.empreinte);
      expect(t.empreinte).not.toBe(empreinteContenu(dailyTower(jour, golden.versions.g, 0)));
    }
  });

  it("les dix dates couvrent les deux bornes d'un sac de sept, chaque bonus en premier palier, chaque malus en deuxième, les deux sens du vent et les quatre plateformes", () => {
    const cs = golden.contenus.map((c) => dailyTower(parseDay(c.date)!, golden.versions.g));
    expect(cs.some((c) => aDoublon(c.pieces))).toBe(true); // deux sacs qui se touchent sur la même pièce
    expect(cs.some((c) => !aDoublon(c.pieces))).toBe(true);
    expect(cs.some((c) => aEcartMaximal(c.pieces))).toBe(true); // 13 pièces d'écart : le premier d'un sac, le dernier du suivant
    expect(new Set(cs.map((c) => c.paliers[0]!.effet))).toEqual(new Set(["lierre", "figee", "petite"]));
    expect(new Set(cs.map((c) => c.paliers[1]!.effet))).toEqual(new Set(["geante", "vent", "glissante"]));
    expect(new Set(cs.map((c) => c.ventSens))).toEqual(new Set([-1, 1]));
    expect(new Set(cs.map((c) => c.plateformeDemi8))).toEqual(new Set([20, 24, 28, 32]));
  });

  it("lot T6 — cinq rediffusions de référence de la SIMULATION 4 : le scénario d'essai à neuf vies, la suite d'alignement (des quarts de tour et des pièces posées les unes contre les autres), un jour avec paliers, une partie à 0 vie et un tirage non nul", () => {
    expect(golden.rediffusions.map((r) => r.nom)).toEqual(["essai", "alignement", "jour-avec-paliers", "zero-vie", "tirage"]);
    const [essai, alignement, paliers, zero, tirage] = golden.rediffusions as [Golden["rediffusions"][number], Golden["rediffusions"][number], Golden["rediffusions"][number], Golden["rediffusions"][number], Golden["rediffusions"][number]];
    expect(decoderRediffusion(essai.code)).toMatchObject({ sim: 4, contenu: { scenario: "essai" }, g: 0, reglages: { vies: 9 } });
    expect(decoderRediffusion(alignement.code)).toMatchObject({ sim: 4, contenu: { scenario: "alignement" }, g: 0 });
    expect(decoderRediffusion(paliers.code)).toMatchObject({ sim: 4, contenu: { jour: parseDay("2026-11-02") }, g: 3 });
    expect(decoderRediffusion(tirage.code)).toMatchObject({ sim: 4, contenu: { jour: parseDay("2026-11-02"), tirage: 2 }, g: 3 });
    expect(paliers.paliers).toBeGreaterThanOrEqual(3);
    expect(tirage.paliers).toBeGreaterThanOrEqual(2);
    expect(zero.resultat).toMatchObject({ vies: 0, tombees: 3, posees: 0, motif: "vies" });
    expect(golden.rediffusions.every((r) => decoderRediffusion(r.code).sim === TOWER_SIM_VERSION)).toBe(true);
  });

  it("lot T6 — la SIMULATION 3 reste rejouable telle quelle : ses cinq rediffusions (lots T2 et T3b) sont GARDÉES (codes, résultats, empreintes finales, ticks) et rejouées par la version qu'elles nomment", () => {
    expect(golden.anciennesSim.map((a) => a.sim)).toEqual([3]);
    const v3 = golden.anciennesSim[0]!.rediffusions;
    expect(v3.map((r) => r.nom)).toEqual(["essai", "jour-avec-paliers", "zero-vie", "jour-v3", "tirage-v3"]);
    const [essai, paliers, zero] = v3 as [Golden["rediffusions"][number], Golden["rediffusions"][number], Golden["rediffusions"][number]];
    expect([essai.empreinteFinale, paliers.empreinteFinale, zero.empreinteFinale]).toEqual(["6bdaf6d2031e3d27", "42b1b91a21e39353", "816bc75119e02ae5"]);
    expect([essai.ticks, paliers.ticks, zero.ticks]).toEqual([1077, 1720, 244]);
    expect([essai.code.length, paliers.code.length, zero.code.length]).toEqual([179, 278, 39]);
    expect([essai, paliers, zero].map((r) => (r.resultat as { hauteurMm: number }).hauteurMm)).toEqual([5000, 37_978, 0]);
    expect(paliers.contenu).toEqual({ date: "2026-11-02", g: 2 });
    expect(zero.contenu).toEqual({ date: "2026-11-03", g: 2 });
    expect(dailyTower(parseDay("2026-11-02")!, 2).paliers.map((p) => p.metres)).toEqual([10, 20, 30, 40, 50, 60]);
    for (const r of v3) expect(decoderRediffusion(r.code).sim, r.nom).toBe(3);
  });

  for (const ref of [...golden.anciennesSim.flatMap((a) => a.rediffusions.map((r) => ({ ...r, nom: `simulation ${a.sim} : ${r.nom}` }))), ...golden.rediffusions]) {
    it(`${ref.nom} : le code se décode, se réencode à l'identique, et se rejoue au bit près (Resultat et état final)`, () => {
      expect(encoderRediffusion(decoderRediffusion(ref.code))).toBe(ref.code);
      const r = rejouerComplet(R, contenuDe(ref.contenu), ref.code);
      expect(r.resultat).toEqual(ref.resultat);
      expect(r.resultat.ticks).toBe(ref.ticks);
      expect(r.vue.declenches).toBe(ref.paliers);
      expect(empreinteVue(r.vue)).toBe(ref.empreinteFinale);
    });
  }
});
