import { describe, expect, it } from "vitest";
import { SCHEMA } from "../src/db";
import { semerNouveautes, NOUVEAUTES_PAR_PAGE, ANNONCE_S_MAXAGE } from "../src/diffusion";
import { ADMIN_EMAIL, CLIENT_ID, SESSION_KEY } from "./adminHelpers";
import { makeApi, NOON, TEST_DB, type TestApi } from "./helpers";

// Lot N2 (plateforme) : les nouveautés et le message en direct côté serveur — enregistrement, publication (bloquée sans anglais), message unique qui s'éteint seul,
// lectures publiques et leurs en-têtes de cache, journal (même transaction), plans de requête. SQLite **et** libSQL.

const ORIGIN = "http://api.test";
const MIN = 60_000;
const confirmer = { confirmer: true };
const OPTIONS_ADMIN = { emails: [ADMIN_EMAIL], sessionKey: SESSION_KEY, clientId: CLIENT_ID, fakeVerifier: true };

async function panneau(): Promise<{ t: TestApi; adm: (method: string, path: string, body?: unknown, extra?: Record<string, string>) => ReturnType<TestApi["call"]> }> {
  const t = await makeApi({ seed: false, admin: OPTIONS_ADMIN });
  await t.call("GET", "/api/health"); // le schéma
  const r = await t.call("POST", "/api/admin/session", { credential: `factice:${ADMIN_EMAIL}` }, { headers: { Origin: ORIGIN, "X-Cdj-Admin": "1" } });
  expect(r.status).toBe(200);
  const cookie = /__session=([^;]+)/.exec(r.headers.get("set-cookie") ?? "")![1]!;
  const headers = { Cookie: `__session=${cookie}`, Origin: ORIGIN, "X-Cdj-Admin": "1" };
  return { t, adm: (method, path, body, extra = {}) => t.call(method, path, body, { headers: { ...headers, ...extra } }) };
}

const ligne = (zone: string, fr: string, en: string) => ({ zone, fr, en });
const nouveaute = (o: Record<string, unknown> = {}) => ({
  titre: { fr: "Le bouton caméra revient", en: "The camera button is back" },
  date: "2026-10-27",
  lignes: [ligne("track", "Le bouton caméra revient à l'écran sur téléphone.", "The camera button is back on screen on phones.")],
  publier: false,
  ...confirmer,
  ...o,
});

