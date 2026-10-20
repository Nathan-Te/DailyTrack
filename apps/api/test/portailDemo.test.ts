import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { decodeTransfer } from "@cdj/profile";
import { DEMO_JOUEUR_CODE, DEMO_JOUEUR_ID, DEMO_MORTS, seedPortailDemo } from "../src/portailDemo";
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
    expect(r.body.joueur).toEqual({ pseudo: "Démo", serie: 5, aProlonger: false, journeesParfaites: 2, aujourdhuiParfaite: false, points: 3, rangDuJour: 1, classesDuJour: 1 }); // lot I3 : l'or de Track = 3 points
    expect(r.body.jeux[0].etat).toMatchObject({ statut: "fini", medaille: "gold", rang: 1 });
    expect(r.body.jeux[1].etat).toEqual({ statut: "en_cours", morts: DEMO_MORTS });
    expect(await t.db.first("SELECT demo FROM players WHERE id = ?", [DEMO_JOUEUR_ID])).toEqual({ demo: 1 });
    // Le lendemain, le script repasse (recette-seed.yml, chaque jour) : effacé puis recréé, la série reste de 5 jours.
    await seedPortailDemo({ db: t.db, frozen, today: TODAY + 1 });
    t.clock.now = parisDayStart(TODAY + 1) + 15 * 3_600_000;
    r = await t.call("GET", "/api/portail/jour", undefined, as);
    expect(r.body.joueur).toMatchObject({ serie: 5, journeesParfaites: 2 });
    expect(r.body.jeux[1].etat).toEqual({ statut: "en_cours", morts: DEMO_MORTS });
  }, 120_000);

  it("son code de transfert est un vrai code CDJ2 ; il n'existe qu'en recette (aucun module du serveur de production ne l'importe)", () => {
    expect(decodeTransfer(DEMO_JOUEUR_CODE)).toMatchObject({ ok: true, data: { id: DEMO_JOUEUR_ID } });
    const src = new URL("../src/", import.meta.url);
    const importers = readdirSync(src).filter((f) => f.endsWith(".ts") && f !== "portailDemo.ts" && readFileSync(new URL(f, src), "utf8").includes("portailDemo"));
    expect(importers).toEqual([]);
    expect(readFileSync(new URL("../scripts/recette-seed.ts", import.meta.url), "utf8")).toContain("seedPortailDemo");
    expect(readFileSync(new URL("../scripts/recette-seed.ts", import.meta.url), "utf8")).toContain("recetteSeedTarget(process.env)");
  });
});
