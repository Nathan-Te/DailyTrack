import { describe, expect, it } from "vitest";
import { PREMIER_JOUR_TOWER } from "@cdj/tower-sim";
import { IMAGES_DEMO, seedAvatarsDemo } from "../scripts/avatarsDemo";
import { CLASSEMENT_DEMO_NOMS } from "../src/classementDemo";
import { fictionalId } from "../src/history";
import { controlerImage, octetsDeBase64 } from "../src/imagesAvatar";
import { DEMO_JOUEUR_ID, DEMO_JOUEUR_NOM } from "../src/portailDemo";
import { nameKey } from "../src/pseudos";
import { refOfPlayer } from "../src/players";
import { makeApi, TEST_DB, type TestApi } from "./helpers";

// Lot C1, partie B — les quatre images de la recette (`recette:seed`) : par le vrai serveur (donc par sa validation) ; relancé, il n'écrit rien. Jamais en production.
const JOUR = PREMIER_JOUR_TOWER + 8;
async function joueur(t: TestApi, id: string, nom: string): Promise<void> {
  await t.db.run("INSERT OR IGNORE INTO players (id, name, created_at, updated_at, name_key, ref, demo) VALUES (?, ?, 0, 0, ?, ?, 1)", [id, nom, nameKey(nom), await refOfPlayer(id)]);
}

describe(`images de la recette (${TEST_DB})`, () => {
  it("les images du seed passent la validation du serveur ; 4 joueurs en ont une ; rejoué : rien d'écrit ; sans « Démo » : rien", { timeout: 60_000 }, async () => {
    for (const b of IMAGES_DEMO) expect(controlerImage(octetsDeBase64(b)!)).toMatchObject({ mime: "image/webp", largeur: 64, hauteur: 64 });
    const t = await makeApi({ seed: false });
    await t.call("GET", "/api/health");
    expect(await seedAvatarsDemo({ db: t.db, today: JOUR })).toEqual({ deja: false, crees: 0 });
    await joueur(t, DEMO_JOUEUR_ID, DEMO_JOUEUR_NOM);
    for (const nom of CLASSEMENT_DEMO_NOMS) await joueur(t, fictionalId(nom), nom);
    expect(await seedAvatarsDemo({ db: t.db, today: JOUR })).toEqual({ deja: false, crees: 4 });
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM avatars WHERE kind = 'joueur' AND statut = 'visible'"))!.n).toBe(4);
    expect(await seedAvatarsDemo({ db: t.db, today: JOUR })).toEqual({ deja: true, crees: 0 });
  });
});