describe(`nouveautés : administration (${TEST_DB})`, () => {
  it("sans session ou sans les en-têtes d'écriture, rien n'est possible (401, 403)", async () => {
    const { t, adm } = await panneau();
    expect((await t.call("GET", "/api/admin/nouveautes")).status).toBe(401);
    expect((await t.call("POST", "/api/admin/message", {})).status).toBe(401);
    expect((await adm("POST", "/api/admin/nouveautes", nouveaute(), { "X-Cdj-Admin": "0" })).status).toBe(403);
    expect((await adm("POST", "/api/admin/nouveautes", { ...nouveaute(), confirmer: undefined })).status).toBe(400);
  });

  it("enregistre un brouillon incomplet, le relit, et refuse de publier une ligne sans anglais : « Anglais : n lignes pas encore traduites »", async () => {
    const { adm } = await panneau();
    const incomplet = nouveaute({ lignes: [ligne("track", "Une phrase", ""), ligne("jump", "Une autre", ""), ligne("dujour", "Complète", "Complete")] });
    const brouillon = await adm("POST", "/api/admin/nouveautes", incomplet);
    expect(brouillon.status, JSON.stringify(brouillon.body)).toBe(200);
    expect(brouillon.body.nouveaute).toMatchObject({ statut: "brouillon", publieLe: null });
    const refus = await adm("POST", "/api/admin/nouveautes", { ...incomplet, id: brouillon.body.nouveaute.id, publier: true });
    expect(refus.status).toBe(400);
    expect(refus.body).toEqual({ error: "invalid_news", problemes: [{ code: "anglais", n: 2 }] });
    // Rien n'a été publié.
    expect((await adm("GET", "/api/admin/nouveautes")).body.nouveautes[0].statut).toBe("brouillon");
    // Titre anglais manquant et ligne sans zone bloquent aussi.
    const autres = await adm("POST", "/api/admin/nouveautes", nouveaute({ titre: { fr: "Titre", en: "" }, lignes: [ligne("", "x", "y")], publier: true }));
    expect(autres.body.problemes).toEqual([{ code: "titre_en" }, { code: "zone", n: 1 }]);
  });

  it("publie une nouveauté complète : elle est lue par tous, dépubliée elle disparaît, supprimée aussi ; chaque action est au journal", async () => {
    const { t, adm } = await panneau();
    const publiee = await adm("POST", "/api/admin/nouveautes", nouveaute({ publier: true }));
    expect(publiee.status, JSON.stringify(publiee.body)).toBe(200);
    const id = publiee.body.nouveaute.id as number;
    expect(publiee.body.nouveaute.statut).toBe("publiee");

    const lue = await t.call("GET", "/api/portail/nouveautes");
    expect(lue.status).toBe(200);
    expect(lue.body.nouveautes).toHaveLength(1);
    expect(lue.body.nouveautes[0]).toMatchObject({ id, date: "2026-10-27", titre: { fr: "Le bouton caméra revient", en: "The camera button is back" } });
    expect(lue.body.nouveautes[0].lignes).toEqual([ligne("track", "Le bouton caméra revient à l'écran sur téléphone.", "The camera button is back on screen on phones.")]);

    expect((await adm("POST", `/api/admin/nouveautes/${id}/depublier`, confirmer)).body.nouveaute.statut).toBe("brouillon");
    expect((await t.call("GET", "/api/portail/nouveautes")).body.nouveautes).toEqual([]);
    expect((await adm("POST", `/api/admin/nouveautes/${id}/depublier`, confirmer)).status).toBe(400); // plus publiée
    expect((await adm("POST", `/api/admin/nouveautes/${id}/supprimer`, confirmer)).body).toEqual({ supprimee: true });
    expect((await adm("POST", `/api/admin/nouveautes/${id}/supprimer`, confirmer)).status).toBe(404);

    const journal = (await adm("GET", "/api/admin/journal")).body.lignes as { action: string; cible: string }[];
    expect(journal.map((l) => l.action).reverse()).toEqual(["publier une nouveauté", "dépublier une nouveauté", "supprimer une nouveauté"]);
    expect(journal.at(-1)!.cible).toContain(`n° ${id}`); // le numéro donné par la base, écrit dans la même transaction
  });

  it("modifier une nouveauté publiée ne la fait pas repasser « non lue » ; la republier après l'avoir dépubliée, si", async () => {
    const { t, adm } = await panneau();
    t.clock.now = NOON;
    const id = (await adm("POST", "/api/admin/nouveautes", nouveaute({ publier: true }))).body.nouveaute.id as number;
    const premiere = (await adm("GET", "/api/admin/nouveautes")).body.nouveautes[0].publieLe;
    t.clock.now = NOON + 5 * MIN;
    await adm("POST", "/api/admin/nouveautes", nouveaute({ id, publier: true, titre: { fr: "Titre corrigé", en: "Fixed title" } }));
    const modifiee = (await adm("GET", "/api/admin/nouveautes")).body.nouveautes[0];
    expect(modifiee.publieLe).toBe(premiere);
    expect(modifiee.titre.fr).toBe("Titre corrigé");
    expect((await adm("GET", "/api/admin/journal")).body.lignes[0].action).toBe("modifier une nouveauté");
    t.clock.now = NOON + 10 * MIN;
    await adm("POST", `/api/admin/nouveautes/${id}/depublier`, confirmer);
    t.clock.now = NOON + 20 * MIN;
    await adm("POST", "/api/admin/nouveautes", nouveaute({ id, publier: true }));
    expect(Date.parse((await adm("GET", "/api/admin/nouveautes")).body.nouveautes[0].publieLe)).toBe(NOON + 20 * MIN);
  });

  it("garde un texte comme un texte : une balise n'est pas interprétée, un numéro de PR illisible est ignoré, une zone inconnue bloque", async () => {
    const { t, adm } = await panneau();
    const piege = nouveaute({
      publier: true,
      titre: { fr: "<img src=x onerror=alert(1)>", en: "<b>bold</b>" },
      lignes: [{ zone: "track", fr: "<script>1</script>\nsur deux lignes", en: "ok", pr: 12 }, { zone: "jump", fr: "a", en: "b", pr: "x" }],
    });
    const r = await adm("POST", "/api/admin/nouveautes", piege);
    expect(r.status).toBe(200);
    expect(r.body.nouveaute.titre.fr).toBe("<img src=x onerror=alert(1)>"); // gardé tel quel : c'est le client qui le pose en textContent
    expect(r.body.nouveaute.lignes[0]).toEqual({ zone: "track", fr: "<script>1</script> sur deux lignes", en: "ok", pr: 12 });
    expect(r.body.nouveaute.lignes[1]).toEqual({ zone: "jump", fr: "a", en: "b" });
    // Le public ne voit pas la PR d'origine.
    expect((await t.call("GET", "/api/portail/nouveautes")).body.nouveautes[0].lignes[0]).toEqual({ zone: "track", fr: "<script>1</script> sur deux lignes", en: "ok" });
    const inconnue = await adm("POST", "/api/admin/nouveautes", nouveaute({ publier: true, lignes: [{ zone: "plateforme", fr: "a", en: "b" }] }));
    expect(inconnue.body.problemes).toEqual([{ code: "zone", n: 1 }]);
  });
});

