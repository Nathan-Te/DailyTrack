import { describe, expect, it } from "vitest";
import { PREMIER_JOUR_TOWER } from "@cdj/tower-sim";
import { GROUPES_DEMO, seedGroupesDemo } from "../scripts/groupesDemo";
import { CLASSEMENT_DEMO_NOMS } from "../src/classementDemo";
import { fictionalId } from "../src/history";
import { DEMO_JOUEUR_ID, DEMO_JOUEUR_NOM } from "../src/portailDemo";
import { nameKey } from "../src/pseudos";
import { refOfPlayer } from "../src/players";
import { makeApi, TEST_DB, type TestApi } from "./helpers";

// Lot C1, partie C — les trois groupes de la recette (`recette:seed`) : par le vrai serveur ; relancé, il n'écrit rien ; sans « Démo » ou sans les joueurs du classement : rien. Jamais en production.
const JOUR = PREMIER_JOUR_TOWER + 8;
async function joueur(t: TestApi, id: string, nom: string): Promise<void> {
  await t.db.run("INSERT OR IGNORE INTO players (id, name, created_at, updated_at, name_key, ref, demo) VALUES (?, ?, 0, 0, ?, ?, 1)", [id, nom, nameKey(nom), await refOfPlayer(id)]);
}

describe(`groupes de la recette (${TEST_DB})`, () => {
  it("3 groupes, leurs membres comptent dès aujourd'hui ; rejoué : rien d'écrit ; sans les joueurs : rien", { timeout: 60_000 }, async () => {
    const t = await makeApi({ seed: false });
    await t.call("GET", "/api/health");
    expect(await seedGroupesDemo({ db: t.db, today: JOUR })).toEqual({ deja: false, crees: 0 });
    await joueur(t, DEMO_JOUEUR_ID, DEMO_JOUEUR_NOM);
    expect(await seedGroupesDemo({ db: t.db, today: JOUR })).toEqual({ deja: false, crees: 0 }); // il manque les joueurs du classement
    for (const nom of CLASSEMENT_DEMO_NOMS) await joueur(t, fictionalId(nom), nom);
    expect(await seedGroupesDemo({ db: t.db, today: JOUR })).toEqual({ deja: false, crees: GROUPES_DEMO.length });
    const groupes = await t.db.all<{ name: string; avatar: string | null }>("SELECT name, avatar FROM groupes ORDER BY name");
    expect(groupes.map((g) => g.name)).toEqual(["Les Deux", "Les Noctambules", "Les Rapides"]);
    expect(groupes.find((g) => g.name === "Les Rapides")!.avatar).toMatch(/^[0-9a-f]{16}$/);
    const noct = await t.call("GET", "/api/groupes/moi", undefined, { headers: { "X-Player-Id": DEMO_JOUEUR_ID } });
    expect(noct.body.groupe).toMatchObject({ nom: "Les Noctambules", chef: true });
    expect(noct.body.groupe.membres).toHaveLength(4);
    expect((await t.db.all<{ arrivee: number }>("SELECT DISTINCT arrivee FROM groupe_membres")).map((r) => r.arrivee)).toEqual([JOUR - 1]);
    expect(await seedGroupesDemo({ db: t.db, today: JOUR })).toEqual({ deja: true, crees: 0 });
  });
});
