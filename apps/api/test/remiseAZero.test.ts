import { describe, expect, it } from "vitest";
import { SCHEMA, ensureSchemaOn, type SqlDb } from "../src/db";
import { CLES_META_EFFACEES, TABLES_GARDEES, TABLES_VIDEES, planDeRemiseAZero, nomDeBaseCorrespond, refusDesGardes, refusDuLancement, remiseAZero, tablesCreees, tablesDuSchema } from "../src/remiseAZero";
import { GENERATION_TTL_MS } from "../src/platform";
import { verifierVide, type FetchFn } from "../scripts/smokeRead";
import { makeApi, openTestDb, TEST_DB } from "./helpers";

// Lot R8 — la remise à zéro du lancement. La liste des tables est calculée du schéma ; ces tests échouent si une table y est ajoutée sans être
// classée (vidée ou gardée), si une table gardée nomme un joueur, ou si la remise à zéro laisse une ligne dans une table vidée. SQLite **et** libSQL.

/** Une ligne minimale dans une table (colonnes lues du schéma : un entier ou un texte pour chaque colonne sans valeur par défaut). */
async function remplir(db: SqlDb, table: string): Promise<void> {
  const cols = await db.all<{ name: string; type: string; notnull: number; dflt_value: string | null }>(`PRAGMA table_info(${table})`);
  const names = cols.filter((c) => c.dflt_value === null || c.notnull === 0).map((c) => c.name);
  const values = cols.filter((c) => c.dflt_value === null || c.notnull === 0).map((c) => (/INT/i.test(c.type) ? 1 : "x"));
  await db.run(`INSERT INTO ${table} (${names.join(", ")}) VALUES (${names.map(() => "?").join(", ")})`, values);
}

