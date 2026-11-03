import { describe, expect, it } from "vitest";
import { daysFromCivil, formatDay } from "@cdj/core";
import { RETOURS_GARDE_JOURS, RETOURS_PAR_JOUR, RETOUR_MESSAGES_MAX, RETOUR_TEXTE_MAX, nettoyerContexte, nettoyerTexte } from "../src/retours";
import { refOfPlayer, sha256Hex } from "../src/players";
import { nameKey } from "../src/pseudos";
import { ADMIN_EMAIL, CLIENT_ID, SESSION_KEY } from "./adminHelpers";
import { makeApi, parisDayStart, playerId, TEST_DB, type TestApi } from "./helpers";

// Lot C1, partie A — « Un bug ? Une idée ? » : limites, texte seul, fil, non lus, administration, effacement, durée de garde. SQLite et libSQL (`file:`).

const TODAY = daysFromCivil(2026, 10, 20);
const MIDI = parisDayStart(TODAY) + 12 * 3_600_000;
const ORIGIN = "http://api.test";
const JOUR_MS = 86_400_000;
const OPTIONS_ADMIN = { emails: [ADMIN_EMAIL], sessionKey: SESSION_KEY, clientId: CLIENT_ID, fakeVerifier: true, releaseTag: "prod-2026-10-19-1830" };

let adresse = 0;
/** Une adresse différente à chaque appel : le débit par adresse ne masque pas les autres refus (il a ses propres tests). */
const ip = () => `198.51.${(adresse >> 8) & 255}.${adresse++ & 255}`;
const vu = (n: number | null): Record<string, string> => (n === null ? {} : { "X-Player-Id": playerId(n) });
const get = (t: TestApi, n: number | null, path: string) => t.call("GET", path, undefined, { headers: vu(n), clientKey: ip() });
const post = (t: TestApi, n: number | null, path: string, body: unknown = {}) => t.call("POST", path, body, { headers: vu(n), clientKey: ip() });
const CTX = { jeu: "jump", page: "/jump/", jour: formatDay(TODAY), navigateur: "firefox", systeme: "linux", ecran: "390x844", langue: "fr" };
const envoi = (t: TestApi, n: number | null, texte = "La scie traverse le mur.", type = "bug") => post(t, n, "/api/retours", { type, texte, contexte: CTX });

async function api(): Promise<TestApi> {
  const t = await makeApi({ seed: false, admin: OPTIONS_ADMIN });
  t.clock.now = MIDI;
  await t.call("GET", "/api/health");
  return t;
}
async function joueur(t: TestApi, n: number, nom: string): Promise<void> {
  const id = playerId(n);
  await t.db.run("INSERT OR IGNORE INTO players (id, name, created_at, updated_at, name_key, ref) VALUES (?, ?, 0, 0, ?, ?)", [id, nom, nameKey(nom), await refOfPlayer(id)]);
}
async function connecte(t: TestApi) {
  const r = await t.call("POST", "/api/admin/session", { credential: `factice:${ADMIN_EMAIL}` }, { headers: { Origin: ORIGIN, "X-Cdj-Admin": "1" } });
  const cookie = /__session=([^;]+)/.exec(r.headers.get("set-cookie") ?? "")![1]!;
  const headers = { Cookie: `__session=${cookie}`, Origin: ORIGIN, "X-Cdj-Admin": "1" };
  return (method: string, path: string, body?: unknown) => t.call(method, path, body, { headers });
}
const confirmer = { confirmer: true };

