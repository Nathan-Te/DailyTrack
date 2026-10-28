// `npm run measure:admin -w @cdj/api` (lot N1 de la plateforme) : ce que coûte le panneau d'administration — le tableau de bord (calculé au plus une fois par minute
// et par instance), la recherche de joueurs, la fiche d'un joueur et le journal — pour 100, 1 000 et 10 000 joueurs par jour dans chaque jeu, sur 14 jours d'historique.
// Les requêtes passent par le **vrai code** de l'API (`api.handle`), sur le moteur libSQL (celui de Turso, ici un fichier local). Ce que le script rend :
//   - le **nombre d'instructions** SQL de chaque appel et leur durée (exacts) ;
//   - les **lignes lues estimées** : pour chaque instruction, la taille de la plage d'index que son plan (`EXPLAIN QUERY PLAN`) parcourt, comptée par une requête
//     `COUNT(*)` sur le même prédicat. Ce n'est PAS le « rows read » que Turso facture (que seul un serveur `sqld` rend, comme `measure:portail`) : c'est la borne que
//     donne le plan, sans table entière lue (le test `admin.test.ts` « coût » le garde). À confirmer sur `sqld` quand un Docker est disponible.
//
// ⚠ Écrit dans un fichier temporaire, jamais dans une vraie base.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { daysFromCivil } from "@cdj/core";
import { parisDayStart } from "@cdj/clock";
import { createApi } from "../src/api";
import { SCHEMA, ensureSchemaOn, type SqlDb, type SqlValue } from "../src/db";
import { openLibsql } from "../src/libsql-open";
import { nameKey } from "../src/pseudos";

const dossier = mkdtempSync(join(tmpdir(), "mesure-admin-"));
process.on("exit", () => rmSync(dossier, { recursive: true, force: true }));
const brut = await openLibsql({ url: `file:${join(dossier, "mesure.db")}` });
await ensureSchemaOn(brut);
for (const sql of SCHEMA) void sql; // le schéma est celui de `db.ts`

const tally = { instructions: 0, lignes: 0, ms: 0, plages: 0 };
const traces: { sql: string; params?: SqlValue[] }[] = [];
const db: SqlDb = {
  async run(sql, params) {
    tally.instructions++;
    traces.push({ sql, params });
    await brut.run(sql, params);
  },
  async first<T>(sql: string, params?: SqlValue[]) {
    tally.instructions++;
    traces.push({ sql, params });
    const r = await brut.first<T>(sql, params);
    tally.lignes += r ? 1 : 0;
    return r;
  },
  async all<T>(sql: string, params?: SqlValue[]) {
    tally.instructions++;
    traces.push({ sql, params });
    const r = await brut.all<T>(sql, params);
    tally.lignes += r.length;
    return r;
  },
  async batch(statements) {
    tally.instructions += statements.length;
    for (const s of statements) traces.push(s);
    await brut.batch!(statements);
  },
};

const today = daysFromCivil(2026, 10, 20);
const clock = { now: parisDayStart(today) + 12 * 3_600_000 };
const api = createApi({
  db,
  now: () => clock.now,
  rateSalt: "mesure",
  environment: "local",
  allowCopies: true,
  admin: { emails: ["mesure@example.test"], sessionKey: "cle-de-mesure-assez-longue-pour-etre-acceptee", fakeVerifier: true },
});

const hex = (n: number) => n.toString(16).padStart(32, "0");
const ORIGIN = "http://mesure.local";

