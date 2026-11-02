import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FICTIONAL_NAMES } from "@cdj/sim";
import { PREMIER_JOUR_TOWER } from "@cdj/tower-sim";
import { AMIS_DEMO, AMIS_DEMO_RECIPROQUES, seedAmisDemo } from "../scripts/amisDemo";
import { CLASSEMENT_DEMO_NOMS } from "../src/classementDemo";
import { fictionalId } from "../src/history";
import { DEMO_JOUEUR_ID, DEMO_JOUEUR_NOM } from "../src/portailDemo";
import { nameKey } from "../src/pseudos";
import { refOfPlayer } from "../src/players";
import { makeApi, TEST_DB, type TestApi } from "./helpers";

// Lot F2 — les amis du joueur de démonstration de la recette (`recette:seed`) : 5 amis dont 3 réciproques et 1 qui n'a pas joué aujourd'hui ; relancé, il n'écrit rien ; « Démo » (effacé puis recréé
// chaque jour) et les joueurs du classement perdent leurs amitiés avec leur profil, le script les recrée. Jamais en production : aucun module du serveur ne l'importe.
const JOUR = PREMIER_JOUR_TOWER + 8;

async function joueur(t: TestApi, id: string, nom: string, jour: number | null): Promise<void> {
  await t.db.run("INSERT OR IGNORE INTO players (id, name, created_at, updated_at, name_key, ref, demo) VALUES (?, ?, 0, 0, ?, ?, 1)", [id, nom, nameKey(nom), await refOfPlayer(id)]);
  if (jour !== null) await t.db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (?, ?, 30000, '[]', 'x', 0, 1000)", [jour, id]);
}
const amisDe = async (t: TestApi, id: string) => (await t.db.all<{ ami: string }>("SELECT ami FROM amities WHERE joueur = ?", [id])).map((r) => r.ami);

describe(`amis de « Démo » pour la recette (${TEST_DB})`, () => {
  it("5 amis (4 du classement du jour, 1 qui n'a pas joué aujourd'hui), 3 réciproques ; rejoué : rien d'écrit ; amitiés perdues avec un profil recréé : recréées", { timeout: 60_000 }, async () => {
    const t = await makeApi({ seed: false });
    await t.call("GET", "/api/health");
    await joueur(t, DEMO_JOUEUR_ID, DEMO_JOUEUR_NOM, JOUR);
    for (const nom of CLASSEMENT_DEMO_NOMS) await joueur(t, fictionalId(nom), nom, JOUR);
    const absent = FICTIONAL_NAMES[3]!;
    await joueur(t, fictionalId(absent), absent, JOUR - 1); // des résultats les jours d'avant, aucun aujourd'hui
    const r = await seedAmisDemo({ db: t.db, today: JOUR });
    expect(r.deja).toBe(false);
    expect(r.absent).toBe(absent);
    expect(r.amis).toHaveLength(AMIS_DEMO);
    expect(r.reciproques).toHaveLength(AMIS_DEMO_RECIPROQUES);
    const ids = await amisDe(t, DEMO_JOUEUR_ID);
    expect(ids.sort()).toEqual(r.amis.map(fictionalId).sort());
    // Les réciproques ont « Démo » pour ami ; les autres non.
    const retour = await t.db.all<{ joueur: string }>("SELECT joueur FROM amities WHERE ami = ?", [DEMO_JOUEUR_ID]);
    expect(retour.map((x) => x.joueur).sort()).toEqual(r.reciproques.map(fictionalId).sort());
    // Celui qui n'a pas joué aujourd'hui n'a aucun résultat du jour ; les autres en ont.
    expect(await t.db.first("SELECT 1 AS x FROM results WHERE player_id = ? AND day = ?", [fictionalId(absent), JOUR])).toBeNull();
    // La liste vue par « Démo » (vraie route).
    const liste = await t.call("GET", "/api/amis", undefined, { headers: { "X-Player-Id": DEMO_JOUEUR_ID }, clientKey: "192.0.2.50" });
    expect(liste.body.total).toBe(5);
    expect(liste.body.amis.filter((a: { reciproque: boolean }) => a.reciproque)).toHaveLength(3);
    // Relancé : constaté, rien d'écrit.
    const avant = await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM amities");
    const encore = await seedAmisDemo({ db: t.db, today: JOUR });
    expect(encore.deja).toBe(true);
    expect(await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM amities")).toEqual(avant);
    // « Démo » est effacé puis recréé (son effacement supprime ses amitiés dans les deux sens) : le script les refait.
    await t.db.run("DELETE FROM amities WHERE joueur = ? OR ami = ?", [DEMO_JOUEUR_ID, DEMO_JOUEUR_ID]);
    expect((await seedAmisDemo({ db: t.db, today: JOUR })).deja).toBe(false);
    expect(await amisDe(t, DEMO_JOUEUR_ID)).toHaveLength(5);
  });

  it("sans « Démo » ou sans joueurs du classement : rien n'est créé, sans erreur", async () => {
    const t = await makeApi({ seed: false });
    await t.call("GET", "/api/health");
    expect((await seedAmisDemo({ db: t.db, today: JOUR })).amis).toEqual([]);
    await joueur(t, DEMO_JOUEUR_ID, DEMO_JOUEUR_NOM, JOUR);
    expect((await seedAmisDemo({ db: t.db, today: JOUR })).amis).toEqual([]);
    expect(await t.db.first("SELECT 1 AS x FROM amities")).toBeNull();
  });

  it("aucun module du serveur (apps/api/src) n'importe les amis de démonstration : seul `recette:seed` les crée", () => {
    const dir = new URL("../src/", import.meta.url);
    const fautifs = readdirSync(dir).filter((f) => f.endsWith(".ts") && /amisDemo/.test(readFileSync(new URL(f, dir), "utf8")));
    expect(fautifs).toEqual([]);
    expect(readFileSync(new URL("../scripts/recette-seed.ts", import.meta.url), "utf8")).toContain("seedAmisDemo");
  });
});
