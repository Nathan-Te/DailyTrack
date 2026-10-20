import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { daysFromCivil } from "@cdj/core";
import { CLASSEMENT_DEMO_NOMS, seedClassementDemo } from "../src/classementDemo";
import { makeApi, parisDayStart, TEST_DB } from "./helpers";

// Lot I3 (plateforme) : les joueurs de démonstration du classement du jour, créés par `recette:seed` seulement, par le vrai `createApi`. Une vingtaine
// de joueurs aux résultats variés dans les deux jeux ; quelques-uns n'ont fini qu'un jeu ; effacés puis recréés à chaque passage.

const TODAY = daysFromCivil(2026, 10, 20);
const levelsDir = new URL("../../jump/public/levels/", import.meta.url);
const frozen: Record<string, unknown> = {};
for (const f of readdirSync(levelsDir)) {
  const date = /^(\d{4}-\d{2}-\d{2})\.json$/.exec(f)?.[1];
  if (date) frozen[date] = JSON.parse(readFileSync(new URL(f, levelsDir), "utf8"));
}

describe(`joueurs de démonstration du classement du jour (${TEST_DB})`, () => {
  it("une vingtaine de joueurs, des médailles variées dans les deux jeux, des cases vides ; repasser le script recrée les mêmes", async () => {
    const t = await makeApi({ seed: false });
    const first = await seedClassementDemo({ db: t.db, frozen, today: TODAY });
    expect(first.refus).toEqual([]);
    expect(first.joueurs).toBe(20);
    t.clock.now = parisDayStart(TODAY) + 15 * 3_600_000;
    const r = await t.call("GET", "/api/portail/classement");
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.classes).toBe(20);
    const lignes = r.body.top as { points: number; resultats: Record<string, { medaille: string | null } | null> }[];
    // Variété : au moins trois totaux différents, au moins trois médailles différentes (hors « aucune »), des cases vides dans chaque jeu.
    expect(new Set(lignes.map((l) => l.points)).size).toBeGreaterThanOrEqual(3);
    const medailles = new Set(lignes.flatMap((l) => Object.values(l.resultats).map((x) => x?.medaille ?? null)));
    expect([...medailles].filter((m) => m !== null).length).toBeGreaterThanOrEqual(2);
    expect(lignes.some((l) => l.resultats.cdj === null)).toBe(true);
    expect(lignes.some((l) => l.resultats.jump === null)).toBe(true);
    expect(lignes.some((l) => l.resultats.cdj && l.resultats.jump)).toBe(true);
    // Trois jours : hier et avant-hier ont aussi leur classement.
    expect((await t.call("GET", `/api/portail/classement?date=2026-10-19`)).body.classes).toBeGreaterThanOrEqual(15);
    // Le script repasse (chaque jour) : les mêmes joueurs, sans doublon.
    const second = await seedClassementDemo({ db: t.db, frozen, today: TODAY });
    expect(second.effaces).toBe(20);
    expect(second.refus).toEqual([]);
    t.clock.now += 120_000;
    expect((await t.call("GET", "/api/portail/classement")).body.classes).toBe(20);
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM players"))!.n).toBe(CLASSEMENT_DEMO_NOMS.length);
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM players WHERE demo = 1"))!.n).toBe(CLASSEMENT_DEMO_NOMS.length);
  }, 300_000);

  it("ils n'existent qu'en recette : aucun module du serveur ne les importe, seul `recette:seed` les crée", () => {
    const src = new URL("../src/", import.meta.url);
    const importers = readdirSync(src).filter((f) => f.endsWith(".ts") && f !== "classementDemo.ts" && readFileSync(new URL(f, src), "utf8").includes("classementDemo"));
    expect(importers).toEqual([]);
    const seed = readFileSync(new URL("../scripts/recette-seed.ts", import.meta.url), "utf8");
    expect(seed).toContain("seedClassementDemo");
    expect(seed).toContain("recetteSeedTarget(process.env)");
  });
});