async function peupler(parJour: number): Promise<void> {
  await brut.run("DELETE FROM players");
  await brut.run("DELETE FROM results");
  await brut.run("DELETE FROM jump_results");
  await brut.run("DELETE FROM jump_lives");
  const total = parJour * 2; // deux jeux, des joueurs qui se recoupent aux trois quarts
  const lots: { sql: string; params: SqlValue[] }[] = [];
  const vide = async () => {
    if (lots.length) await brut.batch!(lots.splice(0));
  };
  for (let i = 1; i <= total; i++) {
    const nom = `Joueur ${i}`;
    lots.push({ sql: "INSERT INTO players (id, name, created_at, updated_at, name_key) VALUES (?, ?, ?, ?, ?)", params: [hex(i), nom, clock.now - (i % 40) * 86_400_000, clock.now, nameKey(nom)] });
    if (lots.length >= 400) await vide();
  }
  for (let d = 0; d < 14; d++) {
    for (let i = 1; i <= parJour; i++) {
      lots.push({ sql: "INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at, inputs_hash) VALUES (?, ?, ?, '[]', 'r', 0, ?, ?)", params: [today - d, hex(i), 30_000 + i, clock.now - i, `t${d}-${i}`] });
      lots.push({ sql: "INSERT INTO jump_results (day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at, inputs_hash) VALUES (?, ?, 'l', ?, 1, 'r', 1, 1, 0, ?, ?)", params: [today - d, hex(i + Math.floor(parJour / 4)), 2000 + i, clock.now - i, `j${d}-${i}`] });
      if (lots.length >= 400) await vide();
    }
  }
  for (let i = 1; i <= parJour; i++) lots.push({ sql: "INSERT INTO jump_lives (day, player_id, level_id, count, lives, rev, updated_at) VALUES (?, ?, 'l', 3, '[]', 1, ?)", params: [today, hex(i), clock.now] });
  await vide();
}

