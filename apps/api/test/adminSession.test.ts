import { describe, expect, it } from "vitest";
import { SESSION_COOKIE, SESSION_MS, SESSIONS_GARDEES_MS, cookieDe, cookieEfface, cookieOuvert, createSessions } from "../src/adminSession";
import { SCHEMA } from "../src/db";
import { ADMIN_EMAIL, SESSION_KEY } from "./adminHelpers";
import { TEST_DB, openTestDb } from "./helpers";

// Lot N1 : la session du panneau d'administration — cookie signé (HMAC), valable une heure, sans adresse en clair, révocable côté serveur. SQLite et libSQL.

async function sessions(cle = SESSION_KEY) {
  const db = await openTestDb();
  for (const sql of SCHEMA) await db.run(sql);
  const horloge = { now: Date.UTC(2026, 9, 28, 12) };
  return { db, horloge, s: createSessions({ db, now: () => horloge.now, cle }) };
}

describe(`session d'administration (${TEST_DB})`, () => {
  it("ouvre une session d'une heure qui se relit, et ne contient pas l'adresse (ni en clair, ni en base64)", async () => {
    const { s, horloge } = await sessions();
    const admin = await s.empreinteAdmin(ADMIN_EMAIL);
    expect(admin).toMatch(/^[0-9a-f]{12}$/);
    expect(admin).not.toContain("admin");
    const { cookie, session } = await s.ouvrir(admin);
    expect(session.expire).toBe(horloge.now + SESSION_MS);
    expect(SESSION_MS).toBe(3_600_000);
    expect(await s.lire(cookie)).toEqual(session);
    expect(cookie).not.toContain(ADMIN_EMAIL);
    const charge = Buffer.from(cookie.split(".")[0]!, "base64url").toString();
    expect(charge).not.toContain("@");
    expect(JSON.parse(charge)).toEqual({ s: session.id, a: admin, e: session.expire });
  });

  it("l'empreinte d'un administrateur dépend de la clé : sans elle, l'adresse ne se retrouve pas en hachant des candidats", async () => {
    const a = await sessions();
    const b = await sessions("une-autre-cle-de-session-de-test-tout-aussi-longue");
    expect(await a.s.empreinteAdmin(ADMIN_EMAIL)).toBe(await a.s.empreinteAdmin(ADMIN_EMAIL));
    expect(await a.s.empreinteAdmin(ADMIN_EMAIL)).not.toBe(await b.s.empreinteAdmin(ADMIN_EMAIL));
    expect(await a.s.empreinteAdmin("autre@example.test")).not.toBe(await a.s.empreinteAdmin(ADMIN_EMAIL));
  });

  it("expire au bout d'une heure, à la milliseconde", async () => {
    const { s, horloge } = await sessions();
    const { cookie } = await s.ouvrir("abcdef012345");
    horloge.now += SESSION_MS - 1;
    expect(await s.lire(cookie)).not.toBeNull();
    horloge.now += 1;
    expect(await s.lire(cookie)).toBeNull();
  });

  it("refuse une signature falsifiée : charge modifiée, signature d'une autre session, clé d'un autre serveur", async () => {
    const { s } = await sessions();
    const a = await s.ouvrir("abcdef012345");
    const b = await s.ouvrir("abcdef012345");
    const [chargeA, sigA] = a.cookie.split(".") as [string, string];
    const [chargeB, sigB] = b.cookie.split(".") as [string, string];
    expect(await s.lire(`${chargeA}.${sigB}`)).toBeNull();
    expect(await s.lire(`${chargeB}.${sigA}`)).toBeNull();
    const forgee = Buffer.from(JSON.stringify({ s: a.session.id, a: "000000000000", e: a.session.expire + 99_999_999 })).toString("base64url");
    expect(await s.lire(`${forgee}.${sigA}`)).toBeNull();
    const autre = await sessions("une-autre-cle-de-session-de-test-tout-aussi-longue");
    expect(await autre.s.lire(a.cookie)).toBeNull();
  });

  it("refuse ce qui n'a pas la forme : vide, sans point, trop de points, base64 illisible, trop long", async () => {
    const { s } = await sessions();
    for (const x of [null, undefined, "", "abc", "a.b.c", ".", "é.é", "!!!.???", "x".repeat(700)]) expect(await s.lire(x), String(x).slice(0, 8)).toBeNull();
  });

  it("la déconnexion révoque la session côté serveur : le même cookie, encore valide par sa signature et sa date, ne vaut plus rien", async () => {
    const { s, db } = await sessions();
    const { cookie, session } = await s.ouvrir("abcdef012345");
    expect(await s.lire(cookie)).not.toBeNull();
    await s.revoquer(session.id);
    expect(await s.lire(cookie)).toBeNull();
    expect((await db.first<{ revoked_at: number | null }>("SELECT revoked_at FROM admin_sessions WHERE sid = ?", [session.id]))!.revoked_at).not.toBeNull();
  });

  it("une session dont la ligne a disparu de la base n'est plus valable", async () => {
    const { s, db } = await sessions();
    const { cookie } = await s.ouvrir("abcdef012345");
    await db.run("DELETE FROM admin_sessions");
    expect(await s.lire(cookie)).toBeNull();
  });

  it("efface au passage les sessions finies depuis plus d'un jour", async () => {
    const { s, db, horloge } = await sessions();
    await s.ouvrir("abcdef012345");
    horloge.now += SESSION_MS + SESSIONS_GARDEES_MS + 1;
    await s.ouvrir("abcdef012345");
    expect((await db.first<{ n: number }>("SELECT COUNT(*) AS n FROM admin_sessions"))!.n).toBe(1);
  });
});

describe("cookie `__session`", () => {
  it("n'est lu que sous ce nom, parmi d'autres cookies", () => {
    const req = (cookie?: string) => new Request("http://api.test/", { headers: cookie ? { cookie } : {} });
    expect(cookieDe(req(`a=1; ${SESSION_COOKIE}=valeur.sig; b=2`))).toBe("valeur.sig");
    expect(cookieDe(req(`session=pas-celui-la; x__session=non`))).toBeNull();
    expect(cookieDe(req())).toBeNull();
  });

  it("est HttpOnly, Secure, SameSite=Strict, d'une heure ; la déconnexion l'efface avec les mêmes attributs", () => {
    expect(SESSION_COOKIE).toBe("__session"); // le seul nom que Firebase Hosting transmet à Cloud Run
    const c = cookieOuvert("v.s");
    for (const attr of ["__session=v.s", "Path=/", "HttpOnly", "Secure", "SameSite=Strict", "Max-Age=3600"]) expect(c).toContain(attr);
    for (const attr of ["__session=;", "Path=/", "HttpOnly", "Secure", "SameSite=Strict", "Max-Age=0"]) expect(cookieEfface).toContain(attr);
  });
});
