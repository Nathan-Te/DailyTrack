import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { formatDay } from "@cdj/core";
import { PREMIER_JOUR_TOWER } from "@cdj/tower-sim";
import { AMIS_MAX, JETON_OCTETS, SUGGESTIONS_JOURS, SUGGESTIONS_MAX } from "../src/amis";
import { classerEntreAmis, classerLaJournee, rangEntreAmis, ligneDe } from "../src/classementDuJour";
import { crc32Hex } from "../src/identity";
import { nameKey } from "../src/pseudos";
import { refOfPlayer } from "../src/players";
import { makeApi, ouvrirJeu, parisDayStart, playerId, TEST_DB, type TestApi } from "./helpers";

// Lot F2 — les amis : la liste (sens unique, réciprocité par invitation), le jeton d'invitation (empreinte seule), la référence publique (jamais le secret), les suggestions, la feuille d'un joueur et le
// filtre `filtre=amis` des quatre classements. Les résultats sont écrits directement en base (le rejeu est testé par les tests de chaque jeu) ; la lecture, elle, est la vraie. SQLite et libSQL (`file:`).

const TOKEN = "jeton-admin-de-test-assez-long";
const JOUR = PREMIER_JOUR_TOWER + 8;
const DATE = formatDay(JOUR);
const MIDI = parisDayStart(JOUR) + 12 * 3_600_000;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const refDe = (n: number) => sha(playerId(n)).slice(0, 12);

let adresse = 0;
/** Une adresse différente à chaque appel : le débit par adresse ne masque pas les autres refus (il a ses propres tests). */
const ip = () => `198.51.${(adresse >> 8) & 255}.${adresse++ & 255}`;
const vu = (n: number | null): Record<string, string> => (n === null ? {} : { "X-Player-Id": playerId(n) });
const get = (t: TestApi, n: number | null, path: string) => t.call("GET", path, undefined, { headers: vu(n), clientKey: ip() });
const post = (t: TestApi, n: number | null, path: string, body: unknown = {}) => t.call("POST", path, body, { headers: vu(n), clientKey: ip() });
const del = (t: TestApi, n: number | null, path: string) => t.call("DELETE", path, undefined, { headers: vu(n), clientKey: ip() });

async function api(options: Parameters<typeof makeApi>[0] = {}): Promise<TestApi> {
  const t = await makeApi({ seed: false, adminToken: TOKEN, ...options });
  t.clock.now = MIDI;
  await t.call("GET", "/api/health");
  await ouvrirJeu(t, "track");
  await ouvrirJeu(t, "jump");
  await ouvrirJeu(t, "tower", JOUR - 3);
  return t;
}

async function joueur(t: TestApi, n: number, nom: string, extra: { hidden?: number } = {}): Promise<string> {
  const id = playerId(n);
  await t.db.run("INSERT OR IGNORE INTO players (id, name, created_at, updated_at, name_key, ref, hidden) VALUES (?, ?, 0, 0, ?, ?, ?)", [id, nom, nameKey(nom), await refOfPlayer(id), extra.hidden ?? 0]);
  return id;
}
async function track(t: TestApi, n: number, ms: number, jour = JOUR, hidden = 0): Promise<void> {
  await t.db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at, hidden) VALUES (?, ?, ?, '[]', 'x', 0, ?, ?)", [jour, playerId(n), ms, 1000 + n, hidden]);
}
async function jump(t: TestApi, n: number, ticks: number, deaths = 0, jour = JOUR, hidden = 0): Promise<void> {
  await t.db.run(
    "INSERT INTO jump_results (day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at, hidden) VALUES (?, ?, 'x', ?, ?, 'x', 1, 1, 0, ?, ?)",
    [jour, playerId(n), ticks, deaths, 1000 + n, hidden],
  );
}
async function tower(t: TestApi, n: number, h: number, vies: number, ticks: number, medal: string | null = null, jour = JOUR, hidden = 0): Promise<void> {
  await t.db.run(
    "INSERT INTO tower_results (day, player_id, tirage, hauteur_mm, hauteur_max_mm, vies, ticks, medal, replay, sim_version, generator_version, first_at, submitted_at, inputs_hash, hidden, apercu) VALUES (?, ?, 0, ?, ?, ?, ?, ?, 'x', 3, 3, ?, ?, ?, ?, 0)",
    [jour, playerId(n), h, h, vies, ticks, medal, 1000 + n, 1000 + n, `h${n}-${jour}`, hidden],
  );
}
/** Une amitié écrite directement (`joueur` voit `ami`). */
async function amitie(t: TestApi, a: number, b: number, origine = "ajout"): Promise<void> {
  await t.db.run("INSERT OR IGNORE INTO amities (joueur, ami, origine, cree_le) VALUES (?, ?, ?, 0)", [playerId(a), playerId(b), origine]);
}
const lignesAmities = async (t: TestApi) =>
  (await t.db.all<{ joueur: string; ami: string }>("SELECT joueur, ami FROM amities")).map((r) => [parseInt(r.joueur, 16), parseInt(r.ami, 16)] as const).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([a, b]) => `${a}>${b}`);
/** Aucune réponse ne doit contenir un identifiant secret (32 hexadécimaux) : les références (12) ne sont pas des identifiants. */
const sansSecret = (body: unknown, ...ids: number[]) => {
  const texte = JSON.stringify(body);
  for (const n of ids) expect(texte, `identifiant de ${n} dans ${texte.slice(0, 120)}`).not.toContain(playerId(n));
  expect(texte).not.toMatch(/[0-9a-f]{32}/);
};

