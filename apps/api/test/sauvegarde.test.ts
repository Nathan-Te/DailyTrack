import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { afterAll, describe, expect, it } from "vitest";
import { ensureSchemaOn } from "../src/db";
import { openLibsql } from "../src/libsql-open";
import { SAUVEGARDE_JOURS, identifiant, litteral, sauvegarder, type Lecteur, type ResultatLu } from "../src/sauvegarde";

// Lot R12 : la sauvegarde automatique de la base avant chaque mise en production (`apps/api/scripts/sauvegarde.ts`, job `sauvegarde` de production.yml).
// Elle lit tout en lecture seule (un lot « read » de libSQL, celui de Turso) et rend un texte SQL que SQLite (et `turso db create --from-dump`) restaure
// à l'identique : on le vérifie ici sur le vrai schéma du serveur, avec des valeurs difficiles (apostrophes, NULL, octets, réels, grands entiers).
const dossier = mkdtempSync(join(tmpdir(), "cdj-sauvegarde-"));
afterAll(() => rmSync(dossier, { recursive: true, force: true }));

async function baseRemplie() {
  const url = `file:${join(dossier, `b${Math.random().toString(36).slice(2)}.db`)}`;
  const db = await openLibsql({ url });
  await ensureSchemaOn(db);
  await db.run("INSERT INTO players (id, name, created_at, updated_at, demo, name_key) VALUES (?, ?, ?, ?, 0, ?)", ["a".repeat(32), "L'Écureuil « 1 »", 1_761_000_000_000, 1_761_000_000_123, "l'ecureuil « 1 »"]);
  await db.run("INSERT INTO players (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)", ["b".repeat(32), "x'); DROP TABLE players; --", 9_007_199_254_740_991, 0]);
  await db.run("CREATE TABLE essai_valeurs (id INTEGER PRIMARY KEY AUTOINCREMENT, r REAL, o BLOB, t TEXT)");
  await db.run("INSERT INTO essai_valeurs (r, o, t) VALUES (1.5, X'00FF10', NULL), (-0.25, NULL, 'ligne\nsuivante')");
  db.close();
  const { createClient } = await import("@libsql/client");
  const client = createClient({ url });
  const lire: Lecteur = async (requetes) => (await client.batch(requetes.map((sql) => ({ sql, args: [] })), "read")) as unknown as ResultatLu[];
  return { client, lire };
}

const contenu = (db: DatabaseSync, table: string) => db.prepare(`SELECT * FROM ${identifiant(table)} ORDER BY rowid`).all();

describe("la sauvegarde de la base (lot R12)", () => {
  it("le bucket efface chaque copie au bout de SAUVEGARDE_JOURS (la durée promise par les mentions légales)", () => {
    const cycle = JSON.parse(readFileSync(join(__dirname, "../../../config/sauvegarde-cycle.json"), "utf8"));
    expect(cycle).toEqual({ rule: [{ action: { type: "Delete" }, condition: { age: SAUVEGARDE_JOURS } }] });
  });

  it("littéraux SQL : NULL, nombres, apostrophes doublées, octets en hexadécimal", () => {
    expect(litteral(null)).toBe("NULL");
    expect(litteral(42)).toBe("42");
    expect(litteral(-0.25)).toBe("-0.25");
    expect(litteral(12n)).toBe("12");
    expect(litteral("l'eau")).toBe("'l''eau'");
    expect(litteral(new Uint8Array([0, 255, 16]))).toBe("X'00FF10'");
    expect(litteral(new Uint8Array([1, 2]).buffer)).toBe("X'0102'");
  });

  it("lit tout en lecture seule et se restaure à l'identique dans SQLite (vrai schéma, index, compteur d'AUTOINCREMENT)", async () => {
    const { client, lire } = await baseRemplie();
    const requetes: string[] = [];
    const { texte, tables } = await sauvegarder(async (r) => {
      requetes.push(...r);
      return lire(r);
    });
    // Rien que des lectures.
    expect(requetes.every((r) => /^\s*select\b/i.test(r))).toBe(true);
    expect(tables.find((t) => t.nom === "players")?.lignes).toBe(2);
    expect(tables.find((t) => t.nom === "essai_valeurs")?.lignes).toBe(2);
    expect(texte.startsWith("PRAGMA foreign_keys=OFF;\nBEGIN TRANSACTION;\n")).toBe(true);
    expect(texte.trimEnd().endsWith("COMMIT;")).toBe(true);

    const restauree = new DatabaseSync(":memory:");
    restauree.exec(texte);
    client.close();
    for (const t of tables) {
      expect(restauree.prepare(`SELECT count(*) AS n FROM ${identifiant(t.nom)}`).get(), t.nom).toEqual({ n: t.lignes });
    }
    const index = (db: DatabaseSync) => db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY name").all();
    expect(index(restauree).length).toBeGreaterThan(0);
    expect(contenu(restauree, "essai_valeurs")).toEqual([
      { id: 1, r: 1.5, o: new Uint8Array([0, 255, 16]), t: null },
      { id: 2, r: -0.25, o: null, t: "ligne\nsuivante" },
    ]);
    expect(contenu(restauree, "players").map((p) => (p as { name: string }).name)).toEqual(["L'Écureuil « 1 »", "x'); DROP TABLE players; --"]);
    expect(restauree.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'essai_valeurs'").get()).toEqual({ seq: 2 });
    restauree.close();
  });

  it("une base vide (schéma seul) donne une sauvegarde qui se restaure", async () => {
    const url = `file:${join(dossier, "vide.db")}`;
    const db = await openLibsql({ url });
    await ensureSchemaOn(db);
    db.close();
    const { createClient } = await import("@libsql/client");
    const client = createClient({ url });
    const { texte, tables } = await sauvegarder(async (r) => (await client.batch(r.map((sql) => ({ sql, args: [] })), "read")) as unknown as ResultatLu[]);
    client.close();
    expect(tables.some((t) => t.nom === "results")).toBe(true);
    const restauree = new DatabaseSync(":memory:");
    restauree.exec(texte);
    expect(restauree.prepare("SELECT count(*) AS n FROM players").get()).toEqual({ n: 0 });
    restauree.close();
  });
});