describe(`nouveautés : lecture publique (${TEST_DB})`, () => {
  it("20 par page, la plus récente d'abord, « plus anciennes » par `avant`, cache public court", async () => {
    const { t, adm } = await panneau();
    for (let i = 1; i <= 25; i++) {
      const jour = String(i).padStart(2, "0");
      const r = await adm("POST", "/api/admin/nouveautes", nouveaute({ publier: true, date: `2026-10-${jour}`, titre: { fr: `N° ${i}`, en: `No. ${i}` } }));
      expect(r.status, JSON.stringify(r.body)).toBe(200);
    }
    const premiere = await t.call("GET", "/api/portail/nouveautes");
    expect(premiere.headers.get("cache-control")).toBe("public, max-age=60");
    expect(premiere.body.nouveautes).toHaveLength(NOUVEAUTES_PAR_PAGE);
    expect(premiere.body.nouveautes[0].titre.fr).toBe("N° 25");
    expect(premiere.body.nouveautes.at(-1).titre.fr).toBe("N° 6");
    expect(premiere.body.suivante).toMatch(/^2026-10-06\.\d+$/);
    const deuxieme = await t.call("GET", `/api/portail/nouveautes?avant=${premiere.body.suivante}`);
    expect(deuxieme.body.nouveautes.map((n: { titre: { fr: string } }) => n.titre.fr)).toEqual(["N° 5", "N° 4", "N° 3", "N° 2", "N° 1"]);
    expect(deuxieme.body.suivante).toBeNull();
    // Un curseur mal formé est refusé (pas de 500).
    expect((await t.call("GET", "/api/portail/nouveautes?avant=n-importe-quoi")).body).toEqual({ error: "invalid_cursor" });
    expect((await t.call("POST", "/api/portail/nouveautes", {})).status).toBe(405);
  });

  it("à date égale, la dernière publiée passe devant ; les brouillons ne sortent jamais", async () => {
    const { t, adm } = await panneau();
    await adm("POST", "/api/admin/nouveautes", nouveaute({ publier: true, titre: { fr: "A", en: "A" } }));
    await adm("POST", "/api/admin/nouveautes", nouveaute({ publier: true, titre: { fr: "B", en: "B" } }));
    await adm("POST", "/api/admin/nouveautes", nouveaute({ publier: false, titre: { fr: "Brouillon", en: "Draft" } }));
    expect((await t.call("GET", "/api/portail/nouveautes")).body.nouveautes.map((n: { titre: { fr: string } }) => n.titre.fr)).toEqual(["B", "A"]);
  });
});

