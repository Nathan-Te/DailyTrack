import { describe, expect, it } from "vitest";
import { formatDay } from "@cdj/core";
import { PREMIER_JOUR_TOWER } from "@cdj/tower-sim";
import { GROUPE_MEMBRES_MAX, descriptionDeGroupe, nomDeGroupe } from "../src/groupes";
import { nameKey } from "../src/pseudos";
import { refOfPlayer } from "../src/players";
import { ADMIN_EMAIL, CLIENT_ID, SESSION_KEY } from "./adminHelpers";
import { makeApi, ouvrirJeu, parisDayStart, playerId, TEST_DB, type TestApi } from "./helpers";

// Lot C1, partie C — les groupes : la création et ses règles, le lien d'invitation (renouvelé : l'ancien meurt), les 30 membres, le chef (retirer, passer, renommer une fois par semaine, dissoudre), le départ
// (le plus ancien devient chef, ou le groupe est dissous), l'emblème, le classement des groupes (moyenne des 3 meilleurs, « moins de 3 classés », le lendemain de l'arrivée, un membre parti, un masqué),
// le filtre « Mon groupe », l'effacement d'un profil, l'administration. Les résultats sont écrits en base ; la lecture est la vraie. SQLite et libSQL (`file:`).

const JOUR = PREMIER_JOUR_TOWER + 8;
const DATE = formatDay(JOUR);
const MIDI = parisDayStart(JOUR) + 12 * 3_600_000;
const ORIGIN = "http://api.test";
const OPTIONS_ADMIN = { emails: [ADMIN_EMAIL], sessionKey: SESSION_KEY, clientId: CLIENT_ID, fakeVerifier: true, releaseTag: "prod-2026-10-19-1830" };

let adresse = 0;
const ip = () => `198.53.${(adresse >> 8) & 255}.${adresse++ & 255}`;
const vu = (n: number | null): Record<string, string> => (n === null ? {} : { "X-Player-Id": playerId(n) });
const get = (t: TestApi, n: number | null, path: string) => t.call("GET", path, undefined, { headers: vu(n), clientKey: ip() });
const post = (t: TestApi, n: number | null, path: string, body: unknown = {}) => t.call("POST", path, body, { headers: vu(n), clientKey: ip() });
const del = (t: TestApi, n: number | null, path: string) => t.call("DELETE", path, undefined, { headers: vu(n), clientKey: ip() });

async function api(): Promise<TestApi> {
  const t = await makeApi({ seed: false, admin: OPTIONS_ADMIN });
  t.clock.now = MIDI;
  await t.call("GET", "/api/health");
  await ouvrirJeu(t, "track");
  await ouvrirJeu(t, "jump");
  await ouvrirJeu(t, "tower", JOUR - 3);
  return t;
}
async function joueur(t: TestApi, n: number, nom: string, hidden = 0): Promise<void> {
  const id = playerId(n);
  await t.db.run("INSERT OR IGNORE INTO players (id, name, created_at, updated_at, name_key, ref, hidden) VALUES (?, ?, 0, 0, ?, ?, ?)", [id, nom, nameKey(nom), await refOfPlayer(id), hidden]);
}
const refDe = (n: number) => refOfPlayer(playerId(n));
async function track(t: TestApi, n: number, ms: number): Promise<void> {
  await t.db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at, hidden) VALUES (?, ?, ?, '[]', 'x', 0, ?, 0)", [JOUR, playerId(n), ms, 1000 + n]);
}
async function jump(t: TestApi, n: number, ticks: number): Promise<void> {
  await t.db.run("INSERT INTO jump_results (day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at, hidden) VALUES (?, ?, 'x', ?, 0, 'x', 1, 1, 0, ?, 0)", [JOUR, playerId(n), ticks, 1000 + n]);
}
/** Les joueurs d'un groupe, créés par l'API (le premier en est le chef) puis comptés dès ce jour (l'arrivée est avancée à la veille). */
async function groupe(t: TestApi, nom: string, premier: number, autres: number[], description = ""): Promise<{ id: string; jeton: string }> {
  const c = await post(t, premier, "/api/groupes", { nom, description });
  expect(c.status, JSON.stringify(c.body)).toBe(200);
  const moi = (await get(t, premier, "/api/groupes/moi")).body.groupe;
  for (const n of autres) expect((await post(t, n, "/api/groupes/rejoindre", { jeton: moi.invitation })).status).toBe(200);
  await t.db.run("UPDATE groupe_membres SET arrivee = ? WHERE groupe = ?", [JOUR - 1, c.body.id]);
  return { id: c.body.id, jeton: moi.invitation };
}
const vue = async (t: TestApi, v: string) => (await get(t, null, `/api/groupes/classement?date=${DATE}&vue=${v}`)).body;
async function connecte(t: TestApi) {
  const r = await t.call("POST", "/api/admin/session", { credential: `factice:${ADMIN_EMAIL}` }, { headers: { Origin: ORIGIN, "X-Cdj-Admin": "1" } });
  const cookie = /__session=([^;]+)/.exec(r.headers.get("set-cookie") ?? "")![1]!;
  const headers = { Cookie: `__session=${cookie}`, Origin: ORIGIN, "X-Cdj-Admin": "1" };
  return (method: string, path: string, body?: unknown) => t.call(method, path, body, { headers });
}

