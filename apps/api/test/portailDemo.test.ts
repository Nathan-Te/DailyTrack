import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { decodeTransfer } from "@cdj/profile";
import { BASCULE_LOT_35, dailyCircuit, medalFor, medalsFor, runPilot } from "@cdj/sim";
import { DEMO_GARAGE, DEMO_JOUEUR_CODE, DEMO_JOUEUR_ID, DEMO_MORTS, planGarage, seedPortailDemo } from "../src/portailDemo";
import { makeApi, parisDayStart, TEST_DB } from "./helpers";

// Lot I2 (plateforme) : le joueur de démonstration du portail (« Démo »), créé par `recette:seed` seulement, par le vrai `createApi`. Son
// portail : série de 5 jours, 2 journées parfaites, Track fini (or) et Jump en cours aujourd'hui ; repasser le script ne l'allonge pas.

const TODAY = daysFromCivil(2026, 10, 20);
const levelsDir = new URL("../../jump/public/levels/", import.meta.url);
const frozen: Record<string, unknown> = {};
for (const f of readdirSync(levelsDir)) {
  const date = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1];
  if (date) frozen[date] = JSON.parse(readFileSync(new URL(f, levelsDir), "utf8"));
}

describe(`joueur de démonstration du portail (${TEST_DB})`, () => {
  it("série de 5 jours, 2 journées parfaites, Track fini (or) et Jump en cours aujourd'hui ; le lendemain du passage suivant, toujours 5", async () => {
    const t = await makeApi({ seed: false });
    await seedPortailDemo({ db: t.db, frozen, today: TODAY });
    t.clock.now = parisDayStart(TODAY) + 15 * 3_600_000;
    const as = { headers: { "X-Player-Id": DEMO_JOUEUR_ID } };
    let r = await t.call("GET", "/api/portail/jour", undefined, as);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.joueur).toEqual({ pseudo: "Démo", serie: 5, aProlonger: false, journeesParfaites: 2, aujourdhuiParfaite: false, cumulMs: null, rangDuJour: 1, classesDuJour: 1 }); // lot A1 : Jump n'est pas fini, pas de temps cumulé
    expect(r.body.jeux[0].etat).toMatchObject({ statut: "fini", medaille: "gold", rang: 1 });
    expect(r.body.jeux[1].etat).toEqual({ statut: "en_cours", morts: DEMO_MORTS });
    expect(await t.db.first("SELECT demo FROM players WHERE id = ?", [DEMO_JOUEUR_ID])).toEqual({ demo: 1 });
    // Son Garage sur la recette : les dix voitures (`garageOuvert`, cdj.ts) ; hors de la recette, seulement ce qu'il a gagné.
    const recette = await makeApi({ db: t.db, seed: false, environment: "recette" });
    recette.clock.now = t.clock.now;
    expect((await recette.call("GET", "/api/garage", undefined, as)).body.voitures.every((v: { debloquee: boolean }) => v.debloquee)).toBe(true);
    expect((await t.call("GET", "/api/garage", undefined, as)).body.voitures.some((v: { debloquee: boolean }) => !v.debloquee)).toBe(true);
    // Le lendemain, le script repasse (recette-seed.yml, chaque jour) : effacé puis recréé, la série reste de 5 jours.
    await seedPortailDemo({ db: t.db, frozen, today: TODAY + 1 });
    t.clock.now = parisDayStart(TODAY + 1) + 15 * 3_600_000;
    r = await t.call("GET", "/api/portail/jour", undefined, as);
    expect(r.body.joueur).toMatchObject({ serie: 5, journeesParfaites: 2 });
    expect(r.body.jeux[1].etat).toEqual({ statut: "en_cours", morts: DEMO_MORTS });
  }, 120_000);

  it("à partir de la bascule des médailles (28/10/2026, lot 35), le joueur est jugé avec les seuils du jour : le pilote n'atteint plus de médaille, il envoie sa course la plus rapide", async () => {
    const t = await makeApi({ seed: false });
    const today = BASCULE_LOT_35 + 2; // 30/10/2026 : les cinq jours courent du 26/10, avant puis après la bascule
    const report = await seedPortailDemo({ db: t.db, frozen, today });
    expect(report.track).toHaveLength(5);
    for (const [i, j] of report.track.entries()) {
      const day = today - 4 + i;
      const circuit = dailyCircuit(day);
      // La médaille du rapport est celle des seuils du jour (celle que le serveur rejoue), jamais celle des seuils d'avant la bascule.
      expect(j.medal, j.date).toBe(medalFor(j.ms, medalsFor(circuit.authorMs, day)));
      if (day < BASCULE_LOT_35) expect(j.medal, `${j.date} : avant la bascule, une médaille`).not.toBeNull();
      else {
        // Les seuils du jour sont sous le temps du pilote : aucune médaille, et la course choisie est la plus rapide du pilote (et non la première qui était « en or » avec les anciens seuils).
        expect(medalsFor(circuit.authorMs, day).gold, j.date).toBeLessThan(runPilot(circuit.track, { grip: 1.5, look: 0.45 }).finishMs);
        expect(j.ms, `${j.date} : la course la plus rapide, pas celle de l'ancien réglage`).toBeLessThan(runPilot(circuit.track, { grip: 0.98 }).finishMs);
        expect(j.medal, j.date).toBeNull();
      }
    }
    t.clock.now = parisDayStart(today) + 15 * 3_600_000;
    const r = await t.call("GET", "/api/portail/jour", undefined, { headers: { "X-Player-Id": DEMO_JOUEUR_ID } });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.jeux[0].etat).toMatchObject({ statut: "fini", medaille: null });
    expect(r.body.joueur).toMatchObject({ pseudo: "Démo", serie: 5 });
  }, 180_000);

  // Lot de plateforme « suites de Track 2 » : le Garage de « Démo » ne dépend plus de la date. Sparrow (civile), Pelican (fourgon), Weasel (evolution) et Badger (rallye)
  // débloquées, le reste en progression, avant comme après la bascule des médailles (28/10/2026) ; de vraies rediffusions, rejouées par le serveur (rien n'est posé à la main).
  // Sur un serveur ordinaire (ni recette ni production) : le raccourci de la recette (`garageOuvert`, les dix voitures) n'y est pas, c'est la vraie progression qui parle.
  describe("Garage : les quatre voitures débloquées, le reste en progression, à toute date", () => {
    const dates: [string, number][] = [
      ["24/10/2026 (avant la bascule)", daysFromCivil(2026, 10, 24)],
      ["27/10/2026 (la veille)", BASCULE_LOT_35 - 1],
      ["28/10/2026 (la bascule)", BASCULE_LOT_35],
      ["30/10/2026 (la série a perdu trois ors)", BASCULE_LOT_35 + 2],
      ["1/11/2026 (la série n'a plus d'or)", BASCULE_LOT_35 + 4],
      ["15/11/2026 (loin après)", BASCULE_LOT_35 + 18],
    ];
    for (const [libelle, today] of dates)
      it(libelle, async () => {
        const t = await makeApi({ seed: false });
        const report = await seedPortailDemo({ db: t.db, frozen, today, sansJump: true });
        t.clock.now = parisDayStart(today) + 15 * 3_600_000;
        const as = { headers: { "X-Player-Id": DEMO_JOUEUR_ID } };
        const g = await t.call("GET", "/api/garage", undefined, as);
        expect(g.status, JSON.stringify(g.body)).toBe(200);
        const debloquees = g.body.voitures.filter((v: { debloquee: boolean }) => v.debloquee).map((v: { id: string }) => v.id);
        expect(debloquees, JSON.stringify(g.body.progres)).toEqual(["civile", "fourgon", "evolution", "rallye"]);
        // Le reste est en progression : ni le pick-up (ors), ni la Moray, ni le proto (auteur : jamais une médaille d'auteur), ni la muscle car, ni la monoplace.
        expect(g.body.progres.auteur).toBe(0);
        expect(g.body.progres.or).toBeGreaterThanOrEqual(DEMO_GARAGE.ors);
        expect(g.body.progres.jours).toBeGreaterThanOrEqual(DEMO_GARAGE.jours);
        const restantes = g.body.voitures.filter((v: { debloquee: boolean }) => !v.debloquee);
        expect(restantes).toHaveLength(6);
        for (const v of restantes) expect(v.progres.fait, v.id).toBeLessThan(v.progres.nombre);
        expect(restantes.filter((v: { progres: { fait: number } }) => v.progres.fait > 0).length, "de quoi voir une progression").toBeGreaterThanOrEqual(3);
        // Ce sont de vraies rediffusions : chaque jour du rapport a le temps rejoué par le serveur, et les jours en plus sont d'avant la bascule, loin de la série.
        expect(report.track).toHaveLength(5);
        for (const j of report.garage) expect(j.medal === "gold" || j.medal === "silver" || j.medal === "bronze" || j.medal === null, j.date).toBe(true);
        const plan = planGarage(today);
        expect(report.garage.length, "les jours en plus du plan").toBe(plan.ors + plan.sansOr);
        expect(report.garage.filter((j) => j.medal === "gold")).toHaveLength(plan.ors);
        // Les ors ne manquent jamais : ceux de la série d'avant la bascule et ceux des jours en plus.
        expect(plan.orsDeLaSerie + plan.ors).toBeGreaterThanOrEqual(DEMO_GARAGE.ors);
        // La série reste de cinq jours (les jours en plus ne la touchent pas), la médaille d'aujourd'hui est celle des seuils du jour.
        const r = await t.call("GET", "/api/portail/jour", undefined, as);
        expect(r.status, JSON.stringify(r.body)).toBe(200);
        expect(r.body.joueur).toMatchObject({ pseudo: "Démo", serie: 5 });
        if (today < BASCULE_LOT_35) expect(r.body.jeux[0].etat).toMatchObject({ statut: "fini", medaille: "gold" });
      }, 120_000);

    it("le plan : jamais collé à la série, jamais après la bascule", () => {
      for (let today = daysFromCivil(2026, 10, 24); today < BASCULE_LOT_35 + 30; today++) {
        const p = planGarage(today);
        expect(p.serie).toHaveLength(5);
        expect(p.depart, `${today}`).toBeLessThan(p.serie[0]! - 1);
        expect(p.depart, `${today}`).toBeLessThan(BASCULE_LOT_35);
        expect(p.orsDeLaSerie + p.ors, `${today}`).toBeGreaterThanOrEqual(DEMO_GARAGE.ors);
        expect(5 + p.ors + p.sansOr, `${today}`).toBeGreaterThanOrEqual(DEMO_GARAGE.jours);
      }
    });
  });

  it("son code de transfert est un vrai code CDJ2 ; il n'existe qu'en recette (aucun module du serveur de production ne l'importe)", () => {
    expect(decodeTransfer(DEMO_JOUEUR_CODE)).toMatchObject({ ok: true, data: { id: DEMO_JOUEUR_ID } });
    const src = new URL("../src/", import.meta.url);
    const importers = readdirSync(src).filter((f) => f.endsWith(".ts") && f !== "portailDemo.ts" && readFileSync(new URL(f, src), "utf8").includes("portailDemo"));
    expect(importers).toEqual([]);
    expect(readFileSync(new URL("../scripts/recette-seed.ts", import.meta.url), "utf8")).toContain("seedPortailDemo");
    expect(readFileSync(new URL("../scripts/recette-seed.ts", import.meta.url), "utf8")).toContain("recetteSeedTarget(process.env)");
  });
});