describe(`message en direct (${TEST_DB})`, () => {
  const message = (o: Record<string, unknown> = {}) => ({ fr: "Maintenance ce soir à 22 h.", en: "Maintenance tonight at 10 pm.", ou: ["portail", "track"], ton: "information", fin: NOON + 60 * MIN, ...confirmer, ...o });

  it("refuse ce qui n'est pas un texte simple : 160 caractères, ni lien ni HTML, endroit, ton, fin", async () => {
    const { adm } = await panneau();
    const problemes = async (o: Record<string, unknown>) => (await adm("POST", "/api/admin/message", message(o))).body.problemes as { code: string }[];
    expect(await problemes({ fr: "" })).toEqual([{ code: "fr" }]);
    expect(await problemes({ en: "x".repeat(161) })).toEqual([{ code: "long", langue: "en" }]);
    expect(await problemes({ fr: "Va sur https://exemple.test" })).toEqual([{ code: "lien", langue: "fr" }]);
    expect(await problemes({ en: "<b>hi</b>" })).toEqual([{ code: "lien", langue: "en" }]);
    expect(await problemes({ en: "Go to example.com" })).toEqual([{ code: "lien", langue: "en" }]);
    expect(await problemes({ ou: [] })).toEqual([{ code: "ou" }]);
    expect(await problemes({ ton: "alerte" })).toEqual([{ code: "ton" }]);
    expect(await problemes({ fin: NOON - 1 })).toEqual([{ code: "fin_passee" }]);
    expect(await problemes({ fin: NOON + 8 * 86_400_000 })).toEqual([{ code: "fin_lointaine" }]);
    expect((await adm("POST", "/api/admin/message", { ...message(), confirmer: undefined })).status).toBe(400);
    // 160 caractères exactement : accepté (un émoji compte pour un).
    expect((await adm("POST", "/api/admin/message", message({ fr: "é".repeat(159) + "😀" }))).status).toBe(200);
  });

  it("un seul message actif : en poser un nouveau retire l'ancien dans la même transaction ; « Retirer maintenant » l'éteint ; messages passés et journal", async () => {
    const { t, adm } = await panneau();
    expect((await t.call("GET", "/api/annonce")).body.annonce).toBeNull();
    const un = await adm("POST", "/api/admin/message", message());
    expect(un.status, JSON.stringify(un.body)).toBe(200);
    const id1 = un.body.actif.id as number;
    t.clock.now = NOON + 5 * MIN;
    const deux = await adm("POST", "/api/admin/message", message({ fr: "Retour à la normale.", en: "Back to normal.", ou: ["jump"], ton: "important" }));
    const id2 = deux.body.actif.id as number;
    expect(id2).toBeGreaterThan(id1);
    const nb = await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM annonces WHERE retire_le IS NULL AND fin > ?", [t.clock.now]);
    expect(nb!.n).toBe(1);
    const lu = (await t.call("GET", "/api/annonce")).body.annonce;
    expect(lu).toEqual({ id: id2, fr: "Retour à la normale.", en: "Back to normal.", ou: ["jump"], ton: "important", fin: NOON + 60 * MIN });
    const etat = (await adm("GET", "/api/admin/message")).body;
    expect(etat.actif.id).toBe(id2);
    expect(etat.passes.map((p: { id: number }) => p.id)).toEqual([id1]);
    expect((await adm("POST", "/api/admin/message/retirer", confirmer)).body).toEqual({ actif: null });
    expect((await t.call("GET", "/api/annonce")).body.annonce).toBeNull();
    expect((await adm("POST", "/api/admin/message/retirer", confirmer)).status).toBe(400); // rien à retirer
    const actions = ((await adm("GET", "/api/admin/journal")).body.lignes as { action: string }[]).map((l) => l.action).reverse();
    expect(actions).toEqual(["publier un message en direct", "mettre à jour le message en direct", "retirer le message en direct"]);
  });

  it("il s'éteint seul à l'heure de fin : lu juste avant, il est là ; à l'heure pile, il n'y est plus (accueil et `/api/annonce`)", async () => {
    const { t, adm } = await panneau();
    await adm("POST", "/api/admin/message", message({ fin: NOON + 10 * MIN }));
    t.clock.now = NOON + 10 * MIN - 1;
    expect((await t.call("GET", "/api/annonce")).body.annonce).not.toBeNull();
    t.clock.now = NOON + 10 * MIN;
    expect((await t.call("GET", "/api/annonce")).body.annonce).toBeNull();
    expect((await adm("GET", "/api/admin/message")).body.actif).toBeNull();
  });

  it("`GET /api/annonce` : `public, max-age=0, s-maxage=30`, sans identifiant ; la méthode est GET ; ses en-têtes de sécurité restent", async () => {
    const { t, adm } = await panneau();
    await adm("POST", "/api/admin/message", message());
    const r = await t.call("GET", "/api/annonce");
    expect(r.headers.get("cache-control")).toBe(`public, max-age=0, s-maxage=${ANNONCE_S_MAXAGE}`);
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Date.parse(r.body.maintenant)).toBe(t.clock.now);
    // Une réponse publique ne dépend pas du joueur : l'identifiant n'y change rien et rien n'y est lu.
    const avecId = await t.call("GET", "/api/annonce", undefined, { headers: { "X-Player-Id": "0".repeat(32) } });
    expect(avecId.body.annonce).toEqual(r.body.annonce);
    expect((await t.call("POST", "/api/annonce", {})).status).toBe(405);
    // L'écriture reste réservée à la session : un visiteur ne pose rien.
    expect((await t.call("POST", "/api/admin/message", message())).status).toBe(401);
  });

  it("l'accueil (`GET /api/portail/jour`) porte le message actif et la dernière nouveauté : une seule requête au chargement", async () => {
    const t = await makeApi({ admin: OPTIONS_ADMIN });
    const connecte = await t.call("POST", "/api/admin/session", { credential: `factice:${ADMIN_EMAIL}` }, { headers: { Origin: ORIGIN, "X-Cdj-Admin": "1" } });
    const cookie = /__session=([^;]+)/.exec(connecte.headers.get("set-cookie") ?? "")![1]!;
    const adm = (path: string, body: unknown) => t.call("POST", path, body, { headers: { Cookie: `__session=${cookie}`, Origin: ORIGIN, "X-Cdj-Admin": "1" } });
    expect((await t.call("GET", "/api/portail/jour")).body).toMatchObject({ nouveaute: null, annonce: null });
    await adm("/api/admin/nouveautes", nouveaute({ publier: true }));
    await adm("/api/admin/message", message());
    const jour = (await t.call("GET", "/api/portail/jour")).body;
    expect(jour.nouveaute).toMatchObject({ date: "2026-10-27", titre: { fr: "Le bouton caméra revient", en: "The camera button is back" } });
    expect(typeof jour.nouveaute.publieLe).toBe("number");
    expect(jour.annonce).toMatchObject({ fr: "Maintenance ce soir à 22 h.", ou: ["portail", "track"], ton: "information", fin: NOON + 60 * MIN });
    // Même chose avec un identifiant inconnu : le corps d'erreur porte la partie publique (une seule requête, règle du lot I3).
    const inconnu = await t.call("GET", "/api/portail/jour", undefined, { headers: { "X-Player-Id": "1".repeat(32) } });
    expect(inconnu.status).toBe(404);
    expect(inconnu.body.annonce).toMatchObject({ ton: "information" });
  });
});

