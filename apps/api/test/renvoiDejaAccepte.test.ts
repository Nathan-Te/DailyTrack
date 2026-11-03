import { daysFromCivil, formatDay } from "@cdj/core";
import { JUMP_GENERATOR_VERSION, JUMP_SIM_VERSION, dailyLevel, decodeReplay as decodeJump, demoAttempts, encodeReplay as encodeJump, repriseParPhase, replayAttempt } from "@cdj/jump-sim";
import { dailyTower, TOWER_GENERATOR_VERSION, rejouer } from "@cdj/tower-sim";
import { chargerRapier } from "@cdj/tower-sim/rapier";
import { beforeAll, describe, expect, it } from "vitest";
import { jouerScripte } from "../scripts/tower-aide";
import { D, monterTower } from "../scripts/tower-test";
import { replayUnits } from "../src/replayCost";
import { UNITES_REJEU_TOWER, type ExecuteurRejeu } from "../src/towerRejeu";
import { DAY, TEST_DB, makeApi, parisDayStart, pilotReplay, playerId } from "./helpers";

// Lot D2 (C5) — un renvoi déjà accepté répond AVANT le rejeu : même joueur, même jour, même rediffusion que le résultat écrit → 200 `deja: true`, `improved: false`, le résultat existant, sans
// rejeu, sans dépenser le plafond de rejeux, sans rien écrire. Les trois jeux (Track : `cdj.ts` ; Jump et Tower : le module des jeux). Une rediffusion différente passe, elle, par le rejeu comme avant.
// SQLite et libSQL (`file:`), jamais Turso.

const as = (n: number) => ({ headers: { "X-Player-Id": playerId(n) } });

describe(`C5 — Track : le renvoi déjà accepté (${TEST_DB})`, () => {
  const rapide = pilotReplay(DAY, 0.9);
  const lente = pilotReplay(DAY, 0.78);
  const envoyer = (t: Awaited<ReturnType<typeof makeApi>>, n: number, code: string, name?: string) => t.call("POST", "/api/submit", { date: formatDay(DAY), replay: code, ...(name ? { name } : {}) }, as(n));

  it("répond avant le rejeu : le plafond de rejeux épuisé, le renvoi passe encore ; une autre course est refusée (503 busy)", async () => {
    const t = await makeApi({ replaysPerMinute: 1 });
    const premier = await envoyer(t, 1, rapide.code, "Alice");
    expect(premier.status).toBe(200);
    expect(premier.body.deja).toBeUndefined();
    const renvoi = await envoyer(t, 1, rapide.code);
    expect(renvoi.status).toBe(200);
    expect(renvoi.body).toMatchObject({ accepted: true, improved: false, deja: true, ms: premier.body.ms, splits: premier.body.splits, bestMs: premier.body.bestMs, rank: 1, participants: 1, medal: premier.body.medal });
    expect(renvoi.body.garage.nouvelles).toEqual([]);
    // Le plafond est bien épuisé : une course différente du même joueur doit être rejouée, donc refusée.
    const autre = await envoyer(t, 1, lente.code);
    expect(autre.status).toBe(503);
    expect(autre.body.error).toBe("busy");
    // Rien n'a été écrit de plus.
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM results"))!.n).toBe(1);
  });

  it("n'est répondu qu'au même joueur, pour la même course ; un code révoqué est toujours refusé", async () => {
    const t = await makeApi({ replaysPerMinute: 100, allowCopies: true });
    expect((await envoyer(t, 1, rapide.code, "Alice")).status).toBe(200);
    // Un autre joueur qui envoie le même texte n'a pas de résultat à lui : il est rejoué (et, copies permises ici, accepté comme avant).
    const bob = await envoyer(t, 2, rapide.code, "Bob");
    expect(bob.status).toBe(200);
    expect(bob.body.deja).toBeUndefined();
    expect(bob.body.improved).toBe(true);
  });
});