/** La taille de la plage d'index qu'une instruction parcourt, d'après son plan : le nombre de lignes de la table qui satisfont la partie indexée de son prédicat. */
async function plage(sql: string, params: SqlValue[] = []): Promise<number> {
  if (!/^\s*SELECT/i.test(sql) || /FROM \(/i.test(sql)) return 0;
  const m = /FROM (\w+)(?: \w+)?(?: JOIN [^W]*)? WHERE (.+?)(?: GROUP BY| ORDER BY| LIMIT|$)/is.exec(sql.replace(/\s+/g, " "));
  if (!m) return 0;
  const [, table, where] = m as unknown as [string, string, string];
  if (!["players", "results", "jump_results", "jump_lives", "journal_erreurs"].includes(table)) return 0;
  try {
    const n = (where.match(/\?/g) ?? []).length;
    const r = await brut.first<{ n: number }>(`SELECT COUNT(*) AS n FROM ${table} WHERE ${where}`, params.slice(0, n));
    return r?.n ?? 0;
  } catch {
    return 0;
  }
}

async function appel(nom: string, methode: string, chemin: string, extra: Record<string, string>, corps?: unknown) {
  traces.length = 0;
  tally.instructions = 0;
  tally.lignes = 0;
  const debut = performance.now();
  const res = await api.handle(new Request(`${ORIGIN}${chemin}`, { method: methode, headers: { "Content-Type": "application/json", ...extra }, ...(corps ? { body: JSON.stringify(corps) } : {}) }), { clientKey: "203.0.113.9" });
  const ms = performance.now() - debut;
  if (!res.ok) throw new Error(`${nom} : ${res.status}`);
  const corpsRendu = await res.text();
  let estimees = 0;
  for (const t of traces) estimees += await plage(t.sql, t.params);
  // La sous-requête des 14 jours (union des deux tables) : la plage `day` de ses deux premiers paramètres (14 jours à froid, 2 jours quand les jours fermés sont gardés).
  const union = traces.find((t) => /FROM \(SELECT day AS jour, player_id/.test(t.sql));
  if (union) {
    const [du, au] = [union.params![0]!, union.params![1]!];
    const a = await brut.first<{ n: number }>("SELECT COUNT(*) AS n FROM results WHERE day >= ? AND day <= ?", [du, au]);
    const b = await brut.first<{ n: number }>("SELECT COUNT(*) AS n FROM jump_results WHERE day >= ? AND day <= ?", [du, au]);
    estimees += (a?.n ?? 0) + (b?.n ?? 0);
  }
  return { nom, instructions: tally.instructions, rendues: tally.lignes, estimees, ms: Math.round(ms * 10) / 10, octets: corpsRendu.length };
}

const lignes: string[] = [];
for (const parJour of [100, 1000, 10_000]) {
  await peupler(parJour);
  clock.now += 61_000 * 60; // hors de la mémoire d'une mesure précédente
  const login = await api.handle(new Request(`${ORIGIN}/api/admin/session`, { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN, "X-Cdj-Admin": "1" }, body: JSON.stringify({ credential: "factice:mesure@example.test" }) }), { clientKey: "203.0.113.9" });
  const cookie = /__session=([^;]+)/.exec(login.headers.get("set-cookie") ?? "")![1]!;
  const adm = { Cookie: `__session=${cookie}`, Origin: ORIGIN, "X-Cdj-Admin": "1" };
  const m: Awaited<ReturnType<typeof appel>>[] = [];
  m.push(await appel("tableau de bord, premier appel (calcul)", "GET", "/api/admin/tableau", adm));
  m.push(await appel("tableau de bord, dans la minute (mémoire)", "GET", "/api/admin/tableau", adm));
  clock.now += 61_000;
  m.push(await appel("tableau de bord, recalculé une minute plus tard (jours fermés gardés en mémoire)", "GET", "/api/admin/tableau", adm));
  clock.now += 61_000;
  const nouvelle = await api.handle(new Request(`${ORIGIN}/api/admin/session`, { method: "POST", headers: { "Content-Type": "application/json", Origin: ORIGIN, "X-Cdj-Admin": "1" }, body: JSON.stringify({ credential: "factice:mesure@example.test" }) }), { clientKey: "203.0.113.10" });
  adm.Cookie = `__session=${/__session=([^;]+)/.exec(nouvelle.headers.get("set-cookie") ?? "")![1]!}`;
  // Les joueurs d'avant le lot N1 n'ont pas encore leur référence publique : le premier passage du panneau la calcule (une écriture par joueur, une seule fois).
  m.push(await appel("joueurs : premier passage après la mise à jour (références calculées, une fois)", "GET", "/api/admin/joueurs", adm));
  m.push(await appel("joueurs : la première page (sans critère)", "GET", "/api/admin/joueurs", adm));
  m.push(await appel("joueurs : début de pseudo", "GET", `/api/admin/joueurs?q=${encodeURIComponent("Joueur 12")}`, adm));
  const ref = (await (await api.handle(new Request(`${ORIGIN}/api/admin/joueurs?q=${encodeURIComponent("Joueur 1")}`, { headers: adm }), { clientKey: "203.0.113.10" })).json()).joueurs[0].ref as string;
  m.push(await appel("joueurs : début de référence", "GET", `/api/admin/joueurs?q=${ref.slice(0, 6)}`, adm));
  m.push(await appel("fiche d'un joueur (14 jours dans chaque jeu)", "GET", `/api/admin/joueurs/${ref}`, adm));
  m.push(await appel("action : masquer", "POST", `/api/admin/joueurs/${ref}/masquer`, adm, { masque: true, confirmer: true }));
  m.push(await appel("journal (200 dernières actions)", "GET", "/api/admin/journal", adm));
  lignes.push(`\n### ${parJour.toLocaleString("fr-FR")} joueurs par jour et par jeu (14 jours d'historique)\n`);
  lignes.push("| appel | instructions | lignes rendues | lignes lues (estimées d'après les plans) | durée | réponse |", "|---|---|---|---|---|---|");
  for (const x of m) lignes.push(`| ${x.nom} | ${x.instructions} | ${x.rendues} | ${x.estimees.toLocaleString("fr-FR")} | ${x.ms} ms | ${(x.octets / 1024).toFixed(1)} ko |`);
}
console.log(lignes.join("\n"));