describe("les règles du nom et de la description", () => {
  it("3 à 24 caractères, lettres, chiffres et ponctuation douce ; 140 caractères de texte", () => {
    expect(nomDeGroupe("Les Amis")).toBe("Les Amis");
    expect(nomDeGroupe("  Les   Amis ")).toBe("Les Amis");
    for (const mauvais of ["ab", "a".repeat(25), "<b>x</b>", "_nom", "Les Amis!", 12, null]) expect(nomDeGroupe(mauvais)).toBeNull();
    expect(descriptionDeGroupe(undefined)).toBe("");
    expect(descriptionDeGroupe("x".repeat(140))).toHaveLength(140);
    expect(descriptionDeGroupe("x".repeat(141))).toBeNull();
    expect(descriptionDeGroupe("a\u0007b")).toBeNull();
  });
});

describe(`groupes : créer, inviter, rejoindre, quitter (${TEST_DB})`, () => {
  it("créer : le créateur est chef ; le nom est unique (accents et casse), un seul groupe par joueur, le texte reste du texte", { timeout: 30_000 }, async () => {
    const t = await api();
    for (const n of [1, 2, 3]) await joueur(t, n, `Joueur${n}`);
    expect((await post(t, null, "/api/groupes", { nom: "Les Amis" })).status).toBe(400); // sans identifiant
    expect((await post(t, 1, "/api/groupes", { nom: "ab" })).body.error).toBe("invalid_group");
    expect((await post(t, 1, "/api/groupes", { nom: "Les Amis", description: "x".repeat(141) })).body.error).toBe("invalid_group");
    const c = await post(t, 1, "/api/groupes", { nom: "Les Amis", description: "<img src=x onerror=alert(1)>" });
    expect(c.status, JSON.stringify(c.body)).toBe(200);
    expect(c.body.id).toMatch(/^[0-9a-f]{12}$/);
    expect((await post(t, 2, "/api/groupes", { nom: "les AMIS" })).body.error).toBe("group_name_taken");
    expect((await post(t, 2, "/api/groupes", { nom: "Lés Amís" })).body.error).toBe("group_name_taken");
    expect((await post(t, 1, "/api/groupes", { nom: "Autre groupe" })).body.error).toBe("already_in_group");
    const moi = (await get(t, 1, "/api/groupes/moi")).body.groupe;
    expect(moi).toMatchObject({ nom: "Les Amis", chef: true, description: "<img src=x onerror=alert(1)>", max: GROUPE_MEMBRES_MAX });
    expect(moi.invitation).toMatch(/^[0-9a-f]{32}$/);
    expect(moi.membres).toHaveLength(1);
    expect((await get(t, 3, "/api/groupes/moi")).body).toEqual({ groupe: null });
    expect((await get(t, null, "/api/groupes/moi")).body).toEqual({ groupe: null });
    // La page publique, par le nom (sans identifiant) : ni lien d'invitation, ni identifiant secret.
    const page = await get(t, null, `/api/groupes/nom/${encodeURIComponent("les amis")}`);
    expect(page.status).toBe(200);
    expect(page.body.nom).toBe("Les Amis");
    const texte = JSON.stringify(page.body);
    expect(texte).not.toContain(moi.invitation);
    expect(texte).not.toMatch(/[0-9a-f]{32}/);
    expect((await get(t, null, "/api/groupes/nom/inconnu")).body.error).toBe("unknown_group");
  });

  it("le lien d'invitation : voir sans profil, rejoindre (compte dès le lendemain), le renouveler tue l'ancien (chef seulement), tout membre le montre", { timeout: 30_000 }, async () => {
    const t = await api();
    for (const n of [1, 2, 3, 4]) await joueur(t, n, `Joueur${n}`);
    await post(t, 1, "/api/groupes", { nom: "Les Amis" });
    const { invitation } = (await get(t, 1, "/api/groupes/moi")).body.groupe;
    const carte = await get(t, null, `/api/groupes/invitation/${invitation}`);
    expect(carte.body).toMatchObject({ nom: "Les Amis", membres: 1, max: 30, plein: false });
    expect((await get(t, null, `/api/groupes/invitation/${"0".repeat(32)}`)).body.error).toBe("unknown_group");
    expect((await get(t, null, "/api/groupes/invitation/nimporte")).body.error).toBe("unknown_group");
    const j = await post(t, 2, "/api/groupes/rejoindre", { jeton: invitation });
    expect(j.status, JSON.stringify(j.body)).toBe(200);
    expect(j.body.arrivee).toBe(formatDay(JOUR + 1)); // il compte à partir du lendemain
    expect((await post(t, 2, "/api/groupes/rejoindre", { jeton: invitation })).body.error).toBe("already_in_group");
    // Tout membre voit le lien (il peut le partager) ; le chef seul le renouvelle.
    expect((await get(t, 2, "/api/groupes/moi")).body.groupe).toMatchObject({ invitation, chef: false });
    expect((await post(t, 2, "/api/groupes/renouveler")).body.error).toBe("not_group_chief");
    const nouveau = (await post(t, 1, "/api/groupes/renouveler")).body.invitation;
    expect(nouveau).toMatch(/^[0-9a-f]{32}$/);
    expect(nouveau).not.toBe(invitation);
    expect((await post(t, 3, "/api/groupes/rejoindre", { jeton: invitation })).body.error).toBe("unknown_group"); // l'ancien lien est mort
    expect((await post(t, 3, "/api/groupes/rejoindre", { jeton: nouveau })).status).toBe(200);
    expect((await post(t, null, "/api/groupes/rejoindre", { jeton: nouveau })).status).toBe(400); // sans identifiant
  });

  it("30 membres au plus, vérifiés à l'écriture", { timeout: 60_000 }, async () => {
    const t = await api();
    await joueur(t, 1, "Chef");
    await post(t, 1, "/api/groupes", { nom: "Les Amis" });
    const { id, invitation } = (await get(t, 1, "/api/groupes/moi")).body.groupe;
    for (let n = 2; n <= 30; n++) {
      await joueur(t, n, `Joueur${n}`);
      await t.db.run("INSERT INTO groupe_membres (player_id, groupe, rejoint_le, arrivee) VALUES (?, ?, ?, 1)", [playerId(n), id, n]);
    }
    await joueur(t, 31, "Trente et un");
    const plein = await get(t, null, `/api/groupes/invitation/${invitation}`);
    expect(plein.body).toMatchObject({ membres: 30, plein: true });
    expect((await post(t, 31, "/api/groupes/rejoindre", { jeton: invitation })).body.error).toBe("group_full");
    expect((await get(t, 31, "/api/groupes/moi")).body).toEqual({ groupe: null });
  });

  it("quitter : un membre part ; le chef part → le plus ancien devient chef ; le dernier qui part dissout le groupe (et son emblème)", { timeout: 30_000 }, async () => {
    const t = await api();
    for (const n of [1, 2, 3]) await joueur(t, n, `Joueur${n}`);
    const g = await groupe(t, "Les Amis", 1, [2, 3]);
    await t.db.run("UPDATE groupe_membres SET rejoint_le = ? WHERE player_id = ?", [10, playerId(1)]);
    await t.db.run("UPDATE groupe_membres SET rejoint_le = ? WHERE player_id = ?", [20, playerId(2)]);
    await t.db.run("UPDATE groupe_membres SET rejoint_le = ? WHERE player_id = ?", [30, playerId(3)]);
    expect((await post(t, 3, "/api/groupes/quitter")).body).toEqual({ quitte: true, dissous: false });
    expect((await post(t, 3, "/api/groupes/quitter")).body.error).toBe("unknown_group");
    expect((await post(t, 1, "/api/groupes/quitter")).body).toEqual({ quitte: true, dissous: false });
    expect((await get(t, 2, "/api/groupes/moi")).body.groupe).toMatchObject({ chef: true }); // le plus ancien restant
    expect((await post(t, 2, "/api/groupes/quitter")).body).toEqual({ quitte: true, dissous: true });
    expect(await t.db.first("SELECT 1 AS x FROM groupes WHERE id = ?", [g.id])).toBeNull();
    expect((await get(t, null, "/api/groupes/nom/les%20amis")).body.error).toBe("unknown_group");
    expect(g.jeton).toBeTruthy();
  });
});