describe(`amis : la liste, le sens unique et la réciprocité (${TEST_DB})`, () => {
  it("par pseudo ou par référence : sens unique (l'autre n'est pas prévenu) ; il t'ajoute à son tour : réciproque ; retirer ne supprime que sa ligne", { timeout: 30_000 }, async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    await joueur(t, 2, "Bruno");
    const a = await post(t, 1, "/api/amis", { pseudo: "  BRUNO " }); // sans casse
    expect(a.status, JSON.stringify(a.body)).toBe(200);
    expect(a.body).toEqual({ ami: { ref: refDe(2), pseudo: "Bruno", reciproque: false, origine: "ajout" }, total: 1 });
    // Bruno ne voit rien : pas prévenu, rien dans sa liste.
    expect((await get(t, 2, "/api/amis")).body).toEqual({ amis: [], total: 0, max: AMIS_MAX, invitation: { active: false } });
    const liste = await get(t, 1, "/api/amis");
    expect(liste.body).toEqual({ amis: [{ ref: refDe(2), pseudo: "Bruno", reciproque: false, origine: "ajout" }], total: 1, max: 100, invitation: { active: false } });
    expect(liste.headers.get("cache-control")).toBe("no-store"); // les routes des amis ne sont jamais gardées par un cache
    // Il l'ajoute à son tour (par référence, en majuscules) : la liste d'Alice dit « vous deux ».
    const b = await post(t, 2, "/api/amis", { ref: refDe(1).toUpperCase() });
    expect(b.body.ami).toEqual({ ref: refDe(1), pseudo: "Alice", reciproque: true, origine: "ajout" });
    expect((await get(t, 1, "/api/amis")).body.amis[0].reciproque).toBe(true);
    expect(await lignesAmities(t)).toEqual(["1>2", "2>1"]);
    // Bruno la retire : sa ligne seulement ; Alice garde la sienne, qui n'est plus réciproque.
    expect((await del(t, 2, `/api/amis/${refDe(1)}`)).body).toEqual({ total: 0 });
    expect(await lignesAmities(t)).toEqual(["1>2"]);
    expect((await get(t, 1, "/api/amis")).body.amis[0].reciproque).toBe(false);
    // Idempotent : le retirer encore, ou retirer une référence inconnue, ne change rien et n'apprend rien.
    expect((await del(t, 2, `/api/amis/${refDe(1)}`)).body).toEqual({ total: 0 });
    expect((await del(t, 2, `/api/amis/${"a".repeat(12)}`)).body).toEqual({ total: 0 });
    expect(await lignesAmities(t)).toEqual(["1>2"]);
  });

  it("refus : soi-même, doublon, joueur inconnu, corps faux, code révoqué, joueur sans profil", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    await joueur(t, 2, "Bruno");
    expect((await post(t, 1, "/api/amis", { ref: refDe(1) })).body.error).toBe("friend_self");
    expect((await post(t, 1, "/api/amis", { pseudo: "alice" })).body.error).toBe("friend_self");
    expect((await post(t, 1, "/api/amis", { pseudo: "Bruno" })).status).toBe(200);
    expect((await post(t, 1, "/api/amis", { ref: refDe(2) })).body.error).toBe("friend_exists");
    expect((await post(t, 1, "/api/amis", { pseudo: "personne" })).body.error).toBe("unknown_friend");
    expect((await post(t, 1, "/api/amis", { ref: "0".repeat(12) })).body.error).toBe("unknown_friend");
    for (const corps of [{}, { ref: refDe(2), pseudo: "Bruno" }, { ref: "xyz" }, { ref: 12 }, { pseudo: "" }, { pseudo: 3 }, { pseudo: "x".repeat(200) }]) {
      const r = await post(t, 1, "/api/amis", corps);
      expect(r.body.error, JSON.stringify(corps)).toBe("invalid_friend");
    }
    expect((await del(t, 1, "/api/amis/pas-une-ref")).body.error).toBe("invalid_friend");
    expect((await post(t, null, "/api/amis", { ref: refDe(2) })).body.error).toBe("invalid_player");
    expect((await post(t, 77, "/api/amis", { ref: refDe(2) })).body.error).toBe("unknown_player");
    expect((await get(t, 77, "/api/amis")).body.error).toBe("unknown_player");
    expect((await t.call("PUT", "/api/amis", {}, { headers: vu(1), clientKey: ip() })).status).toBe(405);
    expect((await t.call("POST", `/api/amis/${refDe(2)}`, {}, { headers: vu(1), clientKey: ip() })).status).toBe(405);
    expect((await t.call("GET", "/api/amis/a/b", undefined, { headers: vu(1), clientKey: ip() })).status).toBe(404);
    // Un code remplacé ne sert plus à rien.
    expect((await post(t, 1, "/api/me/code", { newId: playerId(11) })).status).toBe(200);
    expect((await get(t, 1, "/api/amis")).body.error).toBe("code_revoked");
    expect((await post(t, 1, "/api/amis", { ref: refDe(2) })).body.error).toBe("code_revoked");
  });

  it("100 amis au plus : la 101e est refusée (`friends_full`), un doublon dit « déjà » même liste pleine", { timeout: 60_000 }, async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    for (let i = 0; i < AMIS_MAX; i++) {
      await joueur(t, 100 + i, `Ami${i}`);
      await amitie(t, 1, 100 + i);
    }
    await joueur(t, 2, "Bruno");
    const r = await post(t, 1, "/api/amis", { ref: refDe(2) });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("friends_full");
    expect((await post(t, 1, "/api/amis", { ref: refDe(100) })).body.error).toBe("friend_exists");
    expect((await get(t, 1, "/api/amis")).body.total).toBe(100);
    // Retirer en libère une.
    expect((await del(t, 1, `/api/amis/${refDe(100)}`)).body.total).toBe(99);
    expect((await post(t, 1, "/api/amis", { ref: refDe(2) })).status).toBe(200);
    expect(await t.db.first("SELECT COUNT(*) AS n FROM amities WHERE joueur = ?", [playerId(1)])).toEqual({ n: 100 });
  });

  it("un joueur masqué n'apparaît dans la liste de personne (ni compteur), ne peut pas être ajouté (même visage qu'un inconnu) ; lui garde sa propre liste", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    await joueur(t, 2, "Bruno");
    await joueur(t, 3, "Chloe");
    await amitie(t, 1, 2);
    await amitie(t, 1, 3);
    await amitie(t, 2, 1);
    expect((await get(t, 1, "/api/amis")).body.total).toBe(2);
    await t.db.run("UPDATE players SET hidden = 1 WHERE id = ?", [playerId(2)]);
    const l = (await get(t, 1, "/api/amis")).body;
    expect(l.amis.map((a: { pseudo: string }) => a.pseudo)).toEqual(["Chloe"]);
    expect(l.total).toBe(1);
    const masque = await post(t, 3, "/api/amis", { ref: refDe(2) });
    const inconnu = await post(t, 3, "/api/amis", { ref: "f".repeat(12) });
    expect(masque.status).toBe(404);
    expect(masque.body).toEqual(inconnu.body);
    expect((await post(t, 3, "/api/amis", { pseudo: "bruno" })).body.error).toBe("unknown_friend");
    // Lui ne voit aucune différence : sa liste est la sienne.
    expect((await get(t, 2, "/api/amis")).body.amis.map((a: { pseudo: string }) => a.pseudo)).toEqual(["Alice"]);
    // Et sa feuille est introuvable.
    expect((await get(t, 1, `/api/amis/fiche/${refDe(2)}`)).body.error).toBe("unknown_friend");
  });
});