describe(`retours : règles pures`, () => {
  it("le texte est nettoyé, jamais interprété : HTML gardé tel quel, contrôles ôtés, 1 000 caractères au plus", () => {
    expect(nettoyerTexte("<b>gras</b> & <script>x</script>")).toBe("<b>gras</b> & <script>x</script>");
    expect(nettoyerTexte("a\u0000b‮c\r\nd\n\n\n\ne")).toBe("abc\nd\n\ne");
    expect(nettoyerTexte("   ")).toBeNull();
    expect(nettoyerTexte(42)).toBeNull();
    expect(nettoyerTexte("é".repeat(RETOUR_TEXTE_MAX))).not.toBeNull();
    expect(nettoyerTexte("é".repeat(RETOUR_TEXTE_MAX + 1))).toBeNull();
    expect(nettoyerTexte("😀".repeat(RETOUR_TEXTE_MAX))).not.toBeNull(); // un émoji compte pour un caractère
  });

  it("le contexte est une liste fermée : champs inconnus écartés, invalides abandonnés, version posée par le serveur", () => {
    const c = nettoyerContexte({ ...CTX, version: "pirate", ref: "abc", navigateur: "netscape", ecran: "grand", page: "/track/?x=1" }, "prod-1", "2026-10-20");
    expect(c).toEqual({ jeu: "jump", page: "/", jour: formatDay(TODAY), version: "prod-1", navigateur: "autre", systeme: "linux", ecran: "0x0", langue: "fr" });
    expect(Object.keys(c).sort()).toEqual(["ecran", "jeu", "jour", "langue", "navigateur", "page", "systeme", "version"]);
  });
});