describe(`C5 — Jump : le renvoi déjà accepté (${TEST_DB})`, () => {
  const JOUR = daysFromCivil(2026, 10, 30);
  const NOON = parisDayStart(JOUR) + 12 * 3_600_000;
  let niveau: ReturnType<typeof dailyLevel>;
  let essais: string[];
  beforeAll(() => {
    niveau = dailyLevel(JOUR);
    const arrives = demoAttempts(niveau.level, niveau.replay, 0x5eed, { attempts: 40, reprise: repriseParPhase(niveau) }).filter((a) => a.end === "arrivée");
    essais = [];
    const vus = new Set<number>();
    for (const a of arrives) {
      const r = replayAttempt(niveau.level, a.replay, niveau.id);
      if (!r.finished || vus.has(r.time) || r.time <= niveau.authorTicks) continue;
      vus.add(r.time);
      essais.push(encodeJump(a.replay));
    }
    if (essais.length < 2) throw new Error("trop peu d'essais fictifs arrivent");
  }, 60_000);
  const corps = (code: string, extra: Record<string, unknown> = {}) => ({ levelId: niveau.id, simVersion: JUMP_SIM_VERSION, generatorVersion: JUMP_GENERATOR_VERSION, replay: code, ...extra });

  it("répond avant le rejeu, avec le résultat existant et deja: true ; une autre rediffusion passe par le plafond", async () => {
    const t = await makeApi({ seed: false, environment: "recette", replaysPerMinute: replayUnits(decodeJump(essais[0]!).runs) });
    t.clock.now = NOON;
    const premier = await t.call("POST", "/api/jump/submit", corps(essais[0]!, { name: "Alice" }), as(1));
    expect(premier.status, JSON.stringify(premier.body)).toBe(200);
    const renvoi = await t.call("POST", "/api/jump/submit", corps(essais[0]!), as(1));
    expect(renvoi.status).toBe(200);
    expect(renvoi.body).toMatchObject({ accepted: true, improved: false, deja: true, ticks: premier.body.ticks, deaths: premier.body.deaths, bestTicks: premier.body.bestTicks, medal: premier.body.medal, rank: 1, participants: 1 });
    expect(renvoi.body.board.me).toMatchObject({ rank: 1 });
    const autre = await t.call("POST", "/api/jump/submit", corps(essais[1]!), as(1));
    expect(autre.status).toBe(503);
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM jump_results"))!.n).toBe(1);
  });
});

describe(`C5 — Tower : le renvoi déjà accepté (${TEST_DB})`, () => {
  const JOUR = "2026-11-10";
  let code = "";
  let appels = 0;
  const executeur: ExecuteurRejeu = {
    async rejouer(d) {
      appels++;
      return rejouer(await chargerRapier(), d.contenu, d.rediffusion);
    },
  };
  beforeAll(async () => {
    const R = await chargerRapier();
    const { partie, code: c } = jouerScripte(R, dailyTower(D(JOUR), TOWER_GENERATOR_VERSION, 0), []);
    partie.dispose();
    code = c;
  }, 60_000);

  it("répond avant le rejeu (le fil de calcul n'est pas appelé) avec le résultat existant et deja: true", async () => {
    appels = 0;
    const t = await monterTower(JOUR, { executeur }, { replaysPerMinute: UNITES_REJEU_TOWER });
    const envoi = (n: number, extra: Record<string, unknown> = {}) => t.call("POST", "/api/tower/submit", { replay: code, ...extra }, as(n));
    const premier = await envoi(1, { name: "Alice" });
    expect(premier.status, JSON.stringify(premier.body)).toBe(200);
    expect(appels).toBe(1);
    const renvoi = await envoi(1);
    expect(renvoi.status).toBe(200);
    expect(appels).toBe(1); // aucun rejeu de plus
    expect(renvoi.body).toMatchObject({ accepted: true, improved: false, deja: true, rank: 1, participants: 1, best: premier.body.best, medal: premier.body.medal });
    expect(renvoi.body.resultat).toMatchObject({ hauteurMm: premier.body.resultat.hauteurMm, hauteurMaxMm: premier.body.resultat.hauteurMaxMm, vies: premier.body.resultat.vies, ticks: premier.body.resultat.ticks });
    // Le plafond (une seule partie) est épuisé : le renvoi de ce texte n'en demande pas, un autre joueur oui.
    const autre = await envoi(2, { name: "Bob" });
    expect(autre.status).toBe(503);
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM tower_results"))!.n).toBe(1);
  });
});