describe(`amis : le lien d'invitation (${TEST_DB})`, () => {
  it("le jeton n'est rendu qu'à la création, le serveur n'en garde que l'empreinte ; « Nouveau lien » révoque l'ancien", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    await joueur(t, 2, "Bruno");
    const c = await post(t, 1, "/api/amis/invitation");
    expect(c.status).toBe(200);
    const jeton: string = c.body.jeton;
    expect(jeton).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(Buffer.from(jeton, "base64url").length).toBe(JETON_OCTETS);
    expect(Object.keys(c.body)).toEqual(["jeton"]);
    // Rien du jeton en base : son empreinte seulement.
    const ligne = await t.db.first<{ joueur: string; empreinte: string }>("SELECT joueur, empreinte FROM invitations_amis");
    expect(ligne).toEqual({ joueur: playerId(1), empreinte: sha(jeton) });
    expect(JSON.stringify(await t.db.all("SELECT * FROM invitations_amis"))).not.toContain(jeton);
    expect((await get(t, 1, "/api/amis")).body.invitation).toEqual({ active: true });
    expect((await post(t, null, "/api/amis/invitation/voir", { jeton })).body).toEqual({ pseudo: "Alice" });
    // Renouvelé : l'ancien ne sert plus (404 `invalid_invitation`, un seul visage), le nouveau oui.
    const n = await post(t, 1, "/api/amis/invitation");
    expect(n.body.jeton).not.toBe(jeton);
    expect(await t.db.all("SELECT * FROM invitations_amis")).toHaveLength(1);
    for (const mauvais of [jeton, "a".repeat(24), "trop-court", 12, null]) {
      const r = await post(t, 2, "/api/amis/invitation/voir", { jeton: mauvais });
      expect(r.status).toBe(404);
      expect(r.body.error).toBe("invalid_invitation");
      expect((await post(t, 2, "/api/amis/invitation/accepter", { jeton: mauvais })).body.error).toBe("invalid_invitation");
    }
    expect((await post(t, 2, "/api/amis/invitation/voir", { jeton: n.body.jeton })).body).toEqual({ pseudo: "Alice" });
    expect(await lignesAmities(t)).toEqual([]);
  });

  it("accepter : amitié réciproque (deux lignes), le même lien peut servir à plusieurs, la même personne deux fois : `friend_exists` ; son propre lien : `friend_self`", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    await joueur(t, 2, "Bruno");
    await joueur(t, 3, "Chloe");
    const { jeton } = (await post(t, 1, "/api/amis/invitation")).body;
    const r = await post(t, 2, "/api/amis/invitation/accepter", { jeton });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body).toEqual({ ami: { ref: refDe(1), pseudo: "Alice", reciproque: true, origine: "invitation" }, total: 1 });
    expect(await lignesAmities(t)).toEqual(["1>2", "2>1"]);
    expect((await get(t, 1, "/api/amis")).body.amis).toEqual([{ ref: refDe(2), pseudo: "Bruno", reciproque: true, origine: "invitation" }]);
    expect((await post(t, 2, "/api/amis/invitation/accepter", { jeton })).body.error).toBe("friend_exists");
    expect((await post(t, 3, "/api/amis/invitation/accepter", { jeton })).status).toBe(200);
    expect(await lignesAmities(t)).toEqual(["1>2", "1>3", "2>1", "3>1"]);
    expect((await post(t, 1, "/api/amis/invitation/accepter", { jeton })).body.error).toBe("friend_self");
    // Déjà ajoutée par pseudo (sens unique) : l'invitation complète la réciprocité sans changer l'origine de la première ligne.
    await joueur(t, 4, "Denis");
    await post(t, 4, "/api/amis", { ref: refDe(1) });
    const d = await post(t, 4, "/api/amis/invitation/accepter", { jeton });
    expect(d.body.ami).toMatchObject({ reciproque: true, origine: "ajout" });
    expect((await lignesAmities(t)).filter((l) => l.includes("4"))).toEqual(["1>4", "4>1"]);
  });

  it("sans profil sur le serveur : le pseudo est obligatoire (mêmes règles que partout), le profil est créé avec l'amitié ; rien n'est écrit avant", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    const { jeton } = (await post(t, 1, "/api/amis/invitation")).body;
    const compte = async () => (await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM players"))!.n;
    expect(await compte()).toBe(1);
    expect((await post(t, 50, "/api/amis/invitation/accepter", { jeton })).body.error).toBe("name_required");
    expect((await post(t, 50, "/api/amis/invitation/accepter", { jeton, pseudo: "!!" })).body.error).toBe("invalid_name");
    const pris = await post(t, 50, "/api/amis/invitation/accepter", { jeton, pseudo: "alice" });
    expect(pris.status).toBe(409);
    expect(pris.body.error).toBe("name_taken");
    expect(pris.body.suggestions.length).toBeGreaterThan(0);
    expect(await compte()).toBe(1);
    expect(await lignesAmities(t)).toEqual([]);
    const ok = await post(t, 50, "/api/amis/invitation/accepter", { jeton, pseudo: "Nouvelle" });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.body.ami).toEqual({ ref: refDe(1), pseudo: "Alice", reciproque: true, origine: "invitation" });
    expect(await compte()).toBe(2);
    expect(await t.db.first("SELECT name, ref FROM players WHERE id = ?", [playerId(50)])).toEqual({ name: "Nouvelle", ref: refDe(50) });
    expect(await lignesAmities(t)).toEqual(["1>50", "50>1"]);
    // Un joueur sans profil ne peut pas créer de lien (rien à montrer à l'invité).
    expect((await post(t, 51, "/api/amis/invitation")).body.error).toBe("unknown_player");
  });

  it("liste pleine d'un côté ou de l'autre : rien n'est créé (pas même le profil)", { timeout: 60_000 }, async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    await joueur(t, 2, "Bruno");
    for (let i = 0; i < AMIS_MAX; i++) {
      await joueur(t, 100 + i, `Ami${i}`);
      await amitie(t, 1, 100 + i);
    }
    const { jeton } = (await post(t, 1, "/api/amis/invitation")).body;
    // Sa liste (celle de l'invitant) est pleine.
    const avant = await lignesAmities(t);
    const r = await post(t, 2, "/api/amis/invitation/accepter", { jeton });
    expect(r.status).toBe(409);
    expect(r.body.error).toBe("their_friends_full");
    expect(await lignesAmities(t)).toEqual(avant);
    const sansProfil = await post(t, 60, "/api/amis/invitation/accepter", { jeton, pseudo: "Neuf" });
    expect(sansProfil.body.error).toBe("their_friends_full");
    expect(await t.db.first("SELECT 1 AS x FROM players WHERE id = ?", [playerId(60)])).toBeNull();
    // Ma liste (celle de l'invité) est pleine.
    const t2 = await api();
    await joueur(t2, 1, "Alice");
    await joueur(t2, 2, "Bruno");
    for (let i = 0; i < AMIS_MAX; i++) {
      await joueur(t2, 100 + i, `Ami${i}`);
      await amitie(t2, 2, 100 + i);
    }
    const lien = (await post(t2, 1, "/api/amis/invitation")).body.jeton;
    const pleine = await post(t2, 2, "/api/amis/invitation/accepter", { jeton: lien });
    expect(pleine.body.error).toBe("friends_full");
    expect(await t2.db.first("SELECT 1 AS x FROM amities WHERE ami = ?", [playerId(2)])).toBeNull();
  });

  it("l'invitation d'un joueur masqué ne vaut rien (même visage qu'un lien inconnu)", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    await joueur(t, 2, "Bruno");
    const { jeton } = (await post(t, 1, "/api/amis/invitation")).body;
    await t.db.run("UPDATE players SET hidden = 1 WHERE id = ?", [playerId(1)]);
    expect((await post(t, 2, "/api/amis/invitation/voir", { jeton })).body.error).toBe("invalid_invitation");
    expect((await post(t, 2, "/api/amis/invitation/accepter", { jeton })).body.error).toBe("invalid_invitation");
  });
});