describe(`coût : les lectures ne parcourent jamais une table entière (${TEST_DB})`, () => {
  it("le message actif, la dernière nouveauté et chaque page passent par un index", async () => {
    const t = await makeApi({ seed: false });
    for (const sql of SCHEMA) await t.db.run(sql);
    const requetes: [string, (string | number)[]][] = [
      ["SELECT id FROM annonces WHERE fin > ? AND retire_le IS NULL ORDER BY fin DESC LIMIT 1", [NOON]],
      ["SELECT id FROM nouveautes WHERE statut = 'publiee' ORDER BY date_affichee DESC, id DESC LIMIT 1", []],
      ["SELECT id FROM nouveautes WHERE statut = 'publiee' AND (date_affichee < ? OR (date_affichee = ? AND id < ?)) ORDER BY date_affichee DESC, id DESC LIMIT 21", ["2026-10-27", "2026-10-27", 5]],
    ];
    if (TEST_DB !== "sqlite") return; // `EXPLAIN QUERY PLAN` : le même moteur côté libSQL ; le plan se lit sur la base SQLite des tests
    for (const [sql, params] of requetes) {
      const plan = (await t.db.all<{ detail: string }>(`EXPLAIN QUERY PLAN ${sql}`, params)).map((l) => l.detail);
      expect(plan.some((d) => /USING (COVERING )?INDEX/.test(d)), `${sql} → ${plan.join(" | ")}`).toBe(true);
      expect(plan.some((d) => /TEMP B-TREE/.test(d)), `${sql} → ${plan.join(" | ")}`).toBe(false);
    }
  });
});

