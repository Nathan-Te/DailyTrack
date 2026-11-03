import { CODES_ERREUR, estCodeErreur } from "./codesErreur";
import type { SqlDb } from "./db";
import type { Statement } from "./games";
import type { Logger } from "./log";
import { RETOURS_GARDE_JOURS } from "./retours";

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

/**
 * Lot D2 (C1) — **les refus par cause.** Le tableau de bord additionnait huit codes qui n'ont pas la même gravité (D1) : un onglet resté ouvert pendant une mise en production n'est pas un écart de
 * déterminisme. Quatre causes :
 *   - `perime` : l'onglet est d'avant une mise en production (`version`, `sim_version`, `track_mismatch`) — attendu, sans gravité, ne compte pas dans le total « refusés » ;
 *   - `invalide` : la rediffusion elle-même est refusée (le rejeu ne correspond pas, copie, rediffusion abîmée, niveau illisible) — **la ligne à surveiller pour un vrai écart de déterminisme** ;
 *   - `limites` : le serveur refuse par prudence (429 `rate_limited`, 503 `busy`) — la partie repart seule, mais un chiffre qui monte dit que la limite est trop basse ;
 *   - `jour` : le jour n'accepte plus l'envoi ou ne le connaît pas (`day_closed`, `not_daily` : grâce de 10 minutes passée, horloge de l'appareil).
 * Un code d'une autre famille (erreur serveur, nom pris…) n'a pas de cause.
 */
export type Cause = "perime" | "invalide" | "limites" | "jour";
export const CAUSES: readonly Cause[] = ["perime", "invalide", "limites", "jour"];
export const CAUSE_DES_CODES: Readonly<Record<string, Cause>> = {
  version: "perime",
  sim_version: "perime",
  track_mismatch: "perime",
  invalid_replay: "invalide",
  not_finished: "invalide",
  replay_copy: "invalide",
  invalid_level: "invalide",
  rate_limited: "limites",
  busy: "limites",
  day_closed: "jour",
  not_daily: "jour",
};
export const causeDe = (code: string): Cause | null => CAUSE_DES_CODES[code] ?? null;
/** Les codes notés quand ils sortent d'une route d'envoi : les refus de rediffusion, plus la limite de débit et le jour clos. (`busy` est noté partout : c'est un 503.) */
const CODES_NOTES_A_L_ENVOI: readonly string[] = [...CODES_REDIFFUSION_REFUSEE, "rate_limited", "day_closed"];

/** La route sans rien de personnel ni de variable : dates, numéros et identifiants longs remplacés ; bornée. */
export function routeDe(path: string): string {
  return path
    .split("/")
    .map((s) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? ":date" : /^\d+$/.test(s) ? ":n" : /^[0-9a-f]{12,}$/i.test(s) ? ":id" : s.length > 40 ? ":x" : s))
    .join("/")
    .slice(0, 80);
}

/** Cette erreur se note-t-elle au journal des erreurs ? Une erreur serveur, ou un refus à l'envoi d'une partie (rediffusion refusée, limite de débit, jour clos). */
export function aNoter(status: number, code: string, path: string): boolean {
  if (status >= 500) return true;
  return CODES_NOTES_A_L_ENVOI.includes(code) && path.endsWith("/submit");
}

/** Le genre d'un code noté au journal : `serveur` (statut ≥ 500 dans la liste, hors limites) ou `rediffusion` (un refus à l'envoi). */
export function genreDe(code: string): "serveur" | "rediffusion" {
  return estCodeErreur(code) && CODES_ERREUR[code].status >= 500 && causeDe(code) === null ? "serveur" : "rediffusion";
}

/** Les refus d'une période, rangés par cause ; `codes` = le détail par code (au clic dans le panneau). */
export interface CompteurCauses extends Record<Cause | "serveur", number> {
  codes: Record<string, number>;
}
export interface RefusParCause {
  h24: { total: CompteurCauses; parJeu: (CompteurCauses & { jeu: string; nom: string })[] };
  j7: { total: CompteurCauses; parJeu: (CompteurCauses & { jeu: string; nom: string })[] };
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