describe(`amis : profil effacé, code changé, référence publique (${TEST_DB})`, () => {
  const code = (id: string) => `CDJ2.${id}.${crc32Hex(new TextEncoder().encode(id))}`;

  it("supprimer un profil efface ses amitiés dans les deux sens et son lien d'invitation (procédure d'effacement)", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    await joueur(t, 2, "Bruno");
    await joueur(t, 3, "Chloe");
    await amitie(t, 1, 2);
    await amitie(t, 2, 1);
    await amitie(t, 3, 1);
    await amitie(t, 2, 3);
    await post(t, 1, "/api/amis/invitation");
    const r = await t.call("POST", "/api/admin/effacer", { code: code(playerId(1)), confirmer: true }, { headers: { Authorization: `Bearer ${TOKEN}` } });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(await lignesAmities(t)).toEqual(["2>3"]);
    expect(await t.db.all("SELECT * FROM invitations_amis")).toEqual([]);
    expect((await get(t, 2, "/api/amis")).body.amis.map((a: { pseudo: string }) => a.pseudo)).toEqual(["Chloe"]);
  });

  it("« Changer mon code » : les amitiés (dans les deux sens) et le lien suivent ; la référence publique change, pas la liste", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    await joueur(t, 2, "Bruno");
    await amitie(t, 1, 2);
    await amitie(t, 2, 1);
    const { jeton } = (await post(t, 1, "/api/amis/invitation")).body;
    expect((await post(t, 1, "/api/me/code", { newId: playerId(21) })).status).toBe(200);
    expect(await lignesAmities(t)).toEqual(["2>21", "21>2"]);
    // Le nouveau code garde ses amis ; l'ancien est refusé.
    const apres = await get(t, 21, "/api/amis");
    expect(apres.body.amis).toEqual([{ ref: refDe(2), pseudo: "Bruno", reciproque: true, origine: "ajout" }]);
    expect(apres.body.invitation.active).toBe(true);
    // Chez Bruno, Alice a gardé son pseudo et porte sa nouvelle référence.
    expect((await get(t, 2, "/api/amis")).body.amis).toEqual([{ ref: refDe(21), pseudo: "Alice", reciproque: true, origine: "ajout" }]);
    expect(refDe(21)).not.toBe(refDe(1));
    // Le lien d'invitation, lui, reste valable.
    expect((await post(t, null, "/api/amis/invitation/voir", { jeton })).body).toEqual({ pseudo: "Alice" });
    expect((await get(t, 1, "/api/amis")).body.error).toBe("code_revoked");
  });

  it("la référence publique est l'empreinte à sens unique du secret : aucune réponse ne contient l'identifiant", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    await joueur(t, 2, "Bruno");
    await joueur(t, 3, "Chloe");
    await track(t, 1, 30_000);
    await track(t, 2, 31_000);
    await track(t, 3, 32_000);
    const reponses: unknown[] = [];
    reponses.push((await post(t, 1, "/api/amis", { pseudo: "bruno" })).body);
    reponses.push((await get(t, 1, "/api/amis")).body);
    reponses.push((await get(t, 1, "/api/amis/suggestions?q=chl")).body);
    reponses.push((await get(t, 1, `/api/amis/fiche/${refDe(2)}?date=${DATE}`)).body);
    reponses.push((await get(t, 1, `/api/portail/classement?date=${DATE}&vue=track&filtre=amis`)).body);
    reponses.push((await get(t, 1, `/api/portail/classement?date=${DATE}&vue=track`)).body);
    reponses.push((await get(t, 1, `/api/day/${DATE}/leaderboard?filtre=amis`)).body);
    const { jeton } = (await post(t, 3, "/api/amis/invitation")).body;
    reponses.push((await post(t, null, "/api/amis/invitation/voir", { jeton })).body);
    reponses.push((await post(t, 1, "/api/amis/invitation/accepter", { jeton })).body);
    for (const body of reponses) sansSecret(body, 1, 2, 3);
    expect(refDe(1)).toHaveLength(12);
    expect(playerId(1)).not.toContain(refDe(1));
    expect(await refOfPlayer(playerId(1))).toBe(refDe(1));
  });
});

describe(`amis : les suggestions (${TEST_DB})`, () => {
  it("3 lettres au moins, 5 au plus, début de pseudo sans casse ni accents ; jamais soi-même, un ami, un masqué, un joueur inactif depuis 30 jours", { timeout: 60_000 }, async () => {
    const t = await api();
    await joueur(t, 1, "Maya");
    // Six « Marie… » actifs (Track, Jump ou Tower), plus des cas à écarter.
    const noms = ["Marie1", "Marie2", "Marie3", "Marie4", "Marie5", "Marie6"];
    for (const [i, nom] of noms.entries()) {
      await joueur(t, 10 + i, nom);
      if (i % 3 === 0) await track(t, 10 + i, 30_000);
      else if (i % 3 === 1) await jump(t, 10 + i, 3000);
      else await tower(t, 10 + i, 20_000, 1, 3000);
    }
    await joueur(t, 20, "Marcel"); // actif mais déjà ami
    await track(t, 20, 30_000);
    await joueur(t, 21, "Marlene", { hidden: 1 }); // masqué
    await track(t, 21, 30_000, JOUR, 1);
    await joueur(t, 22, "Marthe"); // jamais classé
    await joueur(t, 23, "Marius"); // classé il y a 30 jours exactement : hors fenêtre
    await track(t, 23, 30_000, JOUR - SUGGESTIONS_JOURS);
    await joueur(t, 24, "Marion"); // classé il y a 29 jours : dans la fenêtre
    await track(t, 24, 30_000, JOUR - SUGGESTIONS_JOURS + 1);
    await joueur(t, 25, "Marlon"); // classé hier à Tower, mais son résultat est masqué
    await tower(t, 25, 10_000, 1, 1000, null, JOUR - 1, 1);
    await amitie(t, 1, 20);
    const q = async (s: string) => ((await get(t, 1, `/api/amis/suggestions?q=${encodeURIComponent(s)}`)).body.suggestions as { ref: string; pseudo: string }[]);
    expect(await q("")).toEqual([]);
    expect(await q("ma")).toEqual([]);
    expect(await q("m")).toEqual([]);
    const tous = await q("mar");
    expect(tous).toHaveLength(SUGGESTIONS_MAX);
    expect(tous.map((s) => s.pseudo)).toEqual(["Marie1", "Marie2", "Marie3", "Marie4", "Marie5"]);
    expect(tous[0]).toEqual({ ref: refDe(10), pseudo: "Marie1" });
    expect((await q("MARIE")).map((s) => s.pseudo)).toEqual(["Marie1", "Marie2", "Marie3", "Marie4", "Marie5"]);
    expect((await q("mari")).map((s) => s.pseudo)).toEqual(["Marie1", "Marie2", "Marie3", "Marie4", "Marie5"]);
    expect((await q("marie6")).map((s) => s.pseudo)).toEqual(["Marie6"]);
    // Les écartés, nommés un à un.
    expect(await q("marc")).toEqual([]); // un ami
    expect(await q("marl")).toEqual([]); // masqué, ou résultat masqué
    expect(await q("mart")).toEqual([]); // jamais classé
    expect(await q("mariu")).toEqual([]); // 30 jours
    expect((await q("mario")).map((s) => s.pseudo)).toEqual(["Marion"]); // 29 jours
    expect(await q("may")).toEqual([]); // soi-même
    // Sans identifiant, ou inconnu.
    expect((await get(t, null, "/api/amis/suggestions?q=mar")).body.error).toBe("invalid_player");
    expect((await get(t, 99, "/api/amis/suggestions?q=mar")).body.error).toBe("unknown_player");
    expect((await t.call("POST", "/api/amis/suggestions", {}, { headers: vu(1), clientKey: ip() })).status).toBe(405);
  });
});