describe(`groupes : ce que fait le chef (${TEST_DB})`, () => {
  it("retirer un membre, passer le chef, décrire, dissoudre ; un membre ne peut rien de cela", { timeout: 30_000 }, async () => {
    const t = await api();
    for (const n of [1, 2, 3]) await joueur(t, n, `Joueur${n}`);
    await groupe(t, "Les Amis", 1, [2, 3]);
    const r2 = await refDe(2);
    const r3 = await refDe(3);
    for (const [chemin, corps] of [["retirer", { ref: r3 }], ["chef", { ref: r3 }], ["renommer", { nom: "Autre nom" }], ["decrire", { description: "x" }], ["dissoudre", {}], ["emblem", { image: "x" }]] as const) {
      expect((await post(t, 2, `/api/groupes/${chemin}`, corps)).body.error, chemin).toBe("not_group_chief");
    }
    expect((await post(t, 1, "/api/groupes/retirer", { ref: await refDe(1) })).body.error).toBe("invalid_group"); // pour partir : « Quitter »
    expect((await post(t, 1, "/api/groupes/retirer", { ref: "f".repeat(12) })).body.error).toBe("unknown_member");
    expect((await post(t, 1, "/api/groupes/retirer", { ref: r3 })).body).toEqual({ retire: true });
    expect((await get(t, 3, "/api/groupes/moi")).body).toEqual({ groupe: null });
    expect((await post(t, 1, "/api/groupes/decrire", { description: "Nous jouons le soir." })).body.description).toBe("Nous jouons le soir.");
    expect((await post(t, 1, "/api/groupes/chef", { ref: r2 })).body).toEqual({ chef: true });
    expect((await get(t, 2, "/api/groupes/moi")).body.groupe.chef).toBe(true);
    expect((await get(t, 1, "/api/groupes/moi")).body.groupe.chef).toBe(false);
    expect((await post(t, 1, "/api/groupes/dissoudre")).body.error).toBe("not_group_chief");
    expect((await post(t, 2, "/api/groupes/dissoudre")).body).toEqual({ dissous: true });
    expect((await get(t, 1, "/api/groupes/moi")).body).toEqual({ groupe: null });
  });

  it("renommer : une fois par semaine (Retry-After), nom libre seulement", { timeout: 30_000 }, async () => {
    const t = await api();
    for (const n of [1, 2]) await joueur(t, n, `Joueur${n}`);
    await groupe(t, "Les Amis", 1, []);
    await post(t, 2, "/api/groupes", { nom: "Les Autres" });
    expect((await post(t, 1, "/api/groupes/renommer", { nom: "Les Autres" })).body.error).toBe("group_name_taken");
    expect((await post(t, 1, "/api/groupes/renommer", { nom: "x" })).body.error).toBe("invalid_group");
    expect((await post(t, 1, "/api/groupes/renommer", { nom: "Les Copains" })).body).toEqual({ nom: "Les Copains" });
    const trop = await post(t, 1, "/api/groupes/renommer", { nom: "Les Voisins" });
    expect(trop.status).toBe(429);
    expect(trop.body.error).toBe("group_rename_limit");
    t.clock.now += 7 * 86_400_000 + 1000;
    expect((await post(t, 1, "/api/groupes/renommer", { nom: "Les Voisins" })).body).toEqual({ nom: "Les Voisins" });
    expect((await get(t, null, "/api/groupes/nom/les%20amis")).body.error).toBe("unknown_group");
  });
});

