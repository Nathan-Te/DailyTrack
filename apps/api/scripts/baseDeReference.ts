import { daysFromCivil } from "@cdj/core";
import { parisDayStart } from "@cdj/clock";
import type { SqlDb, SqlValue } from "../src/db";
import { ensureSchemaOn } from "../src/db";

/**
 * Lot R14 — **la base de référence** des mesures de lignes lues : ce que l'API lit quand la plateforme a vécu (300 joueurs, 14 jours de parties dans chaque jeu), écrite
 * **directement** en base locale (on mesure la lecture, pas l'envoi : les envois ont leurs propres mesures). Les rediffusions sont des textes factices : aucune route de lecture
 * ne les décode. Déterministe (aucun hasard). Sert à `npm run measure:lignes` et au test de garde des routes chaudes (`apps/api/test/routesChaudes.test.ts`).
 */
export const REFERENCE = { joueurs: 300, jours: 14, /** Un joueur sur `PARTICIPATION` ne joue pas un jour donné de chaque jeu. */ participation: 3 };

export const referenceId = (n: number) => n.toString(16).padStart(32, "0");
export const referenceNom = (n: number) => `Pilote${String(n).padStart(3, "0")}`;

async function lot(db: SqlDb, statements: { sql: string; params: SqlValue[] }[]): Promise<void> {
  for (let i = 0; i < statements.length; i += 200) {
    const part = statements.slice(i, i + 200);
    if (db.batch) await db.batch(part);
    else for (const s of part) await db.run(s.sql, s.params);
  }
}

/** Écrit la base de référence jusqu'à `today` (numéro de jour de Paris, compris). Rend le nombre de lignes écrites par table. */
export async function construireBaseDeReference(db: SqlDb, today: number): Promise<{ players: number; results: number; jump_results: number; tower_results: number }> {
  await ensureSchemaOn(db);
  const t0 = parisDayStart(today - REFERENCE.jours);
  const joueurs: { sql: string; params: SqlValue[] }[] = [];
  for (let n = 1; n <= REFERENCE.joueurs; n++) {
    const nom = referenceNom(n);
    joueurs.push({
      sql: "INSERT INTO players (id, name, created_at, updated_at, demo, name_key, ref) VALUES (?, ?, ?, ?, 0, ?, ?)",
      params: [referenceId(n), nom, t0 + n * 1000, t0 + n * 1000, nom.toLowerCase(), referenceId(n).slice(-12)],
    });
  }
  await lot(db, joueurs);
  const track: { sql: string; params: SqlValue[] }[] = [];
  const jump: { sql: string; params: SqlValue[] }[] = [];
  const tower: { sql: string; params: SqlValue[] }[] = []; // lot TP : Tower, le 3ᵉ jeu (classé à la hauteur)
  for (let d = 0; d < REFERENCE.jours; d++) {
    const day = today - d;
    const debut = parisDayStart(day);
    for (let n = 1; n <= REFERENCE.joueurs; n++) {
      if ((n + d) % REFERENCE.participation === 0) continue;
      const t = debut + 8 * 3_600_000 + n * 60_000;
      track.push({
        sql: "INSERT INTO results (day, player_id, ms, splits, replay, respawns, submitted_at, car) VALUES (?, ?, ?, '[]', 'x', 0, ?, NULL)",
        params: [day, referenceId(n), 60_000 + ((n * 7919 + d * 104729) % 40_000), t],
      });
      if ((n + 3 * d) % REFERENCE.participation !== 0) {
        tower.push({
          sql: "INSERT INTO tower_results (day, player_id, tirage, hauteur_mm, hauteur_max_mm, vies, ticks, medal, replay, sim_version, generator_version, first_at, submitted_at, inputs_hash) VALUES (?, ?, 0, ?, ?, ?, ?, NULL, 'x', 3, 3, ?, ?, ?)",
          params: [day, referenceId(n), 8000 + ((n * 4421 + d * 6469) % 30_000), 40_000, (n + d) % 4, 3000 + ((n * 131 + d * 17) % 3000), t, t, `h${n}-${d}`],
        });
      }
      if ((n + 2 * d) % REFERENCE.participation === 0) continue;
      jump.push({
        sql: "INSERT INTO jump_results (day, player_id, level_id, ticks, deaths, replay, sim_version, generator_version, first_at, submitted_at) VALUES (?, ?, 'x', ?, ?, 'x', 1, 1, ?, ?)",
        params: [day, referenceId(n), 3000 + ((n * 6151 + d * 7717) % 2000), n % 7, t, t],
      });
    }
  }
  await lot(db, track);
  await lot(db, jump);
  await lot(db, tower);
  // Lot TP : Tower est ouvert (`on` depuis toujours) dans la référence : le portail le compte comme les deux autres jeux.
  await db.run("INSERT OR REPLACE INTO jeux (jeu, etat, live_from, periodes, modifie_le) VALUES ('tower', 'on', 0, '[[0,null]]', 0)");
  return { players: joueurs.length, results: track.length, jump_results: jump.length, tower_results: tower.length };
}

export const REFERENCE_AUJOURDHUI = daysFromCivil(2026, 10, 20);