describe(`amis : la feuille d'un joueur (${TEST_DB})`, () => {
  it("ses temps du jour dans chaque jeu (temps et hauteur), son rang au cumul, ami / réciproque ; rien d'autre", { timeout: 60_000 }, async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    await joueur(t, 2, "Bruno");
    await joueur(t, 3, "Chloe");
    await track(t, 1, 31_000);
    await jump(t, 1, 3000);
    await track(t, 2, 30_000);
    await jump(t, 2, 2900);
    await tower(t, 2, 42_700, 2, 3300, "gold");
    await track(t, 3, 40_000); // Chloé n'a fini que Track
    await amitie(t, 1, 2);
    await amitie(t, 2, 1);
    await amitie(t, 1, 3);
    const f = await get(t, 1, `/api/amis/fiche/${refDe(2)}?date=${DATE}`);
    expect(f.status, JSON.stringify(f.body)).toBe(200);
    expect(f.body).toMatchObject({ date: DATE, ref: refDe(2), pseudo: "Bruno", ami: true, reciproque: true, rang: 1, classes: 3 });
    expect(f.body.jeux.map((j: { jeu: string; unite: string; valeur: number; rang: number }) => [j.jeu, j.unite, j.valeur, j.rang])).toEqual([
      ["cdj", "temps", 30_000, 1],
      ["jump", "temps", Math.round((2900 * 1000) / 120), 1],
      ["tower", "hauteur", 42_700, 1],
    ]);
    expect(f.body.jeux[0]).toEqual(expect.objectContaining({ site: "track", nom: "Track", medaille: expect.anything() }));
    expect(f.body.jeux[2].medaille).toBe("gold");
    expect(Object.keys(f.body).sort()).toEqual(["ami", "classes", "date", "jeux", "pseudo", "rang", "reciproque", "ref"]);
    // Sens unique : Chloé est mon ami, pas l'inverse.
    const c = await get(t, 1, `/api/amis/fiche/${refDe(3)}?date=${DATE}`);
    expect(c.body).toMatchObject({ ami: true, reciproque: false, rang: 3 });
    expect(c.body.jeux.map((j: { jeu: string }) => j.jeu)).toEqual(["cdj"]);
    // N'importe quel joueur du classement a une feuille (« Ajouter en ami » depuis « Tous ») : pas ami.
    await joueur(t, 4, "Denis");
    await track(t, 4, 50_000);
    t.clock.now += 60_000; // le classement du jour est gardé 45 s
    expect((await get(t, 1, `/api/amis/fiche/${refDe(4)}?date=${DATE}`)).body).toMatchObject({ ami: false, reciproque: false, rang: 4 });
    // Sans résultat ce jour-là : une feuille vide.
    await joueur(t, 5, "Eva");
    expect((await get(t, 1, `/api/amis/fiche/${refDe(5)}?date=${DATE}`)).body).toMatchObject({ rang: null, jeux: [] });
    // Refus.
    expect((await get(t, 1, `/api/amis/fiche/${"0".repeat(12)}`)).body.error).toBe("unknown_friend");
    expect((await get(t, 1, "/api/amis/fiche/xyz")).body.error).toBe("invalid_friend");
    expect((await get(t, 1, `/api/amis/fiche/${refDe(2)}?date=pas-une-date`)).body.error).toBe("invalid_date");
    expect((await get(t, 1, `/api/amis/fiche/${refDe(2)}?date=2099-01-01`)).body.error).toBe("unknown_day");
    expect((await get(t, null, `/api/amis/fiche/${refDe(2)}`)).body.error).toBe("invalid_player");
    expect((await get(t, 99, `/api/amis/fiche/${refDe(2)}`)).body.error).toBe("unknown_player");
    expect((await post(t, 1, `/api/amis/fiche/${refDe(2)}`)).status).toBe(405);
  });
});

/** Le décor des classements filtrés : cinq joueurs (Alice voit Bruno, Chloé, Denis), quatre ont couru. */
async function decor(): Promise<TestApi> {
  const t = await api();
  for (const [n, nom] of [[1, "Alice"], [2, "Bruno"], [3, "Chloe"], [4, "Denis"], [5, "Eva"]] as const) await joueur(t, n, nom);
  for (const n of [2, 3, 4]) await amitie(t, 1, n);
  await amitie(t, 2, 1); // Bruno la voit aussi
  // Track : Eva 29, Bruno 30, Alice 31, Chloé 33 ; Denis n'a pas couru.
  await track(t, 5, 29_000);
  await track(t, 2, 30_000);
  await track(t, 1, 31_000);
  await track(t, 3, 33_000);
  // Jump : Bruno 2 800 pas (3 morts), Eva 2 850, Alice 3 000 (1 mort), Chloé aucun.
  await jump(t, 2, 2800, 3);
  await jump(t, 5, 2850, 0);
  await jump(t, 1, 3000, 1);
  // Tower : Eva 50 m, Alice 42,7 m, Bruno 40 m.
  await tower(t, 5, 50_000, 3, 4000, "author");
  await tower(t, 1, 42_700, 2, 3500, "gold");
  await tower(t, 2, 40_000, 1, 3600, "silver");
  return t;
}