describe(`groupes : le classement (${TEST_DB})`, () => {
  it("la moyenne des 3 meilleurs temps ; un groupe de moins de 3 classés est listé sans rang ; le lendemain de l'arrivée ; un membre parti ou masqué ne compte pas", { timeout: 60_000 }, async () => {
    const t = await api();
    for (let n = 1; n <= 12; n++) await joueur(t, n, `Joueur${n}`);
    // Les Rapides : 5 membres classés à Track (31,2 · 32,4 · 34,2 · 35,0 · 40,0 s) → moyenne des trois meilleurs = 32 600 ms. Les Lents : 3 membres (50 · 52 · 54 s) → 52 000 ms. Les Deux : 2 classés.
    const rapides = await groupe(t, "Les Rapides", 1, [2, 3, 4, 5]);
    await groupe(t, "Les Lents", 6, [7, 8]);
    await groupe(t, "Les Deux", 9, [10]);
    for (const [n, ms] of [[1, 31_200], [2, 32_400], [3, 34_200], [4, 35_000], [5, 40_000], [6, 50_000], [7, 52_000], [8, 54_000], [9, 45_000], [10, 46_000]] as const) await track(t, n, ms);
    t.clock.now = MIDI + 60_000;
    let v = await vue(t, "track");
    expect(v.sens).toBe("temps");
    expect(v.groupes.map((g: { nom: string; rang: number; score: number; classes: number }) => [g.nom, g.rang, g.score, g.classes])).toEqual([["Les Rapides", 1, 32_600, 5], ["Les Lents", 2, 52_000, 3]]);
    expect(v.moins.map((g: { nom: string; classes: number }) => [g.nom, g.classes])).toEqual([["Les Deux", 2]]);
    expect(v.vues).toEqual(expect.arrayContaining(["cumul", "track"]));
    // Sa page dit son rang du jour dans chaque vue.
    const page = (await get(t, null, `/api/groupes/nom/les%20rapides?date=${DATE}`)).body;
    expect(page.classement.find((r: { vue: string }) => r.vue === "track")).toMatchObject({ rang: 1, score: 32_600, classes: 5, sur: 2 });
    expect(page.classement.find((r: { vue: string }) => r.vue === "cumul")).toMatchObject({ rang: null, classes: 0 }); // personne n'a fini les deux jeux
    // Un membre qui vient d'arriver ne compte qu'à partir du lendemain : arrivé aujourd'hui, il n'apporte rien.
    await joueur(t, 11, "Rapide11");
    await track(t, 11, 20_000);
    expect((await post(t, 11, "/api/groupes/rejoindre", { jeton: rapides.jeton })).status).toBe(200);
    t.clock.now += 60_000;
    expect((await vue(t, "track")).groupes[0].score).toBe(32_600);
    // Un membre parti ne compte plus tout de suite.
    expect((await post(t, 1, "/api/groupes/quitter")).status).toBe(200);
    t.clock.now += 60_000;
    v = await vue(t, "track");
    expect(v.groupes[0]).toMatchObject({ nom: "Les Rapides", score: Math.round((32_400 + 34_200 + 35_000) / 3), classes: 4 });
    // Un joueur masqué (N1) ne compte jamais : sans lui, il reste 2 classés.
    await t.db.run("UPDATE players SET hidden = 1 WHERE id = ?", [playerId(2)]);
    await t.db.run("UPDATE results SET hidden = 1 WHERE player_id = ?", [playerId(2)]);
    t.clock.now += 60_000;
    v = await vue(t, "track");
    expect(v.groupes.map((g: { nom: string }) => g.nom)).toEqual(["Les Rapides", "Les Lents"]);
    expect(v.groupes[0]).toMatchObject({ classes: 3, score: Math.round((34_200 + 35_000 + 40_000) / 3) });
    expect((await get(t, null, `/api/groupes/classement?date=${DATE}&vue=inconnue`)).body.error).toBe("invalid_view");
    expect((await get(t, null, "/api/groupes/classement?date=pas-une-date")).body.error).toBe("invalid_date");
  });

  it("le cumul : seuls comptent ceux qui ont fini tous les jeux ; Tower (hauteur) : le plus haut gagne ; l'administration peut masquer un groupe des classements", { timeout: 60_000 }, async () => {
    const t = await api();
    for (let n = 1; n <= 6; n++) await joueur(t, n, `Joueur${n}`);
    await groupe(t, "Les Cumuls", 1, [2, 3, 4]);
    await groupe(t, "Les Autres", 5, [6]);
    for (const n of [1, 2, 3]) {
      await track(t, n, 30_000 + n * 1000);
      await jump(t, n, 60 * 20 + n * 60); // des ticks : le temps du jeu en dérive
    }
    await track(t, 4, 30_000); // un seul jeu : il ne compte pas au cumul
    t.clock.now += 60_000;
    const cumul = await vue(t, "cumul");
    expect(cumul.groupes).toHaveLength(1);
    expect(cumul.groupes[0]).toMatchObject({ nom: "Les Cumuls", rang: 1, classes: 3 });
    const tower = await vue(t, "tower");
    expect(tower.sens).toBe("hauteur");
    const admin = await connecte(t);
    const id = (await get(t, 1, "/api/groupes/moi")).body.groupe.id;
    expect((await admin("POST", `/api/admin/groupes/${id}/masquer`, { masque: true, confirmer: true })).body).toEqual({ masque: true });
    expect((await vue(t, "cumul")).groupes).toHaveLength(0);
  });
});