describe(`retours : le joueur (${TEST_DB})`, () => {
  it("envoyer, relire son fil, répondre ; un autre joueur ne voit rien (un seul visage)", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    const r = await envoi(t, 1);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.body.reponsePossible).toBe(true);
    const liste = await get(t, 1, "/api/retours");
    expect(liste.body.fils).toHaveLength(1);
    expect(liste.body.fils[0]).toMatchObject({ type: "bug", jeu: "jump", statut: "nouveau", nonLu: false, messages: 1, apercu: "La scie traverse le mur." });
    const fil = await get(t, 1, `/api/retours/${r.body.id}`);
    expect(fil.body.messages).toEqual([{ auteur: "joueur", texte: "La scie traverse le mur.", creeLe: expect.any(String) }]);
    expect(fil.body.contexte).toMatchObject({ jeu: "jump", version: "prod-2026-10-19-1830", navigateur: "firefox", ecran: "390x844" });
    expect(JSON.stringify(fil.body)).not.toContain(playerId(1)); // l'identifiant secret ne sort jamais
    expect((await post(t, 1, `/api/retours/${r.body.id}/messages`, { texte: "Et aussi au niveau 2." })).status).toBe(200);
    expect((await get(t, 1, `/api/retours/${r.body.id}`)).body.messages).toHaveLength(2);
    await joueur(t, 2, "Bob");
    for (const res of [await get(t, 2, `/api/retours/${r.body.id}`), await post(t, 2, `/api/retours/${r.body.id}/messages`, { texte: "x" }), await post(t, 2, `/api/retours/${r.body.id}/lu`), await get(t, 1, "/api/retours/999")]) {
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("unknown_feedback");
    }
    expect((await get(t, 2, "/api/retours")).body.fils).toEqual([]);
  });

  it("refuse un type inconnu, un message vide ou de plus de 1 000 caractères ; rien n'est écrit", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    for (const corps of [
      { type: "autre chose", texte: "x" },
      { type: "bug", texte: "" },
      { type: "bug", texte: "   " },
      { type: "bug", texte: "x".repeat(RETOUR_TEXTE_MAX + 1) },
      { type: "bug", texte: 12 },
      { type: "bug" },
    ]) {
      const r = await post(t, 1, "/api/retours", corps);
      expect([r.status, r.body.error]).toEqual([400, "invalid_feedback"]);
    }
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM retours"))!.n).toBe(0);
  });

  it("5 nouveaux fils par jour de Paris et par joueur ; le lendemain, c'est reparti ; les autres joueurs ne sont pas gênés", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    for (let i = 0; i < RETOURS_PAR_JOUR; i++) {
      t.clock.now += 60_000;
      expect((await envoi(t, 1, `retour ${i}`, "suggestion")).status).toBe(200);
    }
    const trop = await envoi(t, 1);
    expect([trop.status, trop.body.error]).toEqual([429, "feedback_limit"]);
    expect(Number(trop.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await envoi(t, 2)).status).toBe(200);
    t.clock.now = parisDayStart(TODAY + 1) + 3_600_000;
    expect((await envoi(t, 1)).status).toBe(200);
  });

  it("une limite par adresse (10 par fenêtre), et plus stricte sans profil (3)", async () => {
    const t = await api();
    for (let i = 0; i < 3; i++) expect((await t.call("POST", "/api/retours", { type: "autre", texte: `anonyme ${i}`, contexte: CTX }, { clientKey: "203.0.113.9" })).status).toBe(200);
    const r = await t.call("POST", "/api/retours", { type: "autre", texte: "anonyme 4", contexte: CTX }, { clientKey: "203.0.113.9" });
    expect([r.status, r.body.error]).toEqual([429, "rate_limited"]);
    for (let i = 0; i < 10; i++) expect((await t.call("POST", "/api/retours", { type: "autre", texte: `p${i}`, contexte: CTX }, { headers: vu(10 + i), clientKey: "203.0.113.10" })).status).toBe(200);
    expect((await t.call("POST", "/api/retours", { type: "autre", texte: "p11", contexte: CTX }, { headers: vu(30), clientKey: "203.0.113.10" })).status).toBe(429);
  });

  it("sans profil : l'envoi est permis mais aucune réponse ne peut parvenir ; la liste et un fil exigent un identifiant", async () => {
    const t = await api();
    const r = await t.call("POST", "/api/retours", { type: "suggestion", texte: "Un 4e jeu ?", contexte: CTX }, { clientKey: ip() });
    expect(r.body.reponsePossible).toBe(false);
    const ligne = await t.db.first<{ player_id: string | null; ref: string | null }>("SELECT player_id, ref FROM retours WHERE id = ?", [r.body.id]);
    expect(ligne).toEqual({ player_id: null, ref: null });
    expect((await get(t, null, "/api/retours")).body.error).toBe("invalid_player");
    const adm = await connecte(t);
    const rep = await adm("POST", `/api/admin/retours/${r.body.id}/repondre`, { ...confirmer, texte: "Oui !" });
    expect([rep.status, rep.body.error]).toEqual([400, "invalid_action"]);
  });

  it("le contexte public donne la version et le jour, avec un cache public", async () => {
    const t = await api();
    const r = await t.call("GET", "/api/retours/contexte", undefined, { clientKey: ip() });
    expect(r.body).toEqual({ version: "prod-2026-10-19-1830", jour: formatDay(TODAY) });
    expect(r.headers.get("cache-control")).toBe("public, max-age=300");
    const avec = await get(t, 1, "/api/retours/contexte");
    expect(avec.body).toEqual({ version: "prod-2026-10-19-1830", jour: formatDay(TODAY), reference: await refOfPlayer(playerId(1)) });
    expect(avec.headers.get("cache-control")).toBe("private, max-age=300");
    expect(avec.headers.get("vary")).toContain("X-Player-Id");
    expect(JSON.stringify(avec.body)).not.toContain(playerId(1));
  });

  it("un code révoqué ne peut plus écrire (410)", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    await t.db.run("INSERT INTO revoked_codes (hash, successor, revoked_at) VALUES (?, 'x', 0)", [await sha256Hex(playerId(1))]);
    const r = await envoi(t, 1);
    expect([r.status, r.body.error]).toEqual([410, "code_revoked"]);
  });

  it("un fil complet refuse d'autres messages", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    const id = (await envoi(t, 1)).body.id as number;
    await t.db.run("UPDATE retours SET nb_messages = ? WHERE id = ?", [RETOUR_MESSAGES_MAX, id]);
    const r = await post(t, 1, `/api/retours/${id}/messages`, { texte: "encore" });
    expect([r.status, r.body.error]).toEqual([409, "feedback_full"]);
  });
});