describe(`amis : le filtre \`filtre=amis\` des classements (${TEST_DB})`, () => {
  const url = (vue: string, extra = "") => `/api/portail/classement?date=${DATE}&vue=${vue}&filtre=amis${extra}`;

  it("portail, vue d'un jeu : toi et tes amis, rang entre amis et rang général, absents en bas, mêmes lignes qu'en « Tous » (+ ref)", { timeout: 60_000 }, async () => {
    const t = await decor();
    const tous = (await get(t, 1, `/api/portail/classement?date=${DATE}&vue=track`)).body;
    const r = await get(t, 1, url("track"));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.headers.get("cache-control")).toBe("private, no-cache");
    expect(r.headers.get("vary")).toContain("X-Player-Id");
    expect(r.body).toMatchObject({ date: DATE, vue: "track", filtre: "amis", classes: 3, amis: 3 });
    expect(r.body.top.map((l: { rang: number; rangGeneral: number; pseudo: string; tempsMs: number; moi?: boolean }) => [l.rang, l.rangGeneral, l.pseudo, l.tempsMs, l.moi ?? false])).toEqual([
      [1, 2, "Bruno", 30_000, false],
      [2, 3, "Alice", 31_000, true],
      [3, 4, "Chloe", 33_000, false],
    ]);
    expect(r.body.absents).toEqual([{ ref: refDe(4), pseudo: "Denis" }]);
    expect(r.body.moi).toMatchObject({ rang: 2, rangGeneral: 3, pseudo: "Alice", classes: 3, ref: refDe(1) });
    // Mêmes lignes qu'en « Tous » (médaille, résultats par jeu), avec le rang général pour rang : le filtre ne change que le rang entre amis.
    for (const l of r.body.top) {
      const general = tous.top.find((x: { pseudo: string }) => x.pseudo === l.pseudo);
      expect(general.rang).toBe(l.rangGeneral);
      expect({ ...l, rang: general.rang, rangGeneral: undefined, moi: undefined }).toEqual({ ...general, moi: undefined, rangGeneral: undefined, rang: general.rang });
      expect(l.ref).toBe(general.ref);
    }
    // Les références de « Tous » sont celles de la liste d'amis (de quoi ajouter depuis un classement).
    expect(tous.top.map((x: { ref: string }) => x.ref)).toEqual([refDe(5), refDe(2), refDe(1), refDe(3)]);
    sansSecret(r.body, 1, 2, 3, 4, 5);
  });

  it("portail, cumul : les complets d'abord (somme des temps), puis « un jeu sur deux » ; rang général du cumul", async () => {
    const t = await decor();
    const tous = (await get(t, 1, `/api/portail/classement?date=${DATE}&vue=cumul`)).body;
    // Cumul (Track + Jump) : Eva 29 000 + 23 750 ; Bruno 30 000 + 23 333 ; Alice 31 000 + 25 000 ; Chloé seulement Track.
    expect(tous.top.map((l: { pseudo: string }) => l.pseudo)).toEqual(["Eva", "Bruno", "Alice", "Chloe"]);
    const r = await get(t, 1, url("cumul"));
    expect(r.body.top.map((l: { rang: number; rangGeneral: number; pseudo: string; complet: boolean }) => [l.rang, l.rangGeneral, l.pseudo, l.complet])).toEqual([
      [1, 2, "Bruno", true],
      [2, 3, "Alice", true],
      [3, 4, "Chloe", false],
    ]);
    expect(r.body.absents).toEqual([{ ref: refDe(4), pseudo: "Denis" }]);
    expect(r.body.vue).toBe("cumul");
    const defaut = await get(t, 1, `/api/portail/classement?date=${DATE}&filtre=amis`); // sans `vue` : le cumul
    expect(defaut.body.top).toEqual(r.body.top);
    // Le point de vue de Bruno : il voit Alice (mais ni Chloé ni Denis).
    const bruno = await get(t, 2, url("cumul"));
    expect(bruno.body.top.map((l: { pseudo: string; rang: number }) => [l.rang, l.pseudo])).toEqual([[1, "Bruno"], [2, "Alice"]]);
    expect(bruno.body.amis).toBe(1);
  });

  it("portail, vue de Tower (hauteur) : score, unité, rang entre amis par la hauteur", async () => {
    const t = await decor();
    const r = await get(t, 1, url("tower"));
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.unite).toBe("mm");
    expect(r.body.top.map((l: { rang: number; rangGeneral: number; pseudo: string; score: { valeur: number; vies: number } }) => [l.rang, l.rangGeneral, l.pseudo, l.score.valeur, l.score.vies])).toEqual([
      [1, 2, "Alice", 42_700, 2],
      [2, 3, "Bruno", 40_000, 1],
    ]);
    expect(r.body.absents.map((a: { pseudo: string }) => a.pseudo)).toEqual(["Chloe", "Denis"]);
    expect(r.body.moi).toMatchObject({ rang: 1, rangGeneral: 2 });
  });

  it("Track, Jump et Tower : les lignes de chaque jeu (rank, rangGeneral, ref, temps / pas et morts / hauteur et vies), absents, participants", { timeout: 60_000 }, async () => {
    const t = await decor();
    const track = await get(t, 1, `/api/day/${DATE}/leaderboard?filtre=amis`);
    expect(track.status, JSON.stringify(track.body)).toBe(200);
    expect(track.headers.get("cache-control")).toBe("private, no-cache");
    expect(track.body).toMatchObject({ date: DATE, filtre: "amis", participants: 4, classes: 3, amis: 3 });
    expect(track.body.top.map((l: { rank: number; rang: number; rangGeneral: number; name: string; ms: number; ref: string }) => [l.rank, l.rang, l.rangGeneral, l.name, l.ms, l.ref])).toEqual([
      [1, 1, 2, "Bruno", 30_000, refDe(2)],
      [2, 2, 3, "Alice", 31_000, refDe(1)],
      [3, 3, 4, "Chloe", 33_000, refDe(3)],
    ]);
    expect(track.body.me).toMatchObject({ rank: 2, rangGeneral: 3, name: "Alice", moi: true });
    expect(track.body.absents).toEqual([{ ref: refDe(4), pseudo: "Denis" }]);
    const toutTrack = (await get(t, 1, `/api/day/${DATE}/leaderboard?limit=50`)).body;
    for (const l of track.body.top) expect(toutTrack.top.find((x: { name: string }) => x.name === l.name)).toMatchObject({ ms: l.ms, medal: l.medal });
    const jumpBoard = await get(t, 1, `/api/jump/day/${DATE}/board?filtre=amis`);
    expect(jumpBoard.status, JSON.stringify(jumpBoard.body)).toBe(200);
    expect(jumpBoard.body).toMatchObject({ date: DATE, filtre: "amis", open: true, participants: 3, classes: 2 });
    expect(jumpBoard.body.top.map((l: { rank: number; rangGeneral: number; name: string; ticks: number; deaths: number }) => [l.rank, l.rangGeneral, l.name, l.ticks, l.deaths])).toEqual([
      [1, 1, "Bruno", 2800, 3],
      [2, 3, "Alice", 3000, 1],
    ]);
    expect(jumpBoard.body.absents.map((a: { pseudo: string }) => a.pseudo)).toEqual(["Chloe", "Denis"]);
    const towerBoard = await get(t, 1, `/api/tower/day/${DATE}/board?filtre=amis`);
    expect(towerBoard.status, JSON.stringify(towerBoard.body)).toBe(200);
    expect(towerBoard.body).toMatchObject({ date: DATE, filtre: "amis", open: true, participants: 3, classes: 2 });
    expect(towerBoard.body.top.map((l: { rank: number; rangGeneral: number; name: string; hauteurMm: number; vies: number; ticks: number; medal: string }) => [l.rank, l.rangGeneral, l.name, l.hauteurMm, l.vies, l.ticks, l.medal])).toEqual([
      [1, 2, "Alice", 42_700, 2, 3500, "gold"],
      [2, 3, "Bruno", 40_000, 1, 3600, "silver"],
    ]);
    expect(towerBoard.body.generation).toBe(0);
    expect(towerBoard.body.me).toMatchObject({ rank: 1, rangGeneral: 2, ref: refDe(1) });
    // Les trois portent `ref` sur chaque ligne, sans identifiant.
    sansSecret([track.body, jumpBoard.body, towerBoard.body], 1, 2, 3, 4, 5);
  });

  it("« Tous » ne change pas : cache public intact ; chaque ligne porte `ref` (portail, Jump, Tower, Track)", { timeout: 60_000 }, async () => {
    const t = await decor();
    const tous = await t.call("GET", `/api/portail/classement?date=${DATE}&vue=track`, undefined, { clientKey: ip() });
    expect(tous.headers.get("cache-control")).toMatch(/^public, max-age=\d+$/);
    expect(tous.body.filtre).toBeUndefined();
    expect(tous.body.top.every((l: { ref?: string }) => /^[0-9a-f]{12}$/.test(l.ref ?? ""))).toBe(true);
    const j = (await get(t, 1, `/api/jump/day/${DATE}/board`)).body;
    expect(j.top.map((l: { ref: string }) => l.ref)).toEqual([refDe(2), refDe(5), refDe(1)]);
    expect(j.me.ref).toBe(refDe(1));
    expect(j.filtre).toBeUndefined();
    const w = (await get(t, 1, `/api/tower/day/${DATE}/board`)).body;
    expect(w.top.map((l: { ref: string }) => l.ref)).toEqual([refDe(5), refDe(1), refDe(2)]);
    expect(w.me.ref).toBe(refDe(1));
    const k = (await get(t, 1, `/api/day/${DATE}/leaderboard`)).body;
    expect(k.top[0].ref).toBe(refDe(5));
  });

  it("ce que le joueur vient de finir figure tout de suite (ses états exacts), même quand le classement gardé date de quelques secondes", { timeout: 60_000 }, async () => {
    const t = await decor();
    await get(t, 1, url("track")); // le classement du jour est calculé et gardé (45 s)
    await joueur(t, 6, "Fanny");
    await amitie(t, 6, 2);
    await track(t, 6, 29_500); // arrive après le calcul gardé
    const r = await get(t, 6, url("track"));
    expect(r.body.top.map((l: { pseudo: string; rang: number }) => [l.rang, l.pseudo])).toEqual([[1, "Fanny"], [2, "Bruno"]]);
    expect(r.body.moi).toMatchObject({ pseudo: "Fanny", rang: 1 });
  });

  it("plus de 50 amis et de 50 classés : toute la liste (pas la limite de 50 du « Tous »), triée par rang ; masqués écartés", { timeout: 120_000 }, async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    await track(t, 1, 90_000);
    for (let i = 0; i < 100; i++) {
      await joueur(t, 100 + i, `Ami${String(i).padStart(3, "0")}`);
      await track(t, 100 + i, 20_000 + i * 100);
      await amitie(t, 1, 100 + i);
    }
    // Un ami masqué (résultat compris, comme le fait l'administration) n'est nulle part.
    await t.db.run("UPDATE players SET hidden = 1 WHERE id = ?", [playerId(150)]);
    await t.db.run("UPDATE results SET hidden = 1 WHERE player_id = ?", [playerId(150)]);
    const tous = (await get(t, 1, `/api/portail/classement?date=${DATE}&vue=track`)).body;
    expect(tous.top).toHaveLength(50);
    const r = await get(t, 1, url("track"));
    expect(r.status).toBe(200);
    expect(r.body.top).toHaveLength(100); // 99 amis visibles + Alice
    expect(r.body.classes).toBe(100);
    expect(r.body.amis).toBe(99);
    expect(r.body.absents).toEqual([]);
    expect(r.body.top.map((l: { rang: number }) => l.rang)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    expect(r.body.top[99]).toMatchObject({ pseudo: "Alice", moi: true, rang: 100, rangGeneral: 100 });
    expect(r.body.top.some((l: { pseudo: string }) => l.pseudo === "Ami050")).toBe(false);
    expect(r.body.top[50]).toMatchObject({ pseudo: "Ami051", rang: 51, rangGeneral: 51 }); // Ami050 (masqué) n'est pas dans le classement
  });

  it("refus : autre valeur de `filtre`, sans identifiant, joueur inconnu, code révoqué, vue inconnue, jour futur", async () => {
    const t = await decor();
    const chemins = [`/api/portail/classement?date=${DATE}`, `/api/day/${DATE}/leaderboard`, `/api/jump/day/${DATE}/board`, `/api/tower/day/${DATE}/board`];
    for (const c of chemins) {
      for (const mauvais of ["tous", "", "amis,autres", "AMIS", "1"]) {
        const r = await get(t, 1, `${c}${c.includes("?") ? "&" : "?"}filtre=${mauvais}`);
        expect(r.status, `${c} filtre=${mauvais}`).toBe(400);
        expect(r.body.error).toBe("invalid_filter");
      }
      const sep = c.includes("?") ? "&" : "?";
      expect((await get(t, null, `${c}${sep}filtre=amis`)).body.error, c).toBe("invalid_player");
      expect((await t.call("GET", `${c}${sep}filtre=amis`, undefined, { headers: { "X-Player-Id": "pas-un-identifiant" }, clientKey: ip() })).body.error, c).toBe("invalid_player");
      expect((await get(t, 99, `${c}${sep}filtre=amis`)).body.error, c).toBe("unknown_player");
    }
    expect((await get(t, 1, url("inconnue"))).body.error).toBe("invalid_view");
    expect((await get(t, 1, `/api/portail/classement?date=2099-01-01&filtre=amis`)).body.error).toBe("unknown_day");
    expect((await get(t, 1, `/api/day/2099-01-01/leaderboard?filtre=amis`)).body.error).toBe("unknown_day");
    expect((await get(t, 1, `/api/jump/day/pas-une-date/board?filtre=amis`)).body.error).toBe("invalid_date");
    expect((await post(t, 1, "/api/me/code", { newId: playerId(31) })).status).toBe(200);
    for (const c of chemins) expect((await get(t, 1, `${c}${c.includes("?") ? "&" : "?"}filtre=amis`)).body.error, c).toBe("code_revoked");
  });

  it("un jeu fermé (`off`) reste fermé avec le filtre ; sans ami, la liste est vide et tous sont absents", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    await track(t, 1, 31_000);
    const seule = await get(t, 1, url("track"));
    expect(seule.body).toMatchObject({ classes: 1, amis: 0, absents: [] });
    expect(seule.body.top).toHaveLength(1);
    await t.db.run("UPDATE jeux SET etat = 'off' WHERE jeu = 'jump'");
    t.clock.now += 120_000; // l'état des jeux est gardé 30 s
    const r = await get(t, 1, `/api/jump/day/${DATE}/board?filtre=amis`);
    expect(r.status).toBe(404);
    expect(r.body.error).toBe("game_unavailable");
  });
});