describe(`recette:seed : deux nouveautés publiées, aucun message actif (${TEST_DB})`, () => {
  it("sème deux nouveautés une seule fois et ne touche ni à une vraie nouveauté ni au message", async () => {
    const t = await makeApi({ seed: false });
    for (const sql of SCHEMA) await t.db.run(sql);
    expect(await semerNouveautes(t.db, NOON)).toEqual({ creees: 2 });
    expect(await semerNouveautes(t.db, NOON + 1)).toEqual({ creees: 0 });
    const lues = (await t.call("GET", "/api/portail/nouveautes")).body.nouveautes;
    expect(lues).toHaveLength(2);
    expect(lues.every((n: { titre: { fr: string; en: string }; lignes: { en: string }[] }) => n.titre.fr.startsWith("Recette") && n.titre.en !== "" && n.lignes.every((l) => l.en !== ""))).toBe(true);
    expect((await t.call("GET", "/api/annonce")).body.annonce).toBeNull();
  });
});

describe(`migration réversible (${TEST_DB})`, () => {
  it("une base d'avant le lot reçoit les deux tables au démarrage, sans toucher au reste ; sans elles, l'accueil marche encore (retour arrière)", async () => {
    const t = await makeApi();
    await t.call("GET", "/api/health");
    await t.db.run("INSERT INTO players (id, name, created_at, updated_at, name_key) VALUES ('p1', 'Alice', 1, 1, 'alice')");
    // Retour arrière : on retire les deux tables (et leurs index avec) ; l'ancien code ne les connaît pas.
    await t.db.run("DROP TABLE nouveautes");
    await t.db.run("DROP TABLE annonces");
    await t.db.run("DELETE FROM meta WHERE key = 'schema'");
    // Le démarrage suivant les recrée, vides ; le joueur d'avant est intact.
    const t2 = await makeApi({ db: t.db, seed: false });
    expect((await t2.call("GET", "/api/health")).status).toBe(200);
    expect(await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM nouveautes")).toEqual({ n: 0 });
    expect(await t.db.first<{ n: number }>("SELECT COUNT(*) AS n FROM annonces")).toEqual({ n: 0 });
    expect(await t.db.first<{ name: string }>("SELECT name FROM players WHERE id = 'p1'")).toEqual({ name: "Alice" });
    // Sans les tables (code d'avant ou panne) : la réponse de l'accueil n'échoue jamais pour cela.
    await t.db.run("DROP TABLE annonces");
    const jour = await t2.call("GET", "/api/portail/jour");
    expect(jour.status).toBe(200);
    expect(jour.body).toMatchObject({ nouveaute: null, annonce: null });
  });
});