describe(`retours : l'administration et les non lus (${TEST_DB})`, () => {
  it("la réponse de l'éditeur arrive dans messagesNonLus (portail), « lu » l'éteint ; la réponse du joueur rallume le non lu de l'éditeur", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    const id = (await envoi(t, 1)).body.id as number;
    expect((await get(t, 1, "/api/portail/jour")).body.joueur?.messagesNonLus ?? 0).toBe(0);
    const adm = await connecte(t);
    expect((await adm("GET", "/api/admin/retours/compte")).body).toEqual({ nonLus: 1 });
    const rep = await adm("POST", `/api/admin/retours/${id}/repondre`, { ...confirmer, texte: "Merci, corrigé demain." });
    expect(rep.status, JSON.stringify(rep.body)).toBe(200);
    expect(rep.body.statut).toBe("lu");
    expect((await adm("GET", "/api/admin/retours/compte")).body).toEqual({ nonLus: 0 });
    const jour = await get(t, 1, "/api/portail/jour");
    expect(jour.body.joueur.messagesNonLus).toBe(1);
    expect((await get(t, 1, "/api/retours")).body).toMatchObject({ nonLus: 1, fils: [{ nonLu: true, messages: 2 }] });
    // Une lecture ne modifie rien ; c'est « lu » qui éteint la pastille.
    await get(t, 1, `/api/retours/${id}`);
    expect((await get(t, 1, "/api/portail/jour")).body.joueur.messagesNonLus).toBe(1);
    await post(t, 1, `/api/retours/${id}/lu`);
    expect((await get(t, 1, "/api/portail/jour")).body.joueur.messagesNonLus).toBe(0);
    await adm("POST", `/api/admin/retours/${id}/statut`, { ...confirmer, statut: "traite" });
    await post(t, 1, `/api/retours/${id}/messages`, { texte: "Toujours là." });
    expect((await adm("GET", "/api/admin/retours/compte")).body).toEqual({ nonLus: 1 });
    expect((await adm("GET", `/api/admin/retours/${id}`)).body.statut).toBe("nouveau"); // un fil traité repart « nouveau » quand le joueur répond
  });

  it("liste filtrée (type, jeu, statut), détail avec le joueur, statuts, journal sans texte", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    const a = (await envoi(t, 1, "Premier", "bug")).body.id as number;
    const b = (await post(t, 1, "/api/retours", { type: "suggestion", texte: "Second", contexte: { ...CTX, jeu: "tower" } })).body.id as number;
    const adm = await connecte(t);
    const tous = await adm("GET", "/api/admin/retours");
    expect(tous.body.retours.map((r: { id: number }) => r.id)).toEqual([b, a]);
    expect(tous.body.nonLus).toBe(2);
    expect((await adm("GET", "/api/admin/retours?type=suggestion")).body.retours.map((r: { id: number }) => r.id)).toEqual([b]);
    expect((await adm("GET", "/api/admin/retours?jeu=jump")).body.retours.map((r: { id: number }) => r.id)).toEqual([a]);
    expect((await adm("GET", "/api/admin/retours?statut=nouveau&type=bug&jeu=jump")).body.retours).toHaveLength(1);
    expect((await adm("GET", "/api/admin/retours?statut=nimporte")).body.error).toBe("invalid_action");
    const det = await adm("GET", `/api/admin/retours/${a}`);
    expect(det.body).toMatchObject({ pseudo: "Alice", ref: await refOfPlayer(playerId(1)), reponsePossible: true, contexte: { jeu: "jump" } });
    expect(JSON.stringify(det.body)).not.toContain(playerId(1));
    expect((await adm("POST", `/api/admin/retours/${a}/lu`, confirmer)).body.statut).toBe("lu");
    for (const statut of ["en_cours", "traite", "refuse"]) expect((await adm("POST", `/api/admin/retours/${a}/statut`, { ...confirmer, statut })).body.statut).toBe(statut);
    expect((await adm("POST", `/api/admin/retours/${a}/statut`, { ...confirmer, statut: "refuse" })).status).toBe(400);
    expect((await adm("POST", `/api/admin/retours/${a}/statut`, { statut: "lu" })).status).toBe(400); // confirmation exigée
    expect((await adm("POST", `/api/admin/retours/${a}/statut`, { ...confirmer, statut: "autre" })).status).toBe(400);
    await adm("POST", `/api/admin/retours/${a}/repondre`, { ...confirmer, texte: "Réponse secrète du journal" });
    const journal = (await adm("GET", "/api/admin/journal")).body.lignes as { action: string; cible: string; apres: unknown }[];
    expect(journal.map((l) => l.action)).toEqual(expect.arrayContaining(["lire un retour", "changer le statut d'un retour", "répondre à un retour"]));
    expect(JSON.stringify(journal)).not.toContain("Réponse secrète");
    expect(JSON.stringify(journal)).not.toContain(playerId(1));
  });

  it("l'administration exige la session, l'en-tête et la confirmation", async () => {
    const t = await api();
    expect((await t.call("GET", "/api/admin/retours")).status).toBe(401);
    expect((await t.call("GET", "/api/admin/retours/compte")).status).toBe(401);
    const adm = await connecte(t);
    expect((await adm("GET", "/api/admin/retours/12")).body.error).toBe("unknown_feedback");
    expect((await adm("DELETE", "/api/admin/retours")).status).toBe(405);
  });
});