describe(`amis : « 3e entre amis » dans /api/portail/jour (${TEST_DB})`, () => {
  it("joueur.rangEntreAmis = { rang, sur } ; null sans ami, ou tant que le joueur n'a rien fini, ou quand aucun ami n'a fini", { timeout: 60_000 }, async () => {
    const t = await decor();
    const rang = async (n: number) => (await get(t, n, "/api/portail/jour")).body.joueur.rangEntreAmis;
    // Alice : cumul Alice 56 000 ; Bruno 53 333 (devant) ; Chloé partielle ; Denis rien → 2e sur 3.
    expect(await rang(1)).toEqual({ rang: 2, sur: 3 });
    expect(await rang(2)).toEqual({ rang: 1, sur: 2 });
    expect(await rang(5)).toBeNull(); // Eva n'a pas d'ami
    await joueur(t, 7, "Gaby");
    await amitie(t, 7, 2);
    expect(await rang(7)).toBeNull(); // rien fini
    await track(t, 7, 60_000);
    expect(await rang(7)).toEqual({ rang: 2, sur: 2 });
    await joueur(t, 8, "Hugo");
    await amitie(t, 8, 4);
    await track(t, 8, 60_000);
    expect(await rang(8)).toBeNull(); // son seul ami n'a rien fini
    // Sans joueur : la réponse publique, inchangée.
    const publique = await t.call("GET", "/api/portail/jour", undefined, { clientKey: ip() });
    expect(publique.body.joueur).toBeUndefined();
  });

  it("la fonction pure : les amis masqués (absents du classement) ne comptent pas ; le premier arrivé à égalité passe devant", () => {
    const res = (rang: number, tempsMs: number, at: number) => ({ rang, tempsMs, medaille: null, at });
    const lignes = [
      ligneDe("a", [res(1, 100, 10)]),
      ligneDe("b", [res(2, 200, 20)]),
      ligneDe("c", [res(3, 200, 30)]),
    ];
    const c = classerLaJournee([{ jeu: "cdj", classes: lignes.map((l, i) => ({ playerId: l.id, tempsMs: l.resultats[0]!.tempsMs, medaille: null, at: l.resultats[0]!.at, ...(i < 0 ? {} : {}) })) }]);
    expect(rangEntreAmis(c, ligneDe("b", [res(2, 200, 0)]), ["a", "c", "masque"])).toEqual({ rang: 2, sur: 3 });
    expect(rangEntreAmis(c, ligneDe("c", [res(3, 200, 0)]), ["b"])).toEqual({ rang: 2, sur: 2 });
    expect(rangEntreAmis(c, ligneDe("b", [res(2, 200, 0)]), ["masque", "inconnu"])).toBeNull();
    expect(rangEntreAmis(c, ligneDe("b", [res(2, 200, 0)]), [])).toBeNull();
  });
});