  /** Les erreurs des dernières 24 h, par code. `rediffusions` : les refus à l'envoi **sans** les onglets périmés ni les limites (lot D2) ; ceux-là ont leurs propres chiffres. */
  async function erreurs24h(): Promise<{ serveur: number; rediffusions: number; perimes: number; limites: number; parCode: Record<string, number> }> {
    const rows = await db.all<{ code: string; n: number }>("SELECT code, COUNT(*) AS n FROM journal_erreurs WHERE at >= ? GROUP BY code", [now() - JOUR_MS]);
    let serveur = 0;
    let rediffusions = 0;
    let perimes = 0;
    let limites = 0;
    const parCode: Record<string, number> = {};
    for (const r of rows) {
      parCode[r.code] = r.n;
      const cause = causeDe(r.code);
      if (cause === "perime") perimes += r.n;
      else if (cause === "limites") limites += r.n;
      else if (genreDe(r.code) === "serveur") serveur += r.n;
      else rediffusions += r.n;
    }
    return { serveur, rediffusions, perimes, limites, parCode };
  }

  /**
   * Lot D2 (C1) — les refus **par cause et par jeu**, sur 24 h et sur 7 jours, avec le détail par code. Une seule lecture (la plus large) ; la route dit le jeu (`jeuDeRoute`). Un refus dont la route
   * n'est celle d'aucun jeu est rangé sous « plateforme ». Aucune donnée de joueur : un code, une route, une heure.
   */
  async function refusParCause(jeux: readonly { code: string; nom: string; prefixe: string }[]): Promise<RefusParCause> {
    const t = now();
    const rows = await db.all<{ code: string; route: string; n7: number; n24: number }>(
      "SELECT code, route, COUNT(*) AS n7, SUM(CASE WHEN at >= ? THEN 1 ELSE 0 END) AS n24 FROM journal_erreurs WHERE at >= ? GROUP BY code, route",
      [t - JOUR_MS, t - 7 * JOUR_MS],
    );
    // Le jeu d'une route : le préfixe le plus long qui la commence (Track : `/api`, tous les autres au-dessus).
    const parPrefixe = [...jeux].sort((a, b) => b.prefixe.length - a.prefixe.length);
    const jeuDe = (route: string) => parPrefixe.find((j) => route === j.prefixe || route.startsWith(`${j.prefixe}/`));
    const vide = (): CompteurCauses => ({ perime: 0, invalide: 0, limites: 0, jour: 0, serveur: 0, codes: {} });
    const periode = (cle: "n24" | "n7"): Record<string, CompteurCauses & { jeu: string; nom: string }> => {
      const out: Record<string, CompteurCauses & { jeu: string; nom: string }> = {};
      for (const r of rows) {
        const n = r[cle] ?? 0;
        if (n <= 0) continue;
        const j = jeuDe(r.route);
        const cle2 = j?.code ?? "plateforme";
        const c = (out[cle2] ??= { jeu: cle2, nom: j?.nom ?? "Plateforme", ...vide() });
        const cause = causeDe(r.code);
        if (cause) c[cause] += n;
        else c.serveur += n;
        c.codes[r.code] = (c.codes[r.code] ?? 0) + n;
      }
      return out;
    };
    const mise = (m: Record<string, CompteurCauses & { jeu: string; nom: string }>) => {
      const ordre = [...jeux.map((j) => j.code), "plateforme"];
      const parJeu = ordre.filter((c) => m[c]).map((c) => m[c]!);
      const total = vide();
      for (const j of parJeu) {
        for (const k of [...CAUSES, "serveur"] as const) total[k] += j[k];
        for (const [code, n] of Object.entries(j.codes)) total.codes[code] = (total.codes[code] ?? 0) + n;
      }
      return { total, parJeu };
    };
    return { h24: mise(periode("n24")), j7: mise(periode("n7")) };
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
      // Lot C1 : un fil de retours est effacé 12 mois après son dernier message (les messages d'abord : ils se trouvent par les fils).
      await db.run("DELETE FROM retours_messages WHERE retour_id IN (SELECT id FROM retours WHERE maj_le < ?)", [t - RETOURS_GARDE_JOURS * JOUR_MS]);
      await db.run("DELETE FROM retours WHERE maj_le < ?", [t - RETOURS_GARDE_JOURS * JOUR_MS]);
    } catch (e) {
      entretenuA = -Infinity; // réessayé à la requête suivante
      log("WARNING", "entretien des journaux impossible", { error: e instanceof Error ? e.message.slice(0, 120) : "inconnue" });
    }
  }

  return { dernieres, noter, erreurs24h, refusParCause, entretien };
}

export type Journaux = ReturnType<typeof createJournaux>;