const compter = async (db: SqlDb, table: string) => (await db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table}`))!.n;

describe(`remise à zéro : la liste des tables (${TEST_DB})`, () => {
  it("chaque table du schéma est vidée ou gardée, jamais ni l'une ni l'autre, jamais les deux", () => {
    const plan = planDeRemiseAZero();
    expect([...plan.videes, ...plan.gardees].sort()).toEqual(tablesDuSchema().sort());
    expect(plan.videes.filter((t) => plan.gardees.includes(t))).toEqual([]);
    // Ce que Nathan a demandé de garder, et seulement cela.
    expect(plan.gardees.sort()).toEqual(["circuits", "jump_levels", "meta", "planning"]);
    // Les tables des deux jeux et de la plateforme (identités, résultats, rediffusions, vies, Salon, débit) sont toutes vidées.
    for (const t of ["players", "revoked_codes", "rate", "results", "jump_results", "jump_lives", "jump_deaths", "salon_runs", "salon_sessions", "salon_presence", "salon_throttle"]) {
      expect(plan.videes, t).toContain(t);
    }
  });

  it("une nouvelle table du schéma qui n'est dans aucune liste fait échouer la remise à zéro (et ce test)", () => {
    const avecNouvelle = [...tablesDuSchema(), "jump_amis"];
    expect(() => planDeRemiseAZero(avecNouvelle)).toThrow(/jump_amis/);
    expect(() => planDeRemiseAZero(tablesDuSchema().filter((t) => t !== "rate"))).toThrow(/rate/); // une liste qui cite une table disparue
    // Le schéma lui-même : les tables sont bien lues dans `SCHEMA` (pas de liste recopiée).
    expect(tablesCreees(["CREATE TABLE IF NOT EXISTS a (x)", "CREATE INDEX i ON a (x)", "  create table b (y)"])).toEqual(["a", "b"]);
    expect(tablesCreees(SCHEMA).length).toBeGreaterThanOrEqual(12);
  });

  it("une table gardée ne contient aucune donnée de joueur : aucune colonne ne nomme un joueur, un pseudo ou une rediffusion", async () => {
    const db = await openTestDb();
    await ensureSchemaOn(db);
    for (const table of Object.keys(TABLES_GARDEES)) {
      const cols = (await db.all<{ name: string }>(`PRAGMA table_info(${table})`)).map((c) => c.name);
      expect(cols.length, table).toBeGreaterThan(0);
      for (const c of cols) expect(c, `${table}.${c}`).not.toMatch(/player|pseudo|name|ref\b|replay|splits|lives/i);
    }
    db.close();
  });

  it("chaque table a sa raison, écrite pour le résumé du workflow", () => {
    for (const raison of [...Object.values(TABLES_VIDEES), ...Object.values(TABLES_GARDEES)]) expect(raison.length).toBeGreaterThan(10);
  });
});

describe(`remise à zéro : sur une base remplie (${TEST_DB})`, () => {
  async function baseRemplie(log?: (niveau: string, message: string) => void) {
    const t = await makeApi({ seed: false, ...(log ? { log: log as never } : {}) });
    await t.call("GET", "/api/health"); // le schéma
    for (const table of [...Object.keys(TABLES_VIDEES), ...Object.keys(TABLES_GARDEES)].filter((x) => x !== "meta")) await remplir(t.db, table);
    await t.db.run("INSERT INTO meta (key, value) VALUES ('pseudo_migration', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", ['{"renamed":[{"from":"Ancien"}]}']);
    return t;
  }

  it("l'essai à blanc compte et n'écrit rien", async () => {
    const t = await baseRemplie();
    const rapport = await remiseAZero(t.db, { now: 1_800_000_000_000, applique: false });
    expect(rapport.applique).toBe(false);
    expect(rapport.generation).toBeNull();
    for (const l of rapport.videes) expect(l, l.table).toMatchObject({ avant: 1, apres: 1 });
    for (const table of Object.keys(TABLES_VIDEES)) expect(await compter(t.db, table), table).toBe(1);
    expect(await t.db.first("SELECT 1 FROM meta WHERE key = 'generation'")).toBeNull();
  });

  it("vide toutes les tables vidées, garde les autres, efface le rapport des pseudos, écrit une génération neuve", async () => {
    const t = await baseRemplie();
    const rapport = await remiseAZero(t.db, { now: 1_800_000_000_000, applique: true });
    expect(rapport.applique).toBe(true);
    expect(rapport.generation).toBe(1_800_000_000_000);
    expect(rapport.generationAvant).toBe(0);
    for (const l of rapport.videes) expect(l, l.table).toMatchObject({ avant: 1, apres: 0 });
    for (const table of Object.keys(TABLES_VIDEES)) expect(await compter(t.db, table), table).toBe(0);
    for (const l of rapport.gardees) expect(l.apres, l.table).toBe(l.avant);
    for (const table of ["planning", "circuits", "jump_levels"]) expect(await compter(t.db, table), table).toBe(1);
    for (const key of CLES_META_EFFACEES) expect(await t.db.first("SELECT 1 FROM meta WHERE key = ?", [key]), key).toBeNull();
    expect((await t.db.first<{ value: string }>("SELECT value FROM meta WHERE key = 'schema'"))?.value).toBeTruthy();
    // Le résumé ne porte que des nombres de lignes : aucune donnée de joueur n'en sort.
    expect(JSON.stringify(rapport)).not.toContain("Ancien");
  });

  it("la génération croît à chaque remise à zéro, même si l'horloge recule", async () => {
    const t = await baseRemplie();
    expect((await remiseAZero(t.db, { now: 5_000, applique: true })).generation).toBe(5_000);
    expect((await remiseAZero(t.db, { now: 4_000, applique: true })).generation).toBe(5_001);
  });

  it("est sûre sur une base neuve (le schéma est créé) et se rejoue sans erreur", async () => {
    const db = await openTestDb();
    const r1 = await remiseAZero(db, { now: 9_000, applique: true });
    expect(r1.videes.every((l) => l.avant === 0 && l.apres === 0)).toBe(true);
    await remiseAZero(db, { now: 9_500, applique: true });
    db.close();
  });

  it("le serveur annonce la génération : 0 avant, puis la nouvelle (portail, DailyJump, DailyTrack) ; un nouveau serveur la lit tout de suite, une instance en marche après son délai", async () => {
    const journal: string[] = [];
    const t = await baseRemplie((_niveau, message) => journal.push(message));
    t.clock.now = Date.parse("2026-10-20T12:00:00Z"); // DailyJump n'existe qu'à partir du 16/10/2026
    const lire = async (x: Awaited<ReturnType<typeof baseRemplie>>) => ({
      portail: (await x.call("GET", "/api/portail/jour")).body.generation,
      jump: (await x.call("GET", "/api/jump/day/2026-10-20/bundle")).body.generation,
      track: (await x.call("GET", "/api/day/2026-10-20")).body.generation,
    });
    expect(await lire(t)).toEqual({ portail: 0, jump: 0, track: 0 });
    await remiseAZero(t.db, { now: 1_800_000_000_000, applique: true });
    // L'instance en marche garde la génération lue GENERATION_TTL_MS (une ligne lue par instance et par délai, pas par requête)…
    expect(await lire(t)).toEqual({ portail: 0, jump: 0, track: 0 });
    t.clock.now += GENERATION_TTL_MS + 1;
    expect(await lire(t)).toEqual({ portail: 1_800_000_000_000, jump: 1_800_000_000_000, track: 1_800_000_000_000 });
    // …et elle oublie alors ce qu'elle garde en mémoire (classements gardés, premier d'un jour fermé…) : pas de redémarrage de révision nécessaire.
    expect(journal.filter((m) => m === "génération de données changée : mémoire de l'instance oubliée")).toHaveLength(1);
    // …un serveur neuf (la révision que le workflow redémarre) la lit tout de suite.
    const neuf = await makeApi({ db: t.db, seed: false });
    neuf.clock.now = t.clock.now;
    expect(await lire(neuf)).toEqual({ portail: 1_800_000_000_000, jump: 1_800_000_000_000, track: 1_800_000_000_000 });
  }, 60_000);
});

describe("remise à zéro : les gardes", () => {
  const bon = { cible: "recette", baseSaisie: "dailytrack-recette", baseVisee: "dailytrack-recette", phrase: "tout le monde repart de zéro", sauvegardeFaite: false };

  it("tout est en ordre : aucun refus (la recette n'exige pas de sauvegarde)", () => {
    expect(refusDesGardes(bon)).toEqual([]);
    expect(refusDesGardes({ ...bon, baseSaisie: " DailyTrack-Recette ", phrase: " tout le monde repart de zéro " })).toEqual([]);
  });

  it("refuse une cible inconnue, un autre nom de base, une autre phrase", () => {
    expect(refusDesGardes({ ...bon, cible: "local" })[0]).toMatch(/cible inconnue/);
    expect(refusDesGardes({ ...bon, baseSaisie: "dailytrack-misterzcool" })[0]).toMatch(/nom de la base saisi/);
    expect(refusDesGardes({ ...bon, baseSaisie: "", baseVisee: "" })[0]).toMatch(/nom de la base saisi/);
    expect(refusDesGardes({ ...bon, phrase: "tout le monde repart de zero" })[0]).toMatch(/phrase/);
    expect(refusDesGardes({ ...bon, phrase: "" })[0]).toMatch(/phrase/);
  });

  it("le nom de la base : celui de Turso ou le premier mot complet de l'adresse ; un préfixe s'arrête à un tiret et fait six caractères au moins", () => {
    expect(nomDeBaseCorrespond("dailytrack-misterzcool", "dailytrack-misterzcool-nathan-te")).toBe(true);
    expect(nomDeBaseCorrespond("dailytrack-misterzcool-nathan-te", "dailytrack-misterzcool-nathan-te")).toBe(true);
    expect(nomDeBaseCorrespond(" DailyTrack-MisterZCool ", "dailytrack-misterzcool-nathan-te")).toBe(true);
    expect(nomDeBaseCorrespond("dailytrack-mister", "dailytrack-misterzcool-nathan-te")).toBe(false); // pas à un tiret
    expect(nomDeBaseCorrespond("daily", "daily-x")).toBe(false); // trop court
    expect(nomDeBaseCorrespond("", "")).toBe(false);
    expect(nomDeBaseCorrespond("autre", "dailytrack-misterzcool")).toBe(false);
    expect(nomDeBaseCorrespond("dailytrack-recette", "dailytrack-misterzcool-nathan-te")).toBe(false);
  });

  it("la production exige la sauvegarde", () => {
    const prod = { ...bon, cible: "production", baseSaisie: "dailytrack-misterzcool", baseVisee: "dailytrack-misterzcool" };
    expect(refusDesGardes(prod)[0]).toMatch(/sauvegarde/);
    expect(refusDesGardes({ ...prod, sauvegardeFaite: true })).toEqual([]);
  });

  it("la production ne se vide que si le lancement servi est aujourd'hui ou demain", () => {
    const corps = (date: string, lancement: string) => ({ date, lancement });
    expect(refusDuLancement(corps("2026-10-26", "2026-10-26"))).toBeNull();
    expect(refusDuLancement(corps("2026-10-25", "2026-10-26"))).toBeNull();
    expect(refusDuLancement(corps("2026-10-24", "2026-10-26"))).toMatch(/trop tôt/);
    expect(refusDuLancement(corps("2026-10-27", "2026-10-26"))).toMatch(/après le lancement/);
    expect(refusDuLancement({})).toMatch(/ne dit pas sa date/);
    expect(refusDuLancement(null)).toMatch(/ne dit pas sa date/);
    expect(refusDuLancement({ date: "2026-10-26", lancement: "demain" })).toMatch(/ne dit pas sa date/);
  });
});

describe(`remise à zéro : la vérification d'après, en lecture seule (${TEST_DB})`, () => {
  const BASE = "https://cdj-api-exemple.a.run.app";
  const DAY = Date.parse("2026-10-20T12:00:00Z");

  it("échoue tant que la base n'est pas remise à zéro (génération absente, un classé), réussit après — des GET seulement", async () => {
    const t = await makeApi({ seed: false });
    t.clock.now = DAY;
    await t.call("GET", "/api/health");
    const methods: string[] = [];
    const f: FetchFn = async (url, init = {}) => {
      methods.push((init.method ?? "GET").toUpperCase());
      return t.api.handle(new Request(url.replace(BASE, "http://api.test"), init), { clientKey: "198.51.100.9" });
    };
    const jour = Math.floor(DAY / 86_400_000);
    await t.db.run("INSERT INTO players (id, name, created_at, updated_at, name_key) VALUES ('a', 'Ancien', 0, 0, 'ancien')");
    await t.db.run("INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at) VALUES (?, 'a', 40000, '[]', 'x', 0, 1)", [jour]);
    const avant = await verifierVide(BASE, f);
    const echecs = avant.filter((c) => !c.ok).map((c) => c.route);
    expect(echecs).toContain("/api/portail/jour"); // aucune génération annoncée
    expect(echecs).toContain("/api/day/2026-10-20/leaderboard"); // un classé
    await remiseAZero(t.db, { now: 1_800_000_000_000, applique: true });
    t.clock.now += GENERATION_TTL_MS + 1;
    const apres = await verifierVide(BASE, f);
    expect(apres.filter((c) => !c.ok), JSON.stringify(apres, null, 1)).toEqual([]);
    expect(new Set(methods)).toEqual(new Set(["GET"]));
  }, 60_000);
});