describe(`accueil (lot U1) : la colonne de droite de /api/portail/jour (${TEST_DB})`, () => {
  const corps = async (t: TestApi, n: number) => (await get(t, n, "/api/portail/jour")).body.joueur;

  it("le classement du jour entre amis (les 3 premiers et ta ligne), tes amis aujourd'hui (jeux faits), aucun identifiant secret", { timeout: 60_000 }, async () => {
    const t = await decor();
    const alice = await corps(t, 1);
    // Cumul : Bruno 53 333 (devant), Alice 56 000, Chloé partielle (Track seul) ; Denis n'a rien fini, il n'a pas de rang.
    expect(alice.classementAmis.sur).toBe(4);
    expect(alice.classementAmis.top.map((l: { rang: number; pseudo: string; faits: number; moi?: boolean }) => [l.rang, l.pseudo, l.faits, l.moi ?? false])).toEqual([
      [1, "Bruno", 2, false],
      [2, "Alice", 2, true],
      [3, "Chloe", 1, false],
    ]);
    expect(alice.classementAmis.top[0]).toMatchObject({ tempsMs: 53_333, ref: refDe(2) });
    expect(alice.classementAmis.top[2].tempsMs).toBeNull(); // Chloé n'a pas tout fini : pas de temps cumulé
    expect(alice.classementAmis.moi).toMatchObject({ rang: 2, pseudo: "Alice", tempsMs: 56_000, moi: true, ref: refDe(1) });
    // Tes amis aujourd'hui : ceux qui ont joué d'abord, Denis (rien joué) en dernier ; la journée parfaite de Bruno (Track et Jump).
    const parPseudo = Object.fromEntries(alice.amisDuJour.map((a: { pseudo: string }) => [a.pseudo, a]));
    expect(alice.amisDuJour.map((a: { pseudo: string }) => a.pseudo).pop()).toBe("Denis");
    expect(parPseudo.Bruno).toMatchObject({ faits: ["track", "jump"], parfaite: true, ref: refDe(2) });
    expect(parPseudo.Chloe).toMatchObject({ faits: ["track"], parfaite: false });
    expect(parPseudo.Denis).toMatchObject({ faits: [], parfaite: false });
    expect(parPseudo.Denis.dernier).toBeUndefined();
    expect(alice.nbAmis).toBe(3);
    expect(alice.groupe).toBeNull();
    // Tower est d'arcade : il ne compte pas dans les jeux faits.
    expect(JSON.stringify(alice.amisDuJour)).not.toContain("tower");
    sansSecret(alice, 1, 2, 3, 4, 5);
  });

  it("sans ami : pas de classement entre amis, aucun ami aujourd'hui ; 6 amis au plus", { timeout: 60_000 }, async () => {
    const t = await decor();
    const eva = await corps(t, 5);
    expect(eva).toMatchObject({ classementAmis: null, amisDuJour: [], nbAmis: 0, groupe: null });
    for (let n = 10; n < 18; n++) {
      await joueur(t, n, `Ami${n}`);
      await amitie(t, 5, n);
    }
    const apres = await corps(t, 5);
    expect(apres.nbAmis).toBe(8);
    expect(apres.amisDuJour).toHaveLength(6);
    // Eva a tout fini (Track et Jump), ses 8 amis n'ont rien joué : elle est 1re, seule dans le haut du classement, et eux n'ont ni rang ni temps.
    expect(apres.classementAmis.sur).toBe(9);
    expect(apres.classementAmis.top).toHaveLength(1);
    expect(apres.classementAmis.moi).toMatchObject({ rang: 1, faits: 2, moi: true });
    expect(apres.amisDuJour.every((a: { faits: string[] }) => a.faits.length === 0)).toBe(true);
  });

  it("ton groupe : nom, nombre de membres, rang du jour (null sous 3 classés) ; sans groupe, null", { timeout: 60_000 }, async () => {
    const t = await decor();
    expect((await post(t, 1, "/api/groupes", { nom: "Les Tests" })).status).toBe(200);
    const g = (await corps(t, 1)).groupe;
    expect(g).toEqual({ nom: "Les Tests", membres: 1, rang: null, sur: 0 });
    expect((await corps(t, 2)).groupe).toBeNull();
    // Un deuxième membre : le groupe compte 2 membres (le classement exige 3 classés au moins).
    const moi = (await get(t, 1, "/api/groupes/moi")).body.groupe;
    expect((await post(t, 2, "/api/groupes/rejoindre", { jeton: moi.invitation })).status).toBe(200);
    expect((await corps(t, 2)).groupe).toMatchObject({ nom: "Les Tests", membres: 2 });
  });

  it("la fonction pure : toi arrivé le dernier à ton temps, les amis sans cumul en bas sans rang, un visiteur sans bilan en tête des sans-rang", () => {
    const res = (rang: number, tempsMs: number, at: number) => ({ rang, tempsMs, medaille: null, at });
    const lignes = [ligneDe("a", [res(1, 100, 10)]), ligneDe("b", [res(2, 200, 20)]), ligneDe("c", [res(3, 200, 30)])];
    const c = classerLaJournee([{ jeu: "cdj", classes: lignes.map((l) => ({ playerId: l.id, tempsMs: l.resultats[0]!.tempsMs, medaille: null, at: l.resultats[0]!.at })) }]);
    const ordre = classerEntreAmis(c, "moi", ligneDe("moi", [res(2, 200, 0)]), ["a", "b", "inconnu", "c", "moi"]);
    // « moi » vaut 200 comme b et c, mais il est arrivé le dernier à ce temps.
    expect(ordre.map((x) => [x.id, x.rang])).toEqual([["a", 1], ["b", 2], ["c", 3], ["moi", 4], ["inconnu", null]]);
    // Rien fini : sa ligne est là, sans rang, avant les amis qui n'ont rien fini non plus.
    expect(classerEntreAmis(c, "moi", null, ["a", "inconnu"]).map((x) => [x.id, x.rang])).toEqual([["a", 1], ["moi", null], ["inconnu", null]]);
  });
});

describe(`amis : débit et plans (${TEST_DB})`, () => {
  it("ajouts et retraits : 30 par joueur et par fenêtre, puis 429 ; lectures : 60 par joueur", { timeout: 60_000 }, async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    for (let i = 0; i < 30; i++) expect((await del(t, 1, `/api/amis/${"a".repeat(12)}`)).status).toBe(200);
    const r = await del(t, 1, `/api/amis/${"a".repeat(12)}`);
    expect(r.status).toBe(429);
    expect(r.body.error).toBe("rate_limited");
    expect(r.headers.get("retry-after")).toBeTruthy();
    // Un autre joueur n'est pas touché.
    await joueur(t, 2, "Bruno");
    expect((await del(t, 2, `/api/amis/${"a".repeat(12)}`)).status).toBe(200);
    for (let i = 0; i < 60; i++) expect((await get(t, 2, "/api/amis")).status).toBe(200);
    expect((await get(t, 2, "/api/amis")).status).toBe(429);
  });

  it("par adresse : 60 écritures par fenêtre sur une même adresse, même avec des joueurs différents ; la création d'un lien : 10 par joueur", { timeout: 60_000 }, async () => {
    const t = await api();
    for (let i = 0; i < 12; i++) await joueur(t, 1 + i, `Joueur${i}`);
    for (let i = 0; i < 10; i++) expect((await post(t, 1, "/api/amis/invitation")).status).toBe(200);
    expect((await post(t, 1, "/api/amis/invitation")).status).toBe(429);
    let refuses = 0;
    for (let i = 0; i < 70; i++) {
      const r = await t.call("DELETE", `/api/amis/${"b".repeat(12)}`, undefined, { headers: vu(2 + (i % 10)), clientKey: "203.0.113.99" });
      if (r.status === 429) refuses++;
    }
    expect(refuses).toBeGreaterThan(0);
  });

  it("aucune donnée personnelle dans les journaux (pas de pseudo, d'identifiant, de jeton ni d'adresse)", async () => {
    const lignes: string[] = [];
    const t = await api({ log: (severity, message, fields) => lignes.push(JSON.stringify({ severity, message, ...fields })) });
    await joueur(t, 1, "Alice");
    await joueur(t, 2, "Bruno");
    const { jeton } = (await post(t, 1, "/api/amis/invitation")).body;
    await post(t, 2, "/api/amis/invitation/accepter", { jeton });
    await post(t, 1, "/api/amis", { pseudo: "personne" });
    const tout = lignes.join("\n");
    expect(tout).toContain("amis");
    for (const interdit of [jeton, "Alice", "Bruno", playerId(1), playerId(2), refDe(1), "203.0.113", "198.51"]) expect(tout).not.toContain(interdit);
  });
});
