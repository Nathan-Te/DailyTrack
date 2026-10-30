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
  SCENARIO_ESSAI,
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
  rediffusions: { nom: string; contenu: { scenario: string } | { date: string }; code: string; resultat: unknown; empreinteFinale: string; ticks: number; paliers: number }[];
}
const golden = JSON.parse(readFileSync(new URL("./fixtures/golden-tower.json", import.meta.url), "utf8")) as Golden;

let R: Rapier;
beforeAll(async () => {
  R = await chargerRapier();
});

const contenuDe = (c: Golden["rediffusions"][number]["contenu"]): Scenario => ("scenario" in c ? SCENARIO_ESSAI : dailyTower(parseDay(c.date)!, golden.versions.g));

describe("golden-tower.json", () => {
  it("les versions du golden sont celles du code : sinon il faut le régénérer EN MONTANT la version (jamais l'inverse)", () => {
    expect(golden.versions).toEqual({ sim: TOWER_SIM_VERSION, g: TOWER_GENERATOR_VERSION });
  });

  it("dix dates : l'empreinte de dailyTower est celle du golden", () => {
    expect(golden.contenus).toHaveLength(10);
    for (const c of golden.contenus) expect(empreinteContenu(dailyTower(parseDay(c.date)!, golden.versions.g)), c.date).toBe(c.empreinte);
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

  it("trois rediffusions de référence : le scénario d'essai (neuf vies), un jour avec paliers, une partie à 0 vie", () => {
    expect(golden.rediffusions.map((r) => r.nom)).toEqual(["essai", "jour-avec-paliers", "zero-vie"]);
    const [essai, paliers, zero] = golden.rediffusions as [Golden["rediffusions"][number], Golden["rediffusions"][number], Golden["rediffusions"][number]];
    expect(decoderRediffusion(essai.code)).toMatchObject({ contenu: { scenario: "essai" }, g: 0, reglages: { vies: 9 } }); // l'en-tête garde des réglages non standard
    expect(decoderRediffusion(paliers.code)).toMatchObject({ contenu: { jour: parseDay("2026-11-02") }, g: 1 });
    expect(paliers.paliers).toBeGreaterThanOrEqual(3); // plusieurs effets s'appliquent : le lierre, la pièce géante, la pièce figée, le coup de vent
    expect(zero.resultat).toMatchObject({ vies: 0, tombees: 3, posees: 0, motif: "vies" });
  });

  for (const ref of golden.rediffusions) {
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
