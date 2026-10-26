import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, dailyLevel, thawLevel } from "@cdj/jump-sim";
import { makeApi, parisDayStart, playerId, TEST_DB } from "./helpers";

// Lot R6 (le garde-fou des jours) : un joueur qui a ouvert DailyJump avant une mise en production et envoie son temps après. Le jeu annonce les versions de SON code
// (`simVersion`, `generatorVersion`) ; le serveur, lui, a le code d'après. Règle : pour un **jour conservé** (d'avant la bascule : fichier figé, même identifiant, même
// physique), l'envoi est accepté — les versions annoncées sont celles du niveau de ce jour ; pour un **jour régénéré** avec le nouveau code, le vieil onglet reçoit
// 409 `version` (« recharge la page »), jamais une perte silencieuse. Un onglet « du futur » (versions plus récentes que le serveur) est toujours refusé.

const NIVEAUX = join(__dirname, "../../jump/public/levels");
const lire = (date: string): unknown => JSON.parse(readFileSync(join(NIVEAUX, `${date}.json`), "utf8"));
/** Les jours conservés du test : figés avant le générateur courant (anciennes versions de la physique et du générateur). */
const JOURS = ["2026-10-20", "2026-10-25"] as const;

async function api(date: string) {
  const day = daysFromCivil(Number(date.slice(0, 4)), Number(date.slice(5, 7)), Number(date.slice(8, 10)));
  const t = await makeApi({ seed: false, environment: "recette", jumpFrozen: { [date]: lire(date) } });
  t.clock.now = parisDayStart(day) + 12 * 3_600_000;
  return { t, day };
}

describe(`vieux onglets de DailyJump (${TEST_DB})`, () => {
  for (const date of JOURS) {
    it(`${date} (jour conservé, fichier figé) : les versions annoncées sont celles du niveau — accepté, temps rejoué par le serveur`, async () => {
      const { t, day } = await api(date);
      const d = thawLevel(lire(date), day);
      if (typeof d === "string") throw new Error(d);
      const idGenerateur = Number(/-g(\d+)$/.exec(d.id)![1]);
      // Le code d'avant la mise en production : sa physique et son générateur sont ceux du niveau de ce jour.
      expect(idGenerateur).toBeLessThan(JUMP_GENERATOR_VERSION);
      const r = await t.call("POST", "/api/jump/submit", { levelId: d.id, simVersion: d.level.simVersion, generatorVersion: idGenerateur, replay: d.code, name: "Vieux" }, { headers: { "X-Player-Id": playerId(1) } });
      expect(r.status, JSON.stringify(r.body)).toBe(200);
      expect(r.body).toMatchObject({ accepted: true, levelId: d.id, ticks: d.authorTicks });
    });

    it(`${date} : un onglet « du futur » (versions plus récentes que le serveur) ou d'un niveau d'une autre règle est refusé : 409 version`, async () => {
      const { t, day } = await api(date);
      const d = thawLevel(lire(date), day);
      if (typeof d === "string") throw new Error(d);
      const idGenerateur = Number(/-g(\d+)$/.exec(d.id)![1]);
      const base = { levelId: d.id, simVersion: d.level.simVersion, generatorVersion: idGenerateur, replay: d.code, name: "Vieux" };
      for (const mauvais of [{ simVersion: JUMP_SIM_VERSION + 1 }, { generatorVersion: JUMP_GENERATOR_VERSION + 1 }, { generatorVersion: idGenerateur - 1 }, { simVersion: undefined }, { generatorVersion: "g9" }]) {
        const r = await t.call("POST", "/api/jump/submit", { ...base, ...mauvais }, { headers: { "X-Player-Id": playerId(2) } });
        expect([r.status, r.body.error], JSON.stringify(mauvais)).toEqual([409, "version"]);
      }
      expect(await t.db.first("SELECT COUNT(*) AS n FROM jump_results")).toEqual({ n: 0 });
    });
  }

  it("un jour régénéré avec le nouveau code (sans fichier figé) : le vieil onglet reçoit 409 version, le serveur n'enregistre rien", async () => {
    const date = "2026-10-30";
    const day = daysFromCivil(2026, 10, 30);
    const t = await makeApi({ seed: false, environment: "recette", jumpFrozen: {} });
    t.clock.now = parisDayStart(day) + 12 * 3_600_000;
    const info = await t.call("GET", `/api/jump/day/${date}`);
    expect(info.body.id).toBe(`jour-${date}-g${JUMP_GENERATOR_VERSION}`);
    // L'onglet d'avant : le niveau qu'il jouait (autre générateur, autre identifiant) n'est plus celui du serveur ce jour-là.
    const r = await t.call("POST", "/api/jump/submit", { levelId: `jour-${date}-g${JUMP_GENERATOR_VERSION - 1}`, simVersion: JUMP_SIM_VERSION - 1, generatorVersion: JUMP_GENERATOR_VERSION - 1, replay: dailyLevel(day).code, name: "Vieux" }, { headers: { "X-Player-Id": playerId(3) } });
    expect([r.status, r.body.error]).toEqual([409, "version"]);
    expect(await t.db.first("SELECT COUNT(*) AS n FROM jump_results")).toEqual({ n: 0 });
  });

  it("le jour conservé reste celui que la production servait : l'identifiant du serveur est celui du fichier figé, pas celui du générateur courant", async () => {
    const { t } = await api("2026-10-20");
    const info = await t.call("GET", "/api/jump/day/2026-10-20");
    expect(info.body).toMatchObject({ id: "jour-2026-10-20-g9", source: "fige" });
  });
});