describe(`retours : effacement, changement de code, durée de garde (${TEST_DB})`, () => {
  it("effacer un profil emporte ses retours et leurs messages, pas ceux des autres", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    await joueur(t, 2, "Bob");
    await envoi(t, 1);
    await envoi(t, 2);
    const adm = await connecte(t);
    const r = await adm("POST", `/api/admin/joueurs/${await refOfPlayer(playerId(1))}/supprimer`, { ...confirmer, pseudo: "Alice" });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(await t.db.all("SELECT player_id FROM retours")).toEqual([{ player_id: playerId(2) }]);
    expect((await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM retours_messages"))!.n).toBe(1);
  });

  it("« Changer mon code » : les fils suivent le joueur, avec sa nouvelle référence", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    const id = (await envoi(t, 1)).body.id as number;
    const neuf = playerId(77);
    const r = await t.call("POST", "/api/me/code", { newId: neuf }, { headers: vu(1), clientKey: ip() });
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect((await get(t, 77, `/api/retours/${id}`)).status).toBe(200);
    expect((await t.db.first<{ ref: string }>("SELECT ref FROM retours WHERE id = ?", [id]))!.ref).toBe(await refOfPlayer(neuf));
  });

  it("l'entretien efface un fil 12 mois après son dernier message, pas avant", async () => {
    const t = await api();
    await joueur(t, 1, "Alice");
    const vieux = (await envoi(t, 1, "vieux")).body.id as number;
    const recent = (await envoi(t, 1, "récent")).body.id as number;
    await t.db.run("UPDATE retours SET maj_le = ? WHERE id = ?", [MIDI - (RETOURS_GARDE_JOURS + 1) * JOUR_MS, vieux]);
    await t.db.run("UPDATE retours SET maj_le = ? WHERE id = ?", [MIDI - (RETOURS_GARDE_JOURS - 1) * JOUR_MS, recent]);
    t.clock.now += 2 * 3_600_000; // l'entretien passe au plus une fois par heure et par instance : il a déjà eu lieu au premier envoi
    await post(t, 1, "/api/retours", { type: "autre", texte: "déclenche l'entretien (une écriture)", contexte: CTX });
    expect((await t.db.all<{ id: number }>("SELECT id FROM retours ORDER BY id")).map((r) => r.id)).toEqual([recent, recent + 1]);
    expect((await t.db.all("SELECT 1 FROM retours_messages WHERE retour_id = ?", [vieux]))).toHaveLength(0);
  });
});