describe(`groupes : le filtre « Mon groupe » (${TEST_DB})`, () => {
  it("le classement du portail et celui de Track ne montrent que toi et ton groupe, avec le rang entre eux", { timeout: 60_000 }, async () => {
    const t = await api();
    for (let n = 1; n <= 5; n++) await joueur(t, n, `Joueur${n}`);
    await groupe(t, "Les Amis", 1, [2, 3]);
    for (const [n, ms] of [[1, 40_000], [2, 30_000], [3, 50_000], [4, 20_000], [5, 25_000]] as const) await track(t, n, ms);
    t.clock.now += 60_000;
    const r = await get(t, 1, `/api/portail/classement?date=${DATE}&vue=track&filtre=groupe`);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.filtre).toBe("groupe");
    expect(r.body.top.map((l: { pseudo: string; rang: number; rangGeneral: number }) => [l.pseudo, l.rang, l.rangGeneral])).toEqual([["Joueur2", 1, 3], ["Joueur1", 2, 4], ["Joueur3", 3, 5]]);
    const jeu = await get(t, 1, `/api/day/${DATE}/leaderboard?filtre=groupe`);
    expect(jeu.body.filtre).toBe("groupe");
    expect(jeu.body.top.map((l: { name: string }) => l.name)).toEqual(["Joueur2", "Joueur1", "Joueur3"]);
    // Sans groupe : toi seul. Un filtre inconnu reste refusé.
    const seul = await get(t, 4, `/api/portail/classement?date=${DATE}&vue=track&filtre=groupe`);
    expect(seul.body.top.map((l: { pseudo: string }) => l.pseudo)).toEqual(["Joueur4"]);
    expect((await get(t, 1, `/api/portail/classement?date=${DATE}&vue=track&filtre=autre`)).body.error).toBe("invalid_filter");
  });
});

