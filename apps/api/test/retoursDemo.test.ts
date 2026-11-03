import { describe, expect, it } from "vitest";
import { PREMIER_JOUR_TOWER } from "@cdj/tower-sim";
import { RETOURS_DEMO, seedRetoursDemo } from "../scripts/retoursDemo";
import { CLASSEMENT_DEMO_NOMS } from "../src/classementDemo";
import { fictionalId } from "../src/history";
import { DEMO_JOUEUR_ID, DEMO_JOUEUR_NOM } from "../src/portailDemo";
import { nameKey } from "../src/pseudos";
import { refOfPlayer } from "../src/players";
import { makeApi, TEST_DB, type TestApi } from "./helpers";

// Lot C1 — les trois retours de la recette (`recette:seed`) : par le vrai serveur, dont un avec la réponse de l'éditeur à lire ; relancé, il n'écrit rien. Jamais en production : aucun module du serveur ne l'importe.
const JOUR = PREMIER_JOUR_TOWER + 8;
async function joueur(t: TestApi, id: string, nom: string): Promise<void> {
  await t.db.run("INSERT OR IGNORE INTO players (id, name, created_at, updated_at, name_key, ref, demo) VALUES (?, ?, 0, 0, ?, ?, 1)", [id, nom, nameKey(nom), await refOfPlayer(id)]);
}

describe(`retours de la recette (${TEST_DB})`, () => {
  it("3 retours, celui de « Démo » avec la réponse de l'éditeur qui attend ; rejoué : rien d'écrit ; sans « Démo » : rien", { timeout: 60_000 }, async () => {
    const t = await makeApi({ seed: false });
    await t.call("GET", "/api/health");
    expect(await seedRetoursDemo({ db: t.db, today: JOUR })).toEqual({ deja: false, crees: 0 });
    await joueur(t, DEMO_JOUEUR_ID, DEMO_JOUEUR_NOM);
    for (const nom of CLASSEMENT_DEMO_NOMS) await joueur(t, fictionalId(nom), nom);
    expect(await seedRetoursDemo({ db: t.db, today: JOUR })).toEqual({ deja: false, crees: RETOURS_DEMO });
    const fils = await t.db.all<{ player_id: string; statut: string; non_lu_joueur: number; nb_messages: number }>("SELECT player_id, statut, non_lu_joueur, nb_messages FROM retours ORDER BY id");
    expect(fils).toHaveLength(3);
    expect(fils[0]).toEqual({ player_id: DEMO_JOUEUR_ID, statut: "lu", non_lu_joueur: 1, nb_messages: 2 });
    expect(fils.slice(1).every((f) => f.statut === "nouveau" && f.nb_messages === 1)).toBe(true);
    // La pastille de l'avatar de « Démo » : une réponse attend.
    expect((await t.call("GET", "/api/retours", undefined, { headers: { "X-Player-Id": DEMO_JOUEUR_ID } })).body.nonLus).toBe(1);
    const avant = await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM retours_messages");
    expect(await seedRetoursDemo({ db: t.db, today: JOUR })).toEqual({ deja: true, crees: 0 });
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM retours_messages"))!.n).toBe(avant!.n);
  });
});
