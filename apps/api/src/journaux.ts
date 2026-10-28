import { CODES_ERREUR, estCodeErreur } from "./codesErreur";
import type { SqlDb } from "./db";
import type { Statement } from "./games";
import type { Logger } from "./log";

// Lot N1 (plateforme) : les deux journaux du panneau d'administration et l'entretien qui les borne.
//
//   - `journal_admin` : une ligne par action de l'administrateur (heure, empreinte de l'administrateur, action, cible, avant / après). **Jamais le contenu effacé** : pour une
//     suppression, seulement le pseudo et la référence publique (qui ne dit rien de l'identifiant secret). Gardé `JOURNAL_ADMIN_JOURS` jours.
//   - `journal_erreurs` : les erreurs serveur (statut ≥ 500) et les rediffusions refusées, pour le tableau de bord. **Ni joueur, ni corps de requête, ni adresse** : un code de la
//     liste unique, la route (sans identifiant ni date : `routeDe`) et l'heure. Bornée en écriture (`ERREURS_PAR_MINUTE` au plus par instance) et gardée `ERREURS_JOURS` jours.

export const JOURNAL_ADMIN_JOURS = 365;
export const JOURNAL_ADMIN_LIGNES = 200;
export const ERREURS_JOURS = 14;
export const ERREURS_PAR_MINUTE = 60;
/** La rediffusion d'un résultat retiré est gardée 30 jours pour vérification, puis effacée (la ligne et son motif restent). */
export const RETRAIT_REDIFFUSION_JOURS = 30;

const JOUR_MS = 86_400_000;

/** Les refus d'une rediffusion à l'envoi (comptés « rediffusions refusées » quand ils viennent d'une route d'envoi). */
export const CODES_REDIFFUSION_REFUSEE: readonly string[] = ["invalid_replay", "sim_version", "track_mismatch", "not_finished", "replay_copy", "version", "not_daily", "invalid_level"];

/** La route sans rien de personnel ni de variable : dates, numéros et identifiants longs remplacés ; bornée. */
export function routeDe(path: string): string {
  return path
    .split("/")
    .map((s) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? ":date" : /^\d+$/.test(s) ? ":n" : /^[0-9a-f]{12,}$/i.test(s) ? ":id" : s.length > 40 ? ":x" : s))
    .join("/")
    .slice(0, 80);
}

/** Cette erreur se note-t-elle au journal des erreurs ? Une erreur serveur, ou le refus d'une rediffusion sur une route d'envoi. */
export function aNoter(status: number, code: string, path: string): boolean {
  if (status >= 500) return true;
  return CODES_REDIFFUSION_REFUSEE.includes(code) && path.endsWith("/submit");
}

/** Le genre d'un code noté au journal : `serveur` (statut ≥ 500 dans la liste) ou `rediffusion`. */
export function genreDe(code: string): "serveur" | "rediffusion" {
  return estCodeErreur(code) && CODES_ERREUR[code].status >= 500 ? "serveur" : "rediffusion";
}

export interface EntreeJournal {
  id: number;
  at: string;
  admin: string;
  action: string;
  cible: string;
  avant: unknown;
  apres: unknown;
}

export interface Entree {
  at: number;
  admin: string;
  action: string;
  cible: string;
  avant?: unknown;
  apres?: unknown;
}

/** L'instruction qui écrit une ligne du journal : à mettre **dans la même transaction** que l'action. */
export const ecrireJournal = (e: Entree): Statement => ({
  sql: "INSERT INTO journal_admin (at, admin, action, cible, avant, apres) VALUES (?, ?, ?, ?, ?, ?)",
  params: [e.at, e.admin, e.action, e.cible, e.avant === undefined ? null : JSON.stringify(e.avant), e.apres === undefined ? null : JSON.stringify(e.apres)],
});

export function createJournaux({ db, now, log }: { db: SqlDb; now: () => number; log: Logger }) {
  const json = (v: string | null): unknown => {
    if (v === null) return null;
    try {
      return JSON.parse(v);
    } catch {
      return null;
    }
  };

  /** Les dernières actions, la plus récente d'abord. */
  async function dernieres(n: number): Promise<EntreeJournal[]> {
    const rows = await db.all<{ id: number; at: number; admin: string; action: string; cible: string; avant: string | null; apres: string | null }>(
      "SELECT id, at, admin, action, cible, avant, apres FROM journal_admin ORDER BY id DESC LIMIT ?",
      [n],
    );
    return rows.map((r) => ({ id: r.id, at: new Date(r.at).toISOString(), admin: r.admin, action: r.action, cible: r.cible, avant: json(r.avant), apres: json(r.apres) }));
  }

  // --- Les erreurs : écriture bornée --------------------------------------------------------------------------------------
  let minute = -1;
  let ecrites = 0;
  let ignorees = 0;
  /** Note une erreur (jamais plus de `ERREURS_PAR_MINUTE` par minute et par instance ; une base qui ne répond pas n'ajoute pas d'erreur à l'erreur). */
  async function noter(code: string, path: string): Promise<void> {
    const m = Math.floor(now() / 60_000);
    if (m !== minute) {
      if (ignorees > 0) log("WARNING", "journal des erreurs : écritures ignorées (plafond par minute)", { ignorees });
      minute = m;
      ecrites = 0;
      ignorees = 0;
    }
    if (ecrites >= ERREURS_PAR_MINUTE) {
      ignorees++;
      return;
    }
    ecrites++;
    try {
      await db.run("INSERT INTO journal_erreurs (at, code, route) VALUES (?, ?, ?)", [now(), code, routeDe(path)]);
    } catch {
      /* rien à ajouter : l'erreur d'origine est déjà dans le journal du serveur */
    }
  }

  /** Les erreurs des dernières 24 h, par code. */
  async function erreurs24h(): Promise<{ serveur: number; rediffusions: number; parCode: Record<string, number> }> {
    const rows = await db.all<{ code: string; n: number }>("SELECT code, COUNT(*) AS n FROM journal_erreurs WHERE at >= ? GROUP BY code", [now() - JOUR_MS]);
    let serveur = 0;
    let rediffusions = 0;
    const parCode: Record<string, number> = {};
    for (const r of rows) {
      parCode[r.code] = r.n;
      if (genreDe(r.code) === "serveur") serveur += r.n;
      else rediffusions += r.n;
    }
    return { serveur, rediffusions, parCode };
  }

  // --- L'entretien : au plus une fois par heure et par instance ---------------------------------------------------------
  let entretenuA = -Infinity;
  /** Efface ce qui a passé sa durée : erreurs de plus de 14 jours, lignes de journal de plus d'un an, rediffusions retirées de plus de 30 jours. */
  async function entretien(): Promise<void> {
    const t = now();
    if (t - entretenuA < 3_600_000) return;
    entretenuA = t;
    try {
      await db.run("DELETE FROM journal_erreurs WHERE at < ?", [t - ERREURS_JOURS * JOUR_MS]);
      await db.run("DELETE FROM journal_admin WHERE at < ?", [t - JOURNAL_ADMIN_JOURS * JOUR_MS]);
      await db.run("UPDATE resultats_retires SET replay = '' WHERE replay <> '' AND removed_at < ?", [t - RETRAIT_REDIFFUSION_JOURS * JOUR_MS]);
    } catch (e) {
      entretenuA = -Infinity; // réessayé à la requête suivante
      log("WARNING", "entretien des journaux impossible", { error: e instanceof Error ? e.message.slice(0, 120) : "inconnue" });
    }
  }

  return { dernieres, noter, erreurs24h, entretien };
}

export type Journaux = ReturnType<typeof createJournaux>;