describe(`lot U4 : le groupe et le dernier jeu sur les lignes du classement du portail (${TEST_DB})`, () => {
  type Ligne = { pseudo: string; groupe: { id: string; nom: string; avatar?: string } | null; dernier?: { site: string; at: number }; moi?: true };
  const lignes = (b: { top: Ligne[] }) => Object.fromEntries(b.top.map((l) => [l.pseudo, l]));
  const ami = (t: TestApi, de: number, a: number) => t.db.run("INSERT INTO amities (joueur, ami, origine, cree_le) VALUES (?, ?, 'ajout', 0)", [playerId(de), playerId(a)]);

  it("Tous, Amis et Mon groupe : `groupe` (nom, emblème) sur chaque ligne, `null` sans groupe ; `dernier` sur celle d'un autre joueur", { timeout: 60_000 }, async () => {
    const t = await api();
    for (let n = 1; n <= 4; n++) await joueur(t, n, `Joueur${n}`);
    const { id } = await groupe(t, "Les Amis", 1, [2]);
    const empreinte = "ab".repeat(16);
    await t.db.run("UPDATE groupes SET avatar = ? WHERE id = ?", [empreinte, id]);
    // Joueur1 et Joueur2 (du groupe), Joueur3 (sans groupe) : Joueur2 finit Track à 1 000 puis Jump à 5 000 ; Joueur3 finit Track à 2 000.
    for (const [n, ms, at] of [[1, 40_000, 3000], [2, 30_000, 1000], [3, 50_000, 2000]] as const) await t.db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at, hidden) VALUES (?, ?, ?, '[]', 'x', 0, ?, 0)", [JOUR, playerId(n), ms, at]);
    await jump(t, 2, 900);
    await t.db.run("UPDATE jump_results SET submitted_at = 5000 WHERE player_id = ?", [playerId(2)]);
    await ami(t, 1, 3);
    await ami(t, 1, 2);
    await ami(t, 1, 4); // n'a rien fini
    t.clock.now += 60_000;
    const emblemeAttendu = { id, nom: "Les Amis", avatar: empreinte };

    // Tous : public, l'emblème se lit sur les lignes du haut ; toi aussi (`moi`).
    const tous = await get(t, 1, `/api/portail/classement?date=${DATE}&vue=track`);
    expect(tous.status, JSON.stringify(tous.body)).toBe(200);
    expect(lignes(tous.body).Joueur2!.groupe).toEqual(emblemeAttendu);
    expect(lignes(tous.body).Joueur3!.groupe).toBeNull();
    expect(tous.body.moi.groupe).toEqual(emblemeAttendu);
    expect(JSON.stringify(tous.body)).not.toContain(playerId(1));
    const publique = await get(t, null, `/api/portail/classement?date=${DATE}&vue=track`);
    expect(lignes(publique.body).Joueur1!.groupe).toEqual(emblemeAttendu);
    // Un joueur sans groupe qui a fini : `moi.groupe` est `null`.
    const sans = await get(t, 3, `/api/portail/classement?date=${DATE}&vue=track`);
    expect(sans.body.moi.groupe).toBeNull();

    // Amis (cumul) : le groupe de chaque ami, et `dernier` = le dernier jeu fini (Jump pour Joueur2), pas sur ta ligne.
    const amis = await get(t, 1, `/api/portail/classement?date=${DATE}&filtre=amis`);
    expect(amis.status, JSON.stringify(amis.body)).toBe(200);
    const a = lignes(amis.body);
    expect(a.Joueur2!.groupe).toEqual(emblemeAttendu);
    expect(a.Joueur3!.groupe).toBeNull();
    expect(a.Joueur1!.groupe).toEqual(emblemeAttendu);
    expect(a.Joueur1!.dernier).toBeUndefined();
    expect(a.Joueur2!.dernier).toEqual({ site: "jump", at: 5000 });
    expect(a.Joueur3!.dernier).toEqual({ site: "track", at: 2000 });
    expect(amis.body.absents.map((x: { pseudo: string }) => x.pseudo)).toEqual(["Joueur4"]);
    // La vue d'un jeu : le groupe aussi.
    const amisTrack = await get(t, 1, `/api/portail/classement?date=${DATE}&vue=track&filtre=amis`);
    expect(lignes(amisTrack.body).Joueur2!.groupe).toEqual(emblemeAttendu);

    // Mon groupe : tout le monde y a le même groupe.
    const monGroupe = await get(t, 1, `/api/portail/classement?date=${DATE}&filtre=groupe`);
    expect(monGroupe.body.top.map((l: Ligne) => l.groupe)).toEqual([emblemeAttendu, emblemeAttendu]);
    // Sans groupe : toi seul, sans emblème.
    const seul = await get(t, 3, `/api/portail/classement?date=${DATE}&filtre=groupe`);
    expect(seul.body.top.map((l: Ligne) => l.groupe)).toEqual([null]);
  });

  it("un groupe quitté ou dissous ne laisse aucun emblème", { timeout: 60_000 }, async () => {
    const t = await api();
    await joueur(t, 1, "Joueur1");
    await groupe(t, "Les Seuls", 1, []);
    await t.db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at, hidden) VALUES (?, ?, 40000, '[]', 'x', 0, 1000, 0)", [JOUR, playerId(1)]);
    t.clock.now += 60_000;
    expect((await get(t, 1, `/api/portail/classement?date=${DATE}&vue=track`)).body.moi.groupe).toMatchObject({ nom: "Les Seuls" });
    expect((await post(t, 1, "/api/groupes/quitter")).status).toBe(200);
    t.clock.now += 60_000;
    const apres = await get(t, 1, `/api/portail/classement?date=${DATE}&vue=track`);
    expect(apres.body.moi.groupe).toBeNull();
    expect(apres.body.top[0].groupe).toBeNull();
  });
});

describe(`groupes : l'emblème, l'effacement d'un profil, l'administration (${TEST_DB})`, () => {
  // Un petit WebP nu de 64 × 64 (le contrôle est celui des avatars, testé dans avatars.test.ts).
  const le32 = (n: number) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const donnees = [0x10, 0x00, 0x00, 0x9d, 0x01, 0x2a, 64, 0, 64, 0, ...Array(40).fill(7)];
  const webp = Uint8Array.from([...[..."RIFF"].map((c) => c.charCodeAt(0)), ...le32(4 + 8 + donnees.length), ...[..."WEBP"].map((c) => c.charCodeAt(0)), ...[..."VP8 "].map((c) => c.charCodeAt(0)), ...le32(donnees.length), ...donnees]);
  const b64 = btoa(String.fromCharCode(...webp));

  it("l'emblème : le chef le pose (contrôlé comme un avatar), un joueur peut le signaler, 3 signalements le masquent ; le retirer", { timeout: 30_000 }, async () => {
    const t = await api();
    for (const n of [1, 2, 3, 4, 5]) await joueur(t, n, `Joueur${n}`);
    const g = await groupe(t, "Les Amis", 1, [2]);
    expect((await post(t, 1, "/api/groupes/emblem", { image: "AAAA" })).body.error).toBe("invalid_image");
    const r = await post(t, 1, "/api/groupes/emblem", { image: b64 });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect((await post(t, 1, "/api/groupes/emblem", { image: b64 })).body.error).toBe("avatar_limit"); // une fois par jour
    expect((await get(t, null, "/api/groupes/nom/les%20amis")).body.avatar).toBe(r.body.avatar);
    expect((await t.api.handle(new Request(`${ORIGIN}/api/avatars/${r.body.avatar}`), { clientKey: ip() })).status).toBe(200);
    for (const n of [2, 3, 4]) expect((await post(t, n, "/api/avatar/signaler", { groupe: g.id })).status).toBe(200);
    expect((await get(t, null, "/api/groupes/nom/les%20amis")).body.avatar).toBeUndefined(); // masqué : retour à l'initiale
    expect((await t.api.handle(new Request(`${ORIGIN}/api/avatars/${r.body.avatar}`), { clientKey: ip() })).status).toBe(404);
    expect((await del(t, 1, "/api/groupes/emblem")).body).toEqual({ avatar: null });
    expect(await t.db.first("SELECT 1 AS x FROM avatars WHERE kind = 'groupe'")).toBeNull();
  });

  it("effacer un profil : le chef part → le plus ancien devient chef ; seul → le groupe disparaît avec son emblème ; « Changer mon code » garde le groupe", { timeout: 30_000 }, async () => {
    const t = await api();
    for (const n of [1, 2, 3]) await joueur(t, n, `Joueur${n}`);
    const g = await groupe(t, "Les Amis", 1, [2, 3]);
    await t.db.run("UPDATE groupe_membres SET rejoint_le = ? WHERE player_id = ?", [5, playerId(2)]);
    await t.db.run("UPDATE groupe_membres SET rejoint_le = ? WHERE player_id = ?", [9, playerId(3)]);
    await post(t, 1, "/api/groupes/emblem", { image: b64 });
    const admin = await connecte(t);
    const ref = (n: number) => refDe(n);
    expect((await admin("POST", `/api/admin/joueurs/${await ref(1)}/supprimer`, { pseudo: "Joueur1", confirmer: true })).status).toBe(200);
    expect((await get(t, 2, "/api/groupes/moi")).body.groupe).toMatchObject({ chef: true }); // le plus ancien
    expect(await t.db.first("SELECT 1 AS x FROM groupes WHERE chef = ?", [playerId(1)])).toBeNull();
    // « Changer mon code » : le groupe suit le joueur.
    const code = await post(t, 3, "/api/me/code", { newId: "ab".repeat(16) });
    expect(code.status, JSON.stringify(code.body)).toBe(200);
    expect((await get(t, 3, "/api/groupes/moi")).body.error).toBe("code_revoked");
    expect(await t.db.first("SELECT 1 AS x FROM groupe_membres WHERE player_id = ?", ["ab".repeat(16)])).not.toBeNull();
    // Le dernier chef part : le groupe, son emblème et ses signalements disparaissent.
    await t.db.run("DELETE FROM groupe_membres WHERE player_id <> ?", [playerId(2)]);
    expect((await admin("POST", `/api/admin/joueurs/${await ref(2)}/supprimer`, { pseudo: "Joueur2", confirmer: true })).status).toBe(200);
    expect(await t.db.first("SELECT 1 AS x FROM groupes WHERE id = ?", [g.id])).toBeNull();
    expect(await t.db.first("SELECT 1 AS x FROM avatars WHERE kind = 'groupe'")).toBeNull();
  });

  it("l'administration : la liste (recherche par nom), la fiche, renommer, retirer un membre, changer le chef, retirer l'emblème, masquer, dissoudre — confirmé et journalisé", { timeout: 60_000 }, async () => {
    const t = await api();
    for (const n of [1, 2, 3]) await joueur(t, n, `Joueur${n}`);
    const g = await groupe(t, "Les Amis", 1, [2, 3]);
    await groupe(t, "Autre groupe", 3 + 1 > 0 ? 4 : 4, []).catch(() => undefined);
    const admin = await connecte(t);
    expect((await get(t, 1, "/api/admin/groupes")).status).toBe(401); // pas de session
    const liste = await admin("GET", "/api/admin/groupes");
    expect(liste.body.groupes.map((x: { nom: string }) => x.nom)).toContain("Les Amis");
    const q = await admin("GET", "/api/admin/groupes?q=les%20am");
    expect(q.body.groupes.map((x: { nom: string; membres: number }) => [x.nom, x.membres])).toEqual([["Les Amis", 3]]);
    const fiche = (await admin("GET", `/api/admin/groupes/${g.id}`)).body;
    expect(fiche.membres).toHaveLength(3);
    expect(JSON.stringify(fiche)).not.toMatch(/[0-9a-f]{32}/); // ni identifiant secret ni jeton
    const sans = await admin("POST", `/api/admin/groupes/${g.id}/renommer`, { nom: "Les Copains" }); // sans confirmation
    expect(sans.status).toBe(400);
    expect((await admin("POST", `/api/admin/groupes/${g.id}/renommer`, { nom: "Les Copains", confirmer: true })).body).toEqual({ nom: "Les Copains" });
    expect((await admin("POST", `/api/admin/groupes/${g.id}/chef`, { ref: await refDe(2), confirmer: true })).body).toEqual({ chef: true });
    expect((await admin("POST", `/api/admin/groupes/${g.id}/retirer`, { ref: await refDe(3), confirmer: true })).body).toEqual({ retire: true });
    expect((await get(t, 3, "/api/groupes/moi")).body).toEqual({ groupe: null });
    expect((await admin("POST", `/api/admin/groupes/${g.id}/dissoudre`, { nom: "mauvais", confirmer: true })).status).toBe(400);
    expect((await admin("POST", `/api/admin/groupes/${g.id}/dissoudre`, { nom: "Les Copains", confirmer: true })).body).toEqual({ dissous: true });
    const journal = (await admin("GET", "/api/admin/journal")).body.lignes.map((l: { action: string }) => l.action);
    for (const a of ["renommer un groupe", "changer le chef d'un groupe", "retirer un membre d'un groupe", "dissoudre un groupe"]) expect(journal, a).toContain(a);
    expect(JSON.stringify((await admin("GET", "/api/admin/journal")).body)).not.toMatch(/[0-9a-f]{32}/);
  });
});
